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
let db;
if(EMU){db=F.initializeFirestore(app,{localCache:F.memoryLocalCache()})}
else{db=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})})}
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
function startSync(){D={types:[],shared:[],thr:{},stock:{},expected:{},buyDismissedThrough:0,orders:[],log:[],users:[],clients:[],partners:[],welding:[],weldingLog:[],schema:0,vbom:null,inventoryApplied:null,weldingSeeded:false};let got={cfg:0,stock:0};
 const done=()=>{if(got.cfg&&got.stock){if(!D.types.length){const s=seed();D.types=s.types;D.shared=s.shared;D.thr=s.thr;D.schema=s.schema;D.vbom=s.vbom;D.weldingSeeded=!!s.weldingSeeded;D.expected=s.expected||D.expected||{}}remote()}};
 subs.push(F.onSnapshot(R.cfg,s=>{const c=s.data()||{};D.types=c.types||[];D.shared=c.shared||[];D.thr=c.thr||{};D.schema=c.schema||0;D.vbom=c.vbom||null;D.inventoryApplied=c.inventoryApplied||null;D.weldingSeeded=!!c.weldingSeeded;got.cfg=1;done()},e=>fail(e)));
 subs.push(F.onSnapshot(R.stock,s=>{const x=s.data()||{};D.stock=x.stock||{};D.expected=x.expected||{};D.buyDismissedThrough=+x.buyDismissedThrough||0;D.buyDismissedAt=x.buyDismissedAt||null;got.stock=1;done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.collection(db,'users'),s=>{D.users=docs(s).map(u=>({...u,uid:u._id}));const m=D.users.find(u=>u.uid===ME.uid);
   if(!m||m.active===false){bad('Доступ отключён администратором');FB.logout();return}ME=m;done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'orders'),F.orderBy('id','desc'),F.limit(500)),s=>{D.orders=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'log'),F.orderBy('ts','desc'),F.limit(300)),s=>{D.log=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'clients'),F.orderBy('name'),F.limit(500)),s=>{D.clients=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.collection(db,'partners'),s=>{D.partners=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.collection(db,'welding'),s=>{D.welding=docs(s);done()},e=>fail(e)));
 subs.push(F.onSnapshot(F.query(F.collection(db,'weldingLog'),F.orderBy('ts','desc'),F.limit(200)),s=>{D.weldingLog=docs(s);done()},e=>fail(e)));
}
function fail(e){console.error(e);bad(err(e));if(e.code==='permission-denied'){FB.logout()}else render()}
let BOOTING=false;
onAuthStateChanged(auth,async u=>{if(BOOTING)return;unsub();if(!u){U=ME=D=null;await checkBoot();STATUS='ready';render();return}
 try{const p=await F.getDoc(F.doc(db,'users',u.uid));const d=p.data();
  if(!d||d.active===false){bad(d?'Доступ отключён администратором':'Пользователь не найден в списке доверенных');await signOut(auth);return}
  ME={...d,uid:u.uid};U=d.login;STATUS='ready';D=null;render();startSync()}catch(e){bad(err(e));await signOut(auth)}});
// run a stock-changing operation atomically: read fresh stock, apply core function, write stock + log (+ order)
async function txStock(fn){const ts=new Date().toISOString();return F.runTransaction(db,async tx=>{const s=(await tx.get(R.stock)).data()||{stock:{},next:1};
 const d={types:D.types,shared:D.shared,thr:D.thr,vbom:D.vbom,schema:D.schema,stock:{...s.stock},expected:{...(s.expected||{})},orders:[],log:[]};const r=fn(d,s,tx);
 tx.update(R.stock,{stock:d.stock,expected:d.expected,next:d._next!=null?d._next:(d.orders.length?d.orders[0].id+1:(s.next||1))});
 d.log.forEach(l=>tx.set(F.doc(F.collection(db,'log')),{...l,uid:ME.uid}));d.orders.forEach(o=>tx.set(F.doc(F.collection(db,'orders')),{...o,uid:ME.uid}));return r})}
const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j({code:'unavailable'}),ms))]);
const cfgData=()=>({types:D.types,shared:D.shared,thr:D.thr,schema:D.schema||6,vbom:D.vbom||{horn:{name:'Рупор',unit:'шт',qty:1},cup:{name:'Стакан',unit:'шт',qty:1},blank:{name:'Заготовка рупора',unit:'шт',qty:2}},inventoryApplied:D.inventoryApplied||null,weldingSeeded:!!D.weldingSeeded});
async function seedWelding(batch,force){
  const notes=[];
  for(const p of WELD_SEED_PARTNERS){
    const ref=F.doc(db,'partners',p.id);
    const snap=await F.getDoc(ref);
    if(!snap.exists()){batch.set(ref,{name:p.name,active:true,created:new Date().toISOString(),seed:true});notes.push('Партнёр «'+p.name+'»')}
    else if(force){/* keep existing names/totals */}
  }
  for(const row of WELD_SEED_ROWS){
    const id=weldDocId(row.partnerId,row.code);
    const ref=F.doc(db,'welding',id);
    const snap=await F.getDoc(ref);
    const parsed=parseWeldCode(row.code);
    if(!snap.exists()){
      batch.set(ref,{partnerId:row.partnerId,code:row.code,typeId:parsed.typeId,dbi:parsed.dbi,conn:parsed.conn,received:row.received,returned:row.returned,seed:true,updated:new Date().toISOString()});
      notes.push(row.partnerId+': '+row.code+' '+row.received+'/'+row.returned);
    }
  }
  return notes;
}
async function migrateWeldingDocs(batch){
  const notes=[];
  const snap=await F.getDocs(F.collection(db,'welding'));
  const docs=snap.docs.map(doc=>({ref:doc.ref,id:doc.id,data:doc.data()||{}}));
  const byNew={};const dels=[];
  for(const doc of docs){
    const w=doc.data;const parsed=parseWeldCode(w.code||'',{types:(D&&D.types)||[]});
    if(!parsed){notes.push('Пропущен документ сварки '+doc.id);continue}
    const newCode=parsed.code,newId=weldDocId(w.partnerId,newCode);
    const legacy=doc.id!==newId||(w.code&&w.code!==newCode);
    if(!legacy)continue;
    if(!byNew[newId]){
      const existing=docs.find(x=>x.id===newId);
      const base=existing?existing.data:{};
      byNew[newId]={partnerId:w.partnerId,code:newCode,typeId:parsed.typeId,dbi:parsed.dbi,received:+base.received||0,returned:+base.returned||0,updated:new Date().toISOString()};
    }
    byNew[newId].received+=(+w.received||0);
    byNew[newId].returned+=(+w.returned||0);
    dels.push(doc.ref);
  }
  Object.entries(byNew).forEach(([id,rec])=>{
    batch.set(F.doc(db,'welding',id),rec,{merge:true});
    notes.push((rec.partnerId||'')+': '+rec.code+' → получено '+rec.received+' / вернули '+rec.returned+' (на сварке '+Math.max(0,rec.received-rec.returned)+')');
  });
  dels.forEach(ref=>batch.delete(ref));
  if(dels.length)notes.push('Старые записи сварки (код с разъёмами) объединены по ГГц+дБи: '+dels.length+' шт.');
  else notes.push('Записи сварки уже в формате ГГц+дБи (идемпотентно).');
  return notes;
}
W.FB={err,email,
 async login(l,p){await signInWithEmailAndPassword(auth,email(l),p)},
 logout(){unsub();return signOut(auth)},
 async bootstrap(l,p){await checkBoot();if(BOOT)throw Error('Администратор уже создан — войдите');BOOTING=true;try{const c=await createUserWithEmailAndPassword(auth,email(l),p);
  const s=seed(),b=F.writeBatch(db);b.set(F.doc(db,'users',c.user.uid),{login:l.trim(),name:l.trim(),admin:true,active:true,created:new Date().toISOString()});
  b.set(R.pub,{bootstrapped:true});b.set(R.cfg,{types:s.types,shared:s.shared,thr:s.thr,schema:s.schema,vbom:s.vbom,weldingSeeded:true});b.set(R.stock,{stock:s.stock,expected:s.expected||{},next:1});
  WELD_SEED_PARTNERS.forEach(p=>b.set(F.doc(db,'partners',p.id),{name:p.name,active:true,created:new Date().toISOString(),seed:true}));
  WELD_SEED_ROWS.forEach(row=>{const parsed=parseWeldCode(row.code);b.set(F.doc(db,'welding',weldDocId(row.partnerId,row.code)),{partnerId:row.partnerId,code:row.code,typeId:parsed.typeId,dbi:parsed.dbi,conn:parsed.conn,received:row.received,returned:row.returned,seed:true,updated:new Date().toISOString()})});
  await b.commit();
  ME={login:l.trim(),name:l.trim(),admin:true,active:true,uid:c.user.uid};U=ME.login;STATUS='ready';unsub();startSync()}finally{BOOTING=false}},
 order(lines,meta){return withTimeout(txStock((d,s)=>{d.orders=[{id:(s.next||1)-1}];const r=placeOrder(d,lines,U,meta);d.orders=d.orders.filter(o=>o.lines);d._next=(r.id||r)+1;return r}))},
 adjust(k,v,m,note){return withTimeout(txStock(d=>adjust(d,k,v,m,U,note)))},
 async applyInventory(map){if(!me().admin)throw Error('Только администратор');
  return withTimeout(F.runTransaction(db,async tx=>{const s=(await tx.get(R.stock)).data()||{stock:{},next:1};
   const stock={...s.stock};const ts=new Date().toISOString();const logs=[];let changed=0;
   Object.entries(map).forEach(([k,v])=>{const nv=+v;if(isNaN(nv)||nv<0)return;const old=stock[k]||0;if(old===nv)return;
    stock[k]=nv;changed++;logs.push({ts,user:U,uid:ME.uid,key:k,name:partName(D,k),delta:nv-old,kind:'Корректировка: Инвентарь 09.11.2026'})});
   tx.update(R.stock,{stock,next:s.next||1});
   logs.forEach(l=>tx.set(F.doc(F.collection(db,'log')),l));
   tx.update(R.cfg,{inventoryApplied:'2026-11-09'});
   return{changed,total:Object.keys(map).length}}))},
 saveConfig(){return F.setDoc(R.cfg,cfgData())},
 async createUser(l,p,admin){const a2=initializeApp(firebaseConfig,'sec'+Date.now()),au2=getAuth(a2);
  if(EMU){const A=await import(G+'firebase-auth.js');A.connectAuthEmulator(au2,'http://127.0.0.1:9099',{disableWarnings:true})}
  try{const c=await createUserWithEmailAndPassword(au2,email(l),p);await F.setDoc(F.doc(db,'users',c.user.uid),{login:l.trim(),name:l.trim(),admin:!!admin,active:true,created:new Date().toISOString()});await signOut(au2)}
  finally{const {deleteApp}=await import(G+'firebase-app.js');deleteApp(a2)}},
 setUser(uid,patch){return F.updateDoc(F.doc(db,'users',uid),patch)},
 delUser(uid){return F.deleteDoc(F.doc(db,'users',uid))},
 changeMyPassword(p){return updatePassword(auth.currentUser,p)},
 async saveClient(c){const data={name:(c.name||'').trim(),contact:(c.contact||'').trim(),phone:(c.phone||'').trim(),notes:(c.notes||'').trim(),updated:new Date().toISOString()};
  if(!data.name)throw Error('Укажите имя клиента');
  if(c._id){await F.updateDoc(F.doc(db,'clients',c._id),data);return c._id}
  data.created=data.updated;data.uid=ME.uid;const ref=await F.addDoc(F.collection(db,'clients'),data);return ref.id},
 delClient(id){return F.deleteDoc(F.doc(db,'clients',id))},
 async savePartner(c){const name=(c.name||'').trim();const data={updated:new Date().toISOString()};
  if(c.name!=null){if(!name)throw Error('Укажите имя партнёра');data.name=name}
  if(c.active!=null)data.active=!!c.active;
  if(c._id){await F.setDoc(F.doc(db,'partners',c._id),data,{merge:true});return c._id}
  data.name=name;data.active=true;data.created=data.updated;data.uid=ME.uid;
  const ref=await F.addDoc(F.collection(db,'partners'),data);return ref.id},
 delPartner(id){return F.deleteDoc(F.doc(db,'partners',id))},
 async weldSend(partnerId,code,qty){const n=+qty;if(!(n>0))throw Error('Укажите количество');
  const parsed=parseWeldCode(code);if(!parsed)throw Error('Неверный тип рупора');
  const codeN=parsed.code;
  const partner=(D.partners||[]).find(p=>p._id===partnerId);if(!partner||partner.active===false)throw Error('Выберите партнёра');
  return withTimeout(F.runTransaction(db,async tx=>{
   const s=(await tx.get(R.stock)).data()||{stock:{},expected:{},next:1};
   const wref=F.doc(db,'welding',weldDocId(partnerId,codeN));
   const wsnap=await tx.get(wref);
   const rec=wsnap.exists()?{...wsnap.data()}:{partnerId,code:codeN,typeId:parsed.typeId,dbi:parsed.dbi,received:0,returned:0};
   rec.partnerId=partnerId;rec.code=codeN;rec.typeId=parsed.typeId;rec.dbi=parsed.dbi;if('conn' in rec)delete rec.conn;
   const d={types:D.types,shared:D.shared,thr:D.thr,vbom:D.vbom,schema:D.schema,stock:{...s.stock},expected:{...(s.expected||{})},orders:[],log:[]};
   const r=weldSendCore(d,rec,n,U,partner.name);
   tx.update(R.stock,{stock:d.stock,expected:d.expected,next:s.next||1});
   tx.set(wref,{...rec,updated:new Date().toISOString()},{merge:true});
   d.log.forEach(l=>tx.set(F.doc(F.collection(db,'log')),{...l,uid:ME.uid}));
   tx.set(F.doc(F.collection(db,'weldingLog')),{ts:new Date().toISOString(),user:U,uid:ME.uid,kind:'Отправить',partnerId,partnerName:partner.name,code:codeN,qty:n,deducted:r.deducted,short:r.short});
   return{n,deducted:r.deducted,short:r.short,received:r.received}}))},
 async weldRecv(partnerId,code,qty){const m=+qty;if(!(m>0))throw Error('Укажите количество');
  const parsed=parseWeldCode(code);if(!parsed)throw Error('Неверный тип рупора');
  const codeN=parsed.code;
  const partner=(D.partners||[]).find(p=>p._id===partnerId);if(!partner||partner.active===false)throw Error('Выберите партнёра');
  return withTimeout(F.runTransaction(db,async tx=>{
   const s=(await tx.get(R.stock)).data()||{stock:{},expected:{},next:1};
   const wref=F.doc(db,'welding',weldDocId(partnerId,codeN));
   const wsnap=await tx.get(wref);
   if(!wsnap.exists())throw Error('У партнёра нет остатка по этому типу');
   const rec={...wsnap.data()};
   rec.partnerId=partnerId;rec.code=codeN;rec.typeId=parsed.typeId;rec.dbi=parsed.dbi;if('conn' in rec)delete rec.conn;
   const d={types:D.types,shared:D.shared,thr:D.thr,vbom:D.vbom,schema:D.schema,stock:{...s.stock},expected:{...(s.expected||{})},orders:[],log:[]};
   const r=weldRecvCore(d,rec,m,U,partner.name);
   tx.update(R.stock,{stock:d.stock,expected:d.expected,next:s.next||1});
   tx.set(wref,{...rec,updated:new Date().toISOString()},{merge:true});
   d.log.forEach(l=>tx.set(F.doc(F.collection(db,'log')),{...l,uid:ME.uid}));
   tx.set(F.doc(F.collection(db,'weldingLog')),{ts:new Date().toISOString(),user:U,uid:ME.uid,kind:'Принять',partnerId,partnerName:partner.name,code:codeN,qty:m,remainder:r.remainder});
   return{m,remainder:r.remainder,returned:r.returned}}))},
 async expectAdd(typeId,dbi,qty){const n=+qty;if(!(n>0)||n!==Math.floor(n))throw Error('Укажите целое количество');
  const k=expectKey(typeId,dbi),bk=blankKey(typeId,dbi);
  return withTimeout(F.runTransaction(db,async tx=>{
   const s=(await tx.get(R.stock)).data()||{stock:{},expected:{},next:1};
   const expected={...(s.expected||{})};expected[k]=(+expected[k]||0)+n;
   tx.update(R.stock,{expected});
   tx.set(F.doc(F.collection(db,'log')),{ts:new Date().toISOString(),user:U,uid:ME.uid,key:bk,name:partName(D,bk),delta:0,kind:'Ожидается от поставщика +'+n});
   return{n,expected:expected[k]}}))},
 async expectRecv(typeId,dbi,qty){const n=+qty;if(!(n>0)||n!==Math.floor(n))throw Error('Укажите целое количество');
  const k=expectKey(typeId,dbi),bk=blankKey(typeId,dbi);
  return withTimeout(F.runTransaction(db,async tx=>{
   const s=(await tx.get(R.stock)).data()||{stock:{},expected:{},next:1};
   const expected={...(s.expected||{})},stock={...s.stock};const have=+expected[k]||0;
   if(n>have)throw Error('Нельзя принять больше ожидаемого ('+have+')');
   expected[k]=have-n;stock[bk]=(stock[bk]||0)+n;
   tx.update(R.stock,{stock,expected,next:s.next||1});
   tx.set(F.doc(F.collection(db,'log')),{ts:new Date().toISOString(),user:U,uid:ME.uid,key:bk,name:partName(D,bk),delta:n,kind:'Приход от поставщика (ожидалось)'});
   return{n,expected:expected[k],stock:stock[bk]}}))},
 async dismissBuyAlert(){const through=Math.max(0,...(D.orders||[]).map(o=>+o.id||0));
  return withTimeout(F.runTransaction(db,async tx=>{
   const s=await tx.get(R.stock);if(!s.exists)throw Error('Нет документа склада');
   tx.update(R.stock,{buyDismissedThrough:through,buyDismissedAt:new Date().toISOString(),buyDismissedBy:U});
   return{through}}))},
 async completeOrder(oid){return withTimeout(F.runTransaction(db,async tx=>{const ref=F.doc(db,'orders',oid);const snap=await tx.get(ref);const o=snap.data();
  if(!o)throw Error('Заказ не найден');if(o.status&&o.status!=='active')throw Error('Заказ уже не в работе');
  tx.update(ref,{status:'done',doneAt:new Date().toISOString(),doneBy:U})}))},
 async cancelOrder(oid){return withTimeout(F.runTransaction(db,async tx=>{const oref=F.doc(db,'orders',oid);const o=(await tx.get(oref)).data();
  if(!o)throw Error('Заказ не найден');if(o.status&&o.status!=='active')throw Error('Заказ уже не в работе');
  const s=(await tx.get(R.stock)).data()||{stock:{},next:1};
  const d={types:D.types,shared:D.shared,thr:D.thr,vbom:D.vbom,schema:D.schema,stock:{...s.stock},orders:[],log:[]};
  const ts=new Date().toISOString();
  const parts=o.parts&&o.parts.length?o.parts:requirements(d,o.lines||[]).map(x=>({key:x.key,name:partName(d,x.key),deducted:x.need}));
  parts.forEach(p=>{const add=+p.deducted||0;if(!(add>0))return;d.stock[p.key]=(d.stock[p.key]||0)+add;d.log.push({ts,user:U,key:p.key,name:p.name||partName(d,p.key),delta:add,kind:'Отмена #'+o.id})});
  tx.update(R.stock,{stock:d.stock,next:s.next||1});
  d.log.forEach(l=>tx.set(F.doc(F.collection(db,'log')),{...l,uid:ME.uid}));
  tx.update(oref,{status:'cancelled',cancelledAt:ts,cancelledBy:U})}))},
 async migrateSchema(){if(!me().admin)throw Error('Только администратор');
  const cfgSnap=await F.getDoc(R.cfg);const stSnap=await F.getDoc(R.stock);
  const cfg=cfgSnap.data()||{};const st=stSnap.data()||{stock:{},next:1};
  const d={types:JSON.parse(JSON.stringify(cfg.types||[])),shared:JSON.parse(JSON.stringify(cfg.shared||[])),thr:JSON.parse(JSON.stringify(cfg.thr||{})),vbom:cfg.vbom?JSON.parse(JSON.stringify(cfg.vbom)):null,schema:cfg.schema||0,stock:JSON.parse(JSON.stringify(st.stock||{})),expected:JSON.parse(JSON.stringify(st.expected||{})),orders:[],log:[],users:[],weldingSeeded:!!cfg.weldingSeeded};
  migrate(d);
  const {notes}=runMigrations(d);
  const batch=F.writeBatch(db);
  const mergeNotes=await migrateWeldingDocs(batch);
  if(mergeNotes.length)notes.push(...mergeNotes);
  const weldNotes=await seedWelding(batch,false);
  if(weldNotes.length)notes.push('Сиды сварки: '+weldNotes.join('; '));
  else if(!cfg.weldingSeeded)notes.push('Партнёры и строки сварки уже на месте (идемпотентно).');
  notes.push('Исторические «вернули» не добавляют рупоры на склад — они уже учтены в остатках.');
  batch.set(R.cfg,{types:d.types,shared:d.shared,thr:d.thr,schema:d.schema,vbom:d.vbom,inventoryApplied:cfg.inventoryApplied||null,weldingSeeded:true});
  batch.update(R.stock,{stock:d.stock,expected:d.expected||{},next:st.next||1});
  await batch.commit();
  try{
    const oq=await F.getDocs(F.query(F.collection(db,'orders'),F.limit(500)));
    const toPatch=oq.docs.filter(doc=>!doc.data().status);
    for(let i=0;i<toPatch.length;i+=400){
      const b=F.writeBatch(db);
      toPatch.slice(i,i+400).forEach(doc=>{const o=doc.data();b.update(doc.ref,{status:'done',doneAt:o.ts||new Date().toISOString(),legacy:true})});
      await b.commit();
    }
    if(toPatch.length)notes.push('Старые заказы без статуса помечены как «Выполнен»: '+toPatch.length);
  }catch(e){notes.push('Схема склада обновлена. Пометка старых заказов отложена — опубликуйте firestore.rules, затем нажмите обновление ещё раз.')}
  D.types=d.types;D.shared=d.shared;D.thr=d.thr;D.schema=d.schema;D.vbom=d.vbom;D.stock=d.stock;D.expected=d.expected||{};D.weldingSeeded=true;D.inventoryApplied=cfg.inventoryApplied||null;D._migNotes=notes;
  return notes},
 async importLocal(o){migrate(o);if(needsMig(o))runMigrations(o);
  const ops=[[R.cfg,{types:o.types,shared:o.shared,thr:o.thr,schema:o.schema||6,vbom:o.vbom,weldingSeeded:!!o.weldingSeeded,inventoryApplied:o.inventoryApplied||null}],[R.stock,{stock:o.stock,expected:o.expected||{},next:(o.orders.reduce((m,x)=>Math.max(m,x.id||0),0))+1,buyDismissedThrough:o.buyDismissedThrough||0,buyDismissedAt:o.buyDismissedAt||null}],
  ...o.orders.map(x=>[F.doc(db,'orders',String(x.id).padStart(6,'0')),{status:'done',doneAt:x.ts,...x,uid:ME.uid}]),...o.log.map(x=>[F.doc(F.collection(db,'log')),{...x,name:x.name||partName(o,x.key),uid:ME.uid}])];
  for(let i=0;i<ops.length;i+=400){const b=F.writeBatch(db);ops.slice(i,i+400).forEach(([r,v])=>b.set(r,JSON.parse(JSON.stringify(v))));await b.commit()}}
};
