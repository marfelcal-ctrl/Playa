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

function getToday(){const k=todayKey();if(!timeData[k])timeData[k]={timeIn:null,timeOut:null,breaks:[]};return timeData[k]}
function activeBreak(day){return day.breaks.find(b=>b.start&&!b.end)}
function breakSeconds(day,includeLive=true){return day.breaks.reduce((s,b)=>{const end=b.end?new Date(b.end):includeLive?new Date():new Date(b.start);return s+Math.max(0,(end-new Date(b.start))/1000)},0)}
function elapsedSeconds(day){if(!day.timeIn)return 0;const end=day.timeOut?new Date(day.timeOut):new Date();return Math.max(0,(end-new Date(day.timeIn))/1000)}
function workSeconds(day){if(!day.timeIn)return 0;return Math.max(0,elapsedSeconds(day)-breakSeconds(day,!day.timeOut))}
$('#timeInBtn').onclick=()=>{const d=getToday();if(!d.timeIn){d.timeIn=new Date().toISOString();save(STORAGE.time,timeData);renderTime()}};
$('#breakBtn').onclick=()=>{const d=getToday();if(!d.timeIn||d.timeOut)return;const a=activeBreak(d);if(a)a.end=new Date().toISOString();else d.breaks.push({start:new Date().toISOString(),end:null});save(STORAGE.time,timeData);renderTime()};
$('#timeOutBtn').onclick=()=>{const d=getToday();if(!d.timeIn||d.timeOut)return;const a=activeBreak(d);if(a)a.end=new Date().toISOString();d.timeOut=new Date().toISOString();save(STORAGE.time,timeData);renderTime()};
$('#clearTimeHistory').onclick=()=>{if(confirm('Clear all time stamp history?')){timeData={};save(STORAGE.time,timeData);renderTime()}};
function renderTime(){const d=getToday(),a=activeBreak(d);$('#timeInBtn').disabled=!!d.timeIn;$('#timeOutBtn').disabled=!d.timeIn||!!d.timeOut;$('#breakBtn').disabled=!d.timeIn||!!d.timeOut;$('#breakBtn').textContent=a?'End Break / Away':'Start Break / Away';$('#stampStatus').textContent=d.timeOut?'Completed for today.':a?'Break / Away is currently running.':d.timeIn?'Currently clocked in.':'Ready for today\'s time stamp.';
 const tbody=$('#timeTableBody');tbody.innerHTML='';const keys=Object.keys(timeData).sort().reverse();keys.forEach(k=>{const x=timeData[k];const breakText=x.breaks.length?x.breaks.map(b=>`${fmtTime(b.start)} – ${fmtTime(b.end)}`).join('<br>'):'—';const tr=document.createElement('tr');tr.innerHTML=`<td>${fmtDate(k)}</td><td>${fmtTime(x.timeIn)}</td><td>${breakText}</td><td>${fmtTime(x.timeOut)}</td><td>${x.timeIn?hms(workSeconds(x)):'—'}</td>`;tbody.appendChild(tr)});$('#timeEmpty').style.display=keys.length?'none':'block';updateTimers()}
function updateTimers(){const d=getToday();$('#workTimer').textContent=hms(elapsedSeconds(d));const bs=breakSeconds(d);$('#breakTimer').textContent=`${hms(bs)} / 01:30:00`;const pct=Math.min(100,(bs/BREAK_LIMIT)*100);$('#breakProgress').style.width=pct+'%';$('#breakProgress').style.background=bs>BREAK_LIMIT?'var(--red)':'var(--blue)'}
function tick(){const now=new Date();$('#liveClock').textContent=now.toLocaleTimeString('en-PH',{hour12:false});$('#liveDate').textContent=now.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});$('#todayLabel').textContent=now.toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'});updateTimers()}
function titleCase(s){return s.replace(/\b\w/g,m=>m.toUpperCase())} function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderAll(){calcBudget();renderBills();renderTime()}
renderAll();tick();setInterval(tick,1000);

// ---- Music player controls -------------------------------------------------
// Audiomack is embedded in a cross-origin iframe. These controls use the
// Player.js postMessage format where supported by the Audiomack embed. The
// embedded Audiomack controls stay visible as a reliable fallback.
(() => {
  const frame = document.querySelector('#audiomackPlayer');
  const playBtn = document.querySelector('#musicPlayBtn');
  const prevBtn = document.querySelector('#musicPrevBtn');
  const nextBtn = document.querySelector('#musicNextBtn');
  const muteBtn = document.querySelector('#musicMuteBtn');
  const volume = document.querySelector('#musicVolume');
  const volumeLabel = document.querySelector('#musicVolumeLabel');
  const status = document.querySelector('#musicControlStatus');
  if (!frame || !playBtn || !prevBtn || !nextBtn || !muteBtn || !volume || !volumeLabel || !status) return;

  const VOLUME_KEY = 'pt_music_volume_v1';
  let isPlaying = false;
  let isMuted = false;
  let lastVolume = Number(localStorage.getItem(VOLUME_KEY) ?? 70);
  if (!Number.isFinite(lastVolume)) lastVolume = 70;
  lastVolume = Math.max(0, Math.min(100, lastVolume));
  volume.value = String(lastVolume);
  volumeLabel.textContent = `${lastVolume}%`;

  function sendPlayerCommand(method, value) {
    if (!frame.contentWindow) return;
    const payload = { context: 'player.js', version: '0.0.11', method };
    if (value !== undefined) payload.value = value;
    // No private information is sent. Wildcard is intentional because the
    // embed may redirect between audiomack.com and www.audiomack.com.
    frame.contentWindow.postMessage(JSON.stringify(payload), '*');
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function updatePlayButton() {
    playBtn.textContent = isPlaying ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playBtn.title = isPlaying ? 'Pause' : 'Play';
  }

  function updateMuteButton() {
    const current = Number(volume.value);
    muteBtn.textContent = isMuted || current === 0 ? '🔇' : current < 45 ? '🔉' : '🔊';
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
    muteBtn.title = isMuted ? 'Unmute' : 'Mute';
  }

  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    sendPlayerCommand(isPlaying ? 'play' : 'pause');
    updatePlayButton();
    setStatus(isPlaying ? 'Play requested.' : 'Pause requested.');
  });

  prevBtn.addEventListener('click', () => {
    sendPlayerCommand('previous');
    sendPlayerCommand('prev');
    setStatus('Previous track requested. If Audiomack ignores it, use the previous control inside the player.');
  });

  nextBtn.addEventListener('click', () => {
    sendPlayerCommand('next');
    setStatus('Next track requested. If Audiomack ignores it, use the next control inside the player.');
  });

  volume.addEventListener('input', () => {
    const value = Number(volume.value);
    volumeLabel.textContent = `${value}%`;
    localStorage.setItem(VOLUME_KEY, String(value));
    if (value > 0) {
      lastVolume = value;
      isMuted = false;
    }
    sendPlayerCommand('setVolume', value);
    updateMuteButton();
    setStatus(`Volume set to ${value}%.`);
  });

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      const current = Number(volume.value);
      if (current > 0) lastVolume = current;
      sendPlayerCommand('mute');
      sendPlayerCommand('setVolume', 0);
      volume.value = '0';
      volumeLabel.textContent = '0%';
    } else {
      const restored = Math.max(1, lastVolume || 70);
      volume.value = String(restored);
      volumeLabel.textContent = `${restored}%`;
      localStorage.setItem(VOLUME_KEY, String(restored));
      sendPlayerCommand('unmute');
      sendPlayerCommand('setVolume', restored);
    }
    updateMuteButton();
    setStatus(isMuted ? 'Music muted.' : `Volume restored to ${volume.value}%.`);
  });

  frame.addEventListener('load', () => {
    // Give the embed a moment to initialize, then restore the user's volume.
    window.setTimeout(() => sendPlayerCommand('setVolume', Number(volume.value)), 800);
  });

  window.addEventListener('message', event => {
    if (!/https:\/\/(www\.)?audiomack\.com$/i.test(event.origin)) return;
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data || data.context !== 'player.js') return;
    if (data.event === 'play') { isPlaying = true; updatePlayButton(); }
    if (data.event === 'pause' || data.event === 'ended') { isPlaying = false; updatePlayButton(); }
    if (data.event === 'ready') {
      const methods = Array.isArray(data.value?.methods) ? data.value.methods : [];
      const volumeSupported = methods.includes('setVolume');
      const nextSupported = methods.includes('next');
      setStatus(
        `Audiomack player connected${volumeSupported ? ' • volume control supported' : ''}${nextSupported ? ' • next/previous supported' : ''}.`
      );
      sendPlayerCommand('setVolume', Number(volume.value));
      ['play','pause','ended'].forEach(name => sendPlayerCommand('addEventListener', name));
    }
  });

  updatePlayButton();
  updateMuteButton();
})();
