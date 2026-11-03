// Firestore/Auth data layer. UI (index.html) holds the in-memory copy D; this module keeps it in sync.
const V='10.12.2',G=`https://www.gstatic.com/firebasejs/${V}/`;
const {initializeApp}=await import(G+'firebase-app.js');
const {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword,setPersistence,browserLocalPersistence}=await import(G+'firebase-auth.js');
const F=await import(G+'firebase-firestore.js');
const {firebaseConfig}=await import('./firebase-config.js');
const W=window;
if(!firebaseConfig.apiKey||firebaseConfig.apiKey.startsWith('PASTE')){W.STATUS='noconfig';STATUS='noconfig';render();throw Error('no config')}
const app=initializeApp(firebaseConfig),auth=getAuth(app);
const EMU=new URLSearchParams(location.search).has('emu');
const db=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})});
await setPersistence(auth,browserLocalPersistence);
if(EMU){const A=await import(G+'firebase-auth.js');A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});F.connectFirestoreEmulator(db,'127.0.0.1',8080)}
const R={pub:F.doc(db,'meta','public'),cfg:F.doc(db,'config','main'),stock:F.doc(db,'stock','main')};
// login name -> synthetic email (hex of UTF-8 so Cyrillic logins work)
const email=l=>'u'+[...new TextEncoder().encode(l.trim().toLowerCase())].map(b=>b.toString(16).padStart(2,'0')).join('')+'@sprut.local';
let subs=[];const unsub=()=>{subs.forEach(f=>f());subs=[]};
const ERR={'auth/invalid-credential':'Неверный логин или пароль','auth/wrong-password':'Неверный логин или пароль','auth/user-not-found':'Неверный логин или пароль',
'auth/invalid-email':'Неверный логин','auth/email-already-in-use':'Такой логин уже зарегистрирован в Firebase (удалите его в Console → Authentication)','auth/weak-password':'Пароль слишком простой (мин. 6 символов)',
'auth/network-request-failed':'Нет связи с сервером','auth/too-many-requests':'Слишком много попыток, подождите','permission-denied':'Нет прав (доступ отключён?)','unavailable':'Нет связи — операция требует интернет',
'auth/requires-recent-login':'Выйдите и войдите заново, затем повторите'};
const err=e=>ERR[e.code]||e.message||String(e);
async function checkBoot(){try{BOOT=(await F.getDoc(R.pub)).exists()}catch(e){BOOT=true}}
const docs=s=>s.docs.map(d=>({...d.data(),_id:d.id}));
function startSync(){D={types:[],shared:[],thr:{},stock:{},orders:[],log:[],users:[]};let got={cfg:0,stock:0};
 const done=()=>{if(got.cfg&&got.stock){if(!D.types.length)D.types=seed().types;remote()}};
 subs.push(F.onSnapshot(R.cfg,s=>{const c=s.data()||{};D.types=c.types||[];D.shared=c.shared||[];D.thr=c.thr||{};got.cfg=1;done()},e=>fail(e)));
 subs.push(F.onSnapshot(R.stock,s=>{D.stock=(s.data()||{}).stock||{};got.stock=1;done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.collection(db,'users'),s=>{D.users=docs(s).map(u=>({...u,uid:u._id}));const m=D.users.find(u=>u.uid===ME.uid);
   if(!m||m.active===false){bad('Доступ отключён администратором');FB.logout();return}ME=m;done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'orders'),F.orderBy('id','desc'),F.limit(300)),s=>{D.orders=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'log'),F.orderBy('ts','desc'),F.limit(300)),s=>{D.log=docs(s);done()},e=>fail(e)));
}
function fail(e){console.error(e);bad(err(e));if(e.code==='permission-denied'){FB.logout()}else render()}
let BOOTING=false;
onAuthStateChanged(auth,async u=>{if(BOOTING)return;unsub();if(!u){U=ME=D=null;await checkBoot();STATUS='ready';render();return}
 try{const p=await F.getDoc(F.doc(db,'users',u.uid));const d=p.data();
  if(!d||d.active===false){bad(d?'Доступ отключён администратором':'Пользователь не найден в списке доверенных');await signOut(auth);return}
  ME={...d,uid:u.uid};U=d.login;STATUS='ready';D=null;render();startSync()}catch(e){bad(err(e));await signOut(auth)}});
// run a stock-changing operation atomically: read fresh stock, apply core function, write stock + log (+ order)
async function txStock(fn){const ts=new Date().toISOString();return F.runTransaction(db,async tx=>{const s=(await tx.get(R.stock)).data()||{stock:{},next:1};
 const d={types:D.types,shared:D.shared,thr:D.thr,stock:{...s.stock},orders:[],log:[]};const r=fn(d,s);
 tx.update(R.stock,{stock:d.stock,next:d.orders.length?d.orders[0].id+1:(s.next||1)});
 d.log.forEach(l=>tx.set(F.doc(F.collection(db,'log')),{...l,uid:ME.uid}));d.orders.forEach(o=>tx.set(F.doc(F.collection(db,'orders')),{...o,uid:ME.uid}));return r})}
const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j({code:'unavailable'}),ms))]);
const cfgData=()=>({types:D.types,shared:D.shared,thr:D.thr});
W.FB={err,email,
 async login(l,p){await signInWithEmailAndPassword(auth,email(l),p)},
 logout(){unsub();return signOut(auth)},
 async bootstrap(l,p){await checkBoot();if(BOOT)throw Error('Администратор уже создан — войдите');BOOTING=true;try{const c=await createUserWithEmailAndPassword(auth,email(l),p);
  const s=seed(),b=F.writeBatch(db);b.set(F.doc(db,'users',c.user.uid),{login:l.trim(),name:l.trim(),admin:true,active:true,created:new Date().toISOString()});
  b.set(R.pub,{bootstrapped:true});b.set(R.cfg,{types:s.types,shared:s.shared,thr:s.thr});b.set(R.stock,{stock:s.stock,next:1});await b.commit();
  // re-trigger profile load (auth state fired before profile existed)
  ME={login:l.trim(),name:l.trim(),admin:true,active:true,uid:c.user.uid};U=ME.login;STATUS='ready';unsub();startSync()}finally{BOOTING=false}},
 order(lines,note){return withTimeout(txStock((d,s)=>{d.orders=[{id:(s.next||1)-1}];const id=placeOrder(d,lines,U,note);d.orders=d.orders.filter(o=>o.lines);return id}))},
 adjust(k,v,m,note){return withTimeout(txStock(d=>adjust(d,k,v,m,U,note)))},
 saveConfig(){return F.setDoc(R.cfg,cfgData())},
 async createUser(l,p,admin){const a2=initializeApp(firebaseConfig,'sec'+Date.now()),au2=getAuth(a2);
  if(EMU){const A=await import(G+'firebase-auth.js');A.connectAuthEmulator(au2,'http://127.0.0.1:9099',{disableWarnings:true})}
  try{const c=await createUserWithEmailAndPassword(au2,email(l),p);await F.setDoc(F.doc(db,'users',c.user.uid),{login:l.trim(),name:l.trim(),admin:!!admin,active:true,created:new Date().toISOString()});await signOut(au2)}
  finally{const {deleteApp}=await import(G+'firebase-app.js');deleteApp(a2)}},
 setUser(uid,patch){return F.updateDoc(F.doc(db,'users',uid),patch)},
 delUser(uid){return F.deleteDoc(F.doc(db,'users',uid))},
 changeMyPassword(p){return updatePassword(auth.currentUser,p)},
 async importLocal(o){const ops=[[R.cfg,{types:o.types,shared:o.shared,thr:o.thr}],[R.stock,{stock:o.stock,next:(o.orders.reduce((m,x)=>Math.max(m,x.id),0))+1}],
  ...o.orders.map(x=>[F.doc(db,'orders',String(x.id).padStart(6,'0')),{...x,uid:ME.uid}]),...o.log.map(x=>[F.doc(F.collection(db,'log')),{...x,name:x.name||partName(o,x.key),uid:ME.uid}])];
  for(let i=0;i<ops.length;i+=400){const b=F.writeBatch(db);ops.slice(i,i+400).forEach(([r,v])=>b.set(r,JSON.parse(JSON.stringify(v))));await b.commit()}}
};
