const SUPABASE_URL = 'https://mhjiocmosbbjmunpdidw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LbL9TVw2eMhNCHePQFjNSg_s8KuQ_xe';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const BREAK_LIMIT = 90 * 60;
const LEGACY = { bills: 'pt_bills_v1', budget: 'pt_budget_v1', time: 'pt_time_v1' };
const BUDGET_FIELDS = ['baseIncome','overtimePay','holidayPay','credits','savings','government','lateDeduction','absentDeduction','overbreakDeduction','miscDeduction'];
const DEFAULT_BUDGET = {baseIncome:0,overtimePay:0,holidayPay:0,credits:0,savings:0,government:0,lateDeduction:0,absentDeduction:0,overbreakDeduction:0,miscDeduction:0};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let currentUser = null;
let profile = null;
let bills = [];
let budget = { ...DEFAULT_BUDGET };
let timeData = {};
let authMode = 'login';
let budgetSaveTimer = null;
let toastTimer = null;
let appStartedFor = null;

const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
const fmtDate = key => new Date(key + 'T00:00:00').toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'2-digit'});
const hms = sec => { sec=Math.max(0,Math.floor(sec)); const h=String(Math.floor(sec/3600)).padStart(2,'0'); const m=String(Math.floor(sec%3600/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${h}:${m}:${s}`; };
const todayKey = () => new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
const nowIso = () => new Date().toISOString();

function showToast(message, error=false){
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className='toast', 3200);
}
function setAuthMessage(message, type=''){
  const el = $('#authMessage'); el.textContent = message; el.className = `auth-message ${type}`.trim();
}
function safeJson(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function titleCase(s){ return String(s||'').replace(/\b\w/g,m=>m.toUpperCase()); }
function toNumber(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function currentRedirectUrl(){ return `${location.origin}${location.pathname}`; }

function setAuthMode(mode){
  authMode = mode;
  $$('.auth-mode').forEach(b=>b.classList.toggle('active', b.dataset.authMode===mode));
  $('#nameField').classList.toggle('hidden', mode!=='register');
  $('#authSubmit').textContent = mode==='register' ? 'Create account' : 'Log in';
  $('#forgotPassword').classList.toggle('hidden', mode==='register');
  $('#authPassword').autocomplete = mode==='register' ? 'new-password' : 'current-password';
  setAuthMessage('');
}
$$('.auth-mode').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authMode)));

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const displayName = $('#authName').value.trim();
  const submit = $('#authSubmit');
  submit.disabled = true;
  setAuthMessage(authMode==='register' ? 'Creating your account…' : 'Signing in…');
  try{
    if(authMode==='register'){
      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { display_name: displayName || email.split('@')[0] }, emailRedirectTo: currentRedirectUrl() }
      });
      if(error) throw error;
      if(data.session){ setAuthMessage('Account created. Loading…','success'); }
      else setAuthMessage('Account created. Check your email to confirm your address, then log in.','success');
    }else{
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if(error) throw error;
    }
  }catch(err){ setAuthMessage(err.message || 'Authentication failed.','error'); }
  finally{ submit.disabled = false; }
});

$('#forgotPassword').addEventListener('click', async () => {
  const email = $('#authEmail').value.trim();
  if(!email){ setAuthMessage('Enter your email first.','error'); return; }
  setAuthMessage('Sending password reset email…');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:currentRedirectUrl()});
  if(error) setAuthMessage(error.message,'error');
  else setAuthMessage('Password reset email sent.','success');
});

$('#resetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('#newPassword').value;
  const { error } = await supabaseClient.auth.updateUser({ password });
  if(error){ $('#resetMessage').textContent=error.message; $('#resetMessage').className='auth-message error'; return; }
  $('#resetMessage').textContent='Password updated. Loading your dashboard…'; $('#resetMessage').className='auth-message success';
  setTimeout(()=>{ $('#resetScreen').classList.add('hidden'); $('#app').classList.remove('hidden'); },800);
});

$('#logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); });

async function startApp(user){
  if(appStartedFor===user.id && currentUser) return;
  currentUser = user; appStartedFor = user.id;
  setAuthMessage('');
  try{
    const { data: p, error: pErr } = await supabaseClient.from('profiles').select('*').eq('id',user.id).single();
    if(pErr) throw new Error(`Database setup is not finished. Run supabase-schema.sql in Supabase SQL Editor first. (${pErr.message})`);
    profile = p;
    if(!profile.is_active){
      await supabaseClient.auth.signOut();
      setAuthMessage('This account has been disabled by an administrator.','error');
      return;
    }
    $('#userName').textContent = profile.display_name || user.email?.split('@')[0] || 'User';
    $('#userRole').textContent = profile.role.toUpperCase();
    $('#adminTab').classList.toggle('hidden', profile.role!=='admin');
    await loadUserData();
    $('#authScreen').classList.add('hidden');
    $('#resetScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    checkLegacyData();
  }catch(err){
    console.error(err);
    $('#app').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    setAuthMessage(err.message || 'Could not load Personal Tracker.','error');
  }
}

function showSignedOut(){
  currentUser=null; profile=null; appStartedFor=null; bills=[]; budget={...DEFAULT_BUDGET}; timeData={};
  $('#app').classList.add('hidden');
  $('#resetScreen').classList.add('hidden');
  $('#authScreen').classList.remove('hidden');
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if(event==='PASSWORD_RECOVERY'){
    $('#authScreen').classList.add('hidden'); $('#app').classList.add('hidden'); $('#resetScreen').classList.remove('hidden'); return;
  }
  setTimeout(()=>{
    if(session?.user) startApp(session.user);
    else showSignedOut();
  },0);
});

async function init(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session?.user) await startApp(session.user); else showSignedOut();
}

async function loadUserData(){
  const [budgetRes,billsRes,timeRes] = await Promise.all([
    supabaseClient.from('budgets').select('*').eq('user_id',currentUser.id).maybeSingle(),
    supabaseClient.from('bills').select('*').eq('user_id',currentUser.id).order('due_date',{ascending:true}),
    supabaseClient.from('time_entries').select('*').eq('user_id',currentUser.id).order('work_date',{ascending:false})
  ]);
  const err = budgetRes.error || billsRes.error || timeRes.error;
  if(err) throw err;
  budget = budgetRes.data ? budgetFromDb(budgetRes.data) : { ...DEFAULT_BUDGET };
  bills = (billsRes.data||[]).map(billFromDb);
  timeData = {};
  (timeRes.data||[]).forEach(r=> timeData[r.work_date]=timeFromDb(r));
  bindBudgetValues();
  renderAll();
}

function budgetFromDb(r){ return {baseIncome:toNumber(r.base_income),overtimePay:toNumber(r.overtime_pay),holidayPay:toNumber(r.holiday_pay),credits:toNumber(r.credits),savings:toNumber(r.savings),government:toNumber(r.government),lateDeduction:toNumber(r.late_deduction),absentDeduction:toNumber(r.absent_deduction),overbreakDeduction:toNumber(r.overbreak_deduction),miscDeduction:toNumber(r.misc_deduction)}; }
function budgetToDb(){ return {user_id:currentUser.id,base_income:budget.baseIncome,overtime_pay:budget.overtimePay,holiday_pay:budget.holidayPay,credits:budget.credits,savings:budget.savings,government:budget.government,late_deduction:budget.lateDeduction,absent_deduction:budget.absentDeduction,overbreak_deduction:budget.overbreakDeduction,misc_deduction:budget.miscDeduction,updated_at:nowIso()}; }
function billFromDb(r){ return {id:r.id,name:r.name,amount:toNumber(r.amount),due:r.due_date,type:r.bill_type,paid:r.paid,created:r.created_at}; }
function timeFromDb(r){ return {id:r.id,timeIn:r.time_in,timeOut:r.time_out,breaks:Array.isArray(r.breaks)?r.breaks:[],details:r.details||''}; }

$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.id==='adminTab' && profile?.role!=='admin') return;
  $$('.tab').forEach(b=>b.classList.remove('active')); $$('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active'); $('#'+btn.dataset.tab).classList.add('active');
  if(btn.dataset.tab==='admin') loadAdminData();
}));

function calcBudget(){
  const earn=toNumber(budget.baseIncome)+toNumber(budget.overtimePay)+toNumber(budget.holidayPay)+toNumber(budget.credits);
  const deductions=toNumber(budget.government)+toNumber(budget.lateDeduction)+toNumber(budget.absentDeduction)+toNumber(budget.overbreakDeduction)+toNumber(budget.miscDeduction);
  const net=earn-deductions-toNumber(budget.savings);
  $('#totalEarnings').textContent=money.format(earn); $('#totalDeductions').textContent=money.format(deductions); $('#savingsTotal').textContent=money.format(toNumber(budget.savings)); $('#netBudget').textContent=money.format(net); $('#billBudget').textContent=money.format(net);
  return net;
}
function bindBudgetValues(){ BUDGET_FIELDS.forEach(id=>{ $('#'+id).value = budget[id] || ''; }); }
BUDGET_FIELDS.forEach(id=>{
  $('#'+id).addEventListener('input',()=>{
    budget[id]=Number($('#'+id).value)||0; calcBudget(); renderBillsSummary();
    $('#budgetSaveState').textContent='Saving…'; $('#budgetSaveState').classList.add('saving');
    clearTimeout(budgetSaveTimer); budgetSaveTimer=setTimeout(saveBudget,550);
  });
});
async function saveBudget(){
  if(!currentUser) return;
  const { error } = await supabaseClient.from('budgets').upsert(budgetToDb(),{onConflict:'user_id'});
  if(error){ showToast(`Budget save failed: ${error.message}`,true); $('#budgetSaveState').textContent='Save failed'; }
  else $('#budgetSaveState').textContent='Synced';
  $('#budgetSaveState').classList.remove('saving');
}

$('#addBillBtn').onclick=()=>{ $('#billForm').reset(); $('#billDue').value=todayKey(); $('#billDialog').showModal(); };
$('#billForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={user_id:currentUser.id,name:$('#billName').value.trim(),amount:Number($('#billAmount').value),due_date:$('#billDue').value,bill_type:$('#billType').value,paid:false};
  const { data,error }=await supabaseClient.from('bills').insert(payload).select().single();
  if(error){showToast(error.message,true);return;} bills.push(billFromDb(data)); $('#billDialog').close(); renderBills(); showToast('Bill added.');
});
function scoreBill(b){ if(b.paid)return -9999; const now=new Date(todayKey()+'T00:00:00'); const due=new Date(b.due+'T00:00:00'); const days=Math.ceil((due-now)/86400000); let score=0; if(days<0)score+=100+Math.min(30,Math.abs(days)*4);else score+=Math.max(0,60-days*3); if(b.type==='essential')score+=45; if(b.type==='debt')score+=30; if(b.type==='regular')score+=15; if(b.type==='optional')score-=15; score+=Math.min(20,b.amount/1000); return score; }
function reasonFor(b){ const days=Math.ceil((new Date(b.due+'T00:00:00')-new Date(todayKey()+'T00:00:00'))/86400000); const parts=[]; if(days<0)parts.push(`${Math.abs(days)} day${Math.abs(days)!==1?'s':''} overdue`);else if(days===0)parts.push('due today');else if(days<=3)parts.push(`due in ${days} day${days!==1?'s':''}`); if(b.type==='essential')parts.push('essential');if(b.type==='debt')parts.push('debt/credit'); return parts.join(' • ')||'upcoming bill'; }
function renderBills(){
  const tbody=$('#billTableBody'); tbody.innerHTML='';
  [...bills].sort((a,b)=>new Date(a.due)-new Date(b.due)).forEach(b=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><strong>${escapeHtml(b.name)}</strong></td><td>${money.format(b.amount)}</td><td>${fmtDate(b.due)}</td><td>${titleCase(b.type)}</td><td><span class="status ${b.paid?'paid':'unpaid'}">${b.paid?'Paid':'Unpaid'}</span></td><td><div class="row-actions"><button class="mini" data-pay="${b.id}">${b.paid?'Undo':'Mark paid'}</button><button class="mini" data-del="${b.id}">Delete</button></div></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-pay]').forEach(x=>x.onclick=async()=>{
    const b=bills.find(v=>v.id===x.dataset.pay); const next=!b.paid;
    const {error}=await supabaseClient.from('bills').update({paid:next}).eq('id',b.id).eq('user_id',currentUser.id);
    if(error){showToast(error.message,true);return;} b.paid=next; renderBills();
  });
  tbody.querySelectorAll('[data-del]').forEach(x=>x.onclick=async()=>{
    if(!confirm('Delete this bill?'))return;
    const {error}=await supabaseClient.from('bills').delete().eq('id',x.dataset.del).eq('user_id',currentUser.id);
    if(error){showToast(error.message,true);return;} bills=bills.filter(v=>v.id!==x.dataset.del); renderBills();
  });
  $('#billEmpty').style.display=bills.length?'none':'block'; $('#billMonthLabel').textContent=new Date().toLocaleDateString('en-PH',{month:'long',year:'numeric'}); renderBillsSummary(); renderPriority();
}
function renderBillsSummary(){ const total=bills.reduce((s,b)=>s+b.amount,0); const unpaid=bills.filter(b=>!b.paid); const unpaidTotal=unpaid.reduce((s,b)=>s+b.amount,0); const net=calcBudget(); $('#totalBills').textContent=money.format(total); $('#unpaidCount').textContent=unpaid.length; const rem=net-unpaidTotal; $('#remainingAfterBills').textContent=money.format(rem); $('#remainingAfterBills').className=rem<0?'negative':'positive'; }
function renderPriority(){ const list=$('#priorityList'); const picks=[...bills].filter(b=>!b.paid).sort((a,b)=>scoreBill(b)-scoreBill(a)); if(!picks.length){list.innerHTML='<div class="empty-state">No unpaid bills to prioritize.</div>';return;} list.innerHTML=picks.slice(0,5).map((b,i)=>`<div class="priority-item"><div class="priority-rank">${i+1}</div><div><strong>${escapeHtml(b.name)}</strong><small>${reasonFor(b)}</small></div><strong>${money.format(b.amount)}</strong></div>`).join(''); }
$('#refreshPriority').onclick=renderPriority;

function getToday(){ const k=todayKey(); if(!timeData[k])timeData[k]={id:null,timeIn:null,timeOut:null,breaks:[],details:''}; return timeData[k]; }
function activeBreak(day){ return (day.breaks||[]).find(b=>b.start&&!b.end); }
function breakSeconds(day,includeLive=true){ return (day.breaks||[]).reduce((s,b)=>{ if(!b?.start)return s; const end=b.end?new Date(b.end):includeLive?new Date():new Date(b.start); return s+Math.max(0,(end-new Date(b.start))/1000); },0); }
// Full elapsed shift time. Breaks intentionally DO NOT pause this timer.
function elapsedWorkSeconds(day){ if(!day.timeIn)return 0; const end=day.timeOut?new Date(day.timeOut):new Date(); return Math.max(0,(end-new Date(day.timeIn))/1000); }
// Net work duration used in the history table.
function netWorkSeconds(day){ return Math.max(0,elapsedWorkSeconds(day)-breakSeconds(day,!day.timeOut)); }
async function saveTimeDay(date,day){
  const payload={user_id:currentUser.id,work_date:date,time_in:day.timeIn,time_out:day.timeOut,breaks:day.breaks||[],details:day.details||'',updated_at:nowIso()};
  const {data,error}=await supabaseClient.from('time_entries').upsert(payload,{onConflict:'user_id,work_date'}).select().single();
  if(error)throw error; day.id=data.id; return data;
}
$('#timeInBtn').onclick=async()=>{ const date=todayKey(),d=getToday(); if(d.timeIn)return; d.timeIn=nowIso(); try{await saveTimeDay(date,d);renderTime();showToast('Time In saved.');}catch(e){d.timeIn=null;showToast(e.message,true);} };
$('#breakBtn').onclick=async()=>{ const date=todayKey(),d=getToday(); if(!d.timeIn||d.timeOut)return; const a=activeBreak(d); if(a)a.end=nowIso();else d.breaks.push({start:nowIso(),end:null}); try{await saveTimeDay(date,d);renderTime();}catch(e){showToast(e.message,true);await reloadTime();} };
$('#timeOutBtn').onclick=async()=>{ const date=todayKey(),d=getToday(); if(!d.timeIn||d.timeOut)return; const a=activeBreak(d);if(a)a.end=nowIso();d.timeOut=nowIso(); try{await saveTimeDay(date,d);renderTime();showToast('Time Out saved.');}catch(e){showToast(e.message,true);await reloadTime();} };
async function reloadTime(){ const {data,error}=await supabaseClient.from('time_entries').select('*').eq('user_id',currentUser.id).order('work_date',{ascending:false}); if(error)return; timeData={};(data||[]).forEach(r=>timeData[r.work_date]=timeFromDb(r));renderTime(); }
function renderTime(){
  const d=getToday(),a=activeBreak(d); $('#timeInBtn').disabled=!!d.timeIn; $('#timeOutBtn').disabled=!d.timeIn||!!d.timeOut; $('#breakBtn').disabled=!d.timeIn||!!d.timeOut; $('#breakBtn').textContent=a?'End Break / Away':'Start Break / Away'; $('#stampStatus').textContent=d.timeOut?'Completed for today.':a?'Break / Away is currently running. Running work time continues.':d.timeIn?'Currently clocked in.':'Ready for today\'s time stamp.';
  const tbody=$('#timeTableBody');tbody.innerHTML=''; const keys=Object.keys(timeData).sort().reverse();
  keys.forEach(k=>{ const x=timeData[k]; const breakText=x.breaks?.length?x.breaks.map(b=>`${fmtTime(b.start)} – ${fmtTime(b.end)}`).join('<br>'):'—'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${fmtDate(k)}</td><td>${fmtTime(x.timeIn)}</td><td>${breakText}</td><td>${fmtTime(x.timeOut)}</td><td>${x.timeIn?hms(netWorkSeconds(x)):'—'}</td><td class="details-cell"><span class="details-preview" title="${escapeHtml(x.details||'')}">${escapeHtml(x.details||'—')}</span><button class="mini" data-details="${k}">${x.details?'Edit':'Add'}</button></td>`; tbody.appendChild(tr); });
  tbody.querySelectorAll('[data-details]').forEach(btn=>btn.onclick=()=>openDetails(btn.dataset.details));
  $('#timeEmpty').style.display=keys.length?'none':'block'; updateTimers();
}
function openDetails(date){ $('#detailsDate').value=date; $('#detailsText').value=timeData[date]?.details||''; $('#detailsDialog').showModal(); }
$('#detailsForm').addEventListener('submit',async e=>{ e.preventDefault(); const date=$('#detailsDate').value,d=timeData[date];d.details=$('#detailsText').value.trim();try{await saveTimeDay(date,d);$('#detailsDialog').close();renderTime();showToast('Details saved.');}catch(err){showToast(err.message,true);} });
function updateTimers(){ const d=getToday(); $('#workTimer').textContent=hms(elapsedWorkSeconds(d)); const bs=breakSeconds(d); $('#breakTimer').textContent=`${hms(bs)} / 01:30:00`; $('#breakProgress').style.width=Math.min(100,(bs/BREAK_LIMIT)*100)+'%'; $('#breakProgress').style.background=bs>BREAK_LIMIT?'var(--red)':'linear-gradient(90deg,var(--cyan),var(--blue))'; }
function tick(){ const now=new Date(); $('#liveClock').textContent=now.toLocaleTimeString('en-PH',{hour12:false}); $('#liveDate').textContent=now.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); $('#todayLabel').textContent=now.toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}); if(currentUser)updateTimers(); }

function csvEscape(v){ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function downloadFile(name,content,type){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500); }
$('#exportTimeCsv').onclick=()=>{ const rows=[['date','time_in','time_out','breaks','details']]; Object.keys(timeData).sort().forEach(k=>{const d=timeData[k];rows.push([k,d.timeIn||'',d.timeOut||'',JSON.stringify(d.breaks||[]),d.details||'']);}); downloadFile(`personal-tracker-time-${todayKey()}.csv`,rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8'); };
$('#exportTimeJson').onclick=()=>{ const entries=Object.keys(timeData).sort().map(k=>({work_date:k,time_in:timeData[k].timeIn,time_out:timeData[k].timeOut,breaks:timeData[k].breaks||[],details:timeData[k].details||''})); downloadFile(`personal-tracker-time-${todayKey()}.json`,JSON.stringify({version:2,exported_at:nowIso(),time_entries:entries},null,2),'application/json'); };
$('#importTimeFile').onclick=()=>$('#timeImportInput').click();
$('#timeImportInput').addEventListener('change',async e=>{ const file=e.target.files?.[0]; if(!file)return; try{ const text=await file.text(); const entries=file.name.toLowerCase().endsWith('.json')?parseJsonImport(text):parseCsvImport(text); if(!entries.length)throw new Error('No valid time rows were found.'); const payload=entries.map(x=>({user_id:currentUser.id,work_date:x.work_date,time_in:x.time_in||null,time_out:x.time_out||null,breaks:x.breaks||[],details:x.details||'',updated_at:nowIso()})); const {error}=await supabaseClient.from('time_entries').upsert(payload,{onConflict:'user_id,work_date'}); if(error)throw error; await reloadTime();showToast(`Imported ${entries.length} time record${entries.length!==1?'s':''}.`); }catch(err){showToast(`Import failed: ${err.message}`,true);} finally{e.target.value='';} });
function parseJsonImport(text){ const data=JSON.parse(text); if(Array.isArray(data?.time_entries))return data.time_entries.map(normalizeImportRow).filter(Boolean); if(data && typeof data==='object'){ return Object.entries(data).map(([date,d])=>normalizeImportRow({work_date:date,time_in:d.timeIn,time_out:d.timeOut,breaks:d.breaks,details:d.details})).filter(Boolean); } return []; }
function splitCsvLine(line){ const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out; }
function parseCsvImport(text){ const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return[];const headers=splitCsvLine(lines[0]).map(h=>h.trim().toLowerCase());return lines.slice(1).map(line=>{const vals=splitCsvLine(line);const r={};headers.forEach((h,i)=>r[h]=vals[i]??'');if(r.breaks){try{r.breaks=JSON.parse(r.breaks);}catch{r.breaks=[];}}return normalizeImportRow(r);}).filter(Boolean); }
function normalizeImportRow(r){ const date=r.work_date||r.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;return{work_date:date,time_in:r.time_in||r.timeIn||null,time_out:r.time_out||r.timeOut||null,breaks:Array.isArray(r.breaks)?r.breaks:[],details:r.details||''}; }

function hasLegacyData(){ const oldBills=safeJson(LEGACY.bills,[]),oldBudget=safeJson(LEGACY.budget,null),oldTime=safeJson(LEGACY.time,{}); return oldBills.length>0 || (oldBudget&&Object.values(oldBudget).some(v=>toNumber(v)!==0)) || Object.keys(oldTime||{}).length>0; }
function checkLegacyData(){ const done=localStorage.getItem(`pt_legacy_migrated_${currentUser.id}`); const dismissed=localStorage.getItem(`pt_legacy_dismissed_${currentUser.id}`); $('#migrationBanner').classList.toggle('hidden',!!done||!!dismissed||!hasLegacyData()); }
$('#dismissMigrationBtn').onclick=()=>{ localStorage.setItem(`pt_legacy_dismissed_${currentUser.id}`,'1'); $('#migrationBanner').classList.add('hidden'); };
$('#migrateLegacyBtn').onclick=async()=>{
  const btn=$('#migrateLegacyBtn');btn.disabled=true;btn.textContent='Importing…';
  try{
    const oldBudget=safeJson(LEGACY.budget,null);if(oldBudget){budget={...DEFAULT_BUDGET,...oldBudget};await saveBudget();}
    const oldBills=safeJson(LEGACY.bills,[]);if(oldBills.length){const rows=oldBills.map(b=>({id:b.id||crypto.randomUUID(),user_id:currentUser.id,name:b.name||'Imported Bill',amount:toNumber(b.amount),due_date:b.due||todayKey(),bill_type:['essential','regular','debt','optional'].includes(b.type)?b.type:'regular',paid:!!b.paid,created_at:b.created||nowIso()}));const {error}=await supabaseClient.from('bills').upsert(rows,{onConflict:'id'});if(error)throw error;}
    const oldTime=safeJson(LEGACY.time,{});const rows=Object.entries(oldTime).map(([date,d])=>({user_id:currentUser.id,work_date:date,time_in:d.timeIn||null,time_out:d.timeOut||null,breaks:Array.isArray(d.breaks)?d.breaks:[],details:d.details||'',updated_at:nowIso()}));if(rows.length){const {error}=await supabaseClient.from('time_entries').upsert(rows,{onConflict:'user_id,work_date'});if(error)throw error;}
    localStorage.setItem(`pt_legacy_migrated_${currentUser.id}`,'1');$('#migrationBanner').classList.add('hidden');await loadUserData();showToast('Old browser data imported to your account.');
  }catch(err){showToast(`Migration failed: ${err.message}`,true);}finally{btn.disabled=false;btn.textContent='Import old data';}
};

async function loadAdminData(){
  if(profile?.role!=='admin')return;
  $('#adminUserBody').innerHTML='<tr><td colspan="5">Loading users…</td></tr>';
  const [profilesRes,billCount,timeCount]=await Promise.all([
    supabaseClient.from('profiles').select('*').order('created_at',{ascending:false}),
    supabaseClient.from('bills').select('id',{count:'exact',head:true}),
    supabaseClient.from('time_entries').select('id',{count:'exact',head:true})
  ]);
  if(profilesRes.error){showToast(profilesRes.error.message,true);return;}
  const users=profilesRes.data||[];$('#adminUsers').textContent=users.length;$('#adminActive').textContent=users.filter(x=>x.is_active).length;$('#adminAdmins').textContent=users.filter(x=>x.role==='admin').length;$('#adminRecords').textContent=(billCount.count||0)+(timeCount.count||0);
  const tbody=$('#adminUserBody');tbody.innerHTML='';users.forEach(u=>{
    const self=u.id===currentUser.id;const tr=document.createElement('tr');
    tr.innerHTML=`<td><strong>${escapeHtml(u.display_name||'User')}</strong><br><small>${escapeHtml(u.email||'')}</small></td><td><select class="role-select" data-role="${u.id}" ${self?'disabled':''}><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td><td><span class="status ${u.is_active?'active':'inactive'}">${u.is_active?'Active':'Disabled'}</span></td><td>${new Date(u.created_at).toLocaleDateString('en-PH')}</td><td><button class="mini" data-toggle-user="${u.id}" ${self?'disabled title="You cannot disable your current admin session"':''}>${u.is_active?'Disable':'Enable'}</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-role]').forEach(sel=>sel.onchange=async()=>{const {error}=await supabaseClient.from('profiles').update({role:sel.value,updated_at:nowIso()}).eq('id',sel.dataset.role);if(error)showToast(error.message,true);else{showToast('Role updated.');loadAdminData();}});
  tbody.querySelectorAll('[data-toggle-user]').forEach(btn=>btn.onclick=async()=>{const u=users.find(x=>x.id===btn.dataset.toggleUser);const {error}=await supabaseClient.from('profiles').update({is_active:!u.is_active,updated_at:nowIso()}).eq('id',u.id);if(error)showToast(error.message,true);else{showToast(`Account ${u.is_active?'disabled':'enabled'}.`);loadAdminData();}});
}
$('#refreshAdmin').onclick=loadAdminData;

function renderAll(){ calcBudget(); renderBills(); renderTime(); }
init(); tick(); setInterval(tick,1000);
