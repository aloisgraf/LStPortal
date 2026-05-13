window._helpActive = 'login';
function showHelpSection(id){
  document.querySelectorAll('[id^="hsec-"]').forEach(el=>el.style.display='none');
  document.querySelectorAll('[id^="htoc-"]').forEach(el=>{el.style.background='';el.style.color='var(--mu)';});
  var sec=document.getElementById('hsec-'+id);
  var toc=document.getElementById('htoc-'+id);
  if(sec)sec.style.display='block';
  if(toc){toc.style.background='var(--acc)';toc.style.color='var(--act)';}
  window._helpActive=id;
  var c=document.getElementById('helpContent');
  if(c)c.scrollTop=0;
}

const APP_VERSION='2.6.1';
const MONTHS=['J\u00e4nner','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const PALETTE=['#3b6dd4','#10b981','#7c3aed','#e87bb0','#f59e0b','#ef4444','#0ea5e9','#84cc16','#f97316','#6366f1','#64748b','#14b8a6'];
const PAL_DARK=['#e8c547','#5bc4a0','#7b8be8','#e87bb0','#c47b5b','#e85b5b','#5bc4e8','#a0e85b','#e8a05b','#5b8be8','#8888a8','#a05be8'];
const ROLES=[{id:'admin',label:'Administrator',icon:'\uD83D\uDD11'},{id:'leitung',label:'Leitung',icon:'\u2B50'},{id:'dienstplanung',label:'Dienstplanung',icon:'\uD83D\uDCCB'},{id:'schichtleiter',label:'Schichtleiter',icon:'\uD83D\uDD06'},{id:'technik',label:'Technik',icon:'\uD83D\uDD27'},{id:'ausbildung',label:'Ausbildung',icon:'\uD83C\uDF93'},{id:'qm',label:'QM',icon:'\u2705'},{id:'standard',label:'Standard',icon:'\uD83D\uDC64'}];
const DEPTS=['technik','leitung','dienstplanung','ausbildung','qm','frei'];
const DEPT_LABELS={technik:'\uD83D\uDD27 Technik',leitung:'\u2B50 Leitung',dienstplanung:'\uD83D\uDCCB Dienstplanung',ausbildung:'\uD83C\uDF93 Ausbildung',qm:'\u2705 QM',frei:'\uD83C\uDF10 Frei'};
const PRIORITIES=[{id:'low',label:'\uD83D\uDFE2 Gering',color:'#10b981'},{id:'medium',label:'\uD83D\uDFE1 Mittel',color:'#f59e0b'},{id:'high',label:'\uD83D\uDD34 Hoch',color:'#ef4444'}];
const STATUSES=[{id:'open',label:'Offen'},{id:'in_progress',label:'In Bearbeitung'},{id:'on_hold',label:'Zur\u00fcckgestellt'},{id:'closed',label:'Abgeschlossen'}];
const BUCKETS=[{id:'urgent',label:'\uD83D\uDEA8 Dringend'},{id:'week',label:'\uD83D\uDCC5 Diese Woche'},{id:'sched',label:'\uD83D\uDCCB Dienstplanung'},{id:'wait',label:'\u23F3 Wartet'},{id:'it',label:'\uD83D\uDCBB IT'},{id:'proj',label:'\uD83D\uDE80 Projekte'},{id:'org',label:'\uD83C\uDFE2 Organisation'},{id:'ideas',label:'\uD83D\uDCA1 Ideen'}];
const RM=[
  ['Benutzer verwalten',         {admin:1,leitung:0,dienstplanung:0,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Dienstplan: alle sehen',     {admin:1,leitung:1,dienstplanung:1,schichtleiter:1,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Dienstplan: nur eigene',     {admin:0,leitung:0,dienstplanung:0,schichtleiter:0,technik:1,ausbildung:1,qm:1,standard:1}],
  ['Eintr\u00e4ge genehmigen',  {admin:1,leitung:0,dienstplanung:1,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Allg. Eintr\u00e4ge erstellen',{admin:1,leitung:1,dienstplanung:1,schichtleiter:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Tickets: Fachbereich sehen', {admin:1,leitung:1,dienstplanung:2,schichtleiter:0,technik:2,ausbildung:2,qm:2,standard:0}],
  ['Tickets: alle sehen',        {admin:1,leitung:1,dienstplanung:0,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Tickets: Beschwerden sehen', {admin:1,leitung:1,dienstplanung:0,schichtleiter:1,technik:0,ausbildung:0,qm:1,standard:0}],
  ['Tickets: nur eigene',        {admin:0,leitung:0,dienstplanung:0,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:1}],
  ['Status/Bucket setzen',       {admin:1,leitung:1,dienstplanung:1,schichtleiter:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Nachrichten senden',         {admin:1,leitung:1,dienstplanung:1,schichtleiter:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Alle Zulagen',               {admin:1,leitung:1,dienstplanung:1,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Abrechnung alle sehen',      {admin:1,leitung:0,dienstplanung:1,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Aktivit\u00e4tslog sehen',  {admin:1,leitung:0,dienstplanung:0,schichtleiter:0,technik:0,ausbildung:0,qm:0,standard:0}],
];
let S={
  year:new Date().getFullYear(),month:new Date().getMonth(),
  currentUser:null,view:'home',filterUser:null,
  tkFiltDept:'',tkFiltPrio:'',tkFiltBucket:'',tkFiltTag:'',tkFiltAssignee:'',tkSearch:'',tkFiltStatus:'',
  allwYear:new Date().getFullYear(),allwPeriod:'month',allwMonth:new Date().getMonth()+1,
  abrYear:new Date().getFullYear(),abrMonth:new Date().getMonth()+1,abrUser:null,
  zahnarztWeek:null, // null = all from today, otherwise ISO Mon of week
  zahnarztData:[],
  events:[],users:[],categories:[],tags:[],allowances:[],tickets:[],ticketSubcategories:[],noteTemplates:[],
  tkBatchMode:false,tkBatchSel:new Set(),_tkFeedFilter:'all',_tkTab:'details',
  checklists:[],messages:[],notifications:[],abrechnung:{einspringer:[],homeoffice:[]},dienstplaene:[],
  p:{canApproveEvents:false,canSendMessages:false,seeAllEntries:true,editAllPersonal:false,addForOthers:false,addGeneral:false,manageUsers:false,seeAllAllw:false,editAllw:false,seeAllAbrechnung:false},
  p:{canApproveEvents:false,canSendMessages:false,seeAllEntries:true,editAllPersonal:false,addForOthers:false,addGeneral:false,manageUsers:false,seeAllAllw:false,editAllw:false,seeAllAbrechnung:false},
  tp:{seeAll:false,editAll:false,myDepts:[],canSetPublic:false,canAssign:false,canSeeSubcat:false,canEditSubcat:false,roles:[]},
};
async function api(method,path2,body){
  const opts={method,credentials:'include',headers:{}};
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  const res=await fetch('/api'+path2,opts);
  if(!res.ok&&res.headers.get('content-type')?.includes('text/html')){throw new Error('Server-Fehler '+res.status);}
  const data=await res.json();
  if(!data.success)throw new Error(data.error||'Fehler');
  return data.data;
}
function loading(show){document.getElementById('loadingOv').classList.toggle('open',show);}
async function fetchData(){
  loading(true);
  try{
    const data=await api('GET','/data');
    S.users=data.users||[];S.categories=data.categories||[];S.tags=data.tags||[];
    S.events=data.events||[];S.tickets=data.tickets||[];S.allowances=data.allowances||[];
    S.checklists=data.checklists||[];S.messages=data.messages||[];
    S.notifications=data.notifications||[];S.abrechnung=data.abrechnung||{einspringer:[],homeoffice:[]};S.diensttausch=data.diensttausch||[];S.homeoffice=data.homeoffice||{slots:[],config:[],boxes:[],dienste:[]};S.vacationConfig=data.vacationConfig||[];
    S.dienstplaene=data.dienstplaene||[];S.diensttausch=data.diensttausch||[];
    S.ticketSubcategories=data.ticketSubcategories||[];
    S.noteTemplates=data.noteTemplates||[];
    S.currentUser=data.currentUser;S.p=data.permissions||{};
    const u=getU(S.currentUser);const roles=u?.roles||['standard'];
    const has=(...r)=>r.some(x=>roles.includes(x));
    S.tp={seeAll:has('admin','leitung'),editAll:has('admin','leitung'),
      myDepts:DEPTS.filter(d=>roles.includes(d)),
      canSetPublic:!has('standard'),canAssign:!has('standard'),
      canSeeSubcat:has('admin','leitung','schichtleiter','qm'),
      canEditSubcat:has('admin','leitung','schichtleiter','qm'),
      roles};
    updateBadges();
  }finally{loading(false);}
}
const getU=id=>S.users.find(u=>u.id===id);
const getCat=id=>S.categories.find(c=>c.id===id);
const getTag=id=>S.tags.find(t=>t.id===id);
const getTk=id=>S.tickets.find(t=>t.id===id);
const getAllw=(uid,year,month)=>S.allowances.find(a=>a.userId===uid&&a.year===year&&a.month===month)||{nd:0,fd:0,fw:0,c10:0};
const getRoleDef=r=>ROLES.find(x=>x.id===r)||ROLES[6];
const fd=s=>{if(!s)return'\u2014';const p=s.split('T')[0].split('-');return`${p[2]}.${p[1]}.${p[0]}`;};

function fmtDateShort(s) {
  if(!s) return '';
  var p = String(s).slice(0,10).split('-');
  if(p.length < 3) return s;
  return p[2]+'.'+p[1]+'.'+p[0];
}
const fdt=s=>{if(!s)return'\u2014';const d=new Date(s);if(isNaN(d))return String(s||'');if(typeof s==='string'&&s.length<=10)return fd(s);return`${fd(d.toISOString())} ${d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}`;};
const avHtml=(init,color,sz=24,fs=10,online=false)=>`<div class="av" style="width:${sz}px;height:${sz}px;font-size:${fs}px;background:${color}22;color:${color}">${init}${online?'<div class="online-dot"></div>':''}</div>`;
const roleBadges=uid=>((getU(uid)?.roles)||['standard']).map(r=>{const d=getRoleDef(r);return`<span class="rb rb-${r}">${d.icon} ${d.label}</span>`;}).join('');
const prioBdg=p=>{const d=PRIORITIES.find(x=>x.id===p)||PRIORITIES[1];return`<span class="bdg pr-${p}">${d.label}</span>`;};
const stBdg=s=>{const d=STATUSES.find(x=>x.id===s)||STATUSES[0];return`<span class="bdg st-${s}">${d.label}</span>`;};
const deptBdg=d=>`<span class="bdg dp-${d}">${DEPT_LABELS[d]||d}</span>`;
const tagChips=tgs=>(tgs||[]).map(tid=>{const t=getTag(tid);if(!t)return'';return`<span class="tag-chip" style="background:${t.color}1a;color:${t.color};border:1px solid ${t.color}30">${t.label}</span>`;}).join('');
const dueBdg=tk=>{
  if(!tk.dueDate||tk.status==='closed')return'';
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(tk.dueDate);due.setHours(0,0,0,0);
  const diff=Math.round((due-today)/(1000*60*60*24));
  if(diff<0)return`<span class="bdg" style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;font-weight:700">⚠️ Überfällig ${Math.abs(diff)}T</span>`;
  if(diff===0)return`<span class="bdg" style="background:#fff7ed;color:#ea580c;border:1px solid #fdba74;font-weight:700">⏰ Heute fällig</span>`;
  if(diff<=3)return`<span class="bdg" style="background:#fffbeb;color:#d97706;border:1px solid #fcd34d">📅 ${diff}T</span>`;
  return`<span class="bdg" style="background:var(--sf2);color:var(--mu)">📅 ${due.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</span>`;
};
const apBdg=s=>s==='approved'?'<span class="bdg ap-bdg-approved">\u2713 Genehmigt</span>':s==='rejected'?'<span class="bdg ap-bdg-rejected">\u2717 Abgelehnt</span>':'<span class="bdg ap-bdg-pending">\u23F3 Ausstehend</span>';
const pal=()=>document.documentElement.getAttribute('data-theme')==='dark'?PAL_DARK:PALETTE;
const h2r=hex=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${r}, ${g}, ${b})`;};
function updateBadges(){
  const unreadMsg=S.messages.filter(m=>!m.isRead&&m.senderId!==S.currentUser).length;
  const unreadNotif=S.notifications.filter(n=>!n.isRead).length;
  const md=document.getElementById('msgDot');if(md)md.style.display=unreadMsg?'block':'none';
  const nd=document.getElementById('notifDot');if(nd)nd.style.display=unreadNotif?'block':'none';
  const nb=document.getElementById('navMsgBdg');if(nb){nb.style.display=unreadMsg?'flex':'none';nb.textContent=unreadMsg;}
  const unreadNews=(S.news||[]).filter(n=>n.isImportant&&n.isActive&&!n.isExpired).length;
  const newsBdg=document.getElementById('newsBdg');if(newsBdg){newsBdg.style.display=unreadNews?'flex':'none';newsBdg.textContent=unreadNews;}
  const pendingDt=(S.diensttausch||[]).filter(dt=>dt.isRelevant&&!dt.isSeen).length;
  const dtBdg=document.getElementById('dtBdg');if(dtBdg){dtBdg.style.display=pendingDt?'flex':'none';dtBdg.textContent=pendingDt;}
}
// AUTH
let _loginUsers=[];
async function loadLoginUsers(){
  const sel=document.getElementById('lsel');if(!sel)return;
  sel.innerHTML='<option value="">\u23F3 Lade...\u2026</option>';sel.disabled=true;
  for(let i=1;i<=5;i++){
    try{
      _loginUsers=await api('GET','/auth/users');
      if(Array.isArray(_loginUsers)&&_loginUsers.length>0){
        sel.disabled=false;
        sel.innerHTML='<option value="">\u2014 Benutzer w\u00e4hlen \u2014</option>'+_loginUsers.map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
        return;
      }
    }catch(e){console.warn('Login retry',i,e.message);}
    if(i<5){sel.innerHTML=`<option value="">\u23F3 Verbinde\u2026 (${i}/5)</option>`;await new Promise(r=>setTimeout(r,i*2000));}
  }
  sel.disabled=false;
  sel.innerHTML='<option value="">&#10060; Server nicht erreichbar &#8211; Seite neu laden</option>';
  // Show error visibly
  const lerr=document.getElementById('lerr');
  if(lerr){lerr.textContent='Server nicht erreichbar. Bitte Seite neu laden oder Render-Logs prüfen.';lerr.style.display='block';}
}
async function doLogin(){
  const userId=document.getElementById('lsel').value;
  if(!userId){toast('\u26A0\uFE0F Bitte Benutzer ausw\u00e4hlen!');return;}
  loading(true);
  try{
    const res=await api('POST','/auth/login',{userId,password:document.getElementById('lpw').value}).catch(e=>{document.getElementById('lerr').style.display='block';document.getElementById('lpw').value='';loading(false);throw e;});
    S.currentUser=res.userId;
    if(res.mustChangePW){document.getElementById('LS').classList.remove('open');document.getElementById('np1').value='';document.getElementById('np2').value='';document.getElementById('CPWS').classList.add('open');}
    else{try{await fetchData();}catch(e2){toast('⚠️ Daten-Fehler: '+e2.message,'err');}loginOK();}
  }catch(e){}
  finally{loading(false);}
}
async function doForcePW(){
  const p1=document.getElementById('np1').value,p2=document.getElementById('np2').value;
  if(p1.length<6){toast('\u26A0\uFE0F Mindestens 6 Zeichen!');return;}
  if(p1!==p2){toast('\u26A0\uFE0F Passw\u00f6rter stimmen nicht \u00fcberein!');return;}
  loading(true);
  try{await fetch('/api/auth/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:'',newPassword:p1})});document.getElementById('CPWS').classList.remove('open');await fetchData();loginOK();}
  catch(e){toast('\u26A0\uFE0F '+e.message);}finally{loading(false);}
}
function loginOK(){
  startClock();
  document.getElementById('LS').classList.remove('open');
  document.getElementById('hdr').style.display='flex';document.getElementById('APP').style.display='grid';
  const vb=document.getElementById('versionBadge');if(vb)vb.textContent='v'+APP_VERSION;
  const u=getU(S.currentUser);
  document.getElementById('pillNm').textContent=u?.name||'?';
  const pa=document.getElementById('pillAv');pa.textContent=u?.initials||'?';pa.style.background=(u?.color||'#888')+'22';pa.style.color=u?.color||'#888';
  const ab=document.getElementById('adminBtn');if(ab)ab.style.display=S.p.manageUsers?'flex':'none';
  loadNews().then(function(){setView('home');});startAutoRefresh();
  // archivNav for all users
  const archivNav=document.getElementById('ni-news_archiv');
  if(archivNav)archivNav.style.display='block';
  toast('\uD83D\uDC4B Willkommen, '+(u?.name||'')+'!');
}
async function logout(){
  loading(true);try{await api('POST','/auth/logout');}catch(e){}finally{loading(false);}
  if(_refreshTimer)clearInterval(_refreshTimer);
  S.currentUser=null;document.getElementById('hdr').style.display='none';document.getElementById('APP').style.display='none';
  await loadLoginUsers();document.getElementById('LS').classList.add('open');
}
function openPwModal(){
  const u=getU(S.currentUser);
  S.myColor=u?.color||pal()[0];
  buildCP('myCR',S.myColor,'pickMyColor');
  document.getElementById('cpw0').value='';document.getElementById('cpw1').value='';document.getElementById('cpw2').value='';
  openModal('pwModal');
}
function pickMyColor(col,cid){S.myColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
async function saveMyColor(){
  try{
    await api('PUT','/users/'+S.currentUser,{color:S.myColor});
    await fetchData();
    const u=getU(S.currentUser);
    const pa=document.getElementById('pillAv');if(pa){pa.style.background=(u?.color||'#888')+'22';pa.style.color=u?.color||'#888';}
    toast('\u2705 Farbe gespeichert!');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function doChangePW(){
  const c=document.getElementById('cpw0').value,n=document.getElementById('cpw1').value,n2=document.getElementById('cpw2').value;
  if(n.length<6){toast('\u26A0\uFE0F Mindestens 6 Zeichen!');return;}
  if(n!==n2){toast('\u26A0\uFE0F Passw\u00f6rter stimmen nicht \u00fcberein!');return;}
  try{await api('POST','/auth/change-password',{currentPassword:c,newPassword:n});closeModal('pwModal');toast('\u2705 Passwort ge\u00e4ndert!');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// NAVIGATION
function toggleSidebar(){const sb=document.getElementById('sidebar'),ov=document.getElementById('sbOv');sb.classList.toggle('open');ov.classList.toggle('open');}
function toggleNS(id){document.getElementById(id+'Hdr').classList.toggle('open');document.getElementById(id+'Sub').classList.toggle('open');}
function setView(v){
  S.view=v;
  ['home','schedule','calendar','allw','diensttausch','abrechnung','dienstplaene','tickets','tickets_closed','checklists','messages','messages_sent','zahnarzt'].forEach(x=>{const el=document.getElementById('ni-'+x);if(el)el.classList.toggle('active',x===v);});
  document.getElementById('sidebar').classList.remove('open');document.getElementById('sbOv').classList.remove('open');
  renderSBF();renderMain();
}
function renderSBF(){
  const el=document.getElementById('sbf');if(!el)return;
  if(S.view==='schedule'||S.view==='calendar'){
    el.innerHTML='';
  }else if(S.view==='allw'){
    el.innerHTML='';
  }else if(S.view==='abrechnung'){
    el.innerHTML='';
  }else if(S.view==='tickets'||S.view==='tickets_closed'){
    el.innerHTML='';
  }else el.innerHTML='';
}
function renderMain(){
  if(S.view==='home')renderHome();
  else if(S.view==='schedule')renderSchedule();
  else if(S.view==='calendar')renderCalendar();
  else if(S.view==='homeoffice')renderHomeoffice();
  else if(S.view==='vacation')renderVacation();
  else if(S.view==='diensttausch')renderDiensttausch();
  else if(S.view==='news'||S.view==='news_archiv')renderNews();
  else if(S.view==='allw')renderAllw();
  else if(S.view==='diensttausch')renderDiensttausch();
  else if(S.view==='abrechnung')renderAbrechnung();
  else if(S.view==='dienstplaene')renderDienstplaene();
  else if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();
  else if(S.view==='checklists')renderChecklists();
  else if(S.view==='messages'||S.view==='messages_sent')renderMessages();
  else if(S.view==='zahnarzt')renderZahnarzt();
}
// HOME
function renderHome(){
  const u=getU(S.currentUser);
  const online=S.users.filter(x=>x.isOnline&&x.id!==S.currentUser);
  const unreadMsg=S.messages.filter(m=>!m.isRead&&m.senderId!==S.currentUser);
  const pinnedMsg=S.messages.filter(m=>m.pinned&&m.senderId!==S.currentUser);
  const unreadNotif=S.notifications.filter(n=>!n.isRead&&n.type!=='event_added'&&n.type!=='event_changed'&&n.type!=='einspringer_rejected');
  const eventNotifs=S.notifications.filter(n=>!n.isRead&&(n.type==='event_added'||n.type==='event_changed'));
  const einspNotifs=S.notifications.filter(n=>!n.isRead&&n.type==='einspringer_rejected');
  const myDepts=S.tp.myDepts;
  const myName=(getU(S.currentUser)?.name||'').toLowerCase();
  const relevantTks=S.tickets.filter(tk=>{
    if(tk.status==='closed')return false;
    if(tk.assigneeId===S.currentUser)return true; // mir zugewiesen
    if(tk.createdBy===S.currentUser)return true;  // von mir erstellt
    if(myDepts.includes(tk.department))return true; // mein Fachbereich
    if(tk.department==='frei')return myDepts.length>0||S.tp.seeAll; // Frei für alle mit Fachbereich
    // Erwähnt in einer Notiz (@meinName)
    if(myName&&(tk.notes||[]).some(n=>n.text&&n.text.toLowerCase().includes('@'+myName)))return true;
    return false;
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10);
  // ── Homeoffice nächste 30 Tage ──
  var _today0=new Date(); _today0.setHours(0,0,0,0);
  var _in30=new Date(_today0); _in30.setDate(_in30.getDate()+30);
  var _normD=function(d){if(!d)return'';var s=typeof d==='string'?d:d instanceof Date?d.toISOString():''+d;return s.slice(0,10);};
  var _moNs=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var _dyNs=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  var myHo=(S.homeoffice&&S.homeoffice.slots||[]).filter(function(s){if(s.userId!==S.currentUser)return false;var d=new Date(_normD(s.date)+'T00:00:00');return d>=_today0&&d<=_in30;}).sort(function(a,b){return _normD(a.date).localeCompare(_normD(b.date));});
  var hoHtml='';
  if(myHo.length){
    hoHtml='<div style="background:rgba(14,165,233,.05);border:1px solid rgba(14,165,233,.2);border-radius:var(--r);padding:14px;margin-bottom:14px">';
    hoHtml+='<div style="font-size:13px;font-weight:700;color:#0ea5e9;margin-bottom:8px">&#127968; Meine Homeoffice-Tage (n\u00e4chste 30 Tage)</div>';
    myHo.forEach(function(s){var dobj=new Date(_normD(s.date)+'T00:00:00');hoHtml+='<div style="padding:3px 0;font-size:12px;display:flex;gap:10px;border-bottom:1px solid var(--border)"><span style="font-weight:600;min-width:220px">'+String(dobj.getDate()).padStart(2,'0')+'. '+_moNs[dobj.getMonth()]+' '+dobj.getFullYear()+' ('+_dyNs[dobj.getDay()]+')</span><span style="color:var(--mu)">'+(s.box||'')+(s.dienst?' \u00b7 '+s.dienst:'')+'</span></div>';});
    hoHtml+='<button class="btn-s" style="margin-top:8px;font-size:11px" onclick="setView(\'homeoffice\')">Homeoffice-Raster &#8594;</button></div>';
  }
  // ── Meine Urlaube nächste 90 Tage ──
  var _today=new Date().toISOString().slice(0,10);
  var _in90=new Date();_in90.setDate(_in90.getDate()+90);var _in90s=_in90.toISOString().slice(0,10);
  var _vacCats=S.categories.filter(function(c){return c.label&&c.label.toLowerCase().includes('urlaub');});
  var _vacCatIds=_vacCats.map(function(c){return c.id;});
  var vacHtml='';
  if(_vacCatIds.length){
    var myVac=S.events.filter(function(ev){return ev.userId===S.currentUser&&_vacCatIds.includes(ev.category)&&ev.dateTo>=_today&&ev.dateFrom<=_in90s;}).sort(function(a,b){return a.dateFrom.localeCompare(b.dateFrom);});
    if(myVac.length){
      vacHtml='<div style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:var(--r);padding:14px;margin-bottom:14px">';
      vacHtml+='<div style="font-size:13px;font-weight:700;color:var(--ok);margin-bottom:10px">&#127958;&#65039; Meine Urlaube (n\u00e4chste 90 Tage)</div>';
      vacHtml+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">';
      myVac.forEach(function(ev){var cat=_vacCats.find(function(c){return c.id===ev.category;});var st=ev.approvalStatus==='approved'?'<span class="bdg ap-bdg-approved" style="font-size:10px">&#10003; Genehmigt</span>':ev.approvalStatus==='rejected'?'<span class="bdg ap-bdg-rejected" style="font-size:10px">&#10007; Abgelehnt</span>':'<span class="bdg ap-bdg-pending" style="font-size:10px">&#8987; Ausstehend</span>';vacHtml+='<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);padding:10px;border-left:3px solid '+(cat&&cat.color||'var(--ok)')+'"><div style="font-size:12px;font-weight:700">'+fmtDateShort(ev.dateFrom)+' – '+fmtDateShort(ev.dateTo)+'</div><div style="font-size:11px;color:var(--mu)">'+(ev.reason||'Urlaub')+'</div>'+st+'</div>';});
      vacHtml+='</div><button class="btn-s" style="margin-top:8px;font-size:11px" onclick="setView(\'vacation\')">Urlaubsübersicht &#8594;</button></div>';
    }
  }
    // News: Wichtig und/oder Angepinnt → oben in Übersicht
  var importantNewsHtml='';
  var _impNews=(S.news||[]).filter(function(n){return n.isActive&&!n.isExpired&&(n.isImportant||n.isPinned);});
  if(_impNews.length){
    var _newsBody='';
    _impNews.forEach(function(n){
      var badges='';
      if(n.isImportant&&n.isPinned) badges='<span class="bdg ap-bdg-rejected" style="font-size:10px;margin-right:4px">&#9888;&#65039; Wichtig</span><span class="bdg" style="font-size:10px;background:rgba(59,109,212,.12);color:var(--acc)">&#128204; Angepinnt</span>';
      else if(n.isImportant) badges='<span class="bdg ap-bdg-rejected" style="font-size:10px">&#9888;&#65039; Wichtig</span>';
      else badges='<span class="bdg" style="font-size:10px;background:rgba(59,109,212,.12);color:var(--acc)">&#128204; Angepinnt</span>';
      var accent=n.isImportant?'#ef4444':'var(--acc)';
      _newsBody+='<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 14px;border-top:1px solid var(--border)">';
      _newsBody+='<div style="width:3px;align-self:stretch;background:'+accent+';border-radius:2px;flex-shrink:0"></div>';
      _newsBody+='<div style="flex:1;min-width:0">';
      _newsBody+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+badges+'<span style="font-size:13px;font-weight:700">'+escHtml(n.title)+'</span></div>';
      _newsBody+='<div style="font-size:12px;line-height:1.5;color:var(--tx)">'+n.body.slice(0,200)+(n.body.length>200?'…':'')+'</div>';
      _newsBody+='</div>';
      _newsBody+='<button class="btn-s" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="toggleNewsPin(\''+n.id+'\','+n.isPinned+')">'+(n.isPinned?'Lospinnen':'Anpinnen')+'</button>';
      _newsBody+='</div>';
    });
    _newsBody+='<div style="padding:8px 14px;border-top:1px solid var(--border)"><button class="btn-s" style="font-size:11px" onclick="setView(\x27news\x27)">Alle News &#8594;</button></div>';
    importantNewsHtml=_ccWrap('imp_news','&#128240; News &amp; Wichtiges ('+_impNews.length+')','<div class="card-rows">'+_newsBody+'</div>');
  }
  
  // ── Precompute card HTML (avoids template literal nesting issues) ──
  function _ccWrap(id,title,bodyHtml,accent){
    var open;
    try{open=localStorage.getItem('cc_'+id);open=open===null?true:open==='1';}catch(ex){open=true;}
    var accentStyle=accent?';border-top:3px solid '+accent+';background:'+accent+'0d':'';
    return '<details class="dash-card" data-cc-id="'+id+'"'+(open?' open':'')+' style="width:100%;box-sizing:border-box;margin-bottom:14px'+accentStyle+'">'
      +'<summary><h3 style="margin:0;display:inline;color:'+(accent||'var(--tx)')+'">'+title+'</h3></summary>'
      +bodyHtml+'</details>';
  }

  // Online
  var _onlineHtml='<div class="online-list" style="flex-wrap:wrap;padding-top:8px">';
  _onlineHtml+='<div class="online-user">'+avHtml(u?u.initials:'?',u?u.color:'#888',22,9,true)+'<span>'+(u?u.name:'')+'<span style="color:var(--mu);font-size:10px"> (du)</span></span></div>';
  online.forEach(function(x){_onlineHtml+='<div class="online-user">'+avHtml(x.initials,x.color,22,9,true)+'<span>'+x.name+'</span></div>';});
  _onlineHtml+='</div>';

  // Meine Einträge
  var _myEntriesHtml='';
  var _myEvs=S.events.filter(function(ev){return !ev.isGeneral&&ev.userId===S.currentUser;}).sort(function(a,b){return a.dateFrom.localeCompare(b.dateFrom);}).slice(0,8);
  if(_myEvs.length){
    _myEvs.forEach(function(ev){
      var cat=S.categories.find(function(c){return c.id===ev.category;});
      var st=ev.approvalStatus==='approved'?'<span class="bdg ap-bdg-approved" style="font-size:10px">&#10003;</span>':ev.approvalStatus==='rejected'?'<span class="bdg ap-bdg-rejected" style="font-size:10px">&#10007;</span>':ev.isGeneral?'':'<span class="bdg ap-bdg-pending" style="font-size:10px">&#8987;</span>';
      _myEntriesHtml+='<div style="padding:4px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;font-size:12px">';
      _myEntriesHtml+='<span style="color:var(--mu);flex-shrink:0;min-width:72px">'+fmtDateShort(ev.dateFrom)+'</span>';
      _myEntriesHtml+='<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(cat?cat.emoji+' ':'')+'<strong>'+(ev.reason||'\u2014')+'</strong></span>'+st+'</div>';
    });
  } else {
    _myEntriesHtml='<div style="color:var(--di);font-size:12px;padding:8px 0">Keine Eintr\u00e4ge</div>';
  }

  // Diese Woche fällig
  var _dueFaelligHtml='';
  (function(){
    var today=new Date();today.setHours(0,0,0,0);
    var weekEnd=new Date(today);weekEnd.setDate(today.getDate()+7);
    var dueTks=S.tickets.filter(function(tk){
      if(!tk.dueDate||tk.status==='closed')return false;
      var d=new Date(tk.dueDate);d.setHours(0,0,0,0);
      return d<=weekEnd;
    }).sort(function(a,b){return (a.dueDate||'').localeCompare(b.dueDate||'');}).slice(0,10);
    if(!dueTks.length)return;
    dueTks.forEach(function(tk){
      var asn=getU(tk.assigneeId);
      _dueFaelligHtml+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
      _dueFaelligHtml+='<div style="width:3px;align-self:stretch;background:#ea580c;border-radius:2px;flex-shrink:0"></div>';
      _dueFaelligHtml+='<div style="flex:1;min-width:0">';
      _dueFaelligHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tk.number+': '+tk.title+'</div>';
      _dueFaelligHtml+='<div style="font-size:10px;color:var(--mu)">'+dueBdg(tk)+(asn?' · '+asn.name:' · nicht zugewiesen')+'</div>';
      _dueFaelligHtml+='</div></div>';
    });
  })();

  // Beschwerden (subcategory tickets) für berechtigte Rollen
  var _beschwerdenHtml='';
  if(S.tp.canSeeSubcat){
    var beschwerden=S.tickets.filter(function(tk){return tk.subcategory&&tk.status!=='closed';}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,15);
    if(beschwerden.length){
      var _pColors={high:'#ef4444',medium:'#f59e0b',low:'#94a3b8'};
      beschwerden.forEach(function(tk){
        var isNew=tkIsNew(tk);var asn=getU(tk.assigneeId);
        _beschwerdenHtml+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border)'+
          (isNew?';background:rgba(124,58,237,.04)':'')+';cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
        _beschwerdenHtml+='<div style="width:3px;align-self:stretch;background:#7c3aed;border-radius:2px;flex-shrink:0"></div>';
        _beschwerdenHtml+='<div style="flex:1;min-width:0">';
        _beschwerdenHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+
          (isNew?'<span class="tk-new-badge">NEU</span> ':'')+
          '<span style="font-family:monospace;font-size:11px;color:var(--mu)">'+tk.number+'</span> '+tk.title+
          ' <span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:#7c3aed">'+tk.subcategory+'</span></div>';
        _beschwerdenHtml+='<div style="font-size:10px;color:var(--mu)">'+deptBdg(tk.department)+(asn?' · '+asn.name:' · nicht zugewiesen')+' · '+fd(tk.createdAt)+'</div>';
        _beschwerdenHtml+='</div>';
        _beschwerdenHtml+=prioBdg(tk.priority);
        _beschwerdenHtml+='</div>';
      });
    } else {
      _beschwerdenHtml='<div style="color:var(--mu);font-size:12px;padding:8px 0">Keine offenen Beschwerden</div>';
    }
  }

  // Relevante Tickets
  var _ticketsHtml='';
  if(relevantTks.length){
    var _hasNew=relevantTks.some(tkIsNew);
    _ticketsHtml+=(_hasNew?'<div style="font-size:11px;color:var(--warn);font-weight:600;margin-bottom:4px">&#128276; '+relevantTks.filter(tkIsNew).length+' neue Eintr\u00e4ge</div>':'');
    relevantTks.forEach(function(tk){
      var n=tkIsNew(tk);
      _ticketsHtml+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);gap:8px;'+(n?'background:rgba(245,158,11,.04);margin:0 -8px;padding:5px 8px;border-left:3px solid var(--warn);':'')+'">';
      _ticketsHtml+='<div style="min-width:0;flex:1;cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
      _ticketsHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(n?'<span class="tk-new-badge">NEU</span> ':'')+tk.number+': '+tk.title+'</div>';
      _ticketsHtml+='<div style="font-size:10px;color:var(--mu)">'+(tk.assigneeId===S.currentUser?'&#128100; Dir zugewiesen':'&#128202; '+(DEPT_LABELS[tk.department]||tk.department))+'</div>';
      _ticketsHtml+='</div>';
      _ticketsHtml+='<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">'+prioBdg(tk.priority);
      if(n)_ticketsHtml+='<button class="btn-ok" style="font-size:10px;padding:2px 7px;white-space:nowrap" onclick="event.stopPropagation();markTkSeen('+JSON.stringify(tk.id)+')">&#10003; Gesehen</button>';
      _ticketsHtml+='</div></div>';
    });
  } else {
    _ticketsHtml='<div style="color:var(--mu);font-size:12px">Keine relevanten Tickets</div>';
  }
    document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128196; \u00dcbersicht <span>${u?.name||''}</span></div></div>
    ${pinnedMsg.length?_ccWrap('pinned_msgs','&#128204; Angepinnte Nachrichten ('+pinnedMsg.length+')','<div class="card-rows">'+
      pinnedMsg.map(m=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openMsg('${m.id}')">
        <div style="width:3px;align-self:stretch;background:#f59e0b;border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">&#128204; ${m.title}</div>
          <div style="font-size:11px;color:var(--mu)">von ${getU(m.senderId)?.name||'?'}</div>
        </div>
        <button class="btn-s" style="font-size:10px;padding:2px 8px;flex-shrink:0" onclick="event.stopPropagation();toggleMsgPinDirect('${m.id}',true)">Lospinnen</button>
      </div>`).join('')+'</div>'
    ):''}
    ${unreadMsg.length?`<div style="background:rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,.20);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:10px">&#128276; ${unreadMsg.length} ungelesene Nachricht${unreadMsg.length>1?'en':''}</div>
      ${unreadMsg.map(m=>`<div style="padding:8px 12px;background:var(--sf);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><div style="font-weight:600;font-size:13px">${m.title}</div><div style="font-size:11px;color:var(--mu)">von ${getU(m.senderId)?.name||'?'} &middot; ${fdt(m.createdAt)}</div></div>
        <button class="btn-p" onclick="openMsg('${m.id}')">&#128279; Lesen &amp; Bestätigen</button>
      </div>`).join('')}
    </div>`:''}
    ${eventNotifs.length?`<div style="background:rgba(245,158,11,0.05));border:1px solid rgba(245,158,11,.25);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--warn);margin-bottom:10px">&#128197; ${eventNotifs.length} neue/ge\u00e4nderte Eintr\u00e4ge f\u00fcr dich</div>
      ${eventNotifs.map(n=>{const ev=S.events.find(e=>e.id===n.eventId);return`<div style="padding:8px 12px;background:var(--sf);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><div style="font-weight:600;font-size:13px">${n.title}</div>${ev?`<div style="font-size:11px;color:var(--mu)">${fd(ev.dateFrom)} &middot; ${ev.reason||'Eintrag'}</div>`:''}</div>
        <button class="btn-ok" onclick="confirmEventNotif('${n.id}')">&#10003; Zur Kenntnis</button>
      </div>`;}).join('')}
    </div>`:''}
    ${einspNotifs.length?`<div style="background:rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.22);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:10px">&#10007; ${einspNotifs.length} abgelehnter Einspringerdienst${einspNotifs.length>1?'e':''}</div>
      ${einspNotifs.map(n=>`<div style="padding:8px 12px;background:var(--sf);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><div style="font-weight:600;font-size:13px">${n.title}</div><div style="font-size:11px;color:var(--mu)">${fdt(n.createdAt)}</div></div>
        <button class="btn-ok" onclick="confirmEventNotif('${n.id}')">&#10003; Zur Kenntnis</button>
      </div>`).join('')}
    </div>`:''}
    ${unreadNotif.length?`<div style="background:rgba(59,109,212,.04);border:1px solid rgba(59,109,212,0.18);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--acc)">&#128276; ${unreadNotif.length} Benachrichtigung${unreadNotif.length>1?'en':''}</div>
        <button class="btn-s" style="font-size:11px" onclick="readAllNotifs()">Alle gelesen</button>
      </div>
      ${unreadNotif.slice(0,5).map(n=>{const icon=n.type==='mention'?'&#128172;':n.type==='assigned'?'&#128100;':'&#127931;';return`<div class="notif-card unread ${n.type}" onclick="openNotif('${n.id}','${n.ticketId||''}')">
        <div style="font-size:18px;flex-shrink:0">${icon}</div>
        <div><div style="font-size:12px;font-weight:600">${n.title}</div><div style="font-size:10px;color:var(--mu)">${fdt(n.createdAt)}</div></div>
      </div>`;}).join('')}
    </div>`:''}

    ${importantNewsHtml}${(hoHtml||vacHtml)?('<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'+hoHtml+vacHtml+'</div>'):''}
    ${_dueFaelligHtml?_ccWrap('due_week','&#128197; Diese Woche fällig','<div class="card-rows">'+_dueFaelligHtml+'</div>'):''}
    ${_beschwerdenHtml?_ccWrap('beschwerden','&#128680; Zu erledigen &ndash; Beschwerden','<div class="card-rows">'+_beschwerdenHtml+'</div>'):''}
    ${_ccWrap('online','&#128101; Online ('+(online.length+1)+')',_onlineHtml)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${_ccWrap('myentries','&#128197; Meine Einträge',_myEntriesHtml)}
      ${_ccWrap('tickets','&#127931; Relevante Tickets',_ticketsHtml)}
    </div>`;
}
async function confirmEventNotif(notifId){try{await api('POST','/notifications/'+notifId+'/read');await fetchData();renderHome();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}

async function markTkSeen(id) {
  const tk = S.tickets.find(t=>t.id===id);
  if (tk) { tk.lastViewedAt = new Date().toISOString(); }
  await api('PUT','/tickets/'+id+'/view').catch(()=>{});
  renderHome();
  if (S.view==='tickets'||S.view==='tickets_closed') renderTickets();
}

async function openNotif(notifId,ticketId){try{await api('POST','/notifications/'+notifId+'/read');}catch(e){}await fetchData();if(ticketId){openTkDetail(ticketId);setView('tickets');}else renderHome();}
async function readAllNotifs(){try{await api('POST','/notifications/read-all');await fetchData();renderHome();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
// SCHEDULE
function getVisEvts(){
  let evs=[...S.events];
  if(S.filterUser)evs=evs.filter(ev=>!ev.isGeneral&&ev.userId===S.filterUser);
  if(S.month!==null)evs=evs.filter(ev=>{const d=new Date(ev.dateFrom);return d.getFullYear()===S.year&&d.getMonth()===S.month;});
  else evs=evs.filter(ev=>new Date(ev.dateFrom).getFullYear()===S.year);
  return evs.sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom));
}
function renderSchedule(){
  const evs=getVisEvts();const ml=S.month!==null?MONTHS[S.month]:'Alle';
  const filterU=S.filterUser?getU(S.filterUser):null;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Eintrags\u00fcbersicht</div>
      <div style="display:flex;gap:6px">
        <a href="/api/ical/${S.currentUser}" download class="btn-s" style="font-size:12px;text-decoration:none;padding:6px 10px">&#128197; iCal</a>
        <button class="btn-p" onclick="openEvtModal()">&#65291; Eintrag</button>
      </div></div>
    <div class="fbar" style="flex-wrap:wrap;gap:6px">
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S.year--;renderSBF();renderMain()">&lsaquo;</button><span class="yv">${S.year}</span><button class="yb" onclick="S.year++;renderSBF();renderMain()">&rsaquo;</button></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="mb ${S.month===null?'on':''}" onclick="S.month=null;renderMain()" style="padding:4px 8px;font-size:12px">Alle</button>
        ${MONTHS.map((m,i)=>`<button class="mb ${S.month===i?'on':''}" onclick="S.month=${i};renderMain()" style="padding:4px 8px;font-size:12px">${m.slice(0,3)}</button>`).join('')}
      </div>
      ${S.p.seeAllEntries?`<select class="flt" style="width:auto;min-width:140px" onchange="S.filterUser=this.value||null;renderMain()"><option value="">Alle Mitarbeiter</option>${S.users.filter(u=>!(u.roles||[]).includes('admin')).map(u=>`<option value="${u.id}"${S.filterUser===u.id?'selected':''}>${u.name}</option>`).join('')}</select>`:''}
      ${filterU?`<span class="filter-hint">&#128100; ${filterU.name}</span>`:''}
    </div>
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <h2 style="margin:0;font-size:15px">Eintr\u00e4ge (${evs.length}) <span style="font-size:13px;font-weight:400;color:var(--mu)">${ml} ${S.year}</span></h2>
      <input class="srch" type="text" placeholder="Suchen \u2026" oninput="filtSched(this.value)" style="margin-left:auto">
      <select class="flt" onchange="filtSched(undefined,this.value)" id="scFlt"><option value="">Alle Kategorien</option>${S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('')}</select>
      <select class="flt" onchange="_scApFilt=this.value;filtSched()"><option value="">Alle Status</option><option value="pending">\u23f3 Ausstehend</option><option value="approved">\u2713 Genehmigt</option><option value="rejected">\u2717 Abgelehnt</option></select>
    </div>
    <div id="scTb">${buildEvCards(evs)}</div>
    ${!evs.length?'<div class="empty">&#128235; Keine Eintr\u00e4ge</div>':''}`;
}
function buildEvCards(evs){
  if(!evs.length)return'';
  // Group by month when viewing "all", otherwise flat
  const grouped=S.month!==null?{null:evs}:(()=>{const g={};evs.forEach(ev=>{const d=new Date(ev.dateFrom);const k=d.getFullYear()+'-'+String(d.getMonth()).padStart(2,'0');if(!g[k])g[k]={month:d.getMonth(),year:d.getFullYear(),evs:[]};g[k].evs.push(ev);});return g;})();
  let html='';
  Object.values(grouped).forEach(grp=>{
    const items=S.month!==null?evs:grp.evs;
    if(S.month===null)html+=`<div style="font-size:12px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px">${MONTHS[grp.month]} ${grp.year}</div>`;
    html+=`<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">`;
    html+=items.map(ev=>{
      const anon=ev._anonymized||false;
      const cat=getCat(ev.category)||{label:'?',color:'#888',emoji:'&#128204;'};
      const emp=ev.isGeneral?null:anon?null:(getU(ev.userId)||{name:'?',color:'#888',initials:'?'});
      const ds=ev.dateTo&&ev.dateTo!==ev.dateFrom?`${fd(ev.dateFrom)} \u2013 ${fd(ev.dateTo)}`:fd(ev.dateFrom);
      const ts=ev.timeFrom?(ev.timeTo?`${ev.timeFrom}\u2013${ev.timeTo}`:ev.timeFrom):'\u2014';
      const accentColor=anon?'#94a3b8':cat.color||'var(--acc)';
      const canDel=(ev.isGeneral&&S.p.addGeneral)||ev._canEdit||S.p.canApproveEvents||S.p.manageUsers;
      const empChip=ev.isGeneral?`<span class="bdg" style="background:rgba(16,185,129,.12);color:var(--ok)">&#127760; Allgemein</span>`
        :anon?`<span class="bdg" style="background:var(--sf2);color:var(--di)">&#128274; Anonym</span>`
        :`<span>${avHtml(emp.initials,emp.color,16,7)}</span><span>${emp.name}</span>`;
      const catChip=anon?`<span style="color:var(--di)">\u2014</span>`:`<span class="bdg" style="background:${cat.color}1a;color:${cat.color}">${cat.emoji} ${cat.label}</span>`;
      const apActions=(!ev.isGeneral&&S.p.canApproveEvents&&!anon&&ev.approvalStatus!=='approved'&&ev.approvalStatus!=='rejected')?
        `<button class="btn-ok" onclick="approveEvt('${ev.id}','approved')">\u2713</button><button class="btn-d" onclick="approveEvt('${ev.id}','rejected')">\u2717</button>`:'';
      return`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border)${anon?';opacity:.7':''}">
        <div style="width:3px;align-self:stretch;background:${accentColor};border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">${anon?'<span style="color:var(--di);font-style:italic">Anonymisiert</span>':(ev.reason||'\u2014').slice(0,80)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
            <span>&#128197; ${ds}</span>${ts!=='\u2014'?`<span>&#128336; ${ts}</span>`:''}
            ${empChip}${catChip}
            ${ev.isGeneral?'':apBdg(ev.approvalStatus||'pending')}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">${apActions}${ev._canEdit?`<button class="btn-e" onclick="openEditEvt('${ev.id}')">\u270e</button>`:''}${canDel?`<button class="btn-d" onclick="deleteEvt('${ev.id}')">\u2715</button>`:''}</div>
      </div>`;
    }).join('');
    if(S.month===null)html+=`</div>`;
    else html+=`</div>`;
  });
  return html;
}
let _scApFilt='';
function filtSched(srch,cat){
  const tb=document.getElementById('scTb');if(!tb)return;
  const s=(srch!==undefined?srch:document.querySelector('#main .srch')?.value||'').toLowerCase();
  const c=cat!==undefined?cat:(document.getElementById('scFlt')?.value||'');
  let evs=getVisEvts();
  if(s)evs=evs.filter(ev=>{const un=getU(ev.userId)?.name.toLowerCase()||'';return(ev.reason||'').toLowerCase().includes(s)||un.includes(s);});
  if(c)evs=evs.filter(ev=>ev.category===c);
  if(_scApFilt)evs=evs.filter(ev=>(ev.approvalStatus||'pending')===_scApFilt);
  tb.innerHTML=buildEvCards(evs);
}
function openEvtModal(){
  document.getElementById('fEvId').value='';document.getElementById('evtOvT').textContent='Neuer Eintrag';
  const u=getU(S.currentUser);
  document.getElementById('genRow').style.display=S.p.addGeneral?'block':'none';
  document.getElementById('fGen').checked=false;document.getElementById('empRow').style.display='block';
  const empSel=document.getElementById('fEmp');empSel.innerHTML='';
  const addable=S.p.addForOthers?S.users:[u].filter(Boolean);
  addable.forEach(u2=>{const opt=document.createElement('option');opt.value=u2.id;opt.textContent=u2.name;empSel.appendChild(opt);});
  empSel.value=u?.id||'';
  document.getElementById('fCat').innerHTML='<option value="">\u2014 w\u00e4hlen \u2014</option>'+S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  ['fD1','fD2','fT1','fT2','fRsn'].forEach(id=>document.getElementById(id).value='');
  openModal('evtOv');
}
function openEditEvt(id){
  const ev=S.events.find(e=>e.id===id);if(!ev)return;
  document.getElementById('fEvId').value=id;document.getElementById('evtOvT').textContent='Eintrag bearbeiten';
  document.getElementById('genRow').style.display='none';document.getElementById('empRow').style.display='none';
  document.getElementById('fCat').innerHTML='<option value="">\u2014 w\u00e4hlen \u2014</option>'+S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  document.getElementById('fD1').value=ev.dateFrom;document.getElementById('fD2').value=ev.dateTo;
  document.getElementById('fT1').value=ev.timeFrom||'';document.getElementById('fT2').value=ev.timeTo||'';
  document.getElementById('fCat').value=ev.category||'';document.getElementById('fRsn').value=ev.reason||'';
  openModal('evtOv');
}
function onGenToggle(){document.getElementById('empRow').style.display=document.getElementById('fGen').checked?'none':'block';}
async function saveEvent(){
  const editId=document.getElementById('fEvId').value;
  const isGeneral=!editId&&document.getElementById('fGen').checked;
  const d1=document.getElementById('fD1').value,rsn=document.getElementById('fRsn').value.trim();
  if(!d1){toast('\u26A0\uFE0F Datum erforderlich!');return;}if(!rsn){toast('\u26A0\uFE0F Beschreibung erforderlich!');return;}
  const body={dateFrom:d1,dateTo:document.getElementById('fD2').value||d1,timeFrom:document.getElementById('fT1').value,timeTo:document.getElementById('fT2').value,category:document.getElementById('fCat').value,reason:rsn};
  try{
    if(editId)await api('PUT','/events/'+editId,body);
    else await api('POST','/events',{...body,isGeneral,userId:isGeneral?null:document.getElementById('fEmp').value});
    await fetchData();closeModal('evtOv');renderMain();toast(editId?'\u2705 Aktualisiert!':'\u2705 Gespeichert!');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function approveEvt(id,status){
  try{await api('PUT','/events/'+id+'/approval',{status});await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function deleteEvt(id){
  if(!confirm('Eintrag l\u00f6schen?'))return;
  try{await api('DELETE','/events/'+id);await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// ALLOWANCES
function getPeriodMonths(){if(S.allwPeriod==='month')return[S.allwMonth];if(S.allwPeriod==='h1')return[1,2,3,4,5,6];if(S.allwPeriod==='h2')return[7,8,9,10,11,12];return[1,2,3,4,5,6,7,8,9,10,11,12];}
function sumAllw(uid,year,months){return months.reduce((a,m)=>{const r=getAllw(uid,year,m);return{nd:a.nd+r.nd,fd:a.fd+r.fd,fw:a.fw+r.fw,c10:a.c10+r.c10};},{nd:0,fd:0,fw:0,c10:0});}
function numCell(n,color){if(!n)return`<td style="text-align:center;color:var(--di)">\u2013</td>`;return`<td style="text-align:center"><span class="anum" style="background:${color}18;color:${color}">${n}</span></td>`;}


function renderCalendar(){
  var yr=S.year, mo=S.month!==null?S.month:new Date().getMonth();
  var WDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var firstDay=new Date(yr,mo,1);
  var lastDay=new Date(yr,mo+1,0);
  var startOffset=(firstDay.getDay()+6)%7;
  var rows=Math.max(6,Math.ceil((startOffset+lastDay.getDate())/7));
  var today=new Date();

  // Group events by day
  var evByDate={};
  var visEvs=S.events.filter(function(ev){
    // Abgelehnte Einträge im Kalender nicht anzeigen
    if(!ev.isGeneral && ev.approvalStatus==='rejected') return false;
    var d=new Date(ev.dateFrom);
    return d.getFullYear()===yr && d.getMonth()===mo || (ev.dateTo && new Date(ev.dateTo)>=firstDay && d<=lastDay);
  });
  visEvs.forEach(function(ev){
    var from=new Date(ev.dateFrom), to=new Date(ev.dateTo||ev.dateFrom);
    for(var d=new Date(from);d<=to;d.setDate(d.getDate()+1)){
      if(d.getFullYear()===yr&&d.getMonth()===mo){
        var k=d.getDate(); if(!evByDate[k])evByDate[k]=[]; evByDate[k].push(ev);
      }
    }
  });

  var cells='';
  var dayNum=1;
  for(var r=0;r<rows;r++){
    cells+='<tr>';
    for(var c=0;c<7;c++){
      var ci=r*7+c;
      if(ci<startOffset||dayNum>lastDay.getDate()){
        cells+='<td class="cal-empty"></td>';
      } else {
        var evs=evByDate[dayNum]||[];
        var isToday=today.getFullYear()===yr&&today.getMonth()===mo&&today.getDate()===dayNum;
        var cls='cal-day'+(isToday?' cal-today':'')+(c>=5?' cal-we':'');
        var dnHtml=isToday?'<div class="cal-daynum cal-daynum-today">'+dayNum+'</div>':'<div class="cal-daynum">'+dayNum+'</div>';
        var evsHtml='';
        evs.slice(0,4).forEach(function(ev){
          if(ev._anonymized){evsHtml+='<div class="cal-ev cal-ev-anon">&#128274;</div>';return;}
          var cat=S.categories.find(function(c2){return c2.id===ev.category;});
          var u=ev.isGeneral?null:S.users.find(function(u2){return u2.id===ev.userId;});
          var color=ev.isGeneral?'#10b981':cat?cat.color:'#3b6dd4';
          var label=(ev.isGeneral?'\uD83C\uDF10 ':u?u.initials+' ':'')+ev.reason.slice(0,20);
          evsHtml+='<div class="cal-ev" style="background:'+color+'22;border-left:2px solid '+color+';color:'+color+'" title="'+ev.reason.replace(/"/g,'&quot;')+'">'+label+'</div>';
        });
        if(evs.length>4)evsHtml+='<div class="cal-ev-more">+' +(evs.length-4)+' weitere</div>';
        cells+='<td class="'+cls+'">'+dnHtml+'<div class="cal-evs">'+evsHtml+'</div></td>';
        dayNum++;
      }
    }
    cells+='</tr>';
  }

  var moNames=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var html='<div class="ph"><div class="pt">\uD83D\uDCC5 Kalenderansicht <span>'+moNames[mo]+' '+yr+'</span></div>';
  html+='<button class="btn-p" onclick="openEvtModal()">&#65291; Eintrag hinzufügen</button></div>';

  html+='<div class="tw"><table class="cal-table"><thead><tr>';
  WDAYS.forEach(function(d){html+='<th>'+d+'</th>';});
  html+='</tr></thead><tbody>'+cells+'</tbody></table></div>';
  document.getElementById('main').innerHTML=html;
}


// ══════════════════════════════════════════
// SECTION: Diensttausch
// ══════════════════════════════════════════
function renderDiensttausch() {
  const canDecide = S.p.canApproveEvents;
  const list = S.diensttausch;
  function dtCard(dt) {
    const isNew = !dt.isSeen && dt.isRelevant;
    const creator = getU(dt.createdBy);
    const decider = dt.decidedBy ? getU(dt.decidedBy) : null;
    const accent = dt.status==='approved'?'var(--ok)':dt.status==='rejected'?'var(--danger)':'var(--warn)';
    const stBadge = dt.status==='pending'
      ? '<span class="bdg ap-bdg-pending">&#8987; Ausstehend</span>'
      : dt.status==='approved'
      ? '<span class="bdg ap-bdg-approved">&#10003; Angenommen</span>'
      : '<span class="bdg ap-bdg-rejected">&#10007; Abgelehnt</span>';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-top:1px solid var(--border)${isNew?';background:rgba(245,158,11,.04)':''}" onclick="markDtSeen('${dt.id}')">
      <div style="width:3px;align-self:stretch;background:${accent};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">
          ${isNew?'<span class="tk-new-badge" style="margin-right:4px">NEU</span>':''}${creator?.name||'?'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);margin-bottom:6px">
          <span>${fdt(dt.createdAt)}</span>
          ${stBadge}
        </div>
        <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;color:var(--tx)">${highlightMentions(dt.text||'')}</div>
        ${dt.rejectReason?`<div style="margin-top:6px;font-size:11px;color:var(--danger);background:rgba(239,68,68,.08);padding:4px 8px;border-radius:4px">&#128680; Grund: ${dt.rejectReason}</div>`:''}
        ${dt.decidedAt?`<div style="font-size:10px;color:var(--mu);margin-top:4px">Entschieden von ${decider?.name||'?'} am ${fdt(dt.decidedAt)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0" onclick="event.stopPropagation()">
        ${canDecide&&dt.status==='pending'?`
          <button class="btn-ok" style="font-size:11px" onclick="decideDt('${dt.id}','approved')">&#10003; Annehmen</button>
          <button class="btn-d" style="font-size:11px" onclick="openDtReject('${dt.id}')">&#10007; Ablehnen</button>
        `:''}
        ${dt.createdBy===S.currentUser&&dt.status==='pending'?`
          <button class="btn-d" style="font-size:10px;padding:2px 6px" onclick="deleteDt('${dt.id}')">&#128465; L&ouml;schen</button>`:''}
      </div>
    </div>`;
  }
  document.getElementById('main').innerHTML = `
    <div class="ph"><div class="pt">&#128257; Diensttausch</div></div>
    <div class="tw" style="margin-bottom:14px">
      <div class="tt"><h2>Neuer Diensttausch</h2></div>
      <div style="padding:14px">
        <div style="margin-bottom:8px;font-size:12px;color:var(--mu)">Beschreibe den gewünschten Tausch. Mit @Name kannst du Kollegen markieren.</div>
        <div style="position:relative">
          <textarea id="dtText" rows="4" style="width:100%;box-sizing:border-box;resize:vertical;font-size:13px;border:1px solid var(--border);border-radius:var(--r);padding:8px;background:var(--sf);color:var(--tx)" placeholder="Tauschdetails angeben... (@Name für Kollegen markieren)" oninput="dtMentionInput(this)" onkeydown="dtMentionKey(event)"></textarea>
          <div id="dtMentionBox" style="display:none;position:absolute;bottom:100%;left:0;background:var(--sf);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sh);z-index:100;min-width:180px;max-height:180px;overflow-y:auto;margin-bottom:2px"></div>
        </div>
        <button class="btn-p" style="margin-top:8px" onclick="createDt()">&#128257; Eintragen</button>
      </div>
    </div>
    ${list.length?`<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--mu)">Alle Einträge (${list.length})</div>
      ${list.map(dtCard).join('')}
    </div>`:'<div class="empty">Noch keine Diensttausch-Einträge</div>'}`;
}
async function createDt() {
  const text = document.getElementById('dtText')?.value?.trim();
  if (!text) { toast('&#9888;&#65039; Bitte Text eingeben!'); return; }
  try {
    await api('POST','/diensttausch',{text});
    await fetchData(); renderDiensttausch();
    toast('&#10003; Diensttausch eingetragen!');
  } catch(e) { toast('&#9888;&#65039; '+e.message,'err'); }
}

async function decideDt(id, decision, reason) {
  try {
    await api('PUT','/diensttausch/'+id+'/decide',{decision,rejectReason:reason||null});
    // Mark as seen for decider
    await api('PUT','/diensttausch/'+id+'/view').catch(()=>{});
    const dt = S.diensttausch.find(d=>d.id===id);
    if(dt){ dt.status=decision; dt.isSeen=true; }
    await fetchData(); renderDiensttausch(); updateBadges();
    toast(decision==='approved'?'&#10003; Angenommen!':'&#10007; Abgelehnt.');
  } catch(e) { toast('&#9888;&#65039; '+e.message,'err'); }
}

function openDtReject(id) {
  const reason = prompt('Ablehnungsgrund eingeben:');
  if (reason === null) return; // cancelled
  decideDt(id, 'rejected', reason.trim());
}

async function markDtSeen(id) {
  const dt = S.diensttausch.find(d=>d.id===id);
  if (!dt || dt.isSeen) return;
  dt.isSeen = true; // optimistisch lokal setzen
  try {
    await api('PUT','/diensttausch/'+id+'/view');
  } catch(e) {
    dt.isSeen = false; // bei Fehler zurücksetzen
    toast('&#9888;&#65039; Markieren fehlgeschlagen: '+e.message,'err');
    return;
  }
  updateBadges();
  if(S.view==='diensttausch') renderDiensttausch();
  if(S.view==='home') renderHome();
}

async function deleteDt(id) {
  if (!confirm('Diensttausch-Eintrag löschen?')) return;
  try {
    await api('DELETE','/diensttausch/'+id);
    await fetchData(); renderDiensttausch(); toast('&#128465; Gelöscht.');
  } catch(e) { toast('&#9888;&#65039; '+e.message,'err'); }
}


function renderAllw(){
  const months=getPeriodMonths(),yr=S.allwYear;
  const pLbl=S.allwPeriod==='month'?MONTHS[S.allwMonth-1]:S.allwPeriod==='h1'?'1. Halbjahr':S.allwPeriod==='h2'?'2. Halbjahr':'Gesamtjahr';
  const showUsers=S.p.editAllw?S.users.filter(u=>!(u.roles||[]).includes('admin')):[getU(S.currentUser)].filter(Boolean);
  const isBulk=S.p.editAllw&&S.allwPeriod==='month';
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Zulagendienste <span>${pLbl} ${yr}</span></div>
      ${isBulk?`<button class="btn-p" onclick="saveAllBulk()">&#128190; Alle speichern</button>`:''}
    </div>
    <div class="fbar" style="flex-wrap:wrap;gap:6px;align-items:center">
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S.allwYear--;renderMain()">&lsaquo;</button><span class="yv">${yr}</span><button class="yb" onclick="S.allwYear++;renderMain()">&rsaquo;</button></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${['month','h1','h2','year'].map(p2=>`<button class="mb ${S.allwPeriod===p2?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.allwPeriod='${p2}';renderMain()">${p2==='month'?'Monatlich':p2==='h1'?'1. Hj.':p2==='h2'?'2. Hj.':'Gesamt'}</button>`).join('')}
      </div>
      ${S.allwPeriod==='month'?`<div style="display:flex;gap:4px;flex-wrap:wrap">${MONTHS.map((m,i)=>`<button class="mb ${S.allwMonth===i+1?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.allwMonth=${i+1};renderMain()">${m.slice(0,3)}</button>`).join('')}</div>`:''}
    </div>
    ${!S.p.editAllw?`<div class="ib3" style="margin-bottom:12px">&#8505;&#65039; Nur Lesezugriff &ndash; Eintr&#228;ge k&#246;nnen nur von Dienstplanung/Leitung/Admin bearbeitet werden.</div>`:''}
    <div class="tw"><div class="tt"><h2>\u00dcbersicht</h2></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Mitarbeiter</th>
        <th style="text-align:center">&#127769; Nacht</th><th style="text-align:center">&#127881; Feiertag</th>
        <th style="text-align:center">&#127958;&#65039; WE</th><th style="text-align:center">&#128203; C10</th>
        ${isBulk?'<th></th>':''}
      </tr></thead>
      <tbody>${showUsers.map(u=>{
        if(isBulk){const a=getAllw(u.id,yr,S.allwMonth);return`<tr>
          <td><div style="display:flex;align-items:center;gap:6px">${avHtml(u.initials,u.color,22,9)}<span>${u.name}</span></div></td>
          <td style="text-align:center"><input type="number" min="0" class="bulk-nd" data-uid="${u.id}" value="${a.nd||0}" style="width:60px;text-align:center;font-size:12px;padding:4px"></td>
          <td style="text-align:center"><input type="number" min="0" class="bulk-fd" data-uid="${u.id}" value="${a.fd||0}" style="width:60px;text-align:center;font-size:12px;padding:4px"></td>
          <td style="text-align:center"><input type="number" min="0" class="bulk-fw" data-uid="${u.id}" value="${a.fw||0}" style="width:60px;text-align:center;font-size:12px;padding:4px"></td>
          <td style="text-align:center"><input type="number" min="0" class="bulk-c10" data-uid="${u.id}" value="${a.c10||0}" style="width:60px;text-align:center;font-size:12px;padding:4px"></td>
          <td></td>
        </tr>`;}
        const sv=sumAllw(u.id,yr,months);
        return`<tr><td><div style="display:flex;align-items:center;gap:6px">${avHtml(u.initials,u.color,22,9)}<span>${u.name}</span></div></td>${numCell(sv.nd,'#3b6dd4')}${numCell(sv.fd,'#10b981')}${numCell(sv.fw,'#f59e0b')}${numCell(sv.c10,'#7c3aed')}</tr>`;
      }).join('')}
      ${(()=>{
        // Durchschnitt nur für Dienstplanung (seeAllAllw) bei mehr als 1 User
        if(!S.p.seeAllAllw||showUsers.length<2)return '';
        const n=showUsers.length;
        const tot=showUsers.reduce((a,u)=>{const sv=sumAllw(u.id,yr,months);return{nd:a.nd+sv.nd,fd:a.fd+sv.fd,fw:a.fw+sv.fw,c10:a.c10+sv.c10};},{nd:0,fd:0,fw:0,c10:0});
        const div=S.allwPeriod==='month'?1:S.allwPeriod==='h1'||S.allwPeriod==='h2'?6:12;
        const avg={nd:tot.nd/n,fd:tot.fd/n,fw:tot.fw/n,c10:tot.c10/n};
        const fmt=v=>(v%1===0?v:v.toFixed(1));
        return`<tr style="background:rgba(59,109,212,.06);font-weight:700;border-top:2px solid var(--border)">
          <td style="font-size:11px;color:var(--mu)">&#216; Durchschnitt pro MA</td>
          <td style="text-align:center;color:#3b6dd4">${fmt(avg.nd)}</td>
          <td style="text-align:center;color:#10b981">${fmt(avg.fd)}</td>
          <td style="text-align:center;color:#f59e0b">${fmt(avg.fw)}</td>
          <td style="text-align:center;color:#7c3aed">${fmt(avg.c10)}</td>
        </tr>
        <tr style="background:rgba(59,109,212,.03);border-bottom:2px solid var(--border)">
          <td style="font-size:11px;color:var(--di)">&#216; pro Monat (Periode)</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.nd/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.fd/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.fw/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.c10/div)}</td>
        </tr>`;
      })()}
      </tbody></table></div>
      ${isBulk?`<div style="padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end"><button class="btn-p" onclick="saveAllBulk()">&#128190; Alle speichern</button></div>`:''}
    </div>`;
}
async function saveAllBulk(){
  loading(true);
  try{
    const saves=[];
    document.querySelectorAll('.bulk-nd').forEach(inp=>{
      const uid=inp.dataset.uid;
      const nd=+inp.value||0,fd=+document.querySelector(`.bulk-fd[data-uid="${uid}"]`)?.value||0;
      const fw=+document.querySelector(`.bulk-fw[data-uid="${uid}"]`)?.value||0,c10=+document.querySelector(`.bulk-c10[data-uid="${uid}"]`)?.value||0;
      saves.push(api('PUT','/allowances',{userId:uid,year:S.allwYear,month:S.allwMonth,nd,fd,fw,c10}));
    });
    await Promise.all(saves);await fetchData();renderMain();toast('\u2705 Alle Zulagen gespeichert!');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}
}
function openAllwM(uid,year,month){
  const u=getU(uid),a=getAllw(uid,year,month);
  document.getElementById('allwT').textContent=`${u?.name} \u2013 ${MONTHS[month-1]} ${year}`;
  document.getElementById('allwInfo').textContent=`Zulagen f\u00fcr ${MONTHS[month-1]} ${year}`;
  ['aUid','aYr','aMo'].forEach((id,i)=>document.getElementById(id).value=[uid,year,month][i]);
  document.getElementById('aND').value=a.nd||'';document.getElementById('aFD').value=a.fd||'';
  document.getElementById('aFW').value=a.fw||'';document.getElementById('aC10').value=a.c10||'';
  openModal('allwOv');
}
async function saveAllw(){
  const uid=document.getElementById('aUid').value,year=+document.getElementById('aYr').value,month=+document.getElementById('aMo').value;
  try{await api('PUT','/allowances',{userId:uid,year,month,nd:+document.getElementById('aND').value||0,fd:+document.getElementById('aFD').value||0,fw:+document.getElementById('aFW').value||0,c10:+document.getElementById('aC10').value||0});
    await fetchData();closeModal('allwOv');renderMain();toast('\u2705 Gespeichert!');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// ABRECHNUNG
function renderAbrechnung(){
  const yr=S.abrYear,mo=S.abrMonth,myUid=S.currentUser;
  const months=mo?[mo]:Array.from({length:12},(_,i)=>i+1);
  const moLabel=mo?MONTHS[mo-1]:'Ganzes Jahr';
  const canSeeAll=S.p.seeAllAbrechnung;
  const myEinsp=S.abrechnung.einspringer.filter(e=>e.userId===myUid&&(()=>{const d=new Date(e.date);return d.getFullYear()===yr&&(mo?d.getMonth()+1===mo:true);})()).sort((a,b)=>a.date.localeCompare(b.date));
  const allEinsp=canSeeAll?S.abrechnung.einspringer.filter(e=>{const d=new Date(e.date);return d.getFullYear()===yr&&(mo?d.getMonth()+1===mo:true)&&(!S.abrUser||e.userId===S.abrUser);}).sort((a,b)=>{const na=getU(a.userId)?.name||'',nb=getU(b.userId)?.name||'';return na.localeCompare(nb,'de')||a.date.localeCompare(b.date);}):[];
  const allHO=S.abrechnung.homeoffice.filter(h2=>h2.year===yr&&(mo?h2.month===mo:true)&&(!S.abrUser||h2.userId===S.abrUser)&&(canSeeAll||h2.userId===myUid)).sort((a,b)=>{const na=getU(a.userId)?.name||'',nb=getU(b.userId)?.name||'';return na.localeCompare(nb,'de')||a.month-b.month;});
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Abrechnung <span>${moLabel} ${yr}</span></div></div>
    <div class="fbar" style="flex-wrap:wrap;gap:6px;align-items:center">
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S.abrYear--;renderMain()">&lsaquo;</button><span class="yv">${yr}</span><button class="yb" onclick="S.abrYear++;renderMain()">&rsaquo;</button></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="mb ${!mo?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.abrMonth=null;renderMain()">Alle</button>
        ${MONTHS.map((m,i)=>`<button class="mb ${mo===i+1?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.abrMonth=${i+1};renderMain()">${m.slice(0,3)}</button>`).join('')}
      </div>
      ${canSeeAll?`<select class="flt" onchange="S.abrUser=this.value||null;renderMain()"><option value="">Alle Mitarbeiter</option>${S.users.filter(u=>!(u.roles||[]).includes('admin')).sort((a,b)=>a.name.localeCompare(b.name,'de')).map(u=>`<option value="${u.id}"${S.abrUser===u.id?'selected':''}>${u.name}</option>`).join('')}</select>`:''}
    </div>
    <div class="abr-grid">
      <div>
        <div class="tw" style="margin-bottom:14px">
          <div class="tt"><h2>&#128203; Meine Einspringerdienste</h2></div>
          <div style="padding:14px;display:flex;flex-direction:column;gap:12px">
            ${months.map(m=>{
              const mineMonth=myEinsp.filter(e=>new Date(e.date).getMonth()+1===m);
              const defDate=new Date(yr,m-1,15).toISOString().slice(0,10);
              return`<div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <span style="font-size:12px;font-weight:700;color:var(--mu)">${MONTHS[m-1]} ${yr}</span>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:11px;color:var(--di)">${mineMonth.length} Dienst${mineMonth.length!==1?'e':''}</span>
                    <button class="btn-p" style="padding:4px 10px;font-size:12px" onclick="addInlineEinsp(${m},${yr},'${defDate}')">&#65291;</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px">
                  ${mineMonth.map(e=>`<div style="padding:7px 10px;background:${e.rejectedBy?'rgba(239,68,68,0.06))':'var(--sf2)'};border:1px solid ${e.rejectedBy?'rgba(239,68,68,.25)':'var(--border)'};border-radius:6px">
                    <div style="display:flex;gap:6px;align-items:center">
                      <input type="date" value="${e.date}" onchange="updateEinsp('${e.id}','date',this.value)" style="width:130px;font-size:12px;flex:0 0 auto">
                      <input type="text" value="${(e.note||'').replace(/"/g,'&quot;')}" placeholder="Notiz" onchange="updateEinsp('${e.id}','note',this.value)" style="flex:1;font-size:12px">
                      <button class="btn-d" onclick="deleteEinspringer('${e.id}')" style="padding:5px 7px">\u2715</button>
                    </div>
                    ${e.rejectedBy?`<div style="margin-top:5px;font-size:11px;color:var(--danger);font-weight:600">\u2717 Abgelehnt: ${e.rejectedReason||''}</div>`:''}
                  </div>`).join('')}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        ${canSeeAll?`<div class="tw">
          <div class="tt"><h2>&#128203; Alle Einspringerdienste (${allEinsp.length})</h2></div>
          ${allEinsp.length?`<div>${allEinsp.map(e=>{const u=getU(e.userId);const rej=!!e.rejectedBy;return`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border)${rej?';opacity:.75':''}">
              <div style="width:3px;align-self:stretch;background:${rej?'var(--danger)':'var(--ok)'};border-radius:2px;flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                  ${avHtml(u?.initials||'?',u?.color||'#888',18,7)}<span style="font-size:13px;font-weight:600">${u?.name||'?'}</span>
                  ${rej?`<span class="bdg pr-high" style="font-size:10px" title="${e.rejectedReason||''}">\u2717 Abgelehnt</span>`:'<span class="bdg ap-bdg-approved" style="font-size:10px">\u2713</span>'}
                </div>
                <div style="font-size:11px;color:var(--mu)">${fd(e.date)}${e.note?' &middot; '+e.note:''}</div>
                ${rej&&e.rejectedReason?`<div style="font-size:11px;color:var(--danger);margin-top:2px">Grund: ${e.rejectedReason}</div>`:''}
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                ${!rej?`<button class="btn-warn" onclick="openRejectEinsp('${e.id}')" style="font-size:10px;padding:3px 7px">Ablehnen</button>`:''}
                ${rej?`<button class="btn-ok" onclick="undoRejectEinsp('${e.id}')" style="font-size:10px;padding:3px 7px">R\u00fccksetzen</button>`:''}
              </div>
            </div>`;}).join('')}</div>`:`<div class="empty">Keine Einspringerdienste</div>`}
        </div>`:``}
      </div>
      <div>
        <div class="tw" style="margin-bottom:14px">
          <div class="tt"><h2>&#127968; Home Office</h2></div>
          <div style="padding:14px">
            <p style="font-size:12px;color:var(--mu);margin-bottom:12px">Tage pro Monat (eigene Eintr\u00e4ge):</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${months.map(m=>{const ex=S.abrechnung.homeoffice.find(h=>h.userId===myUid&&h.year===yr&&h.month===m);
                return`<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--sf2);border:1px solid var(--border);border-radius:6px">
                  <span style="font-size:11px;color:var(--mu);flex:1">${MONTHS[m-1].slice(0,3)}</span>
                  <input type="number" min="0" max="31" value="${ex?.days||0}" style="width:50px;font-size:12px;padding:3px 5px;text-align:center" onchange="saveHO(${yr},${m},this.value)">
                  <span style="font-size:10px;color:var(--di)">Tage</span>
                </div>`;}).join('')}
            </div>
          </div>
        </div>
        ${canSeeAll?`<div class="tw">
          <div class="tt"><h2>&#127968; HO \u00dcbersicht alle MA</h2></div>
          ${allHO.length?`<div>${allHO.map(h=>{const u=getU(h.userId);return`<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border)">
              <div style="width:3px;align-self:stretch;background:#0ea5e9;border-radius:2px;flex-shrink:0"></div>
              <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
                ${avHtml(u?.initials||'?',u?.color||'#888',18,7)}<span style="font-size:12px;font-weight:600">${u?.name||'?'}</span>
                <span style="font-size:11px;color:var(--mu)">${MONTHS[h.month-1].slice(0,3)} ${h.year}</span>
              </div>
              <span style="font-size:13px;font-weight:700;color:#0ea5e9">${h.days} Tage</span>
            </div>`;}).join('')}</div>`:`<div class="empty">Keine HO-Eintr\u00e4ge</div>`}
        </div>`:``}
      </div>
    </div>`;
}
async function addInlineEinsp(month,year,defDate){
  try{await api('POST','/abrechnung/einspringer',{date:defDate,note:''});await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function updateEinsp(id,field,value){
  try{await api('PUT','/abrechnung/einspringer/'+id,{[field]:value});const e=S.abrechnung.einspringer.find(x=>x.id===id);if(e){if(field==='date')e.date=value;else e.note=value;}}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function deleteEinspringer(id){
  if(!confirm('Einspringerdienst l\u00f6schen?'))return;
  try{await api('DELETE','/abrechnung/einspringer/'+id);await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function saveHO(year,month,days){
  try{await api('PUT','/abrechnung/homeoffice',{year,month,days:parseInt(days)||0});await fetchData();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
function openRejectEinsp(id){document.getElementById('rejEinspId').value=id;document.getElementById('rejReason').value='';document.getElementById('rejErr').textContent='';openModal('rejectEinspOv');}
async function submitRejectEinsp(){
  const id=document.getElementById('rejEinspId').value,reason=document.getElementById('rejReason').value.trim();
  const errEl=document.getElementById('rejErr');
  if(!reason){errEl.textContent='\u26A0\uFE0F Begr\u00fcndung erforderlich!';return;}
  loading(true);
  try{await api('PUT','/abrechnung/einspringer/'+id+'/reject',{reason});await fetchData();closeModal('rejectEinspOv');renderMain();toast('\u2705 Abgelehnt.');}
  catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}
}
async function undoRejectEinsp(id){
  try{await api('PUT','/abrechnung/einspringer/'+id+'/reject',{undo:true});await fetchData();renderMain();toast('\u2705 Ablehnung zur\u00fcckgesetzt.');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// DIENSTPLAENE

function showPdf(url, title) {
  var panel = document.getElementById('pdfPanel');
  var iframe = document.getElementById('pdfIframe');
  var titleEl = document.getElementById('pdfPanelTitle');
  if (!panel) return;
  if (panel.style.display === 'flex' && iframe.src.includes(url.split('/').pop())) {
    closePdf(); return; // toggle
  }
  if (titleEl) titleEl.textContent = '\uD83D\uDCC4 ' + (title || 'Dienstplan');
  iframe.src = url;
  panel.style.display = 'flex';
  // Add bottom padding to main so content isn't hidden
  var main = document.getElementById('main');
  if (main) main.style.paddingBottom = '62vh';
}
function closePdf() {
  var panel = document.getElementById('pdfPanel');
  var iframe = document.getElementById('pdfIframe');
  if (panel) panel.style.display = 'none';
  if (iframe) iframe.src = '';
  var main = document.getElementById('main');
  if (main) main.style.paddingBottom = '';
}

function renderDienstplaene(){
  const active=S.dienstplaene.filter(d=>!d.isArchived).sort((a,b)=>a.year!==b.year?b.year-a.year:b.month-a.month);
  const archived=S.dienstplaene.filter(d=>d.isArchived).sort((a,b)=>a.year!==b.year?b.year-a.year:b.month-a.month);
  const canUp=S.p.addGeneral;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128196; Dienstpl\u00e4ne</div>${canUp?`<button class="btn-p" onclick="openDpUpload()">&#128228; PDF hochladen</button>`:''}</div>
    <div class="tw" style="margin-bottom:14px">
      <div class="tt"><h2>&#128196; Aktuelle Pl\u00e4ne (${active.length})</h2></div>
      ${active.length?`<div>${active.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border)">
          <div style="width:3px;align-self:stretch;background:var(--acc);border-radius:2px;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${MONTHS[d.month-1]} ${d.year} <span class="bdg st-open" style="margin-left:4px;font-size:10px">v${d.version}</span></div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${d.label} &middot; ${fdt(d.createdAt)} &middot; ${getU(d.createdBy)?.name||'?'}</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            <button class="btn-ok" style="font-size:11px;padding:4px 8px" onclick="showPdf('/api/dienstplaene/${d.id}/file','${MONTHS[d.month-1]} ${d.year}')">&#128065; &#214;ffnen</button>
            ${canUp?`<button class="btn-d" onclick="deleteDp('${d.id}')" style="padding:4px 8px">\u2715</button>`:''}
          </div>
        </div>`).join('')}</div>`:`<div class="empty">Noch keine Dienstpl\u00e4ne hochgeladen</div>`}
    </div>
    ${archived.length?`<div class="tw">
      <div class="tt" style="cursor:pointer" onclick="toggleArchiv()"><h2>&#128230; Archiv (${archived.length})</h2><span id="archivBtn" style="font-size:11px;color:var(--mu)">Einblenden</span></div>
      <div id="archivContent" style="display:none">${archived.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border);opacity:.75">
          <div style="width:3px;align-self:stretch;background:var(--di);border-radius:2px;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${MONTHS[d.month-1]} ${d.year} <span class="bdg st-on_hold" style="margin-left:4px;font-size:10px">v${d.version}</span></div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">Archiviert: ${fdt(d.archivedAt)}</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            <button class="btn-s" style="font-size:11px;padding:4px 8px" onclick="showPdf('/api/dienstplaene/${d.id}/file','${MONTHS[d.month-1]} ${d.year}')">&#128065;</button>
            ${canUp?`<button class="btn-d" onclick="deleteDp('${d.id}')" style="padding:4px 8px;font-size:10px">\u2715</button>`:''}
          </div>
        </div>`).join('')}</div>
    </div>`:``}`;
}
function toggleArchiv(){const c=document.getElementById('archivContent'),b=document.getElementById('archivBtn');if(!c)return;const s=c.style.display==='none';c.style.display=s?'block':'none';if(b)b.textContent=s?'Ausblenden':'Einblenden';}
function openDpUpload(){
  document.getElementById('dpMonth').value=new Date().getMonth()+1;
  document.getElementById('dpYear').value=new Date().getFullYear();
  document.getElementById('dpLabel').value='';document.getElementById('dpFile').value='';
  document.getElementById('dpErr').textContent='';document.getElementById('dpFileName').textContent='Keine Datei ausgew\u00e4hlt';
  openModal('dpOv');
}
async function uploadDienstplan(){
  const month=+document.getElementById('dpMonth').value,year=+document.getElementById('dpYear').value;
  const label=document.getElementById('dpLabel').value.trim(),fileInput=document.getElementById('dpFile');
  const errEl=document.getElementById('dpErr');errEl.textContent='';
  if(!month||!year||!label){errEl.textContent='\u26A0\uFE0F Alle Felder ausf\u00fcllen!';return;}
  if(!fileInput.files.length){errEl.textContent='\u26A0\uFE0F Bitte PDF ausw\u00e4hlen!';return;}
  const file=fileInput.files[0];
  if(file.size>15*1024*1024){errEl.textContent='\u26A0\uFE0F Datei zu gro\u00df (max. 15 MB)!';return;}
  loading(true);
  try{
    const fileData=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Lesefehler'));r.readAsDataURL(file);});
    const result=await api('POST','/dienstplaene',{month,year,label,filename:file.name,fileData});
    await fetchData();closeModal('dpOv');renderDienstplaene();
    toast(`\u2705 Dienstplan v${result.version} hochgeladen!${result.version>1?' Vorherige Version archiviert.':''}`);
  }catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}
}
async function deleteDp(id){
  if(!confirm('Dienstplan-Eintrag l\u00f6schen?'))return;
  loading(true);try{await api('DELETE','/dienstplaene/'+id);await fetchData();renderDienstplaene();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}
}
// TICKETS
function getVisTks(closed=false){
  return S.tickets.filter(tk=>{
    if(closed!=(tk.status==='closed'))return false;
    if(S.tkFiltDept&&tk.department!==S.tkFiltDept)return false;
    if(S.tkFiltPrio&&tk.priority!==S.tkFiltPrio)return false;
    if(S.tkFiltTag&&!tk.tags.includes(S.tkFiltTag))return false;
    if(S.tkFiltAssignee&&tk.assigneeId!==S.tkFiltAssignee)return false;
    if(S.tkFiltStatus&&tk.status!==S.tkFiltStatus)return false;
    if(S.tkSearch){const s=S.tkSearch.toLowerCase();if(!tk.title.toLowerCase().includes(s)&&!tk.number.toLowerCase().includes(s))return false;}
    return true;
  }).sort((a,b)=>{const po={high:0,medium:1,low:2};return(po[a.priority]||1)-(po[b.priority]||1)||b.createdAt.localeCompare(a.createdAt);});
}

function tkIsNew(tk) {
  // Neu oder geändert wenn noch nicht angesehen, oder updatedAt nach letztem Ansehen
  if (!tk.lastViewedAt) return true;
  const viewed = new Date(tk.lastViewedAt);
  const updated = new Date(tk.updatedAt || tk.createdAt);
  return updated > viewed;
}

function getTkViewPref(){try{return localStorage.getItem('tkViewPref')||'cards';}catch(e){return'cards';}}
function saveTkViewPref(v){try{localStorage.setItem('tkViewPref',v);}catch(e){}if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();}

function renderTickets(){
  const closed=S.view==='tickets_closed';const tks=getVisTks(closed);
  const myD=S.tp.seeAll?DEPTS:S.tp.myDepts;
  const useTable=getTkViewPref()==='table';
  // Sort: parent tickets first, then children directly below their parent
  const parents=tks.filter(t=>!t.parentTicketId);
  const children=tks.filter(t=>t.parentTicketId);
  const sorted=[];
  parents.forEach(p=>{sorted.push(p);children.filter(c=>c.parentTicketId===p.id).forEach(c=>sorted.push(c));});
  children.filter(c=>!parents.find(p=>p.id===c.parentTicketId)).forEach(c=>sorted.push(c));
  const _tkPrioColor={high:'#ef4444',medium:'#f59e0b',low:'#94a3b8',urgent:'#7c3aed'};
  let listHtml;
  if(useTable){
    listHtml=sorted.length?`<div class="tw" style="overflow-x:auto"><table><thead><tr><th>#</th><th>Titel</th><th>Bereich</th><th>Prio</th><th>Status</th><th>Tags</th><th>Zust\u00e4ndig</th><th>Datum</th></tr></thead><tbody>
      ${sorted.map(tk=>{
        const asn=getU(tk.assigneeId);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
        const nc=tk.notes.filter(n=>n.noteType==='note').length;
        const isChild=!!tk.parentTicketId;const isNew=tkIsNew(tk);
        return`<tr class="clickable${isChild?' tk-child-row':''}${isNew?' tk-new-row':''}" onclick="openTkDetail('${tk.id}')">
          <td style="font-family:monospace;font-size:11px;color:var(--mu);white-space:nowrap${isChild?';padding-left:28px':''}">
            ${isChild?'<span style="color:var(--di);margin-right:3px">\u21b3</span>':''}${tk.number}${isNew?'<span class="tk-new-badge">NEU</span>':''}
          </td>
          <td style="max-width:220px"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tk.title}</div>${nc?`<span style="font-size:10px;color:var(--mu)">\ud83d\udcac ${nc}</span>`:''}</td>
          <td>${deptBdg(tk.department)}</td>
          <td>${prioBdg(tk.priority)}</td>
          <td>${stBdg(tk.status)}</td>
          <td style="max-width:140px">${tagChips(tk.tags)}${dueBdg(tk)}</td>
          <td style="font-size:12px">${asn?`<div style="display:flex;align-items:center;gap:3px">${avHtml(asn.initials,asn.color,16,7)}<span>${asn.name}</span></div>`:'-'}</td>
          <td style="font-size:11px;color:var(--mu);white-space:nowrap">${fd(tk.createdAt)}</td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`:`<div class="empty">&#128235; Keine Tickets</div>`;
  } else {
    listHtml=sorted.length?`<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">${sorted.map(tk=>{
      const asn=getU(tk.assigneeId);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
      const nc=tk.notes.filter(n=>n.noteType==='note').length;
      const isChild=!!tk.parentTicketId;const isNew=tkIsNew(tk);
      const accent=_tkPrioColor[tk.priority]||'#94a3b8';
      const childStyle=isChild?'margin-left:20px;border-left:2px solid var(--border);background:var(--sf2);':'';
      const isSel=S.tkBatchSel.has(tk.id);
      return`<div style="display:flex;align-items:center;gap:10px;padding:${isChild?'7px 12px 7px 10px':'10px 14px'};border-top:1px solid var(--border);${childStyle}${isSel?'background:rgba(59,109,212,.07);':isNew?'background:rgba(245,158,11,.04);':''}" onclick="${S.tkBatchMode?`batchToggleTk('${tk.id}')`:''}" class="${S.tkBatchMode?'clickable':'clickable'}" ${S.tkBatchMode?'':''}>
        ${S.tkBatchMode?`<input type="checkbox" ${isSel?'checked':''} onclick="event.stopPropagation();batchToggleTk('${tk.id}')" style="width:16px;height:16px;flex-shrink:0;cursor:pointer">`:''}
        ${isChild?`<span style="font-size:14px;color:var(--di);flex-shrink:0;margin-right:-4px">&#x21b3;</span>`:''}
        <div style="width:3px;align-self:stretch;background:${accent};border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0" ${S.tkBatchMode?'':''} onclick="${S.tkBatchMode?'':'openTkDetail(\''+tk.id+'\')'}">
          <div style="font-size:${isChild?'12px':'13px'};font-weight:600;color:var(--tx);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${isNew?'<span class="tk-new-badge">NEU</span> ':''}<span style="font-family:monospace;font-size:11px;color:var(--mu)">${tk.number}</span> ${tk.title}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
            ${deptBdg(tk.department)}${prioBdg(tk.priority)}${stBdg(tk.status)}${dueBdg(tk)}${snoozeBdg(tk)}
            ${tagChips(tk.tags)}
            ${asn?`<div style="display:flex;align-items:center;gap:3px">${avHtml(asn.initials,asn.color,14,6)}<span>${asn.name}</span></div>`:''}
            ${isChild&&par?`<span style="color:var(--di);font-size:10px">&#x2191; ${par.number}</span>`:''}
            ${nc?`<span>&#128172; ${nc}</span>`:''}
            <span style="color:var(--di)">${fd(tk.createdAt)}</span>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`:`<div class="empty">&#128235; Keine Tickets</div>`;
  }
  // Group by department
  const deptOrder=[...new Set(sorted.map(t=>t.department))].sort((a,b)=>(DEPT_LABELS[a]||a).localeCompare(DEPT_LABELS[b]||b,'de'));
  let groupedHtml='';
  if(useTable){
    groupedHtml=listHtml;
  } else if(!S.tkFiltDept&&deptOrder.length>1){
    deptOrder.forEach(dept=>{
      const dtks=sorted.filter(t=>t.department===dept);
      if(!dtks.length)return;
      groupedHtml+=`<div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mu);letter-spacing:.5px;padding:6px 2px;margin-bottom:4px">${deptBdg(dept)} ${DEPT_LABELS[dept]||dept} <span style="font-weight:400;color:var(--di)">(${dtks.length})</span></div>
        <div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${dtks.map(tk=>{
          const asn=getU(tk.assigneeId);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
          const nc=tk.notes.filter(n=>n.noteType==='note').length;
          const isChild=!!tk.parentTicketId;const isNew=tkIsNew(tk);
          const accent=_tkPrioColor[tk.priority]||'#94a3b8';
          const childStyle=isChild?'margin-left:20px;border-left:2px solid var(--border);background:var(--sf2);':'';
          const isSel2=S.tkBatchSel.has(tk.id);
          return`<div style="display:flex;align-items:center;gap:10px;padding:${isChild?'7px 12px 7px 10px':'10px 14px'};border-top:1px solid var(--border);${childStyle}${isSel2?'background:rgba(59,109,212,.07);':isNew?'background:rgba(245,158,11,.04);':''}" onclick="${S.tkBatchMode?`batchToggleTk('${tk.id}')`:''}" class="clickable">
            ${S.tkBatchMode?`<input type="checkbox" ${isSel2?'checked':''} onclick="event.stopPropagation();batchToggleTk('${tk.id}')" style="width:16px;height:16px;flex-shrink:0;cursor:pointer">`:''}
            ${isChild?`<span style="font-size:14px;color:var(--di);flex-shrink:0;margin-right:-4px">&#x21b3;</span>`:''}
            <div style="width:3px;align-self:stretch;background:${accent};border-radius:2px;flex-shrink:0"></div>
            <div style="flex:1;min-width:0" onclick="${S.tkBatchMode?'':'openTkDetail(\''+tk.id+'\')'}">
              <div style="font-size:${isChild?'12px':'13px'};font-weight:600;color:var(--tx);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${isNew?'<span class="tk-new-badge">NEU</span> ':''}<span style="font-family:monospace;font-size:11px;color:var(--mu)">${tk.number}</span> ${tk.title}${tk.subcategory?` <span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:#7c3aed">${tk.subcategory}</span>`:''}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
                ${prioBdg(tk.priority)}${stBdg(tk.status)}${dueBdg(tk)}${snoozeBdg(tk)}${tagChips(tk.tags)}
                ${asn?`<div style="display:flex;align-items:center;gap:3px">${avHtml(asn.initials,asn.color,14,6)}<span>${asn.name}</span></div>`:''}
                ${isChild&&par?`<span style="color:var(--di);font-size:10px">&#x2191; ${par.number}</span>`:''}
                ${nc?`<span>\ud83d\udcac ${nc}</span>`:''}
                <span style="color:var(--di)">${fd(tk.createdAt)}</span>
              </div>
            </div>
          </div>`;
        }).join('')}</div>
      </div>`;
    });
    if(!groupedHtml)groupedHtml='<div class="empty">\ud83d\udceb Keine Tickets</div>';
  } else {
    groupedHtml=listHtml;
  }
  const viewIcon=useTable?'\u229e':'\u2261';
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">${closed?'Abgeschlossene':'Offene'} Tickets <span style="font-size:16px;color:var(--mu)">(${tks.length})</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn-s" title="${useTable?'Card-Ansicht':'Tabellen-Ansicht'}" onclick="saveTkViewPref('${useTable?'cards':'table'}')" style="font-size:16px;padding:4px 10px">${viewIcon}</button>
        <button class="btn-s${S.tkBatchMode?' on':''}" onclick="toggleTkBatch()" title="Mehrfachauswahl" style="font-size:13px;padding:5px 10px">&#9745; Auswahl</button>
        <button class="btn-p" onclick="openTkForm(null)">&#65291; Ticket</button>
      </div></div>
    ${S.tkBatchMode&&S.tkBatchSel.size?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:rgba(59,109,212,.06);border:1px solid rgba(59,109,212,.2);border-radius:var(--r);margin-bottom:10px">
      <span style="font-size:13px;font-weight:600;color:var(--acc)">${S.tkBatchSel.size} ausgewählt</span>
      <select id="batchStatus" class="flt" style="font-size:12px"><option value="">Status ändern…</option>${STATUSES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select>
      <select id="batchAssignee" class="flt" style="font-size:12px"><option value="">Zuständig ändern…</option><option value="__none__">— niemand —</option>${S.users.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select>
      <button class="btn-p" style="font-size:12px" onclick="batchApply()">&#10003; Anwenden</button>
      <button class="btn-s" style="font-size:12px" onclick="S.tkBatchSel.clear();renderTickets()">Auswahl aufheben</button>
    </div>`:''}
    <div class="fbar" style="flex-wrap:wrap;gap:6px">
      <input class="srch" type="text" placeholder="Suchen \u2026" value="${S.tkSearch}" oninput="S.tkSearch=this.value;renderMain()" style="width:160px">
      <select class="flt" onchange="S.tkFiltStatus=this.value;renderMain()"><option value="">Alle Status</option>${STATUSES.filter(s=>closed?(s.id==='closed'):(s.id!=='closed')).map(s=>`<option value="${s.id}"${S.tkFiltStatus===s.id?' selected':''}>${s.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltDept=this.value;renderMain()"><option value="">Alle Bereiche</option>${myD.map(d=>`<option value="${d}"${S.tkFiltDept===d?' selected':''}>${DEPT_LABELS[d]}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltPrio=this.value;renderMain()"><option value="">Alle Priorit\u00e4ten</option>${PRIORITIES.map(p2=>`<option value="${p2.id}"${S.tkFiltPrio===p2.id?' selected':''}>${p2.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltTag=this.value;renderMain()"><option value="">Alle Tags</option>${S.tags.map(t=>`<option value="${t.id}"${S.tkFiltTag===t.id?' selected':''}>${t.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltAssignee=this.value;renderMain()"><option value="">Alle Bearbeiter</option>${S.users.map(u=>`<option value="${u.id}"${S.tkFiltAssignee===u.id?' selected':''}>${u.name}</option>`).join('')}</select>
    </div>
    ${groupedHtml}`;
}
function openTkDetail(id){
  S.currentTicketId=id;
  renderTkDetail();
  openModal('tkDetOv');
  // Sofort lokal als gesehen markieren + Server aktualisieren
  const tk=S.tickets.find(t=>t.id===id);
  if(tk){
    tk.lastViewedAt=new Date().toISOString();
    if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();
    if(S.view==='home')renderHome();
  }
  api('PUT','/tickets/'+id+'/view').catch(()=>{});
}
function highlightMentions(text){return text.replace(/@(\S+)/g,(match,name)=>{const u=S.users.find(u=>u.name.toLowerCase()===name.toLowerCase());return u?`<span class="mention">@${u.name}</span>`:match;});}
// ── Ticket Feed Renderer ──
const _AUDIT_ICONS={
  status:'🔄',priority:'⚡',department:'🏢',title:'✏️',bucket:'📦',
  visibility:'🔓',subcategory:'🏷️',due_date:'📅',snoozed_until:'💤',
  assignee:'👤',parent:'🔗',tags:'🏷️',note:'💬',created:'✅',closed:'🔒'
};
const _AUDIT_LABELS={
  status:'Status',priority:'Priorität',department:'Fachbereich',title:'Titel',
  bucket:'Bucket',visibility:'Sichtbarkeit',subcategory:'Unterkategorie',
  due_date:'Fälligkeit',snoozed_until:'Wiedervorlage',assignee:'Zuständig',
  parent:'Elternticket',tags:'Tags'
};
function _parseAudit(text){
  if(!text.startsWith('FIELD:'))return null;
  const [,field,from,to]=text.split(':');
  return{field,from,to};
}
function _renderFeed(notes,tkId,canEdit,filter){
  const filtered=notes.filter(n=>filter==='all'?true:filter==='audit'?n.noteType==='audit':n.noteType==='note');
  if(!filtered.length)return`<div style="color:var(--di);font-size:12px;padding:8px 0">Keine Einträge.</div>`;
  return filtered.map((n,i)=>{
    const a=getU(n.authorId);
    const isAudit=n.noteType==='audit';
    const parsed=isAudit?_parseAudit(n.text):null;
    const icon=parsed?(_AUDIT_ICONS[parsed.field]||'📝'):(isAudit?'⚙️':'💬');
    const label=parsed?_AUDIT_LABELS[parsed.field]||parsed.field:'';
    const isFirst=i===0;const isLast=i===filtered.length-1;
    if(isAudit){
      return`<div style="display:flex;gap:10px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--sf2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;z-index:1;flex-shrink:0">${icon}</div>
          ${!isLast?`<div style="width:2px;flex:1;background:var(--border);margin:2px 0;min-height:12px"></div>`:''}
        </div>
        <div style="padding:2px 0 ${isLast?'0':'10px'} 0;flex:1;min-width:0">
          ${parsed?`<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:var(--tx)">${label}</span>
            <span style="font-size:11px;color:var(--mu);text-decoration:line-through;word-break:break-word">${parsed.from}</span>
            <span style="font-size:11px;color:var(--mu)">→</span>
            <span style="font-size:12px;font-weight:600;color:var(--acc);word-break:break-word">${parsed.to}</span>
          </div>`:`<div style="font-size:12px;color:var(--mu)">${n.text}</div>`}
          <div style="font-size:10px;color:var(--di);margin-top:2px">
            ${a?`${avHtml(a.initials,a.color,12,5)} ${a.name} · `:''}${fdt(n.createdAt)}
          </div>
        </div>
      </div>`;
    } else {
      return`<div style="display:flex;gap:10px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;z-index:1;overflow:hidden;border:2px solid var(--border)">${a?avHtml(a.initials,a.color,24,10):`<div style="width:28px;height:28px;background:var(--sf2);display:flex;align-items:center;justify-content:center;font-size:14px">💬</div>`}</div>
          ${!isLast?`<div style="width:2px;flex:1;background:var(--border);margin:2px 0;min-height:12px"></div>`:''}
        </div>
        <div style="background:var(--sf);border:1px solid var(--border);border-radius:8px;padding:9px 12px;flex:1;min-width:0;margin-bottom:${isLast?'0':'10px'}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-size:12px;font-weight:700">${a?.name||'?'}</span>
            <span style="font-size:10px;color:var(--di)">${fdt(n.createdAt)}</span>
            ${canEdit&&n.authorId===S.currentUser?`<button class="btn-d" style="padding:1px 6px;font-size:10px;margin-left:auto" onclick="deleteNote('${tkId}','${n.id}')">✕</button>`:''}
          </div>
          <div style="font-size:13px;line-height:1.5">${highlightMentions(n.text)}</div>
        </div>
      </div>`;
    }
  }).join('');
}
function renderTkDetail(){
  const tk=getTk(S.currentTicketId);if(!tk)return;
  const canEdit=tk._canEdit;const bkt=BUCKETS.find(b=>b.id===tk.bucket);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
  const subs=S.tickets.filter(t=>t.parentTicketId===tk.id);
  document.getElementById('tkDetNum').textContent=tk.number;
  document.getElementById('tkDetTitle').textContent=tk.title;
  document.getElementById('tkDetPrio').innerHTML=prioBdg(tk.priority);
  document.getElementById('tkDetSt').innerHTML=stBdg(tk.status);
  document.getElementById('tkDetEditBtn').style.display=canEdit?'':'none';
  const notes=tk.notes||[];
  const tab=S._tkTab||'details';
  const tabBtn=(id,label)=>`<button onclick="S._tkTab='${id}';renderTkDetail()" style="padding:8px 16px;font-size:13px;font-weight:${tab===id?'600':'500'};background:none;border:none;border-bottom:2px solid ${tab===id?'var(--acc)':'transparent'};color:${tab===id?'var(--acc)':'var(--mu)'};cursor:pointer;font-family:inherit;transition:.15s;margin-bottom:-1px">${label}</button>`;
  const detailsHtml=`
    <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:6px">BESCHREIBUNG</div>
      <div style="font-size:13px;line-height:1.6;color:${tk.description?'var(--tx)':'var(--di)'}">${tk.description||'Keine Beschreibung.'}</div></div>
    ${subs.length||canEdit?`<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">UNTERTICKETS (${subs.length})</div>
      <div class="subl">${subs.map(st=>`<div class="subi" onclick="S.currentTicketId='${st.id}';renderTkDetail()">\u21b8<span style="font-family:monospace;font-size:11px;color:var(--mu)">${st.number}</span><span style="flex:1;font-size:12px">${st.title}</span>${stBdg(st.status)}</div>`).join('')}
      ${canEdit?`<button class="btn-s" style="font-size:11px;margin-top:4px" onclick="openTkForm(null,'${tk.id}')">&#65291; Unterticket</button>`:''}
      </div></div>`:''}
    ${tk.checklists.length?`<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">CHECKLISTEN</div>
      ${tk.checklists.map(cl=>`<div style="margin-bottom:10px;padding:10px;background:var(--sf2);border:1px solid var(--border);border-radius:7px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700">${cl.name}</span>
          <div style="display:flex;gap:5px;align-items:center">
            <span style="font-size:10px;color:var(--mu)">${cl.items.filter(i=>i.completedBy).length}/${cl.items.length}</span>
            ${canEdit?`<button class="btn-d" style="padding:2px 6px;font-size:10px" onclick="removeCl('${tk.id}','${cl.id}')">\u2715</button>`:''}
          </div>
        </div>
        <div class="cl-items">${cl.items.map(it=>`<div class="cl-item${it.completedBy?' done':''}" id="cli-${it.id}">
          <div class="cl-item-row">
            <input type="checkbox" ${it.completedBy?'checked':''} onchange="toggleClItem('${tk.id}','${cl.id}','${it.id}',this.checked)">
            <span class="cl-item-text">${it.text}</span>
            ${it.completedBy?`<span class="cl-done-by">&#128100; ${getU(it.completedBy)?.name||'?'}</span>`:''}
          </div>
          ${it.itemType==='check_text'?`<div class="cl-user-note"><input type="text" placeholder="Notiz \u2026" value="${(it.userNote||'').replace(/"/g,'&quot;')}" onchange="saveClItemNote('${tk.id}','${cl.id}','${it.id}',this.value)"></div>`:''}
        </div>`).join('')}</div>
      </div>`).join('')}
    </div>`:''}`;
  const protocolHtml=`
    <div style="display:flex;gap:2px;background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:2px;margin-bottom:12px;width:fit-content">
      ${['all','audit','note'].map(f=>`<button onclick="S._tkFeedFilter='${f}';renderTkDetail()" style="font-size:11px;padding:3px 10px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;transition:.15s;background:${(S._tkFeedFilter||'all')===f?'var(--acc)':'transparent'};color:${(S._tkFeedFilter||'all')===f?'var(--act)':'var(--mu)'}">${f==='all'?'Alle':f==='audit'?'\u00c4nderungen':'Notizen'}</button>`).join('')}
    </div>
    <div class="nfeed">${_renderFeed(notes,tk.id,canEdit,S._tkFeedFilter||'all')}</div>
    ${canEdit?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
      ${S.noteTemplates.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
        ${S.noteTemplates.map(t=>`<button class="btn-s" style="font-size:11px;padding:3px 9px" onclick="applyNoteTpl(${JSON.stringify(t.body)})">${t.label}</button>`).join('')}
      </div>`:''}
      <div style="display:flex;gap:7px;align-items:flex-end">
        <div class="note-input-wrap" style="flex:1">
          <div class="mention-suggestions" id="mentionSug"></div>
          <textarea id="noteInput" rows="2" placeholder="Notiz \u2026 @Name f\u00fcr Erw\u00e4hnung" style="font-size:13px;width:100%" onkeyup="onNoteKey(event,'${tk.id}')"></textarea>
        </div>
        <button class="btn-p" onclick="addNote('${tk.id}')" style="padding:8px 12px;flex-shrink:0">Senden</button>
      </div>
    </div>`:''}`;
  document.getElementById('tkDetMain').innerHTML=`
    <div style="border-bottom:1px solid var(--border);margin:-18px -18px 14px;padding:0 18px;display:flex;gap:0">
      ${tabBtn('details','\ud83d\udccb Details')}
      ${tabBtn('protocol','\ud83d\udd50 Protokoll'+(notes.length?` (${notes.length})`:''))}
    </div>
    ${tab==='details'?detailsHtml:protocolHtml}`;
  document.getElementById('tkDetSB').innerHTML=`
    ${canEdit?`
    <div class="tkf"><label>Status</label><select onchange="updateTkField('${tk.id}','status',this.value)">${STATUSES.map(s=>`<option value="${s.id}"${tk.status===s.id?' selected':''}>${s.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Priorit\u00e4t</label><select onchange="updateTkField('${tk.id}','priority',this.value)">${PRIORITIES.map(p2=>`<option value="${p2.id}"${tk.priority===p2.id?' selected':''}>${p2.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Fachbereich</label><select onchange="updateTkField('${tk.id}','department',this.value)">${DEPTS.map(d=>`<option value="${d}"${tk.department===d?' selected':''}>${DEPT_LABELS[d]}</option>`).join('')}</select></div>
    <div class="tkf"><label>Bucket</label><select onchange="updateTkField('${tk.id}','bucket',this.value)"><option value="">\u2014</option>${BUCKETS.map(b=>`<option value="${b.id}"${tk.bucket===b.id?' selected':''}>${b.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Zust\u00e4ndig</label><div style="display:flex;gap:5px">
      <select onchange="updateTkField('${tk.id}','assigneeId',this.value||null)" style="flex:1"><option value="">\u2014</option>${S.users.map(u=>`<option value="${u.id}"${tk.assigneeId===u.id?' selected':''}>${u.name}</option>`).join('')}</select>
      ${S.tp.canAssign&&tk.assigneeId!==S.currentUser?`<button class="btn-ok" onclick="updateTkField('${tk.id}','assigneeId','${S.currentUser}')">Ich</button>`:''}
    </div></div>
    ${S.tp.canSetPublic?`<div class="tkf"><label>Sichtbarkeit</label><button class="bdg ${tk.isPublic?'pub-on':'pub-off'}" onclick="updateTkField('${tk.id}','isPublic',${!tk.isPublic})" style="cursor:pointer;padding:5px 10px;border-radius:6px;font-size:12px">${tk.isPublic?'&#127760; \u00d6ffentlich':'&#128274; Privat'}</button></div>`:''}
    <div class="tkf"><label>Elternticket</label><select onchange="updateTkField('${tk.id}','parentTicketId',this.value||null)"><option value="">\u2014</option>${S.tickets.filter(t=>t.id!==tk.id).map(t=>`<option value="${t.id}"${tk.parentTicketId===t.id?' selected':''}>${t.number}: ${t.title.slice(0,25)}</option>`).join('')}</select></div>
    <div class="tkf"><label>&#128197; F\u00e4lligkeit</label><input type="date" value="${tk.dueDate||''}" onchange="updateTkField('${tk.id}','dueDate',this.value||null)" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx);width:100%;box-sizing:border-box"></div>`
    :`<div class="tkf"><label>Status</label><div class="val">${stBdg(tk.status)}</div></div>
    <div class="tkf"><label>Priorit\u00e4t</label><div class="val">${prioBdg(tk.priority)}</div></div>
    <div class="tkf"><label>Fachbereich</label><div class="val">${deptBdg(tk.department)}</div></div>
    <div class="tkf"><label>Zust\u00e4ndig</label><div class="val">${getU(tk.assigneeId)?`<div style="display:flex;align-items:center;gap:5px">${avHtml(getU(tk.assigneeId).initials,getU(tk.assigneeId).color,18,8)}<span style="font-size:12px">${getU(tk.assigneeId).name}</span></div>`:'\u2014'}</div></div>`}
    <div class="tkdiv"></div>
    <div class="tkf"><label>Tags</label><div>${tagChips(tk.tags)||'<span style="color:var(--di);font-size:11px">\u2014</span>'}</div></div>
    <div class="tkf"><label>&#128164; Wiedervorlage</label>
      ${canEdit?`<div style="display:flex;gap:5px;align-items:center">
        <input type="date" value="${tk.snoozedUntil||''}" id="snoozeDate" style="flex:1;font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx)">
        <button class="btn-s" style="font-size:11px;padding:3px 7px" onclick="setSnooze('${tk.id}')">&#10003;</button>
        ${tk.snoozedUntil?`<button class="btn-d" style="font-size:11px;padding:3px 7px" onclick="updateTkField('${tk.id}','snoozedUntil',null);toast('\u2705 Wiedervorlage entfernt')">\u2715</button>`:''}
      </div>`:
      `<div style="font-size:12px;color:var(--mu)">${tk.snoozedUntil?'bis '+new Date(tk.snoozedUntil).toLocaleDateString('de-DE'):'\u2014'}</div>`}
    </div>
    <div class="tkf"><label>Erstellt von</label><div style="font-size:12px">${getU(tk.createdBy)?.name||'?'}</div></div>
    <div class="tkf"><label>Erstellt am</label><div style="font-size:11px;color:var(--mu)">${fdt(tk.createdAt)}</div></div>
    ${par?`<div class="tkf"><label>Elternticket</label><div class="subi" onclick="S.currentTicketId='${par.id}';renderTkDetail()" style="margin-top:4px"><span style="font-family:monospace;font-size:11px">${par.number}</span><span style="font-size:12px;flex:1">${par.title.slice(0,22)}</span></div></div>`:''}
    ${canEdit?`<div class="tkdiv"></div>
    <button class="btn-s" style="width:100%;justify-content:center;font-size:12px" onclick="openAttachCl('${tk.id}')">&#9745;&#65039; Checkliste anh\u00e4ngen</button>
    ${tk.status!=='closed'?`<button class="btn-ok" style="width:100%;justify-content:center;margin-top:4px" onclick="updateTkField('${tk.id}','status','closed')">\u2713 Abschlie\u00dfen</button>`:''}`:''}`;
}
let _mentionActive=false;
function onNoteKey(e,tkId){
  const ta=document.getElementById('noteInput');if(!ta)return;
  if(e.key==='Enter'&&!e.shiftKey&&!_mentionActive){e.preventDefault();addNote(tkId);return;}
  const val=ta.value,pos=ta.selectionStart,before=val.slice(0,pos);
  const match=before.match(/@(\w*)$/);
  if(match){
    const q=match[1].toLowerCase();
    const sugs=S.users.filter(u=>u.name.toLowerCase().includes(q)&&u.id!==S.currentUser).slice(0,5);
    const sug=document.getElementById('mentionSug');
    if(sugs.length){sug.innerHTML=sugs.map((u,i)=>`<div class="mention-opt${i===0?' active':''}" onclick="insertMention('${u.name}')">${avHtml(u.initials,u.color,20,8)} ${u.name}</div>`).join('');sug.classList.add('open');_mentionActive=true;}
    else{sug.classList.remove('open');_mentionActive=false;}
  }else{document.getElementById('mentionSug')?.classList.remove('open');_mentionActive=false;}
}
function insertMention(name){
  const ta=document.getElementById('noteInput');if(!ta)return;
  const val=ta.value,pos=ta.selectionStart,before=val.slice(0,pos).replace(/@\w*$/,'');
  ta.value=before+'@'+name+' '+val.slice(pos);
  document.getElementById('mentionSug')?.classList.remove('open');_mentionActive=false;ta.focus();
}
async function updateTkField(id,field,value){
  try{await api('PUT','/tickets/'+id,{[field]:value});await fetchData();renderMain();const tk=getTk(id);if(tk){S.currentTicketId=id;renderTkDetail();}}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
function applyNoteTpl(body){const inp=document.getElementById('noteInput');if(inp){inp.value=body;inp.focus();inp.setSelectionRange(body.length,body.length);}}
async function addNote(tkId){
  const inp=document.getElementById('noteInput');if(!inp?.value.trim())return;
  try{await api('POST','/tickets/'+tkId+'/notes',{text:inp.value.trim()});inp.value='';await fetchData();renderTkDetail();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function deleteNote(tkId,noteId){
  if(!confirm('Notiz l\u00F6schen?'))return;
  try{await api('DELETE','/tickets/'+tkId+'/notes/'+noteId);await fetchData();renderTkDetail();toast('\u2705 Notiz gel\u00F6scht');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
function editCurrentTicket(){openTkForm(S.currentTicketId);}
function onTkDeptChange(){
  const dept=document.getElementById('tkFDept')?.value||'';
  const subcats=S.ticketSubcategories.filter(s=>s.department===dept);
  const row=document.getElementById('tkFSubcatRow');
  const sel=document.getElementById('tkFSubcat');
  if(row&&sel){
    if(subcats.length){
      sel.innerHTML='<option value="">— keine Unterkategorie —</option>'+subcats.map(s=>`<option value="${s.label}">${s.label}</option>`).join('');
      row.style.display='';
    } else {
      sel.value='';
      row.style.display='none';
    }
  }
}
function openTkForm(id,parentId){
  const tk=id?getTk(id):null;
  document.getElementById('tkFT').textContent=tk?`Ticket bearbeiten: ${tk.number}`:'Neues Ticket';
  document.getElementById('tkFId').value=tk?.id||'';
  document.getElementById('tkFNm').value=tk?.title||'';
  document.getElementById('tkFDesc').value=tk?.description||'';
  document.getElementById('tkFDept').value=tk?.department||'frei';
  document.getElementById('tkFPrio').value=tk?.priority||'medium';
  onTkDeptChange();
  if(tk?.subcategory){const sel=document.getElementById('tkFSubcat');if(sel)sel.value=tk.subcategory||'';}

  document.getElementById('tkFSt').value=tk?.status||'open';
  // Standard-User sehen keine Status/Bucket-Auswahl
  var isStd=!(S.tp.seeAll||S.tp.myDepts.length>0);
  var advRow=document.getElementById('tkFAdvRow');
  if(advRow)advRow.style.display=isStd?'none':'flex';
  document.getElementById('tkFBkt').innerHTML='<option value="">\u2014</option>'+BUCKETS.map(b=>`<option value="${b.id}"${tk?.bucket===b.id?' selected':''}>${b.label}</option>`).join('');
  document.getElementById('tkFTags').innerHTML=S.tags.map(t=>`<option value="${t.id}"${tk?.tags?.includes(t.id)?' selected':''}>${t.label}</option>`).join('');
  document.getElementById('tkFAsgn').innerHTML='<option value="">\u2014 niemand \u2014</option>'+S.users.map(u=>`<option value="${u.id}"${tk?.assigneeId===u.id?' selected':''}>${u.name}</option>`).join('');
  const pid=parentId||tk?.parentTicketId||'';
  document.getElementById('tkFPar').innerHTML='<option value="">\u2014</option>'+S.tickets.filter(t=>!id||t.id!==id).map(t=>`<option value="${t.id}"${t.id===pid?' selected':''}>${t.number}: ${t.title.slice(0,35)}</option>`).join('');
  const dueFld=document.getElementById('tkFDue');if(dueFld)dueFld.value=tk?.dueDate||'';
  closeModal('tkDetOv');openModal('tkFormOv');
}
async function saveTicket(){
  const nm=document.getElementById('tkFNm').value.trim();if(!nm){toast('\u26A0\uFE0F Name erforderlich!');return;}
  const id=document.getElementById('tkFId').value;
  const tags=Array.from(document.getElementById('tkFTags').selectedOptions).map(o=>o.value);
  const body={title:nm,description:document.getElementById('tkFDesc').value.trim(),department:document.getElementById('tkFDept').value,subcategory:document.getElementById('tkFSubcat')?.value||'',priority:document.getElementById('tkFPrio').value,status:document.getElementById('tkFSt').value,bucket:document.getElementById('tkFBkt').value,tags,assigneeId:document.getElementById('tkFAsgn').value||null,parentTicketId:document.getElementById('tkFPar').value||null,dueDate:document.getElementById('tkFDue')?.value||null};
  try{
    if(id)await api('PUT','/tickets/'+id,body);else await api('POST','/tickets',body);
    await fetchData();closeModal('tkFormOv');renderMain();toast(id?'\u2705 Aktualisiert!':'\u2705 Erstellt!');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// CHECKLISTS
function renderChecklists(){
  const visible=S.p.manageUsers?S.checklists:S.checklists.filter(c=>S.tp.myDepts.includes(c.department)||c.createdBy===S.currentUser);
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Checklisten <span>Vorlagen</span></div><button class="btn-p" onclick="openClForm(null)">&#65291; Neue Vorlage</button></div>
    <div class="tw"><div class="tt"><h2>Vorlagen (${visible.length})</h2></div>
      ${visible.length?visible.map(cl=>`<div style="padding:12px 15px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-weight:700;font-size:13px">${cl.name}</span>${deptBdg(cl.department)}</div>
          <div style="font-size:11px;color:var(--mu);margin-bottom:6px">${cl.items.length} Punkte &middot; ${getU(cl.createdBy)?.name||'?'}</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${cl.items.map(it=>`<span style="font-size:11px;background:var(--sf2);border:1px solid var(--border);border-radius:4px;padding:2px 7px">${it.itemType==='check_text'?'&#128065;&#65039;':'&#9745;&#65039;'} ${it.text}</span>`).join('')}</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn-e" onclick="openClForm('${cl.id}')">\u270e</button>
          <button class="btn-d" onclick="deleteCl('${cl.id}')">\u2715</button>
        </div>
      </div>`).join(''):`<div class="empty">&#128235; Keine Vorlagen</div>`}
    </div>`;
}
let _clItems=[];
function openClForm(id){
  const cl=id?S.checklists.find(c=>c.id===id):null;
  document.getElementById('clFT').textContent=cl?'Vorlage bearbeiten':'Neue Checkliste';
  document.getElementById('clFId').value=cl?.id||'';document.getElementById('clFNm').value=cl?.name||'';
  document.getElementById('clFDept').value=cl?.department||'technik';document.getElementById('clFErr').textContent='';
  _clItems=(cl?.items||[]).map(i=>({text:i.text,itemType:i.itemType||'check'}));
  renderClItems();openModal('clFormOv');
}
function renderClItems(){
  document.getElementById('clFItems').innerHTML=_clItems.map((it,i)=>`<div class="item-row">
    <div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
      <button class="btn-s" style="padding:1px 6px;font-size:10px;line-height:1.4" ${i===0?'disabled':''} onclick="_clMoveItem(${i},-1)" title="Nach oben">&#9650;</button>
      <button class="btn-s" style="padding:1px 6px;font-size:10px;line-height:1.4" ${i===_clItems.length-1?'disabled':''} onclick="_clMoveItem(${i},1)" title="Nach unten">&#9660;</button>
    </div>
    <select class="item-type-sel" onchange="_clItems[${i}].itemType=this.value">
      <option value="check"${it.itemType==='check'?' selected':''}>\u2611 Checkbox</option>
      <option value="check_text"${it.itemType==='check_text'?' selected':''}>\u2611 + Notizfeld</option>
    </select>
    <input type="text" value="${(it.text||'').replace(/"/g,'&quot;')}" placeholder="Punkt ${i+1}" oninput="_clItems[${i}].text=this.value">
    <button class="btn-d" onclick="_clItems.splice(${i},1);renderClItems()" style="padding:6px 9px">\u2715</button>
  </div>`).join('');
}
function _clMoveItem(i,dir){var to=i+dir;if(to<0||to>=_clItems.length)return;var tmp=_clItems[i];_clItems[i]=_clItems[to];_clItems[to]=tmp;renderClItems();}
function addClItem(){_clItems.push({text:'',itemType:'check'});renderClItems();setTimeout(()=>{const ins=document.querySelectorAll('#clFItems .item-row input[type=text]');if(ins.length)ins[ins.length-1].focus();},50);}
async function saveChecklist(){
  const name=document.getElementById('clFNm').value.trim();document.getElementById('clFErr').textContent='';
  if(!name){document.getElementById('clFErr').textContent='\u26A0\uFE0F Name erforderlich!';return;}
  const id=document.getElementById('clFId').value;
  const items=_clItems.filter(it=>it.text.trim()).map(it=>({text:it.text.trim(),itemType:it.itemType}));
  loading(true);
  try{
    if(id)await api('PUT','/checklists/'+id,{name,department:document.getElementById('clFDept').value,items});
    else await api('POST','/checklists',{name,department:document.getElementById('clFDept').value,items});
    await fetchData();closeModal('clFormOv');renderMain();toast('\u2705 Checkliste gespeichert!');
  }catch(e){document.getElementById('clFErr').textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}
}
async function deleteCl(id){if(!confirm('Vorlage l\u00f6schen?'))return;try{await api('DELETE','/checklists/'+id);await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
function openAttachCl(tkId){
  document.getElementById('attachTkId').value=tkId;
  document.getElementById('attachClSel').innerHTML='<option value="">\u2014 w\u00e4hlen \u2014</option>'+S.checklists.map(cl=>`<option value="${cl.id}">${cl.name} (${DEPT_LABELS[cl.department]||cl.department})</option>`).join('');
  openModal('attachClOv');
}
async function doAttachCl(){
  const tkId=document.getElementById('attachTkId').value,tplId=document.getElementById('attachClSel').value;
  if(!tplId){toast('\u26A0\uFE0F Vorlage w\u00e4hlen!');return;}
  try{await api('POST','/tickets/'+tkId+'/checklists',{templateId:tplId});await fetchData();closeModal('attachClOv');renderTkDetail();toast('\u2705 Checkliste angeh\u00e4ngt!');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function removeCl(tkId,clId){try{await api('DELETE','/tickets/'+tkId+'/checklists/'+clId);await fetchData();renderTkDetail();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
async function toggleClItem(tkId,clId,iId,checked){try{await api('PUT','/tickets/'+tkId+'/checklists/'+clId+'/items/'+iId,{completed:checked});await fetchData();renderTkDetail();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
async function saveClItemNote(tkId,clId,iId,note){try{await api('PUT','/tickets/'+tkId+'/checklists/'+clId+'/items/'+iId,{userNote:note});}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
// MESSAGES
function renderMessages(){
  const isSent=S.view==='messages_sent';
  const msgs=isSent
    ?S.messages.filter(m=>m.senderId===S.currentUser).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    :S.messages.filter(m=>m.senderId!==S.currentUser)
      .sort((a,b)=>{
        if(a.pinned&&!b.pinned)return -1;
        if(!a.pinned&&b.pinned)return 1;
        if(!a.isRead&&b.isRead)return -1;
        if(a.isRead&&!b.isRead)return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  const unread=isSent?[]:msgs.filter(m=>!m.isRead);
  const cardsHtml=msgs.length?`<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">${msgs.map(m=>{
    const from=getU(m.senderId);const toUser=m.targetType==='user'?getU(m.targetValue):null;
    const isPinned=m.pinned||false;
    const isUnread=!isSent&&!m.isRead;
    const accent=isPinned?'var(--warn)':isUnread?'var(--acc)':'var(--border)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border);cursor:pointer${isUnread?';background:rgba(59,109,212,.03)':''}" onclick="openMsg('${m.id}')">
      <div style="width:3px;align-self:stretch;background:${accent};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isPinned?'&#128204; ':''}${isUnread?'&#128276; ':''}${m.title}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
          ${isSent?`<span>An: <strong>${toUser?toUser.name:'Alle Mitarbeiter'}</strong></span>`:`<span>Von: <strong>${from?.name||'?'}</strong></span>`}
          <span>${fdt(m.createdAt)}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${m.body.slice(0,80)}${m.body.length>80?'&#8230;':''}</span>
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;align-items:center" onclick="event.stopPropagation()">
        ${isUnread?`<span class="bdg ap-bdg-pending" style="font-size:10px">&#128276; Neu</span>`:''}
        ${!isSent&&m.isRead?`<span class="bdg ap-bdg-approved" style="font-size:10px">&#10003; Best&auml;tigt</span>`:''}
        ${isSent?`<span class="bdg ${m.isRead?'ap-bdg-approved':'ap-bdg-pending'}" style="font-size:10px">${m.isRead?'&#10003; Gelesen':'&#8987; Ausstehend'}</span>`:''}
        <button class="btn-s" style="font-size:10px;padding:3px 7px" onclick="toggleMsgPinDirect('${m.id}',${isPinned})" title="${isPinned?'Lospinnen':'Anpinnen'}">${isPinned?'&#128204;':'&#128203;'}</button>
        ${m.senderId===S.currentUser||S.p.manageUsers?`<button class="btn-d" onclick="deleteMsg('${m.id}')" style="padding:4px 8px;font-size:11px">&#10005;</button>`:''}
      </div>
    </div>`;
  }).join('')}</div>`:`<div class="empty" style="padding:30px">&#128235; ${isSent?'Keine gesendeten Nachrichten':'Keine Nachrichten'}</div>`;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Nachrichten</div>${S.p.canSendMessages?`<button class="btn-p" onclick="openMsgForm()">&#9993;&#65039; Verfassen</button>`:''}</div>
    <div class="atabs" style="margin-bottom:14px;border-bottom:1px solid var(--border)">
      <button class="tb ${!isSent?'on':''}" onclick="setView('messages')">&#128235; Eingang ${S.messages.filter(m=>m.senderId!==S.currentUser&&!m.isRead).length?`<span class="nbdg" style="display:inline-flex">${S.messages.filter(m=>m.senderId!==S.currentUser&&!m.isRead).length}</span>`:''}</button>
      <button class="tb ${isSent?'on':''}" onclick="setView('messages_sent')">&#128228; Gesendet (${S.messages.filter(m=>m.senderId===S.currentUser).length})</button>
    </div>
    ${!isSent&&unread.length?`<div style="padding:10px 14px;margin-bottom:12px;background:rgba(239,68,68,0.04));border:1px solid rgba(239,68,68,.20);border-radius:var(--r);font-size:12px;font-weight:600;color:var(--danger)">&#128276; ${unread.length} unbest\u00e4tigte Nachricht${unread.length>1?'en':''}</div>`:''}
    ${cardsHtml}`;
}
var _currentMsgId=null;
function openMsg(id){
  const m=S.messages.find(x=>x.id===id);if(!m)return;
  _currentMsgId=id;
  const from=getU(m.senderId);const toUser=m.targetType==='user'?getU(m.targetValue):null;
  document.getElementById('msgDetTitle').textContent=m.title;
  document.getElementById('msgDetMeta').innerHTML=`Von: <strong>${from?.name||'?'}</strong> &middot; ${fdt(m.createdAt)} &middot; An: <strong>${m.targetType==='all'?'Alle Mitarbeiter':toUser?.name||m.targetValue}</strong>`;
  document.getElementById('msgDetBody').textContent=m.body;
  const pinBtn=document.getElementById('msgDetPinBtn');
  pinBtn.textContent=m.pinned?'&#128204; Lospinnen':'&#128204; Anpinnen';
  pinBtn.innerHTML=m.pinned?'&#128204; Lospinnen':'&#128203; Anpinnen';
  const confirmBtn=document.getElementById('msgDetConfirmBtn');
  confirmBtn.style.display=(!m.isRead&&m.senderId!==S.currentUser)?'block':'none';
  openModal('msgDetOv');
}
async function confirmAndClose(){
  if(!_currentMsgId)return;
  try{await api('POST','/messages/'+_currentMsgId+'/read');await fetchData();closeModal('msgDetOv');renderMain();}catch(e){toast('&#9888;&#65039; '+e.message,'err');}
}
async function toggleMsgPin(){
  if(!_currentMsgId)return;
  const m=S.messages.find(x=>x.id===_currentMsgId);
  const newPin=!m?.pinned;
  try{await api('PUT','/messages/'+_currentMsgId+'/pin',{pinned:newPin});await fetchData();
    const pinBtn=document.getElementById('msgDetPinBtn');
    if(pinBtn)pinBtn.innerHTML=newPin?'&#128204; Lospinnen':'&#128203; Anpinnen';
    renderMain();toast(newPin?'&#128204; Angepinnt!':'Lospinnen OK');}catch(e){toast('&#9888;&#65039; '+e.message,'err');}
}
async function toggleMsgPinDirect(id,isPinned){
  try{await api('PUT','/messages/'+id+'/pin',{pinned:!isPinned});await fetchData();renderMain();}catch(e){toast('&#9888;&#65039; '+e.message,'err');}
}
async function readMsg(id){
  try{await api('POST','/messages/'+id+'/read');await fetchData();renderMain();toast('&#10003; Best&auml;tigt!');}catch(e){toast('&#9888;&#65039; '+e.message,'err');}
}
async function deleteMsg(id){
  if(!confirm('Nachricht l\u00f6schen?'))return;
  try{await api('DELETE','/messages/'+id);await fetchData();renderMain();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
function openMsgForm(){
  const sel=document.getElementById('msgTo');
  if(sel)sel.innerHTML='<option value="">Alle Mitarbeiter</option>'+S.users.filter(u=>u.id!==S.currentUser).map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
  const t=document.getElementById('msgTitle');if(t)t.value='';
  const b=document.getElementById('msgBody');if(b)b.value='';
  const e=document.getElementById('msgErr');if(e)e.textContent='';
  openModal('msgFormOv');
}
async function sendMessage(){
  const title=document.getElementById('msgTitle')?.value.trim()||'';
  const body=document.getElementById('msgBody')?.value.trim()||'';
  const errEl=document.getElementById('msgErr');if(errEl)errEl.textContent='';
  if(!title||!body){const msg='\u26A0\uFE0F Betreff und Text sind erforderlich!';if(errEl)errEl.textContent=msg;else toast(msg);return;}
  const toUser=document.getElementById('msgTo')?.value||'';
  loading(true);
  try{
    await api('POST','/messages',{title,body,targetType:toUser?'user':'all',targetValue:toUser||null});
    await fetchData();closeModal('msgFormOv');renderMain();toast('\u2705 Nachricht gesendet!');
  }catch(e){const msg='\u26A0\uFE0F '+e.message;if(errEl)errEl.textContent=msg;else toast(msg,'err');console.error('sendMessage:',e);}
  finally{loading(false);}
}
// ADMIN

var _logOffset=0, _logTotal=0;
async function loadLog(reset){
  if(reset){_logOffset=0;_logTotal=0;document.getElementById('logContent').innerHTML='<div style="padding:20px;text-align:center;color:var(--di)">Lade&#8230;</div>';}
  loading(true);
  try{
    const data=await api('GET','/activity-log?limit=50&offset='+_logOffset);
    _logTotal=data.total||0;
    const rows=data.logs||[];
    _logOffset+=rows.length;
    const AL={login:'&#128273; Login',logout:'&#128682; Logout',change_password:'&#128272; PW geändert',create_event:'&#128197; Eintrag erstellt',edit_event:'&#9999;&#65039; Eintrag bearbeitet',delete_event:'&#128465;&#65039; Eintrag gelöscht',approve_event:'&#9989; Freigabe',create_ticket:'&#127931; Ticket erstellt',update_ticket:'&#128221; Ticket geändert',delete_ticket:'&#128465;&#65039; Ticket gelöscht',send_message:'&#9993;&#65039; Nachricht gesendet',ack_message:'&#10003; Nachricht bestätigt'};
    const fdt=s=>{if(!s)return'';const d=new Date(s);return d.toLocaleDateString('de-AT')+' '+d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});};
    var html=reset?'':'';
    if(!reset){const el=document.getElementById('logContent');html=el.innerHTML==='<div style="padding:20px;text-align:center;color:var(--di)">Lade&#8230;</div>'?'':el.innerHTML;}
    if(rows.length===0&&reset){html='<div style="padding:20px;text-align:center;color:var(--di)">Keine Einträge vorhanden.</div>';}
    else rows.forEach(function(l){
      var det='';
      if(l.details&&typeof l.details==='object'){var keys=Object.keys(l.details).filter(function(k){return k!=='ip';});if(keys.length)det=keys.map(function(k){return k+': '+JSON.stringify(l.details[k]).slice(0,40);}).join(', ');}
      html+='<div style="display:grid;grid-template-columns:130px 110px 160px 1fr;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);align-items:center;font-size:11px">'
        +'<span style="color:var(--mu)">'+fdt(l.created_at)+'</span>'
        +'<span style="font-weight:600">'+escHtml(l.user_name||'?')+'</span>'
        +'<span>'+(AL[l.action]||l.action)+'</span>'
        +'<span style="color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(det)+'</span>'
        +'</div>';
    });
    document.getElementById('logContent').innerHTML=html||'<div style="padding:20px;text-align:center;color:var(--di)">Keine Einträge.</div>';
    document.getElementById('logMoreBtn').style.display=_logOffset<_logTotal?'block':'none';
  }catch(e){document.getElementById('logContent').innerHTML='<div style="padding:16px;color:var(--danger)">Fehler: '+escHtml(e.message)+'</div>';}
  loading(false);
}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function openAdminModal(){renderUsrList();renderCatList();renderTagList();renderRightsMatrix();openModal('admOv');}
function swTab(t){['users','cats','tags','stats','rights','subcats','notetpls','log','ho'].forEach(x=>{document.getElementById('atb-'+x)?.classList.toggle('on',x===t);document.getElementById('atp-'+x)?.classList.toggle('on',x===t);});if(t==='ho')renderHoAdmin();if(t==='subcats')renderSubcatAdmin();if(t==='notetpls')renderNoteTplAdmin();if(t==='stats')renderStatsPanel();}
function backToAdmin(tab='users'){['ufOv','cfOv','tfOv'].forEach(closeModal);openAdminModal();swTab(tab);}
function renderUsrList(){document.getElementById('usrList').innerHTML=S.users.map(u=>`<div class="ai">${avHtml(u.initials,u.color,34,13,u.isOnline)}<div class="aii"><div class="ain">${u.name} ${roleBadges(u.id)}${u.isOnline?'<span style="font-size:10px;color:var(--ok)">\u25cf online</span>':''}</div><div class="ais">${u.mustChangePW?'\u26A0\uFE0F PW ausstehend':'\u2713 Aktiv'}</div></div><div class="aia"><button class="btn-e" onclick="openUF('${u.id}')">\u270e</button>${S.users.length>1&&u.id!==S.currentUser?`<button class="btn-d" onclick="delUser('${u.id}')">\u2715</button>`:''}</div></div>`).join('');}
function renderCatList(){document.getElementById('catList').innerHTML=S.categories.map(c=>`<div class="ai"><div style="width:14px;height:14px;border-radius:3px;background:${c.color};flex-shrink:0"></div><div class="aii"><div class="ain">${c.emoji} ${c.label}</div></div><div class="aia"><button class="btn-e" onclick="openCF('${c.id}')">\u270e</button>${S.categories.length>1?`<button class="btn-d" onclick="delCat('${c.id}')">\u2715</button>`:''}</div></div>`).join('');}
function renderTagList(){document.getElementById('tagList').innerHTML=S.tags.map(t=>`<div class="ai"><div style="width:14px;height:14px;border-radius:3px;background:${t.color};flex-shrink:0"></div><div class="aii"><div class="ain"><span class="tag-chip" style="background:${t.color}1a;color:${t.color}">${t.label}</span></div></div><div class="aia"><button class="btn-e" onclick="openTF('${t.id}')">\u270e</button>${S.tags.length>1?`<button class="btn-d" onclick="delTag('${t.id}')">\u2715</button>`:''}</div></div>`).join('');}
function renderRightsMatrix(){const rids=ROLES.map(r=>r.id);document.getElementById('rightsMatrix').innerHTML=`<table class="rm-table"><thead><tr><th style="text-align:left">Berechtigung</th>${ROLES.map(r=>`<th>${r.icon}<br>${r.label}</th>`).join('')}</tr></thead><tbody>${RM.map(([p2,v])=>`<tr><td style="text-align:left">${p2}</td>${rids.map(r=>`<td>${v[r]===1?'<span class="rm-yes">\u2713</span>':v[r]===2?'<span class="rm-part">\u3030</span>':'<span class="rm-no">\u2013</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function buildCP(cid,sel,fn){document.getElementById(cid).innerHTML=pal().map(col=>`<div class="cp ${col===sel?'on':''}" style="background:${col}" onclick="${fn}('${col}','${cid}')"></div>`).join('');}
function pickU(col,cid){S.ufColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickC(col,cid){S.cfColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickT(col,cid){S.tfColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function openUF(id){
  const u=id?getU(id):null;
  document.getElementById('ufT').textContent=u?'Benutzer bearbeiten':'Benutzer anlegen';
  document.getElementById('ufId').value=u?.id||'';document.getElementById('ufNm').value=u?.name||'';document.getElementById('ufIn').value=u?.initials||'';
  document.getElementById('ufPWRR').style.display=u?'block':'none';document.getElementById('ufPWRst').checked=false;
  document.getElementById('ufErr').textContent='';S.ufColor=u?.color||pal()[0];
  document.getElementById('ufRoles').innerHTML=ROLES.map(r=>`<label class="rck"><input type="checkbox" value="${r.id}" ${(u?.roles||['standard']).includes(r.id)?'checked':''}><span>${r.icon} ${r.label}</span></label>`).join('');
  buildCP('ufCR',S.ufColor,'pickU');closeModal('admOv');openModal('ufOv');
}
async function saveUser(){
  const name=document.getElementById('ufNm').value.trim(),initials=document.getElementById('ufIn').value.trim().toUpperCase();
  const errEl=document.getElementById('ufErr');errEl.textContent='';
  if(!name||!initials){errEl.textContent='\u26A0\uFE0F Name und K\u00fcrzel erforderlich!';return;}
  const roles=Array.from(document.querySelectorAll('#ufRoles input:checked')).map(cb=>cb.value);
  if(!roles.length){errEl.textContent='\u26A0\uFE0F Mindestens eine Rolle!';return;}
  const id=document.getElementById('ufId').value;loading(true);
  try{
    if(id)await api('PUT','/users/'+id,{name,initials,roles,color:S.ufColor,resetPassword:document.getElementById('ufPWRst').checked});
    else await api('POST','/users',{name,initials,roles,color:S.ufColor});
    await fetchData();loadLoginUsers();backToAdmin('users');toast('\u2705 Benutzer gespeichert!');
  }catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}
}
async function delUser(id){if(!confirm('Benutzer l\u00f6schen?'))return;loading(true);try{await api('DELETE','/users/'+id);await fetchData();loadLoginUsers();backToAdmin('users');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
function openCF(id){const c=id?getCat(id):null;document.getElementById('cfT').textContent=c?'Kategorie bearbeiten':'Kategorie anlegen';document.getElementById('cfId').value=c?.id||'';document.getElementById('cfLb').value=c?.label||'';document.getElementById('cfEm').value=c?.emoji||'\uD83D\uDCCC';document.getElementById('cfErr').textContent='';S.cfColor=c?.color||pal()[2];buildCP('cfCR',S.cfColor,'pickC');closeModal('admOv');openModal('cfOv');}
async function saveCategory(){const label=document.getElementById('cfLb').value.trim();const errEl=document.getElementById('cfErr');errEl.textContent='';if(!label){errEl.textContent='\u26A0\uFE0F Bezeichnung erforderlich!';return;}const id=document.getElementById('cfId').value;loading(true);try{if(id)await api('PUT','/categories/'+id,{label,emoji:document.getElementById('cfEm').value.trim()||'\uD83D\uDCCC',color:S.cfColor});else await api('POST','/categories',{label,emoji:document.getElementById('cfEm').value.trim()||'\uD83D\uDCCC',color:S.cfColor});await fetchData();backToAdmin('cats');toast('\u2705 Gespeichert!');}catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}}
async function delCat(id){if(!confirm('Kategorie l\u00f6schen?'))return;loading(true);try{await api('DELETE','/categories/'+id);await fetchData();backToAdmin('cats');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
function openTF(id){const t=id?getTag(id):null;document.getElementById('tfT').textContent=t?'Tag bearbeiten':'Tag anlegen';document.getElementById('tfId').value=t?.id||'';document.getElementById('tfLb').value=t?.label||'';document.getElementById('tfErr').textContent='';S.tfColor=t?.color||pal()[0];buildCP('tfCR',S.tfColor,'pickT');closeModal('admOv');openModal('tfOv');}
async function saveTag(){const label=document.getElementById('tfLb').value.trim();const errEl=document.getElementById('tfErr');errEl.textContent='';if(!label){errEl.textContent='\u26A0\uFE0F Bezeichnung erforderlich!';return;}const id=document.getElementById('tfId').value;loading(true);try{if(id)await api('PUT','/tags/'+id,{label,color:S.tfColor});else await api('POST','/tags',{label,color:S.tfColor});await fetchData();backToAdmin('tags');toast('\u2705 Gespeichert!');}catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}}
async function delTag(id){if(!confirm('Tag l\u00f6schen?'))return;loading(true);try{await api('DELETE','/tags/'+id);await fetchData();backToAdmin('tags');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
// UTILS
function toggleTheme(){const dark=document.documentElement.getAttribute('data-theme')==='dark';document.documentElement.setAttribute('data-theme',dark?'light':'dark');document.getElementById('thBtn').textContent=dark?'\uD83C\uDF19':'\u2600\uFE0F';localStorage.setItem('lst_theme',dark?'light':'dark');}
function openModal(id){document.getElementById(id)?.classList.add('open');}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
function eyeToggle(inputId,btn){const inp=document.getElementById(inputId);const show=inp.type==='password';inp.type=show?'text':'password';btn.textContent=show?'\uD83D\uDE48':'\uD83D\uDC41';}
function toast(msg,type=''){const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}
const ALL_MODALS=['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOr','clFormOv','attachClOv','changelogOv','dpOv','rejectEinspOv','helpOv','msgFormOv','msgDetOv','gSearchOv'];
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGSearch();return;}
  if(e.key==='Escape'){ALL_MODALS.forEach(closeModal);closeGSearch();}
});
ALL_MODALS.forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('click',e=>{if(e.target===el)closeModal(id);});});
document.addEventListener('click',e=>{if(!e.target.closest('.note-input-wrap'))document.getElementById('mentionSug')?.classList.remove('open');});
// AUTO-REFRESH
let _lastMsgCount=-1,_lastTkCount=-1,_refreshTimer=null;

function startClock(){
  var el=document.getElementById('clockDisplay');
  if(!el)return;
  el.style.display='block';
  function tick(){
    var now=new Date();
    var days=['So','Mo','Di','Mi','Do','Fr','Sa'];
    var d=days[now.getDay()]+'. '+now.getDate()+'.'+(now.getMonth()+1)+'.'+now.getFullYear();
    var t=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    el.innerHTML=d+'<br>'+t;
  }
  tick();
  setInterval(tick,1000);
}
function startAutoRefresh(){
  if(_refreshTimer)clearInterval(_refreshTimer);
  _lastMsgCount=S.messages.filter(m=>!m.isRead&&m.senderId!==S.currentUser).length;
  _lastTkCount=S.tickets.filter(tk=>tk.status!=='closed'&&((S.tp.myDepts.includes(tk.department)&&!tk.assigneeId)||tk.assigneeId===S.currentUser)).length;
  _refreshTimer=setInterval(async()=>{
    if(!S.currentUser)return;
    try{
      const data=await api('GET','/data');
      const newMsgCount=(data.messages||[]).filter(m=>!m.isRead&&m.senderId!==S.currentUser).length;
      const myD=S.tp?.myDepts||[];
      const newTkCount=(data.tickets||[]).filter(tk=>{
        if(tk.status==='closed')return false;
        if(tk.assigneeId===S.currentUser)return true;
        if(myD.includes(tk.department))return true;
        if(tk.department==='frei')return myD.length>0||S.tp?.seeAll;
        return false;
      }).length;
      S.users=data.users||[];S.events=data.events||[];S.tickets=data.tickets||[];
      S.messages=data.messages||[];S.notifications=data.notifications||[];
      S.allowances=data.allowances||[];S.checklists=data.checklists||[];
      S.abrechnung=data.abrechnung||{einspringer:[],homeoffice:[]};S.dienstplaene=data.dienstplaene||[];S.diensttausch=data.diensttausch||[];S.homeoffice=data.homeoffice||{slots:[],config:[],boxes:[],dienste:[]};S.vacationConfig=data.vacationConfig||[];S.diensttausch=data.diensttausch||[];
      updateBadges();
      if(_lastMsgCount>=0&&newMsgCount>_lastMsgCount)toast('\uD83D\uDCEC Neue Nachricht eingegangen!');
      if(_lastTkCount>=0&&newTkCount>_lastTkCount)toast('\uD83C\uDFAB Neues Ticket in deinem Bereich!');
      _lastMsgCount=newMsgCount;_lastTkCount=newTkCount;
      if(S.view==='home')renderHome();
      else if(S.view==='messages'||S.view==='messages_sent')renderMessages();
      else if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();
    var _rd=document.getElementById('lastRefreshDisplay');if(_rd){var _n=new Date();_rd.textContent='↻ '+_n.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});_rd.style.display='block';}
    }catch(e){}
  },60000);
}
// ══════════════════════════════════════════
// SECTION: Austrian Holidays
// ══════════════════════════════════════════
function getAustrianHolidays(year) {
  var pad=function(n){return String(n).padStart(2,'0');};
  var h=new Set([year+'-01-01',year+'-01-06',year+'-05-01',year+'-08-15',year+'-10-26',year+'-11-01',year+'-12-08',year+'-12-25',year+'-12-26']);
  var a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  var h2=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h2-k)%7,m=Math.floor((a+11*h2+22*l)/451);
  var mo=Math.floor((h2+l-7*m+114)/31),dy=((h2+l-7*m+114)%31)+1;
  var easter=new Date(year,mo-1,dy);
  var add=function(dt,n){var r=new Date(dt);r.setDate(r.getDate()+n);return year+'-'+pad(r.getMonth()+1)+'-'+pad(r.getDate());};
  [-2,0,1,39,49,50,60].forEach(function(n){h.add(add(easter,n));});
  return h;
}

// ══════════════════════════════════════════
// SECTION: Homeoffice
// ══════════════════════════════════════════
function renderHomeoffice() {
  var year=S.year, month=S.month!==null?S.month:new Date().getMonth();
  var firstDay=new Date(year,month,1), lastDay=new Date(year,month+1,0);
  var canManage=S.p.canApproveEvents||S.p.manageUsers;
  var moNames=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var dayNames=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  var moName=moNames[month];
  var holidays=getAustrianHolidays(year);
  var pad=function(n){return String(n).padStart(2,'0');};
  var normDate=function(d){if(!d)return'';var s=typeof d==='string'?d:d instanceof Date?d.toISOString():''+d;return s.slice(0,10);};
  var cfgMap={};
  (S.homeoffice&&S.homeoffice.config||[]).forEach(function(c){cfgMap[normDate(c.date)]=c.maxSlots;});
  var days=[];
  for(var dt=new Date(firstDay);dt<=lastDay;dt.setDate(dt.getDate()+1)){
    var iso=year+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
    var dow=dt.getDay(),isWe=dow===0||dow===6,isHol=holidays.has(iso);
    var slots=(S.homeoffice&&S.homeoffice.slots||[]).filter(function(s){return normDate(s.date)===iso;});
    var mySlot=slots.find(function(s){return s.userId===S.currentUser;});
    var maxS=cfgMap[iso]!==undefined?cfgMap[iso]:2;
    days.push({iso:iso,dow:dow,isWe:isWe,isHol:isHol,slots:slots,mySlot:mySlot,maxS:maxS,free:Math.max(0,maxS-slots.length),day:dt.getDate(),dayName:dayNames[dow]});
  }
  function fmtDay(iso){var dobj=new Date(iso+'T00:00:00');return pad(dobj.getDate())+'. '+moNames[dobj.getMonth()]+' '+dobj.getFullYear()+' ('+dayNames[dobj.getDay()]+')';}
  function rowBg(d){if(d.isHol)return'rgba(124,58,237,.06)';if(d.dow===0)return'rgba(239,68,68,.05)';if(d.dow===6)return'rgba(245,158,11,.04)';return'';}
  function rowBl(d){if(d.isHol)return'border-left:3px solid rgba(124,58,237,.5)';if(d.dow===0)return'border-left:3px solid rgba(239,68,68,.3)';if(d.dow===6)return'border-left:3px solid rgba(245,158,11,.3)';return'';}
  var confInMonth=(S.homeoffice&&S.homeoffice.config||[]).filter(function(c){return normDate(c.date).startsWith(year+'-'+pad(month+1));});
  var hoShort=['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  var h='<div class="ph"><div class="pt">&#127968; Homeoffice</div></div>';
  h+='<div class="fbar" style="flex-wrap:wrap;gap:6px;align-items:center">';
  h+='<div class="yr-row" style="margin:0"><button class="yb" onclick="S.year--;renderMain()">&#8249;</button><span class="yv">'+year+'</span><button class="yb" onclick="S.year++;renderMain()">&#8250;</button></div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
  for(var _mi=0;_mi<12;_mi++){h+='<button class="mb '+(_mi===month?'on':'')+'" style="padding:4px 8px;font-size:12px" onclick="S.month='+_mi+';renderMain()">'+hoShort[_mi]+'</button>';}
  h+='</div></div>';
  if(canManage){
    h+='<div class="tw" style="margin-bottom:14px"><div class="tt"><h2>&#9881;&#65039; Slot-Konfiguration</h2></div><div style="padding:12px">';
    h+='<div style="font-size:11px;color:var(--mu);margin-bottom:10px">Standard: 2 Plätze pro Tag (1x reserviert für C10). Abweichungen hier konfigurieren.</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">';
    h+='<div class="fg" style="margin:0"><label>Datum</label><input type="date" id="hoConfDate" style="font-size:12px" min="'+year+'-'+pad(month+1)+'-01" max="'+year+'-'+pad(month+1)+'-'+pad(lastDay.getDate())+'"></div>';
    h+='<div class="fg" style="margin:0"><label>Plätze (0–5)</label><input type="number" id="hoConfSlots" min="0" max="5" value="2" style="width:70px;font-size:12px"></div>';
    h+='<button class="btn-p" onclick="hoSaveConfig()">&#128190; Speichern</button></div>';
    if(confInMonth.length){
      h+='<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px">';
      confInMonth.forEach(function(c){h+='<span style="background:var(--sf2);border:1px solid var(--border);border-radius:4px;padding:2px 10px;font-size:11px;display:inline-flex;align-items:center;gap:6px">'+fmtDay(normDate(c.date))+': <strong>'+c.maxSlots+' Pl.</strong><button onclick="hoDeleteConfig('+JSON.stringify(normDate(c.date))+')" style="border:none;background:none;cursor:pointer;color:var(--danger);font-size:12px;padding:0">&#10005;</button></span>';});
      h+='</div>';
    }
    h+='</div></div>';
  }
  h+='<div class="tw"><div class="tt"><h2>&#128197; '+moName+' '+year+'</h2></div>';
  h+='<div style="overflow-x:auto"><table><thead><tr>';
  h+='<th style="text-align:left;width:200px">Tag</th>';
  h+='<th style="text-align:center;width:100px">Plätze<br><span style="font-size:9px;font-weight:400;color:var(--mu)">1× C10 reserviert</span></th>';
  h+='<th>Eingetragen</th><th style="width:130px"></th></tr></thead><tbody>';
  days.forEach(function(day){
    var bg=rowBg(day),bl=rowBl(day);
    var label=(day.isHol?'&#127877; ':'')+fmtDay(day.iso);
    var isMine=!!day.mySlot;
    var slotHtml=day.slots.map(function(s){var u=getU(s.userId);var clr=u&&u.color?u.color:'var(--acc)';return '<span style="background:'+clr+'22;color:'+clr+';border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600;margin-right:4px;cursor:default" title="'+(u?u.name:'?')+(s.box?' / '+s.box:'')+(s.dienst?' · '+s.dienst:'')+'">'+( u?u.initials:'?')+(s.box?' / '+s.box:'')+(s.dienst?' · '+s.dienst:'')+'</span>';}).join('');
    h+='<tr data-date="'+day.iso+'" style="background:'+bg+';'+bl+'">';
    h+='<td style="white-space:nowrap;font-weight:'+(isMine?700:400)+';font-size:12px">'+label+'</td>';
    h+='<td style="text-align:center"><span style="font-size:12px;font-weight:700;color:'+(day.free>0?'var(--ok)':'var(--danger)')+'">'+day.free+'/'+day.maxS+'</span></td>';
    h+='<td>'+(slotHtml||'<span style="color:var(--di);font-size:11px">—</span>')+'</td>';
    h+='<td style="white-space:nowrap">';
    if(day.free>0)h+='<button class="btn-ok" style="font-size:11px;padding:2px 8px;margin-right:3px" onclick="hoEintragen(\''+day.iso+'\')">&#43; Eintragen</button>';
    if(canManage&&day.slots.length>0){day.slots.forEach(function(sl){var u=getU(sl.userId);h+='<button class="btn-d" style="font-size:10px;padding:1px 5px;margin:1px" onclick="hoAustragen(\''+sl.id+'\')\" title="'+(u?u.name:'?')+'">&#10005; '+(u?u.initials:'?')+'</button>';});}
    else if(day.mySlot)h+='<button class="btn-d" style="font-size:11px;padding:2px 6px" onclick="hoAustragen(\''+day.mySlot.id+'\')">"&#10005;</button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div></div>';
  document.getElementById('main').innerHTML=h;
}
function hoEintragen(date){
  var boxes=(S.homeoffice&&S.homeoffice.boxes)||[];
  var dienste=(S.homeoffice&&S.homeoffice.dienste)||[];
  var existing=document.getElementById('hoFormRow');if(existing)existing.remove();
  var targetRow=document.querySelector('tr[data-date="'+date+'"]');
  if(!targetRow){toast('Zeile nicht gefunden','err');return;}
  var takenBoxes=(S.homeoffice&&S.homeoffice.slots||[]).filter(function(s){return(typeof s.date==='string'?s.date.slice(0,10):String(s.date).slice(0,10))===date;}).map(function(s){return s.box;});
  var freeBoxes=boxes.filter(function(b){return !takenBoxes.includes(b.label);});
  var formRow=document.createElement('tr');formRow.id='hoFormRow';
  formRow.innerHTML='<td colspan="4" style="padding:0"><div style="padding:10px;background:var(--sf2);border:1px solid var(--border);border-radius:var(--r);display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin:2px">'
    +'<div class="fg" style="margin:0"><label>Box</label><select id="hoBox" style="font-size:12px"><option value="">— wählen —</option>'+freeBoxes.map(function(b){return '<option value="'+b.label+'">'+b.label+'</option>';}).join('')+'</select></div>'
    +'<div class="fg" style="margin:0"><label>Dienst</label><select id="hoDienst" style="font-size:12px"><option value="">— wählen —</option>'+dienste.map(function(d){return '<option value="'+d.label+'">'+d.label+'</option>';}).join('')+'</select></div>'
    +'<button class="btn-p" style="font-size:12px" id="hoSaveBtn">&#10003; Eintragen</button>'
    +'<button class="btn-s" style="font-size:12px" id="hoCancelBtn">Abbrechen</button>'
    +'</div></td>';
  targetRow.insertAdjacentElement('afterend',formRow);
  var savedDate=date;
  document.getElementById('hoSaveBtn').onclick=function(){hoSaveSlot(savedDate);};
  document.getElementById('hoCancelBtn').onclick=function(){var r=document.getElementById('hoFormRow');if(r)r.remove();};
}
async function hoSaveSlot(date){
  var box=document.getElementById('hoBox')?document.getElementById('hoBox').value:'';
  var dienst=document.getElementById('hoDienst')?document.getElementById('hoDienst').value:'';
  if(box){var takenBox=(S.homeoffice&&S.homeoffice.slots||[]).filter(function(s){return(typeof s.date==='string'?s.date.slice(0,10):String(s.date).slice(0,10))===date&&s.box===box&&s.userId!==S.currentUser;});if(takenBox.length>0){toast('Diese Box ist am '+date+' bereits vergeben!','err');return;}}
  var slotsToday=(S.homeoffice&&S.homeoffice.slots||[]).filter(function(s){return(typeof s.date==='string'?s.date.slice(0,10):String(s.date).slice(0,10))===date;});
  var hasC10=slotsToday.some(function(s){return s.dienst==='C10';});
  var cfg=(S.homeoffice&&S.homeoffice.config||[]).find(function(c){return(typeof c.date==='string'?c.date.slice(0,10):String(c.date).slice(0,10))===date;});
  var maxS=cfg?cfg.maxSlots:2;
  if(slotsToday.length>=maxS-1&&!hasC10&&dienst!=='C10'){toast('Einer der '+maxS+' Plätze ist für den Dienst C10 reserviert!','err');return;}
  try{await api('POST','/homeoffice/slots',{date:date,box:box,dienst:dienst});await fetchData();renderHomeoffice();toast('✓ Homeoffice eingetragen!');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function hoAustragen(id){if(!confirm('Homeoffice-Eintrag löschen?'))return;try{await api('DELETE','/homeoffice/slots/'+id);await fetchData();renderHomeoffice();toast('✓ Ausgetragen.');}catch(e){toast('⚠️ '+e.message,'err');}}
async function hoSaveConfig(){var date=document.getElementById('hoConfDate')?document.getElementById('hoConfDate').value:'';var maxSlots=document.getElementById('hoConfSlots')?document.getElementById('hoConfSlots').value:2;if(!date){toast('Datum wählen!');return;}try{await api('PUT','/homeoffice/config',{date:date,maxSlots:parseInt(maxSlots)});await fetchData();renderHomeoffice();toast('✓ Gespeichert.');}catch(e){toast('⚠️ '+e.message,'err');}}
async function hoDeleteConfig(date){try{await api('PUT','/homeoffice/config',{date:date,maxSlots:-1});await fetchData();renderHomeoffice();}catch(e){toast('⚠️ '+e.message,'err');}}
function renderSubcatAdmin(){
  const list=document.getElementById('subcatList');if(!list)return;
  const DEPT_L={frei:'Frei',technik:'Technik',leitung:'Leitung',dienstplanung:'Dienstplanung',ausbildung:'Ausbildung',qm:'QM'};
  const grouped={};
  S.ticketSubcategories.forEach(s=>{(grouped[s.department]||(grouped[s.department]=[])).push(s);});
  if(!S.ticketSubcategories.length){list.innerHTML='<p style="font-size:12px;color:var(--mu)">Noch keine Unterkategorien vorhanden.</p>';return;}
  list.innerHTML=Object.keys(grouped).map(dept=>`
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--mu);margin-bottom:4px">${DEPT_L[dept]||dept}</div>
      ${grouped[dept].map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--sf);border-radius:6px;margin-bottom:4px;font-size:13px">
        <span style="flex:1">${s.label}</span>
        <button class="btn-s" style="color:#dc2626;padding:2px 8px" onclick="deleteSubcat('${s.id}')">&#10005;</button>
      </div>`).join('')}
    </div>`).join('');
}
async function addSubcat(){
  const dept=document.getElementById('scFDept')?.value||'';
  const label=(document.getElementById('scFLabel')?.value||'').trim();
  if(!dept||!label)return toast('⚠️ Fachbereich und Bezeichnung erforderlich','err');
  try{
    await api('POST','/ticket-subcategories',{department:dept,label:label});
    await fetchData();
    document.getElementById('scFLabel').value='';
    renderSubcatAdmin();
    toast('✅ Unterkategorie gespeichert');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteSubcat(id){
  if(!confirm('Unterkategorie wirklich löschen?'))return;
  try{
    await api('DELETE','/ticket-subcategories/'+id);
    await fetchData();
    renderSubcatAdmin();
    toast('✅ Gelöscht');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function renderStatsPanel(){
  const el=document.getElementById('statsPanel');if(!el)return;
  const tks=S.tickets;
  const open=tks.filter(t=>t.status!=='closed');
  const closed=tks.filter(t=>t.status==='closed');
  const today=new Date();today.setHours(0,0,0,0);
  const overdue=open.filter(t=>t.dueDate&&new Date(t.dueDate)<today);
  // Count by dept
  const byDept={};DEPTS.forEach(d=>{byDept[d]={open:0,closed:0};});
  tks.forEach(t=>{if(byDept[t.department]){if(t.status==='closed')byDept[t.department].closed++;else byDept[t.department].open++;}});
  // Count by prio
  const byPrio={high:0,medium:0,low:0};open.forEach(t=>{if(byPrio[t.priority]!==undefined)byPrio[t.priority]++;});
  // Count by status
  const byStatus={};STATUSES.forEach(s=>{byStatus[s.id]=0;});tks.forEach(t=>{if(byStatus[t.status]!==undefined)byStatus[t.status]++;});
  // Bar chart helper
  function barChart(data,colors){
    const max=Math.max(...data.map(d=>d.value),1);
    return`<div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding-top:8px">`+
      data.map(d=>`<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px">
        <span style="font-size:10px;font-weight:700;color:var(--tx)">${d.value}</span>
        <div style="width:100%;background:${colors[d.key]||'#3b6dd4'};border-radius:4px 4px 0 0;height:${Math.round((d.value/max)*60)+4}px;min-height:4px;transition:.3s"></div>
        <span style="font-size:9px;color:var(--mu);text-align:center;line-height:1.2">${d.label}</span>
      </div>`).join('')+`</div>`;
  }
  const deptData=DEPTS.filter(d=>d!=='frei').map(d=>({key:d,label:(DEPT_LABELS[d]||d).replace(/^[^\s]+\s/,''),value:byDept[d]?.open||0}));
  const deptColors={technik:'#f59e0b',leitung:'#3b6dd4',dienstplanung:'#10b981',ausbildung:'#8b5cf6',qm:'#06b6d4'};
  const prioData=[{key:'high',label:'Hoch',value:byPrio.high},{key:'medium',label:'Mittel',value:byPrio.medium},{key:'low',label:'Gering',value:byPrio.low}];
  const prioColors={high:'#ef4444',medium:'#f59e0b',low:'#10b981'};
  const stData=STATUSES.map(s=>({key:s.id,label:s.label,value:byStatus[s.id]||0}));
  const stColors={open:'#3b6dd4',in_progress:'#f59e0b',on_hold:'#8b5cf6',closed:'#10b981'};
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r);text-align:center">
        <div style="font-size:32px;font-weight:800;color:var(--acc)">${open.length}</div>
        <div style="font-size:11px;color:var(--mu)">Offene Tickets</div>
      </div>
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r);text-align:center">
        <div style="font-size:32px;font-weight:800;color:#10b981">${closed.length}</div>
        <div style="font-size:11px;color:var(--mu)">Abgeschlossen</div>
      </div>
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r);text-align:center">
        <div style="font-size:32px;font-weight:800;color:#dc2626">${overdue.length}</div>
        <div style="font-size:11px;color:var(--mu)">Überfällig</div>
      </div>
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r);text-align:center">
        <div style="font-size:32px;font-weight:800;color:#8b5cf6">${tks.filter(t=>!t.assigneeId&&t.status!=='closed').length}</div>
        <div style="font-size:11px;color:var(--mu)">Ohne Zuständigen</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r)">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">Offen nach Fachbereich</div>
        ${barChart(deptData,deptColors)}
      </div>
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r)">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">Offene nach Priorität</div>
        ${barChart(prioData,prioColors)}
      </div>
      <div style="padding:14px;background:var(--sf);border:1px solid var(--border);border-radius:var(--r)">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">Tickets nach Status</div>
        ${barChart(stData,stColors)}
      </div>
    </div>`;
}
function renderNoteTplAdmin(){
  const list=document.getElementById('noteTplList');if(!list)return;
  if(!S.noteTemplates.length){list.innerHTML='<p style="font-size:12px;color:var(--mu)">Noch keine Vorlagen.</p>';return;}
  list.innerHTML=S.noteTemplates.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--sf);border-radius:6px;margin-bottom:4px;font-size:13px">
    <span style="font-weight:600;min-width:100px">${t.label}</span>
    <span style="flex:1;color:var(--mu);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.body}</span>
    <button class="btn-d" style="padding:2px 8px" onclick="deleteNoteTpl('${t.id}')">✕</button>
  </div>`).join('');
}
async function addNoteTpl(){
  const label=(document.getElementById('ntFLabel')?.value||'').trim();
  const body=(document.getElementById('ntFBody')?.value||'').trim();
  if(!label||!body)return toast('⚠️ Label und Text erforderlich','err');
  try{await api('POST','/note-templates',{label,body});await fetchData();renderNoteTplAdmin();document.getElementById('ntFLabel').value='';document.getElementById('ntFBody').value='';toast('✅ Vorlage gespeichert');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteNoteTpl(id){
  if(!confirm('Vorlage löschen?'))return;
  try{await api('DELETE','/note-templates/'+id);await fetchData();renderNoteTplAdmin();toast('✅ Gelöscht');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function hoAddBox(){var label=document.getElementById('hoNewBox')?document.getElementById('hoNewBox').value.trim():'';if(!label)return;try{await api('POST','/homeoffice/boxes',{label:label});await fetchData();renderHoAdmin();}catch(e){toast('⚠️ '+e.message,'err');}}
async function hoDeleteBox(id){try{await api('DELETE','/homeoffice/boxes/'+id);await fetchData();renderHoAdmin();}catch(e){toast('⚠️ '+e.message,'err');}}
async function hoAddDienst(){var label=document.getElementById('hoNewDienst')?document.getElementById('hoNewDienst').value.trim():'';if(!label)return;try{await api('POST','/homeoffice/dienste',{label:label});await fetchData();renderHoAdmin();}catch(e){toast('⚠️ '+e.message,'err');}}
async function hoDeleteDienst(id){try{await api('DELETE','/homeoffice/dienste/'+id);await fetchData();renderHoAdmin();}catch(e){toast('⚠️ '+e.message,'err');}}
function renderHoAdmin(){
  var bl=document.getElementById('hoBoxList'),dl=document.getElementById('hoDienstList');
  if(!bl||!dl)return;
  var boxes=(S.homeoffice&&S.homeoffice.boxes)||[];
  var dienste=(S.homeoffice&&S.homeoffice.dienste)||[];
  bl.innerHTML='';
  if(boxes.length){boxes.forEach(function(b){var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)';row.innerHTML='<span>'+b.label+'</span>';var btn=document.createElement('button');btn.className='btn-d';btn.style.cssText='font-size:10px;padding:2px 6px';btn.innerHTML='&#10005;';btn.onclick=(function(id){return function(){hoDeleteBox(id);};})(b.id);row.appendChild(btn);bl.appendChild(row);});}
  else bl.innerHTML='<div style="color:var(--di);font-size:12px">Keine Boxen</div>';
  dl.innerHTML='';
  if(dienste.length){dienste.forEach(function(d){var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)';row.innerHTML='<span>'+d.label+'</span>';var btn=document.createElement('button');btn.className='btn-d';btn.style.cssText='font-size:10px;padding:2px 6px';btn.innerHTML='&#10005;';btn.onclick=(function(id){return function(){hoDeleteDienst(id);};})(d.id);row.appendChild(btn);dl.appendChild(row);});}
  else dl.innerHTML='<div style="color:var(--di);font-size:12px">Keine Dienste</div>';
}

// ══════════════════════════════════════════
// SECTION: Diensttausch @Mention
// ══════════════════════════════════════════
var _dtMentionAt=-1;
function dtMentionInput(ta){var val=ta.value,pos=ta.selectionStart,before=val.slice(0,pos),atIdx=before.lastIndexOf('@'),box=document.getElementById('dtMentionBox');if(atIdx<0){box.style.display='none';_dtMentionAt=-1;return;}var query=before.slice(atIdx+1);if(query.includes(' ')&&query.length>0){box.style.display='none';_dtMentionAt=-1;return;}_dtMentionAt=atIdx;var q2=query.toLowerCase();var matches=(S.users||[]).filter(function(u){return u.name.toLowerCase().startsWith(q2)&&u.id!==S.currentUser;}).slice(0,8);if(!matches.length){box.style.display='none';return;}box.innerHTML=matches.map(function(u,i){return '<div class="mention-item'+(i===0?' active':'')+'" data-name="'+u.name+'" onclick="dtPickMention('+JSON.stringify(u.name)+')">'+'<span style="background:'+(u.color||'var(--acc)')+';color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">'+u.initials+'</span>'+'<span>'+u.name+'</span></div>';}).join('');box.style.display='block';}
function dtPickMention(name){var ta=document.getElementById('dtText');if(!ta)return;var val=ta.value,endIdx=_dtMentionAt+1;while(endIdx<val.length&&val[endIdx]!==' '&&val[endIdx]!=='\n')endIdx++;var before=val.slice(0,_dtMentionAt),after=val.slice(endIdx);ta.value=before+'@'+name+' '+after;var np=before.length+name.length+2;ta.focus();ta.setSelectionRange(np,np);var box=document.getElementById('dtMentionBox');if(box)box.style.display='none';_dtMentionAt=-1;}
function dtMentionKey(e){var box=document.getElementById('dtMentionBox');if(!box||box.style.display==='none')return;var items=box.querySelectorAll('.mention-item'),active=box.querySelector('.mention-item.active'),idx=Array.from(items).indexOf(active);if(e.key==='ArrowDown'){e.preventDefault();items[idx]&&items[idx].classList.remove('active');items[Math.min(idx+1,items.length-1)]&&items[Math.min(idx+1,items.length-1)].classList.add('active');}else if(e.key==='ArrowUp'){e.preventDefault();items[idx]&&items[idx].classList.remove('active');items[Math.max(idx-1,0)]&&items[Math.max(idx-1,0)].classList.add('active');}else if(e.key==='Enter'||e.key==='Tab'){var act=box.querySelector('.mention-item.active');if(act){e.preventDefault();dtPickMention(act.dataset.name);}}else if(e.key==='Escape'){box.style.display='none';}}

// ══════════════════════════════════════════
// SECTION: News
// ══════════════════════════════════════════
async function loadNews(){
  try{
    var data=await api('GET','/news');
    S.news=data||[];
    updateBadges();
    if(S.view==='home')renderHome();
  }catch(e){console.error('loadNews error:',e);}
}
function renderNews(){
  var isArchiv=S.view==='news_archiv';
  var canEdit=S.p.manageUsers||(getU(S.currentUser)?.roles||[]).includes('leitung');
  var today=new Date().toISOString().slice(0,10);
  var news=S.news||[];
  var display=isArchiv?news.filter(function(n){return n.isExpired;}):news.filter(function(n){return !n.isExpired;});
  function fmtDate(d){if(!d)return'';var p=String(d).slice(0,10);return p.slice(8)+'.'+p.slice(5,7)+'.'+p.slice(0,4);}
  var h='<div class="ph"><div class="pt">&#128240; '+(isArchiv?'News-Archiv':'Aktuelle News')+'</div>'+(canEdit&&!isArchiv?'<button class="btn-p" onclick="openNewsForm(null)">&#65291; News erstellen</button>':'')+'</div>';
  if(!display.length){h+='<div class="empty">&#128240; Noch keine News</div>';document.getElementById('main').innerHTML=h;return;}
  h+='<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">';
  display.forEach(function(n){
    var isPast=n.fromDate&&today<n.fromDate;
    var opac=(canEdit&&isPast)?';opacity:.6':'';
    var accent=n.isImportant?'#ef4444':'var(--acc)';
    var badges='';
    if(n.isImportant)badges+='<span class="bdg ap-bdg-rejected" style="font-size:10px">&#9888;&#65039; Wichtig</span> ';
    if(isPast&&canEdit)badges+='<span class="bdg ap-bdg-pending" style="font-size:10px">Ab '+fmtDate(n.fromDate)+'</span>';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border)'+opac+'">';
    h+='<div style="width:3px;align-self:stretch;background:'+accent+';border-radius:2px;flex-shrink:0"></div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">'+badges+escHtml(n.title)+'</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu)">';
    h+='<span>Von: <strong>'+(getU(n.createdBy)?.name||'?')+'</strong></span>';
    if(n.fromDate)h+='<span>Ab: '+fmtDate(n.fromDate)+'</span>';
    if(n.toDate)h+='<span>Bis: '+fmtDate(n.toDate)+'</span>';
    h+='</div>';
    h+='<div style="font-size:12px;line-height:1.5;color:var(--tx);margin-top:6px;white-space:pre-wrap">'+n.body.slice(0,300)+(n.body.length>300?'\u2026':'')+'</div>';
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">';
    h+='<button class="btn-s" style="font-size:11px" onclick="toggleNewsPin(\''+n.id+'\','+n.isPinned+')">'+(n.isPinned?'&#128204; Lospinnen':'&#128203; Anpinnen')+'</button>';
    if(canEdit)h+='<button class="btn-e" style="font-size:11px" onclick="openNewsForm(\''+n.id+'\')">&#10000;</button>';
    if(canEdit)h+='<button class="btn-d" style="font-size:11px" onclick="deleteNews(\''+n.id+'\')">&#10005;</button>';
    h+='</div></div>';
  });
  h+='</div>';
  document.getElementById('main').innerHTML=h;
}
function openNewsForm(id){
  var n=id?(S.news||[]).find(function(x){return x.id===id;}):null;
  var existing=document.getElementById('newsFormOv');if(existing)existing.remove();
  var html='<div class="ov open" id="newsFormOv" style="z-index:1001"><div class="modal">'
    +'<div class="mh"><h2>'+(n?'News bearbeiten':'Neue News')+'</h2><button class="mc" onclick="document.getElementById(\'newsFormOv\').remove()">&#10005;</button></div>'
    +'<div class="mb2"><div class="fg full"><label>Titel *</label><input type="text" id="nFTitle" value="'+escHtml(n?n.title||'':'')+'"></div>'
    +'<div class="fg full"><label>Text</label><textarea id="nFBody" rows="5" style="font-family:inherit">'+escHtml(n?n.body||'':'')+'</textarea></div>'
    +'<div class="fr"><div class="fg"><label>Von</label><input type="date" id="nFFrom" value="'+(n?n.fromDate||'':'')+'"></div>'
    +'<div class="fg"><label>Bis</label><input type="date" id="nFTo" value="'+(n?n.toDate||'':'')+'"></div></div>'
    +'<div class="fg"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="nFImportant" '+(n&&n.isImportant?'checked':'')+' style="width:auto"> &#9888;&#65039; Wichtig</label></div>'
    +'</div><div class="mf"><button class="btn-s" onclick="document.getElementById(\'newsFormOv\').remove()">Abbrechen</button>'
    +'<button class="btn-p" id="newsSaveBtn">&#128190; Speichern</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('newsSaveBtn').onclick=function(){saveNews(id||'');};
}
async function saveNews(id){var title=document.getElementById('nFTitle')?.value?.trim();var body=document.getElementById('nFBody')?.value?.trim();if(!title){toast('Titel erforderlich!');return;}var payload={title:title,body:body||'',fromDate:document.getElementById('nFFrom')?.value||null,toDate:document.getElementById('nFTo')?.value||null,isImportant:document.getElementById('nFImportant')?.checked||false};try{if(id)await api('PUT','/news/'+id,payload);else await api('POST','/news',payload);document.getElementById('newsFormOv')?.remove();await loadNews();renderNews();toast('✓ Gespeichert!');}catch(e){toast('⚠️ '+e.message,'err');}}
async function deleteNews(id){if(!confirm('News löschen?'))return;try{await api('DELETE','/news/'+id);await loadNews();renderNews();toast('Gelöscht.');}catch(e){toast('⚠️ '+e.message,'err');}}
async function toggleNewsPin(id,isPinned){try{await api('PUT','/news/'+id+'/pin',{pinned:!isPinned});await loadNews();if(S.view==='news'||S.view==='news_archiv')renderNews();toast(isPinned?'Lospinnen OK':'&#128204; Angepinnt!');}catch(e){toast('⚠️ '+e.message,'err');}}

// ══════════════════════════════════════════
// SECTION: Urlaubsübersicht
// ══════════════════════════════════════════
function renderVacation(){
  var year=S.year,month=S.month!==null?S.month:new Date().getMonth();
  var firstDay=new Date(year,month,1),lastDay=new Date(year,month+1,0);
  var canManage=S.p.canApproveEvents||S.p.manageUsers;
  var moNames=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var dayNamesLong=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  var dayNamesShort=['So','Mo','Di','Mi','Do','Fr','Sa'];
  var moName=moNames[month];
  var pad=function(n){return String(n).padStart(2,'0');};
  var vacCats=S.categories.filter(function(c){return c.label&&c.label.toLowerCase().includes('urlaub');});
  var vacCatIds=vacCats.map(function(c){return c.id;});
  var cfgMap={};(S.vacationConfig||[]).forEach(function(c){cfgMap[c.date]={maxSlots:c.maxSlots,note:c.note};});
  var days=[];
  for(var dt=new Date(firstDay);dt<=lastDay;dt.setDate(dt.getDate()+1)){
    var iso=year+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
    var dow=dt.getDay();
    var vacEntries=S.events.filter(function(ev){if(ev.isGeneral||ev._anonymized)return false;if(!vacCatIds.length||!vacCatIds.includes(ev.category))return false;return ev.dateFrom<=iso&&ev.dateTo>=iso&&ev.approvalStatus!=='rejected';});
    var cfg=cfgMap[iso]||{maxSlots:8,note:''};
    days.push({iso:iso,dow:dow,day:dt.getDate(),dayName:dayNamesLong[dow],isWe:dow===0||dow===6,vacEntries:vacEntries,maxS:cfg.maxSlots,note:cfg.note,full:vacEntries.length>=cfg.maxSlots});
  }
  var today=new Date().toISOString().slice(0,10);
  var in90=new Date();in90.setDate(in90.getDate()+90);var in90s=in90.toISOString().slice(0,10);
  var myVac=S.events.filter(function(ev){return ev.userId===S.currentUser&&vacCatIds.includes(ev.category)&&ev.dateTo>=today&&ev.dateFrom<=in90s;}).sort(function(a,b){return a.dateFrom.localeCompare(b.dateFrom);});
  var h='<div class="ph"><div class="pt">&#127958;&#65039; Urlaubsübersicht</div>'
    +'<div style="display:flex;gap:6px">'
    +'<button class="btn-s" style="padding:4px 10px" onclick="S.month=S.month!==null?S.month===0?(S.year--,11):S.month-1:new Date().getMonth();renderMain()">&#8249;</button>'
    +'<span style="font-weight:700;font-size:14px">'+moName+' '+year+'</span>'
    +'<button class="btn-s" style="padding:4px 10px" onclick="S.month=S.month!==null?S.month===11?(S.year++,0):S.month+1:new Date().getMonth()+1;if(S.month>11){S.month=0;S.year++;}renderMain()">&#8250;</button>'
    +'</div></div>';
  if(!vacCatIds.length)h+='<div class="wb">&#9888;&#65039; Keine Kategorie "Urlaub" gefunden. Bitte in Administration anlegen.</div>';
  if(myVac.length){
    h+='<div class="tw" style="margin-bottom:14px"><div class="tt"><h2>&#128197; Meine Urlaube (90 Tage)</h2></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;padding:12px">';
    myVac.forEach(function(ev){var cat=S.categories.find(function(c){return c.id===ev.category;});var st=ev.approvalStatus==='approved'?'<span class="bdg ap-bdg-approved" style="font-size:10px">&#10003;</span>':ev.approvalStatus==='rejected'?'<span class="bdg ap-bdg-rejected" style="font-size:10px">&#10007;</span>':'<span class="bdg ap-bdg-pending" style="font-size:10px">&#8987;</span>';h+='<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);padding:10px;border-left:3px solid '+(cat&&cat.color||'var(--ok)')+'"><div style="font-size:12px;font-weight:700">'+fmtDateShort(ev.dateFrom)+' – '+fmtDateShort(ev.dateTo)+'</div><div style="font-size:11px;color:var(--mu)">'+(ev.reason||'Urlaub')+'</div>'+st+'</div>';});
    h+='</div></div>';
  }
  h+='<div class="tw"><div class="tt"><h2>&#128197; '+moName+' '+year+'</h2></div><div style="overflow-x:auto"><table><thead><tr>';
  h+='<th style="text-align:left">Tag</th><th style="text-align:center">Urlaube</th><th>Mitarbeiter</th>'+(canManage?'<th>Konfiguration</th>':'')+'</tr></thead><tbody>';
  days.forEach(function(day){
    var full=day.full&&!day.isWe;
    var cc=day.vacEntries.length===0?'var(--di)':full?'var(--danger)':'var(--warn)';
    var users=day.vacEntries.map(function(ev){var u=getU(ev.userId);return u?'<span style="background:'+(u.color||'var(--acc)')+'22;color:'+(u.color||'var(--acc)')+';border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;margin-right:3px" title="'+u.name+'">'+u.initials+'</span>':'';}).join('');
    var label=pad(day.day)+'. '+moName+' '+year+' ('+day.dayName+')';
    h+='<tr style="'+(day.isWe?'opacity:.7':'')+(full?';border-left:3px solid var(--danger)':'')+'">';
    h+='<td style="white-space:nowrap;font-size:12px">'+label+'</td>';
    h+='<td style="text-align:center"><span style="font-weight:700;color:'+cc+'">'+day.vacEntries.length+'/'+day.maxS+'</span></td>';
    h+='<td>'+(users||'<span style="color:var(--di);font-size:11px">—</span>')+(day.note?'<div style="font-size:10px;color:var(--mu);font-style:italic">'+escHtml(day.note)+'</div>':'')+'</td>';
    if(canManage)h+='<td><div style="display:flex;gap:4px;align-items:center"><input type="number" min="0" max="20" value="'+day.maxS+'" style="width:50px;font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:3px" id="vacMax_'+day.iso+'"><input type="text" placeholder="Bemerkung" value="'+escHtml(day.note)+'" style="flex:1;font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:3px" id="vacNote_'+day.iso+'"><button class="btn-ok" style="font-size:10px;padding:2px 6px;white-space:nowrap" onclick="vacSaveConfig(\''+day.iso+'\')">&#128190;</button></div></td>';
    h+='</tr>';
  });
  h+='</tbody></table></div></div>';
  document.getElementById('main').innerHTML=h;
}
async function vacSaveConfig(date){var maxSlots=parseInt(document.getElementById('vacMax_'+date)?.value??8);var note=document.getElementById('vacNote_'+date)?.value||'';try{await api('PUT','/vacation/config',{date:date,maxSlots:maxSlots,note:note});await fetchData();renderVacation();toast('✓ Gespeichert.');}catch(e){toast('⚠️ '+e.message,'err');}}


// Persistent collapsible cards via <details>
document.addEventListener('toggle', function(e) {
  if(e.target.tagName === 'DETAILS' && e.target.dataset.ccId) {
    try { localStorage.setItem('cc_'+e.target.dataset.ccId, e.target.open ? '1' : '0'); } catch(ex) {}
  }
}, true);
function initPersistCards() {
  document.querySelectorAll('details[data-cc-id]').forEach(function(d) {
    try {
      var v = localStorage.getItem('cc_'+d.dataset.ccId);
      if(v === '0') d.removeAttribute('open');
      else d.setAttribute('open','');
    } catch(ex) {}
  });
}

// BOOT
(async()=>{
  const theme=localStorage.getItem('lst_theme')||'light';
  document.documentElement.setAttribute('data-theme',theme);
  document.getElementById('thBtn').textContent=theme==='dark'?'\u2600\uFE0F':'\uD83C\uDF19';
  await loadLoginUsers();
  try{const me=await api('GET','/auth/me');if(me?.userId){S.currentUser=me.userId;loading(true);await fetchData();loading(false);loginOK();}}
  catch(e){loading(false);}
})();


// ══════════════════════════════════════════
// SECTION: Zahnarzt Dienstplan
// ══════════════════════════════════════════

// Entry lookup – avoids JSON-in-onclick bugs
const _zdMap = {};
function _zdGet(id) { return _zdMap[id]; }

function weekMonday(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtWeekLabel(monISO) {
  const sun = addDays(monISO, 6);
  const fmt = iso => { const p = iso.split('-'); return p[2]+'.'+p[1]+'.'+p[0].slice(2); };
  return fmt(monISO) + ' – ' + fmt(sun);
}

async function loadZahnarztData() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let qs = '';
    if (S.zahnarztWeek) {
      qs = '?from=' + S.zahnarztWeek + '&to=' + addDays(S.zahnarztWeek, 6);
    } else {
      qs = '?from=' + today;
    }
    S.zahnarztData = await api('GET', '/zahnarzt/dienste' + qs) || [];
    // rebuild lookup
    for (const e of S.zahnarztData) _zdMap[e.id] = e;
  } catch(e) { S.zahnarztData = []; }
}

async function renderZahnarzt() {
  await loadZahnarztData();
  _renderZahnarzt();
}

function _renderZahnarzt() {
  const today   = new Date().toISOString().slice(0, 10);
  const hols    = new Set([...getAustrianHolidays(new Date().getFullYear()),
                           ...getAustrianHolidays(new Date().getFullYear()+1)]);
  const canEdit = !!(S.p.roles||[]).some(r=>['admin','technik','leitung','dienstplanung'].includes(r));
  const canDel  = !!(S.p.roles||[]).some(r=>['admin','technik'].includes(r));

  // Group by date
  const byDate = {};
  for (const e of S.zahnarztData) {
    (byDate[e.datum] = byDate[e.datum]||[]).push(e);
  }
  const dates = Object.keys(byDate).sort();

  const DOW = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  function dayInfo(datum) {
    const d = new Date(datum+'T00:00:00');
    const dow = d.getDay();
    const isHol = hols.has(datum);
    const isWe  = dow===0||dow===6;
    const isTod = datum===today;
    const isPast= datum<today;
    return { dow, isHol, isWe, isTod, isPast,
      label: DOW[dow]+', '+datum.slice(8)+'.'+datum.slice(5,7)+'.'+datum.slice(0,4) };
  }

  function dayHeader(datum) {
    const { isHol, isWe, isTod, isPast, label } = dayInfo(datum);
    let bg='', border='', textCol='var(--tx)', badge='';
    if (isTod)       { bg='rgba(16,185,129,.10)'; border='#10b981'; textCol='var(--ok)'; badge='<span class="bdg ap-bdg-approved" style="font-size:10px">Heute</span>'; }
    else if (isPast) { bg='var(--sf2)'; border='var(--border)'; textCol='var(--di)'; }
    else if (isHol)  { bg='rgba(124,58,237,.06)'; border='#7c3aed'; textCol='var(--info)'; badge='<span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:var(--info)">Feiertag</span>'; }
    else if (isWe)   { bg='rgba(245,158,11,.07)'; border='var(--warn)'; textCol='var(--warn)'; badge='<span class="bdg" style="font-size:10px;background:rgba(245,158,11,.12);color:var(--warn)">Wochenende</span>'; }
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:${bg};border-left:4px solid ${border};border-radius:var(--r) var(--r) 0 0">
      <span style="font-size:13px;font-weight:700;color:${textCol}">${label}</span>
      ${badge}
    </div>`;
  }

  function entryCard(e) {
    const { isPast } = dayInfo(e.datum);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border);${isPast?'opacity:.6':''}">
      <div style="width:3px;align-self:stretch;background:var(--acc);border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">${escHtml(e.zahnarzt)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu)">
          ${e.bezirk?`<span>&#127757; ${escHtml(e.bezirk)}</span>`:''}
          ${e.uhrzeit?`<span>&#128336; ${escHtml(e.uhrzeit)}</span>`:''}
          ${e.erreichbarkeit&&e.erreichbarkeit!=='-'?`<span>&#128222; ${escHtml(e.erreichbarkeit)}</span>`:''}
        </div>
      </div>
      <button class="btn-e" style="flex-shrink:0;font-size:12px;padding:5px 8px" onclick="_zdOpen('${e.id}')">&#9998;</button>
    </div>`;
  }

  let cards = '';
  if (!dates.length) {
    cards = `<div class="empty" style="padding:40px">&#129464; Keine Eintr&auml;ge f&uuml;r diesen Zeitraum</div>`;
  } else {
    for (const datum of dates) {
      cards += `<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">
        ${dayHeader(datum)}
        ${byDate[datum].map(entryCard).join('')}
      </div>`;
    }
  }

  const weekLbl = S.zahnarztWeek ? fmtWeekLabel(S.zahnarztWeek) : '';
  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div class="pt">&#129464; Dienstplan Zahn&#228;rzte</div>
      <div style="display:flex;gap:6px">
        ${canEdit?`<button class="btn-s" onclick="_zdOpen(null)">&#65291; Eintrag</button>`:''}
        ${canDel?`<button class="btn-p" onclick="openZahnarztUpload()">&#128196; Excel</button>`:''}
      </div>
    </div>
    <div class="fbar" style="gap:6px;align-items:center;flex-wrap:wrap">
      <button class="yb" onclick="zahnarztWeekPrev()">&#8249;</button>
      <button class="mb ${!S.zahnarztWeek?'on':''}" style="padding:4px 10px;font-size:12px" onclick="S.zahnarztWeek=null;renderZahnarzt()">Ab heute</button>
      ${S.zahnarztWeek?`<span style="font-size:13px;font-weight:600;color:var(--acc)">${weekLbl}</span>`:''}
      <button class="yb" onclick="zahnarztWeekNext()">&#8250;</button>
      <span style="font-size:11px;color:var(--di);margin-left:4px">${dates.length} Tag${dates.length!==1?'e':''}, ${S.zahnarztData.length} Eintrag${S.zahnarztData.length!==1?'e':''}</span>
    </div>
    <div>${cards}</div>`;
}

function zahnarztWeekPrev() {
  S.zahnarztWeek = addDays(S.zahnarztWeek||weekMonday(new Date().toISOString().slice(0,10)), -7);
  renderZahnarzt();
}
function zahnarztWeekNext() {
  S.zahnarztWeek = addDays(S.zahnarztWeek||weekMonday(new Date().toISOString().slice(0,10)), 7);
  renderZahnarzt();
}

// ── Edit modal (ID-based, no JSON-in-onclick) ─────────────────────
function _zdOpen(id) {
  const e = id ? _zdGet(id) : null;
  const canDel = id && !!(S.p.roles||[]).some(r=>['admin','technik'].includes(r));
  const ov = document.createElement('div');
  ov.className='ov'; ov.id='zahnarztFormOv';
  ov.innerHTML=`<div class="modal sm">
    <div class="mh"><h2>${e?'&#9998; Bearbeiten':'&#65291; Neuer Eintrag'}</h2>
      <button class="mc" onclick="this.closest('.ov').remove()">&#10005;</button></div>
    <div class="mb2">
      <div class="fg"><label>Datum</label><input type="date" id="zfDatum" class="flt" style="width:100%" value="${e?.datum||new Date().toISOString().slice(0,10)}"></div>
      <div class="fg"><label>Bezirk</label><input id="zfBezirk" class="flt" style="width:100%" value="${escHtml(e?.bezirk||'')}"></div>
      <div class="fg"><label>Zahnarzt / Ordination</label><input id="zfZahnarzt" class="flt" style="width:100%" value="${escHtml(e?.zahnarzt||'')}"></div>
      <div class="fg"><label>Uhrzeit</label><input id="zfUhr" class="flt" style="width:100%" value="${escHtml(e?.uhrzeit||'')}"></div>
      <div class="fg"><label>Erreichbarkeit / Telefon</label><input id="zfErr" class="flt" style="width:100%" value="${escHtml(e?.erreichbarkeit||'')}"></div>
    </div>
    <div class="mf">
      ${canDel?`<button class="btn-d" onclick="deleteZahnarzt('${id}')">&#128465; L&ouml;schen</button>`:'<span></span>'}
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.ov').remove()">Abbrechen</button>
        <button class="btn-p" onclick="saveZahnarzt(${id?`'${id}'`:'null'})">&#10003; Speichern</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('open'));
}

async function saveZahnarzt(id) {
  const payload = {
    bezirk: document.getElementById('zfBezirk')?.value.trim()||'',
    datum:  document.getElementById('zfDatum')?.value||'',
    zahnarzt: document.getElementById('zfZahnarzt')?.value.trim()||'',
    uhrzeit:  document.getElementById('zfUhr')?.value.trim()||'',
    erreichbarkeit: document.getElementById('zfErr')?.value.trim()||'',
    tag:'',
  };
  if(!payload.datum||!payload.zahnarzt){toast('Datum und Zahnarzt erforderlich!');return;}
  try{
    if(id) await api('PUT','/zahnarzt/dienste/'+id,payload);
    else   await api('POST','/zahnarzt/dienste',payload);
    document.getElementById('zahnarztFormOv')?.remove();
    await renderZahnarzt();
    toast('✅ Gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}

async function deleteZahnarzt(id){
  if(!confirm('Eintrag löschen?'))return;
  try{
    await api('DELETE','/zahnarzt/dienste/'+id);
    document.getElementById('zahnarztFormOv')?.remove();
    await renderZahnarzt();
    toast('Gelöscht.');
  }catch(e){toast('⚠️ '+e.message,'err');}
}

// ── Upload modal ──────────────────────────────────────────────────
function openZahnarztUpload(){
  const ov=document.createElement('div');
  ov.className='ov';ov.id='zahnarztUploadOv';
  ov.innerHTML=`<div class="modal sm">
    <div class="mh"><h2>&#128196; Excel importieren</h2>
      <button class="mc" onclick="this.closest('.ov').remove()">&#10005;</button></div>
    <div class="mb2">
      <div class="ib3">Spalten: <strong>Bezirk, Datum, Tag, Uhrzeit, Erreichbarkeit, Zahnarzt</strong><br>Datum als Excel-Datum oder DD.MM.YYYY.</div>
      <div class="fg"><label>Excel-Datei (.xlsx)</label>
        <input type="file" id="zUpFile" accept=".xlsx,.xls" style="font-size:13px"></div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="zUpReplace" checked style="width:auto">
        Bestehende Eintr&auml;ge f&uuml;r importierte Daten ersetzen
      </label>
    </div>
    <div class="mf">
      <button onclick="this.closest('.ov').remove()">Abbrechen</button>
      <button class="btn-p" onclick="doZahnarztUpload()">&#128196; Importieren</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('open'));
}

async function doZahnarztUpload(){
  const file=document.getElementById('zUpFile')?.files?.[0];
  if(!file){toast('Bitte Datei wählen!');return;}
  const replace=document.getElementById('zUpReplace')?.checked??true;
  loading(true);
  try{
    const b64=await new Promise((res,rej)=>{
      const fr=new FileReader();
      fr.onload=e=>res(e.target.result.split(',')[1]);
      fr.onerror=rej;
      fr.readAsDataURL(file);
    });
    const result=await api('POST','/zahnarzt/upload',{fileData:b64,fileName:file.name,replaceExisting:replace});
    document.getElementById('zahnarztUploadOv')?.remove();
    await renderZahnarzt();
    toast('✅ '+result.count+' Einträge importiert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
  finally{loading(false);}
}

// ── Wiedervorlage ──
async function setSnooze(tkId){
  const val=document.getElementById('snoozeDate')?.value;
  if(!val)return toast('⚠️ Datum wählen','err');
  try{await api('PUT','/tickets/'+tkId,{snoozedUntil:val});await fetchData();renderTkDetail();toast('✅ Wiedervorlage gesetzt: '+new Date(val).toLocaleDateString('de-DE'));}
  catch(e){toast('⚠️ '+e.message,'err');}
}
const snoozeBdg=tk=>{
  if(!tk.snoozedUntil||tk.status==='closed')return'';
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(tk.snoozedUntil);d.setHours(0,0,0,0);
  if(d>today)return`<span class="bdg" style="background:#f0f9ff;color:#0284c7;border:1px solid #7dd3fc">💤 bis ${d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</span>`;
  return'';
};

// ── Batch-Aktionen ──
function toggleTkBatch(){S.tkBatchMode=!S.tkBatchMode;S.tkBatchSel.clear();renderTickets();}
function batchToggleTk(id){if(S.tkBatchSel.has(id))S.tkBatchSel.delete(id);else S.tkBatchSel.add(id);renderTickets();}
async function batchApply(){
  const ids=[...S.tkBatchSel];if(!ids.length)return;
  const status=document.getElementById('batchStatus')?.value;
  const assignee=document.getElementById('batchAssignee')?.value;
  if(!status&&!assignee)return toast('⚠️ Bitte Status oder Bearbeiter wählen','err');
  const body={};
  if(status)body.status=status;
  if(assignee)body.assigneeId=assignee==='__none__'?null:assignee;
  loading(true);
  try{
    await Promise.all(ids.map(id=>api('PUT','/tickets/'+id,body)));
    await fetchData();S.tkBatchSel.clear();renderTickets();
    toast('✅ '+ids.length+' Tickets aktualisiert');
  }catch(e){toast('⚠️ '+e.message,'err');}finally{loading(false);}
}

// ── Quick-Action-Button ──
function _qaItems(){
  const items=[];
  items.push({icon:'🎫',label:'Ticket erstellen',action:()=>openTkForm(null)});
  if(S.p.canSendMessages)items.push({icon:'✉️',label:'Nachricht senden',action:()=>openMsgForm()});
  items.push({icon:'🏠',label:'Homeoffice eintragen',action:()=>setView('homeoffice')});
  items.push({icon:'📅',label:'Eintrag anlegen',action:()=>openEvtModal()});
  return items;
}
function toggleQA(){
  const menu=document.getElementById('qaMenu');
  const fab=document.getElementById('qaFab');
  if(!menu)return;
  const open=menu.style.display==='flex';
  if(open){menu.style.display='none';fab.style.transform='';fab.style.boxShadow='';}
  else{
    menu.innerHTML=_qaItems().map((it,i)=>`
      <button onclick="qaAction(${i})" style="display:flex;align-items:center;gap:8px;background:var(--sf);border:1px solid var(--border);border-radius:20px;padding:7px 14px 7px 10px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap;font-family:inherit;color:var(--tx);transition:.15s" onmouseover="this.style.borderColor='var(--acc)';this.style.color='var(--acc)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--tx)'">
        <span style="font-size:16px">${it.icon}</span>${it.label}
      </button>`).join('');
    menu.style.display='flex';
    fab.style.transform='rotate(45deg)';
    fab.style.boxShadow='0 6px 20px rgba(0,0,0,.3)';
  }
}
function qaAction(i){
  toggleQA();
  _qaItems()[i]?.action();
}
document.addEventListener('click',function(e){
  const wrap=document.getElementById('qaWrap');
  if(wrap&&!wrap.contains(e.target)){
    const menu=document.getElementById('qaMenu');
    const fab=document.getElementById('qaFab');
    if(menu&&menu.style.display==='flex'){menu.style.display='none';if(fab){fab.style.transform='';fab.style.boxShadow='';}}
  }
});

// ── Globale Suche ──
let _gSearchIdx=0;
function openGSearch(){
  const ov=document.getElementById('gSearchOv');if(!ov)return;
  ov.style.display='flex';
  const inp=document.getElementById('gSearchInput');if(inp){inp.value='';inp.focus();}
  document.getElementById('gSearchResults').innerHTML='<div style="padding:20px;text-align:center;color:var(--mu);font-size:13px">Suchbegriff eingeben…</div>';
  _gSearchIdx=0;
}
function closeGSearch(){const ov=document.getElementById('gSearchOv');if(ov)ov.style.display='none';}
function _gsEsc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function _gsHl(s,q){if(!q)return _gsEsc(s);const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return _gsEsc(s).replace(re,'<mark style="background:#fef08a;color:#713f12;border-radius:2px;padding:0 1px">$1</mark>');}
function renderGSearch(){
  const q=(document.getElementById('gSearchInput')?.value||'').trim().toLowerCase();
  const box=document.getElementById('gSearchResults');if(!box)return;
  _gSearchIdx=0;
  if(q.length<2){box.innerHTML='<div style="padding:20px;text-align:center;color:var(--mu);font-size:13px">Mindestens 2 Zeichen eingeben</div>';return;}
  const results=[];
  // Tickets
  S.tickets.filter(t=>(t.title+' '+t.number+' '+(t.description||'')).toLowerCase().includes(q)).slice(0,6).forEach(t=>{
    const overdue=t.dueDate&&t.status!=='closed'&&new Date(t.dueDate)<new Date();
    results.push({type:'ticket',icon:'🎫',label:t.number+': '+t.title,sub:(DEPT_LABELS[t.department]||t.department)+' · '+STATUSES.find(s=>s.id===t.status)?.label+(overdue?' · ⚠️ Überfällig':''),action:()=>openTkDetail(t.id),accent:'#3b6dd4'});
  });
  // Nachrichten
  (S.messages||[]).filter(m=>((m.title||'')+(m.body||'')).toLowerCase().includes(q)).slice(0,4).forEach(m=>{
    results.push({type:'msg',icon:'✉️',label:m.title||'(kein Betreff)',sub:'von '+(getU(m.senderId)?.name||'?')+' · '+fdt(m.createdAt),action:()=>{closeGSearch();setView('messages');setTimeout(()=>openMsg(m.id),100);},accent:'#10b981'});
  });
  // Mitarbeiter
  S.users.filter(u=>(u.name||'').toLowerCase().includes(q)).slice(0,4).forEach(u=>{
    const roles=(u.roles||[]).map(r=>ROLES.find(x=>x.id===r)?.label||r).join(', ');
    results.push({type:'user',icon:'👤',label:u.name,sub:roles||'',action:()=>{closeGSearch();if(S.p.manageUsers)openUF(u.id);},accent:'#f59e0b'});
  });
  // News
  (S.news||[]).filter(n=>(n.title+(n.body||'')).toLowerCase().includes(q)).slice(0,3).forEach(n=>{
    results.push({type:'news',icon:'📰',label:n.title,sub:n.body?.slice(0,60)||'',action:()=>{closeGSearch();setView('news');},accent:'#8b5cf6'});
  });
  if(!results.length){box.innerHTML='<div style="padding:20px;text-align:center;color:var(--mu);font-size:13px">Keine Ergebnisse für „'+_gsEsc(q)+'"</div>';return;}
  box.innerHTML=results.map((r,i)=>`
    <div class="gs-item" data-i="${i}" onclick="_gsGo(${i})" onmouseover="_gsHover(${i})" style="display:flex;align-items:center;gap:12px;padding:10px 18px;cursor:pointer;transition:.1s;${i===0?'background:var(--sf2)':''}">
      <span style="font-size:20px;flex-shrink:0">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_gsHl(r.label,q)}</div>
        <div style="font-size:11px;color:var(--mu)">${_gsEsc(r.sub)}</div>
      </div>
      <div style="width:4px;height:36px;background:${r.accent};border-radius:2px;flex-shrink:0"></div>
    </div>`).join('');
  box._gsResults=results;
}
function _gsHover(i){_gSearchIdx=i;document.querySelectorAll('#gSearchResults .gs-item').forEach((el,j)=>el.style.background=j===i?'var(--sf2)':'');}
function _gsGo(i){const r=document.getElementById('gSearchResults')?._gsResults?.[i];if(r){closeGSearch();r.action();}}
function gSearchKey(e){
  const items=document.querySelectorAll('#gSearchResults .gs-item');const n=items.length;
  if(!n)return;
  if(e.key==='ArrowDown'){e.preventDefault();_gSearchIdx=(_gSearchIdx+1)%n;_gsHover(_gSearchIdx);}
  else if(e.key==='ArrowUp'){e.preventDefault();_gSearchIdx=(_gSearchIdx-1+n)%n;_gsHover(_gSearchIdx);}
  else if(e.key==='Enter'){e.preventDefault();_gsGo(_gSearchIdx);}
}
