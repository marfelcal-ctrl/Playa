const money = new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'});
const STORAGE={bills:'pt_bills_v1',budget:'pt_budget_v1',time:'pt_time_v1'};
const BREAK_LIMIT=90*60;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const fmtTime=iso=>iso?new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
const fmtDate=key=>new Date(key+'T00:00:00').toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'2-digit'});
const hms=sec=>{sec=Math.max(0,Math.floor(sec));const h=String(Math.floor(sec/3600)).padStart(2,'0');const m=String(Math.floor(sec%3600/60)).padStart(2,'0');const s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`};
const todayKey=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});

let bills=load(STORAGE.bills,[]);
let budget=load(STORAGE.budget,{baseIncome:0,overtimePay:0,holidayPay:0,credits:0,savings:0,government:0,lateDeduction:0,absentDeduction:0,overbreakDeduction:0,miscDeduction:0});
let timeData=load(STORAGE.time,{});

$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{$$('.tab').forEach(b=>b.classList.remove('active'));$$('.panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('#'+btn.dataset.tab).classList.add('active')}));

function calcBudget(){
 const earn=+budget.baseIncome + +budget.overtimePay + +budget.holidayPay + +budget.credits;
 const deductions=+budget.government + +budget.lateDeduction + +budget.absentDeduction + +budget.overbreakDeduction + +budget.miscDeduction;
 const net=earn-deductions-(+budget.savings||0);
 $('#totalEarnings').textContent=money.format(earn); $('#totalDeductions').textContent=money.format(deductions); $('#savingsTotal').textContent=money.format(+budget.savings||0); $('#netBudget').textContent=money.format(net);
 $('#billBudget').textContent=money.format(net); return net;
}
['baseIncome','overtimePay','holidayPay','credits','savings','government','lateDeduction','absentDeduction','overbreakDeduction','miscDeduction'].forEach(id=>{
 const el=$('#'+id); el.value=budget[id]||''; el.addEventListener('input',()=>{budget[id]=Number(el.value)||0;save(STORAGE.budget,budget);renderAll()});
});

$('#addBillBtn').onclick=()=>{$('#billForm').reset();$('#billDue').value=todayKey();$('#billDialog').showModal()};
$('#billForm').addEventListener('submit',e=>{e.preventDefault();bills.push({id:crypto.randomUUID(),name:$('#billName').value.trim(),amount:Number($('#billAmount').value),due:$('#billDue').value,type:$('#billType').value,paid:false,created:new Date().toISOString()});save(STORAGE.bills,bills);$('#billDialog').close();renderBills()});

function scoreBill(b){if(b.paid)return -9999;const now=new Date(todayKey()+'T00:00:00');const due=new Date(b.due+'T00:00:00');const days=Math.ceil((due-now)/86400000);let score=0;if(days<0)score+=100+Math.min(30,Math.abs(days)*4);else score+=Math.max(0,60-days*3);if(b.type==='essential')score+=45;if(b.type==='debt')score+=30;if(b.type==='regular')score+=15;if(b.type==='optional')score-=15;score+=Math.min(20,b.amount/1000);return score}
function reasonFor(b){const days=Math.ceil((new Date(b.due+'T00:00:00')-new Date(todayKey()+'T00:00:00'))/86400000);let parts=[];if(days<0)parts.push(`${Math.abs(days)} day${Math.abs(days)!==1?'s':''} overdue`);else if(days===0)parts.push('due today');else if(days<=3)parts.push(`due in ${days} day${days!==1?'s':''}`);if(b.type==='essential')parts.push('essential');if(b.type==='debt')parts.push('debt/credit');return parts.join(' • ')||'upcoming bill'}
function renderBills(){const tbody=$('#billTableBody');tbody.innerHTML='';const sorted=[...bills].sort((a,b)=>new Date(a.due)-new Date(b.due));sorted.forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${escapeHtml(b.name)}</strong></td><td>${money.format(b.amount)}</td><td>${fmtDate(b.due)}</td><td>${titleCase(b.type)}</td><td><span class="status ${b.paid?'paid':'unpaid'}">${b.paid?'Paid':'Unpaid'}</span></td><td><div class="row-actions"><button class="mini" data-pay="${b.id}">${b.paid?'Undo':'Mark paid'}</button><button class="mini" data-del="${b.id}">Delete</button></div></td>`;tbody.appendChild(tr)});
 tbody.querySelectorAll('[data-pay]').forEach(x=>x.onclick=()=>{const b=bills.find(v=>v.id===x.dataset.pay);b.paid=!b.paid;save(STORAGE.bills,bills);renderBills()});tbody.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{bills=bills.filter(v=>v.id!==x.dataset.del);save(STORAGE.bills,bills);renderBills()});
 $('#billEmpty').style.display=bills.length?'none':'block';const total=bills.reduce((s,b)=>s+b.amount,0);const unpaid=bills.filter(b=>!b.paid);const unpaidTotal=unpaid.reduce((s,b)=>s+b.amount,0);const net=calcBudget();$('#totalBills').textContent=money.format(total);$('#unpaidCount').textContent=unpaid.length;const rem=net-unpaidTotal;$('#remainingAfterBills').textContent=money.format(rem);$('#remainingAfterBills').className=rem<0?'negative':'positive';$('#billMonthLabel').textContent=new Date().toLocaleDateString('en-PH',{month:'long',year:'numeric'});renderPriority();}
function renderPriority(){const list=$('#priorityList');const picks=[...bills].filter(b=>!b.paid).sort((a,b)=>scoreBill(b)-scoreBill(a));if(!picks.length){list.innerHTML='<div class="empty-state">No unpaid bills to prioritize.</div>';return}list.innerHTML=picks.slice(0,5).map((b,i)=>`<div class="priority-item"><div class="priority-rank">${i+1}</div><div><strong>${escapeHtml(b.name)}</strong><small>${reasonFor(b)}</small></div><strong>${money.format(b.amount)}</strong></div>`).join('')}
$('#refreshPriority').onclick=renderPriority;

function getToday(){const k=todayKey();if(!timeData[k])timeData[k]={timeIn:null,timeOut:null,breaks:[],details:''};if(timeData[k].details===undefined)timeData[k].details='';return timeData[k]}
function activeBreak(day){return (day.breaks||[]).find(b=>b.start&&!b.end)}
function breakSeconds(day,includeLive=true){return (day.breaks||[]).reduce((s,b)=>{const end=b.end?new Date(b.end):includeLive?new Date():new Date(b.start);return s+Math.max(0,(end-new Date(b.start))/1000)},0)}
function elapsedSeconds(day){if(!day.timeIn)return 0;const end=day.timeOut?new Date(day.timeOut):new Date();return Math.max(0,(end-new Date(day.timeIn))/1000)}
function workSeconds(day){if(!day.timeIn)return 0;return Math.max(0,elapsedSeconds(day)-breakSeconds(day,!day.timeOut))}
$('#timeInBtn').onclick=()=>{const d=getToday();if(!d.timeIn){d.timeIn=new Date().toISOString();save(STORAGE.time,timeData);renderTime()}};
$('#breakBtn').onclick=()=>{const d=getToday();if(!d.timeIn||d.timeOut)return;const a=activeBreak(d);if(a)a.end=new Date().toISOString();else d.breaks.push({start:new Date().toISOString(),end:null});save(STORAGE.time,timeData);renderTime()};
$('#timeOutBtn').onclick=()=>{const d=getToday();if(!d.timeIn||d.timeOut)return;const a=activeBreak(d);if(a)a.end=new Date().toISOString();d.timeOut=new Date().toISOString();save(STORAGE.time,timeData);renderTime()};
$('#clearTimeHistory').onclick=()=>{if(confirm('Clear all time stamp history? This cannot be undone unless you exported a backup first.')){timeData={};save(STORAGE.time,timeData);renderTime()}};

function renderTime(){
 const d=getToday(),a=activeBreak(d);
 $('#timeInBtn').disabled=!!d.timeIn;$('#timeOutBtn').disabled=!d.timeIn||!!d.timeOut;$('#breakBtn').disabled=!d.timeIn||!!d.timeOut;
 $('#breakBtn').textContent=a?'End Break / Away':'Start Break / Away';
 $('#stampStatus').textContent=d.timeOut?'Completed for today.':a?'Break / Away is currently running.':d.timeIn?'Currently clocked in.':'Ready for today\'s time stamp.';
 const tbody=$('#timeTableBody');tbody.innerHTML='';
 const keys=Object.keys(timeData).filter(k=>{const x=timeData[k]||{};return x.timeIn||x.timeOut||(x.breaks&&x.breaks.length)||x.details}).sort().reverse();
 keys.forEach(k=>{
   const x=timeData[k]; if(!Array.isArray(x.breaks))x.breaks=[]; if(x.details===undefined)x.details='';
   const breakText=x.breaks.length?x.breaks.map(b=>`${fmtTime(b.start)} – ${fmtTime(b.end)}`).join('<br>'):'—';
   const detailText=x.details?escapeHtml(x.details):'—';
   const tr=document.createElement('tr');
   tr.innerHTML=`<td>${fmtDate(k)}</td><td>${fmtTime(x.timeIn)}</td><td>${breakText}</td><td>${fmtTime(x.timeOut)}</td><td>${x.timeIn?hms(workSeconds(x)):'—'}</td><td><div class="details-cell"><span>${detailText}</span><button class="mini" data-detail="${k}">${x.details?'Edit':'Add'}</button></div></td>`;
   tbody.appendChild(tr)
 });
 tbody.querySelectorAll('[data-detail]').forEach(btn=>btn.onclick=()=>{
   const key=btn.dataset.detail; const current=timeData[key]?.details||'';
   const value=prompt(`Details for ${fmtDate(key)}:`,current);
   if(value===null)return;
   if(!timeData[key])timeData[key]={timeIn:null,timeOut:null,breaks:[],details:''};
   timeData[key].details=value.trim();save(STORAGE.time,timeData);renderTime();
 });
 $('#timeEmpty').style.display=keys.length?'none':'block';updateTimers()
}
function updateTimers(){const d=getToday();$('#workTimer').textContent=hms(elapsedSeconds(d));const bs=breakSeconds(d);$('#breakTimer').textContent=`${hms(bs)} / 01:30:00`;const pct=Math.min(100,(bs/BREAK_LIMIT)*100);$('#breakProgress').style.width=pct+'%';$('#breakProgress').style.background=bs>BREAK_LIMIT?'var(--red)':'var(--blue)'}

// ---- Time history export / import -----------------------------------------
function downloadFile(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function csvCell(value){const v=String(value??'');return /[",\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v}
function meaningfulTimeData(){return Object.fromEntries(Object.entries(timeData).filter(([,x])=>x&&(x.timeIn||x.timeOut||(x.breaks&&x.breaks.length)||x.details)))}

$('#exportTimeCsv').onclick=()=>{
 const rows=[['date','time_in','time_out','breaks','work_duration','details']];
 Object.keys(meaningfulTimeData()).sort().forEach(date=>{const x=timeData[date];rows.push([date,x.timeIn||'',x.timeOut||'',JSON.stringify(x.breaks||[]),x.timeIn?hms(workSeconds(x)):'',x.details||''])});
 const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
 downloadFile(`personal-tracker-time-${todayKey()}.csv`,csv,'text/csv;charset=utf-8')
};
$('#exportTimeJson').onclick=()=>{
 const backup={app:'Personal Tracker',version:2,exportedAt:new Date().toISOString(),timezone:'Asia/Manila',timeData:meaningfulTimeData()};
 downloadFile(`personal-tracker-time-backup-${todayKey()}.json`,JSON.stringify(backup,null,2),'application/json')
};
$('#importTimeFile').onclick=()=>$('#timeImportInput').click();

function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch}
   else if(ch==='"')quoted=true;
   else if(ch===','){row.push(cell);cell=''}
   else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
   else cell+=ch;
 }
 if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 return rows.filter(r=>r.some(v=>String(v).trim()!==''))
}
function timestampFromInput(value,date){
 const raw=String(value??'').trim();if(!raw)return null;
 const direct=new Date(raw);if(/^\d{4}-\d{2}-\d{2}T/.test(raw)&&!Number.isNaN(direct.getTime()))return direct.toISOString();
 let m=raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
 if(m){let h=Number(m[1]),min=Number(m[2]),sec=Number(m[3]||0),ampm=(m[4]||'').toUpperCase();if(ampm){if(h===12)h=0;if(ampm==='PM')h+=12}if(h<24&&min<60&&sec<60)return new Date(`${date}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}+08:00`).toISOString()}
 if(!Number.isNaN(direct.getTime()))return direct.toISOString();
 throw new Error(`Invalid time "${raw}" for ${date}`)
}
function parseBreaks(value,date){
 const raw=String(value??'').trim();if(!raw)return [];
 try{const arr=JSON.parse(raw);if(Array.isArray(arr))return arr.map(b=>({start:timestampFromInput(b.start,date),end:b.end?timestampFromInput(b.end,date):null})).filter(b=>b.start)}catch{}
 const items=raw.split(/\s*[;|]\s*/).filter(Boolean);const out=[];
 for(const item of items){const m=item.match(/^(.+?)\s+(?:-|–|—|to)\s+(.+)$/i);if(!m)throw new Error(`Invalid break format "${item}" on ${date}`);out.push({start:timestampFromInput(m[1],date),end:timestampFromInput(m[2],date)})}
 return out
}
function normalizeImportedDay(date,day={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error(`Invalid date "${date}". Use YYYY-MM-DD.`);
 return {timeIn:day.timeIn?timestampFromInput(day.timeIn,date):null,timeOut:day.timeOut?timestampFromInput(day.timeOut,date):null,breaks:Array.isArray(day.breaks)?day.breaks.map(b=>({start:timestampFromInput(b.start,date),end:b.end?timestampFromInput(b.end,date):null})).filter(b=>b.start):parseBreaks(day.breaks||'',date),details:String(day.details||'').trim()}
}
function importCsv(text){
 const rows=parseCsv(text.replace(/^\ufeff/,''));if(rows.length<2)throw new Error('The CSV has no data rows.');
 const headers=rows[0].map(h=>h.trim().toLowerCase().replace(/[\s/]+/g,'_'));
 const idx=name=>headers.indexOf(name);const dateI=idx('date');if(dateI<0)throw new Error('CSV must contain a date column.');
 const result={};
 for(const row of rows.slice(1)){const date=(row[dateI]||'').trim();if(!date)continue;const v=(...names)=>{for(const n of names){const i=idx(n);if(i>=0&&row[i]!==undefined)return row[i]}return ''};result[date]=normalizeImportedDay(date,{timeIn:v('time_in','timein'),timeOut:v('time_out','timeout'),breaks:v('breaks','break_away'),details:v('details','notes','note')})}
 return result
}
function importJson(text){const parsed=JSON.parse(text);const source=parsed&&parsed.timeData&&typeof parsed.timeData==='object'?parsed.timeData:parsed;if(!source||Array.isArray(source)||typeof source!=='object')throw new Error('This JSON is not a Personal Tracker time backup.');const result={};for(const [date,day] of Object.entries(source))result[date]=normalizeImportedDay(date,day);return result}
$('#timeImportInput').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
   const text=await file.text();const imported=file.name.toLowerCase().endsWith('.json')?importJson(text):importCsv(text);const count=Object.keys(imported).length;if(!count)throw new Error('No valid time records were found.');
   if(!confirm(`Import ${count} time record${count===1?'':'s'}? Records with the same date will be replaced. Other dates will be kept.`))return;
   timeData={...timeData,...imported};save(STORAGE.time,timeData);renderTime();alert(`${count} time record${count===1?'':'s'} imported successfully.`)
 }catch(err){alert(`Import failed: ${err.message}`)}
});
function tick(){const now=new Date();$('#liveClock').textContent=now.toLocaleTimeString('en-PH',{hour12:false});$('#liveDate').textContent=now.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});$('#todayLabel').textContent=now.toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'});updateTimers()}
function titleCase(s){return s.replace(/\b\w/g,m=>m.toUpperCase())} function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderAll(){calcBudget();renderBills();renderTime()}
renderAll();tick();setInterval(tick,1000);
