// Inventory export: Excel (.xlsx via ExcelJS) and PDF (jsPDF + autotable, DejaVu font for Cyrillic). Libraries load lazily.
const XL={exceljs:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',jspdf:'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
 at:'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',font:'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf',
 fontB:'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf'};
const loadJs=(()=>{const c={};return u=>c[u]||(c[u]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>{delete c[u];no(Error('Не удалось загрузить библиотеку (нет интернета?)'))};document.head.appendChild(s)}))})();
const coll=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
const ghz=t=>{const m=String(t.name||t.id).match(/\d+([.,]\d+)?/);return m?parseFloat(m[0].replace(',','.')):1e9};
function invRows(d){const st=k=>{const v=d.stock[k]||0;return v<=0?'Нет':v<=(d.thr[k]||0)?'Мало':'OK'};
 const sec=(title,parts,pref)=>[...parts].sort((a,b)=>coll.compare(a.name,b.name)).map(p=>{const k=pref+p.id;return{sec:title,name:p.name,qty:d.stock[k]||0,unit:p.unit,thr:d.thr[k]||0,status:st(k)}});
 const types=[...d.types].sort((a,b)=>ghz(a)-ghz(b)||coll.compare(a.name,b.name));
 return[{title:'Общие детали',rows:sec('Общие детали',d.shared,'')},...types.map(t=>({title:'Антенна '+t.name,rows:sec(t.name,t.parts,t.id+'|')}))]}
function stamp(){const now=new Date();return{now,txt:now.toLocaleString('ru-RU',{timeZone:'Europe/Warsaw',dateStyle:'long',timeStyle:'short'})+' (Варшава)',
 file:now.toLocaleString('sv-SE',{timeZone:'Europe/Warsaw'}).slice(0,16).replace(' ','_').replace(':','-')}}
async function deliver(blob,name){const f=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:name});return}catch(e){if(e.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}
const COL={low:'FFF3D9A0',zero:'FFF4B4AA',head:'FF2C353D',sec:'FFDDE6CF'};
async function buildXlsx(d,who){await loadJs(XL.exceljs);const S=stamp(),wb=new ExcelJS.Workbook();wb.creator='SprutTactical CRM';const ws=wb.addWorksheet('Склад',{views:[{state:'frozen',ySplit:4}]});
 ws.columns=[{width:22},{width:34},{width:12},{width:8},{width:10},{width:10}];
 ws.mergeCells('A1:F1');ws.getCell('A1').value='SprutTactical — остатки склада';ws.getCell('A1').font={bold:true,size:16};
 ws.mergeCells('A2:F2');ws.getCell('A2').value='Дата: '+S.txt+' · Выгрузил: '+who;ws.getCell('A2').font={italic:true,color:{argb:'FF555555'}};
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
 doc.setFontSize(16);doc.text('SprutTactical — остатки склада',14,16);doc.setFont('DV','normal');doc.setFontSize(9);doc.setTextColor(90);doc.text('Дата: '+S.txt+'   ·   Выгрузил: '+who,14,22);doc.setTextColor(0);
 const body=[];let n={ok:0,low:0,zero:0,all:0};for(const s of invRows(d)){body.push([{content:s.title,colSpan:6,styles:{fontStyle:'bold',fillColor:[221,230,207]}}]);
  s.rows.forEach(x=>{n.all++;n[x.status==='OK'?'ok':x.status==='Мало'?'low':'zero']++;body.push([x.sec,x.name,x.qty,x.unit,x.thr,x.status])})}
 doc.autoTable({startY:27,head:[['Тип/раздел','Деталь','Остаток','Ед.','Порог','Статус']],body,styles:{font:'DV',fontSize:9,cellPadding:1.6},headStyles:{font:'DV',fontStyle:'bold',fillColor:[44,53,61]},
  columnStyles:{2:{halign:'right'},4:{halign:'right'}},didParseCell:c=>{if(c.section!=='body'||c.row.raw.length<6)return;const s=c.row.raw[5];if(s!=='OK'){c.cell.styles.fillColor=s==='Нет'?[244,180,170]:[243,217,160];if(c.column.index===5)c.cell.styles.fontStyle='bold'}},
  didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(120);doc.text('SprutTactical CRM · стр. '+doc.getNumberOfPages(),14,290);doc.setTextColor(0)}});
 doc.setFont('DV','bold');doc.setFontSize(10);doc.text(`Итого позиций: ${n.all}   ·   OK: ${n.ok}   ·   Мало: ${n.low}   ·   Нет: ${n.zero}`,14,doc.lastAutoTable.finalY+8);
 return{blob:doc.output('blob'),name:`SprutTactical_sklad_${S.file}.pdf`}}
async function doExport(kind){const b=document.getElementById('exp-'+kind),old=b&&b.textContent;if(b){b.disabled=true;b.textContent='Готовлю…'}
 try{const who=(me().name||me().login||U||'');const r=await (kind==='xlsx'?buildXlsx:buildPdf)(D,who);await deliver(r.blob,r.name)}catch(e){alert('Ошибка экспорта: '+e.message)}finally{if(b){b.disabled=false;b.textContent=old}}}
