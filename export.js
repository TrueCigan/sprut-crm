// Inventory + orders export: Excel (ExcelJS) and PDF (jsPDF + autotable, DejaVu for Cyrillic). Lazy CDN load.
const XL={exceljs:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',jspdf:'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
 at:'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',font:'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
 fontB:'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf'};
const loadJs=(()=>{const c={};return u=>c[u]||(c[u]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>{delete c[u];no(Error('Не удалось загрузить библиотеку (нет интернета?)'))};document.head.appendChild(s)}))})();
const collE=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
const ghzE=t=>{const m=String(t.name||t.id).match(/\d+([.,]\d+)?/);return m?parseFloat(m[0].replace(',','.')):1e9};
function invRows(d){const st=k=>{const v=d.stock[k]||0;return v<=0?'Нет':v<=(d.thr[k]||0)?'Мало':'OK'};
 const row=(sec,name,k,unit)=>({sec,name,qty:d.stock[k]||0,unit:unit||'',thr:d.thr[k]||0,status:st(k)});
 const sections=[];
 const shared=[...(d.shared||[])].sort((a,b)=>collE.compare(a.name,b.name)).map(p=>row('Общие детали',p.name,p.id,p.unit));
 sections.push({title:'Общие детали',rows:shared});
 const types=[...(d.types||[])].sort((a,b)=>ghzE(a)-ghzE(b)||collE.compare(a.name,b.name));
 for(const t of types){const rows=[];
  [...(t.parts||[])].sort((a,b)=>collE.compare(a.name,b.name)).forEach(p=>rows.push(row(t.name,p.name+' (весь '+t.name+')',t.id+'|'+p.id,p.unit)));
  [...(t.dbis||[])].sort((a,b)=>a-b).forEach(dbi=>{
   const hk=t.id+'|'+dbi+'|horn';const hb=(d.vbom||{}).horn||{name:'Деталь для рупора',unit:'шт'};
   rows.push(row(t.name+' · '+dbi+' дБи',hb.name+' · '+dbi+' дБи',hk,hb.unit));
   [...(t.conns||[])].sort((a,b)=>a-b).forEach(c=>{const ck=t.id+'|'+dbi+'|'+c+'|cup';const cb=(d.vbom||{}).cup||{name:'Стакан',unit:'шт'};
    rows.push(row(t.name+' · '+dbi+' дБи',cb.name+' · '+dbi+' дБи / '+c+' разъем.',ck,cb.unit))})});
  sections.push({title:'Антенна '+t.name,rows})}
 return sections}
function stamp(){const now=new Date();return{now,txt:now.toLocaleString('ru-RU',{timeZone:'Europe/Warsaw',dateStyle:'long',timeStyle:'short'})+' (Варшава)',
 file:now.toLocaleString('sv-SE',{timeZone:'Europe/Warsaw'}).slice(0,16).replace(' ','_').replace(':','-')}}
async function deliver(blob,name){const f=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:name});return}catch(e){if(e.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}
const COL={low:'FFF3D9A0',zero:'FFF4B4AA',head:'FF2C353D',sec:'FFDDE6CF'};
async function buildXlsx(d,who){await loadJs(XL.exceljs);const S=stamp(),wb=new ExcelJS.Workbook();wb.creator='SprutTactical CRM';const ws=wb.addWorksheet('Склад',{views:[{state:'frozen',ySplit:4}]});
 ws.columns=[{width:28},{width:40},{width:12},{width:8},{width:10},{width:10}];
 ws.mergeCells('A1:F1');ws.getCell('A1').value='SprutTactical — остатки склада';ws.getCell('A1').font={bold:true,size:16};
 ws.mergeCells('A2:F2');ws.getCell('A2').value='Дата: '+S.txt+' · Выгрузил: '+who;ws.getCell('A2').font={italic:true,color:{argb:'FF555555'}};
 ws.mergeCells('A3:F3');ws.getCell('A3').value='CMA = число разъёмов; Втулка = 1 при 1 разъёме; Заглушка на весь ГГц; рупор по дБи; стакан по дБи+разъёмам';ws.getCell('A3').font={size:9,color:{argb:'FF666666'}};
 const h=ws.getRow(4);h.values=['Тип/раздел','Деталь','Остаток','Ед.','Порог','Статус'];h.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:COL.head}}});
 const bd={style:'thin',color:{argb:'FFBBBBBB'}};let n={ok:0,low:0,zero:0,all:0};
 for(const s of invRows(d)){const r=ws.addRow([s.title]);ws.mergeCells(`A${r.number}:F${r.number}`);r.getCell(1).font={bold:true};r.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:COL.sec}};
  for(const x of s.rows){const r=ws.addRow([x.sec,x.name,x.qty,x.unit,x.thr,x.status]);n.all++;n[x.status==='OK'?'ok':x.status==='Мало'?'low':'zero']++;
   r.eachCell({includeEmpty:true},c=>c.border={top:bd,bottom:bd,left:bd,right:bd});[3,5].forEach(i=>r.getCell(i).alignment={horizontal:'right'});
   if(x.status!=='OK'){const f={type:'pattern',pattern:'solid',fgColor:{argb:x.status==='Нет'?COL.zero:COL.low}};r.eachCell({includeEmpty:true},c=>c.fill=f);r.getCell(6).font={bold:true}}}}
 ws.addRow([]);const t=ws.addRow(['Итого позиций: '+n.all,'OK: '+n.ok+' · Мало: '+n.low+' · Нет: '+n.zero]);t.font={bold:true};
 ws.autoFilter={from:'A4',to:'F4'};ws.pageSetup={orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
 return{blob:new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name:`SprutTactical_sklad_${S.file}.xlsx`}}
const b64=buf=>{let s='',u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
async function buildPdf(d,who){await loadJs(XL.jspdf);await loadJs(XL.at);const S=stamp();const[f1,f2]=await Promise.all([XL.font,XL.fontB].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error('Шрифт не загрузился');return r.arrayBuffer()})));
 const doc=new jspdf.jsPDF({unit:'mm',format:'a4'});doc.addFileToVFS('DV.ttf',b64(f1));doc.addFont('DV.ttf','DV','normal');doc.addFileToVFS('DVB.ttf',b64(f2));doc.addFont('DVB.ttf','DV','bold');doc.setFont('DV','bold');
 doc.setFontSize(16);doc.text('SprutTactical — остатки склада',14,16);doc.setFont('DV','normal');doc.setFontSize(9);doc.setTextColor(90);doc.text('Дата: '+S.txt+'   ·   Выгрузил: '+who,14,22);
 doc.text('CMA=разъёмы; Втулка=1 при 1 разъёме; Заглушка на ГГц; рупор по дБи; стакан по дБи+разъёмам',14,26);doc.setTextColor(0);
 const body=[];let n={ok:0,low:0,zero:0,all:0};for(const s of invRows(d)){body.push([{content:s.title,colSpan:6,styles:{fontStyle:'bold',fillColor:[221,230,207]}}]);
  s.rows.forEach(x=>{n.all++;n[x.status==='OK'?'ok':x.status==='Мало'?'low':'zero']++;body.push([x.sec,x.name,x.qty,x.unit,x.thr,x.status])})}
 doc.autoTable({startY:30,head:[['Тип/раздел','Деталь','Остаток','Ед.','Порог','Статус']],body,styles:{font:'DV',fontSize:8,cellPadding:1.4},headStyles:{font:'DV',fontStyle:'bold',fillColor:[44,53,61]},
  columnStyles:{2:{halign:'right'},4:{halign:'right'}},didParseCell:c=>{if(c.section!=='body'||c.row.raw.length<6)return;const s=c.row.raw[5];if(s!=='OK'){c.cell.styles.fillColor=s==='Нет'?[244,180,170]:[243,217,160];if(c.column.index===5)c.cell.styles.fontStyle='bold'}},
  didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(120);doc.text('SprutTactical CRM · стр. '+doc.getNumberOfPages(),14,290);doc.setTextColor(0)}});
 doc.setFont('DV','bold');doc.setFontSize(10);doc.text(`Итого позиций: ${n.all}   ·   OK: ${n.ok}   ·   Мало: ${n.low}   ·   Нет: ${n.zero}`,14,doc.lastAutoTable.finalY+8);
 return{blob:doc.output('blob'),name:`SprutTactical_sklad_${S.file}.pdf`}}
function orderRows(d){const st=o=>!o.status||o.status==='done'?'Выполнен':o.status==='cancelled'?'Отменён':'В работе';
 return[...(d.orders||[])].sort((a,b)=>(b.id||0)-(a.id||0)).map(o=>({id:o.id,client:o.clientName||o.note||'—',ants:(o.lines||[]).map(l=>l.qty+'× '+(l.label||l.name||l.variant||l.type)).join(', '),
  ts:o.ts?new Date(o.ts).toLocaleString('ru-RU',{timeZone:'Europe/Warsaw'}):'',deadline:o.deadline||'',status:st(o),user:o.user||'',done:o.doneAt||o.cancelledAt||''}))}
async function buildOrdersXlsx(d,who){await loadJs(XL.exceljs);const S=stamp(),wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Заказы',{views:[{state:'frozen',ySplit:3}]});
 ws.columns=[{width:8},{width:22},{width:36},{width:18},{width:12},{width:12},{width:14},{width:18}];
 ws.mergeCells('A1:H1');ws.getCell('A1').value='SprutTactical — история заказов';ws.getCell('A1').font={bold:true,size:16};
 ws.mergeCells('A2:H2');ws.getCell('A2').value='Дата: '+S.txt+' · Выгрузил: '+who;
 const h=ws.getRow(3);h.values=['#','Клиент','Антенны','Создан','Срок','Статус','Кто','Завершён'];h.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:COL.head}}});
 orderRows(d).forEach(x=>ws.addRow([x.id,x.client,x.ants,x.ts,x.deadline,x.status,x.user,x.done?new Date(x.done).toLocaleString('ru-RU',{timeZone:'Europe/Warsaw'}):'']));
 ws.autoFilter={from:'A3',to:'H3'};
 return{blob:new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name:`SprutTactical_zakazy_${S.file}.xlsx`}}
async function buildOrdersPdf(d,who){await loadJs(XL.jspdf);await loadJs(XL.at);const S=stamp();const[f1,f2]=await Promise.all([XL.font,XL.fontB].map(u=>fetch(u).then(r=>r.arrayBuffer())));
 const doc=new jspdf.jsPDF({unit:'mm',format:'a4',orientation:'landscape'});doc.addFileToVFS('DV.ttf',b64(f1));doc.addFont('DV.ttf','DV','normal');doc.addFileToVFS('DVB.ttf',b64(f2));doc.addFont('DVB.ttf','DV','bold');
 doc.setFont('DV','bold');doc.setFontSize(14);doc.text('SprutTactical — история заказов',14,14);doc.setFont('DV','normal');doc.setFontSize(9);doc.setTextColor(90);doc.text('Дата: '+S.txt+' · Выгрузил: '+who,14,20);doc.setTextColor(0);
 const body=orderRows(d).map(x=>[x.id,x.client,x.ants,x.ts,x.deadline,x.status,x.user]);
 doc.autoTable({startY:24,head:[['#','Клиент','Антенны','Создан','Срок','Статус','Кто']],body,styles:{font:'DV',fontSize:8,cellPadding:1.2},headStyles:{font:'DV',fontStyle:'bold',fillColor:[44,53,61]}});
 return{blob:doc.output('blob'),name:`SprutTactical_zakazy_${S.file}.pdf`}}
async function doExport(kind){const b=document.getElementById('exp-'+kind),old=b&&b.textContent;if(b){b.disabled=true;b.textContent='Готовлю…'}
 try{const who=(me().name||me().login||U||'');const r=await (kind==='xlsx'?buildXlsx:buildPdf)(D,who);await deliver(r.blob,r.name)}catch(e){alert('Ошибка экспорта: '+e.message)}finally{if(b){b.disabled=false;b.textContent=old}}}
async function doOrdersExport(kind){const b=document.getElementById('exp-ord-'+kind),old=b&&b.textContent;if(b){b.disabled=true;b.textContent='Готовлю…'}
 try{const who=(me().name||me().login||U||'');const r=await (kind==='xlsx'?buildOrdersXlsx:buildOrdersPdf)(D,who);await deliver(r.blob,r.name)}catch(e){alert('Ошибка экспорта: '+e.message)}finally{if(b){b.disabled=false;b.textContent=old}}}
