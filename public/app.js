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

const APP_VERSION='3.0.0';
// PWA: ermöglicht "Zum Home-Bildschirm hinzufügen" auf iOS/Android — siehe
// public/sw.js für die Cache-Strategie (App-Daten selbst werden nie gecacht).
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}
function _urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  const arr=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return arr;
}
// Push-Benachrichtigungen (z.B. neue Chat-Nachricht) — auf iOS nur nutzbar,
// wenn die App zum Home-Bildschirm hinzugefügt wurde (ab iOS 16.4), sonst
// bricht requestPermission()/subscribe() einfach mit einer Fehlermeldung ab.
async function enablePushNotifications(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){toast('⚠️ Push wird von diesem Browser nicht unterstützt','err');return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('⚠️ Berechtigung nicht erteilt','err');return;}
    const {publicKey}=await api('GET','/push/vapid-public-key');
    const reg=await navigator.serviceWorker.ready;
    // Eine bestehende Subscription ist fix an den VAPID-Key gebunden, mit dem
    // sie erstellt wurde — bei jedem "Aktivieren" verwerfen und neu abonnieren,
    // sonst bleibt sie nach einem Schlüsselwechsel auf dem Server hängen und
    // der Push-Dienst lehnt mit "BadJwtToken" ab (Schlüssel passt nicht mehr).
    const existing=await reg.pushManager.getSubscription();
    if(existing) await existing.unsubscribe();
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:_urlBase64ToUint8Array(publicKey)});
    await api('POST','/push/subscribe', sub.toJSON());
    toast('✅ Push-Benachrichtigungen aktiviert!');
  }catch(e){toast('⚠️ '+(e.message||'Push konnte nicht aktiviert werden'),'err');}
}
const MONTHS=['J\u00e4nner','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const PALETTE=['#3b6dd4','#10b981','#7c3aed','#e87bb0','#f59e0b','#ef4444','#0ea5e9','#84cc16','#f97316','#6366f1','#64748b','#14b8a6'];
const PAL_DARK=['#e8c547','#5bc4a0','#7b8be8','#e87bb0','#c47b5b','#e85b5b','#5bc4e8','#a0e85b','#e8a05b','#5b8be8','#8888a8','#a05be8'];
const ROLES=[{id:'admin',label:'Administrator',icon:'\uD83D\uDD11'},{id:'leitung',label:'Leitung',icon:'\u2B50'},{id:'dienstplanung',label:'Dienstplanung',icon:'\uD83D\uDCCB'},{id:'schichtleiter',label:'Schichtleiter',icon:'\uD83D\uDD06'},{id:'technik',label:'Technik',icon:'\uD83D\uDD27'},{id:'ausbildung',label:'Ausbildung',icon:'\uD83C\uDF93'},{id:'qm',label:'QM',icon:'\u2705'},{id:'standard',label:'Standard',icon:'\uD83D\uDC64'}];
// Fallback bis der erste fetchData()-Aufruf die echten (admin-verwaltbaren)
// Fachbereiche aus S.departments geliefert hat \u2014 danach werden beide unten
// in fetchData() neu aufgebaut, alle bestehenden Stellen, die DEPTS/
// DEPT_LABELS verwenden, profitieren automatisch ohne \u00C4nderung.
let DEPTS=['technik','leitung','dienstplanung','ausbildung','qm','frei'];
let DEPT_LABELS={technik:'\uD83D\uDD27 Technik',leitung:'\u2B50 Leitung',dienstplanung:'\uD83D\uDCCB Dienstplanung',ausbildung:'\uD83C\uDF93 Ausbildung',qm:'\u2705 QM',frei:'\uD83C\uDF10 Frei'};
const PRIORITIES=[{id:'low',label:'\uD83D\uDFE2 Gering',color:'#10b981'},{id:'medium',label:'\uD83D\uDFE1 Mittel',color:'#f59e0b'},{id:'high',label:'\uD83D\uDD34 Hoch',color:'#ef4444'}];
const STATUSES=[{id:'open',label:'Offen'},{id:'in_progress',label:'In Bearbeitung'},{id:'on_hold',label:'Zur\u00fcckgestellt'},{id:'closed',label:'Abgeschlossen'},{id:'cancelled',label:'Storniert'}];
// Tickets gelten als "abgeschlossen/inaktiv" (nicht mehr offen) bei diesen
// beiden Status \u2014 zentrale Stelle statt an jeder Filter-/Z\u00e4hlstelle einzeln
// "closed" abzufragen, damit "cancelled" nirgends vergessen wird.
const TK_INACTIVE_STATUSES=['closed','cancelled'];
const isTkClosed=tk=>TK_INACTIVE_STATUSES.includes(tk.status);
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
  events:[],users:[],categories:[],tags:[],allowances:[],tickets:[],ticketSubcategories:[],noteTemplates:[],stationSessions:[],stationShifts:[],
  stationOutages:[],links:[],rolePermissions:[],_onBreak:false,
  docs:[],docCategories:[],_docFilter:'all',_docSearch:'',
  meetings:[], _selMeeting:null, _selInstance:null,
  tkBatchMode:false,tkBatchSel:new Set(),_tkFeedFilter:'all',_tkTab:'details',tkGroupBy:'dept',tkFiltSubcat:'',
  checklists:[],messages:[],notifications:[],abrechnung:{einspringer:[],homeoffice:[]},dienstplaene:[],
  p:{canApproveEvents:false,canSendMessages:false,seeAllEntries:true,editAllPersonal:false,addForOthers:false,addGeneral:false,manageUsers:false,seeAllAllw:false,editAllw:false,seeAllAbrechnung:false,manageSop:false,canManageSpint:false},
  tp:{seeAll:false,editAll:false,myDepts:[],canSetPublic:false,canAssign:false,canSeeSubcat:false,canEditSubcat:false,roles:[]},
  dpPlans:[], dpShiftTypes:[], dpAbsenceTypes:[], dpEmpParams:[], dpQualifications:[], dpShiftPrefs:[], dpProtocol:[], dpEmpRules:[],
  todos:[], _selTodo:null,
  contacts:[], _contactSearch:'',
  sopTemplates:[], sopRuns:[], _sopView:'overview', _sopSearch:'', _sopCatFilter:'',
  _selSopTemplateId:null, _selSopRunId:null,
  lockers:[], _spintFilter:'',
  departments:[],
  chatThreads:[], chatMessages:[],
  _dpPlanId:null, _dpMatrix:null, _dpStatsExpanded:false, _dpConfigTab:'shift-types', _dpSelection:new Set(),
  _dpQualLocalChanges:{}, _dpQualLocalPrefsChanges:{}, _dpReportExpanded: false,
  _dpQualWeightsExpanded:{}, _dpQualSearchQuery:'',
  _dpCategoryExpanded:{},
};
async function api(method,path2,body){
  const opts={method,credentials:'include',headers:{}};
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  const res=await fetch('/api'+path2,opts);
  // 401 kommt ausschließlich von der auth-Middleware ("nicht angemeldet") —
  // z.B. nach abgelaufener Session. Bisher landete das als x-beliebiger
  // Fehler-Toast irgendwo im UI, ohne dass klar war, WARUM die Aktion
  // fehlschlug — man tippte weiter, ohne zu merken, dass man ausgeloggt ist.
  if(res.status===401){ _handleSessionExpired(); throw new Error('Sitzung abgelaufen'); }
  if(!res.ok&&res.headers.get('content-type')?.includes('text/html')){throw new Error('Server-Fehler '+res.status);}
  const data=await res.json();
  if(!data.success)throw new Error(data.error||'Fehler');
  return data.data;
}
let _sessionExpiredShown=false;
function _handleSessionExpired(){
  if(_sessionExpiredShown||!S.currentUser)return;
  _sessionExpiredShown=true;
  if(_refreshTimer)clearInterval(_refreshTimer);
  if(_chatSyncTimer)clearInterval(_chatSyncTimer);
  S.currentUser=null;
  const hdr=document.getElementById('hdr');if(hdr)hdr.style.display='none';
  const appEl=document.getElementById('APP');if(appEl)appEl.style.display='none';
  const ls=document.getElementById('LS');if(ls)ls.classList.add('open');
  const lerr=document.getElementById('lerr');
  if(lerr){lerr.textContent='⏱️ Deine Sitzung ist abgelaufen — bitte erneut anmelden.';lerr.style.display='block';}
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
    S.noteTemplates=data.noteTemplates||[];S.stationShifts=data.stationShifts||[];S.stationSessions=data.stationSessions||[];
    S.stationOutages=data.stationOutages||[];S.links=data.portalLinks||[];S.rolePermissions=data.rolePermissions||[];
    S.docs=data.docs||[];S.docCategories=data.docCategories||[];
    S.meetings=data.meetings||[];
    S.dpShiftTypes=data.dpShiftTypes||[];
    S.dpAbsenceTypes=data.dpAbsenceTypes||[];
    S.dpHoursProfiles=data.dpHoursProfiles||[];
    S.dpEmpCategories=data.dpEmpCategories||[];
    S.dpPlans=data.dpPlans||[];
    S.dpQualifications=data.dpQualifications||[];
    S.dpShiftPrefs=data.dpShiftPrefs||[];
    S.dpProtocol=data.dpProtocol||[];
    S.dpEmpRules=data.dpEmpRules||[];
    S.todos=data.todos||[];
    S.contacts=data.contacts||[];
    S.sopTemplates=data.sopTemplates||[];S.sopRuns=data.sopRuns||[];
    S.lockers=data.lockers||[];
    S.departments=data.departments||[];
    if(S.departments.length){
      DEPTS=S.departments.map(d=>d.id);
      DEPT_LABELS={}; S.departments.forEach(d=>{DEPT_LABELS[d.id]=(d.emoji?d.emoji+' ':'')+d.label;});
    }
    S.lockerCategories=data.lockerCategories||[];
    S.chatThreads=data.chatThreads||[];S.chatMessages=data.chatMessages||[];
    S.currentUser=data.currentUser;S.p=data.permissions||{};
    const u=getU(S.currentUser);const roles=u?.roles||['standard'];
    const has=(...r)=>r.some(x=>roles.includes(x));
    S.tp={seeAll:has('admin','leitung'),editAll:has('admin','leitung'),
      myDepts:DEPTS.filter(d=>roles.includes(d)),
      canSetPublic:!has('standard'),canAssign:!has('standard'),
      canSeeSubcat:has('admin','leitung','schichtleiter','qm'),
      canEditSubcat:has('admin','leitung','schichtleiter','qm'),
      roles};
    S.imp=data.impersonation||{realIsAdmin:false,viewingAs:null,testUsers:[]};
    updateBadges();
    renderViewAsUi();
  }finally{loading(false);}
}
const getU=id=>S.users.find(u=>u.id===id);
// "Vorname Nachname" -> "Nachname Vorname" (letztes Wort = Nachname); für Auswahllisten im Dienstplan
const lastNameOf=name=>{const p=(name||'').trim().split(/\s+/);return p.length>1?p[p.length-1]:(p[0]||'');};
const lastNameFirst=name=>{const p=(name||'').trim().split(/\s+/);return p.length>1?`${p[p.length-1]} ${p.slice(0,-1).join(' ')}`:(name||'');};
const byLastName=(a,b)=>lastNameOf(a.name).localeCompare(lastNameOf(b.name),'de');
const getCat=id=>S.categories.find(c=>c.id===id);
const getTag=id=>S.tags.find(t=>t.id===id);
const getTk=id=>S.tickets.find(t=>t.id===id);
const getAllw=(uid,year,month)=>S.allowances.find(a=>a.userId===uid&&a.year===year&&a.month===month)||{nd:0,fd:0,fw:0,c10:0,rkt:0,buero:0};
// Ein-/Austrittsdatum-Sichtbarkeit: ein Mitarbeiter soll in einer für einen
// bestimmten Monat/Jahr angezeigten Liste nur auftauchen, wenn er in diesem
// Zeitraum tatsächlich (zumindest teilweise) im Dienstverhältnis war —
// spiegelt lib/dp-rules.js isUserActive() für einen einzelnen Stichtag,
// zusätzlich als Monats-/Jahres-Bereichsprüfung.
function isUserActiveInRange(u,rangeStart,rangeEnd){
  if(!u)return false;
  const hire=u.hireDate||null,term=u.terminationDate||null;
  if(term&&term<rangeStart)return false;
  if(hire&&hire>rangeEnd)return false;
  return true;
}
function isUserActiveInMonth(u,year,month){
  const mm=String(month).padStart(2,'0');
  const lastDay=new Date(year,month,0).getDate();
  return isUserActiveInRange(u,`${year}-${mm}-01`,`${year}-${mm}-${String(lastDay).padStart(2,'0')}`);
}
function isUserActiveInYear(u,year){
  return isUserActiveInRange(u,`${year}-01-01`,`${year}-12-31`);
}
const getRoleDef=r=>{
  const known=ROLES.find(x=>x.id===r);
  if(known)return known;
  const dep=(S.departments||[]).find(x=>x.id===r);
  if(dep)return{id:dep.id,label:dep.label,icon:dep.emoji||'🏢'};
  return ROLES[6];
};
const isAssignable=u=>{const r=u?.roles||['standard'];return !(r.length===0||r.every(x=>x==='standard'));}
const fd=s=>{if(!s)return'\u2014';const p=s.split('T')[0].split('-');return`${p[2]}.${p[1]}.${p[0]}`;};

function fmtDateShort(s) {
  if(!s) return '';
  var p = String(s).slice(0,10).split('-');
  if(p.length < 3) return s;
  return p[2]+'.'+p[1]+'.'+p[0];
}
const fdt=s=>{if(!s)return'\u2014';const d=new Date(s);if(isNaN(d))return String(s||'');if(typeof s==='string'&&s.length<=10)return fd(s);return`${fd(d.toISOString())} ${d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}`;};
// online: true → grüner Punkt, false → grauer Kreis mit X (offline), nicht
// angegeben (null/undefined, Standardfall bei allen nicht-Chat-Avataren) →
// gar kein Status-Indikator.
const avHtml=(init,color,sz=24,fs=10,online=null)=>{
  const dot=online===true?'<div class="online-dot"></div>'
    :online===false?'<div class="offline-dot"><svg viewBox="0 0 10 10" width="7" height="7"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.1 3.1L6.9 6.9M6.9 3.1L3.1 6.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></div>'
    :'';
  return `<div class="av" style="width:${sz}px;height:${sz}px;font-size:${fs}px;background:${color}22;color:${color}">${init}${dot}</div>`;
};
const roleBadges=uid=>((getU(uid)?.roles)||['standard']).map(r=>{const d=getRoleDef(r);return`<span class="rb rb-${r}">${d.icon} ${d.label}</span>`;}).join('');
const prioBdg=p=>{const d=PRIORITIES.find(x=>x.id===p)||PRIORITIES[1];return`<span class="bdg pr-${p}">${d.label}</span>`;};
const stBdg=s=>{const d=STATUSES.find(x=>x.id===s)||STATUSES[0];return`<span class="bdg st-${s}">${d.label}</span>`;};
const deptColor=d=>{const dep=(S.departments||[]).find(x=>x.id===d);return dep?.color||{technik:'#0ea5e9',leitung:'#f59e0b',dienstplanung:'#3b6dd4',ausbildung:'#7c3aed',qm:'#10b981'}[d]||'#64748b';};
const deptBdg=d=>{const c=deptColor(d);return `<span class="bdg" style="background:${c}1f;color:${c}">${DEPT_LABELS[d]||d}</span>`;};
const tagChips=tgs=>(tgs||[]).map(tid=>{const t=getTag(tid);if(!t)return'';return`<span class="tag-chip" style="background:${t.color}1a;color:${t.color};border:1px solid ${t.color}30">${t.label}</span>`;}).join('');
const dueBdg=tk=>{
  if(!tk.dueDate||isTkClosed(tk))return'';
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
  const unreadChat=(S.chatThreads||[]).reduce((n,t)=>n+chatUnreadCount(t.id),0);
  const cb=document.getElementById('navChatBdg');if(cb){cb.style.display=unreadChat?'flex':'none';cb.textContent=unreadChat;}
}
// AUTH
async function doLogin(){
  const username=document.getElementById('lsel').value.trim();
  if(!username){toast('⚠️ Bitte Benutzernamen eingeben!');return;}
  loading(true);
  const lerr=document.getElementById('lerr');
  try{
    const res=await api('POST','/auth/login',{username,password:document.getElementById('lpw').value}).catch(e=>{
      lerr.textContent=e.message||'Benutzername oder Passwort falsch.';lerr.style.display='block';document.getElementById('lpw').value='';loading(false);throw e;
    });
    lerr.style.display='none';
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
  _sessionExpiredShown=false;
  startClock();
  document.getElementById('LS').classList.remove('open');
  document.getElementById('hdr').style.display='flex';document.getElementById('APP').style.display='grid';
  const vb=document.getElementById('versionBadge');if(vb)vb.textContent='v'+APP_VERSION;
  const u=getU(S.currentUser);
  document.getElementById('pillNm').textContent=u?lastNameFirst(u.name):'?';
  const pa=document.getElementById('pillAv');pa.textContent=u?.initials||'?';pa.style.background=(u?.color||'#888')+'22';pa.style.color=u?.color||'#888';
  const ab=document.getElementById('adminBtn');if(ab)ab.style.display=S.p.manageUsers?'flex':'none';
  const dpNavEl=document.getElementById('ni-dp');if(dpNavEl)dpNavEl.style.display=S.p.canManageDp?'flex':'none';
  restoreNavSectionState();
  const docLinkId=new URLSearchParams(location.search).get('doc');
  if(docLinkId){try{history.replaceState(null,'',location.pathname);}catch(e){}}
  loadNews().then(function(){
    if(docLinkId&&(S.docs||[]).some(d=>d.id===docLinkId)){S._docHighlight=docLinkId;setView('docs');}
    else setView('home');
  });startAutoRefresh();startChatSync();
  // archivNav for all users
  const archivNav=document.getElementById('ni-news_archiv');
  if(archivNav)archivNav.style.display='block';
  toast('\uD83D\uDC4B Willkommen, '+(u?lastNameFirst(u.name):'')+'!');
}
async function logout(){
  loading(true);
  try{
    const mySess=S.stationSessions?.find(s=>s.userId===S.currentUser);
    if(mySess)await api('DELETE','/stations/'+encodeURIComponent(mySess.stationName)).catch(()=>{});
    await api('POST','/auth/logout');
  }catch(e){}finally{loading(false);}
  if(_refreshTimer)clearInterval(_refreshTimer);
  S.currentUser=null;document.getElementById('hdr').style.display='none';document.getElementById('APP').style.display='none';
  document.getElementById('lsel').value='';document.getElementById('lpw').value='';document.getElementById('LS').classList.add('open');
}
function openPwModal(){
  const u=getU(S.currentUser);
  document.getElementById('myUsername').value=u?.username||'';
  S.myColor=u?.color||pal()[0];
  buildCP('myCR',S.myColor,'pickMyColor');
  document.getElementById('cpw0').value='';document.getElementById('cpw1').value='';document.getElementById('cpw2').value='';
  const dh=document.getElementById('setDueHeat');if(dh)dh.checked=getDueHeatPref();
  const myLockers=(S.lockers||[]).filter(l=>l.assigneeType==='user'&&l.assigneeUserId===S.currentUser);
  const lockersBlock=document.getElementById('myLockersBlock');
  if(lockersBlock){
    lockersBlock.style.display=myLockers.length?'':'none';
    document.getElementById('myLockersList').innerHTML=myLockers.map(l=>
      `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px">
        <span style="font-weight:700">${esc(l.number)}</span>
        ${l.categoryId?`<span class="bdg" style="font-size:11px">${esc(lockerCatLabel(l.categoryId))}</span>`:''}
        ${l.note?`<span style="color:var(--mu);font-size:11px">${esc(l.note)}</span>`:''}
      </div>`).join('');
  }
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
function toggleNS(id){
  const hdr = document.getElementById(id+'Hdr');
  const sub = document.getElementById(id+'Sub');
  const isOpen = hdr.classList.toggle('open');
  sub.classList.toggle('open');
  // Persistiere den Zustand
  const nsState = JSON.parse(localStorage.getItem('navSectionState')||'{}');
  nsState[id] = isOpen;
  localStorage.setItem('navSectionState', JSON.stringify(nsState));
}

function restoreNavSectionState() {
  const nsState = JSON.parse(localStorage.getItem('navSectionState')||'{}');
  for (const [id, isOpen] of Object.entries(nsState)) {
    const hdr = document.getElementById(id+'Hdr');
    const sub = document.getElementById(id+'Sub');
    if (hdr && sub) {
      if (isOpen) {
        hdr.classList.add('open');
        sub.classList.add('open');
      } else {
        hdr.classList.remove('open');
        sub.classList.remove('open');
      }
    }
  }
}
// Alle Sidebar-Reiter (id="ni-<key>") — muss mit db.js NAV_TABS übereinstimmen.
const NAV_TAB_IDS=['home','sop','docs','meetings','todos','contacts','schedule','allw','homeoffice','vacation','diensttausch','abrechnung','dienstplaene','zahnarzt','platz','links','tickets','tickets_closed','tickets_cancelled','tickets_deleted','checklists','dp','dp-config','dp-christmas','dp-mine','messages','messages_sent','news','statistik','spint','chat'];
// Zusätzlich zur (abschaltbaren) Reiter-Sichtbarkeit weiterhin hart verdrahtete
// Mindestanforderungen für die Dienstplanungs-/Statistik-Reiter — ein Reiter
// ist nur sichtbar, wenn BEIDES zutrifft.
const NAV_BASELINE={statistik:()=>!!S.p?.manageUsers, dp:()=>!!S.p?.canManageDp, 'dp-config':()=>!!S.p?.canManageDp, 'dp-christmas':()=>!!S.p?.canManageDp, spint:()=>!!S.p?.canManageSpint};
function applyNavVisibility(){
  const tabs=S.p?.tabs||{};
  NAV_TAB_IDS.forEach(id=>{
    const el=document.getElementById('ni-'+id);if(!el)return;
    const baseline=NAV_BASELINE[id]?NAV_BASELINE[id]():true;
    const tabAllowed=tabs[id]!==false; // Default sichtbar, nur ein explizites false blendet aus
    el.style.display=(baseline&&tabAllowed)?'':'none';
  });
}
function setView(v){
  S.view=v;
  NAV_TAB_IDS.forEach(x=>{const el=document.getElementById('ni-'+x);if(el)el.classList.toggle('active',x===v);});
  applyNavVisibility();
  document.getElementById('sidebar').classList.remove('open');document.getElementById('sbOv').classList.remove('open');
  renderSBF();renderMain();
}
function renderSBF(){
  const el=document.getElementById('sbf');if(!el)return;
  if(S.view==='schedule'){
    el.innerHTML='';
  }else if(S.view==='allw'){
    el.innerHTML='';
  }else if(S.view==='abrechnung'){
    el.innerHTML='';
  }else if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted'){
    el.innerHTML='';
  }else el.innerHTML='';
}
function renderMain(){
  if(S.view==='home')renderHome();
  else if(S.view==='schedule')renderSchedule();
  else if(S.view==='homeoffice')renderHomeoffice();
  else if(S.view==='vacation')renderVacation();
  else if(S.view==='diensttausch')renderDiensttausch();
  else if(S.view==='news'||S.view==='news_archiv')renderNews();
  else if(S.view==='allw')renderAllw();
  else if(S.view==='diensttausch')renderDiensttausch();
  else if(S.view==='abrechnung')renderAbrechnung();
  else if(S.view==='dienstplaene')renderDienstplaene();
  else if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted')renderTickets();
  else if(S.view==='checklists')renderChecklists();
  else if(S.view==='messages'||S.view==='messages_sent')renderMessages();
  else if(S.view==='zahnarzt')renderZahnarzt();
  else if(S.view==='platz')renderPlatz();
  else if(S.view==='links')renderLinks();
  else if(S.view==='docs')renderDocs();
  else if(S.view==='statistik')renderStatistik();
  else if(S.view==='meetings')renderMeetings();
  else if(S.view==='dp')renderDP();
  else if(S.view==='dp-config')renderDPConfig();
  else if(S.view==='dp-christmas')renderDPChristmas();
  else if(S.view==='dp-mine')renderDPMine();
  else if(S.view==='todos')renderTodos();
  else if(S.view==='contacts')renderContacts();
  else if(S.view==='sop')renderSop();
  else if(S.view==='spint')renderSpint();
  else if(S.view==='chat')renderChatList();
}
// HOME
// ── ÜBERSICHT: Alt/Neu-Umschalter ─────────────────────────────────────────────
// "Neu" wird schrittweise ausgebaut (Tickets/Todos/Besprechungen/Dienstplan-
// Vorschau); "Alt" bleibt unverändert bestehen, bis "Neu" so weit ist, dass
// es abgelöst werden kann. Auswahl wird pro Browser gemerkt.
function getHomeVersion(){ try{return localStorage.getItem('lst_home_version')||'old';}catch(e){return 'old';} }
function setHomeVersion(v){ try{localStorage.setItem('lst_home_version',v);}catch(e){} renderHome(); }
function homeVersionToggleHtml(){
  const v=getHomeVersion();
  return '<div style="display:flex;gap:2px;background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:2px">'
    +'<button onclick="setHomeVersion(\'old\')" style="padding:4px 11px;font-size:12px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;background:'+(v==='old'?'var(--acc)':'transparent')+';color:'+(v==='old'?'var(--act)':'var(--mu)')+'">Alt</button>'
    +'<button onclick="setHomeVersion(\'new\')" style="padding:4px 11px;font-size:12px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;background:'+(v==='new'?'var(--acc)':'transparent')+';color:'+(v==='new'?'var(--act)':'var(--mu)')+'">Neu &#x1F9EA;</button>'
    +'</div>';
}
function homeCardWrap(id,title,bodyHtml,accent){
  var open; try{open=localStorage.getItem('cc_'+id);open=open===null?true:open==='1';}catch(ex){open=true;}
  // Dezenter oberer Rahmen als einzige Farbmarkierung (statt vollflächig
  // eingefärbter Karte + farbiger Überschrift) — ruhigeres, "professionelleres"
  // Erscheinungsbild in der neuen Übersicht.
  var accentStyle=accent?';border-top:3px solid '+accent:'';
  return '<details class="dash-card" data-cc-id="'+id+'"'+(open?' open':'')+' style="width:100%;box-sizing:border-box;margin-bottom:14px'+accentStyle+'">'
    +'<summary><h3 style="margin:0;display:inline;color:var(--tx)">'+title+'</h3></summary>'
    +bodyHtml+'</details>';
}
function renderHome(){
  if(getHomeVersion()==='new') return renderHomeNew();
  return renderHomeOld();
}
// ── ÜBERSICHT NEU (Beta) ───────────────────────────────────────────────────
function getHomeDpRange(){ try{return parseInt(localStorage.getItem('lst_home_dp_range')||'3');}catch(e){return 3;} }
function setHomeDpRange(n){ try{localStorage.setItem('lst_home_dp_range',String(n));localStorage.setItem('lst_home_dp_mode','days');}catch(e){} renderHome(); }
function getHomeDpMode(){ try{return localStorage.getItem('lst_home_dp_mode')||'days';}catch(e){return 'days';} }
function getHomeDpCount(){ try{return parseInt(localStorage.getItem('lst_home_dp_count')||'10');}catch(e){return 10;} }
function setHomeDpCount(n){ try{localStorage.setItem('lst_home_dp_count',String(n));localStorage.setItem('lst_home_dp_mode','count');}catch(e){} renderHome(); }
function renderHomeNew(){
  const u=getU(S.currentUser);
  const today=new Date(); today.setHours(0,0,0,0);

  // ── Benachrichtigungen ("Dir wurde zugewiesen…", "Neues Ticket in…", Erwähnungen)
  // — in der alten Übersicht schon vorhanden, hier bisher gefehlt. Mehrere
  // Benachrichtigungen zum selben Ticket (z.B. "Neues Ticket in Technik" +
  // "Dir wurde zugewiesen") werden zu einer Zeile mit einem zusammengefassten
  // Satz kombiniert — bei nur einer Benachrichtigung (z.B. eine einzelne
  // Erwähnung) bleibt der ursprüngliche Text unverändert erhalten.
  const unreadNotif=S.notifications.filter(n=>!n.isRead&&n.type!=='event_added'&&n.type!=='event_changed'&&n.type!=='einspringer_rejected');
  let notifCard='';
  if(unreadNotif.length){
    const byTicket={}; const singles=[];
    unreadNotif.forEach(n=>{ if(n.ticketId){ (byTicket[n.ticketId]=byTicket[n.ticketId]||[]).push(n); } else singles.push(n); });
    const typePrio={assigned:0,mention:1,new_ticket:2};
    // Jede Phrase ist ein vollständiger, für sich grammatisch korrekter
    // Teilsatz (eigenes Subjekt/Verb) — sie werden nur mit " · " aneinander-
    // gereiht, nicht künstlich unter ein gemeinsames "es wurde" gezwungen
    // (das ergab z.B. "es wurde dir zugewiesen und du erwähnt und ein neues
    // Ticket erstellt", was grammatisch nicht passt).
    const notifPhrase=(type,tk)=>{
      if(type==='new_ticket') return 'Neu erstellt'+(tk?' in '+(DEPT_LABELS[tk.department]||tk.department):'');
      if(type==='assigned') return 'Dir zugewiesen';
      if(type==='mention') return 'Du wurdest erwähnt';
      return null;
    };
    const groups=[
      ...Object.entries(byTicket).map(([ticketId,g])=>{
        g.sort((a,b)=>(typePrio[a.type]??9)-(typePrio[b.type]??9));
        const tk=getTk(ticketId);
        let text;
        if(g.length===1){
          text=g[0].title;
        } else {
          const types=[...new Set(g.map(x=>x.type))];
          const phrases=types.map(t=>notifPhrase(t,tk)).filter(Boolean);
          text=phrases.length
            ? (tk?tk.number+': '+tk.title+' — '+phrases.join(' · '):phrases.join(' · '))
            : g.map(x=>x.title).join(' · ');
        }
        return {ids:g.map(x=>x.id),text,count:g.length,ticketId,type:g[0].type,createdAt:g.map(x=>x.createdAt).sort().pop()};
      }),
      ...singles.map(n=>({ids:[n.id],text:n.title,count:1,ticketId:null,type:n.type,createdAt:n.createdAt})),
    ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const notifIcon=t=>t==='mention'?'💬':t==='assigned'?'👤':'🎫';
    const notifBody='<div style="padding:6px 14px 4px;text-align:right"><button class="btn-s" style="font-size:11px" onclick="readAllNotifs()">Alle gelesen</button></div>'
      +groups.slice(0,8).map(g=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openNotifGroup(\''+g.ids.join(',')+'\',\''+(g.ticketId||'')+'\')">'
        +'<div style="font-size:16px;flex-shrink:0">'+notifIcon(g.type)+'</div>'
        +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">'+esc(g.text)+'</div><div style="font-size:10px;color:var(--mu)">'+fdt(g.createdAt)+'</div></div>'
        +'</div>').join('');
    notifCard=homeCardWrap('new_notif','🔔 Benachrichtigungen ('+unreadNotif.length+')',notifBody,'#b45309');
  }

  // ── Tickets: Top 5 in Summe, zuerst nach Fälligkeit (offene Tickets ohne
  // Fälligkeitsdatum kommen danach), innerhalb dessen nach Priorität sortiert ──
  const openTks=S.tickets.filter(tk=>!isTkClosed(tk)&&!tk.isDeleted);
  const overdueTks=openTks.filter(tk=>tk.dueDate&&new Date(tk.dueDate)<today);
  const prioOrder={high:0,medium:1,low:2};
  const ticketSort=(a,b)=>{
    if(a.dueDate&&b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if(a.dueDate) return -1;
    if(b.dueDate) return 1;
    return (prioOrder[a.priority]??1)-(prioOrder[b.priority]??1);
  };
  const focusTks=[...openTks].sort(ticketSort).slice(0,5);
  const ticketRow=tk=>{
    const asn=getU(tk.assigneeId);
    const overdue=tk.dueDate&&new Date(tk.dueDate)<today;
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">'
      +'<div style="width:3px;align-self:stretch;background:'+(overdue?'#ef4444':'#ea580c')+';border-radius:2px;flex-shrink:0"></div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tk.number+': '+esc(tk.title)+'</div>'
      +'<div style="font-size:10px;color:var(--mu)">'+dueBdg(tk)+' &middot; '+(asn?esc(lastNameFirst(asn.name)):'nicht zugewiesen')+'</div></div>'+prioBdg(tk.priority)+'</div>';
  };
  const ticketsBody=(focusTks.length?focusTks.map(ticketRow).join(''):'<div style="color:var(--di);font-size:12px;padding:8px 14px">Keine offenen Tickets &#127881;</div>')
    +'<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--mu)">'+openTks.length+' offen insgesamt &middot; '+overdueTks.length+' überfällig'
    +' &middot; <a href="javascript:void(0)" onclick="setView(\'tickets\')" style="color:var(--acc)">alle ansehen &#8594;</a></div>';
  const ticketsCard=homeCardWrap('new_tickets','&#127931; Tickets',ticketsBody,'#3b6dd4');

  // ── Offene Todos ── ein Todo gilt als offen, solange sein eigener Status
  // nicht "done" ist — unabhängig davon, ob es Unterpunkte hat (ein Todo ganz
  // ohne Punkte, z.B. "morgen XY anrufen", ist selbst die Aufgabe).
  const openTodos=S.todos.filter(t=>t.status!=='done');
  let todosBody='';
  if(openTodos.length){
    openTodos.slice(0,8).forEach(todo=>{
      const openItems=(todo.items||[]).filter(i=>!i.is_done);
      const dueTxt=todo.due_date?fmtDateShort(String(todo.due_date).slice(0,10)):'';
      const prio=TODO_PRIO[todo.priority]||TODO_PRIO.medium;
      todosBody+='<div style="padding:8px 14px;border-top:1px solid var(--border);cursor:pointer;display:flex;align-items:flex-start;gap:8px" onclick="setView(\'todos\')">'
        +'<span title="'+prio.label+'" style="width:8px;height:8px;border-radius:50%;background:'+prio.color+';flex-shrink:0;margin-top:5px"></span>'
        +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">'+escHtml(todo.title)+'</div>'
        +'<div style="font-size:11px;color:var(--mu)">'+(openItems.length?openItems.length+' Punkt(e) offen':(todo.notes||[]).length?todo.notes.length+' Notiz'+(todo.notes.length!==1?'en':''):'ohne Unterpunkte')+(dueTxt?' &middot; fällig '+dueTxt:'')+'</div></div></div>';
    });
    todosBody+='<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--mu)">'+openTodos.length+' offene(s) Todo(s)'
      +' &middot; <a href="javascript:void(0)" onclick="setView(\'todos\')" style="color:var(--acc)">alle ansehen &#8594;</a></div>';
  } else {
    todosBody='<div style="color:var(--di);font-size:12px;padding:8px 14px">Keine offenen Todos &#127881;</div>';
  }
  const todosCard=homeCardWrap('new_todos','&#9989; Offene Todos ('+openTodos.length+')',todosBody,'#3b6dd4');

  // ── Offene Besprechungen ── ein Thema (Instanz) gilt als offen, solange es
  // status "planned" hat (noch nicht abgehalten/abgesagt) — unabhängig vom
  // Datum, das bei neu angelegten Themen auch noch offen sein kann.
  const meetingSort=(a,b)=>{ if(a.date&&b.date) return a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''); if(a.date) return -1; if(b.date) return 1; return 0; };
  const openMeetings=(S.meetings||[])
    .map(m=>({m,planned:(m.instances||[]).filter(inst=>inst.status==='planned').sort(meetingSort)}))
    .filter(x=>x.planned.length)
    .sort((a,b)=>meetingSort(a.planned[0],b.planned[0]));
  let meetingsBody='';
  if(openMeetings.length){
    openMeetings.slice(0,8).forEach(({m,planned})=>{
      const next=planned[0];
      meetingsBody+='<div style="padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="setView(\'meetings\')">'
        +'<div style="font-size:12px;font-weight:600">'+escHtml(m.title)+(planned.length>1?' <span style="font-weight:400;color:var(--mu)">('+planned.length+' Themen)</span>':'')+'</div>'
        +'<div style="font-size:11px;color:var(--mu)">'+(next.date?fmtDate(next.date)+(next.time?' um '+next.time:''):'Datum offen')+'</div></div>';
    });
    meetingsBody+='<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--mu)">'+openMeetings.length+' offene Besprechung(en)'
      +' &middot; <a href="javascript:void(0)" onclick="setView(\'meetings\')" style="color:var(--acc)">alle ansehen &#8594;</a></div>';
  } else {
    meetingsBody='<div style="color:var(--di);font-size:12px;padding:8px 14px">Keine offenen Besprechungen &#127881;</div>';
  }
  const meetingsCard=homeCardWrap('new_meetings','&#128483;&#65039; Offene Besprechungen ('+openMeetings.length+')',meetingsBody,'#3b6dd4');

  // ── Dienstplan-Vorschau: entweder die nächsten 3/7/30 Tage (mit allen
  // Einträgen je Tag) ODER die nächsten 5/10/30 Termine (Einträge) in Summe,
  // unabhängig davon, wie viele Tage das umfasst ──
  const dpMode=getHomeDpMode();
  const range=getHomeDpRange();
  const dpCount=getHomeDpCount();
  const rangeBtn=(n,label)=>'<button onclick="setHomeDpRange('+n+')" style="padding:4px 11px;font-size:12px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;background:'+(dpMode==='days'&&range===n?'var(--acc)':'transparent')+';color:'+(dpMode==='days'&&range===n?'var(--act)':'var(--mu)')+'">'+label+'</button>';
  const countBtn=(n,label)=>'<button onclick="setHomeDpCount('+n+')" style="padding:4px 11px;font-size:12px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;background:'+(dpMode==='count'&&dpCount===n?'var(--acc)':'transparent')+';color:'+(dpMode==='count'&&dpCount===n?'var(--act)':'var(--mu)')+'">'+label+'</button>';
  const dpMoNs=['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const dpDyNs=['So','Mo','Di','Mi','Do','Fr','Sa'];
  const isoOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const isoToday=isoOf(today);
  const dpDayBlock=(iso,dayEvs)=>{
    const d=new Date(iso+'T00:00:00');
    const diffDays=Math.round((d-today)/86400000);
    const dayLabel=(diffDays===0?'Heute, ':diffDays===1?'Morgen, ':'')+dpDyNs[d.getDay()]+' '+String(d.getDate()).padStart(2,'0')+'.'+dpMoNs[d.getMonth()];
    let block='<div style="padding:8px 14px;border-top:1px solid var(--border)">'
      +'<div style="font-size:11px;font-weight:700;color:var(--mu);margin-bottom:4px">'+dayLabel+'</div>';
    if(!dayEvs.length){
      block+='<div style="font-size:11px;color:var(--di)">Keine Einträge</div>';
    } else {
      block+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
      dayEvs.slice(0,12).forEach(ev=>{
        if(ev._anonymized){block+='<span class="bdg" style="font-size:10px;background:var(--sf2);color:var(--mu)" title="Anonymisiert">&#128274;</span>';return;}
        const cat=S.categories.find(c=>c.id===ev.category);
        const uu=ev.isGeneral?null:getU(ev.userId);
        const label=(ev.isGeneral?'&#127760; ':uu?esc(lastNameFirst(uu.name))+': ':'')+(cat?cat.emoji+' ':'')+esc((ev.reason||cat?.label||'').slice(0,22));
        const color=ev.isGeneral?'#10b981':cat?cat.color:'#3b6dd4';
        block+='<span class="bdg" style="font-size:10px;background:'+color+'1a;color:'+color+'">'+label+'</span>';
      });
      if(dayEvs.length>12) block+='<span style="font-size:10px;color:var(--mu)">+'+(dayEvs.length-12)+' weitere</span>';
      block+='</div>';
    }
    return block+'</div>';
  };
  let dpBody='';
  if(dpMode==='count'){
    const futureEvs=S.events.filter(ev=>(ev.dateTo||ev.dateFrom)>=isoToday&&ev.approvalStatus!=='rejected')
      .sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom));
    const shown=futureEvs.slice(0,dpCount);
    if(!shown.length){
      dpBody='<div style="color:var(--di);font-size:12px;padding:8px 14px">Keine anstehenden Termine</div>';
    } else {
      const byDay={};
      shown.forEach(ev=>{const day=ev.dateFrom<isoToday?isoToday:ev.dateFrom;(byDay[day]=byDay[day]||[]).push(ev);});
      Object.keys(byDay).sort().forEach(iso=>{dpBody+=dpDayBlock(iso,byDay[iso]);});
    }
  } else {
    let shownDays=0;
    for(let i=0;i<range;i++){
      const d=new Date(today); d.setDate(d.getDate()+i);
      const iso=isoOf(d);
      const dayEvs=S.events.filter(ev=>ev.dateFrom<=iso&&(ev.dateTo||ev.dateFrom)>=iso&&ev.approvalStatus!=='rejected');
      if(range>7&&!dayEvs.length) continue; // bei 1 Monat: leere Tage überspringen, sonst zu lang
      shownDays++;
      dpBody+=dpDayBlock(iso,dayEvs);
    }
    if(range>7&&!shownDays) dpBody='<div style="color:var(--di);font-size:12px;padding:8px 14px">Keine Einträge im gewählten Zeitraum</div>';
  }
  dpBody+='<div style="padding:8px 14px;border-top:1px solid var(--border)"><a href="javascript:void(0)" onclick="setView(\'schedule\')" style="color:var(--acc);font-size:11px">zum Dienstplan &#8594;</a></div>';
  const dpHeaderExtra='<div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 14px 0">'
    +'<div style="display:flex;gap:2px;background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:2px">'+rangeBtn(3,'3 Tage')+rangeBtn(7,'7 Tage')+rangeBtn(30,'1 Monat')+'</div>'
    +'<div style="display:flex;gap:2px;background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:2px">'+countBtn(5,'5 Termine')+countBtn(10,'10 Termine')+countBtn(30,'30 Termine')+'</div>'
    +'</div>';
  const dpCard=homeCardWrap('new_dp','&#128197; Dienstplan &ndash; nächste Tage',dpHeaderExtra+dpBody,'#3b6dd4');

  // Benachrichtigungen + Tickets brauchen keine volle Breite → nebeneinander,
  // spart Platz (nur wenn tatsächlich Benachrichtigungen vorliegen, sonst
  // bekommen die Tickets die volle Breite statt einer leeren Spalte).
  const topRow = notifCard
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">'+notifCard+ticketsCard+'</div>'
    : ticketsCard;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128196; Übersicht <span>${u?lastNameFirst(u.name):''}</span></div>${homeVersionToggleHtml()}</div>
    <div style="background:rgba(59,109,212,.06);border:1px solid rgba(59,109,212,.2);border-radius:var(--r);padding:8px 12px;margin-bottom:14px;font-size:11px;color:var(--mu)">&#x1F9EA; Neue Übersicht (Beta) &mdash; wird schrittweise ausgebaut. Mit "Alt" zur bisherigen Ansicht wechseln.</div>
    ${sopHomeBannerHtml()}
    ${topRow}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${todosCard}${meetingsCard}</div>
    ${dpCard}`;
}
function renderHomeOld(){
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
    if(isTkClosed(tk))return false;
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
  _onlineHtml+='<div class="online-user">'+avHtml(u?u.initials:'?',u?u.color:'#888',22,9,true)+'<span>'+(u?lastNameFirst(u.name):'')+'<span style="color:var(--mu);font-size:10px"> (du)</span></span></div>';
  online.forEach(function(x){_onlineHtml+='<div class="online-user">'+avHtml(x.initials,x.color,22,9,true)+'<span>'+lastNameFirst(x.name)+'</span></div>';});
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
      if(!tk.dueDate||isTkClosed(tk))return false;
      var d=new Date(tk.dueDate);d.setHours(0,0,0,0);
      return d<=weekEnd;
    }).sort(function(a,b){return (a.dueDate||'').localeCompare(b.dueDate||'');}).slice(0,10);
    if(!dueTks.length)return;
    dueTks.forEach(function(tk){
      var asn=getU(tk.assigneeId);
      _dueFaelligHtml+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
      _dueFaelligHtml+='<div style="width:3px;align-self:stretch;background:#ea580c;border-radius:2px;flex-shrink:0"></div>';
      _dueFaelligHtml+='<div style="flex:1;min-width:0">';
      _dueFaelligHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tk.number+': '+esc(tk.title)+'</div>';
      _dueFaelligHtml+='<div style="font-size:10px;color:var(--mu)">'+dueBdg(tk)+(asn?' · '+lastNameFirst(asn.name):' · nicht zugewiesen')+'</div>';
      _dueFaelligHtml+='</div></div>';
    });
  })();

  // Beschwerden (subcategory tickets) für berechtigte Rollen
  var _beschwerdenHtml='';
  if(S.tp.canSeeSubcat){
    // Nur Unterkategorien, die als Beschwerde markiert sind (Admin → Unterkategorien)
    var complaintLabels=new Set(S.ticketSubcategories.filter(function(s){return s.is_complaint;}).map(function(s){return s.label;}));
    var beschwerden=S.tickets.filter(function(tk){return tk.subcategory&&complaintLabels.has(tk.subcategory)&&!isTkClosed(tk);}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,15);
    if(beschwerden.length){
      var _pColors={high:'#ef4444',medium:'#f59e0b',low:'#94a3b8'};
      beschwerden.forEach(function(tk){
        var isNew=!!tkBadge(tk);var asn=getU(tk.assigneeId);
        _beschwerdenHtml+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border)'+
          (isNew?';background:rgba(124,58,237,.04)':'')+';cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
        _beschwerdenHtml+='<div style="width:3px;align-self:stretch;background:#7c3aed;border-radius:2px;flex-shrink:0"></div>';
        _beschwerdenHtml+='<div style="flex:1;min-width:0">';
        _beschwerdenHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+
          tkBadgeHtml(tk)+
          '<span style="font-family:monospace;font-size:11px;color:var(--mu)">'+tk.number+'</span> '+esc(tk.title)+
          ' <span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:#7c3aed">'+esc(tk.subcategory)+'</span></div>';
        _beschwerdenHtml+='<div style="font-size:10px;color:var(--mu)">'+deptBdg(tk.department)+(asn?' · '+lastNameFirst(asn.name):' · nicht zugewiesen')+' · '+fd(tk.createdAt)+'</div>';
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
    var _badgeCount=relevantTks.filter(function(tk){return tkBadge(tk);}).length;
    _ticketsHtml+=(_badgeCount?'<div style="font-size:11px;color:var(--warn);font-weight:600;margin-bottom:4px">&#128276; '+_badgeCount+' neue Eintr\u00e4ge/\u00c4nderungen</div>':'');
    relevantTks.forEach(function(tk){
      var _b=tkBadge(tk);var n=!!_b;
      _ticketsHtml+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);gap:8px;'+(n?'background:rgba(245,158,11,.04);margin:0 -8px;padding:5px 8px;border-left:3px solid var(--warn);':'')+'">';
      _ticketsHtml+='<div style="min-width:0;flex:1;cursor:pointer" onclick="openTkDetail(\''+tk.id+'\')">';
      _ticketsHtml+='<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tkBadgeHtml(tk)+tk.number+': '+esc(tk.title)+'</div>';
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
    <div class="ph"><div class="pt">&#128196; \u00dcbersicht <span>${u?lastNameFirst(u.name):''}</span></div>${homeVersionToggleHtml()}</div>
    ${pinnedMsg.length?_ccWrap('pinned_msgs','&#128204; Angepinnte Nachrichten ('+pinnedMsg.length+')','<div class="card-rows">'+
      pinnedMsg.map(m=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openMsg('${m.id}')">
        <div style="width:3px;align-self:stretch;background:#f59e0b;border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">&#128204; ${m.title}</div>
          <div style="font-size:11px;color:var(--mu)">von ${getU(m.senderId)?lastNameFirst(getU(m.senderId).name):'?'}</div>
        </div>
        <button class="btn-s" style="font-size:10px;padding:2px 8px;flex-shrink:0" onclick="event.stopPropagation();toggleMsgPinDirect('${m.id}',true)">Lospinnen</button>
      </div>`).join('')+'</div>'
    ):''}
    ${unreadMsg.length?`<div style="background:rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,.20);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:10px">&#128276; ${unreadMsg.length} ungelesene Nachricht${unreadMsg.length>1?'en':''}</div>
      ${unreadMsg.map(m=>`<div style="padding:8px 12px;background:var(--sf);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><div style="font-weight:600;font-size:13px">${m.title}</div><div style="font-size:11px;color:var(--mu)">von ${getU(m.senderId)?lastNameFirst(getU(m.senderId).name):'?'} &middot; ${fdt(m.createdAt)}</div></div>
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

    ${sopHomeBannerHtml()}
    ${importantNewsHtml}${(hoHtml||vacHtml)?('<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'+hoHtml+vacHtml+'</div>'):''}
    ${_dueFaelligHtml?_ccWrap('due_week','&#128197; Diese Woche fällig','<div class="card-rows">'+_dueFaelligHtml+'</div>'):''}
    ${_beschwerdenHtml?_ccWrap('beschwerden','&#128680; Zu erledigen &ndash; Beschwerden','<div class="card-rows">'+_beschwerdenHtml+'</div>'):''}
    ${(() => {
      // Ein Todo ohne Unterpunkte (z.B. "morgen XY anrufen") ist selbst die
      // Aufgabe und zählt daher auch ohne offene Punkte als offen.
      const openTodos = S.todos.filter(t => t.status !== 'done');
      if (!openTodos.length) return '';
      let todosHtml = '';
      openTodos.slice(0, 5).forEach(todo => {
        const openItems = (todo.items||[]).filter(i => !i.is_done);
        todosHtml += '<div style="padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="setView(\'todos\')">';
        todosHtml += '<div style="font-size:12px;font-weight:600">'+escHtml(todo.title)+'</div>';
        todosHtml += '<div style="font-size:11px;color:var(--mu)">'+(openItems.length?openItems.length+' offen':(todo.notes||[]).length?todo.notes.length+' Notiz'+(todo.notes.length!==1?'en':''):'ohne Unterpunkte')+'</div>';
        todosHtml += '</div>';
      });
      if (openTodos.length > 5) todosHtml += '<div style="padding:8px 14px;border-top:1px solid var(--border)"><button class="btn-s" style="font-size:11px;width:100%" onclick="setView(\'todos\')">Alle Todos anzeigen &#8594;</button></div>';
      return _ccWrap('todos_home', '&#9989; Offene Todos (' + openTodos.length + ')', '<div class="card-rows">' + todosHtml + '</div>');
    })()}
    ${(() => {
      // Instanzen mit status "planned" gelten als offen (Feldname ist date/time,
      // nicht scheduledFor — das gab es hier vorher nicht, daher blieb dieser
      // Block immer leer).
      const mSort=(a,b)=>{ if(a.date&&b.date) return a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''); if(a.date) return -1; if(b.date) return 1; return 0; };
      const upcomingMeetings = (S.meetings||[])
        .map(m=>({m,planned:(m.instances||[]).filter(inst=>inst.status==='planned').sort(mSort)}))
        .filter(x=>x.planned.length)
        .sort((a,b)=>mSort(a.planned[0],b.planned[0]));
      if (!upcomingMeetings.length) return '';
      let meetingsHtml = '';
      upcomingMeetings.slice(0, 5).forEach(({m,planned}) => {
        const next=planned[0];
        meetingsHtml += `<div style="padding:8px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="setView('meetings')">`;
        meetingsHtml += `<div style="font-size:12px;font-weight:600">${escHtml(m.title)}</div>`;
        meetingsHtml += `<div style="font-size:11px;color:var(--mu)">${next.date?fmtDate(next.date)+(next.time?' um '+next.time:''):'Datum offen'}</div>`;
        meetingsHtml += '</div>';
      });
      if (upcomingMeetings.length > 5) meetingsHtml += '<div style="padding:8px 14px;border-top:1px solid var(--border)"><button class="btn-s" style="font-size:11px;width:100%" onclick="setView(\'meetings\')">Alle Besprechungen &#8594;</button></div>';
      return _ccWrap('meetings_home', '&#128483;&#65039; Offene Besprechungen (' + upcomingMeetings.length + ')', '<div class="card-rows">' + meetingsHtml + '</div>');
    })()}
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
  if (S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled') renderTickets();
}

async function openNotif(notifId,ticketId){try{await api('POST','/notifications/'+notifId+'/read');}catch(e){}await fetchData();if(ticketId){openTkDetail(ticketId);setView('tickets');}else renderHome();}
// Für zu einer Zeile zusammengefasste Benachrichtigungen (z.B. "Neues Ticket
// in Technik" + "Dir wurde zugewiesen" zum selben Ticket) — markiert alle
// zusammengefassten Einträge als gelesen, nicht nur den angeklickten.
async function openNotifGroup(idsCsv,ticketId){
  const ids=idsCsv.split(',').filter(Boolean);
  await Promise.all(ids.map(id=>api('POST','/notifications/'+id+'/read').catch(()=>{})));
  await fetchData();
  if(ticketId){openTkDetail(ticketId);setView('tickets');}else renderHome();
}
async function readAllNotifs(){try{await api('POST','/notifications/read-all');await fetchData();renderHome();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
// SCHEDULE
function getVisEvts(){
  let evs=[...S.events];
  if(S.filterUser)evs=evs.filter(ev=>!ev.isGeneral&&ev.userId===S.filterUser);
  if(S.month!==null)evs=evs.filter(ev=>{const d=new Date(ev.dateFrom);return d.getFullYear()===S.year&&d.getMonth()===S.month;});
  else evs=evs.filter(ev=>new Date(ev.dateFrom).getFullYear()===S.year);
  if(S._calSelectedDate){
    const sel=S._calSelectedDate;
    evs=evs.filter(ev=>ev.dateFrom<=sel&&(ev.dateTo||ev.dateFrom)>=sel);
  }
  return evs.sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom));
}
function toggleCalDay(iso){
  S._calSelectedDate=(S._calSelectedDate===iso)?null:iso;
  renderSchedule();
}
function clearCalDay(){
  if(S._calSelectedDate){S._calSelectedDate=null;renderSchedule();}
}
// Jeder Klick auf einen Kalendertag ersetzt das komplette Kalender-HTML
// (toggleCalDay -> renderSchedule), wodurch das ursprüngliche <td> zwischen
// den beiden Klicks eines nativen Doppelklicks aus dem DOM verschwindet und
// der Browser das dblclick-Event dadurch nicht zuverlässig zustellt. Deshalb
// wird der Doppelklick hier manuell per Timer erkannt: kommt der zweite
// Klick innerhalb der Doppelklick-Schwelle, wird der (bereits geplante)
// Einzelklick verworfen und stattdessen das Eintragsfenster geöffnet.
let _calClickTimer=null;
function calDayClick(iso){
  if(_calClickTimer){
    clearTimeout(_calClickTimer);_calClickTimer=null;
    openEvtModal(iso);
    return;
  }
  _calClickTimer=setTimeout(()=>{_calClickTimer=null;toggleCalDay(iso);},280);
}
function getDpMode(){return localStorage.getItem('dpViewMode')||'both';}
function setDpMode(m){localStorage.setItem('dpViewMode',m);renderSchedule();}
function renderSchedule(){
  const mode=getDpMode(); // 'calendar' | 'list' | 'both'
  const evs=getVisEvts();const ml=S.month!==null?MONTHS[S.month]:'Alle';
  const filterU=S.filterUser?getU(S.filterUser):null;
  const modeBtns=`<div style="display:flex;gap:2px;background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:2px">
    ${[['calendar','\ud83d\udcc5 Kalender'],['list','\ud83d\udccb Liste'],['both','Beides']].map(([m,l])=>`<button onclick="setDpMode('${m}')" style="padding:4px 11px;font-size:12px;border:none;border-radius:4px;cursor:pointer;font-family:inherit;transition:.15s;background:${mode===m?'var(--acc)':'transparent'};color:${mode===m?'var(--act)':'var(--mu)'};font-weight:${mode===m?'600':'400'}">${l}</button>`).join('')}
  </div>`;
  const calHtml=_buildCalHtml();
  const listHtml=`
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <h2 style="margin:0;font-size:15px">Eintr\u00e4ge (${evs.length}) <span style="font-size:13px;font-weight:400;color:var(--mu)">${S._calSelectedDate?fd(S._calSelectedDate):ml+' '+S.year}</span>${S._calSelectedDate?` <button class="btn-s" style="font-size:11px;padding:2px 8px" onclick="clearCalDay()">\u2715 ${ml} ${S.year} anzeigen</button>`:''}</h2>
      <input class="srch" type="text" placeholder="Suchen \u2026" oninput="filtSched(this.value)" style="margin-left:auto">
      <select class="flt" onchange="filtSched(undefined,this.value)" id="scFlt"><option value="">Alle Kategorien</option>${S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('')}</select>
      <select class="flt" onchange="_scApFilt=this.value;filtSched()"><option value="">Alle Status</option><option value="pending">\u23f3 Ausstehend</option><option value="approved">\u2713 Genehmigt</option><option value="rejected">\u2717 Abgelehnt</option></select>
    </div>
    <div id="scTb">${buildEvCards(evs)}</div>
    ${!evs.length?'<div class="empty">&#128235; Keine Eintr\u00e4ge</div>':''}`;
  document.getElementById('main').innerHTML=`
    <div class="ph">
      <div class="pt">&#128197; Dienstplan</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${modeBtns}
        <a href="/api/ical/${S.currentUser}" download class="btn-s" style="font-size:12px;text-decoration:none;padding:6px 10px">iCal</a>
        <button class="btn-p" onclick="openEvtModal()">&#65291; Eintrag</button>
      </div>
    </div>
    <div class="fbar" style="flex-wrap:wrap;gap:6px">
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S._calSelectedDate=null;S.year--;renderSBF();renderMain()">&lsaquo;</button><span class="yv">${S.year}</span><button class="yb" onclick="S._calSelectedDate=null;S.year++;renderSBF();renderMain()">&rsaquo;</button></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="mb ${S.month===null?'on':''}" onclick="S._calSelectedDate=null;S.month=null;renderMain()" style="padding:4px 8px;font-size:12px">Alle</button>
        ${MONTHS.map((m,i)=>`<button class="mb ${S.month===i?'on':''}" onclick="S._calSelectedDate=null;S.month=${i};renderMain()" style="padding:4px 8px;font-size:12px">${m.slice(0,3)}</button>`).join('')}
      </div>
      ${S.p.seeAllEntries?`<select class="flt" style="width:auto;min-width:140px" onchange="S.filterUser=this.value||null;renderMain()"><option value="">Alle Mitarbeiter</option>${S.users.filter(u=>!(u.roles||[]).includes('admin')).slice().sort(byLastName).map(u=>`<option value="${u.id}"${S.filterUser===u.id?'selected':''}>${lastNameFirst(u.name)}</option>`).join('')}</select>`:''}
      ${filterU?`<span class="filter-hint">&#128100; ${lastNameFirst(filterU.name)}</span>`:''}
    </div>
    ${mode==='calendar'?calHtml:mode==='list'?listHtml:calHtml+'<div style="margin-top:24px">'+listHtml+'</div>'}`;
}
function _buildCalHtml(){
  var yr=S.year, mo=S.month!==null?S.month:new Date().getMonth();
  var WDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var moNames=['J\u00e4nner','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var firstDay=new Date(yr,mo,1);
  var lastDay=new Date(yr,mo+1,0);
  var startOffset=(firstDay.getDay()+6)%7;
  var rows=Math.max(6,Math.ceil((startOffset+lastDay.getDate())/7));
  var today=new Date();
  var evByDate={};
  var visEvs=S.events.filter(function(ev){
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
        cells+='<td class="cal-empty" onclick="clearCalDay()"></td>';
      } else {
        var devs=evByDate[dayNum]||[];
        var isoDate=yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(dayNum).padStart(2,'0');
        var isToday=today.getFullYear()===yr&&today.getMonth()===mo&&today.getDate()===dayNum;
        var isSel=S._calSelectedDate===isoDate;
        var cls='cal-day'+(isToday?' cal-today':'')+(c>=5?' cal-we':'')+(isSel?' cal-selected':'');
        var dnHtml=isToday?'<div class="cal-daynum cal-daynum-today">'+dayNum+'</div>':'<div class="cal-daynum">'+dayNum+'</div>';
        var evsHtml='';
        devs.slice(0,4).forEach(function(ev){
          if(ev._anonymized){evsHtml+='<div class="cal-ev cal-ev-anon">&#128274;</div>';return;}
          var cat=S.categories.find(function(c2){return c2.id===ev.category;});
          var u=ev.isGeneral?null:S.users.find(function(u2){return u2.id===ev.userId;});
          var color=ev.isGeneral?'#10b981':cat?cat.color:'#3b6dd4';
          // Kategorie ist immer sichtbar (Emoji); Beschreibung ist optional und erg\u00e4nzt nur, falls vorhanden
          var catTag=cat?cat.emoji+' ':'';
          var textPart=ev.reason?ev.reason.slice(0,18):(cat?cat.label.slice(0,18):'');
          var label=(ev.isGeneral?'\ud83c\udf10 ':u?lastNameFirst(u.name)+': ':'')+catTag+textPart;
          var titleAttr=((u?lastNameFirst(u.name)+' \u2014 ':'')+(cat?cat.label:'')+(ev.reason?' \u2014 '+ev.reason:'')).replace(/"/g,'&quot;');
          evsHtml+='<div class="cal-ev" style="background:'+color+'22;border-left:2px solid '+color+';color:'+color+'" title="'+titleAttr+'">'+label+'</div>';
        });
        if(devs.length>4)evsHtml+='<div class="cal-ev-more">+'+(devs.length-4)+' weitere</div>';
        cells+='<td class="'+cls+'" onclick="calDayClick(\''+isoDate+'\')" title="Doppelklick: neuer Eintrag" style="cursor:pointer">'+dnHtml+'<div class="cal-evs">'+evsHtml+'</div></td>';
        dayNum++;
      }
    }
    cells+='</tr>';
  }
  var html='<div style="font-size:13px;font-weight:600;color:var(--mu);margin-bottom:8px">'+moNames[mo]+' '+yr+'</div>';
  html+='<div class="tw"><table class="cal-table"><thead><tr>';
  WDAYS.forEach(function(d){html+='<th>'+d+'</th>';});
  html+='</tr></thead><tbody>'+cells+'</tbody></table></div>';
  return html;
}
function buildEvCards(evs){
  if(!evs.length)return'';
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
        :`<span>${avHtml(emp.initials,emp.color,16,7)}</span><span>${lastNameFirst(emp.name)}</span>`;
      const catChip=anon?`<span style="color:var(--di)">\u2014</span>`:`<span class="bdg" style="background:${cat.color}1a;color:${cat.color}">${cat.emoji} ${cat.label}</span>`;
      const apActions=(!ev.isGeneral&&S.p.canApproveEvents&&!anon&&ev.approvalStatus!=='approved'&&ev.approvalStatus!=='rejected')?
        `<button class="btn-ok" onclick="approveEvt('${ev.id}','approved')">\u2713</button><button class="btn-d" onclick="approveEvt('${ev.id}','rejected')">\u2717</button>`:'';
      return`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--border)${anon?';opacity:.7':''}">
        <div style="width:3px;align-self:stretch;background:${accentColor};border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">${anon?'<span style="color:var(--di);font-style:italic">Anonymisiert</span>':(ev.reason||cat.label||'\u2014').slice(0,80)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
            <span>&#128197; ${ds}</span>${ts!=='\u2014'?`<span>&#128336; ${ts}</span>`:''}
            ${empChip}${catChip}
            ${ev.isGeneral?'':apBdg(ev.approvalStatus||'pending')}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">${apActions}${ev._canEdit?`<button class="btn-e" onclick="openEditEvt('${ev.id}')">\u270e</button>`:''}${canDel?`<button class="btn-d" onclick="deleteEvt('${ev.id}')" title="L\u00f6schen">\ud83d\uddd1\ufe0f</button>`:''}</div>
      </div>`;
    }).join('');
    html+=`</div>`;
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
function openEvtModal(date){
  document.getElementById('fEvId').value='';document.getElementById('evtOvT').textContent='Neuer Eintrag';
  const u=getU(S.currentUser);
  document.getElementById('genRow').style.display=S.p.addGeneral?'block':'none';
  document.getElementById('fGen').checked=false;document.getElementById('empRow').style.display='block';
  const empSel=document.getElementById('fEmp');empSel.innerHTML='';
  // Inaktive Mitarbeiter (kein aktuelles Dienstverhältnis) stehen für NEUE
  // Einträge nicht zur Auswahl — historische Einträge bleiben unangetastet.
  const addable=(S.p.addForOthers?S.users.filter(u2=>u2.isActive!==false):[u].filter(Boolean)).slice().sort(byLastName);
  addable.forEach(u2=>{const opt=document.createElement('option');opt.value=u2.id;opt.textContent=lastNameFirst(u2.name);empSel.appendChild(opt);});
  empSel.value=u?.id||'';
  document.getElementById('fCat').innerHTML='<option value="">\u2014 w\u00e4hlen \u2014</option>'+S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  ['fD1','fD2','fT1','fT2','fRsn'].forEach(id=>document.getElementById(id).value='');
  // Per Doppelklick auf einen Kalendertag geöffnet: Von/Bis gleich mit dem
  // angeklickten Tag vorbefüllen, statt leer zu lassen.
  if(date){document.getElementById('fD1').value=date;document.getElementById('fD2').value=date;}
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
  const d1=document.getElementById('fD1').value,rsn=document.getElementById('fRsn').value.trim(),cat=document.getElementById('fCat').value;
  if(!d1){toast('\u26A0\uFE0F Datum erforderlich!');return;}if(!cat){toast('\u26A0\uFE0F Kategorie erforderlich!');return;}
  const body={dateFrom:d1,dateTo:document.getElementById('fD2').value||d1,timeFrom:document.getElementById('fT1').value,timeTo:document.getElementById('fT2').value,category:cat,reason:rsn};
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
function sumAllw(uid,year,months){return months.reduce((a,m)=>{const r=getAllw(uid,year,m);return{nd:a.nd+r.nd,fd:a.fd+r.fd,fw:a.fw+r.fw,c10:a.c10+r.c10,rkt:a.rkt+(r.rkt||0),buero:a.buero+(r.buero||0)};},{nd:0,fd:0,fw:0,c10:0,rkt:0,buero:0});}
function numCell(n,color,bg){if(!n)return`<td style="text-align:center;color:var(--di)">\u2013</td>`;return`<td style="text-align:center"><span class="anum" style="background:${bg||color+'18'};color:${color}">${n}</span></td>`;}
// Excel-artige Farbskala (gr\u00fcn\u2192gelb\u2192rot) f\u00fcr eine Spalte: v wird relativ zu
// min/max aller Werte dieser Spalte eingef\u00e4rbt, damit Ausrei\u00dfer sofort
// auffallen (z.B. 4 Mitarbeiter mit 4 Nachtdiensten, einer mit 5).
function allwHeatColor(t){
  const lerp=(a,b,x)=>Math.round(a+(b-a)*x);
  const stops=t<=0.5?[[16,185,129],[250,204,21],t*2]:[[250,204,21],[239,68,68],(t-0.5)*2];
  return`rgba(${lerp(stops[0][0],stops[1][0],stops[2])},${lerp(stops[0][1],stops[1][1],stops[2])},${lerp(stops[0][2],stops[1][2],stops[2])},.35)`;
}
function allwColStats(users,getVal){
  const vals=users.map(getVal);
  return{min:Math.min(...vals),max:Math.max(...vals)};
}


function renderCalendar(){renderSchedule();}

// ══════════════════════════════════════════
// SECTION: Diensttausch
// ══════════════════════════════════════════
function renderDiensttausch() {
  const canDecide = S.p.canApproveEvents;
  const list = S.diensttausch;
  function dtCard(dt) {
    const isNew = !dt.isSeen && dt.isRelevant;
    // Bei bereits gelöschten Mitarbeitern liefert getU() nichts mehr — der
    // beim Anlegen zusätzlich gespeicherte Name (createdByName) greift dann.
    const creatorName = getU(dt.createdBy)?.name ? lastNameFirst(getU(dt.createdBy).name) : (dt.createdByName ? lastNameFirst(dt.createdByName) : 'Ehemaliger Mitarbeiter');
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
          ${isNew?'<span class="tk-new-badge" style="margin-right:4px">NEU</span>':''}${esc(creatorName)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);margin-bottom:6px">
          <span>${fdt(dt.createdAt)}</span>
          ${stBadge}
        </div>
        <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;color:var(--tx)">${highlightMentions(dt.text||'')}</div>
        ${dt.rejectReason?`<div style="margin-top:6px;font-size:11px;color:var(--danger);background:rgba(239,68,68,.08);padding:4px 8px;border-radius:4px">&#128680; Grund: ${dt.rejectReason}</div>`:''}
        ${dt.decidedAt?`<div style="font-size:10px;color:var(--mu);margin-top:4px">Entschieden von ${decider?lastNameFirst(decider.name):'?'} am ${fdt(dt.decidedAt)}</div>`:''}
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


// Mitarbeiter mit Teilzeit-Bürotätigkeit (z.B. 50% Leitstelle / 50% Büro):
// dp_employee_params (Dienstplanung → Konfiguration → Mitarbeiterparameter)
// liefert Monatsstunden + gültig-ab je Mitarbeiter — hier wird für einen
// Stichtag der zuletzt gültige Eintrag gesucht, analog zur Backend-Logik
// (ORDER BY valid_from DESC NULLS LAST). Wird nur einmal geladen und dann
// aus S.dpEmpParams wiederverwendet, damit ein Zähler-Klick nicht erneut
// nachlädt.
function getEmpParamsAt(uid,dateStr){
  const list=(S.dpEmpParams||[]).filter(p=>p.employee_id===uid);
  const dated=list.filter(p=>p.valid_from&&String(p.valid_from).slice(0,10)<=dateStr)
    .sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)));
  if(dated.length)return dated[0];
  return list.find(p=>!p.valid_from)||null;
}
function renderAllw(){
  if(!S._allwCategoryExpanded)S._allwCategoryExpanded=_loadAllwCatState();
  // S.dpEmpParams startet als [] (siehe globaler State) — ein Truthy-Check
  // darauf würde den Fetch nie auslösen, da ein leeres Array truthy ist.
  // Eigenes Lade-Flag statt dessen.
  if(!S._dpEmpParamsLoaded){
    S._dpEmpParamsLoaded=true;
    api('GET','/dp/employee-params').then(d=>{S.dpEmpParams=d||[];if(S.view==='allw')renderAllw();}).catch(()=>{S._dpEmpParamsLoaded=false;});
  }
  const months=getPeriodMonths(),yr=S.allwYear;
  const pLbl=S.allwPeriod==='month'?MONTHS[S.allwMonth-1]:S.allwPeriod==='h1'?'1. Halbjahr':S.allwPeriod==='h2'?'2. Halbjahr':'Gesamtjahr';
  // Nur Mitarbeiter zeigen, die im gewählten Zeitraum (mind. teilweise) im
  // Dienstverhältnis waren — z.B. bei Monat "Oktober" verschwindet ein
  // Mitarbeiter mit Austritt Mitte September.
  const periodActive=u=>S.allwPeriod==='month'?isUserActiveInMonth(u,yr,S.allwMonth)
    :S.allwPeriod==='h1'?isUserActiveInRange(u,`${yr}-01-01`,`${yr}-06-30`)
    :S.allwPeriod==='h2'?isUserActiveInRange(u,`${yr}-07-01`,`${yr}-12-31`)
    :isUserActiveInYear(u,yr);
  const showUsers=(S.p.editAllw?S.users.filter(u=>!(u.roles||[]).includes('admin')):[getU(S.currentUser)].filter(Boolean)).filter(periodActive);
  const isBulk=S.p.editAllw&&S.allwPeriod==='month';

  // Gruppierung nach Mitarbeiter-Kategorie, wie in der Planerstellung
  // (dieselbe Sortierlogik: dpEmpCategories.sort_order, unbekannte
  // Kategorien ans Ende).
  const catOrder={};
  (S.dpEmpCategories||[]).forEach((c,i)=>{catOrder[c.name]=c.sort_order??i;});
  catOrder['(ohne Kategorie)']=99999;
  const grouped={};
  showUsers.forEach(u=>{const cat=u.category||'(ohne Kategorie)';(grouped[cat]=grouped[cat]||[]).push(u);});
  const sortedCats=Object.keys(grouped).sort((a,b)=>(catOrder[a]??9999)-(catOrder[b]??9999)||a.localeCompare(b,'de'));
  // Feiertagsdienste gibt es auch als halbe Tage — daher 0,5er-Schritt nur
  // bei "fd", alle anderen Kategorien zählen ganzzahlig.
  const ALLW_CATS=[['nd','Nacht','#3b6dd4',1],['fd','Feiertag','#10b981',0.5],['fw','WE','#f59e0b',1],['c10','C10','#7c3aed',1],['rkt','RKT','#14b8a6',1],['buero','B','#ec4899',1]];
  const fmtAllw=v=>Number.isInteger(v)?String(v):v.toFixed(1);
  const monthDateStr=`${yr}-${String(S.allwMonth||1).padStart(2,'0')}-01`;
  // Mitarbeiter ohne "Nachtdienste möglich" (Dienstplanung-Konfiguration)
  // bekommen keinen Nacht-Zähler und fließen auch nicht in Summen/Statistik
  // für Nächte ein.
  const nightsBlockedFor=u=>{
    const refDate=S.allwPeriod==='month'?monthDateStr:`${yr}-12-31`;
    const ep=getEmpParamsAt(u.id,refDate);
    return ep&&ep.can_do_nights===false;
  };
  const ndEligibleUsers=showUsers.filter(u=>!nightsBlockedFor(u));

  // Farbskala je Spalte, außer RKT (auf Wunsch ausgenommen) — Basis sind
  // immer die aktuell angezeigten Werte (Zähler im Monat, sonst Summe über
  // die Periode), unabhängig von auf-/zugeklappten Kategorien.
  const colStats={};
  ALLW_CATS.forEach(([f])=>{
    if(f==='rkt')return;
    const users=f==='nd'?ndEligibleUsers:showUsers;
    colStats[f]=allwColStats(users,u=>isBulk?(getAllw(u.id,yr,S.allwMonth)[f]||0):sumAllw(u.id,yr,months)[f]);
  });
  const heatBg=(f,v)=>{
    const st=colStats[f];
    if(!st||st.max===st.min)return null;
    return allwHeatColor((v-st.min)/(st.max-st.min));
  };

  const allwCells=u=>{
    const ndBlocked=nightsBlockedFor(u);
    if(!isBulk){const sv=sumAllw(u.id,yr,months);return ALLW_CATS.map(([f,,color])=>f==='nd'&&ndBlocked?'<td style="text-align:center;color:var(--di)" title="Keine Nachtdienste möglich (Dienstplanung-Konfiguration)">–</td>':numCell(sv[f],color,f==='rkt'?null:heatBg(f,sv[f]))).join('');}
    const a=getAllw(u.id,yr,S.allwMonth);
    return ALLW_CATS.map(([f,,color,step])=>{
      if(f==='nd'&&ndBlocked)return'<td style="text-align:center;color:var(--di)" title="Keine Nachtdienste möglich (Dienstplanung-Konfiguration)">–</td>';
      const bg=f==='rkt'?(color+'18'):(heatBg(f,a[f]||0)||(color+'18'));
      return '<td style="text-align:center"><button type="button" class="allw-cnt" style="background:'+bg+';color:'+color+'" onclick="allwCounterClick(event,\''+u.id+'\',\''+f+'\','+step+')" oncontextmenu="allwCounterClick(event,\''+u.id+'\',\''+f+'\',-'+step+');return false" title="Linksklick: +'+step+', Rechtsklick: -'+step+'">'+fmtAllw(a[f]||0)+'</button></td>';
    }).join('');
  };
  // Soll-Stunden Leitstelle = Monatsstunden (aus Dienstplanung-Konfiguration)
  // minus 8h je Bürodienst — nur im Monats-Zeitraum sinnvoll, da sich
  // Monatsstunden je Monat ändern können.
  const allwSollCell=u=>{
    if(S.allwPeriod!=='month')return'<td style="text-align:center;color:var(--di);font-size:11px">–</td>';
    const ep=getEmpParamsAt(u.id,monthDateStr);
    if(!ep?.monthly_hours)return'<td style="text-align:center;color:var(--di);font-size:11px">–</td>';
    const b=(isBulk?getAllw(u.id,yr,S.allwMonth):sumAllw(u.id,yr,months)).buero||0;
    const bueroH=b*8;
    const soll=ep.monthly_hours-bueroH;
    const pct=ep.monthly_hours?(bueroH/ep.monthly_hours*100):0;
    const pctFmt=Number.isInteger(pct)?pct:pct.toFixed(1);
    return'<td style="text-align:center;font-size:12px" title="'+ep.monthly_hours+'h Monatssoll'+(b?' − '+b+'×8h Büro = '+bueroH+'h ('+pctFmt+'%)':'')+'">'+soll+'h'+(b?'<div style="font-size:10px;color:var(--di)">von '+ep.monthly_hours+'h &middot; '+pctFmt+'% Büro</div>':'')+'</td>';
  };
  const allwEmpRow=u=>'<tr><td><div style="display:flex;align-items:center;gap:6px">'+avHtml(u.initials,u.color,22,9)+'<span>'+esc(lastNameFirst(u.name))+'</span></div></td>'+allwCells(u)+allwSollCell(u)+'</tr>';
  let allwBodyRows='';
  sortedCats.forEach(cat=>{
    const empList=grouped[cat].slice().sort((a,b)=>lastNameOf(a.name).localeCompare(lastNameOf(b.name),'de'));
    const catId='allwcat_'+cat.replace(/\W/g,'_');
    const isExpanded=S._allwCategoryExpanded?.[catId]??true;
    allwBodyRows+='<tr style="cursor:pointer;background:var(--sf2);font-weight:600" onclick="toggleAllwCat(\''+catId+'\')">'
      +'<td colspan="8" style="padding:8px 12px">'+(isExpanded?'▼':'▶')+' '+esc(cat)+' ('+empList.length+')</td></tr>';
    if(isExpanded)allwBodyRows+=empList.map(allwEmpRow).join('');
  });

  // Summen über alle sichtbaren Mitarbeiter im gewählten Zeitraum, für die
  // Kopfzeile — WE bewusst ausgenommen, wie gewünscht. Nacht nur über
  // Mitarbeiter mit "Nachtdienste möglich".
  const headerTotals=showUsers.reduce((a,u)=>{const sv=sumAllw(u.id,yr,months);return{nd:a.nd+(nightsBlockedFor(u)?0:sv.nd),fd:a.fd+sv.fd,c10:a.c10+sv.c10,rkt:a.rkt+sv.rkt};},{nd:0,fd:0,c10:0,rkt:0});

  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Zulagendienste <span>${pLbl} ${yr}</span></div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--mu)">
        <span>&#127769; Nacht: <b style="color:var(--tx)">${fmtAllw(headerTotals.nd)}</b></span>
        <span>&#127881; Feiertag: <b style="color:var(--tx)">${fmtAllw(headerTotals.fd)}</b></span>
        <span>&#128203; C10: <b style="color:var(--tx)">${fmtAllw(headerTotals.c10)}</b></span>
        <span>&#128663; RKT: <b style="color:var(--tx)">${fmtAllw(headerTotals.rkt)}</b></span>
      </div>
    </div>
    <div class="fbar" style="flex-wrap:wrap;gap:6px;align-items:center">
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S.allwYear--;renderMain()">&lsaquo;</button><span class="yv">${yr}</span><button class="yb" onclick="S.allwYear++;renderMain()">&rsaquo;</button></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${['month','h1','h2','year'].map(p2=>`<button class="mb ${S.allwPeriod===p2?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.allwPeriod='${p2}';renderMain()">${p2==='month'?'Monatlich':p2==='h1'?'1. Hj.':p2==='h2'?'2. Hj.':'Gesamt'}</button>`).join('')}
      </div>
      ${S.allwPeriod==='month'?`<div style="display:flex;gap:4px;flex-wrap:wrap">${MONTHS.map((m,i)=>`<button class="mb ${S.allwMonth===i+1?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S.allwMonth=${i+1};renderMain()">${m.slice(0,3)}</button>`).join('')}</div>`:''}
    </div>
    ${!S.p.editAllw?`<div class="ib3" style="margin-bottom:12px">&#8505;&#65039; Nur Lesezugriff &ndash; Eintr&#228;ge k&#246;nnen nur von Dienstplanung/Leitung/Admin bearbeitet werden.</div>`:''}
    ${isBulk?`<div class="ib3" style="margin-bottom:12px">\ud83d\uddb1\ufe0f Linksklick auf eine Zahl z\u00e4hlt hoch, Rechtsklick z\u00e4hlt runter \u2013 jeder Klick wird sofort gespeichert.</div>`:''}
    <div class="tw"><div class="tt"><h2>\u00dcbersicht</h2></div>
      <div style="overflow-x:auto"><table><thead><tr><th>Mitarbeiter</th>
        <th style="text-align:center">&#127769; Nacht</th><th style="text-align:center">&#127881; Feiertag</th>
        <th style="text-align:center">&#127958;&#65039; WE</th><th style="text-align:center">&#128203; C10</th>
        <th style="text-align:center">&#128663; RKT</th><th style="text-align:center" title="Bürodienste">&#127970; B</th>
        <th style="text-align:center" title="Monatssoll minus 8h je Bürodienst — nur bei Monatsansicht">&#128337; Soll LS</th>
      </tr></thead>
      <tbody>${allwBodyRows}
      ${(()=>{
        // Durchschnitt nur für Dienstplanung (seeAllAllw) bei mehr als 1 User
        if(!S.p.seeAllAllw||showUsers.length<2)return '';
        const n=showUsers.length;
        const nNd=ndEligibleUsers.length;
        const tot=showUsers.reduce((a,u)=>{const sv=sumAllw(u.id,yr,months);return{nd:a.nd+(nightsBlockedFor(u)?0:sv.nd),fd:a.fd+sv.fd,fw:a.fw+sv.fw,c10:a.c10+sv.c10,rkt:a.rkt+sv.rkt,buero:a.buero+sv.buero};},{nd:0,fd:0,fw:0,c10:0,rkt:0,buero:0});
        const div=S.allwPeriod==='month'?1:S.allwPeriod==='h1'||S.allwPeriod==='h2'?6:12;
        const avg={nd:nNd?tot.nd/nNd:0,fd:tot.fd/n,fw:tot.fw/n,c10:tot.c10/n,rkt:tot.rkt/n,buero:tot.buero/n};
        const fmt=v=>(v%1===0?v:v.toFixed(1));
        return`<tr style="background:rgba(59,109,212,.06);font-weight:700;border-top:2px solid var(--border)">
          <td style="font-size:11px;color:var(--mu)">&#216; Durchschnitt pro MA</td>
          <td style="text-align:center;color:#3b6dd4">${fmt(avg.nd)}</td>
          <td style="text-align:center;color:#10b981">${fmt(avg.fd)}</td>
          <td style="text-align:center;color:#f59e0b">${fmt(avg.fw)}</td>
          <td style="text-align:center;color:#7c3aed">${fmt(avg.c10)}</td>
          <td style="text-align:center;color:#14b8a6">${fmt(avg.rkt)}</td>
          <td style="text-align:center;color:#ec4899">${fmt(avg.buero)}</td>
          <td></td>
        </tr>
        <tr style="background:rgba(59,109,212,.03);border-bottom:2px solid var(--border)">
          <td style="font-size:11px;color:var(--di)">&#216; pro Monat (Periode)</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.nd/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.fd/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.fw/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.c10/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.rkt/div)}</td>
          <td style="text-align:center;font-size:11px;color:var(--mu)">${fmt(avg.buero/div)}</td>
          <td></td>
        </tr>`;
      })()}
      </tbody></table></div>
    </div>`;
}
// Auf-/zugeklappte Kategorien bleiben \u00fcber Seitenaufrufe hinweg erhalten
// (pro Browser, nicht serverseitig \u2013 reine Anzeige-Pr\u00e4ferenz).
function _loadAllwCatState(){
  try{return JSON.parse(localStorage.getItem('lst_allwCatExpanded')||'{}');}catch(e){return{};}
}
function toggleAllwCat(catId){
  if(!S._allwCategoryExpanded)S._allwCategoryExpanded=_loadAllwCatState();
  S._allwCategoryExpanded[catId]=!(S._allwCategoryExpanded[catId]??true);
  try{localStorage.setItem('lst_allwCatExpanded',JSON.stringify(S._allwCategoryExpanded));}catch(e){}
  renderAllw();
}
// Zulagendienste: Linksklick +1, Rechtsklick -1 \u2013 speichert sofort, analog
// zum Klick-Zyklus bei der Weihnachtsdienst-Rotation.
async function allwCounterClick(e,uid,field,delta){
  e.preventDefault();
  const a=getAllw(uid,S.allwYear,S.allwMonth);
  const body={userId:uid,year:S.allwYear,month:S.allwMonth,nd:a.nd||0,fd:a.fd||0,fw:a.fw||0,c10:a.c10||0,rkt:a.rkt||0,buero:a.buero||0};
  body[field]=Math.max(0,Math.round(((a[field]||0)+Number(delta))*10)/10);
  try{
    const updated=await api('PUT','/allowances',body);
    // Nur den einen betroffenen Eintrag lokal patchen statt bei jedem Klick
    // den kompletten /api/data-Bulk-Endpunkt neu zu laden (war sp\u00FCrbar
    // langsam) \u2014 ein direktes renderAllw() reicht f\u00FCr die Anzeige.
    const idx=S.allowances.findIndex(a=>a.userId===uid&&a.year===S.allwYear&&a.month===S.allwMonth);
    if(idx>=0)S.allowances[idx]=updated;else S.allowances.push(updated);
    renderAllw();
  }catch(err){toast('\u26A0\uFE0F '+err.message,'err');}
}
function openAllwM(uid,year,month){
  const u=getU(uid),a=getAllw(uid,year,month);
  document.getElementById('allwT').textContent=`${u?lastNameFirst(u.name):''} \u2013 ${MONTHS[month-1]} ${year}`;
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
      ${canSeeAll?`<select class="flt" onchange="S.abrUser=this.value||null;renderMain()"><option value="">Alle Mitarbeiter</option>${S.users.filter(u=>!(u.roles||[]).includes('admin')).sort((a,b)=>a.name.localeCompare(b.name,'de')).map(u=>`<option value="${u.id}"${S.abrUser===u.id?'selected':''}>${lastNameFirst(u.name)}</option>`).join('')}</select>`:''}
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
                  ${avHtml(u?.initials||'?',u?.color||'#888',18,7)}<span style="font-size:13px;font-weight:600">${u?lastNameFirst(u.name):'?'}</span>
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
                ${avHtml(u?.initials||'?',u?.color||'#888',18,7)}<span style="font-size:12px;font-weight:600">${u?lastNameFirst(u.name):'?'}</span>
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
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${d.label} &middot; ${fdt(d.createdAt)} &middot; ${getU(d.createdBy)?lastNameFirst(getU(d.createdBy).name):'?'}</div>
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
// bucket: 'open' (Standard) | 'closed' | 'cancelled' | 'deleted'
function getVisTks(bucket='open'){
  return S.tickets.filter(tk=>{
    if(bucket==='deleted'){if(!tk.isDeleted)return false;}
    else{
      if(tk.isDeleted)return false;
      if(bucket==='closed'&&tk.status!=='closed')return false;
      if(bucket==='cancelled'&&tk.status!=='cancelled')return false;
      if(bucket==='open'&&isTkClosed(tk))return false;
    }
    if(S.tkFiltDept&&tk.department!==S.tkFiltDept)return false;
    if(S.tkFiltPrio&&tk.priority!==S.tkFiltPrio)return false;
    if(S.tkFiltTag&&!tk.tags.includes(S.tkFiltTag))return false;
    if(S.tkFiltAssignee&&tk.assigneeId!==S.tkFiltAssignee)return false;
    if(S.tkFiltStatus&&tk.status!==S.tkFiltStatus)return false;
    if(S.tkFiltSubcat){if(S.tkFiltSubcat==='__none__'){if(tk.subcategory)return false;}else if(tk.subcategory!==S.tkFiltSubcat)return false;}
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

// Differenzierte Badge-Logik: eigene Aktionen zählen NIE als neu/geändert.
// Priorität: Neue Markierung > Neu > Änderung. Verschwindet beim Öffnen des Tickets.
function tkBadge(tk){
  const me=S.currentUser;
  const viewed=tk.lastViewedAt?new Date(tk.lastViewedAt):null;
  const notes=tk.notes||[];
  const mentionNew=notes.some(n=>n.authorId!==me&&(n.mentionedUsers||[]).includes(me)&&(!viewed||new Date(n.createdAt)>viewed));
  if(mentionNew)return{label:'NEUE MARKIERUNG',cls:'tk-bdg-mention'};
  if(!viewed&&tk.createdBy!==me)return{label:'NEU',cls:'tk-new-badge'};
  if(viewed&&notes.some(n=>n.authorId!==me&&new Date(n.createdAt)>viewed))return{label:'ÄNDERUNG',cls:'tk-bdg-changed'};
  return null;
}
function tkBadgeHtml(tk){const b=tkBadge(tk);return b?`<span class="${b.cls}">${b.label}</span> `:'';}
const tkOpenTodoCount=tk=>(tk.notes||[]).filter(n=>n.todoStatus==='open').length;
const tkOpenTodoHtml=tk=>{const n=tkOpenTodoCount(tk);return n?`<span style="color:#ef4444;font-weight:600">Noch offen: ${n}</span>`:'';};

// Fälligkeits-Färbung: ab 14 Tage vor Fälligkeit von dezentem Orange zu dezentem Rot
function getDueHeatPref(){try{return localStorage.getItem('tkDueHeat')!=='off';}catch(e){return true;}}
function toggleDueHeatPref(on){try{localStorage.setItem('tkDueHeat',on?'on':'off');}catch(e){}renderMain();toast(on?'Fälligkeits-Färbung aktiviert':'Fälligkeits-Färbung deaktiviert');}
function dueHeatStyle(tk){
  if(!getDueHeatPref()||!tk.dueDate||isTkClosed(tk))return'';
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(String(tk.dueDate).slice(0,10));
  const days=Math.round((due-today)/86400000);
  if(days>14)return'';
  const t=Math.max(0,Math.min(1,(14-days)/14));
  const r=Math.round(245+(239-245)*t),g=Math.round(158+(68-158)*t),b=Math.round(11+(68-11)*t);
  return`background:rgba(${r},${g},${b},${(0.05+0.09*t).toFixed(3)});`;
}

function getTkViewPref(){try{return localStorage.getItem('tkViewPref')||'cards';}catch(e){return'cards';}}
function saveTkViewPref(v){try{localStorage.setItem('tkViewPref',v);}catch(e){}if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled')renderTickets();}

function renderTickets(){
  const deleted=S.view==='tickets_deleted';const closed=S.view==='tickets_closed';const cancelled=S.view==='tickets_cancelled';
  const bucket=deleted?'deleted':closed?'closed':cancelled?'cancelled':'open';
  const tks=getVisTks(bucket);
  const myD=S.tp.seeAll?DEPTS:S.tp.myDepts;
  const useTable=getTkViewPref()==='table';
  // Sort: parent tickets first, then children directly below their parent
  const parents=tks.filter(t=>!t.parentTicketId);
  const children=tks.filter(t=>t.parentTicketId);
  const sorted=[];
  parents.forEach(p=>{sorted.push(p);children.filter(c=>c.parentTicketId===p.id).forEach(c=>sorted.push(c));});
  children.filter(c=>!parents.find(p=>p.id===c.parentTicketId)).forEach(c=>sorted.push(c));
  const _tkPrioColor={high:'#ef4444',medium:'#f59e0b',low:'#94a3b8',urgent:'#7c3aed'};
  const canSeeSubcat=!!S.tp.canSeeSubcat;
  const groupMode=(canSeeSubcat&&S.tkGroupBy==='subcat')?'subcat':'dept';

  // Vorschau: letzter Text-Eintrag, sonst Beschreibung (eine Zeile, gekürzt)
  const tkPreview=tk=>{
    const notes=(tk.notes||[]).filter(n=>n.noteType==='note').slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const raw=notes.length?notes[0].text:(tk.description||'');
    const txt=String(raw||'').replace(/\s+/g,' ').trim();
    if(!txt)return'';
    const pfx=notes.length?'💬 ':'📝 ';
    return pfx+esc(txt.length>160?txt.slice(0,160)+'…':txt);
  };

  // Einheitlicher Zeilen-Renderer für die Card-Ansicht
  const rowHtml=(tk,{showDept=true,showSubcat=true}={})=>{
    const asn=getU(tk.assigneeId);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
    const nc=tk.notes.filter(n=>n.noteType==='note').length;
    const isChild=!!tk.parentTicketId;const badge=tkBadge(tk);
    const accent=_tkPrioColor[tk.priority]||'#94a3b8';
    const childStyle=isChild?'margin-left:20px;border-left:2px solid var(--border);background:var(--sf2);':'';
    const isSel=S.tkBatchSel.has(tk.id);
    const preview=tkPreview(tk);
    const heat=dueHeatStyle(tk);
    return`<div style="display:flex;align-items:center;gap:10px;padding:${isChild?'7px 12px 7px 10px':'10px 14px'};border-top:1px solid var(--border);${childStyle}${isSel?'background:rgba(59,109,212,.07);':heat?heat:badge?'background:rgba(245,158,11,.04);':''}" onclick="${S.tkBatchMode?`batchToggleTk('${tk.id}')`:''}" class="clickable">
      ${S.tkBatchMode?`<input type="checkbox" ${isSel?'checked':''} onclick="event.stopPropagation();batchToggleTk('${tk.id}')" style="width:16px;height:16px;flex-shrink:0;cursor:pointer">`:''}
      ${isChild?`<span style="font-size:14px;color:var(--di);flex-shrink:0;margin-right:-4px">&#x21b3;</span>`:''}
      <div style="width:3px;align-self:stretch;background:${accent};border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1;min-width:0" onclick="${S.tkBatchMode?'':'openTkDetail(\''+tk.id+'\')'}">
        <div style="font-size:${isChild?'12px':'13px'};font-weight:600;color:var(--tx);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${tkBadgeHtml(tk)}<span style="font-family:monospace;font-size:11px;color:var(--mu)">${tk.number}</span> ${esc(tk.title)}${showSubcat&&tk.subcategory?` <span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:#7c3aed">${tk.subcategory}</span>`:''}
        </div>
        ${preview?`<div style="font-size:11px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${preview}</div>`:''}
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--mu);align-items:center">
          ${showDept?deptBdg(tk.department):''}${prioBdg(tk.priority)}${stBdg(tk.status)}${tk.lockedForApproval?'<span class="bdg" style="font-size:10px;background:rgba(245,158,11,.15);color:#b45309" title="Zur Freigabe gesperrt">🔒 Freigabe</span>':''}${dueBdg(tk)}${snoozeBdg(tk)}${tagChips(tk.tags)}
          ${asn?`<div style="display:flex;align-items:center;gap:3px">${avHtml(asn.initials,asn.color,14,6)}<span>${lastNameFirst(asn.name)}</span></div>`:''}
          ${isChild&&par?`<span style="color:var(--di);font-size:10px">&#x2191; ${par.number}</span>`:''}
          ${nc?`<span>💬 ${nc}</span>`:''}${tkOpenTodoHtml(tk)}
          <span style="color:var(--di)">Erstellt: ${fd(tk.createdAt)}${tk.updatedAt&&fd(tk.updatedAt)!==fd(tk.createdAt)?' · Letzte Änderung: '+fd(tk.updatedAt):''}${tk.dueDate?' · Fällig: '+fd(tk.dueDate):''}</span>
        </div>
      </div>
    </div>${todoRowsHtml(tk)}`;
  };
  // Schmale, eingerückte Unterzeile je "Noch offen"-Eintrag direkt unter dem Ticket
  const todoRowsHtml=tk=>{
    const openNotes=(tk.notes||[]).filter(n=>n.todoStatus==='open');
    if(!openNotes.length)return'';
    const indent=tk.parentTicketId?52:32;
    return openNotes.map(n=>{
      const txt=String(n.text||'').replace(/\s+/g,' ').trim();
      return`<div style="display:flex;align-items:center;gap:8px;padding:4px 14px;margin-left:${indent}px;border-top:1px solid var(--border);border-radius:4px 0 0 4px;background:rgba(239,68,68,.05);cursor:pointer" onclick="openTkDetail('${tk.id}')" class="clickable">
        <span style="width:3px;align-self:stretch;background:#ef4444;border-radius:2px;flex-shrink:0"></span>
        <span style="font-size:11px;color:#ef4444;font-weight:600;flex-shrink:0;white-space:nowrap">📌 Noch offen:</span>
        <span style="font-size:11px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${esc(txt.length>100?txt.slice(0,100)+'…':txt)}</span>
      </div>`;
    }).join('');
  };
  const wrapGroup=inner=>`<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${inner}</div>`;

  const tableHtml=tks2=>`<div class="tw" style="overflow-x:auto"><table><thead><tr><th>#</th><th>Titel</th><th>Bereich</th><th>Prio</th><th>Status</th><th>Tags</th><th>Zuständig</th><th>Datum</th></tr></thead><tbody>
      ${tks2.map(tk=>{
        const asn=getU(tk.assigneeId);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
        const nc=tk.notes.filter(n=>n.noteType==='note').length;
        const isChild=!!tk.parentTicketId;const badge=tkBadge(tk);
        const heat=dueHeatStyle(tk);
        return`<tr class="clickable${isChild?' tk-child-row':''}${badge&&!heat?' tk-new-row':''}" style="${heat}" onclick="openTkDetail('${tk.id}')">
          <td style="font-family:monospace;font-size:11px;color:var(--mu);white-space:nowrap${isChild?';padding-left:28px':''}">
            ${isChild?'<span style="color:var(--di);margin-right:3px">↳</span>':''}${tk.number}${badge?`<span class="${badge.cls}">${badge.label}</span>`:''}
          </td>
          <td style="max-width:220px"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tk.title)}</div>${nc?`<span style="font-size:10px;color:var(--mu)">💬 ${nc}</span>`:''}${tkOpenTodoCount(tk)?`<span style="font-size:10px;color:#ef4444;font-weight:600;margin-left:6px">Noch offen: ${tkOpenTodoCount(tk)}</span>`:''}</td>
          <td>${deptBdg(tk.department)}${tk.subcategory?`<div><span class="bdg" style="font-size:10px;background:rgba(124,58,237,.12);color:#7c3aed">${tk.subcategory}</span></div>`:''}</td>
          <td>${prioBdg(tk.priority)}</td>
          <td>${stBdg(tk.status)}${tk.lockedForApproval?' 🔒':''}</td>
          <td style="max-width:140px">${tagChips(tk.tags)}${dueBdg(tk)}</td>
          <td style="font-size:12px">${asn?`<div style="display:flex;align-items:center;gap:3px">${avHtml(asn.initials,asn.color,16,7)}<span>${lastNameFirst(asn.name)}</span></div>`:'-'}</td>
          <td style="font-size:11px;color:var(--mu);white-space:nowrap">Erstellt: ${fd(tk.createdAt)}${tk.updatedAt&&fd(tk.updatedAt)!==fd(tk.createdAt)?`<br>Geändert: ${fd(tk.updatedAt)}`:''}${tk.dueDate?`<br>Fällig: ${fd(tk.dueDate)}`:''}</td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;

  let listHtml;
  if(useTable){
    listHtml=sorted.length?tableHtml(sorted):`<div class="empty">&#128235; Keine Tickets</div>`;
  } else {
    listHtml=sorted.length?wrapGroup(sorted.map(tk=>rowHtml(tk)).join('')):`<div class="empty">&#128235; Keine Tickets</div>`;
  }

  // Gruppierung: nach Fachbereich (Standard) oder Unterkategorie
  const deptOrder=[...new Set(sorted.map(t=>t.department))].sort((a,b)=>(DEPT_LABELS[a]||a).localeCompare(DEPT_LABELS[b]||b,'de'));
  let groupedHtml='';
  if(groupMode==='subcat'&&sorted.length){
    const keys=[...new Set(sorted.map(t=>t.subcategory||''))].sort((a,b)=>(a||'￿').localeCompare(b||'￿','de'));
    keys.forEach(key=>{
      const g=sorted.filter(t=>(t.subcategory||'')===key);
      if(!g.length)return;
      const label=key?`<span class="bdg" style="font-size:11px;background:rgba(124,58,237,.12);color:#7c3aed">${key}</span>`:'Ohne Unterkategorie';
      groupedHtml+=`<div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mu);letter-spacing:.5px;padding:6px 2px;margin-bottom:4px">${label} <span style="font-weight:400;color:var(--di)">(${g.length})</span></div>
        ${useTable?tableHtml(g):wrapGroup(g.map(tk=>rowHtml(tk,{showSubcat:false})).join(''))}
      </div>`;
    });
    if(!groupedHtml)groupedHtml='<div class="empty">📫 Keine Tickets</div>';
  } else if(useTable){
    groupedHtml=listHtml;
  } else if(!S.tkFiltDept&&deptOrder.length>1){
    deptOrder.forEach(dept=>{
      const dtks=sorted.filter(t=>t.department===dept);
      if(!dtks.length)return;
      groupedHtml+=`<div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mu);letter-spacing:.5px;padding:6px 2px;margin-bottom:4px">${deptBdg(dept)} ${DEPT_LABELS[dept]||dept} <span style="font-weight:400;color:var(--di)">(${dtks.length})</span></div>
        ${wrapGroup(dtks.map(tk=>rowHtml(tk,{showDept:false})).join(''))}
      </div>`;
    });
    if(!groupedHtml)groupedHtml='<div class="empty">📫 Keine Tickets</div>';
  } else {
    groupedHtml=listHtml;
  }
  const viewIcon=useTable?'\u229e':'\u2261';
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">${deleted?'🗑️ Gelöschte':closed?'Abgeschlossene':cancelled?'🚫 Stornierte':'Offene'} Tickets <span style="font-size:16px;color:var(--mu)">(${tks.length})</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn-s" title="${useTable?'Card-Ansicht':'Tabellen-Ansicht'}" onclick="saveTkViewPref('${useTable?'cards':'table'}')" style="font-size:16px;padding:4px 10px">${viewIcon}</button>
        <button class="btn-s${S.tkBatchMode?' on':''}" onclick="toggleTkBatch()" title="Mehrfachauswahl" style="font-size:13px;padding:5px 10px">&#9745; Auswahl</button>
        ${!deleted?`<button class="btn-p" onclick="openTkForm(null)">&#65291; Ticket</button>`:''}
      </div></div>
    ${!closed&&!deleted&&!cancelled?`<div id="tkEmailDropzone" style="border:2px dashed var(--border);border-radius:var(--r);padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--mu);text-align:center;transition:.15s"
      ondragover="event.preventDefault();this.style.borderColor='var(--acc)';this.style.color='var(--acc)';this.style.background='rgba(59,109,212,.05)'"
      ondragleave="this.style.borderColor='var(--border)';this.style.color='var(--mu)';this.style.background='transparent'"
      ondrop="tkEmailDrop(event,this)">&#128231; E-Mail hierher ziehen, um daraus ein Ticket zu erstellen</div>`:''}
    ${S.tkBatchMode&&S.tkBatchSel.size?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:rgba(59,109,212,.06);border:1px solid rgba(59,109,212,.2);border-radius:var(--r);margin-bottom:10px">
      <span style="font-size:13px;font-weight:600;color:var(--acc)">${S.tkBatchSel.size} ausgewählt</span>
      ${!deleted?`<select id="batchStatus" class="flt" style="font-size:12px"><option value="">Status ändern…</option>${STATUSES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select>
      <select id="batchAssignee" class="flt" style="font-size:12px"><option value="">Zuständig ändern…</option><option value="__none__">— niemand —</option>${S.users.filter(isAssignable).map(u=>`<option value="${u.id}">${lastNameFirst(u.name)}</option>`).join('')}</select>
      <button class="btn-p" style="font-size:12px" onclick="batchApply()">&#10003; Anwenden</button>
      <button class="btn-d" style="font-size:12px" onclick="batchDelete()">&#128465; Löschen</button>`
      :`<button class="btn-ok" style="font-size:12px" onclick="batchRestore()">&#9851; Wiederherstellen</button>`}
      <button class="btn-s" style="font-size:12px" onclick="S.tkBatchSel.clear();renderTickets()">Auswahl aufheben</button>
    </div>`:''}
    <div class="fbar" style="flex-wrap:wrap;gap:6px">
      <input class="srch" type="text" placeholder="Suchen \u2026" value="${S.tkSearch}" oninput="S.tkSearch=this.value;S._tkSearchCursor=this.selectionStart;renderMain()" style="width:160px">
      <select class="flt" onchange="S.tkFiltStatus=this.value;renderMain()"><option value="">Alle Status</option>${STATUSES.filter(s=>closed?s.id==='closed':cancelled?s.id==='cancelled':deleted?true:!TK_INACTIVE_STATUSES.includes(s.id)).map(s=>`<option value="${s.id}"${S.tkFiltStatus===s.id?' selected':''}>${s.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltDept=this.value;renderMain()"><option value="">Alle Bereiche</option>${myD.map(d=>`<option value="${d}"${S.tkFiltDept===d?' selected':''}>${DEPT_LABELS[d]}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltPrio=this.value;renderMain()"><option value="">Alle Priorit\u00e4ten</option>${PRIORITIES.map(p2=>`<option value="${p2.id}"${S.tkFiltPrio===p2.id?' selected':''}>${p2.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltTag=this.value;renderMain()"><option value="">Alle Tags</option>${S.tags.map(t=>`<option value="${t.id}"${S.tkFiltTag===t.id?' selected':''}>${t.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFiltAssignee=this.value;renderMain()"><option value="">Alle Bearbeiter</option>${S.users.filter(isAssignable).map(u=>`<option value="${u.id}"${S.tkFiltAssignee===u.id?' selected':''}>${lastNameFirst(u.name)}</option>`).join('')}</select>
      ${canSeeSubcat?`<select class="flt" onchange="S.tkFiltSubcat=this.value;renderMain()"><option value="">Alle Unterkategorien</option><option value="__none__"${S.tkFiltSubcat==='__none__'?' selected':''}>&mdash; ohne Unterkategorie &mdash;</option>${[...new Set(S.ticketSubcategories.map(s=>s.label))].map(l=>`<option value="${l}"${S.tkFiltSubcat===l?' selected':''}>${l}</option>`).join('')}</select>`:''}
      ${canSeeSubcat?`<select class="flt" onchange="S.tkGroupBy=this.value;renderMain()" title="Gruppierung der Liste"><option value="dept"${groupMode==='dept'?' selected':''}>Gruppierung: Fachbereich</option><option value="subcat"${groupMode==='subcat'?' selected':''}>Gruppierung: Unterkategorie</option></select>`:''}
    </div>
    ${groupedHtml}`;
  if(S._tkSearchCursor!=null){
    const se=document.querySelector('#main .srch');
    if(se){se.focus();se.setSelectionRange(S._tkSearchCursor,S._tkSearchCursor);}
  }
}
function openTkDetail(id){
  S.currentTicketId=id;
  renderTkDetail();
  openModal('tkDetOv');
  // Sofort lokal als gesehen markieren + Server aktualisieren
  const tk=S.tickets.find(t=>t.id===id);
  if(tk){
    tk.lastViewedAt=new Date().toISOString();
    if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled')renderTickets();
    if(S.view==='home')renderHome();
  }
  api('PUT','/tickets/'+id+'/view').catch(()=>{});
}
function highlightMentions(text){return esc(text).replace(/@(\S+)/g,(match,name)=>{const u=S.users.find(u=>u.name.toLowerCase()===name.toLowerCase());return u?`<span class="mention">@${esc(u.name)}</span>`:match;});}
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
  // Neues Format: FIELD + -getrennt (kollisionsfrei, da alt/neu freier
  // Nutzertext sind und selbst Doppelpunkte enthalten können, z.B. Titel).
  const SEP='\u0001';
  if(text.startsWith('FIELD'+SEP)){
    const [,field,from,...rest]=text.split(SEP);
    return{field,from,to:rest.join(SEP)};
  }
  // Alt-Format (vor der Umstellung): ':'-getrennt — bei Werten mit Doppelpunkt
  // (z.B. älteren Titel-Änderungen) wurde der Rest damals bereits abgeschnitten
  // gespeichert und lässt sich nachträglich nicht mehr rekonstruieren.
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
            <span style="font-size:11px;color:var(--mu);text-decoration:line-through;word-break:break-word">${esc(parsed.from)}</span>
            <span style="font-size:11px;color:var(--mu)">→</span>
            <span style="font-size:12px;font-weight:600;color:var(--acc);word-break:break-word">${esc(parsed.to)}</span>
          </div>`:`<div style="font-size:12px;color:var(--mu);white-space:pre-wrap">${esc(n.text)}</div>`}
          <div style="font-size:10px;color:var(--di);margin-top:2px">
            ${a?`${avHtml(a.initials,a.color,12,5)} ${lastNameFirst(a.name)} · `:''}${fdt(n.createdAt)}
          </div>
        </div>
      </div>`;
    } else {
      const todoBg=n.todoStatus==='open'?'rgba(239,68,68,.07)':n.todoStatus==='done'?'rgba(16,185,129,.07)':n.todoStatus==='closing'?'rgba(59,109,212,.07)':n.todoStatus==='cancel'?'rgba(100,116,139,.1)':n.todoStatus==='approval'?'rgba(245,158,11,.08)':n.todoStatus==='approved'?'rgba(16,185,129,.07)':n.todoStatus==='approval_withdrawn'?'rgba(100,116,139,.1)':'var(--sf)';
      const todoBorder=n.todoStatus==='open'?'rgba(239,68,68,.25)':n.todoStatus==='done'?'rgba(16,185,129,.25)':n.todoStatus==='closing'?'rgba(59,109,212,.25)':n.todoStatus==='cancel'?'rgba(100,116,139,.35)':n.todoStatus==='approval'?'rgba(245,158,11,.3)':n.todoStatus==='approved'?'rgba(16,185,129,.25)':n.todoStatus==='approval_withdrawn'?'rgba(100,116,139,.35)':'var(--border)';
      const todoLabel=n.todoStatus==='open'?'<span class="bdg" style="font-size:10px;background:rgba(239,68,68,.12);color:#ef4444">Noch offen</span>'
        :n.todoStatus==='done'?'<span class="bdg" style="font-size:10px;background:rgba(16,185,129,.12);color:#10b981">Erledigt</span>'
        :n.todoStatus==='closing'?'<span class="bdg" style="font-size:10px;background:rgba(59,109,212,.12);color:var(--acc)">🔒 Ticket-Abschluss</span>'
        :n.todoStatus==='cancel'?'<span class="bdg" style="font-size:10px;background:rgba(100,116,139,.15);color:#64748b">🚫 Storniert</span>'
        :n.todoStatus==='approval'?'<span class="bdg" style="font-size:10px;background:rgba(245,158,11,.15);color:#b45309">🔒 Zur Freigabe</span>'
        :n.todoStatus==='approved'?'<span class="bdg" style="font-size:10px;background:rgba(16,185,129,.12);color:#10b981">✅ Freigegeben</span>'
        :n.todoStatus==='approval_withdrawn'?'<span class="bdg" style="font-size:10px;background:rgba(100,116,139,.15);color:#64748b">🔓 Zurückgezogen</span>':'';
      const todoCheckbox=(n.todoStatus==='open'||n.todoStatus==='done')&&canEdit
        ?`<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--mu);cursor:pointer"><input type="checkbox" ${n.todoStatus==='done'?'checked':''} onchange="toggleNoteTodo('${tkId}','${n.id}',this.checked)" style="width:13px;height:13px;cursor:pointer">Erledigt</label>`
        :'';
      const canEditNote=canEdit&&(n.authorId===S.currentUser||S.p.manageUsers);
      const isEditing=S._editingNoteId===n.id;
      const bodyHtml=isEditing
        ?`<div style="display:flex;flex-direction:column;gap:6px">
            <textarea id="noteEditInput-${n.id}" rows="3" style="font-size:13px;width:100%;box-sizing:border-box">${esc(n.text)}</textarea>
            <div style="display:flex;gap:6px">
              <button class="btn-p" style="font-size:11px;padding:3px 10px" onclick="saveEditNote('${tkId}','${n.id}')">Speichern</button>
              <button class="btn-s" style="font-size:11px;padding:3px 10px" onclick="cancelEditNote()">Abbrechen</button>
            </div>
          </div>`
        :`<div style="font-size:13px;line-height:1.5;color:var(--mu);white-space:pre-wrap">${highlightMentions(n.text)}${n.editedAt?'<span style="font-size:10px;color:var(--di);margin-left:4px">(bearbeitet)</span>':''}</div>`;
      return`<div style="display:flex;gap:10px;position:relative">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;z-index:1;overflow:hidden;border:2px solid var(--border)">${a?avHtml(a.initials,a.color,24,10):`<div style="width:28px;height:28px;background:var(--sf2);display:flex;align-items:center;justify-content:center;font-size:14px">💬</div>`}</div>
          ${!isLast?`<div style="width:2px;flex:1;background:var(--border);margin:2px 0;min-height:12px"></div>`:''}
        </div>
        <div style="background:${todoBg};border:1px solid ${todoBorder};border-radius:8px;padding:9px 12px;flex:1;min-width:0;margin-bottom:${isLast?'0':'10px'}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-size:12px;font-weight:700">${a?lastNameFirst(a.name):'?'}</span>
            <span style="font-size:10px;color:var(--di)">${fdt(n.createdAt)}</span>
            ${todoLabel}
            <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
              ${todoCheckbox}
              ${canEditNote&&!isEditing?`<button class="btn-s" style="padding:1px 6px;font-size:10px" onclick="startEditNote('${n.id}')">✎</button>`:''}
              ${canEditNote?`<button class="btn-d" style="padding:1px 6px;font-size:10px" onclick="deleteNote('${tkId}','${n.id}')">✕</button>`:''}
            </div>
          </div>
          ${bodyHtml}
        </div>
      </div>`;
    }
  }).join('');
}
function startEditNote(noteId){S._editingNoteId=noteId;renderTkDetail();const ta=document.getElementById('noteEditInput-'+noteId);if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}}
function cancelEditNote(){S._editingNoteId=null;renderTkDetail();}
async function saveEditNote(tkId,noteId){
  const ta=document.getElementById('noteEditInput-'+noteId);if(!ta)return;
  const text=ta.value.trim();if(!text)return;
  try{
    await api('PUT','/tickets/'+tkId+'/notes/'+noteId,{text});
    S._editingNoteId=null;await fetchData();renderTkDetail();toast('✅ Eintrag aktualisiert');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function renderTkDetail(){
  const tk=getTk(S.currentTicketId);if(!tk)return;
  const canEdit=tk._canEdit;const bkt=BUCKETS.find(b=>b.id===tk.bucket);const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
  const subs=S.tickets.filter(t=>t.parentTicketId===tk.id);
  document.getElementById('tkDetNum').textContent=tk.number;
  document.getElementById('tkDetTitle').textContent=tk.title;
  document.getElementById('tkDetPrio').innerHTML=prioBdg(tk.priority);
  document.getElementById('tkDetSt').innerHTML=stBdg(tk.status);
  // "Zur Freigabe" gesperrt: Feldänderungen sind blockiert (serverseitig
  // ebenso durchgesetzt), nur Notizfelder bleiben bedienbar — separate
  // Variable statt canEdit direkt zu überschreiben, da Notizen und einzelne
  // Notiz-Aktionen (bearbeiten/löschen eigener Einträge) weiterhin canEdit nutzen.
  const locked=!!tk.lockedForApproval;
  const canEditFields=canEdit&&!locked;
  document.getElementById('tkDetEditBtn').style.display=canEditFields?'':'none';
  const notes=tk.notes||[];
  const tab=S._tkTab||'details';
  const tabBtn=(id,label)=>`<button onclick="S._tkTab='${id}';renderTkDetail()" style="padding:8px 16px;font-size:13px;font-weight:${tab===id?'600':'500'};background:none;border:none;border-bottom:2px solid ${tab===id?'var(--acc)':'transparent'};color:${tab===id?'var(--acc)':'var(--mu)'};cursor:pointer;font-family:inherit;transition:.15s;margin-bottom:-1px">${label}</button>`;
  const noteInputHtml=canEdit?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">TEXT</div>
      ${S.noteTemplates.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
        ${S.noteTemplates.map(t=>`<button class="btn-s" style="font-size:11px;padding:3px 9px" onclick="applyNoteTpl(${JSON.stringify(t.body)})">${t.label}</button>`).join('')}
      </div>`:''}
      <div style="display:flex;gap:7px;align-items:flex-end">
        <div class="note-input-wrap" style="flex:1">
          <div class="mention-suggestions" id="mentionSug"></div>
          <textarea id="noteInput" rows="2" placeholder="Text \u2026 @Name f\u00fcr Erw\u00e4hnung" style="font-size:13px;width:100%" onkeyup="onNoteKey(event,'${tk.id}')" oninput="S._tkNoteDraft=S._tkNoteDraft||{};S._tkNoteDraft['${tk.id}']=this.value">${esc((S._tkNoteDraft&&S._tkNoteDraft[tk.id])||'')}</textarea>
        </div>
        <select id="noteTodoType" style="font-size:12px;padding:8px 6px;width:auto;flex-shrink:0" title="Art des Eintrags">
          <option value="">Info</option>
          <option value="open">Noch offen</option>
          <option value="closing">Ticket-Abschluss</option>
          <option value="cancel">Ticket stornieren</option>
          <option value="approval">Zur Freigabe</option>
        </select>
        <button class="btn-p" onclick="addNote('${tk.id}')" style="padding:8px 12px;flex-shrink:0">Senden</button>
      </div>
    </div>`:'';
  const approvalUser=locked?getU(tk.approvalUserId):null;
  const canApprove=locked&&(tk.approvalUserId===S.currentUser||S.p.manageUsers);
  const canWithdrawApproval=locked&&(tk.approvalRequestedBy===S.currentUser||S.p.manageUsers);
  const lockBannerHtml=locked?`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px 14px;margin-bottom:14px">
      <div style="font-size:12px;color:#b45309">🔒 Zur Freigabe gesperrt — wartet auf Freigabe von <b>${approvalUser?esc(lastNameFirst(approvalUser.name)):'?'}</b>. Nur Notizen sind derzeit möglich.</div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${canWithdrawApproval?`<button class="btn-s" onclick="withdrawApprovalTk('${tk.id}')">↩ Anfrage zurückziehen</button>`:''}
        ${canApprove?`<button class="btn-ok" onclick="approveTk('${tk.id}')">✓ Freigeben</button>`:''}
      </div>
    </div>`:'';
  const detailsHtml=`
    ${lockBannerHtml}
    <div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di)">BESCHREIBUNG</div>
        <button class="btn-s" style="font-size:11px;padding:3px 9px" onclick="openAiSuggestionsFor('Ticket','${tk.id}')">🤖 KI-Vorschläge</button>
      </div>
      <div style="font-size:13px;line-height:1.6;color:${tk.description?'var(--tx)':'var(--di)'};white-space:pre-wrap">${tk.description?esc(tk.description):'Keine Beschreibung.'}</div></div>
    ${subs.length||canEditFields?`<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">UNTERTICKETS (${subs.length})</div>
      <div class="subl">${subs.map(st=>`<div class="subi" onclick="S.currentTicketId='${st.id}';renderTkDetail()">\u21b8<span style="font-family:monospace;font-size:11px;color:var(--mu)">${st.number}</span><span style="flex:1;font-size:12px">${st.title}</span>${stBdg(st.status)}</div>`).join('')}
      ${canEditFields?`<button class="btn-s" style="font-size:11px;margin-top:4px" onclick="openTkForm(null,'${tk.id}')">&#65291; Unterticket</button>`:''}
      </div></div>`:''}
    ${tk.checklists.length?`<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">CHECKLISTEN</div>
      ${tk.checklists.map(cl=>`<div style="margin-bottom:10px;padding:10px;background:var(--sf2);border:1px solid var(--border);border-radius:7px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700">${cl.name}</span>
          <div style="display:flex;gap:5px;align-items:center">
            <span style="font-size:10px;color:var(--mu)">${cl.items.filter(i=>i.completedBy).length}/${cl.items.length}</span>
            ${canEditFields&&cl.templateId?`<button class="btn-s" style="padding:2px 6px;font-size:10px" title="Checkliste auf aktuelle Vorlage aktualisieren" onclick="syncCl('${tk.id}','${cl.id}')">&#x1F504; Aktualisieren</button>`:''}
            ${canEditFields?`<button class="btn-d" style="padding:2px 6px;font-size:10px" onclick="removeCl('${tk.id}','${cl.id}')">\u2715</button>`:''}
          </div>
        </div>
        <div class="cl-items">${cl.items.map(it=>`<div class="cl-item${it.completedBy?' done':''}" id="cli-${it.id}">
          <div class="cl-item-row">
            <input type="checkbox" ${it.completedBy?'checked':''} ${locked?'disabled':''} onchange="toggleClItem('${tk.id}','${cl.id}','${it.id}',this.checked)">
            <span class="cl-item-text">${it.text}</span>
            ${it.completedBy?`<span class="cl-done-by">&#128100; ${getU(it.completedBy)?lastNameFirst(getU(it.completedBy).name):'?'}</span>`:''}
          </div>
          ${it.itemType==='check_text'?`<div class="cl-user-note"><input type="text" placeholder="Notiz \u2026" ${locked?'disabled':''} value="${(it.userNote||'').replace(/"/g,'&quot;')}" onchange="saveClItemNote('${tk.id}','${cl.id}','${it.id}',this.value)"></div>`:''}
        </div>`).join('')}</div>
      </div>`).join('')}
    </div>`:''}
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">EINTR\u00c4GE</div>
      <div class="nfeed">${_renderFeed(notes,tk.id,canEdit,'note')}</div>
    </div>
    ${noteInputHtml}`;
  // Historie: reine, schreibgesch\u00fctzte Chronik aller Ticket\u00e4nderungen
  // (Protokoll-Eintr\u00e4ge inkl. Bearbeitungen/L\u00f6schungen von Text-Eintr\u00e4gen) \u2014
  // getrennt von der Details-Ansicht, die nur die Konversation zeigt.
  const historyHtml=`<div class="nfeed">${_renderFeed(notes,tk.id,false,'audit')}</div>`;
  const files=tk.files||[];
  const fmtBytes=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';
  const fileIcon=m=>{if(m.startsWith('image/'))return'\ud83d\uddbc\ufe0f';if(m==='application/pdf')return'\ud83d\udcc4';if(m.includes('word')||m.includes('document'))return'\ud83d\udcdd';if(m.includes('excel')||m.includes('spreadsheet')||m.includes('csv'))return'\ud83d\udcca';if(m.includes('zip')||m.includes('compressed')||m.includes('archive'))return'\ud83d\udddc\ufe0f';if(m.startsWith('video/'))return'\ud83c\udfac';if(m.startsWith('audio/'))return'\ud83c\udfb5';return'\ud83d\udcce';};
  const filesHtml=`
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di)">${files.length} Datei${files.length!==1?'en':''}</span>
        <label class="btn-p" style="cursor:pointer;font-size:12px;padding:6px 12px">
          &#8679; Datei hochladen
          <input type="file" multiple style="display:none" onchange="uploadTkFiles('${tk.id}',this)">
        </label>
      </div>
      <div id="tk-dropzone-${tk.id}" style="border:2px dashed var(--border);border-radius:8px;padding:32px 20px;text-align:center;margin-bottom:16px;background:var(--sf);cursor:pointer;transition:all 0.2s" ondragover="event.preventDefault();this.style.background='var(--acc)';this.style.borderColor='var(--acc)';this.style.color='#fff'" ondragleave="this.style.background='var(--sf)';this.style.borderColor='var(--border)';this.style.color='var(--mu)'" ondrop="event.preventDefault();this.style.background='var(--sf)';this.style.borderColor='var(--border)';uploadTkFiles('${tk.id}',{files:event.dataTransfer.files})">
        <div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:6px">📁 Dateien hier ablegen</div>
        <div style="font-size:12px;color:var(--mu)">oder klicken zum Durchsuchen</div>
        <input type="file" multiple id="tk-dropinput-${tk.id}" style="display:none" onchange="uploadTkFiles('${tk.id}',this)">
      </div>
      <script>document.getElementById('tk-dropzone-${tk.id}').addEventListener('click', () => document.getElementById('tk-dropinput-${tk.id}').click(), false);</script>
      ${files.length===0?`<div style="text-align:center;padding:32px 0;color:var(--di);font-size:13px">Noch keine Dateien hochgeladen.</div>`:''}
      <div class="tk-files-list">
        ${files.map(f=>`<div class="tk-file-row">
          <div class="tk-file-icon">${fileIcon(f.mimeType)}</div>
          <div class="tk-file-info">
            <a href="/api/tickets/${tk.id}/files/${f.id}" target="_blank" rel="noopener" class="tk-file-name">${f.originalName}</a>
            <div class="tk-file-meta">${fmtBytes(f.sizeBytes)} &bull; ${getU(f.uploadedBy)?lastNameFirst(getU(f.uploadedBy).name):'?'} &bull; ${fdt(f.createdAt)}</div>
            ${f.mimeType.startsWith('image/')?`<div class="tk-file-thumb"><img src="/api/tickets/${tk.id}/files/${f.id}" alt="${f.originalName}" loading="lazy"></div>`:''}
          </div>
          ${canEditFields?`<button class="btn-d tk-file-del" onclick="deleteTkFile('${tk.id}','${f.id}','${f.originalName.replace(/'/g,"\\'")}')">&#128465;</button>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  // Wird u.a. alle 30s vom Hintergrund-Refresh neu aufgerufen \u2014 ohne diese
  // Fokus-/Cursor-Rettung w\u00fcrde der Nutzer beim Tippen in "noteInput" mitten
  // im Satz aus dem Feld fliegen, weil das <textarea> hier neu erzeugt wird.
  const _tkActiveId=document.activeElement?.id;
  const _tkActiveSel=(_tkActiveId==='noteInput')?document.getElementById('noteInput')?.selectionStart:null;
  document.getElementById('tkDetMain').innerHTML=`
    <div style="border-bottom:1px solid var(--border);margin:-18px -18px 14px;padding:0 18px;display:flex;gap:0">
      ${tabBtn('details','\ud83d\udccb Details')}
      ${tabBtn('files','\ud83d\udcce Dateien'+(files.length?` (${files.length})`:''))}
      ${tabBtn('history','\ud83d\udd52 Historie')}
    </div>
    ${tab==='details'?detailsHtml:tab==='files'?filesHtml:historyHtml}`;
  if(_tkActiveId){
    const _tkRestore=document.getElementById(_tkActiveId);
    if(_tkRestore){
      _tkRestore.focus();
      if(_tkActiveSel!=null&&_tkRestore.setSelectionRange)_tkRestore.setSelectionRange(_tkActiveSel,_tkActiveSel);
    }
  }
  document.getElementById('tkDetSB').innerHTML=`
    ${canEditFields?`
    <div class="tkf"><label>Status</label><select onchange="updateTkField('${tk.id}','status',this.value)">${STATUSES.map(s=>`<option value="${s.id}"${tk.status===s.id?' selected':''}>${s.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Priorit\u00e4t</label><select onchange="updateTkField('${tk.id}','priority',this.value)">${PRIORITIES.map(p2=>`<option value="${p2.id}"${tk.priority===p2.id?' selected':''}>${p2.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Fachbereich</label>${tk.parentTicketId?
      `<div class="val">${deptBdg(tk.department)} <span style="font-size:11px;color:var(--mu)">(vom Elternticket übernommen)</span></div>`
      :`<select onchange="updateTkField('${tk.id}','department',this.value)">${DEPTS.map(d=>`<option value="${d}"${tk.department===d?' selected':''}>${DEPT_LABELS[d]}</option>`).join('')}</select>`}</div>
    ${S.tp.canSeeSubcat?`<div class="tkf"><label>Unterkategorie</label><select onchange="updateTkField('${tk.id}','subcategory',this.value)"><option value="">— keine —</option>${(()=>{const opts=S.ticketSubcategories.filter(s=>s.department===tk.department).map(s=>s.label);if(tk.subcategory&&!opts.includes(tk.subcategory))opts.unshift(tk.subcategory);return opts.map(l=>`<option value="${l}"${tk.subcategory===l?' selected':''}>${l}</option>`).join('');})()}</select></div>`:''}
    <div class="tkf"><label>Bucket</label><select onchange="updateTkField('${tk.id}','bucket',this.value)"><option value="">\u2014</option>${BUCKETS.map(b=>`<option value="${b.id}"${tk.bucket===b.id?' selected':''}>${b.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Zust\u00e4ndig</label><div style="display:flex;gap:5px">
      <select onchange="updateTkField('${tk.id}','assigneeId',this.value||null)" style="flex:1"><option value="">\u2014</option>${S.users.filter(isAssignable).map(u=>`<option value="${u.id}"${tk.assigneeId===u.id?' selected':''}>${lastNameFirst(u.name)}</option>`).join('')}</select>
      ${S.tp.canAssign&&tk.assigneeId!==S.currentUser?`<button class="btn-ok" onclick="updateTkField('${tk.id}','assigneeId','${S.currentUser}')">Ich</button>`:''}
    </div></div>
    ${S.tp.canSetPublic?`<div class="tkf"><label>Sichtbarkeit</label><button class="bdg ${tk.isPublic?'pub-on':'pub-off'}" onclick="updateTkField('${tk.id}','isPublic',${!tk.isPublic})" style="cursor:pointer;padding:5px 10px;border-radius:6px;font-size:12px">${tk.isPublic?'&#127760; \u00d6ffentlich':'&#128274; Privat'}</button></div>`:''}
    <div class="tkf"><label>Elternticket</label><select onchange="updateTkField('${tk.id}','parentTicketId',this.value||null)"><option value="">\u2014</option>${(() => {
      const active = S.tickets.filter(t=>t.id!==tk.id && !t.parentTicketId && !t.isDeleted && !isTkClosed(t)).map(t=>`<option value="${t.id}"${tk.parentTicketId===t.id?' selected':''}>${t.number}: ${t.title.slice(0,25)}</option>`).join('');
      const closed = S.tickets.filter(t=>t.id!==tk.id && !t.parentTicketId && !t.isDeleted && isTkClosed(t)).map(t=>`<option value="${t.id}"${tk.parentTicketId===t.id?' selected':''}>${t.number}: ${t.title.slice(0,25)}</option>`).join('');
      return active + (closed ? `<optgroup label="Abgeschlossen/Storniert">${closed}</optgroup>` : '');
    })()}</select></div>
    <div class="tkf"><label>&#128197; F\u00e4lligkeit</label><input type="date" value="${tk.dueDate||''}" onchange="updateTkField('${tk.id}','dueDate',this.value||null)" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx);width:100%;box-sizing:border-box"></div>
    <div class="tkf"><label>&#128100; Einmelder</label><input type="text" value="${esc(tk.reporter||'')}" placeholder="optional" onchange="updateTkField('${tk.id}','reporter',this.value.trim())" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx);width:100%;box-sizing:border-box"></div>`
    :`<div class="tkf"><label>Status</label><div class="val">${stBdg(tk.status)}</div></div>
    <div class="tkf"><label>Priorit\u00e4t</label><div class="val">${prioBdg(tk.priority)}</div></div>
    <div class="tkf"><label>Fachbereich</label><div class="val">${deptBdg(tk.department)}</div></div>
    ${S.tp.canSeeSubcat&&tk.subcategory?`<div class="tkf"><label>Unterkategorie</label><div class="val"><span class="bdg" style="font-size:11px;background:rgba(124,58,237,.12);color:#7c3aed">${tk.subcategory}</span></div></div>`:''}
    <div class="tkf"><label>Zust\u00e4ndig</label><div class="val">${getU(tk.assigneeId)?`<div style="display:flex;align-items:center;gap:5px">${avHtml(getU(tk.assigneeId).initials,getU(tk.assigneeId).color,18,8)}<span style="font-size:12px">${lastNameFirst(getU(tk.assigneeId).name)}</span></div>`:'\u2014'}</div></div>
    ${tk.reporter?`<div class="tkf"><label>&#128100; Einmelder</label><div class="val" style="font-size:12px">${esc(tk.reporter)}</div></div>`:''}`}
    <div class="tkdiv"></div>
    <div class="tkf"><label>Tags</label><div>${tagChips(tk.tags)||'<span style="color:var(--di);font-size:11px">\u2014</span>'}</div></div>
    <div class="tkf"><label>&#128164; Wiedervorlage</label>
      ${canEditFields?`<div style="display:flex;gap:5px;align-items:center">
        <input type="date" value="${tk.snoozedUntil||''}" id="snoozeDate" style="flex:1;font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx)">
        <button class="btn-s" style="font-size:11px;padding:3px 7px" onclick="setSnooze('${tk.id}')">&#10003;</button>
        ${tk.snoozedUntil?`<button class="btn-d" style="font-size:11px;padding:3px 7px" onclick="updateTkField('${tk.id}','snoozedUntil',null);toast('\u2705 Wiedervorlage entfernt')">\u2715</button>`:''}
      </div>`:
      `<div style="font-size:12px;color:var(--mu)">${tk.snoozedUntil?'bis '+new Date(tk.snoozedUntil).toLocaleDateString('de-DE'):'\u2014'}</div>`}
    </div>
    <div class="tkf"><label>Erstellt von</label><div style="font-size:12px">${getU(tk.createdBy)?lastNameFirst(getU(tk.createdBy).name):'?'}</div></div>
    <div class="tkf"><label>Erstellt am</label><div style="font-size:11px;color:var(--mu)">${fdt(tk.createdAt)}</div></div>
    <div class="tkf"><label>&#128101; Teilnehmer</label>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:${canEditFields?'4px':'0'}">
        ${(tk.participants||[]).map(pid=>{const pu=getU(pid);if(!pu)return'';return `<span class="bdg" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:var(--sf2)" title="${esc(lastNameFirst(pu.name))}">${avHtml(pu.initials,pu.color,16,7)}<span style="font-size:11px">${esc(lastNameFirst(pu.name))}</span>${canEditFields?`<button onclick="removeTkParticipant('${tk.id}','${pid}')" title="Entfernen" style="border:none;background:none;cursor:pointer;color:var(--danger);font-size:11px;padding:0;margin-left:2px">&#10005;</button>`:''}</span>`;}).join('')}
        ${!(tk.participants||[]).length?'<span style="font-size:11px;color:var(--di)">— keine —</span>':''}
      </div>
      ${canEditFields?`<select onchange="if(this.value){addTkParticipant('${tk.id}',this.value);}this.value='';" style="width:100%;font-size:12px"><option value="">+ Teilnehmer hinzufügen…</option>${S.users.filter(u=>isAssignable(u)&&u.id!==tk.createdBy&&u.id!==tk.assigneeId&&!(tk.participants||[]).includes(u.id)).slice().sort(byLastName).map(u=>`<option value="${u.id}">${lastNameFirst(u.name)}</option>`).join('')}</select>`:''}
    </div>
    ${par?`<div class="tkf"><label>Elternticket</label><div class="subi" onclick="S.currentTicketId='${par.id}';renderTkDetail()" style="margin-top:4px"><span style="font-family:monospace;font-size:11px">${par.number}</span><span style="font-size:12px;flex:1">${par.title.slice(0,22)}</span></div></div>`:''}
    ${canEditFields?`<div class="tkdiv"></div>
    <button class="btn-s" style="width:100%;justify-content:center;font-size:12px" onclick="openAttachCl('${tk.id}')">&#9745;&#65039; Checkliste anh\u00e4ngen</button>
    ${!isTkClosed(tk)?`<button class="btn-ok" style="width:100%;justify-content:center;margin-top:4px" onclick="updateTkField('${tk.id}','status','closed')">\u2713 Abschlie\u00dfen</button>`:''}`:''}`;
  // KI-Ergebnisse bekommen eine eigene, breitere Spalte links im Fenster
  // statt unter der Beschreibung eingebettet zu sein \u2014 Fenster wird daf\u00fcr
  // automatisch breiter (siehe .modal.xl.wide-ai).
  const hasAi=!!(tk.aiStatus||tk.ai_status);
  document.getElementById('tkDetModal')?.classList.toggle('wide-ai',hasAi);
  document.getElementById('tkDetBody')?.classList.toggle('has-ai',hasAi);
  const aiCol=document.getElementById('tkDetAi');
  if(aiCol)aiCol.innerHTML=hasAi?`<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:8px">\ud83e\udd16 KI-L\u00d6SUNGEN</div>${aiInlinePanelHtml(tk)}`:'';
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
    if(sugs.length){sug.innerHTML=sugs.map((u,i)=>`<div class="mention-opt${i===0?' active':''}" onclick="insertMention('${u.name}')">${avHtml(u.initials,u.color,20,8)} ${lastNameFirst(u.name)}</div>`).join('');sug.classList.add('open');_mentionActive=true;}
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
async function addTkParticipant(tkId,userId){
  try{await api('PUT','/tickets/'+tkId+'/participants',{userId,action:'add'});await fetchData();renderTkDetail();toast('\u2705 Teilnehmer hinzugef\u00FCgt');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function removeTkParticipant(tkId,userId){
  try{await api('PUT','/tickets/'+tkId+'/participants',{userId,action:'remove'});await fetchData();renderTkDetail();}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
function applyNoteTpl(body){const inp=document.getElementById('noteInput');if(inp){inp.value=body;inp.focus();inp.setSelectionRange(body.length,body.length);}}
async function addNote(tkId){
  const inp=document.getElementById('noteInput');if(!inp?.value.trim())return;
  const todoSel=document.getElementById('noteTodoType');
  const kind=todoSel?todoSel.value:'';
  const isClosing=kind==='closing';
  const isCancel=kind==='cancel';
  const isApproval=kind==='approval';
  if(isClosing&&!confirm('Ticket nach dem Senden dieser Abschlussnachricht als abgeschlossen markieren?'))return;
  if(isCancel&&!confirm('Ticket nach dem Senden dieser Stornierungsnachricht als storniert markieren?'))return;
  if(isApproval&&!/@\S/.test(inp.value)){toast('\u26A0\uFE0F Bitte im Text mit @Name die Person markieren, die freigeben muss','err');return;}
  if(isApproval&&!confirm('Ticket nach dem Senden f\u00fcr alle Feld\u00e4nderungen sperren, bis die markierte Person freigibt? (Notizen bleiben weiterhin m\u00f6glich)'))return;
  const todoStatus=kind==='open'?'open':kind==='closing'?'closing':kind==='cancel'?'cancel':kind==='approval'?'approval':undefined;
  try{
    await api('POST','/tickets/'+tkId+'/notes',{text:inp.value.trim(),todoStatus});
    if(isClosing)await api('PUT','/tickets/'+tkId,{status:'closed'});
    if(isCancel)await api('PUT','/tickets/'+tkId,{status:'cancelled'});
    inp.value='';if(todoSel)todoSel.value='';if(S._tkNoteDraft)delete S._tkNoteDraft[tkId];
    await fetchData();renderTkDetail();
    // Liste im Hintergrund (unter dem Detail-Modal) sonst veraltet, bis Seite
    // neu geladen wird \u2014 Ticket verschwindet erst nach Reload aus "Offen".
    if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted')renderTickets();
    if(isClosing)toast('\u2705 Ticket abgeschlossen');
    else if(isCancel)toast('\ud83d\udeab Ticket storniert');
    else if(isApproval)toast('\ud83d\udd12 Ticket zur Freigabe gesperrt');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function approveTk(tkId){
  if(!confirm('Ticket freigeben? Es ist danach wieder f\u00fcr alle normal bearbeitbar.'))return;
  try{
    await api('POST','/tickets/'+tkId+'/approve');
    await fetchData();renderTkDetail();
    if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted')renderTickets();
    toast('\u2705 Ticket freigegeben');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function withdrawApprovalTk(tkId){
  if(!confirm('Freigabe-Anfrage zur\u00fcckziehen? Das Ticket ist danach wieder f\u00fcr alle normal bearbeitbar, ohne dass eine Freigabe erfolgt ist.'))return;
  try{
    await api('POST','/tickets/'+tkId+'/withdraw-approval');
    await fetchData();renderTkDetail();
    if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted')renderTickets();
    toast('\uD83D\uDD13 Freigabe-Anfrage zur\u00fcckgezogen');
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function toggleNoteTodo(tkId,noteId,checked){
  try{
    await api('PUT','/tickets/'+tkId+'/notes/'+noteId,{todoStatus:checked?'done':'open'});
    await fetchData();renderTkDetail();
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
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
// Fachbereich folgt immer dem gewählten Elternticket (Backend erzwingt das
// ohnehin beim Speichern) — hier nur, damit die Auswahl schon vorher stimmt
// und nicht überraschend beim Speichern "umspringt".
function onTkParentChange(){
  const parId=document.getElementById('tkFPar')?.value||'';
  const deptSel=document.getElementById('tkFDept');
  const hint=document.getElementById('tkFParHint');
  if(!deptSel)return;
  if(parId){
    const parent=getTk(parId);
    if(parent){deptSel.value=parent.department;onTkDeptChange();}
    deptSel.disabled=true;
    if(hint)hint.style.display='block';
  } else {
    deptSel.disabled=false;
    if(hint)hint.style.display='none';
  }
}
function _arrayBufferToBase64(buf){
  let binary='';
  const bytes=new Uint8Array(buf);
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  return btoa(binary);
}
// E-Mail (Outlook .msg oder .eml) per Drag&Drop auf die Ticket-Liste ziehen →
// Server liest Betreff/Absender/Text aus, "Neues Ticket"-Formular öffnet sich
// vorausgefüllt (Absender landet im eigenen "Einmelder"-Feld).
async function tkEmailDrop(event,el){
  event.preventDefault();
  el.style.borderColor='var(--border)';el.style.color='var(--mu)';el.style.background='transparent';
  const file=event.dataTransfer.files?.[0];
  if(!file)return;
  const name=file.name.toLowerCase();
  if(!name.endsWith('.msg')&&!name.endsWith('.eml')){toast('⚠️ Bitte eine .msg- oder .eml-Datei ablegen','err');return;}
  toast('📧 E-Mail wird gelesen…');
  try{
    const buf=await file.arrayBuffer();
    const data=_arrayBufferToBase64(buf);
    const result=await api('POST','/email/parse',{filename:file.name,data});
    openTkForm(null);
    document.getElementById('tkFNm').value=(result.subject||'').slice(0,200);
    document.getElementById('tkFReporter').value=[result.senderName,result.senderEmail?'<'+result.senderEmail+'>':''].filter(Boolean).join(' ');
    document.getElementById('tkFDesc').value=(result.body||'').trim();
    toast('✅ E-Mail übernommen — bitte Angaben prüfen');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function openTkForm(id,parentId){
  const tk=id?getTk(id):null;
  document.getElementById('tkFT').textContent=tk?`Ticket bearbeiten: ${tk.number}`:'Neues Ticket';
  document.getElementById('tkFId').value=tk?.id||'';
  document.getElementById('tkFNm').value=tk?.title||'';
  document.getElementById('tkFReporter').value=tk?.reporter||'';
  document.getElementById('tkFDesc').value=tk?.description||'';
  // Auswahl aus dem aktuellen (admin-verwaltbaren) DEPTS-Stand neu aufbauen —
  // statisches HTML kennt nur die 6 ursprünglichen Fachbereiche.
  document.getElementById('tkFDept').innerHTML=DEPTS.map(d=>`<option value="${d}">${DEPT_LABELS[d]||d}</option>`).join('');
  document.getElementById('tkFDept').value=tk?.department||'frei';
  document.getElementById('tkFDept').disabled=false;
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
  document.getElementById('tkFAsgn').innerHTML='<option value="">\u2014 niemand \u2014</option>'+S.users.filter(isAssignable).map(u=>`<option value="${u.id}"${tk?.assigneeId===u.id?' selected':''}>${lastNameFirst(u.name)}</option>`).join('');
  const pid=parentId||tk?.parentTicketId||'';
  document.getElementById('tkFPar').innerHTML='<option value="">\u2014</option>'+S.tickets.filter(t=>!id||t.id!==id).map(t=>`<option value="${t.id}"${t.id===pid?' selected':''}>${t.number}: ${t.title.slice(0,35)}</option>`).join('');
  onTkParentChange();
  const dueFld=document.getElementById('tkFDue');if(dueFld)dueFld.value=tk?.dueDate||'';
  // Sichtbarkeit: bei neuen Tickets Standard "Öffentlich" (server-seitig
  // ebenso der Default), bei bestehenden der tatsächliche Wert.
  S._tkFormVisPublic = tk ? !!tk.isPublic : true;
  const visWrap=document.getElementById('tkFVisWrap');
  if(visWrap)visWrap.style.display=S.tp.canSetPublic?'':'none';
  renderTkFormVisibility();
  closeModal('tkDetOv');openModal('tkFormOv');
}
function renderTkFormVisibility(){
  const btn=document.getElementById('tkFVisBtn');if(!btn)return;
  btn.className='bdg '+(S._tkFormVisPublic?'pub-on':'pub-off');
  btn.textContent=S._tkFormVisPublic?'🌐 Öffentlich':'🔒 Privat';
}
function toggleTkFormVisibility(){S._tkFormVisPublic=!S._tkFormVisPublic;renderTkFormVisibility();}
async function saveTicket(withAi){
  const nm=document.getElementById('tkFNm').value.trim();if(!nm){toast('\u26A0\uFE0F Name erforderlich!');return;}
  const id=document.getElementById('tkFId').value;
  const tags=Array.from(document.getElementById('tkFTags').selectedOptions).map(o=>o.value);
  const body={title:nm,reporter:document.getElementById('tkFReporter').value.trim(),description:document.getElementById('tkFDesc').value.trim(),department:document.getElementById('tkFDept').value,subcategory:document.getElementById('tkFSubcat')?.value||'',priority:document.getElementById('tkFPrio').value,status:document.getElementById('tkFSt').value,bucket:document.getElementById('tkFBkt').value,tags,assigneeId:document.getElementById('tkFAsgn').value||null,parentTicketId:document.getElementById('tkFPar').value||null,dueDate:document.getElementById('tkFDue')?.value||null,aiSearch:!!withAi,isPublic:S.tp.canSetPublic?!!S._tkFormVisPublic:undefined};
  try{
    let savedId=id;
    if(id)await api('PUT','/tickets/'+id,body);
    else{const created=await api('POST','/tickets',body);savedId=created.id;}
    await fetchData();closeModal('tkFormOv');renderMain();
    if(withAi&&savedId){
      toast('\u2705 Gespeichert \u2014 KI durchsucht im Hintergrund\u2026');
      openTkDetail(savedId);
    }else{
      toast(id?'\u2705 Aktualisiert!':'\u2705 Erstellt!');
    }
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
          <div style="font-size:11px;color:var(--mu);margin-bottom:6px">${cl.items.length} Punkte &middot; ${getU(cl.createdBy)?lastNameFirst(getU(cl.createdBy).name):'?'}</div>
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
  document.getElementById('clFDept').innerHTML=DEPTS.filter(d=>d!=='frei').map(d=>`<option value="${d}">${DEPT_LABELS[d]||d}</option>`).join('');
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
async function syncCl(tkId,clId){try{await api('PUT','/tickets/'+tkId+'/checklists/'+clId+'/sync');await fetchData();renderTkDetail();toast('\u2705 Checkliste aktualisiert!');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
async function toggleClItem(tkId,clId,iId,checked){try{await api('PUT','/tickets/'+tkId+'/checklists/'+clId+'/items/'+iId,{completed:checked});await fetchData();renderTkDetail();}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
async function saveClItemNote(tkId,clId,iId,note){try{await api('PUT','/tickets/'+tkId+'/checklists/'+clId+'/items/'+iId,{userNote:note});}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}}
async function uploadTkFiles(tkId,input){
  const files=[...input.files];if(!files.length)return;
  const MAX=15*1024*1024;
  let done=0,errs=[];
  toast('\u23F3 '+files.length+' Datei(en) werden hochgeladen\u2026');
  for(const f of files){
    if(f.size>MAX){errs.push(f.name+': Zu gro\u00DF (max. 15 MB)');continue;}
    try{
      const buf=await f.arrayBuffer();
      const bytes=new Uint8Array(buf);
      let b64='';const chunk=8192;
      for(let i=0;i<bytes.length;i+=chunk)b64+=String.fromCharCode(...bytes.subarray(i,i+chunk));
      b64=btoa(b64);
      await api('POST','/tickets/'+tkId+'/files',{name:f.name,mimeType:f.type||'application/octet-stream',data:b64});
      done++;
    }catch(e){errs.push(f.name+': '+e.message);}
  }
  await fetchData();
  S._tkTab='files';
  renderTkDetail();
  if(errs.length)toast('\u26A0\uFE0F Fehler: '+errs.join(', '),'err');
  else toast('\u2705 '+done+' Datei(en) hochgeladen');
  if(input.value!==undefined)input.value='';
}
async function deleteTkFile(tkId,fId,name){
  if(!confirm('Datei "'+name+'" wirklich l\u00F6schen?'))return;
  try{await api('DELETE','/tickets/'+tkId+'/files/'+fId);await fetchData();renderTkDetail();toast('\u2705 Datei gel\u00F6scht');}
  catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
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
          ${isSent?`<span>An: <strong>${toUser?lastNameFirst(toUser.name):'Alle Mitarbeiter'}</strong></span>`:`<span>Von: <strong>${from?lastNameFirst(from.name):'?'}</strong></span>`}
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
  document.getElementById('msgDetMeta').innerHTML=`Von: <strong>${from?lastNameFirst(from.name):'?'}</strong> &middot; ${fdt(m.createdAt)} &middot; An: <strong>${m.targetType==='all'?'Alle Mitarbeiter':toUser?lastNameFirst(toUser.name):m.targetValue}</strong>`;
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
  if(sel)sel.innerHTML='<option value="">Alle Mitarbeiter</option>'+S.users.filter(u=>u.id!==S.currentUser).map(u=>`<option value="${u.id}">${lastNameFirst(u.name)}</option>`).join('');
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
function swTab(t){['users','cats','tags','stats','rights','depts','subcats','notetpls','log','ho','shifts','links'].forEach(x=>{document.getElementById('atb-'+x)?.classList.toggle('on',x===t);document.getElementById('atp-'+x)?.classList.toggle('on',x===t);});if(t==='ho')renderHoAdmin();if(t==='subcats')renderSubcatAdmin();if(t==='notetpls')renderNoteTplAdmin();if(t==='stats')renderStatsPanel();if(t==='shifts')renderShiftsAdmin();if(t==='links')renderLinksAdmin();if(t==='rights')renderRightsMatrix();if(t==='depts')renderDeptsAdmin();}
function backToAdmin(tab='users'){['ufOv','cfOv','tfOv','deptOv'].forEach(closeModal);openAdminModal();swTab(tab);}
function renderUsrList(){document.getElementById('usrList').innerHTML=S.users.map(u=>`<div class="ai"${u.isActive===false?' style="opacity:.45;font-style:italic"':''}>${avHtml(u.initials,u.color,34,13,u.isOnline)}<div class="aii"><div class="ain">${lastNameFirst(u.name)} ${u.isActive===false?'\uD83D\uDEAB inaktiv \u00B7 ':''}${roleBadges(u.id)}${u.isOnline?'<span style="font-size:10px;color:var(--ok)">\u25cf online</span>':''}</div><div class="ais">${u.mustChangePW?'\u26A0\uFE0F PW ausstehend':'\u2713 Aktiv'}${u.hireDate?' \u00B7 seit '+u.hireDate.split('-').reverse().join('.'):''}${u.terminationDate?' \u00B7 bis '+u.terminationDate.split('-').reverse().join('.'):''}</div></div><div class="aia"><button class="btn-e" onclick="openUF('${u.id}')">\u270e</button>${S.users.length>1&&u.id!==S.currentUser?`<button class="btn-d" onclick="delUser('${u.id}')">\u2715</button>`:''}</div></div>`).join('');}
function renderCatList(){document.getElementById('catList').innerHTML=S.categories.map(c=>`<div class="ai"><div style="width:14px;height:14px;border-radius:3px;background:${c.color};flex-shrink:0"></div><div class="aii"><div class="ain">${c.emoji} ${c.label}</div></div><div class="aia"><button class="btn-e" onclick="openCF('${c.id}')">\u270e</button>${S.categories.length>1?`<button class="btn-d" onclick="delCat('${c.id}')">\u2715</button>`:''}</div></div>`).join('');}
function renderTagList(){document.getElementById('tagList').innerHTML=S.tags.map(t=>`<div class="ai"><div style="width:14px;height:14px;border-radius:3px;background:${t.color};flex-shrink:0"></div><div class="aii"><div class="ain"><span class="tag-chip" style="background:${t.color}1a;color:${t.color}">${t.label}</span></div></div><div class="aia"><button class="btn-e" onclick="openTF('${t.id}')">\u270e</button>${S.tags.length>1?`<button class="btn-d" onclick="delTag('${t.id}')">\u2715</button>`:''}</div></div>`).join('');}
const RIGHTS_ROLES_LIST=['admin','leitung','dienstplanung','schichtleiter','technik','qm','standard'];
// Muss mit db.js NAV_TABS (key+label) \u00fcbereinstimmen \u2014 bewusst dupliziert
// (Frontend hat keinen Zugriff auf db.js), Reihenfolge/Gruppierung entspricht
// der Sidebar.
const RIGHTS_NAV_TABS=[
  {key:'home',label:'\u00dcbersicht'},{key:'sop',label:'Notfall-Checklisten'},{key:'docs',label:'Dokumente'},{key:'meetings',label:'Besprechungen'},{key:'todos',label:'Todos'},{key:'contacts',label:'Kontakte'},
  {key:'schedule',label:'Dienstplan (Kalender)'},{key:'allw',label:'Zulagendienste'},{key:'homeoffice',label:'Homeoffice'},{key:'vacation',label:'Urlaubs\u00fcbersicht'},
  {key:'diensttausch',label:'Diensttausch'},{key:'abrechnung',label:'Abrechnung'},{key:'dienstplaene',label:'Dienstpl\u00e4ne'},
  {key:'zahnarzt',label:'Dienstplan Zahn\u00e4rzte'},{key:'platz',label:'Platz\u00fcbersicht'},{key:'links',label:'Links'},
  {key:'tickets',label:'Tickets: Offene'},{key:'tickets_closed',label:'Tickets: Abgeschlossene'},{key:'tickets_cancelled',label:'Tickets: Stornierte'},{key:'tickets_deleted',label:'Tickets: Gel\u00f6schte'},{key:'checklists',label:'Checklisten'},
  {key:'dp',label:'Dienstplanung: Planerstellung'},{key:'dp-config',label:'Dienstplanung: Konfiguration'},{key:'dp-christmas',label:'Dienstplanung: Weihnachtsdienst'},{key:'dp-mine',label:'Dienstplanung: Mein Dienstplan'},
  {key:'messages',label:'Nachrichten: Eingang'},{key:'messages_sent',label:'Nachrichten: Gesendet'},{key:'news',label:'News'},{key:'statistik',label:'Statistik'},
  {key:'spint',label:'Spindvergabe'},{key:'chat',label:'Chat'},
];
function renderRightsMatrix(){
  const el=document.getElementById('rightsMatrix');if(!el)return;
  const ROLES_LIST=RIGHTS_ROLES_LIST;
  const PERMS=[
    {key:'manageUsers',label:'Benutzerverwaltung'},
    {key:'canApproveEvents',label:'Kalender/Urlaub: alle Eintr\u00e4ge sehen',hint:'Sonst nur eigene + f\u00fcr einen erstellte Eintr\u00e4ge; andere User werden im Dienstplan/in der Urlaubs\u00fcbersicht anonymisiert angezeigt (Name/Grund verborgen).'},
    {key:'editAllPersonal',label:'Alle Eintr\u00e4ge bearbeiten'},
    {key:'addForOthers',label:'F\u00fcr andere eintragen'},
    {key:'addGeneral',label:'Allg. Eintr\u00e4ge'},
    {key:'seeAllAllw',label:'Zulagendienste: alle sehen',hint:'Sonst nur die eigenen Zulagendienste.'},
    {key:'editAllw',label:'Zulagen bearbeiten'},
    {key:'seeAllAbrechnung',label:'Abrechnung: alle sehen',hint:'Sonst nur die eigene Abrechnung.'},
    {key:'canSendMessages',label:'Nachrichten senden'},
    {key:'manageSop',label:'Notfall-Checklisten verwalten',hint:'Vorlagen anlegen/bearbeiten/freigeben. Ausführen können weiterhin alle Nutzer, unabhängig von diesem Recht.'},
  ];
  const defaults={
    admin:{manageUsers:1,canApproveEvents:1,editAllPersonal:1,addForOthers:1,addGeneral:1,seeAllAllw:1,editAllw:1,seeAllAbrechnung:1,canSendMessages:1,manageSop:1},
    leitung:{canApproveEvents:1,editAllPersonal:1,addForOthers:1,addGeneral:1,seeAllAllw:1,editAllw:1,canSendMessages:1,manageSop:1},
    dienstplanung:{canApproveEvents:1,editAllPersonal:1,addForOthers:1,addGeneral:1,seeAllAllw:1,editAllw:1,seeAllAbrechnung:1,canSendMessages:1},
    schichtleiter:{addForOthers:1,canSendMessages:1},
    technik:{addGeneral:1,canSendMessages:1,manageSop:1},
    qm:{addForOthers:1,addGeneral:1,canSendMessages:1},
    standard:{},
  };
  const ovMap={};
  (S.rolePermissions||[]).forEach(o=>{if(!ovMap[o.role])ovMap[o.role]={};ovMap[o.role][o.permission]=o.granted;});
  const permTable=(rows,keyOf,defaultOf)=>`<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);min-width:200px">Recht</th>
        ${ROLES_LIST.map(r=>`<th style="padding:6px 8px;border-bottom:2px solid var(--border);text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px">${r}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map((p2,pi)=>`<tr style="background:${pi%2===0?'var(--sf2)':'transparent'}">
          <td style="padding:6px 8px;font-size:12px;color:var(--tx)" title="${p2.hint?esc(p2.hint):''}">${p2.label}${p2.hint?' \u2139\ufe0f':''}</td>
          ${ROLES_LIST.map(r=>{
            const permKey=keyOf(p2);
            const defVal=defaultOf(r,p2);
            const override=ovMap[r]?.[permKey];
            const effective=override!==undefined?override:defVal;
            const isOverridden=override!==undefined;
            return`<td style="text-align:center;padding:6px 8px">
              <label style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:2px" title="${isOverridden?'\u00dcberschrieben':'Standard'}">
                <input type="checkbox" ${effective?'checked':''} onchange="setRightOverride('${r}','${permKey}',this.checked)" style="cursor:pointer">
                ${isOverridden?`<span style="font-size:9px;color:${override?'var(--ok)':'var(--danger)'}">${override?'\u2191':'\u2193'}</span>`:''}
              </label>
            </td>`;
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;
  el.innerHTML=`<div style="overflow-x:auto">
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">Rechte</div>
    ${permTable(PERMS, p2=>p2.key, (r,p2)=>!!(defaults[r]||{})[p2.key])}
    <div style="font-size:11px;color:var(--mu);margin:10px 0 20px">\u2191/\u2193 = manuell \u00fcberschrieben \u00b7 \u00c4nderungen werden sofort gespeichert</div>
    <div style="font-weight:700;font-size:13px;margin-bottom:4px">Reiter-Sichtbarkeit im Men\u00fc</div>
    <div style="font-size:11px;color:var(--mu);margin-bottom:8px">Blendet den jeweiligen Reiter in der Seitenleiste f\u00fcr die Rolle aus \u2014 ersetzt keine serverseitige Zugriffssperre (z.B. Dienstplanung bleibt zus\u00e4tzlich auf berechtigte Rollen beschr\u00e4nkt).</div>
    ${permTable(RIGHTS_NAV_TABS, t=>'tab:'+t.key, ()=>true)}
    <div style="font-size:11px;color:var(--mu);margin-top:10px">\u2191/\u2193 = manuell \u00fcberschrieben \u00b7 \u00c4nderungen werden sofort gespeichert</div>
  </div>`;
}
function renderDeptsAdmin(){
  const el=document.getElementById('deptsList');if(!el)return;
  el.innerHTML=`<div style="font-size:11px;color:var(--mu);margin-bottom:8px">Werden bei Tickets, Statistik und der Zuordnung von Mitarbeitern verwendet. Ein neuer Fachbereich muss einem Mitarbeiter zus\u00e4tzlich unter "Rollen" im Bearbeiten-Formular zugewiesen werden.</div>
    <div>${(S.departments||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(d=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border)">
      <span style="font-size:16px">${d.emoji||'\ud83c\udfe2'}</span>
      <span style="flex:1;font-size:13px">${esc(d.label)}</span>
      <button class="btn-s" style="font-size:11px;padding:2px 6px" onclick="openDeptForm('${d.id}')">\u270e</button>
      <button class="btn-d" style="font-size:11px;padding:2px 6px" onclick="deleteDept('${d.id}')">\u2715</button>
    </div>`).join('')}</div>
    <button class="btn-s" style="margin-top:8px" onclick="openDeptForm()">+ Fachbereich hinzuf\u00fcgen</button>`;
}
function openDeptForm(id){
  const d=id?(S.departments||[]).find(x=>x.id===id):null;
  document.getElementById('dpFT').textContent=d?'Fachbereich bearbeiten':'Neuer Fachbereich';
  document.getElementById('dpId').value=id||'';
  document.getElementById('deptLabel').value=d?.label||'';
  document.getElementById('dpEmoji').value=d?.emoji||'';
  document.getElementById('dpColor').value=d?.color||'#64748b';
  closeModal('admOv');openModal('deptOv');
}
async function saveDept(){
  const id=document.getElementById('dpId').value;
  const label=document.getElementById('deptLabel').value.trim();
  if(!label)return toast('\u26a0\ufe0f Bezeichnung erforderlich','err');
  const body={label,emoji:document.getElementById('dpEmoji').value.trim(),color:document.getElementById('dpColor').value};
  try{
    if(id) await api('PUT','/departments/'+id,body);
    else await api('POST','/departments',body);
    await fetchData();backToAdmin('depts');toast(id?'\u2705 Aktualisiert!':'\u2705 Angelegt!');
  }catch(e){toast('\u26a0\ufe0f '+e.message,'err');}
}
async function deleteDept(id){
  if(!confirm('Fachbereich l\u00f6schen?'))return;
  try{await api('DELETE','/departments/'+id);await fetchData();renderDeptsAdmin();toast('\u2705 Gel\u00f6scht');}catch(e){toast('\u26a0\ufe0f '+e.message,'err');}
}
async function setRightOverride(role,permission,granted){
  try{
    await api('POST','/role-permissions',{role,permission,granted});
    await fetchData();renderRightsMatrix();
    toast('\u2705 Recht aktualisiert');
  }catch(e){toast('\u26a0\ufe0f '+e.message,'err');}
}
// Wiederverwendbarer Emoji-Picker für alle "Symbol (Emoji)"-Textfelder in
// der App (Kategorien, Fachbereiche, Spind-Kategorien, ...) — bisher musste
// das Emoji per Hand eingegeben/eingefügt werden.
const EMOJI_PALETTE=['😀','😂','😉','😊','😍','😘','😎','🤔','😅','😢','😭','😡','👍','👎','👏','🙏','💪','🎉','❤️','🔥','🔧','⭐','📋','🎓','✅','🌐','🏢','📦','🚚','👕','🧤','⛑️','🧹','🚨','📞','💡','🔒','🔑','🧰','🛠️','⚡','🚿','🧯','🩹','📁','📂','🗂️','📌','📎','✏️','📝','🗒️','📅','⏰','✔️','❌','⚠️','ℹ️','❓','❗','🏥','🚑','🚒','🏫','🏭','🚻','👤','👥','🏆','🎯','📊','💻','🖨️','📷','☎️','📧','🚪','🧊','☀️','🌙','🍀','💧','🩺','🧪','🚦','🅿️','♿','🪑','🧴','🧽'];
let _emojiPickerTarget=null, _emojiPickerMode='replace';
function openEmojiPicker(inputId,btn,mode){
  const pop=document.getElementById('emojiPickerPopup');
  if(!pop)return;
  if(pop.style.display==='block'&&_emojiPickerTarget===inputId){closeEmojiPicker();return;}
  _emojiPickerTarget=inputId;
  _emojiPickerMode=mode||'replace';
  pop.innerHTML=EMOJI_PALETTE.map(e=>`<span onclick="pickEmoji('${e}')" style="cursor:pointer;font-size:18px;padding:4px;display:inline-block;border-radius:4px" onmouseover="this.style.background='var(--sf2)'" onmouseout="this.style.background='none'">${e}</span>`).join('');
  const r=btn.getBoundingClientRect();
  // Popup ist ~230px hoch — passt es unterhalb des Buttons nicht mehr in den
  // sichtbaren Bereich (z.B. Emoji-Button im Chatfenster ganz unten am
  // Bildschirmrand), stattdessen oberhalb öffnen statt es abzuschneiden.
  const popH=230;
  if(r.bottom+popH+4>window.innerHeight){
    pop.style.top='';
    pop.style.bottom=(window.innerHeight-r.top+4)+'px';
  } else {
    pop.style.bottom='';
    pop.style.top=(r.bottom+4)+'px';
  }
  pop.style.left=Math.max(4,Math.min(r.left,window.innerWidth-270))+'px';
  pop.style.display='block';
  // vorher entfernen statt bedingt hinzuzufügen — sonst sammeln sich bei
  // mehrfachem Öffnen ohne Schließen doppelte Listener an
  document.removeEventListener('click',_emojiPickerOutsideClick,{capture:true});
  document.addEventListener('click',_emojiPickerOutsideClick,{capture:true});
}
function closeEmojiPicker(){
  const pop=document.getElementById('emojiPickerPopup');
  if(pop)pop.style.display='none';
  document.removeEventListener('click',_emojiPickerOutsideClick,{capture:true});
}
function pickEmoji(e){
  if(_emojiPickerTarget){
    const el=document.getElementById(_emojiPickerTarget);
    if(el){
      if(_emojiPickerMode==='insert'){
        const start=el.selectionStart??el.value.length, end=el.selectionEnd??el.value.length;
        el.value=el.value.slice(0,start)+e+el.value.slice(end);
        el.focus();el.setSelectionRange(start+e.length,start+e.length);
      } else {
        el.value=e;
      }
    }
  }
  closeEmojiPicker();
}
function _emojiPickerOutsideClick(ev){
  const pop=document.getElementById('emojiPickerPopup');
  if(pop&&pop.style.display==='block'&&!pop.contains(ev.target)&&!ev.target.closest('.emoji-pick-btn')){
    closeEmojiPicker();
  }
}
function buildCP(cid,sel,fn){document.getElementById(cid).innerHTML=pal().map(col=>`<div class="cp ${col===sel?'on':''}" style="background:${col}" onclick="${fn}('${col}','${cid}')"></div>`).join('');}
function pickU(col,cid){S.ufColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickC(col,cid){S.cfColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickT(col,cid){S.tfColor=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function openUF(id){
  const u=id?getU(id):null;
  document.getElementById('ufT').textContent=u?'Benutzer bearbeiten':'Benutzer anlegen';
  document.getElementById('ufId').value=u?.id||'';document.getElementById('ufNm').value=u?.name||'';document.getElementById('ufIn').value=u?.initials||'';
  document.getElementById('uffCategory').value=u?.category||'';
  document.getElementById('ufEmail').value=u?.email||'';
  document.getElementById('ufUsername').value=u?.username||'';
  document.getElementById('ufHireDate').value=u?.hireDate||'';
  document.getElementById('ufTermDate').value=u?.terminationDate||'';
  document.getElementById('ufPWRR').style.display=u?'block':'none';document.getElementById('ufPWRst').checked=false;
  document.getElementById('ufErr').textContent='';S.ufColor=u?.color||pal()[0];
  // Neu vom Admin angelegte Fachbereiche (nicht 'frei' — das ist kein echter
  // Mitarbeiter-Bereich, sondern "für alle offen") sind noch keine eigene
  // Rolle in ROLES — als zusätzliche Checkboxen anhängen, sonst gibt es keine
  // Möglichkeit, einen Mitarbeiter diesem Fachbereich zuzuordnen.
  const extraDeptRoles=(S.departments||[]).filter(d=>d.id!=='frei'&&!ROLES.some(r=>r.id===d.id));
  document.getElementById('ufRoles').innerHTML=ROLES.map(r=>`<label class="rck"><input type="checkbox" value="${r.id}" ${(u?.roles||['standard']).includes(r.id)?'checked':''}><span>${r.icon} ${r.label}</span></label>`).join('')
    +extraDeptRoles.map(d=>`<label class="rck"><input type="checkbox" value="${d.id}" ${(u?.roles||['standard']).includes(d.id)?'checked':''}><span>${d.emoji||'🏢'} ${d.label}</span></label>`).join('');
  // Rechte-Verlauf: reine Nachvollziehbarkeit, nur für bereits bestehende
  // Mitarbeiter sichtbar (bei Neuanlage gibt es noch keinen).
  const histWrap=document.getElementById('ufRoleHistWrap');
  histWrap.style.display=u?'':'none';
  document.getElementById('ufRoleHistBody').style.display='none';
  document.getElementById('ufRoleHistBody').innerHTML='';
  // Dienstplan-Einstellungen: eingebettet statt eigener Admin-Bereich, damit
  // die Benutzerverwaltung alles an einem Ort hat.
  document.getElementById('ufDpRelevant').checked=!!u?.dpRelevant;
  document.getElementById('ufIsTestUser').checked=!!u?.isTestUser;
  const dpSection=document.getElementById('ufDpSection');
  dpSection.style.display=u?.dpRelevant?'':'none';
  if(u?.dpRelevant)renderUfDpParamsSection(u.id);
  else document.getElementById('ufDpParamsBody').innerHTML=id?'':'<div style="font-size:12px;color:var(--mu)">Erst nach dem Speichern des Mitarbeiters verfügbar.</div>';
  buildCP('ufCR',S.ufColor,'pickU');closeModal('admOv');openModal('ufOv');
}
// Blendet den eingebetteten Dienstplan-Abschnitt ein/aus. Bei einem noch
// nicht gespeicherten (neuen) Mitarbeiter gibt es noch keine ID, an die
// dp_employee_params geknüpft werden könnte — dort erst nach dem Speichern
// verfügbar.
function onUfDpRelevantChange(){
  const on=document.getElementById('ufDpRelevant').checked;
  const dpSection=document.getElementById('ufDpSection');
  dpSection.style.display=on?'':'none';
  const uid=document.getElementById('ufId').value;
  if(on&&uid)renderUfDpParamsSection(uid);
}
async function toggleUfRoleHistory(){
  const body=document.getElementById('ufRoleHistBody');
  if(!body)return;
  const willShow=body.style.display==='none';
  body.style.display=willShow?'':'none';
  if(!willShow||body.dataset.loaded)return;
  const uid=document.getElementById('ufId').value;
  if(!uid)return;
  body.innerHTML='Lade…';
  try{
    const hist=await api('GET','/users/'+uid+'/role-history');
    body.dataset.loaded='1';
    if(!hist.length){body.innerHTML='Noch keine Rechte-Änderungen protokolliert.';return;}
    const roleLabel=r=>ROLES.find(x=>x.id===r)?.label||r;
    body.innerHTML=hist.map(h=>{
      const who=getU(h.changedBy);
      return `<div style="padding:4px 0;border-top:1px solid var(--border)">
        <div>${fdt(h.changedAt)}${who?' · '+esc(lastNameFirst(who.name)):''}</div>
        <div>${esc(h.oldRoles.map(roleLabel).join(', ')||'—')} → ${esc(h.newRoles.map(roleLabel).join(', ')||'—')}</div>
      </div>`;
    }).join('');
  }catch(e){body.innerHTML='⚠️ '+esc(e.message);}
}
async function saveUser(){
  const name=document.getElementById('ufNm').value.trim(),initials=document.getElementById('ufIn').value.trim().toUpperCase();
  const category=document.getElementById('uffCategory').value.trim()||null;
  const email=document.getElementById('ufEmail').value.trim()||null;
  const username=document.getElementById('ufUsername').value.trim().toLowerCase();
  const hireDate=document.getElementById('ufHireDate').value||'';
  const terminationDate=document.getElementById('ufTermDate').value||null;
  const errEl=document.getElementById('ufErr');errEl.textContent='';
  if(!name||!initials){errEl.textContent='\u26A0\uFE0F Name und K\u00fcrzel erforderlich!';return;}
  if(!hireDate){errEl.textContent='\u26A0\uFE0F Eintrittsdatum erforderlich!';return;}
  if(terminationDate&&terminationDate<hireDate){errEl.textContent='\u26A0\uFE0F Austrittsdatum darf nicht vor dem Eintrittsdatum liegen!';return;}
  if(!/^[a-z0-9._-]{3,40}$/.test(username)){errEl.textContent='\u26A0\uFE0F Benutzername: min. 3 Zeichen, nur Buchstaben/Zahlen/._-!';return;}
  const roles=Array.from(document.querySelectorAll('#ufRoles input:checked')).map(cb=>cb.value);
  if(!roles.length){errEl.textContent='\u26A0\uFE0F Mindestens eine Rolle!';return;}
  const id=document.getElementById('ufId').value;loading(true);
  const dpRelevant=document.getElementById('ufDpRelevant')?document.getElementById('ufDpRelevant').checked:false;
  const isTestUser=document.getElementById('ufIsTestUser')?document.getElementById('ufIsTestUser').checked:false;
  try{
    if(id)await api('PUT','/users/'+id,{name,initials,roles,color:S.ufColor,resetPassword:document.getElementById('ufPWRst').checked,category,email,username,hireDate,terminationDate,dpRelevant,isTestUser});
    else await api('POST','/users',{name,initials,roles,color:S.ufColor,category,email,username,hireDate,terminationDate,dpRelevant,isTestUser});
    await fetchData();backToAdmin('users');toast('\u2705 Benutzer gespeichert!');
  }catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}
}
async function delUser(id){if(!confirm('Benutzer l\u00f6schen?'))return;loading(true);try{await api('DELETE','/users/'+id);await fetchData();backToAdmin('users');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
function openCF(id){const c=id?getCat(id):null;document.getElementById('cfT').textContent=c?'Kategorie bearbeiten':'Kategorie anlegen';document.getElementById('cfId').value=c?.id||'';document.getElementById('cfLb').value=c?.label||'';document.getElementById('cfEm').value=c?.emoji||'\uD83D\uDCCC';document.getElementById('cfErr').textContent='';S.cfColor=c?.color||pal()[2];buildCP('cfCR',S.cfColor,'pickC');closeModal('admOv');openModal('cfOv');}
async function saveCategory(){const label=document.getElementById('cfLb').value.trim();const errEl=document.getElementById('cfErr');errEl.textContent='';if(!label){errEl.textContent='\u26A0\uFE0F Bezeichnung erforderlich!';return;}const id=document.getElementById('cfId').value;loading(true);try{if(id)await api('PUT','/categories/'+id,{label,emoji:document.getElementById('cfEm').value.trim()||'\uD83D\uDCCC',color:S.cfColor});else await api('POST','/categories',{label,emoji:document.getElementById('cfEm').value.trim()||'\uD83D\uDCCC',color:S.cfColor});await fetchData();backToAdmin('cats');toast('\u2705 Gespeichert!');}catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}}
async function delCat(id){if(!confirm('Kategorie l\u00f6schen?'))return;loading(true);try{await api('DELETE','/categories/'+id);await fetchData();backToAdmin('cats');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
function openTF(id){const t=id?getTag(id):null;document.getElementById('tfT').textContent=t?'Tag bearbeiten':'Tag anlegen';document.getElementById('tfId').value=t?.id||'';document.getElementById('tfLb').value=t?.label||'';document.getElementById('tfErr').textContent='';S.tfColor=t?.color||pal()[0];buildCP('tfCR',S.tfColor,'pickT');closeModal('admOv');openModal('tfOv');}
async function saveTag(){const label=document.getElementById('tfLb').value.trim();const errEl=document.getElementById('tfErr');errEl.textContent='';if(!label){errEl.textContent='\u26A0\uFE0F Bezeichnung erforderlich!';return;}const id=document.getElementById('tfId').value;loading(true);try{if(id)await api('PUT','/tags/'+id,{label,color:S.tfColor});else await api('POST','/tags',{label,color:S.tfColor});await fetchData();backToAdmin('tags');toast('\u2705 Gespeichert!');}catch(e){errEl.textContent='\u26A0\uFE0F '+e.message;}finally{loading(false);}}
async function delTag(id){if(!confirm('Tag l\u00f6schen?'))return;loading(true);try{await api('DELETE','/tags/'+id);await fetchData();backToAdmin('tags');}catch(e){toast('\u26A0\uFE0F '+e.message,'err');}finally{loading(false);}}
// \u2500\u2500 "ANSICHT ALS" (Testuser-Impersonation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// S.imp.realIsAdmin bezieht sich immer auf die tats\u00E4chlich angemeldete Person
// (nicht auf den evtl. gerade angezeigten Testuser) \u2014 Button/Banner richten
// sich danach, damit man w\u00E4hrend einer laufenden Ansicht jederzeit sauber
// wieder zur eigenen Sicht zur\u00FCckkann.
function renderViewAsUi(){
  const btn=document.getElementById('viewAsBtn');
  if(btn)btn.style.display=S.imp?.realIsAdmin?'':'none';
  const banner=document.getElementById('viewAsBanner');
  if(!banner)return;
  if(S.imp?.viewingAs){
    banner.style.display='flex';
    document.getElementById('viewAsBannerName').textContent=S.imp.viewingAs.name;
  } else {
    banner.style.display='none';
  }
}
function openViewAsMenu(){
  const sel=document.getElementById('viewAsSelect');
  const testUsers=S.imp?.testUsers||[];
  if(!testUsers.length){toast('\u26A0\uFE0F Noch keine Testuser angelegt \u2014 im Benutzer-Formular als "Testuser" markieren','err');return;}
  sel.innerHTML=testUsers.slice().sort((a,b)=>a.name.localeCompare(b.name,'de')).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  openModal('viewAsOv');
}
async function startImpersonation(){
  const userId=document.getElementById('viewAsSelect').value;
  if(!userId)return;
  try{
    await api('POST','/impersonate/start',{userId});
    closeModal('viewAsOv');
    location.reload();
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
async function stopImpersonation(){
  try{
    await api('POST','/impersonate/stop');
    location.reload();
  }catch(e){toast('\u26A0\uFE0F '+e.message,'err');}
}
// UTILS
function toggleTheme(){
  // Falls gerade der JARVIS-Modus aktiv ist, diesen erst sauber verlassen
  // (sonst w\u00FCrde hier still auf "dark" umgeschaltet, w\u00E4hrend der JARVIS-
  // Button noch "an" anzeigt \u2014 beide Zust\u00E4nde blieben inkonsistent).
  if(document.documentElement.getAttribute('data-theme')==='jarvis'){_exitJarvis();}
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme',dark?'light':'dark');
  document.getElementById('thBtn').textContent=dark?'\uD83C\uDF19':'\u2600\uFE0F';
  localStorage.setItem('lst_theme',dark?'light':'dark');
}
// JARVIS-Modus: zweites, rein visuelles Erscheinungsbild (siehe app.css) \u2014
// unabh\u00E4ngig vom Hell/Dunkel-Umschalter, kehrt beim Verlassen zur zuletzt
// gew\u00E4hlten Hell/Dunkel-Einstellung zur\u00FCck statt sie zu \u00FCberschreiben.
function _exitJarvis(){
  const prev=localStorage.getItem('lst_theme')||'light';
  document.documentElement.setAttribute('data-theme',prev);
  document.getElementById('thBtn').textContent=prev==='dark'?'\u2600\uFE0F':'\uD83C\uDF19';
  document.getElementById('jarvisBtn')?.classList.remove('on');
  localStorage.setItem('lst_jarvis','0');
  stopJarvisParticles();
}
function toggleJarvis(){
  const isJarvis=document.documentElement.getAttribute('data-theme')==='jarvis';
  if(isJarvis){_exitJarvis();return;}
  document.documentElement.setAttribute('data-theme','jarvis');
  document.getElementById('jarvisBtn')?.classList.add('on');
  localStorage.setItem('lst_jarvis','1');
  playJarvisBoot();
  startJarvisParticles();
}
// Dezentes "neuronales" Partikel-Netzwerk im Hintergrund des JARVIS-Modus \u2014
// leichtgewichtiges Canvas (kein externes Lib), pausiert automatisch sobald
// der Modus verlassen wird oder der Nutzer reduzierte Bewegung bevorzugt.
let _jarvisParticleRAF=null,_jarvisParticles=null,_jarvisResizeBound=false;
function startJarvisParticles(){
  const canvas=document.getElementById('jarvisParticles');
  if(!canvas||_jarvisParticleRAF)return;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const ctx=canvas.getContext('2d');
  let w,h;
  const resize=()=>{w=canvas.width=innerWidth;h=canvas.height=innerHeight;};
  resize();
  if(!_jarvisResizeBound){window.addEventListener('resize',resize);_jarvisResizeBound=true;}
  const N=Math.max(20,Math.min(60,Math.floor((innerWidth*innerHeight)/22000)));
  _jarvisParticles=Array.from({length:N},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}));
  function tick(){
    if(document.documentElement.getAttribute('data-theme')!=='jarvis'){_jarvisParticleRAF=null;return;}
    ctx.clearRect(0,0,w,h);
    for(const p of _jarvisParticles){
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>w)p.vx*=-1;
      if(p.y<0||p.y>h)p.vy*=-1;
    }
    ctx.fillStyle='rgba(0,217,255,.55)';
    for(const p of _jarvisParticles){ctx.beginPath();ctx.arc(p.x,p.y,1.6,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='rgba(0,217,255,.14)';
    for(let i=0;i<_jarvisParticles.length;i++){
      for(let j=i+1;j<_jarvisParticles.length;j++){
        const dx=_jarvisParticles[i].x-_jarvisParticles[j].x,dy=_jarvisParticles[i].y-_jarvisParticles[j].y;
        const d=Math.hypot(dx,dy);
        if(d<130){ctx.globalAlpha=1-d/130;ctx.beginPath();ctx.moveTo(_jarvisParticles[i].x,_jarvisParticles[i].y);ctx.lineTo(_jarvisParticles[j].x,_jarvisParticles[j].y);ctx.stroke();}
      }
    }
    ctx.globalAlpha=1;
    _jarvisParticleRAF=requestAnimationFrame(tick);
  }
  _jarvisParticleRAF=requestAnimationFrame(tick);
}
function stopJarvisParticles(){
  if(_jarvisParticleRAF){cancelAnimationFrame(_jarvisParticleRAF);_jarvisParticleRAF=null;}
  const canvas=document.getElementById('jarvisParticles');
  const ctx=canvas?.getContext('2d');
  if(ctx)ctx.clearRect(0,0,canvas.width,canvas.height);
}
function playJarvisBoot(){
  const el=document.getElementById('jarvisBoot');
  if(!el)return;
  el.classList.remove('play');
  void el.offsetWidth; // Reflow erzwingen, damit die Animation bei erneutem Aktivieren neu startet
  el.classList.add('play');
  setTimeout(()=>el.classList.remove('play'),1150);
}
function openModal(id){document.getElementById(id)?.classList.add('open');}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
function eyeToggle(inputId,btn){const inp=document.getElementById(inputId);const show=inp.type==='password';inp.type=show?'text':'password';btn.textContent=show?'\uD83D\uDE48':'\uD83D\uDC41';}
function toast(msg,type='',dur=3200){const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),dur);}
const ALL_MODALS=['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOr','clFormOv','attachClOv','changelogOv','dpOv','rejectEinspOv','helpOv','msgFormOv','msgDetOv','gSearchOv','stLoginOv','docFormOv','docVerOv','docHistOv','docCatOv','dpReportModal','deptOv','spintCatOv','spintCatFormOv','aiSuggestOv','protoFormOv','viewAsOv'];
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGSearch();return;}
  if(e.key==='Escape'){ALL_MODALS.forEach(closeModal);closeGSearch();}
});
ALL_MODALS.forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('click',e=>{if(e.target===el)closeModal(id);});});
document.addEventListener('click',e=>{if(!e.target.closest('.note-input-wrap'))document.getElementById('mentionSug')?.classList.remove('open');});
// Merkt sich die per Hand gezogene Größe von Textfeldern (Notizen, Kommentare
// usw.) über Seitenaufrufe hinweg — betrifft die ganze Seite automatisch,
// ohne dass jede einzelne Render-Stelle das selbst behandeln muss: ein
// MutationObserver greift jedes neu ins DOM eingefügte <textarea id="..."> ab,
// setzt eine zuvor gespeicherte Größe wieder und beobachtet es per
// ResizeObserver auf künftige manuelle Größenänderungen.
(function(){
  const KEY='lst_fieldSizes';
  let sizes; try{sizes=JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){sizes={};}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(sizes));}catch(e){}}
  const seen=new WeakSet();
  function track(el){
    if(!el.id||seen.has(el))return;
    seen.add(el);
    const saved=sizes[el.id];
    if(saved?.h)el.style.height=saved.h+'px';
    if(typeof ResizeObserver==='undefined')return;
    new ResizeObserver(entries=>{
      for(const entry of entries){
        const h=Math.round(entry.contentRect.height);
        if(h<=0)continue;
        sizes[el.id]={h};
        persist();
      }
    }).observe(el);
  }
  function scan(node){
    if(!(node instanceof Element))return;
    if(node.tagName==='TEXTAREA')track(node);
    node.querySelectorAll?.('textarea[id]').forEach(track);
  }
  new MutationObserver(muts=>{muts.forEach(m=>m.addedNodes.forEach(scan));}).observe(document.documentElement,{childList:true,subtree:true});
  document.querySelectorAll('textarea[id]').forEach(track);
})();
// AUTO-REFRESH
let _lastMsgCount=-1,_lastTkCount=-1,_refreshTimer=null;
let _lastBreakMinute='',_breakEndMinute='';

function _checkBreak(){
  const mySess=S.stationSessions?.find(s=>s.userId===S.currentUser);
  if(!mySess?.breakTime) { if(S._onBreak){S._onBreak=false;if(S.view==='platz')renderPlatz();} return; }
  const now=new Date();
  const hh=String(now.getHours()).padStart(2,'0');
  const mm=String(now.getMinutes()).padStart(2,'0');
  const cur=hh+':'+mm;
  const bStart=mySess.breakTime; // "HH:MM"
  if(!_breakEndMinute&&bStart){
    const [bh,bm]=bStart.split(':').map(Number);
    const endMin=(bh*60+bm+30);
    _breakEndMinute=String(Math.floor(endMin/60)).padStart(2,'0')+':'+String(endMin%60).padStart(2,'0');
  }
  if(cur===bStart&&!S._onBreak){
    S._onBreak=true;
    toast('⏸️ Deine Pause beginnt jetzt! (30 Min.)','ok',6000);
    if(S.view==='platz')renderPlatz();
  } else if(S._onBreak&&_breakEndMinute&&cur>=_breakEndMinute){
    S._onBreak=false;_breakEndMinute='';
    toast('✅ Pause beendet – weiterhin guten Dienst!');
    if(S.view==='platz')renderPlatz();
  }
}

function startClock(){
  var el=document.getElementById('clockDisplay');
  if(!el)return;
  el.style.display='block';
  var _lastMin='';
  function tick(){
    var now=new Date();
    var days=['So','Mo','Di','Mi','Do','Fr','Sa'];
    var d=days[now.getDay()]+'. '+now.getDate()+'.'+(now.getMonth()+1)+'.'+now.getFullYear();
    var t=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    el.innerHTML=d+'<br>'+t;
    if(t!==_lastMin){_lastMin=t;_checkBreak();}
  }
  tick();
  setInterval(tick,1000);
}
// Leiser Hintergrund-Abgleich ohne den ganzseitigen Ladespinner von
// fetchData() — für den 30s-Poller UND für Aktionen, die zwar frische Daten
// brauchen, aber keine Vollbild-Unterbrechung rechtfertigen (z.B. eine
// Chat-Nachricht senden soll sich nicht wie ein Seitenneuladen anfühlen).
async function silentRefresh(){
  if(!S.currentUser)return;
  try{
    const data=await api('GET','/data');
      const newMsgCount=(data.messages||[]).filter(m=>!m.isRead&&m.senderId!==S.currentUser).length;
      const myD=S.tp?.myDepts||[];
      const newTkCount=(data.tickets||[]).filter(tk=>{
        if(isTkClosed(tk))return false;
        if(tk.assigneeId===S.currentUser)return true;
        if(myD.includes(tk.department))return true;
        if(tk.department==='frei')return myD.length>0||S.tp?.seeAll;
        return false;
      }).length;
      S.users=data.users||[];S.events=data.events||[];S.tickets=data.tickets||[];
      S.messages=data.messages||[];S.notifications=data.notifications||[];
      S.allowances=data.allowances||[];S.checklists=data.checklists||[];
      S.abrechnung=data.abrechnung||{einspringer:[],homeoffice:[]};S.dienstplaene=data.dienstplaene||[];S.diensttausch=data.diensttausch||[];S.homeoffice=data.homeoffice||{slots:[],config:[],boxes:[],dienste:[]};S.vacationConfig=data.vacationConfig||[];S.diensttausch=data.diensttausch||[];
      S.stationSessions=data.stationSessions||[];S.stationShifts=data.stationShifts||[];S.stationOutages=data.stationOutages||[];S.links=data.portalLinks||[];S.docs=data.docs||[];S.docCategories=data.docCategories||[];S.rolePermissions=data.rolePermissions||[];S.meetings=data.meetings||[];S.contacts=data.contacts||[];S.todos=data.todos||[];
      S.sopTemplates=data.sopTemplates||[];S.sopRuns=data.sopRuns||[];
      S.lockers=data.lockers||[];
      S.departments=data.departments||[];
      if(S.departments.length){
        DEPTS=S.departments.map(d=>d.id);
        DEPT_LABELS={}; S.departments.forEach(d=>{DEPT_LABELS[d.id]=(d.emoji?d.emoji+' ':'')+d.label;});
      }
      S.lockerCategories=data.lockerCategories||[];
      const prevChatMsgs=S.chatMessages||[];
      S.chatThreads=data.chatThreads||[];S.chatMessages=data.chatMessages||[];
      updateBadges();
      if(_lastMsgCount>=0&&newMsgCount>_lastMsgCount)toast('\uD83D\uDCEC Neue Nachricht eingegangen!');
      if(_lastTkCount>=0&&newTkCount>_lastTkCount)toast('\uD83C\uDFAB Neues Ticket in deinem Bereich!');
      _lastMsgCount=newMsgCount;_lastTkCount=newTkCount;
      onChatMessagesChanged(prevChatMsgs);
      // Online-Punkt in offenen Chatfenstern auch ohne neue Nachricht
      // auffrischen (isOnline kommt aus S.users, das hier oben neu gesetzt wurde).
      if((S._chatWindows||[]).length)renderChatWindows();
      if(S.view==='home')renderHome();
      else if(S.view==='messages'||S.view==='messages_sent')renderMessages();
      else if(S.view==='tickets'||S.view==='tickets_closed'||S.view==='tickets_cancelled'||S.view==='tickets_deleted')renderTickets();
      else if(S.view==='platz')renderPlatz();
      else if(S.view==='links')renderLinks();
      else if(S.view==='docs')renderDocs();
      else if(S.view==='meetings')renderMeetings();
      else if(S.view==='todos')renderTodos();
      else if(S.view==='sop'&&(S._sopView==='run'||S._sopView==='runlist'))renderSop();
      else if(S.view==='chat')renderChatList();
      // Offene Ticket-Detailansicht ist ein Modal (nicht Teil von S.view) und
      // wird daher separat aktualisiert, damit das automatische KI-Ergebnis
      // (pending → done) dort ohne Zutun erscheint.
      if(document.getElementById('tkDetOv')?.classList.contains('open')&&S.currentTicketId)renderTkDetail();
    var _rd=document.getElementById('lastRefreshDisplay');if(_rd){var _n=new Date();_rd.textContent='↻ '+_n.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});_rd.style.display='block';}
  }catch(e){}
}
function startAutoRefresh(){
  if(_refreshTimer)clearInterval(_refreshTimer);
  _lastMsgCount=S.messages.filter(m=>!m.isRead&&m.senderId!==S.currentUser).length;
  _lastTkCount=S.tickets.filter(tk=>!isTkClosed(tk)&&((S.tp.myDepts.includes(tk.department)&&!tk.assigneeId)||tk.assigneeId===S.currentUser)).length;
  _refreshTimer=setInterval(silentRefresh,30000);
}
// Eigener, deutlich schnellerer Poller NUR für Chat (leichter Endpoint,
// /chat/sync statt des vollen /api/data) — damit Nachrichten beim
// Gegenüber innerhalb weniger Sekunden ankommen, ohne dafür den ganzen
// (teuren) Datensatz im selben Takt neu zu laden.
let _chatSyncTimer=null;
async function chatSync(){
  if(!S.currentUser)return;
  try{
    const data=await api('GET','/chat/sync');
    const prevMsgs=S.chatMessages||[];
    S.chatThreads=data.chatThreads||[];
    S.chatMessages=data.chatMessages||[];
    updateBadges();
    onChatMessagesChanged(prevMsgs);
    if(S.view==='chat')renderChatList();
  }catch(e){}
}
function startChatSync(){
  if(_chatSyncTimer)clearInterval(_chatSyncTimer);
  _chatSyncTimer=setInterval(chatSync,4000);
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
    var slotHtml=day.slots.map(function(s){var u=getU(s.userId);var clr=u&&u.color?u.color:'var(--acc)';return '<span style="background:'+clr+'22;color:'+clr+';border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600;margin-right:4px;cursor:default" title="'+(u?lastNameFirst(u.name):'?')+(s.box?' / '+s.box:'')+(s.dienst?' · '+s.dienst:'')+'">'+( u?u.initials:'?')+(s.box?' / '+s.box:'')+(s.dienst?' · '+s.dienst:'')+'</span>';}).join('');
    h+='<tr data-date="'+day.iso+'" style="background:'+bg+';'+bl+'">';
    h+='<td style="white-space:nowrap;font-weight:'+(isMine?700:400)+';font-size:12px">'+label+'</td>';
    h+='<td style="text-align:center"><span style="font-size:12px;font-weight:700;color:'+(day.free>0?'var(--ok)':'var(--danger)')+'">'+day.free+'/'+day.maxS+'</span></td>';
    h+='<td>'+(slotHtml||'<span style="color:var(--di);font-size:11px">—</span>')+'</td>';
    h+='<td style="white-space:nowrap">';
    if(day.free>0)h+='<button class="btn-ok" style="font-size:11px;padding:2px 8px;margin-right:3px" onclick="hoEintragen(\''+day.iso+'\')">&#43; Eintragen</button>';
    if(canManage&&day.slots.length>0){day.slots.forEach(function(sl){var u=getU(sl.userId);h+='<button class="btn-d" style="font-size:10px;padding:1px 5px;margin:1px" onclick="hoAustragen(\''+sl.id+'\')\" title="'+(u?lastNameFirst(u.name):'?')+'">&#10005; '+(u?u.initials:'?')+'</button>';});}
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
  const deptSel=document.getElementById('scFDept');
  if(deptSel) deptSel.innerHTML=DEPTS.filter(d=>d!=='frei').map(d=>`<option value="${d}">${DEPT_LABELS[d]||d}</option>`).join('');
  const DEPT_L=DEPT_LABELS;
  const grouped={};
  S.ticketSubcategories.forEach(s=>{(grouped[s.department]||(grouped[s.department]=[])).push(s);});
  if(!S.ticketSubcategories.length){list.innerHTML='<p style="font-size:12px;color:var(--mu)">Noch keine Unterkategorien vorhanden.</p>';return;}
  list.innerHTML=Object.keys(grouped).map(dept=>`
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--mu);margin-bottom:4px">${DEPT_L[dept]||dept}</div>
      ${grouped[dept].map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--sf);border-radius:6px;margin-bottom:4px;font-size:13px">
        <span style="flex:1">${s.label}${s.is_complaint?' <span class="bdg" style="font-size:10px;background:rgba(239,68,68,.12);color:#ef4444">Beschwerde</span>':''}</span>
        <label style="font-size:11px;color:var(--mu);display:flex;align-items:center;gap:4px;cursor:pointer" title="Erscheint in der Portal-Übersicht unter Beschwerden"><input type="checkbox" ${s.is_complaint?'checked':''} onchange="toggleSubcatComplaint('${s.id}',this.checked)"> Beschwerde</label>
        <button class="btn-s" style="color:#dc2626;padding:2px 8px" onclick="deleteSubcat('${s.id}')">&#10005;</button>
      </div>`).join('')}
    </div>`).join('');
}
async function addSubcat(){
  const dept=document.getElementById('scFDept')?.value||'';
  const label=(document.getElementById('scFLabel')?.value||'').trim();
  if(!dept||!label)return toast('⚠️ Fachbereich und Bezeichnung erforderlich','err');
  try{
    await api('POST','/ticket-subcategories',{department:dept,label:label,isComplaint:!!document.getElementById('scFComplaint')?.checked});
    await fetchData();
    document.getElementById('scFLabel').value='';
    renderSubcatAdmin();
    toast('✅ Unterkategorie gespeichert');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function toggleSubcatComplaint(id,checked){
  try{
    await api('PUT','/ticket-subcategories/'+id,{isComplaint:checked});
    await fetchData();
    renderSubcatAdmin();
    toast(checked?'✅ Als Beschwerde markiert':'✅ Beschwerde-Markierung entfernt');
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
  const open=tks.filter(t=>!isTkClosed(t));
  const closed=tks.filter(t=>t.status==='closed');
  const today=new Date();today.setHours(0,0,0,0);
  const overdue=open.filter(t=>t.dueDate&&new Date(t.dueDate)<today);
  // Count by dept
  const byDept={};DEPTS.forEach(d=>{byDept[d]={open:0,closed:0};});
  tks.forEach(t=>{if(byDept[t.department]){if(isTkClosed(t))byDept[t.department].closed++;else byDept[t.department].open++;}});
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
  const stColors={open:'#3b6dd4',in_progress:'#f59e0b',on_hold:'#8b5cf6',closed:'#10b981',cancelled:'#64748b'};
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
        <div style="font-size:32px;font-weight:800;color:#8b5cf6">${tks.filter(t=>!t.assigneeId&&!isTkClosed(t)).length}</div>
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
function dtMentionInput(ta){var val=ta.value,pos=ta.selectionStart,before=val.slice(0,pos),atIdx=before.lastIndexOf('@'),box=document.getElementById('dtMentionBox');if(atIdx<0){box.style.display='none';_dtMentionAt=-1;return;}var query=before.slice(atIdx+1);if(query.includes(' ')&&query.length>0){box.style.display='none';_dtMentionAt=-1;return;}_dtMentionAt=atIdx;var q2=query.toLowerCase();var matches=(S.users||[]).filter(function(u){return u.name.toLowerCase().startsWith(q2)&&u.id!==S.currentUser;}).slice(0,8);if(!matches.length){box.style.display='none';return;}box.innerHTML=matches.map(function(u,i){return '<div class="mention-item'+(i===0?' active':'')+'" data-name="'+u.name+'" onclick="dtPickMention('+JSON.stringify(u.name)+')">'+'<span style="background:'+(u.color||'var(--acc)')+';color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">'+u.initials+'</span>'+'<span>'+lastNameFirst(u.name)+'</span></div>';}).join('');box.style.display='block';}
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
    h+='<span>Von: <strong>'+(getU(n.createdBy)?lastNameFirst(getU(n.createdBy).name):'?')+'</strong></span>';
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
    // Anonymisierte Einträge (Urlaub von Kolleg:innen, für die kein Vollzugriff
    // besteht) werden NICHT ausgeblendet, sondern weiter unten mit Schloss-Icon
    // statt Name gezeigt — sonst würden Standard-User in der Belegungs-Übersicht
    // fälschlich freie Slots sehen, wo eigentlich schon jemand Urlaub hat.
    var vacEntries=S.events.filter(function(ev){if(ev.isGeneral)return false;if(!vacCatIds.length||!vacCatIds.includes(ev.category))return false;return ev.dateFrom<=iso&&ev.dateTo>=iso&&ev.approvalStatus!=='rejected';});
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
    var users=day.vacEntries.map(function(ev){
      if(ev._anonymized)return '<span style="background:var(--sf2);color:var(--mu);border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;margin-right:3px" title="Anonymisiert">&#128274;</span>';
      var u=getU(ev.userId);return u?'<span style="background:'+(u.color||'var(--acc)')+'22;color:'+(u.color||'var(--acc)')+';border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;margin-right:3px" title="'+lastNameFirst(u.name)+'">'+u.initials+'</span>':'';
    }).join('');
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
  if(localStorage.getItem('lst_jarvis')==='1'){
    document.documentElement.setAttribute('data-theme','jarvis');
    document.getElementById('jarvisBtn')?.classList.add('on');
    startJarvisParticles();
  }
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
  if(!tk.snoozedUntil||isTkClosed(tk))return'';
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
async function batchDelete(){
  const ids=[...S.tkBatchSel];if(!ids.length)return;
  if(!confirm(ids.length+' Ticket(s) in den Papierkorb verschieben?'))return;
  loading(true);
  try{
    await Promise.all(ids.map(id=>api('DELETE','/tickets/'+id)));
    await fetchData();S.tkBatchSel.clear();renderTickets();
    toast('🗑️ '+ids.length+' Ticket(s) gelöscht');
  }catch(e){toast('⚠️ '+e.message,'err');}finally{loading(false);}
}
async function batchRestore(){
  const ids=[...S.tkBatchSel];if(!ids.length)return;
  loading(true);
  try{
    await Promise.all(ids.map(id=>api('PUT','/tickets/'+id+'/restore')));
    await fetchData();S.tkBatchSel.clear();renderTickets();
    toast('♻️ '+ids.length+' Ticket(s) wiederhergestellt');
  }catch(e){toast('⚠️ '+e.message,'err');}finally{loading(false);}
}

// ── Quick-Action-Button ──
function _qaItems(){
  const items=[];
  items.push({icon:'🎫',label:'Ticket erstellen',action:()=>openTkForm(null)});
  items.push({icon:'💬',label:'Neuer Chat',action:()=>openChatWindowPicker()});
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
    const overdue=t.dueDate&&!isTkClosed(t)&&new Date(t.dueDate)<new Date();
    results.push({type:'ticket',icon:'🎫',label:t.number+': '+t.title,sub:(DEPT_LABELS[t.department]||t.department)+' · '+STATUSES.find(s=>s.id===t.status)?.label+(overdue?' · ⚠️ Überfällig':''),action:()=>openTkDetail(t.id),accent:'#3b6dd4'});
  });
  // Nachrichten
  (S.messages||[]).filter(m=>((m.title||'')+(m.body||'')).toLowerCase().includes(q)).slice(0,4).forEach(m=>{
    results.push({type:'msg',icon:'✉️',label:m.title||'(kein Betreff)',sub:'von '+(getU(m.senderId)?lastNameFirst(getU(m.senderId).name):'?')+' · '+fdt(m.createdAt),action:()=>{closeGSearch();setView('messages');setTimeout(()=>openMsg(m.id),100);},accent:'#10b981'});
  });
  // Mitarbeiter
  S.users.filter(u=>(u.name||'').toLowerCase().includes(q)).slice(0,4).forEach(u=>{
    const roles=(u.roles||[]).map(r=>ROLES.find(x=>x.id===r)?.label||r).join(', ');
    results.push({type:'user',icon:'👤',label:lastNameFirst(u.name),sub:roles||'',action:()=>{closeGSearch();if(S.p.manageUsers)openUF(u.id);},accent:'#f59e0b'});
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

// SECTION: Platzübersicht
const ELP_NORD = [
  [{name:'ELP 1'},{name:'ELP 2'}],
  [{name:'ELP 7'},{empty:true}],
  [{name:'ELP 4'},{name:'ELP 3'}],
  [{name:'ELP 6'},{name:'ELP 5'}],
];
const ELP_SUED = [
  [{name:'Süd ELP 1'},{name:'Süd ELP 2'}],
  [{name:'Süd ELP 3',center:true}],
  [{name:'Süd ELP 4'},{name:'Süd ELP 5'}],
  [{name:'Süd ELP 6'},{name:'Süd ELP 7'}],
  [{name:'Büro Standortleiter Süd',center:true,office:true}],
];
const ELP_NORD_EXT = [
  [{name:'ELP 8'},{name:'ELP 9'}],
  [{name:'Büro Standortleiter Nord',office:true},{name:'ELP 10'}],
];
function renderPlatz(){
  const mySess=S.stationSessions.find(s=>s.userId===S.currentUser);
  const isAlreadyIn=!!mySess;
  const canManageOutage=(S.p?.roles||[]).some(r=>['admin','leitung','technik'].includes(r));
  function card(st){
    if(st.empty) return `<div class="elp-station" style="background:transparent;border-color:transparent;box-shadow:none"></div>`;
    const outage=S.stationOutages.find(o=>o.stationName===st.name);
    if(outage){
      return `<div class="elp-station elp-occ" style="background:rgba(239,68,68,.08);border-color:#ef4444">
        <div class="elp-sname" style="text-decoration:line-through;color:var(--danger)">${st.name}</div>
        <div style="font-size:10px;color:var(--danger);font-weight:700">⚠️ AUSSER BETRIEB</div>
        ${outage.reason?`<div style="font-size:10px;color:var(--mu)">${outage.reason}</div>`:''}
        ${canManageOutage?`<button class="btn-ok" style="font-size:10px;padding:3px 8px;margin-top:4px;width:100%" onclick="endOutage('${outage.id}')">✓ Wieder aktiv</button>`:''}
      </div>`;
    }
    const sess=S.stationSessions.find(s=>s.stationName===st.name);
    const occ=!!sess;const mine=sess?.userId===S.currentUser;
    const u=occ?getU(sess.userId):null;
    const shift=sess?.shiftId?S.stationShifts.find(sh=>sh.id===sess.shiftId):null;
    const onBreak=mine&&S._onBreak;
    const cls=(st.office?'elp-office ':'')+(onBreak?'elp-break':mine?'elp-mine':occ?'elp-occ':'elp-free');
    return `<div class="elp-station ${cls}">
      <div class="elp-sname">${st.office?'🏢 ':''}<span style="font-size:${st.office?'12':'16'}px">${st.name}</span></div>
      ${occ?`
        ${onBreak?`
          <div style="text-align:center;margin:8px 0">
            <div style="font-size:28px">⏸️</div>
            <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-top:4px">PAUSE</div>
            <div style="font-size:11px;color:var(--mu);margin-top:2px">${u?lastNameFirst(u.name):'?'} · ${sess.breakTime} Uhr</div>
          </div>
        `:`
          <div class="elp-urow">${avHtml(u?.initials||'?',u?.color||'#888',32,12,true)}<div><div class="elp-uname">${u?lastNameFirst(u.name):'?'}</div>${shift?`<div class="elp-sch">${shift.label}</div>`:''}</div></div>
          <div class="elp-badge ${mine?'elp-badge-me':'elp-badge-occ'}">${mine?'● Du bist hier':'● Besetzt'}</div>
          ${mine&&sess.breakTime?`<div style="font-size:10px;color:var(--mu);margin-top:4px">⏸️ Pause: ${sess.breakTime} Uhr</div>`:''}
        `}
        ${mine?`<button class="btn-d" style="width:100%;margin-top:8px;font-size:11px;padding:4px 8px" onclick="logoutStation('${st.name}')">Abmelden</button>`:''}
      `:`
        <div class="elp-badge elp-badge-free">● Frei</div>
        ${!isAlreadyIn?`<button class="btn-p" style="width:100%;margin-top:8px;font-size:11px;padding:5px 8px" onclick="openStationLogin('${st.name}')">Anmelden</button>`:`<div style="font-size:10px;color:var(--di);margin-top:8px;text-align:center">Bereits an ${mySess.stationName}</div>`}
        ${canManageOutage?`<button onclick="startOutage('${st.name}')" style="font-size:10px;padding:2px 7px;margin-top:6px;width:100%;border:1px solid var(--border);background:transparent;border-radius:var(--r);color:var(--mu);cursor:pointer;font-family:inherit;transition:.15s" onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--mu)'">⚠ Außer Betrieb</button>`:''}
      `}
    </div>`;
  }
  function section(title,rows){
    return `<div class="elp-section">
      <div class="elp-section-title">${title}</div>
      ${rows.map(row=>`<div class="elp-row${row.length===1&&!row[0].center?'':row[0].center?' elp-center':''}">${row.map(card).join('')}</div>`).join('')}
    </div>`;
  }
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128225; Platz&#252;bersicht</div>
      <button class="btn-s" style="font-size:12px" onclick="fetchData().then(renderPlatz)">&#8635; Aktualisieren</button>
    </div>
    <div class="elp-columns">
      <div class="elp-col">
        ${section('🔵 Rettungsleitstelle Nord',ELP_NORD)}
        ${section('🔵 Rettungsleitstelle Nord – Erweiterung',ELP_NORD_EXT)}
      </div>
      <div class="elp-col">
        ${section('🟢 Rettungsleitstelle Süd',ELP_SUED)}
      </div>
    </div>`;
}
function openStationLogin(name){
  document.getElementById('stLoginStation').value=name;
  document.getElementById('stLoginTitle').textContent='📡 Anmelden – '+name;
  const sel=document.getElementById('stLoginShift');
  sel.innerHTML='<option value="">— keine Angabe —</option>'+S.stationShifts.map(s=>`<option value="${s.id}">${s.label}${s.serviceStart?(' ('+s.serviceStart+(s.serviceEnd?'–'+s.serviceEnd:'')+')'):''}</option>`).join('');
  document.getElementById('stLoginBreakWrap').style.display='none';
  openModal('stLoginOv');
}
function onStLoginShiftChange(){
  const shiftId=document.getElementById('stLoginShift').value;
  const shift=S.stationShifts.find(s=>s.id===shiftId);
  const wrap=document.getElementById('stLoginBreakWrap');
  if(!shift||!shift.hasBreak){wrap.style.display='none';return;}
  wrap.style.display='';
  const btSel=document.getElementById('stLoginBreakTime');
  const slots=[];
  const [sh,sm]=shift.serviceStart?(shift.serviceStart.split(':').map(Number)):[7,0];
  const [eh,em]=shift.serviceEnd?(shift.serviceEnd.split(':').map(Number)):[19,0];
  const startMins=sh*60+sm+60;
  const endMins=eh*60+em-30;
  for(let m=startMins;m<=endMins;m+=30){
    const hh=String(Math.floor(m/60)).padStart(2,'0');
    const mm=String(m%60).padStart(2,'0');
    slots.push(`${hh}:${mm}`);
  }
  btSel.innerHTML='<option value="">— keine Angabe —</option>'+slots.map(t=>`<option value="${t}">${t} Uhr</option>`).join('');
  const today=new Date().toDateString();
  const others=S.stationSessions.filter(s=>s.userId!==S.currentUser&&s.breakTime&&new Date(s.loggedInAt).toDateString()===today);
  const obDiv=document.getElementById('stLoginOtherBreaks');
  if(others.length){
    obDiv.style.display='';
    obDiv.innerHTML='<div style="font-size:11px;font-weight:700;margin-bottom:4px;color:var(--mu)">Pausen anderer Mitarbeiter heute:</div>'+others.map(s=>`<div style="display:flex;gap:6px;align-items:center;font-size:12px"><span>⏸️ ${getU(s.userId)?lastNameFirst(getU(s.userId).name):'?'}</span><span style="font-weight:600">${s.breakTime} Uhr</span></div>`).join('');
  } else { obDiv.style.display='none'; }
}
async function confirmStationLogin(){
  const name=document.getElementById('stLoginStation').value;
  const shiftId=document.getElementById('stLoginShift').value||null;
  const breakTime=document.getElementById('stLoginBreakTime')?.value||null;
  try{
    await api('POST','/stations/'+encodeURIComponent(name),{shiftId,breakTime});
    await fetchData();closeModal('stLoginOv');renderPlatz();toast('✅ Angemeldet an '+name);
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function logoutStation(name){
  try{
    await api('DELETE','/stations/'+encodeURIComponent(name));
    await fetchData();renderPlatz();toast('✅ Abgemeldet von '+name);
  }catch(e){toast('⚠️ '+e.message,'err');}
}
// Shifts Admin
function renderShiftsAdmin(){
  const el=document.getElementById('shiftList');if(!el)return;
  if(!S.stationShifts.length){el.innerHTML='<div style="color:var(--di);font-size:12px;padding:8px 0">Noch keine Schichten.</div>';return;}
  el.innerHTML=S.stationShifts.map(s=>`
    <div class="ai" id="shift-row-${s.id}">
      <div class="aii" style="flex:1;min-width:0">
        <div id="shift-view-${s.id}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="ain">🕐 ${s.label}</span>
          ${s.serviceStart?`<span style="font-size:11px;color:var(--mu)">${s.serviceStart}${s.serviceEnd?'–'+s.serviceEnd:''}</span>`:''}
          <span style="font-size:11px;color:var(--mu)">${s.hasBreak?'✅ Pause':'—'}</span>
        </div>
        <div id="shift-edit-${s.id}" style="display:none;flex-direction:column;gap:6px;margin-top:6px">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end">
            <div class="fg" style="margin:0;flex:2;min-width:120px"><label style="font-size:11px">Bezeichnung</label><input id="seLabel-${s.id}" value="${s.label.replace(/"/g,'&quot;')}" style="font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx);width:100%"></div>
            <div class="fg" style="margin:0;min-width:70px"><label style="font-size:11px">Von</label><input type="time" id="seStart-${s.id}" value="${s.serviceStart||''}" style="font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx)"></div>
            <div class="fg" style="margin:0;min-width:70px"><label style="font-size:11px">Bis</label><input type="time" id="seEnd-${s.id}" value="${s.serviceEnd||''}" style="font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx)"></div>
            <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap"><input type="checkbox" id="seBreak-${s.id}" ${s.hasBreak?'checked':''}>Hat Pause</label>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-p" style="font-size:11px;padding:4px 10px" onclick="saveShift('${s.id}')">✓ Speichern</button>
            <button class="btn-s" style="font-size:11px;padding:4px 10px" onclick="toggleShiftEdit('${s.id}',false)">Abbrechen</button>
          </div>
        </div>
      </div>
      <div class="aia" id="shift-btns-${s.id}">
        <button class="btn-s" style="font-size:11px;padding:4px 9px" onclick="toggleShiftEdit('${s.id}',true)">✎</button>
        <button class="btn-d" style="font-size:11px;padding:4px 9px" onclick="deleteShift('${s.id}')">✕</button>
      </div>
    </div>`).join('');
}
function toggleShiftEdit(id,open){
  document.getElementById('shift-view-'+id).style.display=open?'none':'flex';
  document.getElementById('shift-edit-'+id).style.display=open?'flex':'none';
  document.getElementById('shift-btns-'+id).style.display=open?'none':'flex';
}
async function saveShift(id){
  const label=document.getElementById('seLabel-'+id)?.value.trim();
  if(!label)return toast('⚠️ Bezeichnung erforderlich','err');
  const serviceStart=document.getElementById('seStart-'+id)?.value||'';
  const serviceEnd=document.getElementById('seEnd-'+id)?.value||'';
  const hasBreak=document.getElementById('seBreak-'+id)?.checked!==false;
  try{await api('PUT','/station-shifts/'+id,{label,serviceStart,serviceEnd,hasBreak});await fetchData();renderShiftsAdmin();toast('✅ Schicht gespeichert');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function addShift(){
  const lbl=document.getElementById('shiftFLabel');if(!lbl?.value.trim())return toast('Bezeichnung eingeben!','err');
  const serviceStart=document.getElementById('shiftFStart')?.value||'';
  const serviceEnd=document.getElementById('shiftFEnd')?.value||'';
  const hasBreak=document.getElementById('shiftFBreak')?.checked!==false;
  try{await api('POST','/station-shifts',{label:lbl.value.trim(),serviceStart,serviceEnd,hasBreak});lbl.value='';await fetchData();renderShiftsAdmin();toast('✅ Schicht hinzugefügt');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteShift(id){
  if(!confirm('Schicht löschen?'))return;
  try{await api('DELETE','/station-shifts/'+id);await fetchData();renderShiftsAdmin();toast('✅ Schicht gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function startOutage(name){
  const reason=prompt('Grund (optional):','');
  if(reason===null)return;
  try{await api('POST','/station-outages',{stationName:name,reason});await fetchData();renderPlatz();toast('⚠️ '+name+' außer Betrieb gesetzt');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function endOutage(id){
  try{await api('DELETE','/station-outages/'+id);await fetchData();renderPlatz();toast('✅ Station wieder in Betrieb');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

// SECTION: Statistik
async function renderStatistik(){
  if(!S.p.manageUsers){document.getElementById('main').innerHTML='<div class="empty">Keine Berechtigung</div>';return;}
  document.getElementById('main').innerHTML='<div class="ph"><div class="pt">📊 Statistik</div></div><div style="padding:20px;color:var(--mu)">Lade…</div>';
  let data;
  try{data=await api('GET','/statistik');}catch(e){document.getElementById('main').innerHTML=`<div class="empty">⚠️ ${e.message}</div>`;return;}
  const {tickets,logins}=data;
  const loginMap={};logins.forEach(l=>{loginMap[l.userId]=l.count;});
  // Per-User stats
  const userStats={};
  S.users.forEach(u=>{userStats[u.id]={created:0,assigned:0,closed:0,byDept:{},closedByDept:{}};});
  tickets.forEach(tk=>{
    if(tk.created_by&&userStats[tk.created_by]){
      userStats[tk.created_by].created++;
      const d=tk.department||'—';
      userStats[tk.created_by].byDept[d]=(userStats[tk.created_by].byDept[d]||0)+1;
    }
    if(tk.assignee_id&&userStats[tk.assignee_id]){
      userStats[tk.assignee_id].assigned++;
      if(isTkClosed(tk)){
        userStats[tk.assignee_id].closed++;
        const d=tk.department||'—';
        userStats[tk.assignee_id].closedByDept[d]=(userStats[tk.assignee_id].closedByDept[d]||0)+1;
      }
    }
  });
  // Dept stats
  const deptStats={};
  tickets.forEach(tk=>{const d=tk.department||'—';if(!deptStats[d])deptStats[d]={total:0,open:0,closed:0};deptStats[d].total++;if(isTkClosed(tk))deptStats[d].closed++;else deptStats[d].open++;});
  const maxBar=Math.max(...Object.values(deptStats).map(d=>d.total),1);
  function bar(val,max,color='var(--acc)'){const w=Math.round(val/max*100);return`<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:var(--sf3);border-radius:3px;height:8px"><div style="width:${w}%;background:${color};height:8px;border-radius:3px;transition:.3s"></div></div><span style="font-size:11px;font-weight:600;min-width:24px;text-align:right">${val}</span></div>`;}
  document.getElementById('main').innerHTML=`
  <div class="ph"><div class="pt">📊 Statistik</div></div>
  <div class="stat-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:18px">

  <div class="dash-card">
    <h3 style="margin-bottom:12px">👤 Tickets erstellt pro Mitarbeiter</h3>
    <div style="overflow-x:auto"><table class="rm-table" style="font-size:12px">
      <thead><tr><th style="text-align:left">Mitarbeiter</th><th>Gesamt</th>${DEPTS.map(d=>`<th>${DEPT_LABELS[d]||d}</th>`).join('')}</tr></thead>
      <tbody>${S.users.filter(u=>userStats[u.id]?.created>0).sort((a,b)=>(userStats[b.id]?.created||0)-(userStats[a.id]?.created||0)).map(u=>`
        <tr><td style="text-align:left;font-weight:600">${avHtml(u.initials,u.color,18,8)} ${lastNameFirst(u.name)}</td>
        <td><span class="anum" style="background:rgba(59,109,212,.1);color:var(--acc)">${userStats[u.id].created}</span></td>
        ${DEPTS.map(d=>`<td>${userStats[u.id].byDept[d]||'—'}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table></div>
  </div>

  <div class="dash-card">
    <h3 style="margin-bottom:12px">✅ Tickets bearbeitet & abgeschlossen</h3>
    <div style="overflow-x:auto"><table class="rm-table" style="font-size:12px">
      <thead><tr><th style="text-align:left">Mitarbeiter</th><th>Zugewiesen</th><th>Abgeschl.</th>${DEPTS.map(d=>`<th>${DEPT_LABELS[d]||d}</th>`).join('')}</tr></thead>
      <tbody>${S.users.filter(u=>userStats[u.id]?.assigned>0).sort((a,b)=>(userStats[b.id]?.closed||0)-(userStats[a.id]?.closed||0)).map(u=>`
        <tr><td style="text-align:left;font-weight:600">${avHtml(u.initials,u.color,18,8)} ${lastNameFirst(u.name)}</td>
        <td><span class="anum" style="background:rgba(59,109,212,.1);color:var(--acc)">${userStats[u.id].assigned}</span></td>
        <td><span class="anum" style="background:rgba(16,185,129,.1);color:var(--ok)">${userStats[u.id].closed}</span></td>
        ${DEPTS.map(d=>`<td>${userStats[u.id].closedByDept[d]||'—'}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table></div>
  </div>

  <div class="dash-card">
    <h3 style="margin-bottom:14px">📁 Tickets nach Fachbereich</h3>
    ${Object.entries(deptStats).sort((a,b)=>b[1].total-a[1].total).map(([d,s])=>`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px"><span>${DEPT_LABELS[d]||d}</span><span style="color:var(--mu)">offen: ${s.open} | geschl.: ${s.closed}</span></div>
        ${bar(s.total,maxBar)}
      </div>`).join('')}
  </div>

  <div class="dash-card">
    <h3 style="margin-bottom:12px">🔑 Portal-Anmeldungen pro Mitarbeiter</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${S.users.slice().sort((a,b)=>(loginMap[b.id]||0)-(loginMap[a.id]||0)).map(u=>{const cnt=loginMap[u.id]||0;const maxL=Math.max(...Object.values(loginMap),1);return`<div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:center;gap:6px;min-width:130px">${avHtml(u.initials,u.color,20,9)}<span style="font-size:12px;font-weight:600">${lastNameFirst(u.name)}</span></div>
        ${bar(cnt,maxL,'var(--info)')}
      </div>`;}).join('')}
    </div>
  </div>

  </div>`;
}

// SECTION: Links
const QUICK_LINKS = [
  {id:'lebensretter', label:'admin.lebensretter.at', url:'https://admin.lebensretter.at/', icon:'🌐', description:'Lebensretter Admin-Portal'},
];
function renderLinks(){
  const allLinks=S.links.length?S.links:QUICK_LINKS;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128279; Links</div>${S.p?.manageUsers?`<button class="btn-s" onclick="openModal('admOv');swTab('links')">⚙️ Links verwalten</button>`:''}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:0 20px 20px">
    ${allLinks.map(lk=>`<div style="background:var(--sf);border:1px solid var(--border);border-radius:12px;padding:16px 18px;cursor:pointer;transition:.15s" onclick="window.open('${lk.url}','_blank','noopener')" onmouseover="this.style.borderColor='var(--acc)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:28px;margin-bottom:8px">${lk.icon||'🔗'}</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">${lk.label}</div>
      ${lk.description?`<div style="font-size:12px;color:var(--mu)">${lk.description}</div>`:''}
      <div style="font-size:11px;color:var(--di);margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lk.url}</div>
    </div>`).join('')}
    ${!allLinks.length?'<div style="color:var(--di);font-size:13px;padding:20px">Noch keine Links eingetragen.</div>':''}
    </div>`;
}
function renderLinksAdmin(){
  const el=document.getElementById('linkList');if(!el)return;
  el.innerHTML=S.links.length?S.links.map(l=>`<div class="ai"><div class="aii"><div class="ain">${l.icon} ${l.label}</div><div style="font-size:11px;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.url}</div></div><div class="aia"><a href="${l.url}" target="_blank" class="btn-s" style="font-size:11px;padding:3px 8px;text-decoration:none">↗</a><button class="btn-d" onclick="deleteLink('${l.id}')">✕</button></div></div>`).join(''):'<div style="color:var(--di);font-size:12px;padding:8px 0">Noch keine Links. Füge einen hinzu.</div>';
}
async function addLink(){
  const label=document.getElementById('linkFLabel')?.value.trim();
  const url=document.getElementById('linkFUrl')?.value.trim();
  if(!label||!url)return toast('⚠️ Label und URL erforderlich','err');
  const icon=document.getElementById('linkFIcon')?.value.trim()||'🔗';
  const description=document.getElementById('linkFDesc')?.value.trim()||'';
  try{await api('POST','/portal-links',{label,url,icon,description});await fetchData();renderLinksAdmin();toast('✅ Link hinzugefügt');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteLink(id){
  if(!confirm('Link löschen?'))return;
  try{await api('DELETE','/portal-links/'+id);await fetchData();renderLinksAdmin();toast('✅ Link gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}

// ── KONTAKTE ──────────────────────────────────────────────────────────────
function renderContacts(){
  const canManage=!!S.p.addGeneral;
  const search=(S._contactSearch||'').toLowerCase().trim();
  let list=(S.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'de'));
  if(search) list=list.filter(c=>[c.name,c.title,c.company,c.responsibleFor,c.email,c.phone1,c.phone2].some(v=>(v||'').toLowerCase().includes(search)));
  const contactCard=c=>{
    const lines=[];
    if(c.company) lines.push('<div style="font-size:12px;color:var(--mu)">&#127970; '+esc(c.company)+'</div>');
    if(c.responsibleFor) lines.push('<div style="font-size:12px;color:var(--mu)">&#128736;&#65039; '+esc(c.responsibleFor)+'</div>');
    if(c.phone1) lines.push('<div style="font-size:12px">&#128222; <a href="tel:'+esc(c.phone1)+'" style="color:var(--tx);text-decoration:none">'+esc(c.phone1)+'</a></div>');
    if(c.phone2) lines.push('<div style="font-size:12px">&#128222; <a href="tel:'+esc(c.phone2)+'" style="color:var(--tx);text-decoration:none">'+esc(c.phone2)+'</a></div>');
    if(c.email) lines.push('<div style="font-size:12px">&#9993;&#65039; <a href="mailto:'+esc(c.email)+'" style="color:var(--tx);text-decoration:none">'+esc(c.email)+'</a></div>');
    if(c.availability) lines.push('<div style="font-size:12px;color:var(--mu)">&#128337; '+esc(c.availability)+'</div>');
    return '<div style="background:var(--sf);border:1px solid var(--border);border-radius:12px;padding:14px 16px;position:relative">'
      +(canManage?'<div style="position:absolute;top:10px;right:10px;display:flex;gap:4px">'
        +'<button class="btn-s" style="font-size:11px;padding:2px 6px" title="Bearbeiten" onclick="openContactForm(\''+c.id+'\')">&#9998;</button>'
        +'<button class="btn-d" style="font-size:11px;padding:2px 6px" title="L&ouml;schen" onclick="deleteContact(\''+c.id+'\')">&#10005;</button>'
        +'</div>':'')
      +'<div style="font-size:14px;font-weight:600;padding-right:'+(canManage?'56px':'0')+'">'+esc(c.name)+'</div>'
      +(c.title?'<div style="font-size:12px;color:var(--acc);margin-bottom:6px">'+esc(c.title)+'</div>':'<div style="margin-bottom:6px"></div>')
      +lines.join('')
      +'</div>';
  };
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128222; Kontakte</div>${canManage?`<button class="btn-p" onclick="openContactForm()">&#65291; Kontakt</button>`:''}</div>
    <div style="padding:0 20px 12px">
      <input type="text" class="srch" placeholder="&#128269; Suchen (Name, Firma, Zust&auml;ndigkeit, ...)" value="${(S._contactSearch||'').replace(/"/g,'&quot;')}" oninput="S._contactSearch=this.value;renderContacts()" style="width:100%;max-width:360px">
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;padding:0 20px 20px">
    ${list.map(contactCard).join('')}
    ${!list.length?'<div style="color:var(--di);font-size:13px;padding:20px">'+(search?'Keine Kontakte gefunden.':'Noch keine Kontakte eingetragen.')+'</div>':''}
    </div>`;
}
function openContactForm(id){
  const c=id?S.contacts.find(x=>x.id===id):null;
  document.getElementById('contactFT').textContent=c?'Kontakt bearbeiten':'Neuer Kontakt';
  document.getElementById('cFId').value=id||'';
  document.getElementById('cFName').value=c?.name||'';
  document.getElementById('cFTitle').value=c?.title||'';
  document.getElementById('cFCompany').value=c?.company||'';
  document.getElementById('cFResp').value=c?.responsibleFor||'';
  document.getElementById('cFPhone1').value=c?.phone1||'';
  document.getElementById('cFPhone2').value=c?.phone2||'';
  document.getElementById('cFEmail').value=c?.email||'';
  document.getElementById('cFAvail').value=c?.availability||'';
  openModal('contactOv');
}
async function saveContact(){
  const id=document.getElementById('cFId').value;
  const name=document.getElementById('cFName').value.trim();
  if(!name)return toast('⚠️ Name erforderlich','err');
  const body={
    name,
    title:document.getElementById('cFTitle').value.trim(),
    company:document.getElementById('cFCompany').value.trim(),
    responsibleFor:document.getElementById('cFResp').value.trim(),
    phone1:document.getElementById('cFPhone1').value.trim(),
    phone2:document.getElementById('cFPhone2').value.trim(),
    email:document.getElementById('cFEmail').value.trim(),
    availability:document.getElementById('cFAvail').value.trim(),
  };
  try{
    if(id) await api('PUT','/contacts/'+id,body);
    else await api('POST','/contacts',body);
    await fetchData();closeModal('contactOv');renderContacts();toast(id?'✅ Aktualisiert!':'✅ Gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteContact(id){
  if(!confirm('Kontakt löschen?'))return;
  try{await api('DELETE','/contacts/'+id);await fetchData();renderContacts();toast('✅ Kontakt gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}

// ── NOTFALL-CHECKLISTEN (SOP) ───────────────────────────────────────────────
// Eigenständiges Modul für Vorgehens-/Notfall-Checklisten (z.B. "Ausfall
// Einsatzleitsystem") — bewusst getrennt von den kleinen Ticket-Checklisten
// unter "Checklisten" im Ticketsystem. Ablauf: Entwurf (nur der Ersteller
// sieht/bearbeitet ihn) → Freigabe durch den technischen Leiter (wird aktiv,
// für alle sichtbar/ausführbar) → bei weiteren Änderungen wird eine neue
// Version als Entwurf angelegt, die alte bleibt bis zur Freigabe der neuen
// unverändert aktiv (Nachvollziehbarkeit abgeschlossener Durchläufe).
const SOP_CATEGORY_SUGGESTIONS=['Systemausfall Einsatzleitsystem','Ausfall Telefonanlage','Stromausfall','Schichtübergabe-Check','Großschadenslage'];
const SOP_ITEM_TYPES=[{id:'check',label:'Checkbox'},{id:'text',label:'Texteingabe'},{id:'yesno',label:'Ja/Nein'},{id:'photo',label:'Foto-Upload'},{id:'contact',label:'Kontakt'},{id:'branch',label:'Verzweigung'}];
// Neutrale, helle Farben zur Kennzeichnung von Verzweigungs-Optionen — bewusst
// kein Rot/Grün (das wäre falsch/richtig-konnotiert, hier geht's nur um
// "welcher Pfad"). Option 1 einer Verzweigung ist immer Farbe[0], Option 2
// immer Farbe[1] usw. — konsistent über Editor, Durchlauf und Ausdruck.
// Bewusst KEIN Rot/Grün (irritiert als vermeintliches Falsch/Richtig) —
// nur Blau-/Lila-/Gelb-/Grautöne, klar voneinander unterscheidbar.
const SOP_BRANCH_PALETTE=[
  {bg:'#e0f2fe',fg:'#0369a1'},  // sky
  {bg:'#ede9fe',fg:'#6d28d9'},  // violet
  {bg:'#fef3c7',fg:'#92400e'},  // amber
  {bg:'#fae8ff',fg:'#a21caf'},  // fuchsia
  {bg:'#e0e7ff',fg:'#4338ca'},  // indigo
  {bg:'#e2e8f0',fg:'#334155'},  // slate
];
function sopOptColor(allItems,optId){
  for(const x of allItems){
    const idx=(x.options||[]).findIndex(y=>y.id===optId);
    if(idx>=0) return SOP_BRANCH_PALETTE[idx%SOP_BRANCH_PALETTE.length];
  }
  return SOP_BRANCH_PALETTE[SOP_BRANCH_PALETTE.length-1];
}
// ── Verzweigungen: ein Schritt vom Typ "branch" hat mehrere Optionen
// (t.items[].options); andere Schritte können optional einer Option
// zugeordnet werden (item.branchOptionId) und sind dann nur sichtbar, wenn
// genau diese Option gewählt wurde. Schritte ohne Zuordnung ("Hauptpfad")
// sind immer sichtbar — das ist zugleich der Zusammenführungspunkt nach
// einer Verzweigung.
function sopOptionOwnerMap(items){
  // optionId -> Item, das diese Option anbietet (der Verzweigungs-Schritt)
  const map={};
  (items||[]).forEach(it=>(it.options||[]).forEach(o=>{map[o.id]=it;}));
  return map;
}
function sopItemDepth(items,item){
  const ownerMap=sopOptionOwnerMap(items);
  let depth=0, cur=item, guard=0;
  while(cur&&cur.branchOptionId&&guard++<20){
    depth++;
    cur=ownerMap[cur.branchOptionId]||null;
  }
  return depth;
}
// Ermittelt, welche Schritte bei den bisher getroffenen Entscheidungen
// (chosenOptionIds) tatsächlich auf dem aktiven Pfad liegen (Hauptpfad-
// Schritte immer, verzweigte Schritte nur bei passender Wahl) — iterativ,
// damit auch verschachtelte Verzweigungen korrekt aufgelöst werden.
function sopVisibleItems(items,runItemsByItemId){
  const visible=new Set((items||[]).filter(it=>!it.branchOptionId).map(it=>it.id));
  let changed=true;
  while(changed){
    changed=false;
    (items||[]).forEach(it=>{
      if(visible.has(it.id)&&it.itemType==='branch'){
        const chosen=runItemsByItemId[it.id]?.value;
        if(chosen){
          (items||[]).forEach(sub=>{
            if(sub.branchOptionId===chosen&&!visible.has(sub.id)){visible.add(sub.id);changed=true;}
          });
        }
      }
    });
  }
  return (items||[]).filter(it=>visible.has(it.id));
}
function sopContactCardHtml(c){
  if(!c) return '<div style="font-size:11px;color:var(--di)">(Kontakt wurde gelöscht)</div>';
  const lines=[];
  if(c.company) lines.push('🏢 '+esc(c.company));
  if(c.phone1) lines.push('📞 <a href="tel:'+esc(c.phone1)+'" style="color:inherit">'+esc(c.phone1)+'</a>');
  if(c.phone2) lines.push('📞 <a href="tel:'+esc(c.phone2)+'" style="color:inherit">'+esc(c.phone2)+'</a>');
  if(c.email) lines.push('✉️ <a href="mailto:'+esc(c.email)+'" style="color:inherit">'+esc(c.email)+'</a>');
  if(c.availability) lines.push('🕐 '+esc(c.availability));
  return '<div style="background:var(--sf2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px">'
    +'<div style="font-weight:600">'+esc(c.name)+(c.title?' &middot; '+esc(c.title):'')+'</div>'
    +lines.map(l=>'<div style="margin-top:2px">'+l+'</div>').join('')
    +'</div>';
}
function sopCategoryIcon(cat){
  const c=(cat||'').toLowerCase();
  if(c.includes('einsatzleitsystem')||c.includes('systemausfall')||c.includes('it'))return '💻';
  if(c.includes('telefon'))return '☎️';
  if(c.includes('strom'))return '⚡';
  if(c.includes('schicht'))return '🔄';
  if(c.includes('großschaden')||c.includes('grossschaden'))return '🚨';
  if(c.includes('wartung'))return '🛠️';
  return '📋';
}
function sopHomeBannerHtml(){
  const active=(S.sopTemplates||[]).filter(t=>t.status==='approved'&&t.active);
  if(!active.length&&!S.p?.manageSop) return '';
  const chips=active.slice(0,8).map(t=>'<span class="bdg" style="background:#dc262622;color:#dc2626;cursor:pointer;font-size:11px" onclick="setView(\'sop\')">'+sopCategoryIcon(t.category)+' '+esc(t.title)+'</span>').join('');
  return '<div style="background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.25);border-radius:var(--r);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
    +'<div style="font-size:13px;font-weight:700;color:#dc2626;flex-shrink:0">🚨 Notfall-Checklisten</div>'
    +(active.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;flex:1">'+chips+'</div>':'<div style="font-size:12px;color:var(--mu);flex:1">Noch keine freigegebenen Checklisten.</div>')
    +'<a href="javascript:void(0)" onclick="setView(\'sop\')" style="color:#dc2626;font-size:11px;font-weight:600;flex-shrink:0">alle ansehen &#8594;</a>'
    +'</div>';
}
function sopGroups(){
  const byBase={};
  (S.sopTemplates||[]).forEach(t=>{(byBase[t.baseId]=byBase[t.baseId]||[]).push(t);});
  return Object.values(byBase).map(versions=>{
    versions.sort((a,b)=>b.version-a.version);
    const active=versions.find(v=>v.active&&v.status==='approved');
    const draft=versions.find(v=>v.status==='draft');
    // Freigegebene, aber deaktivierte Version (z.B. durch "Deaktivieren" außer
    // Betrieb genommen, ohne dass eine neuere Version freigegeben wurde) —
    // ohne diese würde die Checkliste aus der Übersicht komplett verschwinden.
    const latestApproved=versions.find(v=>v.status==='approved');
    return {baseId:versions[0].baseId,versions,active,draft,latestApproved};
  });
}
function renderSop(){
  if(S._sopView==='edit')renderSopEditor(S._selSopTemplateId);
  else if(S._sopView==='run')renderSopRun(S._selSopRunId);
  else if(S._sopView==='stats')renderSopStats(S._selSopTemplateId);
  else if(S._sopView==='runlist')renderSopRunList();
  else renderSopOverview();
}
function renderSopOverview(){
  const canManage=!!S.p.manageSop;
  const groups=sopGroups();
  const search=(S._sopSearch||'').toLowerCase().trim();
  const catFilter=S._sopCatFilter||'';
  const matches=t=>{
    if(search&&![t.title,t.category,t.description].some(v=>(v||'').toLowerCase().includes(search)))return false;
    if(catFilter&&t.category!==catFilter)return false;
    return true;
  };
  const activeGroups=groups.filter(g=>g.active&&matches(g.active));
  const draftGroups=canManage?groups.filter(g=>g.draft&&matches(g.draft)):[];
  // Freigegeben, aber deaktiviert (und keine freigegebene aktive Version in
  // dieser Reihe) — sonst für den technischen Leiter unauffindbar, sobald er
  // eine Checkliste deaktiviert.
  const inactiveGroups=canManage?groups.filter(g=>!g.active&&g.latestApproved&&matches(g.latestApproved)):[];
  const cats=[...new Set(groups.flatMap(g=>g.versions.map(v=>v.category)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  const tile=(t,badge)=>`<div style="background:var(--sf);border:1px solid var(--border);border-radius:12px;padding:16px 18px;cursor:pointer;position:relative${badge==='Deaktiviert'?';opacity:.7':''}" onclick="sopOpenTemplate('${t.id}')">
      ${badge?`<span class="bdg" style="position:absolute;top:10px;right:10px;background:${badge==='Entwurf'?'#f59e0b22':'var(--sf2)'};color:${badge==='Entwurf'?'#f59e0b':'var(--mu)'}">${badge}</span>`:''}
      <div style="font-size:26px;margin-bottom:6px">${sopCategoryIcon(t.category)}</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:2px">${esc(t.title)}</div>
      <div style="font-size:11px;color:var(--acc);margin-bottom:6px">${esc(t.category||'Ohne Kategorie')}</div>
      ${t.description?`<div style="font-size:12px;color:var(--mu);margin-bottom:8px">${esc(t.description)}</div>`:''}
      <div style="font-size:11px;color:var(--di)">${t.items.length} Schritt(e) &middot; v${t.version}</div>
    </div>`;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">🚨 Notfall-Checklisten</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="/api/sop/print-all" target="_blank" class="btn-s" style="text-decoration:none;font-size:12px">🖨️ Alle drucken</a>
        <button class="btn-s" onclick="S._sopView='runlist';renderSop()">📋 ${canManage?'Durchläufe':'Meine Durchläufe'}</button>
        ${canManage?`<button class="btn-p" onclick="sopNewTemplate()">+ Neue Checkliste</button>`:''}
      </div>
    </div>
    <div style="padding:0 20px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="text" class="srch" placeholder="🔍 Suchen…" value="${(S._sopSearch||'').replace(/"/g,'&quot;')}" oninput="S._sopSearch=this.value;renderSop()" style="max-width:280px">
      <button class="mb ${!catFilter?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S._sopCatFilter='';renderSop()">Alle</button>
      ${cats.map(c=>`<button class="mb ${catFilter===c?'on':''}" style="padding:4px 8px;font-size:12px" onclick="S._sopCatFilter='${esc(c)}';renderSop()">${esc(c)}</button>`).join('')}
    </div>
    ${draftGroups.length?`<div style="padding:0 20px 6px">
      <div style="font-size:12px;font-weight:700;color:var(--mu);margin-bottom:8px">📝 Entwürfe (Freigabe ausständig)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:20px">${draftGroups.map(g=>tile(g.draft,'Entwurf')).join('')}</div>
    </div>`:''}
    <div style="padding:0 20px 20px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
        ${activeGroups.map(g=>tile(g.active,null)).join('')}
        ${!activeGroups.length?'<div style="color:var(--di);font-size:13px;padding:20px">Keine freigegebenen Checklisten'+(search||catFilter?' gefunden.':canManage?'. Lege die erste an.':'.')+'</div>':''}
      </div>
    </div>
    ${inactiveGroups.length?`<div style="padding:0 20px 30px">
      <div style="font-size:12px;font-weight:700;color:var(--mu);margin-bottom:8px">🚫 Deaktiviert</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">${inactiveGroups.map(g=>tile(g.latestApproved,'Deaktiviert')).join('')}</div>
    </div>`:''}`;
}
function sopOpenTemplate(id){
  if(S.p.manageSop){S._selSopTemplateId=id;S._sopView='edit';renderSop();return;}
  sopStartRun(id);
}
async function sopStartRun(tplId){
  const existing=(S.sopRuns||[]).find(r=>r.templateId===tplId&&r.status==='running'&&r.startedBy===S.currentUser&&!r.isTest);
  if(existing){S._selSopRunId=existing.id;S._sopView='run';renderSop();return;}
  try{
    const r=await api('POST','/sop/runs',{templateId:tplId});
    await fetchData();
    S._selSopRunId=r.id;S._sopView='run';renderSop();
  }catch(e){toast('⚠️ '+e.message,'err');}
}
// Testdurchlauf: läuft technisch wie ein normaler Durchlauf (gleiche Steps/
// Verzweigungen/Merge-Logik lassen sich so wirklich prüfen), ist aber als
// is_test markiert — taucht nicht in der Auswertung/Historie auf und wird
// beim Beenden wieder gelöscht statt abgeschlossen/abgebrochen zu werden.
async function sopStartTestRun(tplId){
  const existing=(S.sopRuns||[]).find(r=>r.templateId===tplId&&r.status==='running'&&r.startedBy===S.currentUser&&r.isTest);
  if(existing){S._selSopRunId=existing.id;S._sopView='run';renderSop();return;}
  try{
    const r=await api('POST','/sop/runs',{templateId:tplId,isTest:true});
    await fetchData();
    S._selSopRunId=r.id;S._sopView='run';renderSop();
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopEndTestRun(runId,tplId){
  try{await api('DELETE','/sop/runs/'+runId);await fetchData();S._sopView='edit';S._selSopTemplateId=tplId;renderSop();toast('🧪 Testdurchlauf beendet');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
function renderSopEditor(id){
  const t=(S.sopTemplates||[]).find(x=>x.id===id);
  if(!t){S._sopView='overview';renderSopOverview();return;}
  const canManage=!!S.p.manageSop;
  const isDraft=t.status==='draft';
  const items=(t.items||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const typeLabel=ty=>(SOP_ITEM_TYPES.find(x=>x.id===ty)||{}).label||ty;
  const optionLabel=optId=>{ for(const x of items){ const o=(x.options||[]).find(y=>y.id===optId); if(o) return o.label; } return '?'; };
  const itemRow=(it,i)=>{
    const indent=sopItemDepth(items,it)*24;
    const branchTag=it.branchOptionId?(()=>{const c=sopOptColor(items,it.branchOptionId);return `<div style="margin-bottom:2px"><span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:9px;background:${c.bg};color:${c.fg}">↳ Falls „${esc(optionLabel(it.branchOptionId))}“</span></div>`;})():'';
    const optionsHtml=it.itemType==='branch'?`<div style="margin-top:8px;padding:8px 10px;background:var(--sf2);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:var(--mu);margin-bottom:6px">Optionen</div>
      ${(it.options||[]).map((o,oi)=>{const c=SOP_BRANCH_PALETTE[oi%SOP_BRANCH_PALETTE.length];return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.fg};flex-shrink:0"></span>
        <span style="flex:1">${esc(o.label)}</span>
        ${isDraft&&canManage?`<button class="btn-s" style="font-size:10px;padding:2px 6px" onclick="sopEditBranchOption('${t.id}','${it.id}','${o.id}')">✎</button>
        <button class="btn-d" style="font-size:10px;padding:2px 6px" onclick="sopDeleteBranchOption('${t.id}','${it.id}','${o.id}')">✕</button>`:''}
      </div>`;}).join('')}
      ${!(it.options||[]).length?'<div style="font-size:11px;color:var(--di)">Noch keine Optionen.</div>':''}
      ${isDraft&&canManage?`<button class="btn-s" style="font-size:11px;margin-top:6px" onclick="sopAddBranchOption('${t.id}','${it.id}')">+ Option hinzufügen</button>`:''}
    </div>`:'';
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0 10px ${indent}px;border-top:1px solid var(--border)">
    ${isDraft?`<div style="display:flex;flex-direction:column;gap:2px">
      <button class="btn-s" style="padding:1px 6px;font-size:10px" ${i===0?'disabled':''} onclick="sopMoveItem('${t.id}',${i},-1)">▲</button>
      <button class="btn-s" style="padding:1px 6px;font-size:10px" ${i===items.length-1?'disabled':''} onclick="sopMoveItem('${t.id}',${i},1)">▼</button>
    </div>`:`<div style="width:22px;text-align:center;color:var(--di);font-size:11px;flex-shrink:0">${i+1}.</div>`}
    <div style="flex:1">
      ${branchTag}
      <div style="font-size:13px;font-weight:600">${i+1}. ${esc(it.text)} ${it.required?'<span style="color:#ef4444">*</span>':''} <span class="bdg" style="font-size:10px">${typeLabel(it.itemType)}</span></div>
      ${it.hint?`<div style="font-size:11px;color:var(--mu);margin-top:2px">💡 ${esc(it.hint)}</div>`:''}
      ${it.itemType==='contact'?sopContactCardHtml((S.contacts||[]).find(c=>c.id===it.contactId)):''}
      ${optionsHtml}
    </div>
    ${isDraft&&canManage?`<div style="display:flex;gap:4px;flex-shrink:0">
      <button class="btn-s" style="font-size:11px;padding:3px 8px" onclick="sopEditItem('${t.id}','${it.id}')">✎</button>
      <button class="btn-d" style="font-size:11px;padding:3px 8px" onclick="sopDeleteItem('${t.id}','${it.id}')">✕</button>
    </div>`:''}
  </div>`;
  };
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">← <a href="javascript:void(0)" onclick="S._sopView='overview';renderSop()" style="color:var(--tx);text-decoration:none">🚨 Notfall-Checklisten</a> / ${esc(t.title)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="/api/sop/templates/${t.id}/print" target="_blank" class="btn-s" style="text-decoration:none;font-size:12px">🖨️ Drucken</a>
        ${canManage?`<button class="btn-s" onclick="sopGotoStats('${t.id}')">📊 Auswertung</button>`:''}
        ${canManage&&items.length?`<button class="btn-s" onclick="sopStartTestRun('${t.id}')" title="Zum Ausprobieren durchklicken — zählt nicht in der Statistik und wird nicht gespeichert">🧪 Testdurchlauf</button>`:''}
        ${(t.status==='approved'&&t.active)?`<button class="btn-p" onclick="sopStartRun('${t.id}')">▶ Durchlauf starten</button>`:''}
      </div>
    </div>
    <div style="padding:0 20px 12px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <span class="bdg" style="background:${t.status==='approved'?'#10b98122':'#f59e0b22'};color:${t.status==='approved'?'#10b981':'#f59e0b'}">${t.status==='approved'?'✓ Freigegeben':'📝 Entwurf'}</span>
        ${t.status==='approved'&&!t.active?'<span class="bdg" style="background:var(--sf2);color:var(--mu)">Deaktiviert / durch neuere Version ersetzt</span>':''}
        <span style="font-size:11px;color:var(--mu)">Version ${t.version} &middot; ${esc(t.category||'Ohne Kategorie')} &middot; erstellt von ${esc(getU(t.createdBy)?lastNameFirst(getU(t.createdBy).name):'?')}${t.lastPrintedAt?' &middot; zuletzt gedruckt '+fdt(t.lastPrintedAt):''}</span>
      </div>
      ${t.description?`<div style="font-size:13px;color:var(--tx);margin-bottom:10px">${esc(t.description)}</div>`:''}
      ${canManage&&isDraft?`<div style="margin-bottom:10px"><button class="btn-s" onclick="sopEditMeta('${t.id}')">✎ Titel/Kategorie/Beschreibung</button></div>`:''}
    </div>
    <div style="padding:0 20px 20px">
      ${items.map(itemRow).join('')}
      ${!items.length?'<div style="color:var(--di);font-size:12px;padding:12px 0">Noch keine Schritte.</div>':''}
      ${canManage&&isDraft?`<div style="padding-top:10px"><button class="btn-s" onclick="sopAddItem('${t.id}')">+ Schritt hinzufügen</button></div>`:''}
    </div>
    ${canManage?`<div style="padding:16px 20px 30px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border)">
      ${isDraft?`<button class="btn-p" onclick="sopApprove('${t.id}')">✓ Freigeben</button>`:''}
      ${isDraft?`<button class="btn-d" onclick="sopDeleteTemplate('${t.id}')">🗑️ Entwurf löschen</button>`:''}
      ${!isDraft?`<button class="btn-s" onclick="sopNewVersion('${t.id}')">📝 Neue Version bearbeiten</button>`:''}
      ${!isDraft&&t.active?`<button class="btn-d" onclick="sopDeactivate('${t.id}')">Deaktivieren</button>`:''}
      ${!isDraft&&!t.active?`<button class="btn-s" onclick="sopReactivate('${t.id}')">Reaktivieren</button>`:''}
    </div>`:''}`;
}
function sopNewTemplate(){
  document.getElementById('stFT').textContent='Neue Checkliste';
  document.getElementById('stId').value='';
  document.getElementById('stTitle').value='';
  document.getElementById('stCategory').value='';
  document.getElementById('stDesc').value='';
  openModal('sopTplOv');
}
function sopEditMeta(id){
  const t=S.sopTemplates.find(x=>x.id===id);if(!t)return;
  document.getElementById('stFT').textContent='Checkliste bearbeiten';
  document.getElementById('stId').value=id;
  document.getElementById('stTitle').value=t.title;
  document.getElementById('stCategory').value=t.category;
  document.getElementById('stDesc').value=t.description;
  openModal('sopTplOv');
}
async function saveSopTemplate(){
  const id=document.getElementById('stId').value;
  const title=document.getElementById('stTitle').value.trim();
  if(!title)return toast('⚠️ Titel erforderlich','err');
  const body={title,category:document.getElementById('stCategory').value.trim(),description:document.getElementById('stDesc').value.trim()};
  try{
    if(id){
      await api('PUT','/sop/templates/'+id,body);await fetchData();closeModal('sopTplOv');
      S._sopView='edit';S._selSopTemplateId=id;renderSop();toast('✅ Aktualisiert!');
    } else {
      const r=await api('POST','/sop/templates',body);await fetchData();closeModal('sopTplOv');
      S._sopView='edit';S._selSopTemplateId=r.id;renderSop();toast('✅ Angelegt! Jetzt Schritte hinzufügen.');
    }
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function openSopItemForm(tplId,itemId){
  const t=S.sopTemplates.find(x=>x.id===tplId);if(!t)return;
  const it=itemId?t.items.find(i=>i.id===itemId):null;
  document.getElementById('siFT').textContent=it?'Schritt bearbeiten':'Neuer Schritt';
  document.getElementById('siTplId').value=tplId;
  document.getElementById('siItemId').value=itemId||'';
  document.getElementById('siText').value=it?.text||'';
  document.getElementById('siRequired').checked=it?!!it.required:true;
  document.getElementById('siType').value=it?.itemType||'check';
  document.getElementById('siHint').value=it?.hint||'';
  const contactSel=document.getElementById('siContact');
  if(contactSel){
    const sorted=(S.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'de'));
    contactSel.innerHTML='<option value="">— Kontakt wählen —</option>'+sorted.map(c=>`<option value="${c.id}">${esc(c.name)}${c.company?' ('+esc(c.company)+')':''}</option>`).join('');
    contactSel.value=it?.contactId||'';
  }
  const branchSel=document.getElementById('siBranchOption');
  if(branchSel){
    const opts=[];
    (t.items||[]).forEach(x=>{ if(x.id===itemId) return; (x.options||[]).forEach(o=>opts.push({item:x,opt:o})); });
    branchSel.innerHTML='<option value="">— Hauptpfad (immer sichtbar) —</option>'+opts.map(({item,opt})=>`<option value="${opt.id}">${esc(item.text.slice(0,30))} → ${esc(opt.label)}</option>`).join('');
    branchSel.value=it?.branchOptionId||'';
  }
  sopToggleContactRow();
  openModal('sopItemOv');
}
function sopToggleContactRow(){
  const row=document.getElementById('siContactRow');
  const type=document.getElementById('siType')?.value;
  if(row) row.style.display=(type==='contact')?'':'none';
}
function sopAddItem(tplId){openSopItemForm(tplId,null);}
function sopEditItem(tplId,itemId){openSopItemForm(tplId,itemId);}
async function saveSopItem(){
  const tplId=document.getElementById('siTplId').value;
  const itemId=document.getElementById('siItemId').value;
  const text=document.getElementById('siText').value.trim();
  if(!text)return toast('⚠️ Text erforderlich','err');
  const itemType=document.getElementById('siType').value;
  if(itemType==='contact'&&!document.getElementById('siContact')?.value)return toast('⚠️ Bitte einen Kontakt wählen','err');
  const body={text,required:document.getElementById('siRequired').checked,itemType,hint:document.getElementById('siHint').value.trim(),contactId:document.getElementById('siContact')?.value||'',branchOptionId:document.getElementById('siBranchOption')?.value||''};
  try{
    if(itemId) await api('PUT','/sop/templates/'+tplId+'/items/'+itemId,body);
    else await api('POST','/sop/templates/'+tplId+'/items',body);
    await fetchData();closeModal('sopItemOv');S._sopView='edit';S._selSopTemplateId=tplId;renderSop();
    toast(itemId?'✅ Aktualisiert!':'✅ Hinzugefügt!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopDeleteItem(tplId,itemId){
  if(!confirm('Schritt löschen?'))return;
  try{await api('DELETE','/sop/templates/'+tplId+'/items/'+itemId);await fetchData();renderSop();toast('✅ Gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopMoveItem(tplId,index,dir){
  const t=S.sopTemplates.find(x=>x.id===tplId);if(!t)return;
  const items=t.items.slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const j=index+dir;
  if(j<0||j>=items.length)return;
  const tmp=items[index];items[index]=items[j];items[j]=tmp;
  try{await api('PUT','/sop/templates/'+tplId+'/items-reorder',{order:items.map(i=>i.id)});await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopAddBranchOption(tplId,itemId){
  const label=prompt('Bezeichnung der Option (z.B. "07-19 Uhr"):');
  if(!label||!label.trim())return;
  try{await api('POST','/sop/templates/'+tplId+'/items/'+itemId+'/branch-options',{label:label.trim()});await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopEditBranchOption(tplId,itemId,optId){
  const t=S.sopTemplates.find(x=>x.id===tplId);
  const it=t?.items.find(x=>x.id===itemId);
  const cur=it?.options.find(x=>x.id===optId);
  const label=prompt('Bezeichnung ändern:',cur?.label||'');
  if(!label||!label.trim())return;
  try{await api('PUT','/sop/templates/'+tplId+'/items/'+itemId+'/branch-options/'+optId,{label:label.trim()});await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopDeleteBranchOption(tplId,itemId,optId){
  if(!confirm('Option löschen? Schritte, die dieser Option zugeordnet waren, fallen auf den Hauptpfad zurück (immer sichtbar).'))return;
  try{await api('DELETE','/sop/templates/'+tplId+'/items/'+itemId+'/branch-options/'+optId);await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopApprove(id){
  if(!confirm('Checkliste freigeben? Sie wird damit für alle Mitarbeiter sichtbar und ausführbar.'))return;
  try{await api('POST','/sop/templates/'+id+'/approve');await fetchData();renderSop();toast('✅ Freigegeben!');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopNewVersion(id){
  try{const r=await api('POST','/sop/templates/'+id+'/new-version');await fetchData();S._selSopTemplateId=r.id;renderSop();toast('✅ Neuer Entwurf angelegt');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopDeactivate(id){
  if(!confirm('Checkliste deaktivieren? Mitarbeiter können sie danach nicht mehr starten.'))return;
  try{await api('POST','/sop/templates/'+id+'/deactivate');await fetchData();renderSop();toast('✅ Deaktiviert');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopReactivate(id){
  try{await api('POST','/sop/templates/'+id+'/reactivate');await fetchData();renderSop();toast('✅ Reaktiviert');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopDeleteTemplate(id){
  if(!confirm('Entwurf endgültig löschen?'))return;
  try{await api('DELETE','/sop/templates/'+id);await fetchData();S._sopView='overview';renderSop();toast('✅ Gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}
function sopGotoStats(id){S._selSopTemplateId=id;S._sopView='stats';S._sopStatsData=null;renderSop();loadSopStats(id);}
async function loadSopStats(id){
  try{const data=await api('GET','/sop/templates/'+id+'/stats');S._sopStatsData=data;if(S._sopView==='stats'&&S._selSopTemplateId===id)renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
function renderSopStats(id){
  const t=(S.sopTemplates||[]).find(x=>x.id===id);
  if(!t){S._sopView='overview';renderSopOverview();return;}
  const d=S._sopStatsData;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">← <a href="javascript:void(0)" onclick="S._sopView='edit';renderSop()" style="color:var(--tx);text-decoration:none">${esc(t.title)}</a> / Auswertung</div></div>
    <div style="padding:0 20px 20px">
    ${!d?'<div style="color:var(--di);font-size:13px">Lade…</div>':`
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px">
        <div class="ib3">Durchläufe gesamt<br><b style="font-size:20px">${d.totalRuns}</b></div>
        <div class="ib3">Abgeschlossen<br><b style="font-size:20px">${d.completedCount}</b></div>
        <div class="ib3">Laufend<br><b style="font-size:20px">${d.runningCount}</b></div>
        <div class="ib3">Abgebrochen<br><b style="font-size:20px">${d.abortedCount}</b></div>
        <div class="ib3">&Oslash; Dauer<br><b style="font-size:20px">${d.avgDurationMin!=null?Math.round(d.avgDurationMin)+' min':'–'}</b></div>
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Schritte &ndash; wie oft nicht erledigt/leer (bezogen auf abgeschlossene Durchläufe)</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:400px">
        <thead><tr><th style="text-align:left;padding:6px;border-bottom:2px solid var(--border)">Schritt</th><th style="padding:6px;border-bottom:2px solid var(--border)">Nicht erledigt</th><th style="padding:6px;border-bottom:2px solid var(--border)">Leer</th></tr></thead>
        <tbody>${(d.items||[]).map(it=>`<tr><td style="padding:6px;border-bottom:1px solid var(--border)">${esc(it.text)}</td><td style="text-align:center;padding:6px;border-bottom:1px solid var(--border)">${it.notDoneCount}/${it.totalRuns||0}</td><td style="text-align:center;padding:6px;border-bottom:1px solid var(--border)">${it.emptyCount}/${it.totalRuns||0}</td></tr>`).join('')}</tbody>
      </table></div>
    `}
    </div>`;
}
function renderSopRun(runId){
  const run=(S.sopRuns||[]).find(r=>r.id===runId);
  if(!run){S._sopView='overview';renderSopOverview();return;}
  const t=(S.sopTemplates||[]).find(x=>x.id===run.templateId);
  if(!t){S._sopView='overview';renderSopOverview();return;}
  const allItems=(t.items||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const runItemsByItemId={}; run.items.forEach(ri=>{runItemsByItemId[ri.itemId]=ri;});
  // Nur die Schritte anzeigen, die auf dem aufgrund bisheriger Entscheidungen
  // aktiven Pfad liegen (Hauptpfad + gewählte Verzweigungen) — Fortschritt
  // bezieht sich ebenfalls nur auf diese, nicht auf alle jemals möglichen Schritte.
  const items=sopVisibleItems(allItems,runItemsByItemId);
  const isOwner=run.startedBy===S.currentUser;
  const canEdit=run.status==='running'&&(isOwner||S.p.manageSop);
  const doneCount=items.filter(it=>runItemsByItemId[it.id]?.done).length;
  const pct=items.length?Math.round(doneCount/items.length*100):0;
  const stepRow=it=>{
    const ri=runItemsByItemId[it.id]||{};
    const disabled=!canEdit?'disabled':'';
    const indent=sopItemDepth(allItems,it)*24;
    let control='';
    if(it.itemType==='text'){
      control=`<input type="text" value="${esc(ri.value||'')}" ${disabled} onchange="sopRunSetValue('${run.id}','${it.id}',this.value)" style="width:100%;max-width:400px;margin-top:6px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--sf);color:var(--tx);box-sizing:border-box" placeholder="Eingabe...">`;
    } else if(it.itemType==='yesno'){
      control=`<div style="display:flex;gap:8px;margin-top:6px">
        <button class="mb ${ri.value==='ja'?'on':''}" ${disabled} onclick="sopRunSetValue('${run.id}','${it.id}','ja')">Ja</button>
        <button class="mb ${ri.value==='nein'?'on':''}" ${disabled} onclick="sopRunSetValue('${run.id}','${it.id}','nein')">Nein</button>
      </div>`;
    } else if(it.itemType==='photo'){
      control=`<div style="margin-top:6px">
        ${ri.value?`<img src="${ri.value}" style="max-width:160px;max-height:160px;border-radius:8px;display:block;margin-bottom:6px">`:''}
        ${canEdit?`<input type="file" accept="image/*" onchange="sopRunPhotoUpload('${run.id}','${it.id}',this)">`:''}
      </div>`;
    } else if(it.itemType==='contact'){
      control=sopContactCardHtml((S.contacts||[]).find(c=>c.id===it.contactId));
    } else if(it.itemType==='branch'){
      control=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">`
        +(it.options||[]).map((o,oi)=>{const c=SOP_BRANCH_PALETTE[oi%SOP_BRANCH_PALETTE.length];const sel=ri.value===o.id;
          return `<button class="mb" ${disabled} onclick="sopRunChooseBranch('${run.id}','${it.id}','${o.id}')" style="background:${sel?c.fg:c.bg};color:${sel?'#fff':c.fg};border-color:${c.fg};font-weight:700;font-size:13px;padding:9px 16px">Auswahl ${oi+1}: ${esc(o.label)}</button>`;}).join('')
        +(!(it.options||[]).length?'<span style="font-size:11px;color:var(--di)">Keine Optionen hinterlegt</span>':'')
        +`</div>`;
    }
    const isBranch=it.itemType==='branch';
    const branchTagRun=it.branchOptionId?(()=>{const c=sopOptColor(allItems,it.branchOptionId);return `<span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:9px;background:${c.bg};color:${c.fg};margin-bottom:4px">↳ ${esc((()=>{for(const x of allItems){const o=(x.options||[]).find(y=>y.id===it.branchOptionId);if(o)return o.label;}return '?';})())}</span>`;})():'';
    return `<div style="display:flex;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border);${ri.done?'opacity:.65':''}${isBranch?';background:rgba(99,102,241,.05)':''}">
      <div style="width:26px;flex-shrink:0;margin-top:2px;display:flex;justify-content:center">
        ${isBranch
          ?`<div style="font-size:22px">🔀</div>`
          :`<input type="checkbox" ${ri.done?'checked':''} ${disabled} onchange="sopRunToggle('${run.id}','${it.id}',this.checked)" style="width:26px;height:26px;cursor:${canEdit?'pointer':'default'};accent-color:#10b981">`}
      </div>
      <div class="sop-step-cols" style="min-width:0;margin-left:8px">
        <div style="min-width:0;padding-left:${indent}px;box-sizing:border-box">
          ${branchTagRun?`<div>${branchTagRun}</div>`:''}
          <div style="font-size:15px;font-weight:600;${ri.done&&!isBranch?'text-decoration:line-through':''}">${esc(it.text)}${it.required&&!isBranch?' <span style="color:#ef4444">*</span>':''}</div>
          ${it.hint?`<div style="font-size:12px;color:var(--mu);margin-top:2px">💡 ${esc(it.hint)}</div>`:''}
          ${control}
        </div>
        <div style="min-width:0">
          <textarea placeholder="Dokumentation / Notiz…" ${disabled} onchange="sopRunSetNote('${run.id}','${it.id}',this.value)" rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--sf);color:var(--tx);box-sizing:border-box;font-size:12px;font-family:inherit;resize:vertical">${esc(ri.note||'')}</textarea>
          ${ri.updatedAt?`<div style="font-size:10px;color:var(--di);margin-top:4px">zuletzt ${fdt(ri.updatedAt)} von ${esc(getU(ri.updatedBy)?lastNameFirst(getU(ri.updatedBy).name):'?')}</div>`:''}
        </div>
      </div>
    </div>`;
  };
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">← <a href="javascript:void(0)" onclick="S._sopView='overview';renderSop()" style="color:var(--tx);text-decoration:none">🚨 Notfall-Checklisten</a> / ${esc(t.title)}</div>
      <div style="display:flex;gap:8px">
        <a href="/api/sop/templates/${t.id}/print" target="_blank" class="btn-s" style="text-decoration:none;font-size:12px">🖨️ Drucken</a>
        ${canEdit&&run.isTest?`<button class="btn-d" onclick="sopEndTestRun('${run.id}','${t.id}')">🧪 Testdurchlauf beenden</button>`:''}
        ${canEdit&&!run.isTest?`<button class="btn-d" onclick="sopRunAbort('${run.id}')">Abbrechen</button>`:''}
        ${canEdit&&!run.isTest?`<button class="btn-p" onclick="sopRunComplete('${run.id}')">✓ Abschließen</button>`:''}
      </div>
    </div>
    ${run.isTest?`<div style="margin:0 20px 10px;padding:8px 12px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.25);border-radius:var(--r);font-size:12px;color:#7c3aed">🧪 Testdurchlauf — zum Ausprobieren des Entwurfs, zählt nicht in der Statistik und wird beim Beenden wieder gelöscht.</div>`:''}
    <div style="padding:0 20px">
      <div style="font-size:11px;color:var(--mu);margin-bottom:4px">Gestartet von ${esc(getU(run.startedBy)?lastNameFirst(getU(run.startedBy).name):'?')} um ${fdt(run.startedAt)}${run.status!=='running'?' &middot; Status: '+(run.status==='completed'?'✓ Abgeschlossen':'✗ Abgebrochen'):''}</div>
      <div style="background:var(--sf2);border-radius:10px;height:10px;overflow:hidden;margin-bottom:4px"><div style="background:${pct===100?'#10b981':'#3b6dd4'};height:100%;width:${pct}%;transition:.2s"></div></div>
      <div style="font-size:11px;color:var(--mu);margin-bottom:10px">${doneCount}/${items.length} erledigt (${pct}%)</div>
    </div>
    <div style="padding:0 20px 30px">${items.map(stepRow).join('')}</div>`;
}
async function sopRunToggle(runId,itemId,done){
  try{await api('PUT','/sop/runs/'+runId+'/items/'+itemId,{done});await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopRunChooseBranch(runId,itemId,optionId){
  try{await api('PUT','/sop/runs/'+runId+'/items/'+itemId,{done:true,value:optionId});await fetchData();renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopRunSetValue(runId,itemId,value){
  try{await api('PUT','/sop/runs/'+runId+'/items/'+itemId,{value});await fetchData();if(S._sopView==='run')renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopRunSetNote(runId,itemId,note){
  try{await api('PUT','/sop/runs/'+runId+'/items/'+itemId,{note});await fetchData();if(S._sopView==='run')renderSop();}catch(e){toast('⚠️ '+e.message,'err');}
}
function sopRunPhotoUpload(runId,itemId,input){
  const file=input.files[0];if(!file)return;
  if(file.size>3*1024*1024){toast('⚠️ Foto zu groß (max. 3 MB)','err');return;}
  const reader=new FileReader();
  reader.onload=()=>sopRunSetValue(runId,itemId,reader.result);
  reader.readAsDataURL(file);
}
async function sopRunComplete(runId){
  if(!confirm('Durchlauf als abgeschlossen markieren?'))return;
  try{await api('PUT','/sop/runs/'+runId+'/complete');await fetchData();renderSop();toast('✅ Abgeschlossen!');}catch(e){toast('⚠️ '+e.message,'err');}
}
async function sopRunAbort(runId){
  if(!confirm('Durchlauf abbrechen?'))return;
  try{await api('PUT','/sop/runs/'+runId+'/abort');await fetchData();renderSop();toast('Durchlauf abgebrochen');}catch(e){toast('⚠️ '+e.message,'err');}
}
function renderSopRunList(){
  const canManage=!!S.p.manageSop;
  const runs=(S.sopRuns||[]).filter(r=>!r.isTest).slice().sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
  const statusLabel={running:'▶ Läuft',completed:'✓ Abgeschlossen',aborted:'✗ Abgebrochen'};
  const statusColor={running:'#3b6dd4',completed:'#10b981',aborted:'#ef4444'};
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">← <a href="javascript:void(0)" onclick="S._sopView='overview';renderSop()" style="color:var(--tx);text-decoration:none">🚨 Notfall-Checklisten</a> / ${canManage?'Durchläufe (alle)':'Meine Durchläufe'}</div></div>
    <div style="padding:0 20px 20px">
    ${!runs.length?'<div style="color:var(--di);font-size:13px;padding:20px">Noch keine Durchläufe.</div>':`
      <div style="display:flex;flex-direction:column;gap:8px">
      ${runs.map(r=>{
        const t=(S.sopTemplates||[]).find(x=>x.id===r.templateId);
        const items=t?.items||[];
        const doneCount=items.filter(it=>{const ri=r.items.find(x=>x.itemId===it.id);return ri&&ri.done;}).length;
        const pct=items.length?Math.round(doneCount/items.length*100):0;
        return `<div style="background:var(--sf);border:1px solid var(--border);border-radius:10px;padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px" onclick="S._selSopRunId='${r.id}';S._sopView='run';renderSop()">
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:600">${esc(t?.title||'?')}</div>
            <div style="font-size:11px;color:var(--mu)">${esc(getU(r.startedBy)?lastNameFirst(getU(r.startedBy).name):'?')} &middot; ${fdt(r.startedAt)} &middot; ${doneCount}/${items.length} (${pct}%)</div>
          </div>
          <span class="bdg" style="background:${statusColor[r.status]}22;color:${statusColor[r.status]};flex-shrink:0">${statusLabel[r.status]||r.status}</span>
        </div>`;
      }).join('')}
      </div>`}
    </div>`;
}

// ── SPINTVERGABE ─────────────────────────────────────────────────────────────
// Fest auf admin/leitung/technik beschränkt (S.p.canManageSpint, siehe
// NAV_BASELINE) — kein separates Recht in der Rechte-Matrix wie bei manageSop.
function lockerCatLabel(catId){const c=(S.lockerCategories||[]).find(x=>x.id===catId);return c?(c.emoji?c.emoji+' ':'')+c.label:'';}
function renderSpint(){
  if(!S.p.canManageSpint){ document.getElementById('main').innerHTML='<div class="empty">⚠️ Kein Zugriff</div>'; return; }
  // Reihenfolge: freie Spinde ganz vorne (unabhängig von der Kategorie —
  // damit offene Kapazität sofort ins Auge fällt), danach nach Kategorie
  // (alphabetisch) und innerhalb der Kategorie nach Spind-Nr sortiert.
  const lockers=(S.lockers||[]).slice().sort((a,b)=>{
    const aFree=a.assigneeType==='none', bFree=b.assigneeType==='none';
    if(aFree!==bFree)return aFree?-1:1;
    const catCmp=lockerCatLabel(a.categoryId||'').localeCompare(lockerCatLabel(b.categoryId||''),'de');
    if(catCmp!==0)return catCmp;
    return a.number.localeCompare(b.number,'de',{numeric:true});
  });
  const search=(S._spintFilter||'').toLowerCase().trim();
  const catFilter=S._spintCatFilter||'';
  const assigneeText=l=>l.assigneeType==='user'?(getU(l.assigneeUserId)?lastNameFirst(getU(l.assigneeUserId).name):'Unbekannt'):l.assigneeType==='general'?l.assigneeLabel:'';
  let filtered=lockers;
  if(catFilter) filtered=filtered.filter(l=>(l.categoryId||'')===catFilter);
  if(search) filtered=filtered.filter(l=>[l.number,assigneeText(l),l.note].some(v=>(v||'').toLowerCase().includes(search)));
  const total=lockers.length;
  const assignedUser=lockers.filter(l=>l.assigneeType==='user').length;
  const assignedGeneral=lockers.filter(l=>l.assigneeType==='general').length;
  const free=lockers.filter(l=>l.assigneeType==='none').length;
  // Beim Übergang zu einer neuen Kategorie (bzw. von/zu den freien Spinden
  // ganz vorne) einen kleinen Abstand einfügen, damit Gruppenwechsel auf
  // einen Blick erkennbar sind.
  const groupKey=l=>l.assigneeType==='none'?'__free__':(l.categoryId||'__none__');
  let _prevGroupKey=null;
  const row=l=>{
    const label=l.assigneeType==='user'?('👤 '+esc(getU(l.assigneeUserId)?lastNameFirst(getU(l.assigneeUserId).name):'Unbekannt'))
      :l.assigneeType==='general'?('🏷️ '+esc(l.assigneeLabel||'—'))
      :'<span style="color:var(--di)">— frei —</span>';
    const gk=groupKey(l);
    const newGroup=_prevGroupKey!==null&&gk!==_prevGroupKey;
    _prevGroupKey=gk;
    return (newGroup?'<div style="height:14px"></div>':'')
      +'<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--border)">'
      +'<div style="font-weight:700;font-size:13px;min-width:70px;flex-shrink:0">'+esc(l.number)+'</div>'
      +'<div style="min-width:130px;flex-shrink:0">'+(l.categoryId?'<span class="bdg" style="font-size:11px">'+esc(lockerCatLabel(l.categoryId))+'</span>':'')+'</div>'
      +'<div style="flex:1;min-width:0;font-size:13px">'+label+(l.note?'<div style="font-size:11px;color:var(--mu);margin-top:2px">'+esc(l.note)+'</div>':'')+'</div>'
      +'<button class="btn-s" style="font-size:11px;padding:3px 8px;flex-shrink:0" onclick="openSpintForm(\''+l.id+'\')">✎</button>'
      +'<button class="btn-d" style="font-size:11px;padding:3px 8px;flex-shrink:0" onclick="deleteLocker(\''+l.id+'\')">✕</button>'
      +'</div>';
  };
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">&#128188; Spindvergabe</div><div style="display:flex;gap:6px"><button class="btn-s" onclick="openSpintCatOv()">⚙️ Kategorien</button><button class="btn-p" onclick="openSpintForm()">+ Spind hinzufügen</button></div></div>
    <div style="padding:0 20px 12px;display:flex;gap:10px;flex-wrap:wrap">
      <div class="ib3">Gesamt<br><b style="font-size:18px">${total}</b></div>
      <div class="ib3">Mitarbeitern zugeteilt<br><b style="font-size:18px">${assignedUser}</b></div>
      <div class="ib3">Anderweitig vergeben<br><b style="font-size:18px">${assignedGeneral}</b></div>
      <div class="ib3">Frei<br><b style="font-size:18px">${free}</b></div>
    </div>
    <div style="padding:0 20px 12px;display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" class="srch" placeholder="&#128269; Suchen (Spind-Nr., Mitarbeiter, Notiz …)" value="${(S._spintFilter||'').replace(/"/g,'&quot;')}" oninput="S._spintFilter=this.value;renderSpint()" style="max-width:320px">
      ${(S.lockerCategories||[]).length?`<select class="flt" onchange="S._spintCatFilter=this.value;renderSpint()"><option value="">Alle Kategorien</option>${(S.lockerCategories||[]).map(c=>`<option value="${c.id}"${catFilter===c.id?' selected':''}>${esc((c.emoji?c.emoji+' ':'')+c.label)}</option>`).join('')}</select>`:''}
    </div>
    <div style="padding:0 20px 30px">
      ${filtered.length?filtered.map(row).join(''):'<div style="color:var(--di);font-size:13px;padding:20px">'+(search||catFilter?'Keine Spinde gefunden.':'Noch keine Spinde angelegt.')+'</div>'}
    </div>`;
}
function openSpintForm(id){
  const l=id?S.lockers.find(x=>x.id===id):null;
  document.getElementById('spFT').textContent=l?'Spind bearbeiten':'Neuer Spind';
  document.getElementById('spId').value=id||'';
  document.getElementById('spNumber').value=l?.number||'';
  document.getElementById('spType').value=l?.assigneeType||'user';
  const catSel=document.getElementById('spCategory');
  catSel.innerHTML='<option value="">— keine Kategorie —</option>'+(S.lockerCategories||[]).map(c=>`<option value="${c.id}">${esc((c.emoji?c.emoji+' ':'')+c.label)}</option>`).join('');
  catSel.value=l?.categoryId||'';
  const userSel=document.getElementById('spUser');
  userSel.innerHTML='<option value="">— Mitarbeiter wählen —</option>'+S.users.slice().sort(byLastName).map(u=>`<option value="${u.id}">${esc(lastNameFirst(u.name))}</option>`).join('');
  userSel.value=l?.assigneeUserId||'';
  document.getElementById('spLabel').value=l?.assigneeLabel||'';
  document.getElementById('spNote').value=l?.note||'';
  spintToggleFields();
  openModal('spintOv');
}
function spintToggleFields(){
  const type=document.getElementById('spType').value;
  document.getElementById('spUserRow').style.display=type==='user'?'':'none';
  document.getElementById('spLabelRow').style.display=type==='general'?'':'none';
}
async function saveLocker(){
  const id=document.getElementById('spId').value;
  const number=document.getElementById('spNumber').value.trim();
  if(!number) return toast('⚠️ Spind-Nummer erforderlich','err');
  const assigneeType=document.getElementById('spType').value;
  if(assigneeType==='user'&&!document.getElementById('spUser').value) return toast('⚠️ Bitte Mitarbeiter wählen','err');
  if(assigneeType==='general'&&!document.getElementById('spLabel').value.trim()) return toast('⚠️ Bitte Bezeichnung eingeben','err');
  const body={number,assigneeType,assigneeUserId:document.getElementById('spUser').value,assigneeLabel:document.getElementById('spLabel').value.trim(),note:document.getElementById('spNote').value.trim(),categoryId:document.getElementById('spCategory').value||null};
  try{
    if(id) await api('PUT','/lockers/'+id,body);
    else await api('POST','/lockers',body);
    await fetchData();closeModal('spintOv');renderSpint();toast(id?'✅ Aktualisiert!':'✅ Angelegt!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteLocker(id){
  if(!confirm('Spind löschen?'))return;
  try{await api('DELETE','/lockers/'+id);await fetchData();renderSpint();toast('✅ Gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}
function openSpintCatOv(){
  document.getElementById('spintCatList').innerHTML=(S.lockerCategories||[]).map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border)">
    <span style="font-size:16px">${c.emoji||'📦'}</span>
    <span style="flex:1;font-size:13px">${esc(c.label)}</span>
    <button class="btn-s" style="font-size:11px;padding:2px 6px" onclick="openSpintCatForm('${c.id}')">✎</button>
    <button class="btn-d" style="font-size:11px;padding:2px 6px" onclick="deleteSpintCat('${c.id}')">✕</button>
  </div>`).join('')||'<div style="color:var(--di);font-size:12px;padding:8px 0">Noch keine Kategorien.</div>';
  closeModal('spintOv');openModal('spintCatOv');
}
function openSpintCatForm(id){
  const c=id?(S.lockerCategories||[]).find(x=>x.id===id):null;
  document.getElementById('scFT2').textContent=c?'Kategorie bearbeiten':'Neue Kategorie';
  document.getElementById('scId2').value=id||'';
  document.getElementById('scLabel2').value=c?.label||'';
  document.getElementById('scEmoji2').value=c?.emoji||'';
  closeModal('spintCatOv');openModal('spintCatFormOv');
}
async function saveSpintCat(){
  const id=document.getElementById('scId2').value;
  const label=document.getElementById('scLabel2').value.trim();
  if(!label)return toast('⚠️ Bezeichnung erforderlich','err');
  const body={label,emoji:document.getElementById('scEmoji2').value.trim()};
  try{
    if(id) await api('PUT','/locker-categories/'+id,body);
    else await api('POST','/locker-categories',body);
    await fetchData();closeModal('spintCatFormOv');openSpintCatOv();toast(id?'✅ Aktualisiert!':'✅ Angelegt!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteSpintCat(id){
  if(!confirm('Kategorie löschen?'))return;
  try{await api('DELETE','/locker-categories/'+id);await fetchData();openSpintCatOv();toast('✅ Gelöscht');}catch(e){toast('⚠️ '+e.message,'err');}
}

// ── DOKUMENTE / DATEIABLAGE ───────────────────────────────────────────────────
function renderDocs(){
  const cats=S.docCategories||[];
  const docs=S.docs||[];
  const search=(S._docSearch||'').toLowerCase().trim();
  const filt=S._docFilter||'all';
  let filtered=docs;
  if(filt==='__none__') filtered=filtered.filter(d=>!d.categoryId);
  else if(filt!=='all') filtered=filtered.filter(d=>d.categoryId===filt);
  if(search) filtered=filtered.filter(d=>d.title.toLowerCase().includes(search)||(d.originalName||'').toLowerCase().includes(search)||(d.description||'').toLowerCase().includes(search));
  const fmtBytes=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';
  const fileIcon=m=>{if(!m)return'📎';if(m.startsWith('image/'))return'🖼️';if(m==='application/pdf')return'📄';if(m.includes('word')||m.includes('document'))return'📝';if(m.includes('excel')||m.includes('spreadsheet')||m.includes('csv'))return'📊';if(m.includes('zip')||m.includes('compressed')||m.includes('archive'))return'🗜️';if(m.startsWith('video/'))return'🎬';if(m.startsWith('audio/'))return'🎵';return'📎';};
  const catBadge=d=>{const c=cats.find(x=>x.id===d.categoryId);if(!c)return'';return`<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${c.color}22;color:${c.color};border:1px solid ${c.color}44;font-weight:600">${c.icon} ${c.name}</span>`;};
  const isAdmin=S.p?.manageUsers;
  const canManage=d=>d.uploadedBy===S.currentUser||isAdmin;
  document.getElementById('main').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:24px 20px 0;gap:10px;flex-wrap:wrap">
      <h1 style="margin:0;font-size:20px;font-weight:700">&#128193; Dateiablage</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${isAdmin?`<button class="btn-s" onclick="openModal('docCatOv');renderDocCatAdmin()">&#128193; Kategorien</button>`:''}
        <button class="btn-p" onclick="openDocForm()">&#8679; Hochladen</button>
      </div>
    </div>
    <div class="docs-layout">
      <div class="docs-sidebar">
        <div class="docs-cat-item${filt==='all'?' active':''}" onclick="S._docFilter='all';renderDocs()">&#128193; Alle <span class="docs-cat-cnt">${docs.length}</span></div>
        ${(()=>{const top=cats.filter(c=>!c.parentId);const item=(c,sub)=>{const n=docs.filter(d=>d.categoryId===c.id).length;return`<div class="docs-cat-item${filt===c.id?' active':''}" onclick="S._docFilter='${c.id}';renderDocs()" style="${filt===c.id?'border-left-color:'+c.color+';':''}${sub?'padding-left:28px':''}">${c.icon} ${c.name} <span class="docs-cat-cnt">${n}</span></div>`;};return top.flatMap(c=>[item(c,false),...cats.filter(ch=>ch.parentId===c.id).map(ch=>item(ch,true))]).join('');})()}
        <div class="docs-cat-item${filt==='__none__'?' active':''}" onclick="S._docFilter='__none__';renderDocs()">📎 Ohne Kat. <span class="docs-cat-cnt">${docs.filter(d=>!d.categoryId).length}</span></div>
      </div>
      <div class="docs-main">
        <input type="text" placeholder="&#128269; Suchen…" value="${(S._docSearch||'').replace(/"/g,'&quot;')}" oninput="S._docSearch=this.value;renderDocs()" style="width:100%;padding:8px 12px;font-size:13px;border:1px solid var(--border);border-radius:var(--r);background:var(--sf);color:var(--tx);box-sizing:border-box;margin-bottom:14px">
        ${filtered.length===0?`<div style="text-align:center;padding:48px 20px;color:var(--di);font-size:14px">Keine Dokumente gefunden.</div>`:`
        <div class="docs-list">
          ${filtered.map(d=>`<div class="doc-row"${d.id===S._docHighlight?' id="doc-hl-target" style="outline:2px solid var(--acc);outline-offset:-2px;border-radius:var(--r)"':''}>
            <div class="doc-icon">${fileIcon(d.mimeType)}</div>
            <div class="doc-info">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <a href="/api/docs/${d.id}" target="_blank" rel="noopener" class="doc-title">${d.title}</a>
                ${catBadge(d)}
                ${d.currentVersion>1?`<span class="doc-ver-badge">v${d.currentVersion}</span>`:''}
              </div>
              ${d.description?`<div class="doc-desc">${d.description}</div>`:''}
              <div class="doc-meta">${d.originalName} &bull; ${fmtBytes(d.sizeBytes||0)} &bull; ${getU(d.uploadedBy)?lastNameFirst(getU(d.uploadedBy).name):'?'} &bull; ${fdt(d.createdAt)}${d.currentVersion>1?` &bull; <a href="#" onclick="showDocHistory('${d.id}');return false" style="color:var(--acc)">${d.currentVersion} Versionen &#9660;</a>`:''}</div>
            </div>
            <div class="doc-actions">
              <button class="btn-s" style="font-size:11px;padding:4px 9px" onclick="copyDocLink('${d.id}')" title="Link für andere Portal-Nutzer kopieren">&#128279;</button>
              ${canManage(d)?`
              <button class="btn-s" style="font-size:11px;padding:4px 9px" onclick="openDocForm('${d.id}')" title="Bearbeiten">&#9998;</button>
              <button class="btn-s" style="font-size:11px;padding:4px 9px" onclick="openDocVersion('${d.id}')" title="Neue Version">&#128260;</button>
              <button class="btn-d" style="font-size:11px;padding:4px 9px" onclick="deleteDoc('${d.id}','${d.title.replace(/'/g,"\\'")}')" title="Löschen">&#128465;</button>`:''}
            </div>
          </div>`).join('')}
        </div>`}
      </div>
    </div>`;
  if(S._docHighlight){
    const hl=document.getElementById('doc-hl-target');
    if(hl)hl.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{S._docHighlight=null;if(S.view==='docs')renderDocs();},3000);
  }
}
// Kopiert einen Direktlink auf ein Dokument — funktioniert nur für Personen,
// die sich im Portal einloggen können (kein öffentlicher/unauthentifizierter Zugriff).
function copyDocLink(docId){
  const url=location.origin+location.pathname+'?doc='+docId;
  const done=()=>toast('🔗 Link kopiert — öffnet sich nur für eingeloggte Portal-Nutzer');
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(done).catch(()=>toast('⚠️ Kopieren fehlgeschlagen: '+url,'err'));}
  else toast('Link: '+url);
}
function openDocForm(docId){
  S._editDocId=docId||null;
  const doc=docId?S.docs.find(d=>d.id===docId):null;
  document.getElementById('docFormTitle').textContent=doc?'✏️ Dokument bearbeiten':'📄 Dokument hochladen';
  document.getElementById('docFTitle').value=doc?.title||'';
  document.getElementById('docFDesc').value=doc?.description||'';
  const fw=document.getElementById('docFFileWrap');if(fw)fw.style.display=doc?'none':'';
  const fileInp=document.getElementById('docFFile');if(fileInp)fileInp.value='';
  document.getElementById('docFBtn').textContent=doc?'Speichern':'Hochladen';
  const sel=document.getElementById('docFCat');
  sel.innerHTML=`<option value="">— Keine Kategorie —</option>${_docCatOptionsIndented()}`;
  if(doc?.categoryId)sel.value=doc.categoryId;
  openModal('docFormOv');
}
async function submitDocForm(){
  const title=document.getElementById('docFTitle').value.trim();
  if(!title){toast('⚠️ Titel erforderlich','err');return;}
  const catId=document.getElementById('docFCat').value||null;
  const desc=document.getElementById('docFDesc').value.trim();
  if(S._editDocId){
    try{await api('PUT','/docs/'+S._editDocId,{title,description:desc,categoryId:catId});await fetchData();renderDocs();closeModal('docFormOv');toast('✅ Gespeichert');}
    catch(e){toast('⚠️ '+e.message,'err');}
    return;
  }
  const fileInput=document.getElementById('docFFile');
  const file=fileInput?.files[0];
  if(!file){toast('⚠️ Bitte eine Datei auswählen','err');return;}
  if(file.size>15*1024*1024){toast('⚠️ Datei zu groß (max. 15 MB)','err');return;}
  toast('⏳ Wird hochgeladen…');
  try{
    const buf=await file.arrayBuffer();const bytes=new Uint8Array(buf);
    let b64='';const chunk=8192;for(let i=0;i<bytes.length;i+=chunk)b64+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    b64=btoa(b64);
    await api('POST','/docs',{title,description:desc,categoryId:catId,name:file.name,mimeType:file.type||'application/octet-stream',data:b64});
    await fetchData();renderDocs();closeModal('docFormOv');toast('✅ Dokument hochgeladen');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function openDocVersion(docId){
  const doc=S.docs.find(d=>d.id===docId);if(!doc)return;
  document.getElementById('docVerDocId').value=docId;
  document.getElementById('docVerInfo').textContent='Aktuell: v'+doc.currentVersion+' — '+doc.originalName;
  document.getElementById('docVerFile').value='';
  openModal('docVerOv');
}
async function submitDocVersion(){
  const docId=document.getElementById('docVerDocId').value;
  const file=document.getElementById('docVerFile').files[0];
  if(!file){toast('⚠️ Bitte eine Datei auswählen','err');return;}
  if(file.size>15*1024*1024){toast('⚠️ Datei zu groß (max. 15 MB)','err');return;}
  toast('⏳ Wird hochgeladen…');
  try{
    const buf=await file.arrayBuffer();const bytes=new Uint8Array(buf);
    let b64='';const chunk=8192;for(let i=0;i<bytes.length;i+=chunk)b64+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    b64=btoa(b64);
    await api('POST','/docs/'+docId+'/version',{name:file.name,mimeType:file.type||'application/octet-stream',data:b64});
    await fetchData();renderDocs();closeModal('docVerOv');toast('✅ Neue Version hochgeladen');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteDoc(id,title){
  if(!confirm('Dokument "'+title+'" wirklich löschen? Alle Versionen werden entfernt.'))return;
  try{await api('DELETE','/docs/'+id);await fetchData();renderDocs();toast('✅ Dokument gelöscht');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function showDocHistory(docId){
  const doc=S.docs.find(d=>d.id===docId);if(!doc)return;
  try{
    const vers=await api('GET','/docs/'+docId+'/versions');
    const fmtBytes=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';
    document.getElementById('docHistBody').innerHTML=`
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">${doc.title}</div>
      <div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;margin-bottom:6px">Aktuelle Version</div>
      <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--sf2);border:1px solid var(--acc);border-radius:8px;margin-bottom:12px">
        <span style="font-size:11px;font-weight:700;background:var(--acc);color:var(--act);padding:2px 8px;border-radius:10px">v${doc.currentVersion}</span>
        <span style="font-size:13px;flex:1">${doc.originalName}</span>
        <a href="/api/docs/${docId}" target="_blank" class="btn-s" style="font-size:11px;padding:3px 8px;text-decoration:none">&#8595; Öffnen</a>
      </div>
      ${vers&&vers.length?`<div style="font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;margin-bottom:6px">Ältere Versionen</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${vers.map(v=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--sf2);border:1px solid var(--border);border-radius:8px">
          <span style="font-size:11px;font-weight:700;color:var(--mu);border:1px solid var(--border);padding:2px 7px;border-radius:10px">v${v.version}</span>
          <span style="font-size:12px;flex:1;color:var(--mu)">${v.original_name||v.originalName}</span>
          <span style="font-size:11px;color:var(--di)">${fmtBytes(v.size_bytes||v.sizeBytes||0)}</span>
          <a href="/api/docs/${docId}/versions/${v.id}" target="_blank" class="btn-s" style="font-size:11px;padding:3px 8px;text-decoration:none">&#8595;</a>
        </div>`).join('')}
      </div>`:'<div style="color:var(--di);font-size:12px">Keine älteren Versionen.</div>'}`;
    openModal('docHistOv');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function renderDocCatAdmin(){
  if(!S.p?.manageUsers)return;
  const list=document.getElementById('docCatList');if(!list)return;
  const cats=S.docCategories||[];
  const top=cats.filter(c=>!c.parentId);
  const parentSel=document.getElementById('docCatParent');
  if(parentSel)parentSel.innerHTML=`<option value="">— Kein Unterordner —</option>${top.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}`;
  const row=c=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--sf2);border:1px solid var(--border);border-radius:7px;margin-bottom:6px${c.parentId?';margin-left:24px':''}">
    <span style="font-size:18px">${c.parentId?'&#8618; ':''}${c.icon}</span>
    <span style="flex:1;font-size:13px">${c.name}</span>
    <span style="width:18px;height:18px;border-radius:50%;background:${c.color};flex-shrink:0;display:inline-block"></span>
    <button class="btn-d" style="padding:3px 8px;font-size:11px" onclick="deleteDocCat('${c.id}','${c.name.replace(/'/g,"\\'")}')">&#10005;</button>
  </div>`;
  const html=top.flatMap(c=>[row(c),...cats.filter(ch=>ch.parentId===c.id).map(row)]).join('')
    +cats.filter(c=>c.parentId&&!top.some(t=>t.id===c.parentId)).map(row).join('');
  list.innerHTML=cats.length?html:'<div style="color:var(--di);font-size:12px;padding:4px 0">Noch keine Kategorien.</div>';
}
function _docCatOptionsIndented(){
  const cats=S.docCategories||[];
  const top=cats.filter(c=>!c.parentId);
  return top.flatMap(c=>[c,...cats.filter(ch=>ch.parentId===c.id)]).map(c=>`<option value="${c.id}">${c.parentId?'　↳ ':''}${c.icon} ${c.name}</option>`).join('');
}
async function addDocCat(){
  const name=document.getElementById('docCatName').value.trim();
  const icon=document.getElementById('docCatIcon').value.trim()||'📁';
  const parentId=document.getElementById('docCatParent')?.value||null;
  if(!name){toast('⚠️ Name erforderlich','err');return;}
  try{
    await api('POST','/doc-categories',{name,icon,parentId});
    document.getElementById('docCatName').value='';document.getElementById('docCatIcon').value='';
    if(document.getElementById('docCatParent'))document.getElementById('docCatParent').value='';
    await fetchData();renderDocCatAdmin();
    const sel=document.getElementById('docFCat');if(sel){sel.innerHTML=`<option value="">— Keine Kategorie —</option>${_docCatOptionsIndented()}`;}
    if(S.view==='docs')renderDocs();
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteDocCat(id,name){
  if(!confirm('Kategorie "'+name+'" löschen? Zugeordnete Dokumente verlieren nur die Kategorie.'))return;
  try{await api('DELETE','/doc-categories/'+id);await fetchData();renderDocCatAdmin();if(S.view==='docs')renderDocs();}
  catch(e){toast('⚠️ '+e.message,'err');}
}

// ── MEETINGS ─────────────────────────────────────────────────────────────────
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fmtDate(d){if(!d)return'';var p=String(d).slice(0,10);return p.slice(8)+'.'+p.slice(5,7)+'.'+p.slice(0,4);}

function renderMeetings() {
  const canCreateMeeting = S.p.addGeneral || S.p.manageUsers;
  const m = S._selMeeting ? S.meetings.find(x=>x.id===S._selMeeting) : null;
  // Wird u.a. alle 30s vom Hintergrund-Refresh erneut aufgerufen — ohne diese
  // Rettung würde die Seitenleiste (und der Hauptbereich) beim Lesen/Scrollen
  // ständig wieder nach oben springen, weil hier alles neu erzeugt wird.
  const _mScrollList = document.querySelector('.meetings-list')?.scrollTop;
  const _mScrollMain = document.querySelector('.meetings-main')?.scrollTop;
  document.getElementById('main').innerHTML = `
<div class="meetings-layout">
  <div class="meetings-sidebar">
    <div class="meetings-sidebar-hdr">
      <span style="font-weight:700;font-size:15px">&#128483;&#65039; Besprechungen</span>
      ${canCreateMeeting?`<button class="btn-s" onclick="openMeetingForm()">+ Neu</button>`:''}
    </div>
    <div class="meetings-list">
      ${S.meetings.length===0?`<div style="color:var(--mu);font-size:13px;padding:12px">Keine Besprechungen</div>`:''}
      ${S.meetings.map(mt=>{
        const insts=mt.instances||[];
        const open=insts.reduce((s,i)=>(i.items||[]).filter(it=>it.status==='open'||it.status==='redo').length+s,0);
        // Nur nicht abgeschlossene Themen direkt auf der Kachel — abgeschlossene
        // sind ja weiterhin im Archiv der Besprechung erreichbar, sollen aber
        // die Übersicht hier nicht zumüllen.
        const activeThemen=[...insts].filter(i=>i.status!=='done').sort((a,b)=>{
          if(a.date&&b.date)return a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'');
          if(a.date)return -1; if(b.date)return 1; return 0;
        });
        const typeBadge={einmalig:'Einmalig',jour_fixe:'Jour Fixe',ad_hoc:'Ad hoc',ungeplant:'Ungeplant'}[mt.type]||mt.type;
        const canMng=mt._canManage||false;
        return`<div class="meetings-item${S._selMeeting===mt.id?' active':''}" onclick="S._selMeeting='${mt.id}';S._selInstance=null;renderMeetings()">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="font-weight:600;font-size:13px;flex:1">${esc(mt.title)}</div>
            ${canMng?`<div style="display:flex;gap:2px;flex-shrink:0" onclick="event.stopPropagation()">
              <button class="btn-s" style="padding:4px 8px;font-size:12px;border-radius:4px;transition:all .2s" title="Bearbeiten" onclick="openMeetingForm('${mt.id}')">✏️</button>
              <button class="btn-s btn-danger" style="padding:4px 8px;font-size:12px;border-radius:4px;transition:all .2s" title="Löschen" onclick="deleteMeeting('${mt.id}')">🗑</button>
            </div>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">
            <span style="font-size:11px;background:var(--bg2);padding:1px 6px;border-radius:10px;color:var(--mu)">${typeBadge}</span>
            ${mt.type==='jour_fixe'&&mt.rhythm?`<span style="font-size:11px;color:var(--mu)">${{weekly:'wöchentlich',biweekly:'2-wöchentlich',monthly:'monatlich',daily:'täglich'}[mt.rhythm]||''} ${mt.rhythmTime||''}</span>`:''}
          </div>
          ${activeThemen.length?`<div style="margin-top:5px;display:flex;flex-direction:column;gap:2px">
            ${activeThemen.map(i=>`<div style="font-size:11px;color:var(--mu);display:flex;align-items:center;gap:4px">
              <span style="flex-shrink:0">${i.kind==='protocol'?'📖':'📋'}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.title||'Thema')}</span>
              <span style="flex-shrink:0">${i.date?fmtDate(i.date):'offen'}</span>
            </div>`).join('')}
          </div>`:insts.length?`<div style="font-size:11px;color:var(--di);margin-top:3px">Alle Themen abgeschlossen</div>`:''}
          ${open>0?`<div style="margin-top:3px"><span style="font-size:11px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:10px">${open} offene Punkte</span></div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="meetings-main">
    ${m ? renderMeetingDetail(m, m._canManage||false) : `<div style="color:var(--mu);padding:32px;text-align:center;font-size:14px">← Besprechung auswählen</div>`}
  </div>
</div>`;
  if(_mScrollList!=null){const el=document.querySelector('.meetings-list');if(el)el.scrollTop=_mScrollList;}
  if(_mScrollMain!=null){const el=document.querySelector('.meetings-main');if(el)el.scrollTop=_mScrollMain;}
}

function meetingInstTabHtml(m, i, canManage) {
  const open=(i.items||[]).filter(it=>it.status==='open'||it.status==='redo').length;
  const statusColor={planned:'#3b82f6',done:'#10b981',cancelled:'#ef4444'}[i.status]||'#64748b';
  const titleLine=i.title?esc(i.title):'Thema';
  const isProtocol = i.kind==='protocol';
  // Bei Protokoll-Themen liegen Datum/Uhrzeit bei den einzelnen Protokollen,
  // nicht am Thema selbst — "Datum offen" und der Status "Geplant" wären hier
  // immer (und damit bedeutungslos) zu sehen. Nur ein tatsächlicher Endstatus
  // (Abgeschlossen/Abgesagt) ist bei Protokoll-Themen relevant genug zum Zeigen.
  const showDate = !isProtocol && i.date;
  const showDateOpen = !isProtocol && !i.date;
  const showStatus = !isProtocol || i.status!=='planned';
  return`<div class="meetings-inst-tab${S._selInstance===i.id?' active':''}" style="position:relative">
    <div onclick="S._selInstance='${i.id}';renderMeetings()" style="cursor:pointer;${canManage?'padding-right:18px':''}">
      <div style="font-size:12px;font-weight:600">${isProtocol?'📖 ':'📋 '}${titleLine}</div>
      ${showDate?`<div style="font-size:11px;color:var(--mu);margin-top:1px">${fmtDate(i.date)}${i.time?' '+i.time:''}</div>`:''}
      <div style="display:flex;gap:4px;margin-top:2px;align-items:center;flex-wrap:wrap">
        ${showDateOpen?`<span style="font-size:10px;color:#f59e0b">Datum offen</span>`:''}
        ${showStatus?`<span style="font-size:10px;color:${statusColor}">${{planned:'Geplant',done:'Abgeschlossen',cancelled:'Abgesagt'}[i.status]||i.status}</span>`:''}
        ${open>0?`<span style="font-size:10px;color:#92400e;background:#fef3c7;padding:0 4px;border-radius:8px">${open}</span>`:''}
      </div>
    </div>
    ${canManage?`<button class="btn-s" style="position:absolute;top:4px;right:4px;padding:1px 5px;font-size:10px;line-height:1.4" title="Thema ändern" onclick="event.stopPropagation();openInstanceForm('${m.id}','${i.id}')">&#9998;</button>`:''}
  </div>`;
}
// Abgeschlossene Themen wandern in ein eigenes, einklappbares Archiv — bleiben
// so weiterhin leicht erreichbar, drängen sich aber nicht mehr zwischen den
// aktuell offenen Themen der Besprechung.
if (!window._meetingArchiveExpanded) window._meetingArchiveExpanded = {};
function toggleMeetingArchive(meetingId) {
  window._meetingArchiveExpanded[meetingId] = !window._meetingArchiveExpanded[meetingId];
  renderMeetings();
}
function renderMeetingDetail(m, canManage) {
  const inst = S._selInstance ? m.instances.find(x=>x.id===S._selInstance) : null;
  const rhythmLabels={weekly:'wöchentlich',biweekly:'alle 2 Wochen',monthly:'monatlich',daily:'täglich'};
  const allInst = [...(m.instances||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const activeInst = allInst.filter(i=>i.status!=='done');
  const archivedInst = allInst.filter(i=>i.status==='done');
  const archiveOpen = !!window._meetingArchiveExpanded[m.id] || (!!inst && inst.status==='done');
  return`<div style="padding:20px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px">
      <div>
        <h2 style="margin:0 0 4px;font-size:18px">${esc(m.title)}</h2>
        ${m.description?`<div style="font-size:13px;color:var(--mu)">${esc(m.description)}</div>`:''}
        ${m.type==='jour_fixe'?`<div style="font-size:12px;color:var(--mu);margin-top:4px">&#128257; ${rhythmLabels[m.rhythm]||m.rhythm||''} ${m.rhythmTime?'um '+m.rhythmTime:''}</div>`:''}
        ${m.link?`<div style="margin-top:6px"><a href="${esc(m.link)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#3b6dd4;text-decoration:none;display:inline-flex;align-items:center;gap:4px"><span>🔗</span><span>${esc(m.link.slice(0,50))}${m.link.length>50?'…':''}</span></a></div>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        ${canManage?`<button class="btn-s" onclick="openInstanceForm('${m.id}')">+ Thema</button>`:''}
        ${canManage&&m.type==='jour_fixe'?`<button class="btn-s" onclick="generateNextInstance('${m.id}')">&#128257; Nächstes Thema</button>`:''}
      </div>
    </div>
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:${archivedInst.length?'0':'16px'};overflow-x:auto">
      ${allInst.length===0?`<div style="color:var(--mu);font-size:13px;padding:8px 0">Noch keine Themen</div>`:''}
      ${activeInst.length===0&&archivedInst.length>0?`<div style="color:var(--mu);font-size:13px;padding:8px 0">Keine offenen Themen — siehe Archiv unten</div>`:''}
      ${activeInst.map(i=>meetingInstTabHtml(m,i,canManage)).join('')}
    </div>
    ${archivedInst.length?`<div style="margin-bottom:16px">
      <div onclick="toggleMeetingArchive('${m.id}')" style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mu);padding:8px 0;user-select:none">
        <span style="transition:transform .15s;display:inline-block;transform:rotate(${archiveOpen?'90':'0'}deg)">▶</span>
        <span>📦 Archiv — ${archivedInst.length===1?'1 abgeschlossenes Thema':archivedInst.length+' abgeschlossene Themen'}</span>
      </div>
      ${archiveOpen?`<div style="display:flex;gap:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow-x:auto">
        ${archivedInst.map(i=>meetingInstTabHtml(m,i,canManage)).join('')}
      </div>`:''}
    </div>`:''}
    ${inst ? renderInstanceDetail(inst, m, canManage) : `<div style="color:var(--mu);font-size:13px">← Thema auswählen</div>`}
  </div>`;
}

function renderInstanceDetail(inst, meeting, canManage) {
  if (inst.kind==='protocol') return renderProtocolInstanceDetail(inst, meeting, canManage);
  return`<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;color:var(--mu)">${inst.notes?`<span>${esc(inst.notes)}</span>`:''}</div>
      <div style="display:flex;gap:8px">
        ${canManage?`<button class="btn-add" onclick="openItemForm('${inst.id}')">+ Punkt</button>`:''}
        ${canManage&&inst.status==='planned'?`<button class="btn-s" style="background:#10b981;color:#fff" onclick="setInstanceStatus('${inst.id}','done')">&#10003; Abschließen</button>`:''}
        ${canManage&&inst.status==='done'?`<button class="btn-s" style="background:#f59e0b;color:#fff" onclick="setInstanceStatus('${inst.id}','planned')">↩ Wiederöffnen</button>`:''}
        ${canManage?`<button class="btn-d" style="padding:4px 8px" onclick="deleteInstance('${inst.id}')">&#128465;</button>`:''}
      </div>
    </div>
    <input class="srch" type="text" id="meetingItemSearch" placeholder="🔍 Punkte durchsuchen …" value="${esc(S._meetingItemSearch||'')}" oninput="filterMeetingItems(this.value)" style="width:100%;margin-bottom:12px;box-sizing:border-box">
    <div id="meetingItemsGrid">${renderMeetingItemsGrid(inst, canManage, S._meetingItemSearch||'')}</div>
  </div>`;
}
function renderProtocolInstanceDetail(inst, meeting, canManage) {
  const protos=[...(inst.protocols||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  return`<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;color:var(--mu)">${inst.notes?`<span>${esc(inst.notes)}</span>`:''}</div>
      <div style="display:flex;gap:8px">
        ${canManage?`<button class="btn-add" onclick="openProtocolForm('${inst.id}')">+ Protokoll</button>`:''}
        ${canManage&&inst.status==='planned'?`<button class="btn-s" style="background:#10b981;color:#fff" onclick="setInstanceStatus('${inst.id}','done')">&#10003; Abschließen</button>`:''}
        ${canManage&&inst.status==='done'?`<button class="btn-s" style="background:#f59e0b;color:#fff" onclick="setInstanceStatus('${inst.id}','planned')">↩ Wiederöffnen</button>`:''}
        ${canManage?`<button class="btn-d" style="padding:4px 8px" onclick="deleteInstance('${inst.id}')">&#128465;</button>`:''}
      </div>
    </div>
    ${protos.length===0?`<div style="color:var(--mu);font-size:13px;padding:16px 0;text-align:center">Noch keine Protokolle.</div>`:''}
    <div style="display:flex;flex-direction:column;gap:10px">
      ${protos.map(p=>`<div class="meetings-card" style="cursor:default">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-weight:600;font-size:13px">${esc(p.title)}</span>
            ${p.released?`<span class="bdg" style="font-size:10px;background:#10b98122;color:#10b981">&#128274; Freigegeben</span>`:''}
          </div>
          ${canManage?`<div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn-e" style="padding:2px 6px;font-size:11px" onclick="openProtocolForm('${inst.id}','${p.id}')">&#9998;</button>
            <button class="btn-d" style="padding:2px 6px;font-size:11px" onclick="deleteProtocol('${p.id}')">&#10005;</button>
          </div>`:''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--mu)">
          ${p.date?`<span>&#128197; ${fmtDate(p.date)}${p.time?' '+p.time:''}</span>`:''}
          ${p.location?`<span>&#128205; ${esc(p.location)}</span>`:''}
        </div>
        ${(p.attendees||[]).length?`<div style="display:flex;gap:3px;margin-top:6px;flex-wrap:wrap">${p.attendees.map(a=>{
          if(a.startsWith(EXT_ATTENDEE_PREFIX)){const n=a.slice(EXT_ATTENDEE_PREFIX.length);return`<span class="av-sm" style="background:#64748b" title="${esc(n)} (extern)">${esc(n.slice(0,2).toUpperCase())}</span>`;}
          const u=getU(a);return u?`<span class="av-sm" style="background:${u.color}" title="${esc(lastNameFirst(u.name))}">${esc(u.initials)}</span>`:'';
        }).join('')}</div>`:''}
        ${p.body?`<div style="font-size:12px;color:var(--tx);margin-top:8px;white-space:pre-wrap;border-top:1px solid var(--border);padding-top:8px;max-height:240px;overflow-y:auto">${esc(p.body)}</div>`:''}
      </div>`).join('')}
    </div>
  </div>`;
}
function renderMeetingItemsGrid(inst, canManage, search) {
  const statusCols={open:'Zu besprechen',done:'Besprochen',redo:'Nochmal',delegate:'Delegiert'};
  const statusColors={open:'#3b82f6',done:'#10b981',redo:'#f59e0b',delegate:'#7c3aed'};
  const s=(search||'').toLowerCase().trim();
  const matches=it=>!s||[it.title,it.description,it.result,getU(it.delegatedTo)?.name].some(v=>(v||'').toLowerCase().includes(s));
  const groups={open:[],done:[],redo:[],delegate:[]};
  (inst.items||[]).filter(matches).forEach(it=>{if(groups[it.status])groups[it.status].push(it);else groups.open.push(it);});
  // Besprochene Punkte: nach Datum sortieren (zuletzt besprochen zuerst), ohne Datum ans Ende
  groups.done.sort((a,b)=>{
    if(!a.meetingDate&&!b.meetingDate)return 0;
    if(!a.meetingDate)return 1;
    if(!b.meetingDate)return -1;
    return String(b.meetingDate).localeCompare(String(a.meetingDate));
  });
  return`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      ${Object.entries(groups).map(([st,items])=>`
        <div class="meetings-col">
          <div class="meetings-col-hdr" style="color:${statusColors[st]}">${statusCols[st]} <span style="font-size:11px;opacity:.7">(${items.length})</span></div>
          ${items.length===0?`<div style="font-size:12px;color:var(--mu);padding:8px;text-align:center">${s?'Keine Treffer':'—'}</div>`:''}
          ${items.map(it=>{const deadlineColor=getDeadlineColor(it.dueDate);return`<div class="meetings-card"${it._canEdit?` onclick="openItemForm('${inst.id}','${it.id}')"`:''} style="${it._canEdit?'':'cursor:default'}${deadlineColor?';border-left:4px solid '+deadlineColor:''}">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(it.title)}</div>
            ${st==='done'?`<div style="font-size:11px;color:var(--mu);margin-bottom:4px">&#128197; Besprochen am: ${it.meetingDate?fmtDate(it.meetingDate):'ohne Datum'}</div>`:''}
            ${it.description?`<div style="font-size:12px;color:var(--mu);margin-bottom:4px">${esc(it.description.slice(0,80))}${it.description.length>80?'…':''}</div>`:''}
            ${it.result?`<div style="${it.description?'border-top:1px solid var(--border);padding-top:4px;margin-top:4px;':''}font-size:12px;color:var(--mu);margin-bottom:4px"><span style="font-size:10px;font-weight:700;color:var(--di);text-transform:uppercase">Ergebnis</span> ${esc(it.result.slice(0,30))}${it.result.length>30?'…':''}</div>`:''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
              ${it.dueDate?`<span style="font-size:11px;color:${deadlineColor||'#64748b'};font-weight:${deadlineColor?'600':'400'}">&#128197; ${fmtDate(it.dueDate)}</span>`:''}
              ${it.delegatedTo?`<span style="font-size:11px;color:#7c3aed">→ ${esc(getU(it.delegatedTo)?lastNameFirst(getU(it.delegatedTo).name):'?')}</span>`:''}
              ${(it.participants||[]).slice(0,4).map(p=>{const u=getU(p.userId);return u?`<span class="av-sm" style="background:${u.color}" title="${esc(lastNameFirst(u.name))}">${esc(u.initials)}</span>`:''}).join('')}
              ${(it.participants||[]).length>4?`<span style="font-size:11px;color:var(--mu)">+${it.participants.length-4}</span>`:''}
            </div>
            ${it.link?`<div style="margin-top:4px;font-size:11px"><a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer" style="color:#3b6dd4;text-decoration:none;display:inline-flex;align-items:center;gap:3px"><span>🔗</span><span>${esc(it.link.slice(0,30))}${it.link.length>30?'…':''}</span></a></div>`:''}
            ${it.parentId?`<div style="font-size:11px;color:#7c3aed;margin-top:4px">&#8617; Folge</div>`:''}
            ${it.groupId?`<div style="font-size:11px;color:#0ea5e9;margin-top:4px">🔗 Verknüpft</div>`:''}
          </div>`;}).join('')}
        </div>`).join('')}
    </div>`;
}
function filterMeetingItems(val) {
  S._meetingItemSearch = val;
  const grid = document.getElementById('meetingItemsGrid');
  const m = S._selMeeting ? S.meetings.find(x=>x.id===S._selMeeting) : null;
  const inst = m && S._selInstance ? m.instances.find(x=>x.id===S._selInstance) : null;
  if (!grid || !inst) return;
  grid.innerHTML = renderMeetingItemsGrid(inst, m._canManage||false, val);
}

function openMeetingForm(id=null) {
  const m = id ? S.meetings.find(x=>x.id===id) : null;
  document.getElementById('meetingFormTitle').textContent = m ? 'Besprechung bearbeiten' : 'Neue Besprechung';
  document.getElementById('mfId').value = m?.id||'';
  document.getElementById('mfTitle').value = m?.title||'';
  document.getElementById('mfType').value = m?.type||'einmalig';
  document.getElementById('mfDesc').value = m?.description||'';
  document.getElementById('mfLink').value = m?.link||'';
  document.getElementById('mfRhythm').value = m?.rhythm||'weekly';
  document.getElementById('mfRhythmTime').value = m?.rhythmTime||'';
  document.getElementById('mfRhythmDiv').style.display = (m?.type||'einmalig')==='jour_fixe'?'':'none';
  openModal('meetingFormOv');
}

function onMfTypeChange() {
  document.getElementById('mfRhythmDiv').style.display = document.getElementById('mfType').value==='jour_fixe'?'':'none';
}

async function submitMeetingForm() {
  const id = document.getElementById('mfId').value;
  const title = document.getElementById('mfTitle').value.trim();
  if (!title) return toast('Titel erforderlich','err');
  const body = {
    title, type: document.getElementById('mfType').value,
    rhythm: document.getElementById('mfRhythm').value,
    rhythmTime: document.getElementById('mfRhythmTime').value,
    description: document.getElementById('mfDesc').value.trim(),
    link: document.getElementById('mfLink').value.trim() || null,
  };
  try {
    if (id) await api('PUT','/meetings/'+id, body);
    else await api('POST','/meetings', body);
    closeModal('meetingFormOv');
    await fetchData();
    renderMeetings();
    toast('Besprechung gespeichert');
  } catch(e) { toast('Fehler beim Speichern','err'); }
}

async function deleteMeeting(id) {
  if (!confirm('Besprechung und alle Themen löschen?')) return;
  try {
    await api('DELETE','/meetings/'+id);
    S._selMeeting=null; S._selInstance=null;
    await fetchData(); renderMeetings(); toast('Gelöscht');
  } catch(e) { toast('Fehler','err'); }
}

function openInstanceForm(meetingId, id=null) {
  const m = S.meetings.find(x=>x.id===meetingId);
  const inst = id ? (m?.instances||[]).find(x=>x.id===id) : null;
  document.getElementById('instanceFormTitle').textContent = inst ? 'Thema bearbeiten' : 'Neues Thema';
  document.getElementById('ifId').value = inst?.id||'';
  document.getElementById('ifMeetingId').value = meetingId;
  document.getElementById('ifTitle').value = inst?.title||'';
  // Art (Punkte/Protokoll) wird bei Neuanlage gewählt und ist danach fix,
  // da sich beide Ansichten strukturell unterscheiden (Punkte vs. Protokolle).
  const kindPoints=document.getElementById('ifKindPoints'), kindProtocol=document.getElementById('ifKindProtocol');
  kindPoints.checked = (inst?.kind||'points')==='points';
  kindProtocol.checked = inst?.kind==='protocol';
  kindPoints.disabled = kindProtocol.disabled = !!inst;
  document.getElementById('ifKindWrap').style.opacity = inst?'.55':'1';
  onIfKindChange();
  const dateOpen = inst && !inst.date;
  const cb = document.getElementById('ifDateOpen');
  cb.checked = dateOpen;
  document.getElementById('ifDate').disabled = dateOpen;
  document.getElementById('ifDate').value = dateOpen ? '' : (inst?.date?.slice?.(0,10)||'');
  document.getElementById('ifTime').value = inst?.time||m?.rhythmTime||'';
  document.getElementById('ifNotes').value = inst?.notes||'';
  openModal('instanceFormOv');
}

// Bei Protokoll-Themen werden Datum/Uhrzeit pro Protokoll-Eintrag erfasst,
// nicht am Thema selbst — Felder ausblenden und die Datumspflicht dafür
// aufheben.
function onIfKindChange() {
  const isProtocol = document.getElementById('ifKindProtocol').checked;
  document.getElementById('ifDateTimeWrap').style.display = isProtocol ? 'none' : '';
}
async function submitInstanceForm() {
  const id = document.getElementById('ifId').value;
  const meetingId = document.getElementById('ifMeetingId').value;
  const isProtocol = document.getElementById('ifKindProtocol').checked;
  const dateOpen = document.getElementById('ifDateOpen').checked;
  const date = document.getElementById('ifDate').value;
  if (!isProtocol && !dateOpen && !date) return toast('Datum erforderlich oder "Datum noch offen" aktivieren','err');
  const body = { date: (isProtocol||dateOpen) ? null : date, time: isProtocol ? '' : document.getElementById('ifTime').value, notes: document.getElementById('ifNotes').value, title: document.getElementById('ifTitle').value };
  if (!id) body.kind = isProtocol ? 'protocol' : 'points';
  try {
    if (id) await api('PUT','/meeting-instances/'+id, body);
    else await api('POST','/meetings/'+meetingId+'/instances', body);
    closeModal('instanceFormOv');
    await fetchData(); renderMeetings(); toast('Thema gespeichert');
  } catch(e) { toast('Fehler','err'); }
}

async function setInstanceStatus(id, status) {
  if (status === 'done' && !confirm('Thema abschließen? Dies kann später rückgängig gemacht werden.')) return;
  try {
    await api('PUT','/meeting-instances/'+id,{status});
    await fetchData(); renderMeetings();
  } catch(e) { toast('Fehler','err'); }
}

async function generateNextInstance(meetingId) {
  try {
    await api('POST','/meetings/'+meetingId+'/next-instance');
    await fetchData(); renderMeetings(); toast('Nächstes Thema erstellt');
  } catch(e) { toast('Fehler','err'); }
}

const ITEM_STATUS_LABEL = {open:'Zu besprechen',done:'Besprochen',redo:'Nochmal besprechen',delegate:'Delegiert'};

function getDeadlineColor(dueDate) {
  if(!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const daysLeft = Math.ceil((due - now) / (1000*60*60*24));
  if(daysLeft<=1) return '#ef4444'; // red
  if(daysLeft<3) return '#f97316'; // orange
  if(daysLeft<5) return '#eab308'; // yellow
  return null;
}

function getDeadlineColorFromItems(items) {
  // Returns the most urgent deadline color from all open items
  const colors = (items||[]).filter(i=>!i.is_done&&i.due_date).map(i=>getDeadlineColor(i.due_date)).filter(Boolean);
  if(colors.includes('#ef4444')) return '#ef4444';
  if(colors.includes('#f97316')) return '#f97316';
  if(colors.includes('#eab308')) return '#eab308';
  return null;
}

function openItemForm(instanceId, id=null) {
  const allItems = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items));
  const item = id ? allItems.find(x=>x.id===id) : null;
  document.getElementById('itemFormTitle').textContent = item ? 'Punkt bearbeiten' : 'Neuer Besprechungspunkt';
  document.getElementById('itId').value = item?.id||'';
  document.getElementById('itInstanceId').value = instanceId;
  document.getElementById('itTitle').value = item?.title||'';
  document.getElementById('itDesc').value = item?.description||'';
  document.getElementById('itDueDate').value = item?.dueDate?.slice?.(0,10)||'';
  document.getElementById('itMeetingDate').value = item?.meetingDate?.slice?.(0,10)||'';
  document.getElementById('itStatus').value = item?.status||'open';
  document.getElementById('itResult').value = item?.result||'';
  document.getElementById('itLink').value = item?.link||'';
  document.getElementById('itDelegateTo').style.display = (item?.status)==='delegate'?'':'none';
  const delSel = document.getElementById('itDelegatedTo');
  delSel.innerHTML = S.users.map(u=>`<option value="${u.id}"${item?.delegatedTo===u.id?' selected':''}>${esc(lastNameFirst(u.name))}</option>`).join('');
  // Protokoll
  const protoSection = document.getElementById('itProtokollSection');
  const protoEl = document.getElementById('itProtokoll');
  if (item && (item.protokoll||[]).length>0) {
    protoSection.style.display='';
    protoEl.innerHTML = [...(item.protokoll||[])].reverse().map(e=>{
      const u=getU(e.by); const uName=u?lastNameFirst(u.name):'?'; const ts=String(e.ts||'').slice(0,16).replace('T',' ');
      if(e.type==='status') return `<div style="margin-bottom:2px">📝 ${ts} · <b>${uName}</b>: Status geändert → <b>${ITEM_STATUS_LABEL[e.to]||e.to}</b></div>`;
      if(e.type==='linked_status') return `<div style="margin-bottom:2px">🔗 ${ts} · <b>${uName}</b>: In <i>${esc(e.fromMeeting)}</i> Status → <b>${ITEM_STATUS_LABEL[e.to]||e.to}</b></div>`;
      if(e.type==='moved') return `<div style="margin-bottom:2px">➡️ ${ts} · <b>${uName}</b>: Verschoben von <i>${e.fromDate}</i> auf <i>${e.toDate}</i></div>`;
      if(e.type==='copied_to') return `<div style="margin-bottom:2px">📋 ${ts} · <b>${uName}</b>: Kopiert nach <i>${esc(e.toMeeting)}</i></div>`;
      if(e.type==='copied_from') return `<div style="margin-bottom:2px">📋 ${ts} · <b>${uName}</b>: Kopiert aus anderer Besprechung</div>`;
      if(e.type==='content_synced') return `<div style="margin-bottom:2px">🔄 ${ts} · Inhalt aktualisiert aus <i>${esc(e.fromMeeting)}</i></div>`;
      if(e.type==='unlinked') return `<div style="margin-bottom:2px">🔓 ${ts} · <b>${uName}</b>: Verknüpfung aufgehoben</div>`;
      if(e.type==='converted_to_ticket') return `<div style="margin-bottom:2px">🎫 ${ts} · <b>${uName}</b>: In Ticket <b>${esc(e.ticketNumber||'?')}</b> umgewandelt</div>`;
      return '';
    }).join('');
  } else { protoSection.style.display='none'; }
  // Move/Copy/Unlink buttons (only when editing, only for meeting creators/managers)
  const meeting = S.meetings.find(m=>m.instances.some(i=>i.id===instanceId));
  const canMng = meeting?._canManage||false;
  document.getElementById('itUnlinkBtn').style.display = (item && item.groupId && canMng) ? '' : 'none';
  document.getElementById('itDeleteBtn').style.display = (item && canMng && item.status!=='done') ? '' : 'none';
  const moreSel = document.getElementById('itMoreActions');
  const moreOpts = [];
  if (item && canMng) {
    moreOpts.push('<option value="move">➡ In andere Besprechung verschieben</option>');
    moreOpts.push('<option value="copy">📋 In andere Besprechung kopieren (verknüpft)</option>');
    if (!item.convertedTicketId) moreOpts.push('<option value="convert">🎫 In Ticket umwandeln</option>');
  }
  moreSel.innerHTML = '<option value="">Weitere Aktion…</option>' + moreOpts.join('');
  moreSel.style.display = moreOpts.length ? '' : 'none';
  const convertedInfo = document.getElementById('itConvertedInfo');
  if (item && item.convertedTicketId) {
    const tk = getTk(item.convertedTicketId);
    const byUser = item.convertedBy ? getU(item.convertedBy) : null;
    convertedInfo.style.display = '';
    convertedInfo.innerHTML = `🎫 Umgewandelt in Ticket ${tk?`<a href="javascript:void(0)" onclick="openTkDetail('${item.convertedTicketId}')" style="font-weight:600">${tk.number}</a>`:'(nicht einsehbar)'}${byUser?` von ${esc(lastNameFirst(byUser.name))}`:''}${item.convertedAt?' · '+String(item.convertedAt).slice(0,16).replace('T',' '):''}`;
  } else {
    convertedInfo.style.display = 'none';
  }
  document.getElementById('itPartUser').innerHTML = S.users.map(u=>`<option value="${u.id}">${esc(lastNameFirst(u.name))}</option>`).join('');
  renderItemParticipants(item?.participants||[]);
  const fbtn = document.getElementById('itFollowupBtn');
  fbtn.style.display = (item && item.status==='done') ? '' : 'none';
  if (item) fbtn.onclick = ()=>openFollowupForm(item.id);
  document.getElementById('itStatus').onchange = function(){
    document.getElementById('itDelegateTo').style.display = this.value==='delegate'?'':'none';
  };
  openModal('itemFormOv');
}

function renderItemParticipants(parts) {
  const roleLabel={required:'Pflicht',invited:'Eingeladen',informed:'Info'};
  document.getElementById('itParticipantsList').innerHTML = parts.map(p=>{
    const u=getU(p.userId); if(!u) return '';
    return`<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg2);border-radius:12px;padding:2px 8px;font-size:12px" data-user-id="${p.userId}" data-role="${p.role}">
      <span class="av-sm" style="background:${u.color}">${esc(u.initials)}</span>${esc(lastNameFirst(u.name))}
      <span style="color:var(--mu);font-size:10px">${roleLabel[p.role]||p.role}</span>
      <button style="border:none;background:none;cursor:pointer;color:var(--mu);padding:0 2px;font-size:13px" onclick="removeItemParticipantForm('${p.userId}')">&#215;</button>
    </span>`;
  }).join('');
}

function addItemParticipantForm() {
  const userId = document.getElementById('itPartUser').value;
  const role = document.getElementById('itPartRole').value;
  const list = document.getElementById('itParticipantsList');
  const existing = list.querySelector(`[data-user-id="${userId}"]`);
  if (existing) return;
  const u = getU(userId); if (!u) return;
  const roleLabel={required:'Pflicht',invited:'Eingeladen',informed:'Info'};
  const span = document.createElement('span');
  span.style.cssText='display:inline-flex;align-items:center;gap:4px;background:var(--bg2);border-radius:12px;padding:2px 8px;font-size:12px';
  span.dataset.userId = userId;
  span.dataset.role = role;
  span.innerHTML=`<span class="av-sm" style="background:${u.color}">${esc(u.initials)}</span>${esc(lastNameFirst(u.name))}<span style="color:var(--mu);font-size:10px">${roleLabel[role]||role}</span><button style="border:none;background:none;cursor:pointer;color:var(--mu);padding:0 2px;font-size:13px" onclick="this.parentElement.remove()">&#215;</button>`;
  list.appendChild(span);
}

function removeItemParticipantForm(userId) {
  const list = document.getElementById('itParticipantsList');
  const spans = list.querySelectorAll('[data-user-id]');
  spans.forEach(s=>{ if(s.dataset.userId===userId) s.remove(); });
}

async function submitItemForm() {
  const id = document.getElementById('itId').value;
  const instanceId = document.getElementById('itInstanceId').value;
  const title = document.getElementById('itTitle').value.trim();
  if (!title) return toast('Titel erforderlich','err');
  const status = document.getElementById('itStatus').value;
  const partEls = document.getElementById('itParticipantsList').children;
  const participants = [];
  for (const el of partEls) {
    if (el.dataset.userId) participants.push({userId:el.dataset.userId, role:el.dataset.role||'required'});
  }
  const body = {
    title, description: document.getElementById('itDesc').value.trim(),
    status, dueDate: document.getElementById('itDueDate').value||null,
    meetingDate: document.getElementById('itMeetingDate').value||null,
    delegatedTo: status==='delegate'?document.getElementById('itDelegatedTo').value:null,
    result: document.getElementById('itResult').value.trim(),
    link: document.getElementById('itLink').value||null,
    participants,
  };
  try {
    if (id) {
      await api('PUT','/discussion-items/'+id, body);
      if (participants.length > 0) {
        const existing = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items)).find(x=>x.id===id);
        for (const p of (existing?.participants||[])) {
          await api('DELETE',`/discussion-items/${id}/participants/${p.userId}`).catch(()=>{});
        }
        for (const p of participants) {
          await api('POST',`/discussion-items/${id}/participants`, p).catch(()=>{});
        }
      }
    } else {
      await api('POST','/meeting-instances/'+instanceId+'/items', body);
    }
    closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('Gespeichert');
  } catch(e) { toast('Fehler','err'); }
}

async function openFollowupForm(itemId) {
  const allItems = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items));
  const item = allItems.find(x=>x.id===itemId);
  if (!item) return;
  const instId = S._selInstance;
  if (!instId) return toast('Bitte erst Thema auswählen','err');
  const dueDate = prompt('Fällig bis (YYYY-MM-DD, optional):');
  try {
    await api('POST',`/discussion-items/${itemId}/followup`, {instanceId: instId, dueDate: dueDate||null});
    closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('Folgebesprechung erstellt');
  } catch(e) { toast('Fehler','err'); }
}

async function deleteInstance(instanceId) {
  if (!confirm('Thema und alle Punkte löschen?')) return;
  try {
    await api('DELETE','/meeting-instances/'+instanceId);
    S._selInstance = null;
    await fetchData(); renderMeetings(); toast('Thema gelöscht');
  } catch(e) { toast('Fehler','err'); }
}

// ── PROTOKOLLE (Protokolltermine) ────────────────────────────────────────────
// Externe Teilnehmer (keine Benutzerkonten) werden im selben attendees-Array
// wie die internen User-IDs gespeichert, aber mit "ext:"-Präfix markiert —
// so bleibt das Feld ein einfaches String-Array und alle bestehenden Stellen,
// die attendees als User-IDs lesen, müssen nur diesen Präfix herausfiltern.
const EXT_ATTENDEE_PREFIX = 'ext:';
function protoExtAttendeesChipsHtml(names) {
  return names.map((n,idx)=>`<span data-ext-name="${esc(n)}" style="display:inline-flex;align-items:center;gap:4px;background:var(--bg2);border-radius:12px;padding:2px 8px;font-size:12px">
    <span class="av-sm" style="background:#64748b">${esc(n.slice(0,2).toUpperCase())}</span>${esc(n)}
    <button style="border:none;background:none;cursor:pointer;color:var(--mu);padding:0 2px;font-size:13px" onclick="this.parentElement.remove()">&#215;</button>
  </span>`).join('');
}
function addProtoExternalAttendee() {
  const inp = document.getElementById('pfExtAttendeeInput');
  const name = inp.value.trim();
  if (!name) return;
  const list = document.getElementById('pfExtAttendeesList');
  if ([...list.children].some(el=>el.dataset.extName===name)) { inp.value=''; return; }
  list.insertAdjacentHTML('beforeend', protoExtAttendeesChipsHtml([name]));
  inp.value = '';
  inp.focus();
}
function openProtocolForm(instanceId, id=null) {
  const inst = S.meetings.flatMap(m=>m.instances).find(i=>i.id===instanceId);
  const proto = id ? (inst?.protocols||[]).find(p=>p.id===id) : null;
  document.getElementById('protoFormTitle').textContent = proto ? 'Protokoll bearbeiten' : 'Neues Protokoll';
  document.getElementById('pfId').value = proto?.id||'';
  document.getElementById('pfInstanceId').value = instanceId;
  document.getElementById('pfTitle').value = proto?.title||'';
  document.getElementById('pfDate').value = proto?.date?.slice?.(0,10)||'';
  document.getElementById('pfTime').value = proto?.time||'';
  document.getElementById('pfLocation').value = proto?.location||'';
  document.getElementById('pfBody').value = proto?.body||'';
  const allAtt = proto?.attendees||[];
  const attSel = document.getElementById('pfAttendees');
  attSel.innerHTML = S.users.slice().sort(byLastName).map(u=>`<option value="${u.id}"${allAtt.includes(u.id)?' selected':''}>${esc(lastNameFirst(u.name))}</option>`).join('');
  const extNames = allAtt.filter(a=>a.startsWith(EXT_ATTENDEE_PREFIX)).map(a=>a.slice(EXT_ATTENDEE_PREFIX.length));
  document.getElementById('pfExtAttendeesList').innerHTML = protoExtAttendeesChipsHtml(extNames);
  document.getElementById('pfExtAttendeeInput').value = '';
  document.getElementById('pfReleased').checked = !!proto?.released;
  document.getElementById('protoDeleteBtn').style.display = proto ? '' : 'none';
  openModal('protoFormOv');
}
async function submitProtocolForm() {
  const id = document.getElementById('pfId').value;
  const instanceId = document.getElementById('pfInstanceId').value;
  const title = document.getElementById('pfTitle').value.trim();
  if (!title) return toast('⚠️ Überschrift erforderlich','err');
  const extNames = [...document.getElementById('pfExtAttendeesList').children].map(el=>el.dataset.extName).filter(Boolean);
  const attendees = Array.from(document.getElementById('pfAttendees').selectedOptions).map(o=>o.value)
    .concat(extNames.map(n=>EXT_ATTENDEE_PREFIX+n));
  const body = {
    title, date: document.getElementById('pfDate').value || null, time: document.getElementById('pfTime').value,
    location: document.getElementById('pfLocation').value.trim(), attendees, body: document.getElementById('pfBody').value,
    released: document.getElementById('pfReleased').checked,
  };
  try {
    if (id) await api('PUT','/meeting-protocols/'+id, body);
    else await api('POST','/meeting-instances/'+instanceId+'/protocols', body);
    closeModal('protoFormOv');
    await fetchData(); renderMeetings(); toast('✅ Protokoll gespeichert');
  } catch(e) { toast('⚠️ '+e.message,'err'); }
}
async function deleteProtocol(id) {
  id = id || document.getElementById('pfId').value;
  if (!id) return;
  if (!confirm('Protokoll löschen?')) return;
  try {
    await api('DELETE','/meeting-protocols/'+id);
    closeModal('protoFormOv');
    await fetchData(); renderMeetings(); toast('✅ Protokoll gelöscht');
  } catch(e) { toast('⚠️ '+e.message,'err'); }
}

function handleItemMoreAction(action) {
  const sel = document.getElementById('itMoreActions');
  if (!action) return;
  if (action==='move') openMoveItemModal();
  else if (action==='copy') openCopyItemModal();
  else if (action==='convert') openConvertMeetingItem(document.getElementById('itId').value);
  sel.value = '';
}
function openMoveItemModal() {
  const itemId = document.getElementById('itId').value;
  if (!itemId) return;
  const allItems = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items));
  const item = allItems.find(x=>x.id===itemId);
  if (!item) return;
  const currentMeeting = S.meetings.find(m=>m.instances.some(i=>i.id===item.instanceId));
  if (!currentMeeting) return;
  document.getElementById('moveItemId').value = itemId;
  const mSel = document.getElementById('moveItemMeeting');
  mSel.innerHTML = S.meetings.map(m=>`<option value="${m.id}"${m.id===currentMeeting.id?' selected':''}>${esc(m.title)}</option>`).join('');
  onMoveMeetingChange();
  openModal('moveItemOv');
}

function onMoveMeetingChange() {
  const itemId = document.getElementById('moveItemId').value;
  const allItems = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items));
  const item = allItems.find(x=>x.id===itemId);
  const meetingId = document.getElementById('moveItemMeeting').value;
  const meeting = S.meetings.find(m=>m.id===meetingId);
  const instSel = document.getElementById('moveItemInstance');
  const otherInsts = (meeting?.instances||[]).filter(i=>i.id!==item?.instanceId);
  if (!otherInsts.length) {
    instSel.innerHTML = '<option value="">— Keine anderen Themen —</option>';
  } else {
    const stLabel = {planned:'Geplant',done:'Abgeschlossen',cancelled:'Abgesagt'};
    instSel.innerHTML = otherInsts.map(i=>`<option value="${i.id}">${i.title?esc(i.title)+' · ':''}${i.date?fmtDate(i.date):'Datum offen'} ${i.time||''} (${stLabel[i.status]||i.status})</option>`).join('');
  }
}

async function submitMoveItem() {
  const itemId = document.getElementById('moveItemId').value;
  const targetInstanceId = document.getElementById('moveItemInstance').value;
  if (!itemId || !targetInstanceId) return;
  try {
    await api('POST',`/discussion-items/${itemId}/move`,{targetInstanceId});
    closeModal('moveItemOv'); closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('Punkt verschoben');
  } catch(e) { toast('Fehler beim Verschieben','err'); }
}

function openCopyItemModal() {
  const itemId = document.getElementById('itId').value;
  if (!itemId) return;
  const allItems = S.meetings.flatMap(m=>m.instances.flatMap(i=>i.items));
  const item = allItems.find(x=>x.id===itemId);
  if (!item) return;
  const currentMeeting = S.meetings.find(m=>m.instances.some(i=>i.id===item.instanceId));
  document.getElementById('copyItemId').value = itemId;
  const mSel = document.getElementById('copyItemMeeting');
  mSel.innerHTML = S.meetings.filter(m=>m.id!==currentMeeting?.id).map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join('');
  onCopyMeetingChange();
  openModal('copyItemOv');
}

function onCopyMeetingChange() {
  const mId = document.getElementById('copyItemMeeting').value;
  const meeting = S.meetings.find(m=>m.id===mId);
  const iSel = document.getElementById('copyItemInstance');
  const insts = (meeting?.instances||[]).filter(i=>i.status==='planned');
  if (!insts.length) {
    iSel.innerHTML = '<option value="">— Kein geplantes Thema —</option>';
  } else {
    iSel.innerHTML = insts.map(i=>`<option value="${i.id}">${i.date?fmtDate(i.date):'Datum offen'} ${i.time||''}</option>`).join('');
  }
}

async function submitCopyItem() {
  const itemId = document.getElementById('copyItemId').value;
  const targetInstanceId = document.getElementById('copyItemInstance').value;
  if (!itemId || !targetInstanceId) return toast('Bitte ein Thema auswählen','err');
  try {
    await api('POST',`/discussion-items/${itemId}/copy-to-meeting`,{targetInstanceId});
    closeModal('copyItemOv'); closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('Punkt kopiert und verknüpft');
  } catch(e) { toast('Fehler beim Kopieren','err'); }
}

async function unlinkItem() {
  const itemId = document.getElementById('itId').value;
  if (!itemId) return;
  if (!confirm('Verknüpfung zu den anderen Kopien aufheben? Künftige Änderungen werden nicht mehr synchronisiert.')) return;
  try {
    await api('POST',`/discussion-items/${itemId}/unlink`);
    closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('Verknüpfung aufgehoben');
  } catch(e) { toast('Fehler','err'); }
}

// ── KI-VORSCHLÄGE ────────────────────────────────────────────────────────
// Durchsucht bestehende Tickets nach ähnlichen, bereits gelösten Problemen
// UND das Internet (Web-Suche serverseitig über die Anthropic-API) — jeder
// Vorschlag kommt mit einer geprüften Quellenangabe zurück (Ticket-Nummer
// oder echte URL), nichts wird ohne Beleg vorgeschlagen.
// Für Ticket/Todo: Titel/Beschreibung sicher aus dem State per id nachschlagen
// statt sie (per JSON.stringify) direkt in ein onclick-Attribut zu schreiben —
// das hätte das Attribut an den ersten " in der Ausgabe abgeschnitten und
// sowohl den Button als auch das benachbarte Beschreibungsfeld zerschossen.
function openAiSuggestionsFor(type,id){
  let item;
  if(type==='Ticket') item=(S.tickets||[]).find(t=>t.id===id);
  else if(type==='Todo') item=(S.todos||[]).find(t=>t.id===id);
  if(!item){toast('⚠️ Eintrag nicht gefunden','err');return;}
  openAiSuggestions(type,item.title,item.description||'',id);
}
async function openAiSuggestions(type,title,description,id){
  openModal('aiSuggestOv');
  const body=document.getElementById('aiSuggestBody');
  body.innerHTML=`<div style="text-align:center;padding:30px 10px">
    <div class="spinner" style="margin:0 auto 12px"></div>
    <div style="font-size:13px;color:var(--mu)">Durchsuche alte Tickets und das Internet nach Lösungen… (kann bis zu einer Minute dauern)</div>
  </div>`;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),60000);
  try{
    const res=await fetch('/api/ai/suggest',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,title,description,id}),signal:ctrl.signal});
    clearTimeout(timer);
    if(res.status===401){_handleSessionExpired();throw new Error('Sitzung abgelaufen');}
    const data=await res.json();
    if(!data.success)throw new Error(data.error||'Fehler');
    renderAiSuggestions(data.data);
  }catch(e){
    clearTimeout(timer);
    const msg=e.name==='AbortError'?'KI-Suche hat zu lange gedauert (Zeitlimit 60s) — bitte erneut versuchen':e.message;
    body.innerHTML=`<div style="color:var(--danger);font-size:13px;padding:12px">⚠️ ${esc(msg)}</div>`;
  }
}
function aiSuggestionCardHtml(s){
  const isTicket=/^Ticket\s/i.test(s.source||'');
  const isNet=!isTicket&&(/internet/i.test(s.source||'')||s.sourceUrl);
  const badgeColor=isTicket?'#3b6dd4':isNet?'#7c3aed':'#64748b';
  const badgeText=isTicket?(s.source||'Ticket'):isNet?'Internet':(s.source||'Quelle unbekannt');
  const srcLink=isNet&&s.sourceUrl?`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:${badgeColor};text-decoration:none;word-break:break-all">${esc(s.sourceUrl)}</a>`
    :isTicket?`<a href="javascript:void(0)" onclick="_openTicketByNumber('${esc((s.source||'').replace(/^Ticket\s*/i,'').trim())}')" style="font-size:11px;color:${badgeColor};text-decoration:none">${esc(s.source)} öffnen →</a>`
    :'';
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
      <div style="font-weight:600;font-size:13px">${esc(s.title||'Vorschlag')}</div>
      <span class="bdg" style="font-size:10px;flex-shrink:0;background:${badgeColor}1f;color:${badgeColor}">${isNet?'🌐 ':isTicket?'🎫 ':'ℹ️ '}${esc(badgeText)}</span>
    </div>
    <div style="font-size:12px;color:var(--tx);line-height:1.5;white-space:pre-wrap">${esc(s.text||'')}</div>
    ${srcLink?`<div style="margin-top:6px">${srcLink}</div>`:''}
  </div>`;
}
function renderAiSuggestions(data){
  const body=document.getElementById('aiSuggestBody');
  const sugg=data.suggestions||[];
  if(!sugg.length){
    body.innerHTML=`<div style="color:var(--mu);font-size:13px;padding:12px">${esc(data.summary||'Keine Vorschläge gefunden.')}</div>`;
    return;
  }
  body.innerHTML=(data.summary?`<div style="font-size:12px;color:var(--mu);margin-bottom:12px;padding:8px 10px;background:var(--sf2);border-radius:6px">${esc(data.summary)}</div>`:'')
    +sugg.map(aiSuggestionCardHtml).join('');
}
// Zeigt das Ergebnis der automatischen Hintergrundsuche (ausgelöst beim
// Anlegen) direkt im jeweiligen Formular/Detail an — akzeptiert sowohl
// camelCase (Ticket/Besprechungspunkt) als auch die rohen snake_case-Felder
// (Todo, da dessen Datensatz ungemappt durchgereicht wird).
function aiInlinePanelHtml(item){
  const status=item?.aiStatus||item?.ai_status||null;
  const result=item?.aiResult||item?.ai_result||null;
  if(!status) return '';
  if(status==='pending') return `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--sf2);border:1px solid var(--border);border-radius:8px;margin-top:10px">
    <div class="spinner" style="width:16px;height:16px;flex-shrink:0"></div>
    <div style="font-size:12px;color:var(--mu)">🤖 KI durchsucht automatisch nach Lösungen…</div>
  </div>`;
  if(status==='error') return `<div style="padding:10px 12px;background:var(--sf2);border:1px solid var(--border);border-radius:8px;margin-top:10px;font-size:12px;color:var(--danger)">⚠️ ${esc(result?.error||'KI-Suche fehlgeschlagen')}</div>`;
  if(status==='done'){
    const sugg=result?.suggestions||[];
    if(!sugg.length) return `<div style="padding:10px 12px;background:var(--sf2);border:1px solid var(--border);border-radius:8px;margin-top:10px;font-size:12px;color:var(--mu)">🤖 ${esc(result?.summary||'Keine passenden Vorschläge gefunden.')}</div>`;
    return `<div style="margin-top:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:6px">🤖 KI-VORSCHLÄGE</div>
      ${result.summary?`<div style="font-size:12px;color:var(--mu);margin-bottom:8px;padding:8px 10px;background:var(--sf2);border-radius:6px">${esc(result.summary)}</div>`:''}
      ${sugg.map(aiSuggestionCardHtml).join('')}
    </div>`;
  }
  return '';
}
function _openTicketByNumber(number){
  const tk=(S.tickets||[]).find(t=>t.number===number);
  if(!tk){toast('⚠️ Ticket '+number+' nicht gefunden (evtl. keine Berechtigung oder gelöscht)','err');return;}
  closeModal('aiSuggestOv');
  openTkDetail(tk.id);
}

async function deleteMeetingItem() {
  const itemId = document.getElementById('itId').value;
  if (!itemId) return;
  if (!confirm('Besprechungspunkt endgültig löschen?')) return;
  try {
    await api('DELETE',`/discussion-items/${itemId}`);
    closeModal('itemFormOv');
    await fetchData(); renderMeetings(); toast('✅ Punkt gelöscht');
  } catch(e) { toast('⚠️ '+e.message,'err'); }
}

// Returns a readable text color for a given hex background color
function dpTextColor(hex) {
  if (!hex || hex.length < 7) return '#333';
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  // Perceived luminance (0–1)
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  if (lum > 0.55) {
    // Light color → darken significantly for readable text
    return `#${[r,g,b].map(c=>Math.max(0,Math.floor(c*0.40)).toString(16).padStart(2,'0')).join('')}`;
  }
  return hex;
}

const MONTH_NAMES=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WD_SHORT=['So','Mo','Di','Mi','Do','Fr','Sa'];

function renderDP() {
  const el = document.getElementById('main');
  if (!el) return;

  const plans = S.dpPlans;
  const activePlan = plans.find(p => p.id === S._dpPlanId) || plans[0] || null;
  if (activePlan && !S._dpPlanId) S._dpPlanId = activePlan.id;

  const canEdit = S.p.canManageDp;

  let planOpts = plans.map(p =>
    `<option value="${p.id}"${p.id===S._dpPlanId?' selected':''}>${esc(p.title||p.month+'/'+p.year)} (${p.status})</option>`
  ).join('');

  const statusLabel = {draft:'Entwurf',reviewed:'Reviewed',published:'Freigegeben'};
  const statusColor = {draft:'var(--mu)',reviewed:'#f59e0b',published:'#10b981'};
  const st = activePlan?.status||'draft';

  el.innerHTML = `<div class="dp-wrap">
    <div class="dp-toolbar">
      <h2>📅 Dienstplanung</h2>
      <select style="max-width:260px" onchange="S._dpPlanId=this.value;S._dpMatrix=null;renderDP()">${planOpts}${plans.length===0?'<option value="">-- Kein Plan --</option>':''}</select>
      ${activePlan?`<span style="color:${statusColor[st]};font-weight:600;font-size:12px">${statusLabel[st]}</span>`:''}
      <div style="flex:1"></div>
      ${canEdit?`<button class="btn-s" onclick="openDpPlanForm()">+ Neuer Plan</button>`:''}
      ${canEdit&&activePlan&&st!=='published'?`<button class="btn-s" onclick="generateDpPlan('${activePlan.id}')">⚡ Auto-Generieren</button>`:''}
      ${canEdit&&activePlan&&st!=='published'?`<button class="btn-s" style="color:#ef4444" onclick="dpResetPlan()">↺ Zurücksetzen</button>`:''}
      ${canEdit&&activePlan?`<button class="btn-s" onclick="dpSaveVersion()">💾 Version speichern</button>`:''}
      ${canEdit&&activePlan?`<button class="btn-s" onclick="dpShowVersions()">🕐 Versionen</button>`:''}
      ${canEdit&&activePlan&&st!=='published'?`<button class="btn-p" onclick="publishDpPlan('${activePlan.id}')">✓ Freigeben</button>`:''}
      ${canEdit&&activePlan&&st!=='published'?`<button class="btn-s" style="color:#ef4444" onclick="deleteDpPlan('${activePlan.id}')">🗑 Plan löschen</button>`:''}
    </div>
    <div id="dpMatrixContainer" style="flex:1;overflow:auto">
      ${activePlan ? '<div style="padding:20px;color:var(--mu)">Lade Matrix…</div>' : '<div style="padding:20px;color:var(--mu)">Kein Plan vorhanden. Erstelle zuerst einen Plan.</div>'}
    </div>
  </div>`;

  if (activePlan) {
    loadDpMatrix(activePlan.id);
  }
}

async function loadDpMatrix(planId) {
  try {
    const data = await api('GET', '/dp/plans/'+planId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
  } catch(e) {
    const c = document.getElementById('dpMatrixContainer');
    if (c) c.innerHTML = `<div style="padding:20px;color:#ef4444">Fehler beim Laden: ${esc(e.message)}</div>`;
  }
}

function renderDPMatrix(data) {
  const c = document.getElementById('dpMatrixContainer');
  if (!c) return;

  const {plan, days, shiftTypes, absenceTypes, requirements, openSlots, empAssignMap, summary, allEmpIds, wishDaySet} = data;
  const wishSet = new Set(wishDaySet || []);
  const users = S.users;
  const canEdit = S.p.canManageDp;

  const today = new Date().toISOString().slice(0,10);

  // Build employees list: alle mit Parametern (allEmpIds) + alle mit Einträgen
  const empIds = new Set(allEmpIds || []);
  Object.keys(empAssignMap).forEach(id => empIds.add(id));
  data.assignments?.forEach(a => empIds.add(a.employee_id));
  // Mitarbeiter ohne Dienstverhältnis im Planmonat ausblenden — außer sie
  // haben tatsächlich Einträge in diesem Monat (historische Daten bleiben
  // immer sichtbar, nur das reine "wählbar für neue Zuweisungen" verschwindet).
  const assignedIds = new Set(Object.keys(empAssignMap || {}));
  data.assignments?.forEach(a => assignedIds.add(a.employee_id));
  let emps = [...empIds].map(id => users.find(u => u.id === id)).filter(Boolean);
  if (plan?.month && plan?.year) {
    emps = emps.filter(u => assignedIds.has(u.id) || isUserActiveInMonth(u, plan.year, plan.month));
  }
  emps.sort((a,b) => a.name.localeCompare(b.name));

  // Stats columns: Soll, Ist, Diff, Zulage, WE, FWE, K, U
  const statsBasic = ['Soll','Ist','Diff'];
  const statsExtra = ['Zulage','WE','FWE','K','U'];

  const expanded = S._dpStatsExpanded;

  // Build header
  let thDays = days.map(d => {
    let cls = 'dp-cell';
    if (d.date === today) cls += ' dp-th-today';
    else if (d.isHoliday) cls += ' dp-th-holiday';
    else if (d.isWeekend) cls += ' dp-th-weekend';
    return `<th class="${cls}" title="${d.isHoliday?d.holidayName:''}">${d.date.slice(8)}<br><span style="font-size:10px;font-weight:400">${WD_SHORT[d.weekday]}</span></th>`;
  }).join('');

  const statsToggle = `<th colspan="${statsBasic.length}" style="background:var(--bg2);padding:2px">
    <div style="display:flex;align-items:center;justify-content:center;gap:4px">
      <span>Stats</span>
      <button class="dp-stat-toggle-btn" onclick="S._dpStatsExpanded=!S._dpStatsExpanded;renderDPMatrix(S._dpMatrix)">${expanded?'◀':'▶'}</button>
    </div>
  </th>
  ${expanded ? statsExtra.map(s=>`<th style="background:var(--bg2);padding:4px 6px;font-size:11px">${s}</th>`).join('') : ''}`;

  // Only show shift types that have at least one requirement defined in this month
  const stWithRequirements = shiftTypes.filter(st =>
    days.some(d => (requirements[d.date]?.[st.id] || 0) > 0)
  );

  let openRows = stWithRequirements.map(st => {
    let cells = days.map(d => {
      const required = requirements[d.date]?.[st.id] || 0;
      if (required === 0) {
        // Keine Anforderung – aber es könnten Dienste zugewiesen sein (Überplanung)
        const filled = (Object.entries(empAssignMap).filter(([empId, dateMap]) =>
          dateMap[d.date] && dateMap[d.date].shift_type_id === st.id && !dateMap[d.date].absence_type_id
        ).length);
        if (filled > 0) {
          return `<td style="background:#fbbf2422;color:#78350f;font-weight:bold;text-align:center;padding:3px 4px;cursor:default" title="Überplanung: ${filled} statt 0">+${filled}</td>`;
        }
        return `<td style="background:var(--bg2)"></td>`;
      }
      const open = openSlots[d.date]?.[st.id] || 0;
      if (open > 0) {
        return `<td class="dp-cell-open" title="${esc(st.name)}: ${open} offen">-${open}</td>`;
      }
      if (open === 0) {
        return `<td class="dp-cell-ok" title="Besetzt (${required}/${required})">✓</td>`;
      }
      // open < 0: zu viele Dienste eingetragen
      const overbooking = Math.abs(open);
      const filled = required + overbooking;
      return `<td style="background:#fbbf2422;color:#78350f;font-weight:bold;text-align:center;padding:3px 4px;cursor:default" title="Zu viele: ${filled} statt ${required}">+${overbooking}</td>`;
    }).join('');
    return `<tr class="dp-open-row">
      <td class="dp-row-label"><span class="dp-color-dot" style="background:${st.color}"></span> ${esc(st.code)}</td>
      ${cells}
      <td colspan="${statsBasic.length + (expanded?statsExtra.length:0)}" style="background:var(--bg2)"></td>
    </tr>`;
  }).join('');

  // Build employee rows grouped by category
  const grouped = {};
  for (const emp of emps) {
    const cat = emp.category || '(ohne Kategorie)';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(emp);
  }

  const buildEmpRow = (emp) => {
    const s = summary[emp.id] || {};
    const assign = empAssignMap[emp.id] || {};

    let cells = days.map(d => {
      const a = assign[d.date];
      const isWish = wishSet.has(`${emp.id}_${d.date}`);
      const dayCls = d.isHoliday ? ' dp-th-holiday' : (d.isWeekend ? ' dp-th-weekend' : (d.date === today ? ' dp-th-today' : ''));
      if (!a) {
        const wishMark = isWish ? `<span style="font-size:9px;color:#f59e0b;line-height:1">★</span>` : '';
        const wishTitle = isWish ? 'Wunschtag · ' : '';
        const wishStyle = isWish ? 'background:#fef3c722;' : '';
        if (canEdit) return `<td id="dpc_${emp.id}_${d.date}" class="dp-cell${dayCls}" onclick="dpCellClick('${emp.id}','${d.date}',event)" title="${wishTitle}Klicken zum Zuweisen"${wishStyle?` style="${wishStyle}"`:''} >${wishMark}</td>`;
        return `<td class="dp-cell${dayCls}"${wishStyle?` style="${wishStyle}"`:''} >${wishMark}</td>`;
      }
      const st = shiftTypes.find(x=>x.id===a.shift_type_id);
      const at = absenceTypes.find(x=>x.id===a.absence_type_id);
      // Wenn Abwesenheit UND Dienst vorhanden: Abwesenheit groß, Dienst klein darunter
      const label = at
        ? `${esc(at.code)}${st ? `<br><span style="font-size:9px;opacity:0.65;font-weight:400">${esc(st.code)}</span>` : ''}`
        : (st ? esc(st.code) : '?');
      const color = at ? at.color : (st ? st.color : '#ccc');
      const title = [at?.label, st?.name].filter(Boolean).join(' + ');
      const style = `background:${color}22;color:${dpTextColor(color)};font-weight:700;line-height:1.1`;
      if (canEdit) {
        return `<td id="dpc_${emp.id}_${d.date}" class="dp-cell" style="${style}" onclick="dpCellClick('${emp.id}','${d.date}',event)" title="${esc(title)}">${label}</td>`;
      }
      return `<td class="dp-cell" style="${style}" title="${esc(title)}">${label}</td>`;
    }).join('');

    // Ist = Dienststunden + Abwesenheits-Gutschriften (beide zählen zur Sollerfüllung)
    const shiftH   = s.shiftHours   || 0;
    const absH     = s.absenceHours || 0;
    const holH     = s.holidayHours || 0;
    const istHours = shiftH + absH;
    const diff = istHours - (s.targetHours||0);
    const diffStr = (diff>=0?'+':'')+Math.round(diff*10)/10;
    const diffColor = diff > 0.5 ? '#f59e0b' : (diff < -0.5 ? '#ef4444' : '#10b981');
    const nonHolAbs = Math.round((absH - holH)*10)/10;
    const istTitle = absH > 0
      ? `Dienste: ${Math.round(shiftH*10)/10}h` +
        (holH > 0 ? ` · Feiertage: ${Math.round(holH*10)/10}h` : '') +
        (nonHolAbs > 0 ? ` · Abwesenheit: ${nonHolAbs}h` : '') +
        ` = Gesamt: ${Math.round(istHours*10)/10}h`
      : `Dienststunden: ${Math.round(shiftH*10)/10}h`;

    const basicStats = `
      <td style="text-align:center;padding:3px 6px;font-size:12px" title="Vertragliches Monatssoll: ${s.targetHours||0}h">${s.targetHours||0}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px;cursor:default" title="${esc(istTitle)}">${Math.round(istHours*10)/10}${absH>0?`<span style="font-size:9px;color:var(--mu);opacity:0.6"> (${Math.round(shiftH*10)/10}+${Math.round(absH*10)/10})</span>`:''}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px;color:${diffColor};font-weight:600" title="Differenz Ist − Soll">${diffStr}</td>`;

    const extraStats = expanded ? `
      <td style="text-align:center;padding:3px 6px;font-size:12px">${s.zulageDays||0}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px">${s.weekendDays||0}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px">${s.freeWeekends||0}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px">${s.sickDays||0}</td>
      <td style="text-align:center;padding:3px 6px;font-size:12px">${s.vacationDays||0}</td>` : '';

    return `<tr>
      <td class="dp-row-label">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="av-sm" style="background:${emp.color}">${esc(emp.initials)}</span>
          <span>${esc(lastNameFirst(emp.name))}</span>
        </div>
      </td>
      ${cells}${basicStats}${extraStats}
    </tr>`;
  };

  const catOrder = {};
  (S.dpEmpCategories||[]).forEach((c,i) => { catOrder[c.name] = c.sort_order ?? i; });
  catOrder['(ohne Kategorie)'] = 99999;
  const sortedCats = Object.keys(grouped).sort((a,b) => (catOrder[a]??9999) - (catOrder[b]??9999) || a.localeCompare(b));
  let empRows = sortedCats.map(cat => {
    const empList = grouped[cat].sort((a, b) => a.name.split(' ').pop().localeCompare(b.name.split(' ').pop(), 'de'));
    const catId = 'dpcat_' + cat.replace(/\W/g, '_');
    const isExpanded = S._dpCategoryExpanded?.[catId] ?? true;
    const colSpan = days.length + 1 + statsBasic.length + (expanded?statsExtra.length:0);

    let html = `<tr style="cursor:pointer;background:var(--sf2);font-weight:600" onclick="S._dpCategoryExpanded=S._dpCategoryExpanded||{}; S._dpCategoryExpanded['${catId}'] = !S._dpCategoryExpanded['${catId}']; renderDPMatrix(S._dpMatrix)">
      <td colspan="${colSpan}" style="padding:8px 12px;display:flex;align-items:center;gap:8px">
        <span>${isExpanded?'▼':'▶'}</span>
        <span>${esc(cat)} (${empList.length})</span>
      </td>
    </tr>`;

    if (isExpanded) {
      html += empList.map(emp => buildEmpRow(emp)).join('');
    }

    return html;
  }).join('');

  // Stats header row
  const statsHeader = statsBasic.map(s=>`<th style="background:var(--bg2);padding:4px 6px;font-size:11px">${s}</th>`).join('')
    + (expanded ? statsExtra.map(s=>`<th style="background:var(--bg2);padding:4px 6px;font-size:11px">${s}</th>`).join('') : '');

  c.innerHTML = `<table class="dp-matrix">
    <thead>
      <tr>
        <th class="dp-row-label">${esc(plan.title||plan.month+'/'+plan.year)}</th>
        ${thDays}
        ${statsToggle}
      </tr>
    </thead>
    <tbody>
      <tr class="dp-section-hdr"><td colspan="${days.length + 1 + statsBasic.length + (expanded?statsExtra.length:0)}">📋 Offene Stellen</td></tr>
      ${openRows}
      <tr class="dp-section-hdr"><td colspan="${days.length + 1 + statsBasic.length + (expanded?statsExtra.length:0)}">👤 Mitarbeiter</td></tr>
      ${empRows}
    </tbody>
  </table>`;

  // Generierungs-Protokoll am Ende des Plans (zusammenklappbar)
  const reportData = data.plan?.generation_report;
  if (reportData) {
    const report = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
    const isExpanded = S._dpReportExpanded || false;

    const renderRuleRow = (rule) => {
      const icon = rule.status === 'OK' ? '✓' : (rule.status === 'WARNUNG' ? '⚠️' : '✗');
      const iconColor = rule.status === 'OK' ? '#10b981' : (rule.status === 'WARNUNG' ? '#f59e0b' : '#ef4444');
      return `<div style="display:flex;gap:8px;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border)">
        <span style="color:${iconColor};width:20px;flex-shrink:0">${icon}</span>
        <div><strong>${esc(rule.regel)}</strong><br><span style="color:var(--mu)">${esc(rule.details||'')}</span></div>
      </div>`;
    };

    const openSuggestions = (report.zusatzVorschlaege||[]).filter(v => {
      // Bereits übernommene Vorschläge ausblenden (Zelle inzwischen belegt)
      const cellAssign = empAssignMap[v.empId]?.[v.date];
      return !cellAssign;
    });

    const reportHtml = isExpanded ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">
        <div>
          <h5 style="margin:0 0 8px;font-size:13px">⚙️ Dienstplanregeln</h5>
          ${(report.dienstplanRegeln||[]).map(renderRuleRow).join('')}
        </div>
        <div>
          <h5 style="margin:0 0 8px;font-size:13px">📋 Gesetzliche Regeln</h5>
          ${(report.gesetzlicheRegeln||[]).map(renderRuleRow).join('')}
        </div>
      </div>
      ${(report.warnungen||[]).length > 0 ? `<div style="padding:8px 12px;border-top:1px solid var(--border)">
        <h5 style="margin:0 0 8px;font-size:13px;color:#f59e0b">🟡 Fairness-Warnungen</h5>
        ${report.warnungen.map(w => `<div style="font-size:12px;padding:2px 0"><strong>${esc(w.kategorie||'')}:</strong> ${esc(w.details||'')}${
          (w.betroffene||[]).length ? '<br><span style="color:var(--mu)">Betroffen: '+w.betroffene.map(b=>{
            const u = S.users.find(x=>x.id===b.empId);
            return esc((u?lastNameFirst(u.name):b.empId)+' ('+b.anteilProzent+'%)');
          }).join(', ')+'</span>' : ''
        }</div>`).join('')}
      </div>` : ''}
      ${openSuggestions.length > 0 ? `<div style="padding:8px 12px;border-top:1px solid var(--border)">
        <h5 style="margin:0 0 8px;font-size:13px;color:#0ea5e9">💡 Zusatzdienst-Vorschläge (Restkapazität)</h5>
        <div style="font-size:11px;color:var(--mu);margin-bottom:6px">Vorschläge des Generators für Mitarbeiter unter Soll — werden erst durch „Übernehmen" fix zugewiesen.</div>
        ${openSuggestions.map(v => {
          const u = S.users.find(x=>x.id===v.empId);
          const dd = v.date.slice(8)+'.'+v.date.slice(5,7)+'.';
          return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0">
            <span style="flex:1"><strong>${esc(u?lastNameFirst(u.name):v.empId)}</strong> — ${esc(v.code)} am ${dd} (${v.hours}h)</span>
            ${canEdit ? `<button class="btn-s" style="padding:2px 10px;font-size:11px" onclick="dpAcceptSuggestion('${v.empId}','${v.date}','${v.shiftTypeId}')">✓ Übernehmen</button>` : ''}
          </div>`;
        }).join('')}
      </div>` : ''}
      ${(report.fehler||[]).length > 0 ? `<div style="padding:8px 12px;border-top:1px solid var(--border)">
        <h5 style="margin:0 0 8px;font-size:13px;color:#f59e0b">⚠️ Hinweise</h5>
        ${report.fehler.map(e => `<div style="font-size:12px;padding:2px 0"><strong>${esc(e.kategorie||'')}:</strong> ${esc(e.details||e.count||'')}</div>`).join('')}
      </div>` : ''}
    ` : '';

    const protDiv = document.createElement('div');
    protDiv.style.cssText = 'margin-top:16px;border:1px solid var(--border);border-radius:6px;background:var(--sf2);overflow:hidden';
    protDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;user-select:none;background:var(--sf2)"
           onclick="S._dpReportExpanded=!S._dpReportExpanded;renderDPMatrix(S._dpMatrix)">
        <span style="flex:1;font-weight:600;font-size:13px">📋 Generierungs-Protokoll</span>
        ${openSuggestions.length > 0 ? `<span style="color:#0ea5e9;font-size:12px">💡 ${openSuggestions.length} Vorschläge</span>` : ''}
        <span style="color:var(--mu);font-size:12px">${(report.dienstplanRegeln||[]).filter(r=>r.status!=='OK').length + (report.gesetzlicheRegeln||[]).filter(r=>r.status!=='OK').length + (report.warnungen||[]).length} Warnungen</span>
        <span>${isExpanded?'▲':'▼'}</span>
      </div>
      ${reportHtml}
    `;
    c.appendChild(protDiv);
  }
  updateDpSelectionUI();
}

// §11 Fall B: Zusatzdienst-Vorschlag per Klick fix zuweisen
async function dpAcceptSuggestion(empId, date, shiftTypeId) {
  try {
    await api('POST', '/dp/plans/'+S._dpPlanId+'/assign', {employeeId: empId, date, shiftTypeId, absenceTypeId: null});
    toast('Zusatzdienst übernommen');
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function dpCellClick(empId, date, evt) {
  evt.stopPropagation();
  if (evt.ctrlKey || evt.metaKey || evt.shiftKey) {
    const key = empId + '|' + date;
    if (S._dpSelection.has(key)) S._dpSelection.delete(key);
    else S._dpSelection.add(key);
    updateDpSelectionUI();
    document.getElementById('dpCellMenu').style.display = 'none';
  } else {
    if (S._dpSelection.size > 0) {
      S._dpSelection.clear();
      updateDpSelectionUI();
      return;
    }
    openDpCellMenu(empId, date, evt);
  }
}

function updateDpSelectionUI() {
  document.querySelectorAll('.dp-cell-selected').forEach(el => el.classList.remove('dp-cell-selected'));
  S._dpSelection.forEach(key => {
    const [empId, date] = key.split('|');
    const td = document.getElementById('dpc_' + empId + '_' + date);
    if (td) td.classList.add('dp-cell-selected');
  });
  renderDpMultiBar();
}

function renderDpMultiBar() {
  let bar = document.getElementById('dpMultiBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'dpMultiBar';
    document.body.appendChild(bar);
  }
  if (!S._dpSelection || S._dpSelection.size === 0) { bar.style.display = 'none'; return; }

  const {shiftTypes, absenceTypes, empQualMap} = S._dpMatrix || {};
  if (!shiftTypes) { bar.style.display = 'none'; return; }

  const entries = [...S._dpSelection].map(k => { const [empId,date]=k.split('|'); return {empId,date}; });

  // Intersection of qualified shift types across all selected employees
  const empQualSets = entries.map(({empId}) => {
    const quals = empQualMap?.[empId] || [];
    return quals.length > 0 ? new Set(quals) : new Set(shiftTypes.map(st => st.id));
  });
  const common = shiftTypes.filter(st => empQualSets.every(s => s.has(st.id)));

  const count = S._dpSelection.size;
  const dates = [...new Set(entries.map(e => e.date))].sort();
  const dateLabel = dates.length <= 3
    ? dates.map(d => d.slice(8)+'.'+d.slice(5,7)+'.').join(', ')
    : dates.length + ' Tage';

  let html = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <div style="flex-shrink:0">
      <span style="font-weight:700;font-size:13px">${count} Zelle${count>1?'n':''}</span>
      <span style="color:var(--mu);font-size:12px;margin-left:6px">${dateLabel}</span>
      <span style="color:var(--mu);font-size:11px;margin-left:8px;font-style:italic">Strg+Klick</span>
    </div>
    <div style="width:1px;height:24px;background:var(--border);flex-shrink:0"></div>`;

  if (common.length > 0) {
    html += common.map(st => `<button onclick="dpMultiAssign('${st.id}',null)" style="background:${st.color}22;color:${dpTextColor(st.color)};border:1.5px solid ${st.color};border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:${st.color};border-radius:50%;flex-shrink:0"></span>${esc(st.code)}</button>`).join('');
  } else {
    html += `<span style="color:var(--mu);font-size:12px;font-style:italic">Keine gemeinsamen Dienste</span>`;
  }

  if (absenceTypes?.length) {
    html += `<div style="width:1px;height:24px;background:var(--border);flex-shrink:0"></div>`;
    html += (absenceTypes||[]).map(at => `<button onclick="dpMultiAssign(null,'${at.id}')" style="background:${at.color}22;color:${dpTextColor(at.color)};border:1.5px solid ${at.color};border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;background:${at.color};border-radius:50%;flex-shrink:0"></span>${esc(at.code)}</button>`).join('');
  }

  html += `<div style="flex:1"></div><button onclick="dpClearSelection()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--mu)">✕</button></div>`;

  bar.innerHTML = html;
  bar.style.cssText = 'display:block;position:fixed;bottom:0;left:0;right:0;background:var(--bg);border-top:2px solid var(--acc);padding:10px 16px;z-index:998;box-shadow:0 -4px 20px rgba(0,0,0,.12)';
}

async function dpMultiAssign(shiftTypeId, absenceTypeId) {
  if (!S._dpPlanId || !S._dpSelection.size) return;
  const entries = [...S._dpSelection].map(k => k.split('|')).map(([empId,date]) => ({empId,date}));
  S._dpSelection.clear();
  updateDpSelectionUI();
  try {
    await Promise.all(entries.map(({empId,date}) =>
      api('POST', '/dp/plans/'+S._dpPlanId+'/assign', {employeeId:empId, date, shiftTypeId:shiftTypeId||null, absenceTypeId:absenceTypeId||null})
    ));
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    toast(entries.length + ' Einträge gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function dpClearSelection() {
  S._dpSelection.clear();
  updateDpSelectionUI();
}

function openDpCellMenu(empId, date, evt) {
  if (!S._dpMatrix) return;
  evt.stopPropagation();

  const {shiftTypes, absenceTypes, empAssignMap, empQualMap, wishDaySet} = S._dpMatrix;
  const assign = empAssignMap[empId]?.[date];
  const u = getU(empId);

  // Filter shift types to only those the employee is qualified for
  const empQuals = empQualMap?.[empId] || [];
  const qualifiedShiftTypes = empQuals.length > 0
    ? shiftTypes.filter(st => empQuals.includes(st.id))
    : shiftTypes; // if no qualifications defined, show all

  const dayWD = new Date(date).getDay();
  const dateDisplay = date.slice(8)+'.'+date.slice(5,7)+'. ('+WD_SHORT[dayWD]+')';

  let html = `<div class="dp-menu-hdr">${esc(u?lastNameFirst(u.name):empId)} · ${dateDisplay}</div>`;

  if (assign) {
    const st = shiftTypes.find(x=>x.id===assign.shift_type_id);
    const at = absenceTypes.find(x=>x.id===assign.absence_type_id);
    html += `<div style="padding:4px 12px;font-size:12px;color:var(--mu)">Aktuell: ${at?esc(at.label):''}${at&&st?' + ':''}${st?esc(st.name):''}</div>`;
    html += `<div class="dp-menu-sep"></div>`;
  }

  // Only show qualified shift types
  if (qualifiedShiftTypes.length > 0) {
    html += `<div class="dp-menu-hdr">Dienst zuweisen</div>`;
    qualifiedShiftTypes.forEach(st => {
      html += `<div class="dp-menu-item" onclick="dpAssign('${empId}','${date}','${st.id}',null)" style="color:${st.color}">
        <span class="dp-color-dot" style="background:${st.color}"></span>${esc(st.code)} – ${esc(st.name)}
      </div>`;
    });
  }

  // Absences
  html += `<div class="dp-menu-sep"></div><div class="dp-menu-hdr">Abwesenheit</div>`;
  absenceTypes.forEach(at => {
    const shiftArg = assign?.shift_type_id ? `'${assign.shift_type_id}'` : 'null';
    html += `<div class="dp-menu-item" onclick="dpAssign('${empId}','${date}',${shiftArg},'${at.id}')" style="color:${at.color}">
      <span class="dp-color-dot" style="background:${at.color}"></span>${esc(at.code)} – ${esc(at.label)}
    </div>`;
  });

  // Wish day toggle
  const wishSet = new Set(wishDaySet || []);
  const isWishDay = wishSet.has(`${empId}_${date}`);
  html += `<div class="dp-menu-sep"></div>`;
  html += `<div class="dp-menu-item" onclick="dpToggleWishDay('${empId}','${date}',${isWishDay})" style="color:${isWishDay?'#f59e0b':'var(--mu)'}">
    ${isWishDay ? '★ Wunschtag entfernen' : '☆ Als Wunschtag markieren'}
  </div>`;

  if (assign) {
    html += `<div class="dp-menu-sep"></div>`;
    html += `<div class="dp-menu-item" style="color:#ef4444" onclick="dpClearAssign('${assign.id}','${date}')">✕ Eintrag löschen</div>`;
  }

  // Position menu using fixed + viewport coords
  const menu = document.getElementById('dpCellMenu');
  menu.innerHTML = html;
  menu.style.position = 'fixed';
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.style.display = 'block';
  const mh = menu.offsetHeight;
  const mw = menu.offsetWidth;
  menu.style.visibility = '';

  const rect = evt.target.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const multiBarH = (S._dpSelection?.size > 0) ? 56 : 0;
  const usableH = vh - multiBarH;
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + mw + 4 > vw) left = vw - mw - 4;
  if (left < 4) left = 4;
  if (top + mh + 4 > usableH) top = Math.max(4, rect.top - mh - 4);
  if (top < 4) top = 4;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  setTimeout(() => {
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 10);
}

async function dpAssign(empId, date, shiftTypeId, absenceTypeId) {
  document.getElementById('dpCellMenu').style.display = 'none';
  if (!S._dpPlanId) return;
  try {
    const result = await api('POST', '/dp/plans/'+S._dpPlanId+'/assign', {
      employeeId: empId, date, shiftTypeId: shiftTypeId||null, absenceTypeId: absenceTypeId||null
    });
    if (result.warnings?.length) toast('⚠️ '+result.warnings.join(' | '),'warn');
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    if (!result.warnings?.length) toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpResetPlan() {
  if (!S._dpPlanId) return;
  if (!confirm('Plan zurücksetzen? Alle Dienste werden gelöscht, Abwesenheiten bleiben erhalten.')) return;
  try {
    await api('POST', '/dp/plans/'+S._dpPlanId+'/reset');
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    toast('Plan zurückgesetzt');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpSaveVersion() {
  if (!S._dpPlanId) return;
  const versionName = prompt('Versionsname:');
  if (!versionName?.trim()) return;
  try {
    await api('POST', '/dp/plans/'+S._dpPlanId+'/versions', {versionName: versionName.trim()});
    toast('Version gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpShowVersions() {
  if (!S._dpPlanId) return;
  try {
    const versions = await api('GET', '/dp/plans/'+S._dpPlanId+'/versions');
    const listEl = document.getElementById('dpVersionsList');
    if (!listEl) return;
    if (!versions.length) {
      listEl.innerHTML = '<div style="padding:12px;color:var(--mu)">Keine Versionen vorhanden.</div>';
    } else {
      listEl.innerHTML = versions.map(v => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${esc(v.version_name)}</div>
            <div style="font-size:11px;color:var(--mu)">${new Date(v.created_at).toLocaleString('de')}</div>
          </div>
          <button class="btn-s" onclick="dpRestoreVersion('${v.id}')">↩ Wiederherstellen</button>
          ${S.p.manageUsers?`<button class="btn-s" style="color:#ef4444" onclick="dpDeleteVersion('${v.id}')">✕</button>`:''}
        </div>`).join('');
    }
    openModal('dpVersionsOv');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpRestoreVersion(vId) {
  if (!S._dpPlanId) return;
  if (!confirm('Version wiederherstellen? Aktueller Plan wird überschrieben.')) return;
  try {
    await api('POST', '/dp/plans/'+S._dpPlanId+'/versions/'+vId+'/restore');
    closeModal('dpVersionsOv');
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    toast('Version wiederhergestellt');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpDeleteVersion(vId) {
  if (!S._dpPlanId) return;
  if (!confirm('Version löschen?')) return;
  try {
    await api('DELETE', '/dp/plans/'+S._dpPlanId+'/versions/'+vId);
    dpShowVersions();
    toast('Version gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpClearAssign(assignId, date) {
  document.getElementById('dpCellMenu').style.display = 'none';
  if (!S._dpPlanId) return;
  try {
    await api('DELETE', '/dp/plans/'+S._dpPlanId+'/assign/'+assignId);
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function dpToggleWishDay(empId, date, isCurrentlyWish) {
  document.getElementById('dpCellMenu').style.display = 'none';
  if (!S._dpPlanId) return;
  try {
    const [year, month] = [parseInt(date.slice(0,4)), parseInt(date.slice(5,7))];
    if (isCurrentlyWish) {
      // Find and delete the wish day
      const wishDays = await api('GET', `/dp/wish-days?month=${month}&year=${year}`);
      const wd = wishDays.find(w => w.employee_id === empId && String(w.date).slice(0,10) === date);
      if (wd) await api('DELETE', `/dp/wish-days/${wd.id}`);
    } else {
      await api('POST', '/dp/wish-days', {employeeId: empId, date, month, year, reason: ''});
    }
    const data = await api('GET', '/dp/plans/'+S._dpPlanId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
    toast(isCurrentlyWish ? 'Wunschtag entfernt' : 'Wunschtag gesetzt');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openDpPlanForm(plan) {
  const now = new Date();
  document.getElementById('dpPlanFormTitle').textContent = plan ? 'Plan bearbeiten' : 'Neuer Plan';
  document.getElementById('dpPfId').value = plan?.id||'';
  document.getElementById('dpPfMonth').value = plan?.month||String(now.getMonth()+2>12?1:now.getMonth()+2);
  document.getElementById('dpPfYear').value = plan?.year||now.getFullYear();
  document.getElementById('dpPfTitle').value = plan?.title||'';
  document.getElementById('dpPfNotes').value = plan?.notes||'';
  openModal('dpPlanFormOv');
}

async function submitDpPlanForm() {
  const id = document.getElementById('dpPfId').value;
  const month = parseInt(document.getElementById('dpPfMonth').value);
  const year = parseInt(document.getElementById('dpPfYear').value);
  const title = document.getElementById('dpPfTitle').value.trim();
  const notes = document.getElementById('dpPfNotes').value.trim();
  if (!month||!year) return toast('Monat und Jahr erforderlich','err');
  try {
    if (id) {
      await api('PUT', '/dp/plans/'+id, {title: title||null, notes: notes||null});
    } else {
      const plan = await api('POST', '/dp/plans', {month, year, title: title||`Plan ${month}/${year}`, notes});
      S._dpPlanId = plan.id;
    }
    closeModal('dpPlanFormOv');
    await fetchData();
    renderDP();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function generateDpPlan(planId) {
  if (!confirm('Auto-Generierung starten? Bestehende nicht-gesperrte Einträge werden überschrieben.')) return;
  try {
    loading(true);
    const res = await api('POST', '/dp/plans/'+planId+'/generate');
    loading(false);
    const extras = [];
    if (res.violations) extras.push(`${res.violations} Wunschtag-Konflikte`);
    if (res.zusatzVorschlaege) extras.push(`${res.zusatzVorschlaege} Zusatzdienst-Vorschläge`);
    toast(`Generiert: ${res.generated} Dienste${extras.length ? ' ('+extras.join(', ')+')' : ''}`);

    // Report anzeigen
    if (res.report) {
      let reportHtml = `<div style="max-height:60vh;overflow-y:auto;padding:12px;background:var(--sf2);border-radius:6px">
        <h4>📋 Generierungs-Report</h4>`;

      reportHtml += `<h5 style="margin-top:12px;color:var(--fg)">✅ Dienstplanregeln:</h5>`;
      for (const rule of res.report.dienstplanRegeln) {
        const icon = rule.status === 'OK' ? '✓' : (rule.status === 'WARNUNG' ? '⚠️' : '✗');
        reportHtml += `<div style="padding:4px 0;font-size:12px"><span>${icon}</span> <strong>${rule.regel}:</strong> ${rule.details}</div>`;
      }

      reportHtml += `<h5 style="margin-top:12px;color:var(--fg)">📋 Gesetzliche Regeln:</h5>`;
      for (const rule of res.report.gesetzlicheRegeln) {
        const icon = rule.status === 'OK' ? '✓' : (rule.status === 'WARNUNG' ? '⚠️' : '✗');
        reportHtml += `<div style="padding:4px 0;font-size:12px"><span>${icon}</span> <strong>${rule.regel}:</strong> ${rule.details}</div>`;
      }

      if ((res.report.warnungen||[]).length > 0) {
        reportHtml += `<h5 style="margin-top:12px;color:#f59e0b">🟡 Fairness-Warnungen:</h5>`;
        for (const w of res.report.warnungen) {
          reportHtml += `<div style="padding:4px 0;font-size:12px">⚠️ <strong>${esc(w.kategorie||'')}:</strong> ${esc(w.details||'')}</div>`;
        }
      }

      if ((res.report.zusatzVorschlaege||[]).length > 0) {
        reportHtml += `<h5 style="margin-top:12px;color:#0ea5e9">💡 Zusatzdienst-Vorschläge:</h5>
          <div style="padding:4px 0;font-size:12px">${res.report.zusatzVorschlaege.length} Vorschläge für Mitarbeiter mit Restkapazität — Details und „Übernehmen" im Generierungs-Protokoll unter dem Plan.</div>`;
      }

      if (res.report.fehler.length > 0) {
        reportHtml += `<h5 style="margin-top:12px;color:#f59e0b">⚠️ Fehler/Warnungen:</h5>`;
        for (const err of res.report.fehler) {
          reportHtml += `<div style="padding:4px 0;font-size:12px">⚠️ <strong>${esc(err.kategorie)}:</strong> ${esc(err.details)}</div>`;
        }
      }

      reportHtml += `</div>`;
      document.getElementById('dpReportContent').innerHTML = reportHtml;
      openModal('dpReportModal');
    }

    const data = await api('GET', '/dp/plans/'+planId+'/matrix');
    S._dpMatrix = data;
    renderDPMatrix(data);
  } catch(e) { loading(false); toast('Fehler: '+e.message,'err'); }
}

async function publishDpPlan(planId) {
  if (!confirm('Plan freigeben? Mitarbeiter können ihn danach sehen.')) return;
  try {
    await api('POST', '/dp/plans/'+planId+'/publish');
    await fetchData();
    renderDP();
    toast('Plan freigegeben');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpPlan(planId) {
  if (!confirm('Plan und alle Einträge unwiderruflich löschen?')) return;
  try {
    await api('DELETE', '/dp/plans/'+planId);
    S._dpPlanId = null;
    S._dpMatrix = null;
    await fetchData();
    renderDP();
    toast('Plan gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIENSTPLAN — KONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

async function renderDPConfig() {
  const el = document.getElementById('main');
  if (!el) return;
  if (!S.p.manageUsers) {
    el.innerHTML = '<div style="padding:20px;color:var(--mu)">Kein Zugriff</div>';
    return;
  }

  const tabs = [
    {id:'shift-types',label:'Schichttypen'},
    {id:'absence-types',label:'Abwesenheiten'},
    {id:'hours-profiles',label:'Stundenprofile'},
    {id:'emp-categories',label:'Kategorien'},
    {id:'qualifications',label:'Qualifikationen'},
    {id:'requirements',label:'Schichtbedarf'},
    {id:'scheduling-rules',label:'⚙️ Dienstplanregeln'},
    {id:'rules',label:'📋 Gesetzliche Regeln'},
  ];

  const tab = S._dpConfigTab;

  let content = '';
  if (tab === 'shift-types') content = await renderDPConfigShiftTypes();
  else if (tab === 'absence-types') content = await renderDPConfigAbsenceTypes();
  else if (tab === 'hours-profiles') content = renderDPConfigHoursProfiles();
  else if (tab === 'emp-categories') content = renderDPConfigEmpCategories();
  else if (tab === 'qualifications') content = await renderDPConfigQualifications();
  else if (tab === 'requirements') content = await renderDPConfigRequirements();
  else if (tab === 'scheduling-rules') content = renderDPConfigSchedulingRules();
  else if (tab === 'rules') content = renderDPConfigRules();

  el.innerHTML = `<div style="display:flex;flex-direction:column;height:calc(100vh - 56px)">
    <div style="display:flex;align-items:center;gap:0;padding:12px 16px 0;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg)">
      <h2 style="margin:0 16px 0 0;font-size:16px;font-weight:700">⚙️ DP-Konfiguration</h2>
      ${tabs.map(t=>{const on=t.id===tab;return`<button style="padding:8px 14px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${on?'700':'400'};border-bottom:2px solid ${on?'var(--acc)':'transparent'};color:${on?'var(--acc)':'var(--mu)'}" onclick="S._dpConfigTab='${t.id}';renderDPConfig()">${t.label}</button>`;}).join('')}
    </div>
    <div style="padding:8px 16px 0;font-size:11px;color:var(--mu)">ℹ️ Mitarbeiter-Parameter (Sollstunden, Nachtdienste usw.) findest du jetzt direkt im Benutzer-Formular unter Admin → Benutzer.</div>
    <div id="dp-config-content" style="flex:1;overflow:auto;padding:16px">${content}</div>
  </div>`;
}

async function renderDPConfigTab() {
  const contentEl = document.getElementById('dp-config-content');
  if (!contentEl) return renderDPConfig();
  const scrollTop = contentEl.scrollTop;
  const tab = S._dpConfigTab;
  let content = '';
  if (tab === 'shift-types') content = await renderDPConfigShiftTypes();
  else if (tab === 'absence-types') content = await renderDPConfigAbsenceTypes();
  else if (tab === 'hours-profiles') content = renderDPConfigHoursProfiles();
  else if (tab === 'emp-categories') content = renderDPConfigEmpCategories();
  else if (tab === 'qualifications') content = await renderDPConfigQualifications();
  else if (tab === 'requirements') content = await renderDPConfigRequirements();
  else if (tab === 'scheduling-rules') content = renderDPConfigSchedulingRules();
  else if (tab === 'rules') content = renderDPConfigRules();
  contentEl.innerHTML = content;
  contentEl.scrollTop = scrollTop;
}

async function renderDPConfigShiftTypes() {
  const types = S.dpShiftTypes;
  if (!types.length) return `<div style="color:var(--mu);margin-bottom:12px">Noch keine Schichttypen.</div><button class="btn-p" onclick="openDpShiftTypeForm()">+ Schichttyp hinzufügen</button>`;

  const rows = types.map(st => `<div class="dp-cfg-row">
    <span class="dp-color-dot" style="background:${st.color}"></span>
    <span class="dp-cfg-label"><strong>${esc(st.code)}</strong> – ${esc(st.name)}</span>
    <span style="font-size:11px;color:var(--mu)">${st.start_time}–${st.end_time} (${st.duration_hours}h)${st.is_night?' 🌙':''}${st.is_zulage?' ⭐':''}${st.is_office?' 🏢':''}</span>
    <button class="btn-s" onclick="openDpShiftTypeForm('${st.id}')">✏️</button>
    <button class="btn-s" style="color:#ef4444" onclick="deleteDpShiftType('${st.id}')">✕</button>
  </div>`).join('');

  return `<div class="dp-cfg-card">
    <h3>Schichttypen <button class="btn-p" style="float:right;font-size:11px" onclick="openDpShiftTypeForm()">+ Hinzufügen</button></h3>
    ${rows}
  </div>`;
}

async function renderDPConfigAbsenceTypes() {
  const types = S.dpAbsenceTypes;
  if (!types.length) return `<div style="color:var(--mu);margin-bottom:12px">Noch keine Abwesenheitstypen.</div><button class="btn-p" onclick="openDpAbsenceTypeForm()">+ Hinzufügen</button>`;

  const hcLabel = {daily_target:'Tagessoll',shift_hours:'Dienstst.',zero:'0h',fixed:'Fix',avg_shift_duration:'Ø Dienstdauer'};
  const rows = types.map(at => `<div class="dp-cfg-row">
    <span class="dp-color-dot" style="background:${at.color}"></span>
    <span class="dp-cfg-label"><strong>${esc(at.code)}</strong> – ${esc(at.label)}</span>
    <span style="font-size:11px;color:var(--mu)">${hcLabel[at.hours_calculation]||at.hours_calculation}${at.adjusts_monthly_target?' 📉':''}${at.is_holiday_default?' 🏛️ Feiertag-Standard':''}</span>
    <button class="btn-s" onclick="openDpAbsenceTypeForm('${at.id}')">✏️</button>
    <button class="btn-s" style="color:#ef4444" onclick="deleteDpAbsenceType('${at.id}')">✕</button>
  </div>`).join('');

  return `<div class="dp-cfg-card">
    <h3>Abwesenheitstypen <button class="btn-p" style="float:right;font-size:11px" onclick="openDpAbsenceTypeForm()">+ Hinzufügen</button></h3>
    ${rows}
  </div>`;
}

// Ein Mitarbeiter-Parameter-Block (Versionen + Fixregeln) für EINEN
// Mitarbeiter — genutzt im eingebetteten Dienstplan-Abschnitt des
// Benutzer-Formulars (Admin → Benutzer, "Für Dienstplanung relevant").
function dpEmpParamUserBlockHtml(u) {
  const empParams = S.dpEmpParams||[];
  const userParams = empParams.filter(x=>x.employee_id===u.id)
    .sort((a,b) => {
      if (a.valid_from===null&&b.valid_from===null) return 0;
      if (a.valid_from===null) return -1;
      if (b.valid_from===null) return 1;
      return String(b.valid_from).localeCompare(String(a.valid_from));
    });
  const versionRows = userParams.length ? userParams.map((p) => {
    const vfBadge = p.valid_from
      ? `<span style="background:#3b6dd422;color:var(--acc);border-radius:12px;padding:1px 8px;font-size:11px;font-weight:600">ab ${String(p.valid_from).slice(0,10)}</span>`
      : `<span style="background:#10b98122;color:#10b981;border-radius:12px;padding:1px 8px;font-size:11px;font-weight:600">Standard</span>`;
    const canDelete = userParams.length > 1;
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap">
      ${vfBadge}
      <span style="font-size:11px;color:var(--mu)">${p.monthly_hours||Math.round(p.weekly_hours*4.33)}h/Mo${p.office_pct?' 🏢'+p.office_pct+'%':''}${p.can_do_nights?' 🌙':''}${p.is_springer?' 🔄':''}${p.fd_springer_type==='FD_to_LS'?' 🚑A-'+p.fd_springer_location:''}${p.fd_springer_type==='LS_to_FD'?' 🚑B-'+p.fd_springer_location:''}</span>
      <button class="btn-s" onclick="openDpEmpParamForm('${p.id}')">✏️</button>
      ${canDelete?`<button class="btn-s" style="color:#ef4444" onclick="deleteDpEmpParam('${p.id}')">✕</button>`:''}
    </div>`;
  }).join('') : `<div style="font-size:11px;color:var(--mu);padding:4px 0">Noch nicht konfiguriert.</div>`;
  const userRules = (S.dpEmpRules||[]).filter(r=>r.employee_id===u.id);
  const wdNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const rulesHtml = userRules.map(r => {
    const _stCode = r.shift_type_id ? esc((S.dpShiftTypes||[]).find(x=>x.id===r.shift_type_id)?.code||r.shift_type_id) : '?';
    const ruleLabel = r.rule_type==='always_free' ? `Immer frei am ${wdNames[r.day_of_week]??r.day_of_week}` :
      r.rule_type==='always_shift' ? `Immer Dienst am ${wdNames[r.day_of_week]??r.day_of_week}: ${_stCode}` :
      r.rule_type==='if_shift_then' ? `Wenn Dienst am ${wdNames[r.day_of_week]??r.day_of_week}: nur ${_stCode}` :
      esc(r.rule_type);
    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px">
      <span style="color:var(--mu)">${ruleLabel}</span>
      ${S.p.manageUsers?`<button class="btn-s" style="font-size:10px;padding:1px 6px;color:#ef4444" onclick="deleteDpEmpRule('${r.id}')">✕</button>`:''}
    </div>`;
  }).join('');
  const addRuleBtn = S.p.manageUsers ? `<button class="btn-s" style="font-size:11px" onclick="openDpEmpRuleForm('${u.id}')">+ Fixregel</button>` : '';
  return `<div>
    ${versionRows}
    ${rulesHtml}
    <div style="display:flex;gap:6px;margin-top:6px">
      <button class="btn-s" style="font-size:11px" onclick="openDpEmpParamFormNew('${u.id}')">${userParams.length?'+ Neue Version':'+ Einrichten'}</button>
      ${addRuleBtn}
    </div>
  </div>`;
}
// Lädt (einmalig pro Öffnung) die Dienstplan-Parameter des im Benutzer-
// Formular gerade bearbeiteten Mitarbeiters und rendert sie im eingebetteten
// Abschnitt — so ist "Dienstplanung relevant" komplett im Benutzer-Formular
// bedienbar, ohne einen separaten Admin-Bereich aufsuchen zu müssen.
async function renderUfDpParamsSection(uid) {
  const body = document.getElementById('ufDpParamsBody');
  if (!body) return;
  body.innerHTML = '<div style="font-size:12px;color:var(--mu)">Lade…</div>';
  try { S.dpEmpParams = await api('GET', '/dp/employee-params'); } catch(e) { S.dpEmpParams = S.dpEmpParams||[]; }
  window.dpEmpParamsAll = S.dpEmpParams;
  const u = getU(uid);
  if (!u) { body.innerHTML = ''; return; }
  body.innerHTML = dpEmpParamUserBlockHtml(u);
}

async function renderDPConfigRequirements() {
  let reqs = [];
  try { reqs = await api('GET', '/dp/shift-requirements'); } catch(e) {}
  window.dpReqs = reqs;

  const appliesLabel = {weekday:'Werktag',weekend:'Wochenende',holiday:'Feiertag',daily:'Mo–So',date:'Datum'};
  const wdLabel = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const today = new Date().toISOString().slice(0,10);

  const isActive = r => {
    const from = r.valid_from ? String(r.valid_from).slice(0,10) : null;
    const until = r.valid_until ? String(r.valid_until).slice(0,10) : null;
    if (from && from > today) return false;
    if (until && until < today) return false;
    return true;
  };

  const buildRow = (r, dimmed) => {
    const st = S.dpShiftTypes.find(x=>x.id===r.shift_type_id);
    const wd = r.weekday!==null ? ' ('+wdLabel[r.weekday]+')' : '';
    const from = r.valid_from ? String(r.valid_from).slice(0,10) : null;
    const until = r.valid_until ? String(r.valid_until).slice(0,10) : null;
    let dateRange = '';
    if (from && until) dateRange = ` · ${from.slice(5)} – ${until.slice(5)}`;
    else if (from) dateRange = ` · ab ${from.slice(5)}`;
    else if (until) dateRange = ` · bis ${until.slice(5)}`;
    return `<div class="dp-cfg-row" style="${dimmed?'opacity:0.5':''}">
      <span class="dp-color-dot" style="background:${st?.color||'#ccc'}"></span>
      <span class="dp-cfg-label">${esc(st?.name||r.shift_type_id)}</span>
      <span style="font-size:11px;color:var(--mu)">${appliesLabel[r.applies_to]||r.applies_to}${wd}${r.specific_date?' '+String(r.specific_date).slice(0,10):''}: ${r.slot_count} Slot(s)${dateRange}</span>
      <button class="btn-s" onclick="openDpReqForm(window.dpReqs.find(x=>x.id==='${r.id}'))">✏️</button>
      <button class="btn-s" style="color:#ef4444" onclick="deleteDpRequirement('${r.id}')">✕</button>
    </div>`;
  };

  const isFuture = r => { const from = r.valid_from ? String(r.valid_from).slice(0,10) : null; return from && from > today; };
  const isExpired = r => { const until = r.valid_until ? String(r.valid_until).slice(0,10) : null; return until && until < today; };

  const active  = reqs.filter(r => !isFuture(r) && !isExpired(r));
  const future  = reqs.filter(r => isFuture(r));
  const expired = reqs.filter(r => isExpired(r));

  const sectionHdr = (label, note) =>
    `<div style="font-size:12px;font-weight:600;color:var(--mu);margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.05em">${label}${note?`<span style="font-weight:400;text-transform:none;font-size:11px"> — ${note}</span>`:''}</div>`;

  const activeHtml = active.length
    ? active.map(r => buildRow(r, false)).join('')
    : '<div style="color:var(--mu);font-size:13px">Noch kein aktiver Bedarf definiert.</div>';

  const futureHtml = future.length
    ? sectionHdr('Zukünftig', 'wird im jeweiligen Planmonat automatisch angewendet') + future.map(r => buildRow(r, false)).join('')
    : '';

  const expiredHtml = expired.length
    ? sectionHdr('Abgelaufen') + expired.map(r => buildRow(r, true)).join('')
    : '';

  return `<div class="dp-cfg-card">
    <h3>Schichtbedarf <button class="btn-p" style="float:right;font-size:11px" onclick="openDpReqForm()">+ Hinzufügen</button></h3>
    ${activeHtml}${futureHtml}${expiredHtml}
  </div>`;
}

function renderDPConfigHoursProfiles() {
  const profiles = S.dpHoursProfiles || [];
  const rows = profiles.map(p => `
    <div class="dp-cfg-row">
      <span class="dp-cfg-label" style="font-weight:600">${esc(p.name)}</span>
      <span style="font-size:12px;color:var(--mu)">${p.monthly_hours}h/Monat${p.daily_work_hours ? ' · Tagessoll '+p.daily_work_hours+'h' : ''}${p.avg_shift_duration ? ' · Ø Dienst '+p.avg_shift_duration+'h' : ''}</span>
      <button class="btn-s" onclick="openDpHoursProfileForm('${p.id}')">✏️</button>
      <button class="btn-s" style="color:#ef4444" onclick="deleteDpHoursProfile('${p.id}')">✕</button>
    </div>`).join('');

  return `<div class="dp-cfg-card">
    <h3>Stundenprofile <button class="btn-p" style="float:right;font-size:11px" onclick="openDpHoursProfileForm()">+ Hinzufügen</button></h3>
    <p style="font-size:12px;color:var(--mu);margin-bottom:12px">
      Definiert Sollstunden und Durchschnittswerte pro Profil. Bei Mitarbeiter-Parametern dann Profil auswählen.
    </p>
    ${rows || '<div style="color:var(--mu);font-size:13px">Noch keine Profile definiert.</div>'}
    <div style="margin-top:16px;padding:12px;background:var(--sf2);border-radius:6px;border:1px solid var(--border);font-size:12px;color:var(--mu)">
      <strong>Felder:</strong><br>
      <b>Monatssoll:</b> Vertragliche Sollstunden/Monat (z.B. 173h)<br>
      <b>Tägliche Arbeitszeit:</b> Durchschnittliche tägliche Arbeitszeit — wird für Abwesenheiten mit "Tagessoll" verwendet (z.B. 8h)<br>
      <b>Ø Dienstdauer:</b> Durchschnittliche Schichtdauer — wird für Abwesenheitstyp "Ø Dienstdauer" verwendet (z.B. 12h). Bei Feiertag: Ø Dienstdauer + Dienststunden wenn gearbeitet wird.
    </div>
  </div>`;
}

function openDpHoursProfileForm(id) {
  const p = id ? (S.dpHoursProfiles||[]).find(x=>x.id===id)||null : null;
  document.getElementById('dpHpfTitle').textContent = p ? 'Profil bearbeiten' : 'Neues Stundenprofil';
  document.getElementById('dpHpfId').value = p?.id||'';
  document.getElementById('dpHpfName').value = p?.name||'';
  document.getElementById('dpHpfMonthly').value = p?.monthly_hours||'';
  document.getElementById('dpHpfDaily').value = p?.daily_work_hours||'';
  document.getElementById('dpHpfAvgShift').value = p?.avg_shift_duration||'';
  openModal('dpHoursProfileFormOv');
}

async function submitDpHoursProfileForm() {
  const id = document.getElementById('dpHpfId').value;
  const body = {
    name: document.getElementById('dpHpfName').value.trim(),
    monthlyHours: parseFloat(document.getElementById('dpHpfMonthly').value)||0,
    dailyWorkHours: document.getElementById('dpHpfDaily').value ? parseFloat(document.getElementById('dpHpfDaily').value) : null,
    avgShiftDuration: document.getElementById('dpHpfAvgShift').value ? parseFloat(document.getElementById('dpHpfAvgShift').value) : null,
  };
  if (!body.name || !body.monthlyHours) return toast('Name und Monatssoll erforderlich','err');
  try {
    if (id) await api('PUT', '/dp/hours-profiles/'+id, body);
    else await api('POST', '/dp/hours-profiles', body);
    S.dpHoursProfiles = await api('GET', '/dp/hours-profiles');
    closeModal('dpHoursProfileFormOv');
    renderDPConfig();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpHoursProfile(id) {
  if (!confirm('Stundenprofil löschen? Bei Mitarbeitern wird das Profil entfernt (Stunden bleiben).')) return;
  try {
    await api('DELETE', '/dp/hours-profiles/'+id);
    S.dpHoursProfiles = await api('GET', '/dp/hours-profiles');
    renderDPConfig();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function renderDPConfigEmpCategories() {
  const categories = S.dpEmpCategories || [];
  const users = S.users || [];

  // Group users by category
  const byCategory = {};
  const uncategorized = [];
  for (const u of users) {
    if (u.category) {
      if (!byCategory[u.category]) byCategory[u.category] = [];
      byCategory[u.category].push(u);
    } else {
      uncategorized.push(u);
    }
  }

  const catColumns = categories.map(cat => {
    const emps = byCategory[cat.name] || [];
    const empChips = emps.map(u => `
      <div class="dp-cat-chip" draggable="true"
        ondragstart="dpCatDragStart(event,'${u.id}')"
        style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;cursor:grab;font-size:12px;margin-bottom:4px">
        <span class="av-sm" style="background:${u.color};width:20px;height:20px;font-size:9px;flex-shrink:0">${esc(u.initials)}</span>
        <span>${esc(lastNameFirst(u.name))}</span>
        <button onclick="dpCatAssign('${u.id}',null)" style="border:none;background:none;cursor:pointer;color:var(--mu);font-size:11px;padding:0 0 0 4px" title="Aus Kategorie entfernen">✕</button>
      </div>`).join('');

    return `<div class="dp-cat-col"
      style="flex:1;min-width:180px;background:var(--sf2);border-radius:8px;border:2px solid ${cat.color};padding:10px;min-height:120px"
      ondragover="event.preventDefault()"
      ondrop="dpCatDrop(event,'${esc(cat.name)}')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="width:10px;height:10px;border-radius:50%;background:${cat.color};flex-shrink:0"></span>
        <span style="font-weight:600;font-size:13px;flex:1">${esc(cat.name)}</span>
        <button class="btn-s" style="font-size:10px" onclick="openDpEmpCatForm('${cat.id}')">✏️</button>
        <button class="btn-s" style="font-size:10px;color:#ef4444" onclick="deleteDpEmpCat('${cat.id}')">✕</button>
      </div>
      ${empChips || '<div style="color:var(--mu);font-size:11px;padding:4px 0">Hier ablegen…</div>'}
    </div>`;
  }).join('');

  const uncatChips = uncategorized.map(u => `
    <div class="dp-cat-chip" draggable="true"
      ondragstart="dpCatDragStart(event,'${u.id}')"
      style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;cursor:grab;font-size:12px;margin:2px">
      <span class="av-sm" style="background:${u.color};width:20px;height:20px;font-size:9px;flex-shrink:0">${esc(u.initials)}</span>
      <span>${esc(lastNameFirst(u.name))}</span>
    </div>`).join('');

  return `<div class="dp-cfg-card">
    <h3>Dienstplan-Kategorien <button class="btn-p" style="float:right;font-size:11px" onclick="openDpEmpCatForm()">+ Neue Kategorie</button></h3>
    <p style="font-size:12px;color:var(--mu);margin-bottom:16px">Mitarbeiter per Drag &amp; Drop in Kategorien einteilen. Die Einteilung gilt für alle Dienstpläne.</p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:20px">
      ${catColumns || '<div style="color:var(--mu);font-size:13px">Noch keine Kategorien angelegt.</div>'}
    </div>

    ${uncategorized.length > 0 ? `
    <div style="background:var(--sf2);border-radius:8px;border:2px dashed var(--border);padding:10px">
      <div style="font-size:12px;font-weight:600;color:var(--mu);margin-bottom:8px">Ohne Kategorie (ziehen um zuzuordnen):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${uncatChips}</div>
    </div>` : ''}
  </div>`;
}

let _dpCatDragEmpId = null;

function dpCatDragStart(evt, empId) {
  _dpCatDragEmpId = empId;
  evt.dataTransfer.effectAllowed = 'move';
}

async function dpCatDrop(evt, categoryName) {
  evt.preventDefault();
  if (!_dpCatDragEmpId) return;
  await dpCatAssign(_dpCatDragEmpId, categoryName);
  _dpCatDragEmpId = null;
}

async function dpCatAssign(empId, categoryName) {
  try {
    await api('POST', '/dp/emp-categories/assign', {employeeId: empId, categoryName: categoryName||null});
    // Update local state
    const u = S.users.find(x => x.id === empId);
    if (u) u.category = categoryName || null;
    renderDPConfigTab();
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openDpEmpCatForm(id) {
  const cat = id ? (S.dpEmpCategories||[]).find(x=>x.id===id)||null : null;
  document.getElementById('dpEcfTitle').textContent = cat ? 'Kategorie bearbeiten' : 'Neue Kategorie';
  document.getElementById('dpEcfId').value = cat?.id||'';
  document.getElementById('dpEcfName').value = cat?.name||'';
  document.getElementById('dpEcfColor').value = cat?.color||'#64748b';
  document.getElementById('dpEcfOrder').value = cat?.sort_order||0;
  openModal('dpEmpCatFormOv');
}

async function submitDpEmpCatForm() {
  const id = document.getElementById('dpEcfId').value;
  const body = {
    name: document.getElementById('dpEcfName').value.trim(),
    color: document.getElementById('dpEcfColor').value,
    sortOrder: parseInt(document.getElementById('dpEcfOrder').value)||0,
  };
  if (!body.name) return toast('Name erforderlich','err');
  try {
    if (id) await api('PUT', '/dp/emp-categories/'+id, body);
    else await api('POST', '/dp/emp-categories', body);
    S.dpEmpCategories = await api('GET', '/dp/emp-categories');
    // If renamed, refresh users to get updated category
    const dataResp = await api('GET', '/data').catch(()=>null);
    if (dataResp) S.users = dataResp.users || S.users;
    closeModal('dpEmpCatFormOv');
    renderDPConfigTab();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpEmpCat(id) {
  if (!confirm('Kategorie löschen? Mitarbeiter werden keiner Kategorie zugewiesen.')) return;
  try {
    await api('DELETE', '/dp/emp-categories/'+id);
    S.dpEmpCategories = await api('GET', '/dp/emp-categories');
    const dataResp = await api('GET', '/data').catch(()=>null);
    if (dataResp) S.users = dataResp.users || S.users;
    renderDPConfigTab();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function renderDPConfigSchedulingRules() {
  return `<div class="dp-cfg-card">
    <h3>⚙️ Dienstplanregeln (Planungslogik)</h3>
    <p style="font-size:13px;color:var(--mu);margin-bottom:16px">Regeln und Vorgaben für die Automatische Dienstplan-Generierung</p>

    <div style="background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px">
      <h4 style="margin-top:0;font-size:14px;color:var(--fg)">📊 Überstunden-Ausgleich</h4>
      <ul style="margin:8px 0;padding-left:20px;font-size:13px;line-height:1.6">
        <li>Ziel: Alle Mitarbeiter sollen mit <strong>minimalen Überstunden</strong> enden</li>
        <li>Gleichverteilung: Wenn Überstunden anfallen, dann sollten alle <strong>etwa gleich viele</strong> haben</li>
        <li>Priorisierung:
          <ul style="margin:4px 0;font-size:12px">
            <li>1. MA unter Soll-Stunden erhalten Dienste (Füllen bis zur Sollarbeitszeit)</li>
            <li>2. Wenn alle am/über Soll: der MA mit den <strong>wenigsten Überstunden</strong> erhält den nächsten Dienst</li>
            <li>3. Feiertags-Toleranz: Überstunden dürfen bis zu den Feiertagsstunden im Monat anwachsen</li>
          </ul>
        </li>
        <li>Effekt: MA mit kleineren Sollarbeitszeiten (zB 60h) bekommen nicht überproportional viele Überstunden</li>
      </ul>
    </div>

    <div style="background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px">
      <h4 style="margin-top:0;font-size:14px;color:var(--fg)">🌙 Nachtdienst-Beschränkungen</h4>
      <ul style="margin:8px 0;padding-left:20px;font-size:13px;line-height:1.6">
        <li><strong>Global Max:</strong> 6 Nachtdienste pro Monat (falls in MA-Params nicht anders eingetragen)</li>
        <li>Max aufeinanderfolgende Nächte:
          <ul style="margin:4px 0;font-size:12px">
            <li>Mit Doppelnächte erlaubt: max. 2 aufeinanderfolgende</li>
            <li>Ohne Doppelnächte: max. 1 aufeinanderfolgende</li>
          </ul>
        </li>
        <li>Priorisierung: Mitarbeiter mit weniger Nächten im Monat werden bevorzugt</li>
      </ul>
    </div>

    <div style="background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px">
      <h4 style="margin-top:0;font-size:14px;color:var(--fg)">💼 Dienst-Gewichtungen</h4>
      <ul style="margin:8px 0;padding-left:20px;font-size:13px;line-height:1.6">
        <li>MA können <strong>Prozent-Gewichtungen</strong> (0–100%) pro Dienst eingeben</li>
        <li>Der Generator versucht, die Dienste <strong>proportional</strong> zu verteilen:
          <ul style="margin:4px 0;font-size:12px">
            <li>Beispiel: C1 = 40%, C2 = 40%, C3 = 20% → MA bekommt 40% Zeit C1, 40% Zeit C2, 20% Zeit C3</li>
            <li>Keine Angabe = gleichmäßig auf alle Qualifikationen verteilt</li>
          </ul>
        </li>
        <li>Untererfüllte Dienste werden bevorzugt (Score-Bonus)</li>
      </ul>
    </div>

    <div style="background:var(--sf2);border:1px solid var(--border);border-radius:6px;padding:12px">
      <h4 style="margin-top:0;font-size:14px;color:var(--fg)">📋 Weitere Vorgaben</h4>
      <ul style="margin:8px 0;padding-left:20px;font-size:13px;line-height:1.6">
        <li><strong>Wochenarbeitszeit:</strong> Max. 48h pro Woche (AZG §9)</li>
        <li><strong>Ruhezeit:</strong> Min. 11h zwischen Schichten (AZG §12)</li>
        <li><strong>Wunschtage:</strong> Mitarbeiter können bis zu 3 Wunschtage pro Monat eintragen</li>
        <li><strong>Abwesenheiten:</strong> Mitarbeiter mit Abwesenheit erhalten keinen Dienst an diesem Tag</li>
        <li><strong>Qualifikation:</strong> Nur Mitarbeiter mit Qualifikation für einen Dienst können eingeplant werden</li>
        <li><strong>Bürodienste (Phase 1):</strong> Vor regulären Diensten geplant, basierend auf office_pct (%)</li>
      </ul>
    </div>
  </div>`;
}

function renderDPConfigRules() {
  return `<div class="dp-cfg-card">
    <h3>📋 Österreichische Arbeitszeitgesetz-Regelungen</h3>
    <div style="font-size:13px;line-height:1.6;color:var(--tx)">

      <div style="margin-bottom:20px;padding:12px 14px;background:#ef444412;border-left:4px solid #ef4444;border-radius:6px">
        <div style="font-weight:700;color:#ef4444;font-size:14px;margin-bottom:4px">🔴 Harte Regeln — werden IMMER eingehalten</div>
        <div style="color:var(--mu);font-size:12px">Diese Regeln werden vom Auto-Generieren niemals verletzt. Ist kein geeigneter Mitarbeiter verfügbar, bleibt der Slot unbesetzt und wird im Protokoll dokumentiert.</div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">1. Qualifikationen</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Ein Mitarbeiter muss für den jeweiligen Schichttyp qualifiziert sein. Ohne Qualifikation keine Einteilung.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">2. Abwesenheiten & Doppelbesetzung</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Kein Dienst an Tagen mit Abwesenheit (Urlaub, Krankenstand, …). Kein zweiter Dienst am selben Tag.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">3. Mindestruhezeit: 11 Stunden (AZG §12)</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Zwischen Schichtende und nächster Schicht müssen mindestens 11 Stunden liegen.<br>
          Beispiel: Dienst endet 20:00 → nächster Dienst frühestens 07:00 des Folgetags.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">4. Maximale Wochenarbeitszeit: 48 Stunden (AZG §9)</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Pro Kalenderwoche dürfen maximal 48 Stunden eingeteilt werden.<br>
          Beispiel: 5 × 10h = 50h → ❌ Nicht erlaubt. Maximal 4 × 10h = 40h oder 5 × 9h = 45h pro Woche.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">5. Nachtdienst-Berechtigung</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Mitarbeiter ohne Nachtdienst-Erlaubnis (Parameter: Nachtdienst) werden für Nachtschichten nicht eingeteilt.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">6. Nachtdienst-Ruhezeit: kein Dienst/Abwesenheit am Folgetag</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Nach einem Nachtdienst ist der Folgetag zwingend frei (kein Dienst, keine Abwesenheit).<br>
          Ebenso darf ein Nachtdienst nicht geplant werden, wenn am nächsten Tag bereits ein Dienst oder eine Abwesenheit eingetragen ist.<br>
          Ausnahme: Doppelnacht (zwei aufeinanderfolgende Nächte) ist erlaubt, wenn beim Mitarbeiter aktiviert.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">7. Nach Doppelnacht: mindestens 2 Tage frei</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Nach zwei aufeinanderfolgenden Nachtdiensten (Doppelnacht) müssen mindestens 2 Tage frei bleiben.<br>
          Beispiel: 02.06. Nacht + 03.06. Nacht → 04.06. und 05.06. sind zwingend frei, frühester nächster Dienst: 06.06.
        </div>
      </div>

      <div style="margin:24px 0 20px;padding:12px 14px;background:#f59e0b12;border-left:4px solid #f59e0b;border-radius:6px">
        <div style="font-weight:700;color:#f59e0b;font-size:14px;margin-bottom:4px">🟡 Weiche Regeln — werden im Normalfall eingehalten</div>
        <div style="color:var(--mu);font-size:12px">Diese Regeln werden zunächst strikt angewendet. Wenn kein Mitarbeiter verfügbar ist, darf die weiche Regel im Ausnahmefall verletzt werden. Der Vorgang wird im Protokoll als Regelverstoß dokumentiert.</div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">8. Monatliches Stundenziel</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Mitarbeiter werden nicht über ihr monatliches Stundensoll hinaus eingeteilt.<br>
          Im Ausnahmefall (kein anderer Mitarbeiter verfügbar) kann das Stundenziel überschritten werden.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">9. Maximale aufeinanderfolgende Arbeitstage: 6 Tage</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Nach 6 aufeinanderfolgenden Arbeitstagen muss ein Ruhetag folgen (AZG §12).<br>
          Im Ausnahmefall kann auf 7 aufeinanderfolgende Tage ausgeweitet werden.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">10. Maximale Nachtdienste pro Monat</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Mitarbeiter werden bis zum konfigurierten Limit für Nachtdienste eingeteilt.<br>
          Im Ausnahmefall kann dieses Limit überschritten werden.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">11. Einzelnachtdienste: mindestens 5 Tage Abstand</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Nach einem einzelnen Nachtdienst muss der nächste Nachtdienst mindestens 5 Tage später liegen.<br>
          Beispiel: Nacht am 01.06. → nächste Nacht frühestens 06.06.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">12. Doppelnacht-Blöcke: mindestens 10 Tage Abstand</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Zwischen zwei Doppelnacht-Blöcken (je 2 aufeinanderfolgende Nächte) müssen mindestens 10 Tage liegen.<br>
          Beispiel: Doppelnacht endet 03.06. → nächste Nacht frühestens 13.06.
        </div>
      </div>

      <div style="margin-bottom:14px;margin-left:4px">
        <div style="font-weight:600;margin-bottom:3px">13. Stunden-Fairness &amp; Gleichverteilung (hohe Priorität)</div>
        <div style="color:var(--mu);font-size:12px;margin-left:12px">
          Am Planende sollen alle Mitarbeiter einen möglichst gleichen Über-/Minusstunden-Saldo
          <strong>relativ zu ihrem individuellen Soll</strong> haben — Teilzeitkräfte werden nicht
          überproportional belastet.<br>
          <strong>Fall A (Unterbesetzung):</strong> Reichen die Dienste nicht für alle Sollstunden,
          werden die Minusstunden gleichmäßig verteilt.<br>
          <strong>Fall B (Restkapazität):</strong> Mitarbeiter unter Soll erhalten automatisch
          Zusatzdienst-<em>Vorschläge</em> (C3) im Generierungs-Protokoll — keine automatische Zuweisung.<br>
          <strong>Keine Cluster:</strong> Dienste werden über den ganzen Monat gestreut, nicht in einer
          Monatshälfte gehäuft (gilt auch für Teilzeit). Verstöße erscheinen als „Fairness-Warnung" im Protokoll.
        </div>
      </div>

      <div style="padding:12px;background:#ef444410;border-left:3px solid #ef4444;border-radius:4px;margin-top:16px">
        <strong style="color:#ef4444">⚠️ Unbesetzte Slots & Regelverstöße:</strong><br>
        <div style="color:var(--tx);font-size:12px;margin-top:6px">
          Alle unbesetzten Slots und Regelverstöße werden im Generierungs-<strong>Protokoll</strong> dokumentiert (Grund z.B. weekly_cap_exceeded, rest_period_violated, soft_rule_relaxed).<br>
          Unbesetzte Slots können manuell nachbesetzt werden.
        </div>
      </div>
    </div>
  </div>`;
}

async function renderDPConfigQualifications() {
  let qualifications = [];
  try { qualifications = await api('GET', '/dp/employee-qualifications'); } catch(e) {}
  S.dpQualifications = qualifications;

  let shiftPrefs = [];
  try { shiftPrefs = await api('GET', '/dp/shift-preferences'); } catch(e) {}
  S.dpShiftPrefs = shiftPrefs;

  const shiftTypes = S.dpShiftTypes;
  if (!shiftTypes.length) return '<div style="color:var(--mu)">Zuerst Schichttypen anlegen.</div>';

  // Build qualMap: empId -> Set of stIds (CURRENT qualifications, only non-versioned or today's active)
  const today = new Date().toISOString().slice(0,10);
  const qualMap = {};
  for (const q of qualifications) {
    if (!q.valid_from || q.valid_from <= today) {
      if (!qualMap[q.employee_id]) qualMap[q.employee_id] = new Set();
      qualMap[q.employee_id].add(q.shift_type_id);
    }
  }

  // Build prefMap: empId -> {stId -> weight}
  const prefMap = {};
  for (const p of shiftPrefs) {
    if (!p.valid_from || p.valid_from <= today) {
      if (!prefMap[p.employee_id]) prefMap[p.employee_id] = {};
      prefMap[p.employee_id][p.shift_type_id] = p.preference_weight;
    }
  }

  const searchQuery = (S._dpQualSearchQuery || '').toLowerCase().trim();

  const filteredUsers = S.users.filter(u =>
    !searchQuery || u.name.toLowerCase().includes(searchQuery) || (u.initials||'').toLowerCase().includes(searchQuery)
  );

  const rows = filteredUsers.map(u => {
    const empId = u.id;
    const empQuals = qualMap[empId] || new Set();
    const empPrefs = prefMap[empId] || {};
    const localChanges = S._dpQualLocalChanges[empId] || {adds: new Set(), removes: new Set()};
    const localPrefs = S._dpQualLocalPrefsChanges[empId] || {};

    // Compute current state after local changes
    const currentQuals = new Set(empQuals);
    for (const stId of localChanges.adds) currentQuals.add(stId);
    for (const stId of localChanges.removes) currentQuals.delete(stId);

    // Chips HTML
    const chips = shiftTypes.map(st => {
      const has = currentQuals.has(st.id);
      const changed = localChanges.adds.has(st.id) || localChanges.removes.has(st.id);
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:${has?(st.color+'20'):'var(--bg)'};color:${has?st.color:'var(--mu)'};border:1px solid ${has?st.color:'var(--border)'};border-radius:20px;padding:2px 10px;font-size:12px;cursor:pointer;font-weight:${has?'700':'400'}${changed?';text-decoration:underline':''}" onclick="toggleQualChipLocal('${empId}','${st.id}')" title="${has?'Entfernen':'Hinzufügen'}">
        ${esc(st.code)}${changed?' *':''}
      </span>`;
    }).join(' ');

    // Weight inputs – nur für ausgewählte Dienste
    const selectedShiftTypes = shiftTypes.filter(st => currentQuals.has(st.id));
    const weightsExpanded = !!S._dpQualWeightsExpanded[empId];
    const hasWeightChanges = Object.keys(localPrefs).length > 0;

    // Summe berechnen
    const qualPrefsSum = selectedShiftTypes.reduce((sum, st) => {
      const v = localPrefs[st.id] !== undefined ? localPrefs[st.id] : (empPrefs[st.id] || 0);
      return sum + (parseInt(v) || 0);
    }, 0);
    const remaining = 100 - qualPrefsSum;
    const sumColor = Math.abs(remaining) < 1 ? '#22c55e' : (remaining < 0 ? '#ef4444' : 'var(--mu)');

    let weightsSection = '';
    if (selectedShiftTypes.length > 0) {
      const toggleLabel = weightsExpanded ? '▲ Gewichtungen einklappen' : '▼ Gewichtungen' + (qualPrefsSum > 0 ? ` (${qualPrefsSum}%)` : '');
      const weightsInputs = selectedShiftTypes.map(st => {
        const savedVal = empPrefs[st.id];
        const localVal = localPrefs[st.id];
        const displayVal = localVal !== undefined ? localVal : (savedVal !== undefined ? savedVal : '');
        const changed = localVal !== undefined;
        return `<div style="display:flex;align-items:center;gap:8px;font-size:13px;padding:2px 0${changed?';border-left:3px solid var(--acc);padding-left:5px':''}">
          <span style="min-width:80px;flex-shrink:0">${esc(st.code)}:</span>
          <input type="number" min="0" max="100" value="${displayVal}" placeholder="–" style="width:60px;padding:2px 6px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg)" onchange="updateQualPrefLocal('${empId}','${st.id}',this.value)">
          <span style="color:var(--mu)">%</span>
        </div>`;
      }).join('');

      weightsSection = `<div style="margin-top:6px">
        <button class="btn-s" style="font-size:11px;color:var(--mu)${hasWeightChanges?';border-color:var(--acc);color:var(--acc)':''}" onclick="S._dpQualWeightsExpanded['${empId}']=!S._dpQualWeightsExpanded['${empId}'];renderDPConfigTab()">${toggleLabel}</button>
        ${weightsExpanded ? `<div style="background:var(--bg);padding:8px 12px;border-radius:4px;margin-top:6px;border:1px solid var(--border)">
          ${weightsInputs}
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;font-weight:600;color:${sumColor}">
            Summe: ${qualPrefsSum}% ${remaining !== 0 ? '– noch '+Math.abs(remaining)+'% '+(remaining>0?'verfügbar':'zu viel') : '✓ 100%'}
          </div>
          ${qualPrefsSum === 0 ? '<div style="font-size:11px;color:var(--mu);margin-top:4px">Keine Angabe = gleichmäßig verteilt</div>' : ''}
        </div>` : ''}
      </div>`;
    }

    // Changes detected?
    const hasChanges = localChanges.adds.size > 0 || localChanges.removes.size > 0 || Object.keys(localPrefs).length > 0;

    return `<div style="margin-bottom:16px;padding:12px;background:var(--sf2);border-radius:6px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span class="av-sm" style="background:${u.color}">${esc(u.initials)}</span>
        <span style="font-weight:600;flex:1">${esc(lastNameFirst(u.name))}</span>
        ${hasChanges?'<span style="font-size:11px;color:var(--acc);font-weight:600">● ungespeichert</span>':''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${chips}</div>
      ${weightsSection}
      ${hasChanges?`<div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-s" onclick="submitQualChanges('${empId}',null)">✓ Speichern</button>
        <button class="btn-s" style="background:var(--acc);color:white" onclick="openNewQualVersionDialog('${empId}')">+ Neue Version ab...</button>
      </div>`:''}
    </div>`;
  }).join('');

  const anyDefined = qualifications.length > 0;
  const infoText = anyDefined
    ? `<div style="color:var(--mu);font-size:12px;margin-bottom:10px">Chips klicken zum Aktivieren/Deaktivieren. Gewichtungen definieren den Stundenanteil pro Dienst (z.B. ND1=60%, FD=40% → 60% der Sollstunden als ND1).</div>`
    : `<div style="color:#f59e0b;font-size:12px;margin-bottom:10px">⚠️ Noch keine Qualifikationen definiert — der Scheduler kann jeden Mitarbeiter für jeden Dienst einteilen.</div>`;

  return `<div class="dp-cfg-card">
    <h3>Schicht-Qualifikationen</h3>
    ${infoText}
    <div style="margin-bottom:14px">
      <input type="search" id="dpQualSearchInput" placeholder="Mitarbeiter suchen…" value="${esc(S._dpQualSearchQuery||'')}"
        style="width:100%;padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;box-sizing:border-box"
        oninput="S._dpQualSearchQuery=this.value;renderDPConfigTab().then(()=>{const el=document.getElementById('dpQualSearchInput');if(el){const l=el.value.length;el.focus();el.setSelectionRange(l,l);}})">
    </div>
    ${filteredUsers.length === 0 ? '<div style="color:var(--mu);font-size:13px;padding:8px 0">Keine Mitarbeiter gefunden.</div>' : rows}
  </div>`;
}

function toggleQualChipLocal(empId, stId) {
  if (!S._dpQualLocalChanges[empId]) S._dpQualLocalChanges[empId] = {adds: new Set(), removes: new Set()};
  const ch = S._dpQualLocalChanges[empId];

  // Toggle: if in adds, remove from adds; if in removes, remove from removes; otherwise add to one or the other
  if (ch.adds.has(stId)) {
    ch.adds.delete(stId);
  } else if (ch.removes.has(stId)) {
    ch.removes.delete(stId);
  } else {
    // Check current state
    const today = new Date().toISOString().slice(0,10);
    const qual = S.dpQualifications.find(q => q.employee_id === empId && q.shift_type_id === stId && (!q.valid_from || q.valid_from <= today));
    if (qual) {
      ch.removes.add(stId);
    } else {
      ch.adds.add(stId);
    }
  }
  renderDPConfigTab();
}

function updateQualPrefLocal(empId, stId, value) {
  if (!S._dpQualLocalPrefsChanges[empId]) S._dpQualLocalPrefsChanges[empId] = {};
  const parsed = value === '' || value === null || value === undefined ? null : parseInt(value);
  if (parsed === null) {
    delete S._dpQualLocalPrefsChanges[empId][stId];
  } else {
    S._dpQualLocalPrefsChanges[empId][stId] = Math.max(0, Math.min(100, parsed));
  }
  renderDPConfigTab();
}

async function submitQualChanges(empId, validFrom) {
  const ch = S._dpQualLocalChanges[empId] || {adds: new Set(), removes: new Set()};
  const prefs = S._dpQualLocalPrefsChanges[empId] || {};

  try {
    // Add new qualifications
    for (const stId of ch.adds) {
      await api('POST', '/dp/employee-qualifications', {employeeId: empId, shiftTypeId: stId, validFrom: validFrom});
    }
    // Remove qualifications
    for (const stId of ch.removes) {
      await api('DELETE', `/dp/employee-qualifications/${empId}/${stId}`);
    }
    // Save preference weights (nur gespeicherte Werte, keine null)
    for (const [stId, weight] of Object.entries(prefs)) {
      if (weight !== null && weight !== undefined) {
        await api('POST', '/dp/shift-preferences', {employeeId: empId, shiftTypeId: stId, preferenceWeight: weight, validFrom: validFrom});
      }
    }

    // Clear local changes
    S._dpQualLocalChanges[empId] = {adds: new Set(), removes: new Set()};
    S._dpQualLocalPrefsChanges[empId] = {};

    // Reload qualifications
    S.dpQualifications = await api('GET', '/dp/employee-qualifications');
    S.dpShiftPrefs = await api('GET', '/dp/shift-preferences');

    renderDPConfigTab();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function openNewQualVersionDialog(empId) {
  const dateStr = prompt('Neue Version gültig ab (Format: JJJJ-MM-TT):', '');
  if (!dateStr) return;
  await submitQualChanges(empId, dateStr);
}

function openDpShiftTypeForm(id) {
  const st = id ? S.dpShiftTypes.find(x=>x.id===id)||null : null;
  document.getElementById('dpStfTitle').textContent = st ? 'Schichttyp bearbeiten' : 'Neuer Schichttyp';
  document.getElementById('dpStfId').value = st?.id||'';
  document.getElementById('dpStfName').value = st?.name||'';
  document.getElementById('dpStfCode').value = st?.code||'';
  document.getElementById('dpStfStart').value = st?.start_time||'08:00';
  document.getElementById('dpStfEnd').value = st?.end_time||'20:00';
  document.getElementById('dpStfHours').value = st?.duration_hours||12;
  document.getElementById('dpStfLocation').value = st?.location||'';
  document.getElementById('dpStfRole').value = st?.role||'';
  document.getElementById('dpStfNight').checked = !!st?.is_night;
  document.getElementById('dpStfZulage').checked = !!st?.is_zulage;
  document.getElementById('dpStfOffice').checked = !!st?.is_office;
  document.getElementById('dpStfColor').value = st?.color||'#3b6dd4';
  document.getElementById('dpStfMaxPerEmpPerMonth').value = st?.max_per_emp_per_month || '';
  document.getElementById('dpStfValidFrom').value = st?.valid_from ? String(st.valid_from).slice(0,10) : '';
  document.getElementById('dpStfValidUntil').value = st?.valid_until ? String(st.valid_until).slice(0,10) : '';
  openModal('dpShiftTypeFormOv');
}

async function submitDpShiftTypeForm() {
  const id = document.getElementById('dpStfId').value;
  const body = {
    name: document.getElementById('dpStfName').value.trim(),
    code: document.getElementById('dpStfCode').value.trim().toUpperCase(),
    startTime: document.getElementById('dpStfStart').value,
    endTime: document.getElementById('dpStfEnd').value,
    durationHours: parseFloat(document.getElementById('dpStfHours').value)||12,
    location: document.getElementById('dpStfLocation').value.trim(),
    role: document.getElementById('dpStfRole').value.trim(),
    isNight: document.getElementById('dpStfNight').checked,
    isZulage: document.getElementById('dpStfZulage').checked,
    isOffice: document.getElementById('dpStfOffice').checked,
    color: document.getElementById('dpStfColor').value,
    maxPerEmpPerMonth: document.getElementById('dpStfMaxPerEmpPerMonth').value ? parseInt(document.getElementById('dpStfMaxPerEmpPerMonth').value) : null,
    validFrom: document.getElementById('dpStfValidFrom').value||null,
    validUntil: document.getElementById('dpStfValidUntil').value||null,
  };
  if (!body.name||!body.code) return toast('Name und Code erforderlich','err');
  try {
    let saved;
    if (id) saved = await api('PUT', '/dp/shift-types/'+id, body);
    else saved = await api('POST', '/dp/shift-types', body);
    closeModal('dpShiftTypeFormOv');
    await fetchData();
    renderDPConfig();
    if (saved?.recalcError) toast(saved.recalcError, 'err');
    else toast(id ? 'Gespeichert — bestehende Pläne rückwirkend aktualisiert' : 'Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpShiftType(id) {
  if (!confirm('Schichttyp löschen?')) return;
  try {
    await api('DELETE', '/dp/shift-types/'+id);
    await fetchData();
    renderDPConfig();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openDpAbsenceTypeForm(id) {
  const at = id ? S.dpAbsenceTypes.find(x=>x.id===id)||null : null;
  document.getElementById('dpAtfTitle').textContent = at ? 'Abwesenheitstyp bearbeiten' : 'Neuer Abwesenheitstyp';
  document.getElementById('dpAtfId').value = at?.id||'';
  document.getElementById('dpAtfCode').value = at?.code||'';
  document.getElementById('dpAtfLabel').value = at?.label||'';
  document.getElementById('dpAtfColor').value = at?.color||'#f59e0b';
  document.getElementById('dpAtfHoursCalc').value = at?.hours_calculation||'daily_target';
  document.getElementById('dpAtfFixed').value = at?.fixed_hours||8;
  document.getElementById('dpAtfFixedWrap').style.display = at?.hours_calculation==='fixed' ? '' : 'none';
  document.getElementById('dpAtfAdjTarget').checked = !!at?.adjusts_monthly_target;
  document.getElementById('dpAtfBlocks').checked = at?.blocks_scheduling!==false;
  document.getElementById('dpAtfReopens').checked = at?.reopens_shift!==false;
  document.getElementById('dpAtfCounts').checked = at?.counts_as_worked!==false;
  document.getElementById('dpAtfApproval').checked = !!at?.requires_approval;
  document.getElementById('dpAtfHolidayDefault').checked = !!at?.is_holiday_default;
  document.getElementById('dpAtfValidFrom').value = at?.valid_from ? String(at.valid_from).slice(0,10) : '';
  const zfdEl = document.getElementById('dpAtfZeroFreeDays');
  if (zfdEl) zfdEl.checked = !!at?.zero_on_free_days;
  document.getElementById('dpAtfHoursCalc').onchange = function() {
    document.getElementById('dpAtfFixedWrap').style.display = this.value==='fixed' ? '' : 'none';
  };
  openModal('dpAbsenceTypeFormOv');
}

async function submitDpAbsenceTypeForm() {
  const id = document.getElementById('dpAtfId').value;
  const hc = document.getElementById('dpAtfHoursCalc').value;
  const body = {
    code: document.getElementById('dpAtfCode').value.trim().toUpperCase(),
    label: document.getElementById('dpAtfLabel').value.trim(),
    color: document.getElementById('dpAtfColor').value,
    hoursCalculation: hc,
    fixedHours: hc==='fixed' ? parseFloat(document.getElementById('dpAtfFixed').value)||8 : null,
    adjustsMonthlyTarget: document.getElementById('dpAtfAdjTarget').checked,
    blocksScheduling: document.getElementById('dpAtfBlocks').checked,
    reopensShift: document.getElementById('dpAtfReopens').checked,
    countsAsWorked: document.getElementById('dpAtfCounts').checked,
    requiresApproval: document.getElementById('dpAtfApproval').checked,
    isHolidayDefault: document.getElementById('dpAtfHolidayDefault').checked,
    validFrom: document.getElementById('dpAtfValidFrom').value||null,
    zeroOnFreeDays: document.getElementById('dpAtfZeroFreeDays') ? document.getElementById('dpAtfZeroFreeDays').checked : false,
  };
  if (!body.code||!body.label) return toast('Code und Bezeichnung erforderlich','err');
  try {
    let saved;
    if (id) saved = await api('PUT', '/dp/absence-types/'+id, body);
    else saved = await api('POST', '/dp/absence-types', body);
    closeModal('dpAbsenceTypeFormOv');
    await fetchData();
    renderDPConfig();
    if (saved?.recalcError) toast(saved.recalcError, 'err');
    else toast(id ? 'Gespeichert — bestehende Pläne rückwirkend aktualisiert' : 'Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpAbsenceType(id) {
  if (!confirm('Abwesenheitstyp löschen?')) return;
  try {
    await api('DELETE', '/dp/absence-types/'+id);
    await fetchData();
    renderDPConfig();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function dpEpfSpringerChange() {
  const checked = document.getElementById('dpEpfSpringer').checked;
  document.getElementById('dpEpfFdSpringerSection').style.display = checked ? '' : 'none';
  if (!checked) {
    document.getElementById('dpEpfFdType').value = '';
    document.getElementById('dpEpfFdDetails').style.display = 'none';
  }
}

function dpEpfFdTypeChange() {
  const val = document.getElementById('dpEpfFdType').value;
  document.getElementById('dpEpfFdDetails').style.display = val ? '' : 'none';
}

function _dpEpfFillProfileDropdown(selectedProfileId) {
  const sel = document.getElementById('dpEpfProfileId');
  if (!sel) return;
  sel.innerHTML = `<option value="">— kein Profil (manuelle Eingabe) —</option>` +
    (S.dpHoursProfiles||[]).map(p=>`<option value="${p.id}"${p.id===selectedProfileId?' selected':''}>${esc(p.name)} (${p.monthly_hours}h)</option>`).join('');
}

// "Doppelnächte erlaubt" und "Max. Nächte/Monat" ergeben nur Sinn, wenn der
// Mitarbeiter überhaupt Nachtdienste machen kann — bei deaktivierten
// Nachtdiensten werden beide Felder gesperrt und auf "kein Nachtdienst"
// zurückgesetzt (0 statt "kein Limit"), statt widersprüchliche Werte zu
// erlauben.
function dpEpfNightsChange(){
  const canNights=document.getElementById('dpEpfNights').checked;
  const dbl=document.getElementById('dpEpfDoubleNights');
  const maxN=document.getElementById('dpEpfMaxNights');
  if(!dbl||!maxN)return;
  dbl.disabled=!canNights;
  maxN.disabled=!canNights;
  if(!canNights){dbl.checked=false;maxN.value='0';}
}
function dpEpfProfileChange(profileId) {
  if (!profileId) return;
  const p = (S.dpHoursProfiles||[]).find(x=>x.id===profileId);
  if (!p) return;
  document.getElementById('dpEpfMonthly').value = p.monthly_hours;
  if (p.daily_work_hours) document.getElementById('dpEpfDailyHours').value = p.daily_work_hours;
}

function openDpEmpParamForm(paramId) {
  const p = (window.dpEmpParamsAll||S.dpEmpParams||[]).find(x=>x.id===paramId);
  if (!p) return toast('Parameter nicht gefunden','err');
  const empId = p.employee_id;
  const empSel = document.getElementById('dpEpfEmp');
  empSel.innerHTML = S.users.map(u=>`<option value="${u.id}"${u.id===empId?' selected':''}>${esc(lastNameFirst(u.name))}</option>`).join('');
  empSel.disabled = true;
  document.getElementById('dpEpfEmpId').value = empId;
  document.getElementById('dpEpfParamId').value = p.id;
  document.getElementById('dpEpfValidFrom').value = p.valid_from ? String(p.valid_from).slice(0,10) : '';
  document.getElementById('dpEpfMonthly').value = p.monthly_hours || (p.weekly_hours ? Math.round(p.weekly_hours*4.33) : 160);
  document.getElementById('dpEpfDailyHours').value = p?.daily_hours || '';
  _dpEpfFillProfileDropdown(p.profile_id||'');
  document.getElementById('dpEpfNights').checked = !!p.can_do_nights;
  document.getElementById('dpEpfDoubleNights').checked = !!p.double_nights_allowed;
  document.getElementById('dpEpfSpringer').checked = !!p.is_springer;
  document.getElementById('dpEpfMaxNights').value = p.max_nights_per_month||'';
  document.getElementById('dpEpfOfficePct').value = p.office_pct||0;
  const hasFdSpringer = !!p.fd_springer_type;
  document.getElementById('dpEpfFdSpringerSection').style.display = p.is_springer ? '' : 'none';
  document.getElementById('dpEpfFdType').value = p.fd_springer_type||'';
  document.getElementById('dpEpfFdLocation').value = p.fd_springer_location||'Nord';
  document.getElementById('dpEpfFdShifts').value = p.fd_springer_shifts_per_month||'';
  document.getElementById('dpEpfFdDetails').style.display = hasFdSpringer ? '' : 'none';
  const noWEEl = document.getElementById('dpEpfNoWeekends');
  if (noWEEl) noWEEl.checked = !!p?.no_weekends;
  const xmasEl = document.getElementById('dpEpfXmasRotation');
  if (xmasEl) xmasEl.checked = p?.xmas_rotation_participant !== false;
  dpEpfNightsChange();
  openModal('dpEmpParamFormOv');
}

function openDpEmpParamFormNew(empId) {
  // Pre-fill with latest existing config for this employee as starting point
  const allParams = (window.dpEmpParamsAll||S.dpEmpParams||[]).filter(x=>x.employee_id===empId);
  const latest = allParams.sort((a,b)=>{
    if (a.valid_from===null) return -1;
    if (b.valid_from===null) return 1;
    return String(b.valid_from).localeCompare(String(a.valid_from));
  })[0] || null;
  const empSel = document.getElementById('dpEpfEmp');
  empSel.innerHTML = S.users.map(u=>`<option value="${u.id}"${u.id===empId?' selected':''}>${esc(lastNameFirst(u.name))}</option>`).join('');
  empSel.disabled = true;
  document.getElementById('dpEpfEmpId').value = empId;
  document.getElementById('dpEpfParamId').value = '';
  document.getElementById('dpEpfValidFrom').value = '';
  document.getElementById('dpEpfMonthly').value = latest?.monthly_hours || (latest?.weekly_hours ? Math.round(latest.weekly_hours*4.33) : 160);
  document.getElementById('dpEpfDailyHours').value = latest?.daily_hours || '';
  _dpEpfFillProfileDropdown(latest?.profile_id||'');
  document.getElementById('dpEpfNights').checked = latest ? !!latest.can_do_nights : true;
  document.getElementById('dpEpfDoubleNights').checked = latest ? !!latest.double_nights_allowed : true;
  document.getElementById('dpEpfSpringer').checked = !!latest?.is_springer;
  document.getElementById('dpEpfMaxNights').value = latest?.max_nights_per_month||'';
  document.getElementById('dpEpfOfficePct').value = latest?.office_pct||0;
  const hasFdSpringer = !!latest?.fd_springer_type;
  document.getElementById('dpEpfFdSpringerSection').style.display = latest?.is_springer ? '' : 'none';
  document.getElementById('dpEpfFdType').value = latest?.fd_springer_type||'';
  document.getElementById('dpEpfFdLocation').value = latest?.fd_springer_location||'Nord';
  document.getElementById('dpEpfFdShifts').value = latest?.fd_springer_shifts_per_month||'';
  document.getElementById('dpEpfFdDetails').style.display = hasFdSpringer ? '' : 'none';
  const noWEElNew = document.getElementById('dpEpfNoWeekends');
  if (noWEElNew) noWEElNew.checked = !!latest?.no_weekends;
  const xmasElNew = document.getElementById('dpEpfXmasRotation');
  if (xmasElNew) xmasElNew.checked = latest?.xmas_rotation_participant !== false;
  dpEpfNightsChange();
  openModal('dpEmpParamFormOv');
}

async function submitDpEmpParamForm() {
  const empId = document.getElementById('dpEpfEmpId').value || document.getElementById('dpEpfEmp').value;
  if (!empId) return toast('Mitarbeiter auswählen','err');
  const isSpringer = document.getElementById('dpEpfSpringer').checked;
  const fdType = isSpringer ? (document.getElementById('dpEpfFdType').value||null) : null;
  const body = {
    employeeId: empId,
    validFrom: document.getElementById('dpEpfValidFrom').value||null,
    monthlyHours: parseFloat(document.getElementById('dpEpfMonthly').value)||160,
    canDoNights: document.getElementById('dpEpfNights').checked,
    doubleNightsAllowed: document.getElementById('dpEpfDoubleNights').checked,
    isSpringer,
    maxNightsPerMonth: document.getElementById('dpEpfMaxNights').value ? parseInt(document.getElementById('dpEpfMaxNights').value) : null,
    officePct: parseInt(document.getElementById('dpEpfOfficePct').value)||0,
    fdSpringerType: fdType,
    fdSpringerLocation: fdType ? (document.getElementById('dpEpfFdLocation').value||null) : null,
    fdSpringerShiftsPerMonth: fdType ? (parseInt(document.getElementById('dpEpfFdShifts').value)||null) : null,
    dailyHours: document.getElementById('dpEpfDailyHours').value ? parseFloat(document.getElementById('dpEpfDailyHours').value) : null,
    profileId: document.getElementById('dpEpfProfileId').value || null,
    noWeekends: document.getElementById('dpEpfNoWeekends') ? document.getElementById('dpEpfNoWeekends').checked : false,
    xmasRotationParticipant: document.getElementById('dpEpfXmasRotation') ? document.getElementById('dpEpfXmasRotation').checked : true,
  };
  try {
    await api('POST', '/dp/employee-params', body);
    closeModal('dpEmpParamFormOv');
    document.getElementById('dpEpfEmp').disabled = false;
    _refreshDpEmpParamsView(empId);
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpEmpParam(id) {
  if (!confirm('Diese Parameterversion löschen?')) return;
  const p = (window.dpEmpParamsAll||S.dpEmpParams||[]).find(x=>x.id===id);
  try {
    await api('DELETE', '/dp/employee-params/'+id);
    _refreshDpEmpParamsView(p?.employee_id);
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}
// Nach dem Speichern/Löschen einer Dienstplan-Parameterversion die passende
// Ansicht aktualisieren: eingebetteter Abschnitt im Benutzer-Formular, wenn
// dieses gerade offen ist, sonst (Fallback) die klassische DP-Konfig-Ansicht.
function _refreshDpEmpParamsView(empId) {
  const ufOpen = document.getElementById('ufOv')?.classList.contains('open');
  if (ufOpen && empId) renderUfDpParamsSection(empId);
  else renderDPConfig();
}

function openDpEmpRuleForm(empId) {
  document.getElementById('dpErfEmpId').value = empId;
  document.getElementById('dpErfType').value = 'always_free';
  document.getElementById('dpErfDay').value = '1';
  const stSel = document.getElementById('dpErfShiftType');
  stSel.innerHTML = S.dpShiftTypes.map(st=>`<option value="${st.id}">${esc(st.code)} – ${esc(st.name)}</option>`).join('');
  dpErfTypeChange();
  openModal('dpEmpRuleFormOv');
}

function dpErfTypeChange() {
  const v = document.getElementById('dpErfType').value;
  document.getElementById('dpErfShiftWrap').style.display = (v==='always_shift'||v==='if_shift_then') ? '' : 'none';
}

async function submitDpEmpRuleForm() {
  const empId = document.getElementById('dpErfEmpId').value;
  const ruleType = document.getElementById('dpErfType').value;
  const dayOfWeek = parseInt(document.getElementById('dpErfDay').value);
  const shiftTypeId = (ruleType==='always_shift'||ruleType==='if_shift_then') ? document.getElementById('dpErfShiftType').value : null;
  if (!empId||!ruleType) return toast('Pflichtfelder fehlen','err');
  try {
    await api('POST', '/dp/emp-rules', {employeeId:empId, ruleType, dayOfWeek, shiftTypeId});
    closeModal('dpEmpRuleFormOv');
    await fetchData();
    renderDPConfigTab();
    toast('Fixregel gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpEmpRule(id) {
  if (!confirm('Fixregel löschen?')) return;
  try {
    await api('DELETE', '/dp/emp-rules/'+id);
    await fetchData();
    renderDPConfigTab();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openDpReqForm(req) {
  document.getElementById('dpRfTitle').textContent = req ? 'Bedarf bearbeiten' : 'Schichtbedarf';
  document.getElementById('dpRfId').value = req?.id||'';
  const stSel = document.getElementById('dpRfShiftType');
  stSel.innerHTML = S.dpShiftTypes.map(st=>`<option value="${st.id}"${req?.shift_type_id===st.id?' selected':''}>${esc(st.code)} – ${esc(st.name)}</option>`).join('');
  document.getElementById('dpRfAppliesTo').value = req?.applies_to||'weekday';
  document.getElementById('dpRfWeekday').value = req?.weekday||'';
  const specDate = req?.specific_date ? String(req.specific_date).slice(0,10) : '';
  document.getElementById('dpRfDate').value = specDate;
  document.getElementById('dpRfSlots').value = req?.slot_count||1;
  document.getElementById('dpRfValidFrom').value = req?.valid_from ? String(req.valid_from).slice(0,10) : '';
  document.getElementById('dpRfValidUntil').value = req?.valid_until ? String(req.valid_until).slice(0,10) : '';
  onDpRfTypeChange();
  openModal('dpReqFormOv');
}

function onDpRfTypeChange() {
  const v = document.getElementById('dpRfAppliesTo').value;
  document.getElementById('dpRfWeekdayWrap').style.display = v==='weekday' ? '' : 'none';
  document.getElementById('dpRfDateWrap').style.display = v==='date' ? '' : 'none';
}

async function submitDpReqForm() {
  const id = document.getElementById('dpRfId').value;
  const appliesTo = document.getElementById('dpRfAppliesTo').value;
  const body = {
    shiftTypeId: document.getElementById('dpRfShiftType').value,
    appliesTo,
    weekday: appliesTo==='weekday' ? (document.getElementById('dpRfWeekday').value ? parseInt(document.getElementById('dpRfWeekday').value) : null) : null,
    specificDate: appliesTo==='date' ? document.getElementById('dpRfDate').value : null,
    slotCount: parseInt(document.getElementById('dpRfSlots').value)||1,
    validFrom: document.getElementById('dpRfValidFrom').value||null,
    validUntil: document.getElementById('dpRfValidUntil').value||null,
  };
  if (!body.shiftTypeId) return toast('Schichttyp erforderlich','err');
  try {
    if (id) await api('PUT', '/dp/shift-requirements/'+id, body);
    else await api('POST', '/dp/shift-requirements', body);
    closeModal('dpReqFormOv');
    renderDPConfig();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteDpRequirement(id) {
  if (!confirm('Schichtbedarf löschen?')) return;
  try {
    await api('DELETE', '/dp/shift-requirements/'+id);
    renderDPConfig();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIENSTPLAN — WEIHNACHTSDIENST-ROTATION
// ═══════════════════════════════════════════════════════════════════════════
// EIN Datensatz je Kalendertag für Historie, Score UND Wunsch — die Schichtart
// steckt jeweils im Zellwert (TD/ND bzw. Wunsch TD/ND), nicht mehr in der Spalte.
const XMAS_CALENDAR_DAY_KEYS = ['24.12','25.12','26.12','31.12','01.01'];
const XMAS_CALENDAR_DAY_LABEL = {'24.12':'24. Dezember','25.12':'25. Dezember','26.12':'26. Dezember','31.12':'31. Dezember','01.01':'1. Jänner'};
// Für die "gesperrte Zellen"-Logik (Jahre/Tage außerhalb des Dienstverhältnisses)
// — spiegelt CHRISTMAS_CALENDAR_DAYS aus lib/dp-rules.js (Backend hat keinen
// direkten Zugriff auf diese Client-Datei, daher bewusst dupliziert).
const XMAS_CALENDAR_DAY_META = {
  '24.12': {month:12, day:24, yearOffset:0}, '25.12': {month:12, day:25, yearOffset:0},
  '26.12': {month:12, day:26, yearOffset:0}, '31.12': {month:12, day:31, yearOffset:0},
  '01.01': {month:1,  day:1,  yearOffset:1},
};
function xmasCalendarDateFor(year, calDayKey) {
  const m = XMAS_CALENDAR_DAY_META[calDayKey]; if (!m) return null;
  return `${year+m.yearOffset}-${String(m.month).padStart(2,'0')}-${String(m.day).padStart(2,'0')}`;
}
// Zelle gesperrt = liegt vor Eintritt oder nach Austritt des Mitarbeiters.
function xmasCellLocked(emp, year, calDayKey) {
  const d = xmasCalendarDateFor(year, calDayKey);
  if (emp.hireDate && d < emp.hireDate) return true;
  if (emp.terminationDate && d > emp.terminationDate) return true;
  return false;
}

function xmasFmtScore(s) {
  if (!s) return '0';
  const r = Math.round(s*10)/10;
  return (r>0?'+':'') + (Number.isInteger(r) ? r : r.toFixed(1));
}

async function renderDPChristmas() {
  const el = document.getElementById('main');
  if (!el) return;
  if (!S.p.canManageDp) { el.innerHTML = '<div style="padding:20px;color:var(--mu)">Kein Zugriff</div>'; return; }

  const canEditHistory = S.p.manageUsers;
  const year = S._xmasYear || (S._xmasYear = new Date().getFullYear());
  const histCount = S._xmasHistYearsCount || (S._xmasHistYearsCount = 3);
  const histYears = Array.from({length: histCount}, (_,i) => year - histCount + i);
  if (S._xmasShowExcluded === undefined) S._xmasShowExcluded = true;

  el.innerHTML = '<div style="padding:20px;color:var(--mu)">Lade Weihnachtsdienst-Rotation…</div>';

  let employees = [];
  try { employees = await api('GET', '/dp/christmas/employees'); } catch(e) {}
  S._xmasEmployees = employees;
  const participantCount = employees.filter(e => e.xmasParticipant && e.isActive).length;

  let history = [], proposal = null, wishes = [], scores = {};
  try {
    [history, proposal, wishes, scores] = await Promise.all([
      api('GET', '/dp/christmas/history?years=' + histYears.join(',')),
      api('GET', '/dp/christmas/proposal?year=' + year),
      api('GET', '/dp/christmas/wishes?year=' + year),
      api('GET', '/dp/christmas/scores'),
    ]);
  } catch(e) { el.innerHTML = `<div style="padding:20px;color:#ef4444">Fehler beim Laden: ${esc(e.message)}</div>`; return; }
  S._xmasHistory = history; S._xmasProposal = proposal; S._xmasWishes = wishes; S._xmasScores = scores;

  el.innerHTML = `<div class="dp-wrap">
    <div class="dp-toolbar">
      <h2>🎄 Weihnachtsdienst-Rotation</h2>
      <div class="yr-row" style="margin:0"><button class="yb" onclick="S._xmasYear=${year-1};renderDPChristmas()">‹</button><span class="yv">${year}</span><button class="yb" onclick="S._xmasYear=${year+1};renderDPChristmas()">›</button></div>
      <div style="flex:1"></div>
      <span style="font-size:11px;color:var(--mu)">${participantCount} Mitarbeiter in der Rotation${employees.length>participantCount?` · ${employees.length-participantCount} ausgenommen/inaktiv`:''}</span>
    </div>
    <div style="flex:1;overflow:auto;padding:16px">
      <div style="margin-bottom:12px;font-size:12px;color:var(--mu)">
        Historie: eine Zelle je Kalendertag mit den Werten <strong>TD</strong> (Tagdienst gearbeitet), <strong>ND</strong> (Nachtdienst gearbeitet), <strong>UR</strong> (Urlaub) oder <strong>–</strong> (regulär frei). Score je Mitarbeiter und Tag (eine Dimension, nicht nach Schichtart getrennt): TD/ND → <strong>+1</strong>, ND an 24.12./31.12. mit Faktor <strong>1,5</strong> (höhere Belastung), UR → <strong>−1</strong>, „–" trägt nichts bei.
        Vorschlag ${year} je Tag (nicht mehr getrennt nach Tag-/Nachtdienst, da Mitarbeiter flexibel eingeteilt werden): Frei-Slots = Gesamt-Mitarbeiterzahl − Gesamtbedarf (Tag- + Nachtdienst zusammen), zusätzlich begrenzt durch das bestehende <strong>Urlaubskontingent</strong> (Dienstplan → Urlaubsübersicht) — die jeweils engere der beiden Grenzen entscheidet, wie viele MA an einem Tag insgesamt frei bekommen können. Zwei Wunsch-Arten mit unterschiedlicher Wirkung: <strong>UR</strong> = bereits <strong>genehmigter, fixer</strong> Urlaub — geht immer, unabhängig vom Score, und zieht zuerst von den Frei-Slots ab (Szenario „Urlaube sind schon entschieden, wer soll arbeiten?"). <strong>U</strong> = unverbindlicher <strong>Wunsch</strong> — die übrigen Mitarbeiter mit Wunsch U konkurrieren um die danach noch freien Slots, wer den <strong>höchsten Score</strong> hat (in der Vergangenheit am meisten gearbeitet) bekommt „Urlaub empfohlen" (Szenario „wer ist heuer am ehesten berechtigt?"). Alle übrigen gelten als „Arbeit vorgeschlagen" — diese Liste steht immer zuerst (braucht am ehesten eine Entscheidung), sortiert nach dem <strong>niedrigsten Score zuerst</strong> (wer bisher am wenigsten gearbeitet hat, ist am ehesten dran), auch wenn noch gar kein Wunsch eingetragen wurde. Zusätzlich wird über die 5 Tage hinweg ausgeglichen: wer an einem früheren Tag schon priorisiert wurde, rutscht am nächsten Tag zurück, damit sich die Arbeitstage auf mehrere Mitarbeiter verteilen statt sich auf wenige mit durchgehend niedrigem Score zu konzentrieren. „Urlaub empfohlen" folgt danach, „Urlaub genehmigt (fix)" — schon entschieden, braucht keine Prüfung mehr — steht ganz unten. Übersteigt die Zahl genehmigter Urlaube die Frei-Slots, wird das als Unterbesetzung markiert, ohne die Genehmigung zurückzunehmen. Wunsch <strong>TD</strong>/<strong>ND</strong> ist nur ein Präferenz-Hinweis für die spätere Schichtzuteilung im Dienstplan-Modul und beeinflusst diesen Vorschlag nicht. Der Wunsch selbst fließt nicht in den Score ein, erst der später eingetragene finale Historienwert.
        Ausgenommene (Mitarbeiterverwaltung → Rotation) und inaktive Mitarbeiter (kein aktuelles Dienstverhältnis) fließen nicht in Score, Kapazität oder Vorschlag ein.
        Reine Empfehlung — der Dienstplan wird dadurch <strong>nicht</strong> automatisch verändert.
      </div>
      <div id="xmasProposalBox">${renderXmasProposalCards(proposal)}</div>

      <div style="margin:20px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:14px">📋 Historie, Score &amp; Urlaubswunsch ${year}</span>
        <button class="btn-s" style="font-size:11px;padding:2px 8px" onclick="S._xmasHistYearsCount=${histCount+1};renderDPChristmas()">+ weiteres Jahr</button>
        ${histCount>1?`<button class="btn-s" style="font-size:11px;padding:2px 8px" onclick="S._xmasHistYearsCount=${histCount-1};renderDPChristmas()">− Jahr entfernen</button>`:''}
        <label style="font-size:11px;color:var(--mu);display:flex;align-items:center;gap:4px;cursor:pointer;margin-left:8px">
          <input type="checkbox" ${S._xmasShowExcluded?'checked':''} onchange="S._xmasShowExcluded=this.checked;refreshXmasBoxes()"> Ausgenommene Mitarbeiter anzeigen
        </label>
      </div>
      <div style="font-size:11px;color:var(--mu);margin-bottom:8px">
        <span style="color:#f59e0b">■</span> Historie (${canEditHistory?'Zelle klicken: — / TD / ND / UR / –':'nur Planungsberechtigte können bearbeiten'})
        &nbsp;·&nbsp; <span style="color:#3b82f6">■</span> Score (berechnet, alle Jahre)
        &nbsp;·&nbsp; <span style="color:#8b5cf6">■</span> Wunsch ${year} (Zelle klicken: — / U / TD / ND / UR — UR = bereits genehmigt/fix)
        &nbsp;·&nbsp; <span style="opacity:.5">grau = von der Rotation ausgenommen oder inaktiv</span>
        &nbsp;·&nbsp; <span style="opacity:.5">schraffiert = gesperrt (außerhalb Dienstverhältnis)</span>
      </div>
      <div id="xmasMatrixBox">${renderXmasMatrix(employees, histYears, history, scores, wishes, year, canEditHistory)}</div>
    </div>
  </div>`;
}

// Nach einer Zellen-Änderung nur die Matrix + Vorschlags-Karten neu laden
// (statt der ganzen Seite) — Scrollposition bleibt erhalten.
async function refreshXmasBoxes() {
  const year = S._xmasYear, histCount = S._xmasHistYearsCount;
  const histYears = Array.from({length: histCount}, (_,i) => year - histCount + i);
  const employees = S._xmasEmployees || [];
  const canEditHistory = S.p.manageUsers;
  let history = [], proposal = null, wishes = [], scores = {};
  try {
    [history, proposal, wishes, scores] = await Promise.all([
      api('GET', '/dp/christmas/history?years=' + histYears.join(',')),
      api('GET', '/dp/christmas/proposal?year=' + year),
      api('GET', '/dp/christmas/wishes?year=' + year),
      api('GET', '/dp/christmas/scores'),
    ]);
  } catch(e) { toast('⚠️ '+e.message,'err'); return; }
  S._xmasHistory = history; S._xmasProposal = proposal; S._xmasWishes = wishes; S._xmasScores = scores;

  const propEl = document.getElementById('xmasProposalBox'); if (propEl) propEl.innerHTML = renderXmasProposalCards(proposal);
  const matrixEl = document.getElementById('xmasMatrixBox'); if (matrixEl) matrixEl.innerHTML = renderXmasMatrix(employees, histYears, history, scores, wishes, year, canEditHistory);
}

const XMAS_REC_LABEL = {
  off_approved: {text: '🔒 Urlaub genehmigt (fix)', bg:'rgba(5,150,105,.18)', fg:'#059669'},
  off_recommended: {text: '✓ Urlaub empfohlen', bg:'rgba(16,185,129,.15)', fg:'#10b981'},
  work_suggested: {text: 'Arbeit vorgeschlagen', bg:'rgba(148,163,184,.15)', fg:'#64748b'},
};
// Liefert Badge-Text/Farbe für JEDEN Mitarbeiter an diesem Tag — unabhängig
// davon, ob ein Wunsch hinterlegt wurde. Die Empfehlung gilt pro TAG (nicht
// mehr getrennt nach Tag-/Nachtdienst). "off_approved" (Wunsch UR) ist eine
// bereits fixe Genehmigung und kann NICHT durch den Score außer Kraft gesetzt
// werden; nur wer Wunsch U (unverbindlich) hatte und trotzdem arbeiten muss,
// bekommt die Warnung. Wunsch TD/ND ist reiner Präferenz-Hinweis für die
// spätere Schichtzuteilung im Dienstplan und beeinflusst diese Empfehlung nicht.
function xmasRecBadge(e) {
  if (e.recommendation === 'work_suggested' && e.wish === 'U')
    return {text:'⚠ Arbeit trotz Urlaubswunsch (Score)', bg:'rgba(239,68,68,.12)', fg:'#ef4444'};
  return XMAS_REC_LABEL[e.recommendation] || XMAS_REC_LABEL.work_suggested;
}

// Zeigt IMMER alle Mitarbeiter dieser Rotation mit ihrer Tages-Empfehlung —
// nicht nur die, die für das aktuelle Jahr einen Wunsch angemeldet haben. So
// bleibt auch dann sichtbar, wer arbeiten soll, wenn (noch) niemand einen
// Urlaubswunsch eingetragen hat. Eine Karte je Kalendertag (nicht mehr je
// Tag/Nachtdienst-Kombination) — die Zuteilung zu Tag-/Nachtdienst erfolgt
// im Dienstplan-Modul.
function renderXmasProposalCards(proposal) {
  if (!proposal) return '';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-bottom:8px">
    ${proposal.days.map(d => {
      const dateFmt = d.date.slice(8,10)+'.'+d.date.slice(5,7)+'.'+d.date.slice(0,4);
      return `<div style="background:var(--sf);border:1px solid var(--border);border-radius:var(--r);padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <strong style="font-size:13px">${esc(d.label)}</strong>
          <span style="font-size:11px;color:var(--mu)">${dateFmt}</span>
        </div>
        <div style="font-size:11px;color:var(--mu);margin-bottom:8px">
          Bedarf: <strong>${d.requiredCount}</strong> <span style="opacity:.7">(Tag ${d.dayRequired} / Nacht ${d.nightRequired})</span> · Frei-Slots: <strong>${d.freeSlots}</strong> · Urlaubskontingent: <strong>${d.approvedCount+d.offRecommendedCount}/${d.quotaMax}</strong> · Genehmigt: <strong style="color:#059669">${d.approvedCount}</strong> · Empfohlen frei: <strong style="color:#10b981">${d.offRecommendedCount}</strong>
        </div>
        ${d.capacityShortfall>0?`<div style="font-size:11px;color:#ef4444;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:5px 8px;margin-bottom:6px">⚠ Unterbesetzung: ${d.capacityShortfall} Mitarbeiter zu wenig für den Schichtbedarf (mehr genehmigte Urlaube als Personal-Kapazität)</div>`:''}
        ${d.quotaShortfall>0?`<div style="font-size:11px;color:#ef4444;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:5px 8px;margin-bottom:8px">⚠ Urlaubskontingent überschritten: ${d.quotaShortfall} genehmigte Urlaube mehr als das Kontingent (${d.quotaMax}) erlaubt</div>`:''}
        ${(() => {
          const work = d.employees.filter(e => e.recommendation==='work_suggested');
          const off = d.employees.filter(e => e.recommendation!=='work_suggested');
          const empRow = e => { const b = xmasRecBadge(e); return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 6px;border-radius:4px;background:${b.bg}">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(lastNameFirst(e.name))}">${esc(lastNameFirst(e.name))}${e.wish?` <span style="opacity:.6">(Wunsch ${e.wish})</span>`:''}</span>
            <span style="color:var(--mu);font-variant-numeric:tabular-nums" title="Score für diesen Tag">${xmasFmtScore(e.score)}</span>
            <span class="bdg" style="font-size:10px;background:${b.bg};color:${b.fg}">${b.text}</span>
          </div>`; };
          return `
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:3px">Arbeit vorgeschlagen (${work.length})</div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;margin-bottom:8px">
            ${!work.length?'<div style="font-size:11px;color:var(--di)">Niemand</div>':work.map(empRow).join('')}
          </div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--di);margin-bottom:3px">Urlaub gewünscht / genehmigt (${off.length})</div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:3px">
            ${!off.length?'<div style="font-size:11px;color:var(--di)">Niemand</div>':off.map(empRow).join('')}
          </div>`;
        })()}
      </div>`;
    }).join('')}
  </div>`;
}

const XMAS_NAME_CELL = 'text-align:left;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;position:sticky;left:0;background:var(--sf)';
const XMAS_LOCKED_STYLE = 'background-image:repeating-linear-gradient(45deg,var(--sf2) 0px,var(--sf2) 4px,transparent 4px,transparent 8px);cursor:not-allowed;color:var(--di)';

// Eine gemeinsame Tabelle statt dreier breiter Einzeltabellen: Historie
// (editierbar) | Score (berechnet) | Urlaubswunsch aktuelles Jahr (editierbar)
// — je EINE Spalte pro Kalendertag (5), da Score seit der Neufassung nicht
// mehr nach Schichtart getrennt geführt wird. Ausgenommene/inaktive
// Mitarbeiter werden ausgegraut (ganze Zeile); Zellen außerhalb des
// Dienstverhältnis-Fensters (vor Eintritt/nach Austritt) werden zusätzlich
// UNABHÄNGIG davon je Zelle gesperrt/schraffiert dargestellt.
function renderXmasMatrix(employees, histYears, history, scores, wishes, year, canEditHistory) {
  const visible = S._xmasShowExcluded===false ? employees.filter(e => e.xmasParticipant && e.isActive) : employees;
  if (!visible.length) return '<div class="empty">Keine Mitarbeiter mit Dienstplan-Parametern vorhanden.</div>';
  const histMap = {};
  history.forEach(h => { histMap[`${h.employee_id}|${h.year}|${h.day_key}`] = h.status; });
  const wishMap = {};
  wishes.forEach(w => { if (w.wish) wishMap[`${w.employee_id}|${w.day_key}`] = w.wish; });

  const dayCell = 'text-align:center;font-size:11px;padding:3px 4px;min-width:24px';
  const statusStyle = { '': 'color:var(--di)', 'TD': 'color:#10b981;font-weight:700', 'ND': 'color:#0ea5e9;font-weight:700', 'UR': 'color:#f59e0b;font-weight:700', '–': 'color:var(--di);font-weight:600' };
  const wishStyle = { '': 'color:var(--di)', 'U': 'color:#f59e0b;font-weight:700', 'TD': 'color:#10b981;font-weight:700', 'ND': 'color:#0ea5e9;font-weight:700', 'UR': 'color:#059669;font-weight:700' };
  const scoreColor = s => s>0?'#10b981':s<0?'#ef4444':'var(--mu)';

  const groupBorder = 'border-left:2px solid var(--border)';
  const scoreBorder = 'border-left:2px solid #3b82f6';
  const wishBorder  = 'border-left:2px solid #8b5cf6';

  const dayHeadCells = (border) => XMAS_CALENDAR_DAY_KEYS.map((dk,i) => `<th style="${dayCell}${i===0?';'+border:''}" title="${XMAS_CALENDAR_DAY_LABEL[dk]}">${dk}</th>`).join('');
  const headYear1 = histYears.map(y => `<th colspan="5" style="text-align:center;${groupBorder}">${y}</th>`).join('');
  const headYear2 = histYears.map(() => dayHeadCells(groupBorder)).join('');

  return `<div class="tw" style="overflow-x:auto"><table class="rm-table" style="font-size:11px">
    <thead>
      <tr>
        <th rowspan="2" style="text-align:left;vertical-align:bottom;position:sticky;left:0;background:var(--sf2);z-index:1">Mitarbeiter</th>
        ${headYear1}
        <th colspan="5" style="text-align:center;${scoreBorder};color:#3b82f6">Score</th>
        <th colspan="5" style="text-align:center;${wishBorder};color:#8b5cf6">Wunsch ${year}</th>
      </tr>
      <tr>
        ${headYear2}
        ${dayHeadCells(scoreBorder)}
        ${dayHeadCells(wishBorder)}
      </tr>
    </thead>
    <tbody>
      ${visible.map(emp => {
        const excluded = !emp.xmasParticipant;
        const inactive = emp.isActive===false;
        const rowStyle = (excluded||inactive) ? 'opacity:.45;font-style:italic' : '';
        const titleParts = [excluded?'Von der Weihnachtsdienst-Rotation ausgenommen (Mitarbeiterverwaltung)':'', inactive?'Kein aktuelles Dienstverhältnis (inaktiv)':''].filter(Boolean);
        return `<tr style="${rowStyle}" title="${titleParts.join(' · ')}">
        <td style="${XMAS_NAME_CELL}${(excluded||inactive)?';background:var(--sf2)':''}" title="${esc(lastNameFirst(emp.name))}">${esc(lastNameFirst(emp.name))}${excluded?' 🚫':''}${inactive?' ⏸':''}</td>
        ${histYears.map(y => XMAS_CALENDAR_DAY_KEYS.map((dk,i) => {
          const locked = xmasCellLocked(emp, y, dk);
          const st = histMap[`${emp.id}|${y}|${dk}`] || '';
          const onclick = (canEditHistory && !locked) ? `onclick="cycleXmasCell('${emp.id}',${y},'${dk}')"` : '';
          const style = locked ? XMAS_LOCKED_STYLE : `${canEditHistory?'cursor:pointer':''};${statusStyle[st]||statusStyle['']}`;
          const title = locked ? 'Gesperrt – außerhalb des Dienstverhältnisses' : (canEditHistory?'Klicken zum Ändern (—/TD/ND/UR/–)':'');
          return `<td style="${dayCell}${i===0?';'+groupBorder:''};${style}" ${onclick} title="${title}">${locked?'':(st||'—')}</td>`;
        }).join('')).join('')}
        ${XMAS_CALENDAR_DAY_KEYS.map((dk,i) => {
          const s = scores[emp.id]?.[dk] ?? 0;
          return `<td style="${dayCell}${i===0?';'+scoreBorder:''};color:${scoreColor(s)};font-weight:700">${xmasFmtScore(s)}</td>`;
        }).join('')}
        ${XMAS_CALENDAR_DAY_KEYS.map((dk,i) => {
          const locked = xmasCellLocked(emp, year, dk);
          const canEditWish = S.p.manageUsers || emp.id===S.currentUser;
          const w = wishMap[`${emp.id}|${dk}`] || '';
          const onclick = (canEditWish && !locked) ? `onclick="cycleXmasWish('${emp.id}',${year},'${dk}')"` : '';
          const style = locked ? XMAS_LOCKED_STYLE : `${canEditWish?'cursor:pointer':''};${wishStyle[w]||wishStyle['']}`;
          const title = locked ? 'Gesperrt – außerhalb des Dienstverhältnisses' : (canEditWish?'Klicken zum Ändern (—/U/TD/ND/UR — UR = bereits genehmigt/fix)':'');
          return `<td style="${dayCell}${i===0?';'+wishBorder:''};${style}" ${onclick} title="${title}">${locked?'':(w||'—')}</td>`;
        }).join('')}
      </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

// Zyklus: — (kein Wunsch) → U (Wunsch, unverbindlich) → TD (Tagdienst) → ND (Nachtdienst) → UR (bereits genehmigt/fix) → —
async function cycleXmasWish(employeeId, year, dayKey) {
  const cur = S._xmasWishes.find(w => w.employee_id===employeeId && w.day_key===dayKey);
  const next = {'':'U', 'U':'TD', 'TD':'ND', 'ND':'UR', 'UR':''}[cur?.wish || ''];
  try {
    await api('PUT', '/dp/christmas/wishes', {employeeId, year, dayKey, wish: next||null});
    await refreshXmasBoxes();
  } catch(e) { toast('⚠️ '+e.message,'err'); }
}

// Zyklus: — (kein Eintrag) → TD (Tagdienst) → ND (Nachtdienst) → UR (Urlaub) → – (regulär frei) → —
async function cycleXmasCell(employeeId, year, dayKey) {
  const cur = S._xmasHistory.find(h => h.employee_id===employeeId && h.year===year && h.day_key===dayKey);
  const next = {'':'TD', 'TD':'ND', 'ND':'UR', 'UR':'–', '–':''}[cur?.status || ''];
  try {
    await api('PUT', '/dp/christmas/history', {employeeId, year, dayKey, status: next||null});
    await refreshXmasBoxes();
  } catch(e) { toast('⚠️ '+e.message,'err'); }
}


// ═══════════════════════════════════════════════════════════════════════════
// DIENSTPLAN — MEIN DIENSTPLAN
// ═══════════════════════════════════════════════════════════════════════════

async function renderDPMine() {
  const el = document.getElementById('main');
  if (!el) return;

  const now = new Date();
  const selMonth = S._dpMineMonth || (now.getMonth()+1);
  const selYear = S._dpMineYear || now.getFullYear();
  S._dpMineMonth = selMonth;
  S._dpMineYear = selYear;

  // Find published plan for this month
  const plan = S.dpPlans.find(p=>p.month===selMonth&&p.year===selYear&&p.status==='published');

  let wishDays = [];
  try {
    wishDays = await api('GET', `/dp/wish-days?month=${selMonth}&year=${selYear}`);
  } catch(e) {}

  const myWishDays = wishDays.filter(w=>w.employee_id===S.currentUser);

  let matrixData = null;
  if (plan) {
    try { matrixData = await api('GET', '/dp/plans/'+plan.id+'/matrix'); } catch(e) {}
  }

  const myAssignments = matrixData ? (matrixData.empAssignMap[S.currentUser]||{}) : {};
  const shiftTypes = matrixData?.shiftTypes||S.dpShiftTypes;
  const absenceTypes = matrixData?.absenceTypes||S.dpAbsenceTypes;

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(selYear, selMonth-1, d);
    const dateStr = date.toISOString().slice(0,10);
    days.push({date:dateStr, weekday:date.getDay()});
  }

  let calRows = '';
  const weeks = [];
  let week = new Array(7).fill(null);
  for (const d of days) {
    const wd = d.weekday;
    week[wd] = d;
    if (wd===6||d===days[days.length-1]) {
      weeks.push([...week]);
      week = new Array(7).fill(null);
    }
  }

  for (const w of weeks) {
    let tds = w.map((d,i) => {
      if (!d) return '<td style="background:var(--bg2)"></td>';
      const a = myAssignments[d.date];
      const st = shiftTypes.find(x=>x.id===a?.shift_type_id);
      const at = absenceTypes.find(x=>x.id===a?.absence_type_id);
      const isWE = i===0||i===6;
      const wd = myWishDays.find(w=>String(w.date).slice(0,10)===d.date);
      let bg = isWE ? 'var(--bg2)' : '';
      let content = '';
      if (a) {
        const color = at ? at.color : (st ? st.color : '#ccc');
        const label = at ? at.code : (st ? st.code : '');
        content = `<span style="background:${color}22;color:${dpTextColor(color)};border-radius:4px;padding:2px 6px;font-weight:700;font-size:12px">${esc(label)}</span>`;
        if (at && st) content += `<br><span style="font-size:10px;color:var(--mu)">${esc(st.code)}</span>`;
      }
      const wishBadge = wd ? `<span title="Wunschtag${wd.status==='violated'?' (verletzt)':''}" style="font-size:12px">${wd.status==='violated'?'❌':'⭐'}</span>` : '';
      return `<td style="padding:6px;vertical-align:top;min-height:60px;background:${bg};border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--mu)">${d.date.slice(8)}.</div>
        <div style="margin-top:2px">${content}</div>
        <div style="margin-top:2px">${wishBadge}</div>
      </td>`;
    }).join('');
    calRows += `<tr>${tds}</tr>`;
  }

  const canAddWish = myWishDays.length < 3;

  el.innerHTML = `<div style="padding:16px;max-width:900px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <h2 style="margin:0;font-size:16px;font-weight:700">👤 Mein Dienstplan</h2>
      <button class="btn-s" onclick="S._dpMineMonth=${selMonth===1?12:selMonth-1};S._dpMineYear=${selMonth===1?selYear-1:selYear};renderDPMine()">◀</button>
      <span style="font-weight:600">${MONTH_NAMES[selMonth-1]} ${selYear}</span>
      <button class="btn-s" onclick="S._dpMineMonth=${selMonth===12?1:selMonth+1};S._dpMineYear=${selMonth===12?selYear+1:selYear};renderDPMine()">▶</button>
      ${!plan?'<span style="color:var(--mu);font-size:12px">Kein freigegebener Plan für diesen Monat</span>':''}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr>${['So','Mo','Di','Mi','Do','Fr','Sa'].map(d=>`<th style="padding:6px;text-align:center;background:var(--bg2);border:1px solid var(--border);font-size:13px">${d}</th>`).join('')}</tr></thead>
      <tbody>${calRows}</tbody>
    </table>

    <div style="background:var(--bg2);border-radius:10px;padding:14px">
      <h3 style="margin:0 0 10px;font-size:14px">⭐ Wunschtage (${myWishDays.length}/3)</h3>
      ${myWishDays.length ? myWishDays.map(w=>`
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px">
          <span style="font-size:14px">${w.status==='violated'?'❌':'⭐'}</span>
          <span>${String(w.date).slice(0,10)}</span>
          <span style="color:var(--mu)">${esc(w.reason||'')}</span>
          <button class="btn-s" style="color:#ef4444;margin-left:auto" onclick="deleteDpWishDay('${w.id}')">✕</button>
        </div>`).join('') : '<div style="color:var(--mu);font-size:13px">Keine Wunschtage</div>'}
      ${canAddWish ? `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" id="dpWishDate" style="font-size:13px" min="${selYear}-${String(selMonth).padStart(2,'0')}-01" max="${selYear}-${String(selMonth).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}">
        <input type="text" id="dpWishReason" placeholder="Grund (optional)" style="font-size:13px;flex:1">
        <button class="btn-p" onclick="addDpWishDay(${selMonth},${selYear})">+ Wunschtag</button>
      </div>` : '<div style="color:var(--mu);font-size:12px;margin-top:8px">Maximum von 3 Wunschtagen erreicht</div>'}
    </div>
  </div>`;
}

async function addDpWishDay(month, year) {
  const date = document.getElementById('dpWishDate').value;
  const reason = document.getElementById('dpWishReason').value.trim();
  if (!date) return toast('Datum erforderlich','err');
  try {
    await api('POST', '/dp/wish-days', {date, month, year, reason});
    renderDPMine();
    toast('Wunschtag gespeichert');
  } catch(e) { toast(e.message,'err'); }
}

async function deleteDpWishDay(id) {
  try {
    await api('DELETE', '/dp/wish-days/'+id);
    renderDPMine();
    toast('Wunschtag gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// TODOS
// ═══════════════════════════════════════════════════════════════════════════

const TODO_PRIO = {
  low:    {label:'Niedrig', color:'#10b981', dot:'🟢'},
  medium: {label:'Mittel',  color:'#f59e0b', dot:'🟡'},
  high:   {label:'Hoch',    color:'#ef4444', dot:'🔴'},
};

function renderTodos() {
  const el = document.getElementById('main');
  if (!el) return;

  const todos = S.todos;
  // Abgeschlossen = eigener Status des Todos ist "done" (per "✓ Abschließen"-
  // Button gesetzt) — NICHT von den Punkten abgeleitet: ein Todo ganz ohne
  // Punkte (z.B. "morgen XY anrufen") hat nie Punkte zum Abhaken und würde bei
  // einer Punkte-basierten Ableitung nie als abgeschlossen erkannt werden.
  const isTodoDone = t => t.status === 'done';
  const openTodos = todos.filter(t => !isTodoDone(t));
  const doneTodos = todos.filter(isTodoDone);
  const selId = S._selTodo;
  const sel   = todos.find(t => t.id === selId) || openTodos[0] || todos[0] || null;
  if (sel && !S._selTodo) S._selTodo = sel.id;

  const todoSideItem = t => {
    const done    = t.items.filter(i => i.is_done).length;
    const total   = t.items.length;
    // Ausgegraut wird nach demselben Kriterium wie oben/unten einsortiert
    // (t.status), nicht nach den Punkten — sonst bleibt ein abgeschlossenes
    // Todo ohne Punkte (oder mit noch offenen Punkten trotz Abschluss) fett.
    const allDone = isTodoDone(t);
    const prio    = TODO_PRIO[t.priority] || TODO_PRIO.medium;
    const active  = t.id === (sel?.id);
    const deadlineColor = getDeadlineColorFromItems(t.items);
    const hasUnread = t._hasUnreadNotifications;
    return `<div class="todo-item${active?' active':''}${allDone?' done':''}" onclick="S._selTodo='${t.id}';renderTodos()" style="${deadlineColor?'border-left:4px solid '+deadlineColor+'!important':''}">
      <div class="todo-item-title" style="display:flex;align-items:center;gap:6px">
        ${hasUnread?'<span style="width:8px;height:8px;background:#ef4444;border-radius:50%;flex-shrink:0"></span>':''}
        <span style="flex:1">${esc(t.title)}</span>
      </div>
      <div class="todo-item-meta">
        <span class="todo-prio" style="background:${prio.color}"></span>
        <span>${prio.label}</span>
        ${total > 0 ? `<span style="margin-left:auto">${done}/${total}</span>` : ''}
      </div>
    </div>`;
  };

  const showDone = !!S._showDoneTodos;
  const sideItems =
    (openTodos.map(todoSideItem).join('') || '<div style="padding:16px;color:var(--mu);font-size:13px">Keine offenen Todos</div>')
    + (doneTodos.length ? `
      <div style="display:flex;align-items:center;gap:6px;padding:10px 12px 6px;cursor:pointer;user-select:none;color:var(--mu);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--border);margin-top:8px"
           onclick="S._showDoneTodos=!S._showDoneTodos;renderTodos()">
        <span>${showDone?'▼':'▶'}</span><span style="flex:1">✔ Abgeschlossene Todos</span><span style="font-weight:400">(${doneTodos.length})</span>
      </div>
      ${showDone?doneTodos.map(todoSideItem).join(''):''}` : '');

  el.innerHTML = `<div class="todos-layout">
    <div class="todos-sidebar">
      <div class="todos-sidebar-hdr">
        <h3>✅ Todos</h3>
        <button class="btn-p" style="padding:5px 10px;font-size:12px" onclick="openTodoForm()">+</button>
      </div>
      <div class="todos-list">${sideItems}</div>
    </div>
    <div class="todos-detail" id="todosDetail">
      ${sel ? renderTodoDetail(sel) : '<div style="color:var(--mu);padding:40px 0;text-align:center">Kein Todo ausgewählt</div>'}
    </div>
  </div>`;
}

function renderTodoDetail(t) {
  // Mark notifications as read when opening todo
  if(t._hasUnreadNotifications){
    api('POST',`/todos/${t.id}/mark-read`).catch(()=>{});
  }

  const done  = t.items.filter(i => i.is_done).length;
  const total = t.items.length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;
  const prio  = TODO_PRIO[t.priority] || TODO_PRIO.medium;
  const assignee = t.assigned_to ? getU(t.assigned_to) : null;
  const creator  = getU(t.created_by);
  const deadlineColor = getDeadlineColorFromItems(t.items);

  const canManageTodo = t._canManage || false;
  const itemsHtml = t.items.map(item => {
    const doneUser = item.done_by ? getU(item.done_by) : null;
    const assignees = item.assignees || [];
    const assigneeNames = assignees.map(a => {
      const u = getU(a.user_id);
      return u ? lastNameFirst(u.name) : '?';
    }).join(', ');
    const canEditItem = item._canEdit || false;
    const itemDeadlineColor = getDeadlineColor(item.due_date);
    const convertedTk = item.converted_ticket_id ? getTk(item.converted_ticket_id) : null;
    const convertedBy = item.converted_by ? getU(item.converted_by) : null;
    const convertedHtml = item.converted_ticket_id
      ? `<div class="todo-ci-meta">🎫 Umgewandelt in Ticket ${convertedTk?`<a href="javascript:void(0)" onclick="openTkDetail('${item.converted_ticket_id}')" style="font-weight:600">${convertedTk.number}</a>`:'(nicht einsehbar)'}${convertedBy?` von ${esc(lastNameFirst(convertedBy.name))}`:''}${item.converted_at?' · '+String(item.converted_at).slice(0,16).replace('T',' '):''}</div>`
      : '';
    return `<div class="todo-ci${item.is_done?' done-item':''}" id="todo-ci-${item.id}"${itemDeadlineColor?` style="border-left:4px solid ${itemDeadlineColor}"`:''}>
      <input type="checkbox" ${item.is_done?'checked':''} ${canEditItem?'':'disabled'} onchange="toggleTodoItem('${t.id}','${item.id}',this.checked)">
      <div class="todo-ci-body">
        <div class="todo-ci-title"${canEditItem?` style="cursor:pointer" onclick="openTodoItemForm('${t.id}','${item.id}')" title="Bearbeiten"`:''}>
          ${esc(item.title)}
          ${item.due_date ? `<span style="font-size:11px;color:${itemDeadlineColor||'#64748b'};font-weight:${itemDeadlineColor?'600':'400'};margin-left:8px">📅 ${String(item.due_date).slice(0,10)}</span>` : ''}
        </div>
        <textarea id="todo-comment-${item.id}" class="todo-ci-textarea" rows="1" placeholder="Kommentar…" ${canEditItem?`onblur="saveTodoItemComment('${t.id}','${item.id}')"`:''} ${canEditItem?'':'readonly'}>${esc(item.comment||'')}</textarea>
        ${assigneeNames ? `<div class="todo-ci-meta">👤 ${assigneeNames}</div>` : ''}
        ${item.is_done && doneUser ? `<div class="todo-ci-meta">Erledigt von ${esc(lastNameFirst(doneUser.name))} · ${item.done_at?String(item.done_at).slice(0,16).replace('T',' '):''}</div>` : ''}
        ${convertedHtml}
      </div>
      <div class="todo-ci-actions">
        ${canManageTodo&&t.items.indexOf(item)>0 ? `<button class="btn-s" style="padding:5px 9px;font-size:14px" title="Nach oben" onclick="moveTodoItem('${t.id}','${item.id}','up')">⬆</button>` : ''}
        ${canManageTodo&&t.items.indexOf(item)<t.items.length-1 ? `<button class="btn-s" style="padding:5px 9px;font-size:14px" title="Nach unten" onclick="moveTodoItem('${t.id}','${item.id}','down')">⬇</button>` : ''}
        ${canEditItem ? `<button class="btn-s" style="padding:5px 9px;font-size:14px" title="Bearbeiten" onclick="openTodoItemForm('${t.id}','${item.id}')">✏️</button>` : ''}
        ${canEditItem ? `<button class="btn-s" style="padding:5px 9px;font-size:14px" title="Zuweisungen" onclick="openTodoItemAssignees('${t.id}','${item.id}')">👥</button>` : ''}
        ${canEditItem&&!item.converted_ticket_id ? `<button class="btn-s" style="padding:5px 9px;font-size:14px" title="In Ticket umwandeln" onclick="openConvertTodoItem('${t.id}','${item.id}')">🎫</button>` : ''}
        ${canEditItem ? `<button class="btn-d" style="padding:5px 9px;font-size:14px" title="Löschen" onclick="deleteTodoItem('${t.id}','${item.id}')">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const protokollHtml = (t.protokoll||[]).length > 0 ? [...(t.protokoll||[])].reverse().map(e=>{
    const u=getU(e.by); const uName=u?lastNameFirst(u.name):'?'; const ts=String(e.ts||'').slice(0,16).replace('T',' ');
    let html = `<div style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:6px;font-size:12px">`;
    if(e.type==='updated') {
      const changes = e.changes||{};
      const changeLines = Object.entries(changes).map(([k,v])=>`<div style="margin-left:8px;color:var(--mu)">${k}: <b>${esc(String(v.from||''))}</b> → <b>${esc(String(v.to||''))}</b></div>`).join('');
      html += `<div style="font-weight:600;margin-bottom:4px">📝 ${ts} · ${uName}</div>${changeLines}</div>`;
    } else if(e.type==='assignee_added') {
      const aUser = getU(e.userId);
      html += `<div style="font-weight:600">👤 ${ts} · ${uName}</div><div style="margin-left:8px;color:var(--mu)">Zugewiesen an <b>${esc(aUser?lastNameFirst(aUser.name):'?')}</b></div></div>`;
    } else if(e.type==='assignee_removed') {
      const aUser = getU(e.userId);
      html += `<div style="font-weight:600">👤 ${ts} · ${uName}</div><div style="margin-left:8px;color:var(--mu)">Zuordnung von <b>${esc(aUser?lastNameFirst(aUser.name):'?')}</b> entfernt</div></div>`;
    } else if(e.type==='converted_to_ticket') {
      const tk=getTk(e.ticketId);
      html += `<div style="font-weight:600">🎫 ${ts} · ${uName}</div><div style="margin-left:8px;color:var(--mu)">Punkt „<b>${esc(e.itemTitle||'?')}</b>“ in Ticket ${tk?`<a href="javascript:void(0)" onclick="openTkDetail('${e.ticketId}')" style="font-weight:600">${tk.number}</a>`:esc(e.ticketNumber||'?')} umgewandelt</div></div>`;
    } else {
      html += `${ts} · ${uName} (${e.type})</div>`;
    }
    return html;
  }).join('') : '<div style="color:var(--mu);font-size:12px;padding:8px">Noch keine Änderungen dokumentiert</div>';

  const statusColor = t.status === 'done' ? '#10b981' : t.status === 'cancelled' ? '#94a3b8' : '#f59e0b';
  const statusLabel = {open:'Offen', done:'Erledigt', cancelled:'Abgebrochen'}[t.status] || t.status;

  return `<div>
    <div class="todos-detail-hdr"${deadlineColor?` style="border-left:4px solid ${deadlineColor}"`:''}>
      <div style="flex:1">
        <h2>${esc(t.title)}</h2>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:12px">${prio.dot} ${prio.label}</span>
          <span style="font-size:12px;color:${statusColor};font-weight:600">${statusLabel}</span>
          ${assignee ? `<span style="font-size:12px;color:var(--mu)">👤 ${esc(lastNameFirst(assignee.name))}</span>` : ''}
          ${creator ? `<span style="font-size:12px;color:var(--di)">erstellt von ${esc(lastNameFirst(creator.name))}</span>` : ''}
        </div>
        ${t.description ? `<div style="margin-top:8px;font-size:13px;color:var(--mu)">${esc(t.description)}</div>` : ''}
      </div>
      ${canManageTodo ? `<div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-s" onclick="openTodoForm('${t.id}')">✏️ Bearbeiten</button>
        ${t.status !== 'done' ? `<button class="btn-ok" onclick="setTodoStatus('${t.id}','done')">✓ Abschließen</button>` : `<button class="btn-warn" onclick="setTodoStatus('${t.id}','open')">↩ Wiederöffnen</button>`}
        <button class="btn-d" onclick="deleteTodo('${t.id}')">🗑</button>
      </div>` : ''}
    </div>

    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin:12px 0">
      <button style="padding:4px 8px;border:none;background:${(S._todoTab||'punkte')==='punkte'?'var(--acc)':'transparent'};color:${(S._todoTab||'punkte')==='punkte'?'#fff':'var(--tx)'};cursor:pointer;font-weight:500;font-size:12px;border-radius:4px 0 0 0" onclick="S._todoTab='punkte';renderTodos()">Punkte</button>
      <button style="padding:4px 8px;border:none;background:${S._todoTab==='notizen'?'var(--acc)':'transparent'};color:${S._todoTab==='notizen'?'#fff':'var(--tx)'};cursor:pointer;font-weight:500;font-size:12px" onclick="S._todoTab='notizen';renderTodos()">Notizen${(t.notes||[]).length?` (${t.notes.length})`:''}</button>
      <button style="padding:4px 8px;border:none;background:${S._todoTab==='protokoll'?'var(--acc)':'transparent'};color:${S._todoTab==='protokoll'?'#fff':'var(--tx)'};cursor:pointer;font-weight:500;font-size:12px;border-radius:0 4px 0 0" onclick="S._todoTab='protokoll';renderTodos()">Protokoll</button>
    </div>

    ${(S._todoTab||'punkte')==='punkte' ? `
      ${total > 0 ? `<div class="todo-progress" title="${pct}% erledigt">
        <div class="todo-progress-bar" style="width:${pct}%"></div>
      </div>
      <div style="font-size:12px;color:var(--mu);margin-bottom:12px">${done} von ${total} Punkten erledigt (${pct}%)</div>` : ''}

      <div class="todo-checklist">${itemsHtml}</div>

      ${canManageTodo ? `<button class="btn-p" style="margin-top:14px" onclick="openTodoItemForm('${t.id}')">+ Punkt hinzufügen</button>` : ''}
    ` : S._todoTab==='notizen' ? `
      <div style="padding:8px 0">
        <div class="nfeed">${renderTodoNotesFeed(t)}</div>
        <div style="margin-top:12px;display:flex;gap:7px;align-items:flex-end">
          <textarea id="todoNoteInput" rows="6" placeholder="Notiz … (@Name für Erwähnung)" style="font-size:13px;width:100%;box-sizing:border-box;flex:1" oninput="S._todoNoteDraft=this.value">${esc(S._todoNoteDraft||'')}</textarea>
          <button class="btn-p" onclick="addTodoNote('${t.id}')" style="padding:8px 12px;flex-shrink:0">Senden</button>
        </div>
      </div>
    ` : `
      <div style="padding:12px 0">${protokollHtml}</div>
    `}
  </div>`;
}
function renderTodoNotesFeed(t){
  const notes=t.notes||[];
  if(!notes.length)return`<div style="color:var(--di);font-size:12px;padding:8px 0">Noch keine Notizen.</div>`;
  return notes.map(n=>{
    const a=getU(n.authorId);
    const canEditNote=n.authorId===S.currentUser||S.p.manageUsers;
    const isEditing=S._editingTodoNoteId===n.id;
    const body=isEditing
      ?`<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
          <textarea id="todoNoteEditInput-${n.id}" rows="3" style="font-size:13px;width:100%;box-sizing:border-box">${esc(n.text)}</textarea>
          <div style="display:flex;gap:6px">
            <button class="btn-p" style="font-size:11px;padding:3px 10px" onclick="saveEditTodoNote('${t.id}','${n.id}')">Speichern</button>
            <button class="btn-s" style="font-size:11px;padding:3px 10px" onclick="cancelEditTodoNote()">Abbrechen</button>
          </div>
        </div>`
      :`<div style="font-size:13px;line-height:1.5;color:var(--tx);white-space:pre-wrap;margin-top:2px">${highlightMentions(n.text)}${n.editedAt?'<span style="font-size:10px;color:var(--di);margin-left:4px">(bearbeitet)</span>':''}</div>`;
    return`<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="font-size:10px;color:var(--di)">${a?`${avHtml(a.initials,a.color,14,6)} ${esc(lastNameFirst(a.name))} · `:''}${fdt(n.createdAt)}</div>
        ${!isEditing&&canEditNote?`<div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-s" style="padding:1px 6px;font-size:10px" onclick="startEditTodoNote('${n.id}')">✏️</button>
          <button class="btn-d" style="padding:1px 6px;font-size:10px" onclick="deleteTodoNote('${t.id}','${n.id}')">✕</button>
        </div>`:''}
      </div>
      ${body}
    </div>`;
  }).join('');
}
function startEditTodoNote(noteId){S._editingTodoNoteId=noteId;renderTodos();const ta=document.getElementById('todoNoteEditInput-'+noteId);if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}}
function cancelEditTodoNote(){S._editingTodoNoteId=null;renderTodos();}
async function saveEditTodoNote(todoId,noteId){
  const ta=document.getElementById('todoNoteEditInput-'+noteId);if(!ta)return;
  const text=ta.value.trim();if(!text)return;
  try{
    await api('PUT','/todos/'+todoId+'/notes/'+noteId,{text});
    S._editingTodoNoteId=null;await fetchData();renderTodos();toast('✅ Notiz aktualisiert');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteTodoNote(todoId,noteId){
  if(!confirm('Notiz löschen?'))return;
  try{
    await api('DELETE','/todos/'+todoId+'/notes/'+noteId);
    await fetchData();renderTodos();toast('✅ Notiz gelöscht');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function addTodoNote(todoId){
  const ta=document.getElementById('todoNoteInput');if(!ta?.value.trim())return;
  try{
    await api('POST','/todos/'+todoId+'/notes',{text:ta.value.trim()});
    S._todoNoteDraft='';
    await fetchData();renderTodos();
  }catch(e){toast('⚠️ '+e.message,'err');}
}

function openTodoForm(id) {
  const t = id ? S.todos.find(x => x.id === id) : null;
  document.getElementById('todoFormTitle').textContent = t ? 'Todo bearbeiten' : 'Neues Todo';
  document.getElementById('todoFormId').value = t?.id || '';
  document.getElementById('tfTitle').value = t?.title || '';
  document.getElementById('tfDesc').value = t?.description || '';
  document.getElementById('tfPriority').value = t?.priority || 'medium';
  const asel = document.getElementById('tfAssignee');
  asel.innerHTML = '<option value="">— niemand —</option>' +
    S.users.map(u => `<option value="${u.id}"${t?.assigned_to===u.id?' selected':''}>${esc(lastNameFirst(u.name))}</option>`).join('');
  openModal('todoFormOv');
}

async function submitTodoForm() {
  const id    = document.getElementById('todoFormId').value;
  const title = document.getElementById('tfTitle').value.trim();
  if (!title) return toast('Titel erforderlich','err');
  const body = {
    title,
    description: document.getElementById('tfDesc').value.trim(),
    priority:    document.getElementById('tfPriority').value,
    assignedTo:  document.getElementById('tfAssignee').value || null,
  };
  try {
    if (id) await api('PUT', '/todos/'+id, body);
    else {
      const t = await api('POST', '/todos', body);
      S._selTodo = t.id;
    }
    closeModal('todoFormOv');
    await fetchData();
    renderTodos();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteTodo(id) {
  if (!confirm('Todo und alle Punkte löschen?')) return;
  try {
    await api('DELETE', '/todos/'+id);
    if (S._selTodo === id) S._selTodo = null;
    await fetchData();
    renderTodos();
    toast('Gelöscht');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function setTodoStatus(id, status) {
  try {
    await api('PUT', '/todos/'+id, {status});
    await fetchData();
    renderTodos();
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openTodoItemForm(todoId, itemId) {
  const t    = S.todos.find(x => x.id === todoId);
  const item = itemId ? t?.items.find(x => x.id === itemId) : null;
  document.getElementById('todoItemFormTitle').textContent = item ? 'Punkt bearbeiten' : 'Punkt hinzufügen';
  document.getElementById('tifId').value     = item?.id || '';
  document.getElementById('tifTodoId').value = todoId;
  document.getElementById('tifTitle').value   = item?.title || '';
  document.getElementById('tifDue').value    = item?.due_date ? String(item.due_date).slice(0,10) : '';
  document.getElementById('tifComment').value = item?.comment || '';
  openModal('todoItemFormOv');
}

async function submitTodoItemForm() {
  const id     = document.getElementById('tifId').value;
  const todoId = document.getElementById('tifTodoId').value;
  const title  = document.getElementById('tifTitle').value.trim();
  if (!title) return toast('Bezeichnung erforderlich','err');
  const body = {
    title,
    dueDate: document.getElementById('tifDue').value || null,
    comment: document.getElementById('tifComment').value.trim(),
  };
  try {
    if (id) await api('PUT', `/todos/${todoId}/items/${id}`, body);
    else    await api('POST', `/todos/${todoId}/items`, body);
    closeModal('todoItemFormOv');
    await fetchData();
    renderTodos();
    toast('Gespeichert');
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

// Gemeinsames Modal für "In Ticket umwandeln" — wird sowohl von Todo-Punkten
// als auch von Besprechungspunkten genutzt (kind: 'todo' | 'meeting').
function openConvertTodoItem(todoId, itemId) {
  const t = S.todos.find(x => x.id === todoId); if (!t) return;
  const item = t.items.find(x => x.id === itemId); if (!item) return;
  if (item.converted_ticket_id) { toast('Punkt wurde bereits umgewandelt','err'); return; }
  const prioMap = {low:'low', medium:'medium', high:'high', urgent:'high'};
  openConvertItemModal({kind:'todo', ids:{todoId, itemId}, title:item.title, priority: prioMap[t.priority] || 'medium', description: item.comment||''});
}
function openConvertMeetingItem(itemId) {
  const item = S.meetings.flatMap(m => m.instances.flatMap(i => i.items)).find(x => x.id === itemId);
  if (!item) return;
  if (item.convertedTicketId) { toast('Punkt wurde bereits umgewandelt','err'); return; }
  openConvertItemModal({kind:'meeting', ids:{itemId}, title:item.title, priority:'medium', description: item.description||item.result||''});
}
function openConvertItemModal({kind, ids, title, priority, description}) {
  S._convertCtx = {kind, ids};
  document.getElementById('ctiTitlePreview').textContent = title;
  document.getElementById('ctiDesc').value = description || '';
  document.getElementById('ctiDescHint').style.display = kind==='meeting' ? '' : 'none';
  document.getElementById('ctiErr').textContent = '';
  document.getElementById('ctiPrio').value = priority || 'medium';
  document.getElementById('ctiDept').innerHTML = DEPTS.map(d=>`<option value="${d}">${DEPT_LABELS[d]||d}</option>`).join('');
  document.getElementById('ctiAssignee').innerHTML = '<option value="">— niemand —</option>' +
    S.users.filter(isAssignable).map(u => `<option value="${u.id}">${esc(lastNameFirst(u.name))}</option>`).join('');
  openModal('convertTodoOv');
}
async function submitConvertTodoItem() {
  const ctx = S._convertCtx; if (!ctx) return;
  const department = document.getElementById('ctiDept').value;
  const priority = document.getElementById('ctiPrio').value;
  const description = document.getElementById('ctiDesc').value.trim();
  const assigneeId = document.getElementById('ctiAssignee').value || null;
  const errEl = document.getElementById('ctiErr'); errEl.textContent = '';
  const url = ctx.kind === 'todo'
    ? `/todos/${ctx.ids.todoId}/items/${ctx.ids.itemId}/convert-to-ticket`
    : `/discussion-items/${ctx.ids.itemId}/convert-to-ticket`;
  try {
    const res = await api('POST', url, {department, priority, assigneeId, description});
    closeModal('convertTodoOv');
    await fetchData();
    if (ctx.kind === 'todo') { renderTodos(); }
    else { renderMeetings(); openItemForm(document.getElementById('itInstanceId').value, ctx.ids.itemId); }
    toast(`✅ Ticket ${res.number} erstellt`);
  } catch(e) { errEl.textContent = '⚠️ ' + e.message; }
}

async function toggleTodoItem(todoId, itemId, isDone) {
  const commentEl = document.getElementById('todo-comment-'+itemId);
  const comment = commentEl ? commentEl.value : undefined;
  try {
    await api('PUT', `/todos/${todoId}/items/${itemId}`, {isDone, ...(comment!==undefined ? {comment} : {})});
    // Neu laden statt nur lokal zu patchen — sonst bleibt z.B. das Protokoll
    // (wird serverseitig korrekt geschrieben) im Client veraltet, bis
    // irgendeine andere Aktion zufällig ein fetchData() auslöst.
    await fetchData();
    const detail = document.getElementById('todosDetail');
    const todo2  = S.todos.find(t => t.id === todoId);
    if (detail && todo2) detail.innerHTML = renderTodoDetail(todo2);
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function saveTodoItemComment(todoId, itemId) {
  const el = document.getElementById('todo-comment-'+itemId);
  if (!el) return;
  const comment = el.value;
  const todo = S.todos.find(t => t.id === todoId);
  const item = todo?.items.find(i => i.id === itemId);
  if (item && item.comment === comment) return; // no change
  try {
    await api('PUT', `/todos/${todoId}/items/${itemId}`, {comment});
    // Siehe toggleTodoItem: neu laden, damit das Protokoll nicht veraltet.
    await fetchData();
    const detail = document.getElementById('todosDetail');
    const todo2  = S.todos.find(t => t.id === todoId);
    if (detail && todo2) detail.innerHTML = renderTodoDetail(todo2);
  } catch(e) { toast('Fehler beim Speichern','err'); }
}

async function moveTodoItem(todoId, itemId, direction) {
  try {
    await api('POST',`/todos/${todoId}/items/${itemId}/move`,{direction});
    await fetchData();
    renderTodos();
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

async function deleteTodoItem(todoId, itemId) {
  try {
    await api('DELETE', `/todos/${todoId}/items/${itemId}`);
    await fetchData();
    renderTodos();
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

function openTodoItemAssignees(todoId, itemId) {
  const todo = S.todos.find(t => t.id === todoId);
  const item = todo?.items.find(i => i.id === itemId);
  if (!item) return;
  const assignees = item.assignees || [];
  const assignedIds = new Set(assignees.map(a => a.user_id));
  let html = '<div style="max-height:300px;overflow-y:auto">';
  S.users.forEach(u => {
    const isAssigned = assignedIds.has(u.id);
    html += `<div style="padding:8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);cursor:pointer" onclick="toggleTodoItemAssignee('${todoId}','${itemId}','${u.id}',${!isAssigned})">
      <input type="checkbox" ${isAssigned?'checked':''}>
      <span>${esc(lastNameFirst(u.name))}</span>
    </div>`;
  });
  html += '</div>';
  const popup = document.createElement('div');
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--sf);border:1px solid var(--border);border-radius:8px;padding:14px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:1000;width:280px';
  popup.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:10px">Zugewiesen an</div>${html}<button class="btn-p" style="width:100%;margin-top:10px" onclick="this.parentElement.remove()">Schließen</button>`;
  document.body.appendChild(popup);
}

async function toggleTodoItemAssignee(todoId, itemId, userId, assign) {
  try {
    if (assign) {
      await api('POST', `/todos/${todoId}/items/${itemId}/assignees`, {userId});
    } else {
      await api('DELETE', `/todos/${todoId}/items/${itemId}/assignees/${userId}`);
    }
    await fetchData();
    const todo = S.todos.find(t => t.id === todoId);
    if (todo) {
      const detail = document.getElementById('todosDetail');
      if (detail) detail.innerHTML = renderTodoDetail(todo);
    }
    document.querySelector('[style*="position:fixed"][style*="z-index:1000"]')?.remove();
    openTodoItemAssignees(todoId, itemId);
  } catch(e) { toast('Fehler: '+e.message,'err'); }
}

// ── CHAT (1:1) ────────────────────────────────────────────────────────────
// Eigenständig von der Broadcast-"Nachrichten"-Funktion oben (Ankündigung an
// eine Zielgruppe) — hier echte Thread-basierte Unterhaltungen zwischen zwei
// Mitarbeitern, als mehrere unten angedockte Chatfenster (wie bei gängigen
// Messengern): jedes offene Fenster ist entweder minimiert (schmale Leiste)
// oder maximiert (volles Chatfenster) — es kann immer nur eines maximiert
// sein, ein Klick auf ein minimiertes Fenster maximiert es und minimiert die
// anderen. "X" schließt ein Fenster endgültig (kein Wieder-Aufpoppen bei
// neuen Nachrichten, bis der Chat erneut aktiv geöffnet wird).
function chatUnreadCount(threadId){
  const t=(S.chatThreads||[]).find(x=>x.id===threadId);
  if(!t)return 0;
  const since=t.myLastReadAt?new Date(t.myLastReadAt).getTime():0;
  return (S.chatMessages||[]).filter(m=>m.threadId===threadId&&m.senderId!==S.currentUser&&new Date(m.createdAt).getTime()>since).length;
}
function chatLastMessage(threadId){
  const msgs=(S.chatMessages||[]).filter(m=>m.threadId===threadId);
  return msgs.length?msgs[msgs.length-1]:null;
}
function renderChatList(){
  const threads=(S.chatThreads||[]).slice().sort((a,b)=>{
    const la=chatLastMessage(a.id), lb=chatLastMessage(b.id);
    const ta=la?new Date(la.createdAt).getTime():new Date(a.createdAt).getTime();
    const tb=lb?new Date(lb.createdAt).getTime():new Date(b.createdAt).getTime();
    return tb-ta;
  });
  const row=t=>{
    const u=getU(t.otherUserId);
    const last=chatLastMessage(t.id);
    const unread=chatUnreadCount(t.id);
    const preview=last?(last.senderId===S.currentUser?'Du: ':'')+esc(last.text.length>60?last.text.slice(0,60)+'…':last.text):'<span style="color:var(--di)">Noch keine Nachrichten</span>';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--border);cursor:pointer" onclick="openChatWindow('${t.id}')">
      ${u?avHtml(u.initials,u.color,36,14,u.isOnline):'<div style="width:36px;height:36px;border-radius:50%;background:var(--sf2)"></div>'}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:${unread?'700':'600'}">${esc(u?lastNameFirst(u.name):'Unbekannt')}</div>
        <div style="font-size:12px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        ${last?`<div style="font-size:10px;color:var(--di)">${fdt(last.createdAt)}</div>`:''}
        ${unread?`<span class="nbdg" style="display:flex">${unread}</span>`:''}
      </div>
    </div>`;
  };
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">💬 Chat</div><button class="btn-p" onclick="openChatWindowPicker()">&#65291; Neuer Chat</button></div>
    <div style="padding:0 20px 30px">
      ${threads.length?threads.map(row).join(''):'<div class="empty">Noch keine Chats. Starte einen neuen!</div>'}
    </div>`;
}

// S._chatWindows: [{id, threadId|null, minimized}] — id==='__picker__' für das
// Fenster zur Mitarbeiterauswahl, sonst id===threadId.
if(!S._chatWindows)S._chatWindows=[];

function _chatWin(id){ return (S._chatWindows||[]).find(w=>w.id===id); }
// #qaWrap trägt ein inline style="display:flex" (siehe index.html) — das
// gewinnt IMMER gegen eine CSS-Klasse/@media-Regel, egal wie spezifisch.
// Deshalb hier direkt das inline style setzen statt nur eine Klasse zu toggeln.
function _setQaWrapVisible(visible){
  const wrap=document.getElementById('qaWrap');
  if(!wrap)return;
  const shouldHide=!visible&&window.innerWidth<=640;
  wrap.style.display=shouldHide?'none':'flex';
}
function renderChatWindows(){
  const row=document.getElementById('chatWinRow');
  if(!row)return;
  const wins=S._chatWindows||[];
  if(!wins.length){row.innerHTML='';row.classList.remove('open');_setQaWrapVisible(true);return;}
  row.classList.add('open');
  // Der Hintergrundabgleich (alle paar Sekunden) baut die Fenster neu auf —
  // ohne das hier würde ein noch nicht abgeschicktes Nachrichten-Entwurf
  // beim Tippen verschwinden bzw. der Fokus mitten im Schreiben verloren
  // gehen. Fokus + Cursorposition werden daher explizit gerettet.
  const activeEl=document.activeElement;
  const activeId=activeEl&&activeEl.id&&activeEl.id.startsWith('chatWinInput_')?activeEl.id:null;
  const activeSel=activeId?activeEl.selectionStart:null;
  row.innerHTML=wins.map(w=>{
    if(w.id==='__picker__')return chatWinPickerHtml(w);
    return w.minimized?chatWinMinHtml(w):chatWinMaxHtml(w);
  }).join('');
  if(activeId){
    const el=document.getElementById(activeId);
    if(el){el.focus();if(activeSel!=null)try{el.setSelectionRange(activeSel,activeSel);}catch(e){}}
  }
  // Auf dem Handy überlappt der volle-Breite-Chat sonst den "+"-Schnell-
  // zugriff-Button — solange ein Fenster maximiert (nicht nur als Leiste
  // minimiert) offen ist, blenden wir ihn aus.
  const anyMaximized=S._chatWindows.some(w=>!w.minimized);
  _setQaWrapVisible(!anyMaximized);
  S._chatWindows.filter(w=>!w.minimized&&w.id!=='__picker__').forEach(w=>{
    const el=document.getElementById('chatWinMsgs_'+w.id);
    if(el)el.scrollTop=el.scrollHeight;
  });
}
function chatWinMinHtml(w){
  const t=(S.chatThreads||[]).find(x=>x.id===w.threadId);
  const ou=t?getU(t.otherUserId):null;
  const unread=w.threadId?chatUnreadCount(w.threadId):0;
  return `<div class="chat-win-min" style="background:${unread?'rgba(239,68,68,.1)':'var(--bg)'};border:1px solid ${unread?'rgba(239,68,68,.4)':'var(--border)'}" onclick="maximizeChatWindow('${w.id}')">
    ${ou?avHtml(ou.initials,ou.color,26,10,ou.isOnline):'<div style="width:26px;height:26px;border-radius:50%;background:var(--sf2)"></div>'}
    <div style="flex:1;min-width:0;font-size:12px;font-weight:${unread?'700':'600'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ou?lastNameFirst(ou.name):'Chat')}</div>
    ${unread?`<span style="min-width:18px;height:18px;background:#ef4444;color:#fff;border-radius:9px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0">${unread}</span>`:''}
    <button class="mc" title="Maximieren" style="font-size:12px;flex-shrink:0" onclick="event.stopPropagation();maximizeChatWindow('${w.id}')">&#9650;</button>
    <button class="mc" title="Schließen" style="font-size:12px;flex-shrink:0" onclick="event.stopPropagation();closeChatWindow('${w.id}')">&#10005;</button>
  </div>`;
}
function chatWinMaxHtml(w){
  const t=(S.chatThreads||[]).find(x=>x.id===w.threadId);
  const ou=t?getU(t.otherUserId):null;
  const msgs=(S.chatMessages||[]).filter(m=>m.threadId===w.threadId);
  const otherColor=ou?.color||'#64748b';
  const msgsHtml=msgs.map(m=>{
    const mine=m.senderId===S.currentUser;
    return `<div style="align-self:${mine?'flex-end':'flex-start'};max-width:80%">
      <div style="background:${mine?'var(--acc)':otherColor+'2a'};color:${mine?'var(--act)':otherColor};padding:7px 11px;border-radius:12px;${mine?'border-bottom-right-radius:2px':'border-bottom-left-radius:2px'};font-size:13px;white-space:pre-wrap;word-break:break-word">${esc(m.text)}</div>
      <div style="font-size:9px;color:var(--di);margin-top:2px;text-align:${mine?'right':'left'}">${fdt(m.createdAt)}</div>
    </div>`;
  }).join('')||'<div style="color:var(--di);font-size:12px;text-align:center;padding:20px 0">Noch keine Nachrichten — schreib was!</div>';
  return `<div class="chat-win-max">
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);flex-shrink:0">
      ${ou?avHtml(ou.initials,ou.color,26,10,ou.isOnline):''}
      <div style="flex:1;font-weight:700;font-size:13px">${esc(ou?lastNameFirst(ou.name):'Chat')}</div>
      <button class="mc" title="Minimieren" onclick="minimizeChatWindow('${w.id}')" style="font-size:14px">&#9660;</button>
      <button class="mc" title="Schließen" onclick="closeChatWindow('${w.id}')" style="font-size:14px">&#10005;</button>
    </div>
    <div id="chatWinMsgs_${w.id}" style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px">${msgsHtml}</div>
    <div style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--border);flex-shrink:0">
      <button class="btn-s emoji-pick-btn" style="flex-shrink:0" onclick="openEmojiPicker('chatWinInput_${w.id}',this,'insert')">😀</button>
      <input type="text" id="chatWinInput_${w.id}" value="${esc((S._chatDraft&&S._chatDraft[w.id])||'')}" oninput="S._chatDraft=S._chatDraft||{};S._chatDraft['${w.id}']=this.value" placeholder="Nachricht…" onkeydown="if(event.key==='Enter'){event.preventDefault();sendChatWinMessage('${w.id}');}" style="flex:1;font-size:16px">
      <button class="btn-p" onclick="sendChatWinMessage('${w.id}')">&#10148;</button>
    </div>
  </div>`;
}
function chatWinPickerHtml(w){
  const search=(w._search||'').toLowerCase().trim();
  const users=S.users.filter(u=>u.id!==S.currentUser&&u.isActive!==false).sort(byLastName)
    .filter(u=>!search||u.name.toLowerCase().includes(search));
  return `<div class="chat-win-picker">
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="flex:1;font-weight:700;font-size:13px">Neuer Chat</div>
      <button class="mc" onclick="closeChatWindow('__picker__')" style="font-size:14px">&#10005;</button>
    </div>
    <div style="padding:10px 12px;flex:1;min-height:0;overflow-y:auto">
      <input type="text" value="${esc(w._search||'')}" placeholder="Mitarbeiter suchen…" oninput="onChatPickerSearch(this.value)" style="width:100%;margin-bottom:8px;box-sizing:border-box;font-size:16px">
      <div>${users.map(u=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-radius:6px" onclick="selectChatWindowUser('${u.id}')" onmouseover="this.style.background='var(--sf2)'" onmouseout="this.style.background='none'">
        ${avHtml(u.initials,u.color,26,10,u.isOnline)}<span style="font-size:13px">${esc(lastNameFirst(u.name))}</span>
      </div>`).join('')||'<div style="color:var(--di);font-size:12px;padding:8px 0">Keine Treffer.</div>'}</div>
    </div>
  </div>`;
}
function onChatPickerSearch(val){
  const w=_chatWin('__picker__');if(!w)return;
  w._search=val;
  const focused=document.activeElement?.id;
  renderChatWindows();
  if(focused){const el=document.getElementById(focused);if(el){el.focus();el.setSelectionRange(val.length,val.length);}}
}
function openChatWindowPicker(){
  S._chatWindows.forEach(w=>w.minimized=true);
  let w=_chatWin('__picker__');
  if(!w){w={id:'__picker__',threadId:null,minimized:false,_search:''};S._chatWindows.push(w);}
  else w.minimized=false;
  renderChatWindows();
}
async function selectChatWindowUser(userId){
  try{
    const r=await api('POST','/chat/threads',{otherUserId:userId});
    closeChatWindow('__picker__');
    await chatSync();
    openChatWindow(r.id);
  }catch(e){toast('⚠️ '+e.message,'err');}
}
function openChatWindow(threadId){
  S._chatWindows.forEach(w=>w.minimized=true);
  let w=_chatWin(threadId);
  if(!w){w={id:threadId,threadId,minimized:false};S._chatWindows.push(w);}
  else w.minimized=false;
  renderChatWindows();
  markChatThreadRead(threadId);
  setTimeout(()=>document.getElementById('chatWinInput_'+threadId)?.focus(),50);
}
function maximizeChatWindow(id){
  S._chatWindows.forEach(w=>w.minimized=(w.id!==id));
  renderChatWindows();
  const w=_chatWin(id);
  if(w&&w.threadId)markChatThreadRead(w.threadId);
}
function minimizeChatWindow(id){
  const w=_chatWin(id);if(w)w.minimized=true;
  renderChatWindows();
}
function closeChatWindow(id){
  S._chatWindows=S._chatWindows.filter(x=>x.id!==id);
  renderChatWindows();
}
async function sendChatWinMessage(threadId){
  const input=document.getElementById('chatWinInput_'+threadId);
  if(!input)return;
  const text=input.value.trim();if(!text)return;
  input.value='';
  if(S._chatDraft)S._chatDraft[threadId]='';
  // Optimistisch sofort anzeigen, statt auf den vollen Datenabgleich zu
  // warten — der lief bisher unbemerkt im Hintergrund, konnte aber je nach
  // Serverlast ein paar Sekunden dauern, bis die eigene Nachricht auftauchte.
  const tempMsg={id:'_pending_'+Date.now()+'_'+Math.random().toString(36).slice(2),threadId,senderId:S.currentUser,text,createdAt:new Date().toISOString()};
  S.chatMessages.push(tempMsg);
  renderChatWindows();
  // renderChatWindows() baut das Eingabefeld als neues DOM-Element neu auf —
  // der Fokus geht dabei verloren, deshalb hier gezielt zurückholen.
  document.getElementById('chatWinInput_'+threadId)?.focus();
  if(S.view==='chat')renderChatList();
  try{
    const r=await api('POST','/chat/threads/'+threadId+'/messages',{text});
    tempMsg.id=r.id;
    chatSync();
  }catch(e){
    S.chatMessages=S.chatMessages.filter(m=>m!==tempMsg);
    renderChatWindows();
    document.getElementById('chatWinInput_'+threadId)?.focus();
    toast('⚠️ '+e.message,'err');input.value=text;if(S._chatDraft)S._chatDraft[threadId]=text;
  }
}
async function markChatThreadRead(threadId){
  try{
    await api('PUT','/chat/threads/'+threadId+'/read');
    const t=(S.chatThreads||[]).find(x=>x.id===threadId);
    if(t)t.myLastReadAt=new Date().toISOString();
    updateBadges();
    renderChatWindows();
    if(S.view==='chat')renderChatList();
  }catch(e){}
}
// Wird nach jedem silentRefresh() aufgerufen, sobald neue Chat-Nachrichten da
// sind: offene maximierte Fenster aktualisieren + als gelesen markieren,
// offene minimierte Fenster zeigen automatisch den Ungelesen-Zähler, und für
// Threads, die weder offen noch vom Nutzer explizit geschlossen wurden, poppt
// ein neues minimiertes Fenster mit Hinweis auf.
function onChatMessagesChanged(prevMsgs){
  const prevIds=new Set(prevMsgs.map(m=>m.id));
  const fresh=(S.chatMessages||[]).filter(m=>!prevIds.has(m.id)&&m.senderId!==S.currentUser);
  if(!fresh.length)return;
  let changed=false;
  const freshThreadIds=[...new Set(fresh.map(m=>m.threadId))];
  // Ist das Fenster für diesen Thread schon offen UND maximiert, sieht der
  // Nutzer die Nachricht ohnehin sofort in der Konversation — kein Toast nötig.
  const notifyThreadIds=[];
  freshThreadIds.forEach(threadId=>{
    const w=_chatWin(threadId);
    if(w){
      if(!w.minimized){markChatThreadRead(threadId);}
      else notifyThreadIds.push(threadId);
    } else {
      // Auch ein zuvor per "X" geschlossenes Fenster poppt bei einer neuen
      // Nachricht wieder minimiert auf — Schließen blendet nur den aktuellen
      // Stand aus, deaktiviert aber keine künftigen Benachrichtigungen.
      S._chatWindows.push({id:threadId,threadId,minimized:true});
      notifyThreadIds.push(threadId);
    }
    changed=true;
  });
  if(changed)renderChatWindows();
  if(!notifyThreadIds.length)return;
  const t=(S.chatThreads||[]).find(x=>x.id===notifyThreadIds[0]);
  const ou=t?getU(t.otherUserId):null;
  toast('💬 Neue Nachricht'+(ou?' von '+lastNameFirst(ou.name):'')+'!','chat');
}

