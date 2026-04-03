// ══ CONSTANTS ══
const MONTHS=['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const PAL=['#3b6dd4','#10b981','#7c3aed','#e87bb0','#f59e0b','#ef4444','#0ea5e9','#84cc16','#f97316','#14b8a6','#6366f1','#64748b'];
const PAL_D=['#e8c547','#5bc4a0','#7b8be8','#e87bb0','#c47b5b','#e85b5b','#5bc4e8','#a0e85b','#e8a05b','#a05be8','#5b8be8','#8888a8'];
const ROLES=[{id:'admin',label:'Administrator',icon:'🔑'},{id:'leitung',label:'Leitung',icon:'⭐'},{id:'dienstplanung',label:'Dienstplanung',icon:'📋'},{id:'technik',label:'Technik',icon:'🔧'},{id:'ausbildung',label:'Ausbildung',icon:'🎓'},{id:'qm',label:'QM',icon:'✅'},{id:'standard',label:'Standard',icon:'👤'}];
const DEPTS=['technik','leitung','dienstplanung','ausbildung','qm'];
const DLBL={technik:'🔧 Technik',leitung:'⭐ Leitung',dienstplanung:'📋 Dienstplanung',ausbildung:'🎓 Ausbildung',qm:'✅ QM'};
const PRIO=[{id:'low',label:'🟢 Gering'},{id:'medium',label:'🟡 Mittel'},{id:'high',label:'🔴 Hoch'}];
const STS=[{id:'open',label:'Offen'},{id:'in_progress',label:'In Bearbeitung'},{id:'on_hold',label:'Zurückgestellt'},{id:'closed',label:'Abgeschlossen'}];
const BKTS=[{id:'urgent',label:'🚨 Dringend'},{id:'week',label:'📅 Diese Woche'},{id:'sched',label:'📋 Dienstplanung'},{id:'wait',label:'⏳ Warten'},{id:'it',label:'💻 IT / Systeme'},{id:'proj',label:'🚀 Projekte'},{id:'org',label:'🏢 Organisation'},{id:'ideas',label:'💡 Ideen / Irgendwann'}];
const RM=[
  ['Benutzer verwalten',{admin:1,leitung:0,dienstplanung:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Alle Einträge sehen',{admin:1,leitung:1,dienstplanung:1,technik:0,ausbildung:2,qm:2,standard:0}],
  ['Einträge freigeben',{admin:1,leitung:1,dienstplanung:1,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Allgemeine Einträge',{admin:1,leitung:1,dienstplanung:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Für andere eintragen',{admin:1,leitung:1,dienstplanung:1,technik:0,ausbildung:1,qm:1,standard:0}],
  ['Alle Zulagen bearb.',{admin:1,leitung:1,dienstplanung:1,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Alle Tickets sehen',{admin:1,leitung:1,dienstplanung:0,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Fachbereich-Tickets',{admin:1,leitung:1,dienstplanung:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Status/Bucket setzen',{admin:1,leitung:1,dienstplanung:1,technik:1,ausbildung:1,qm:1,standard:0}],
  ['Nachrichten senden',{admin:1,leitung:1,dienstplanung:1,technik:0,ausbildung:0,qm:0,standard:0}],
  ['Kategorien & Tags',{admin:1,leitung:0,dienstplanung:0,technik:0,ausbildung:0,qm:0,standard:0}],
];
const AL_LBL={login:'🔑 Login',logout:'🚪 Logout',change_password:'🔐 PW geändert',create_event:'📅 Eintrag erstellt',edit_event:'✏️ Eintrag bearbeitet',delete_event:'🗑️ Eintrag gelöscht',approve_event:'✅ Freigabe/Ablehnung',create_ticket:'🎫 Ticket erstellt',update_ticket:'📝 Ticket geändert',delete_ticket:'🗑️ Ticket gelöscht',send_message:'✉️ Nachricht gesendet',ack_message:'✓ Nachricht bestätigt'};

// ══ STATE ══
let S={
  year:new Date().getFullYear(),month:new Date().getMonth(),
  currentUser:null,loginSel:null,view:'dashboard',filterUser:null,
  tkFD:'',tkFP:'',tkFB:'',tkFT2:'',tkFA:'',tkFS:'',tkSrch:'',
  allwYear:new Date().getFullYear(),allwPeriod:'month',allwMonth:new Date().getMonth()+1,
  events:[],users:[],categories:[],tags:[],allowances:[],tickets:[],messages:[],clTemplates:[],
  permissions:{},activeUsers:[],currentTicketId:null,
  ufCol:PAL[0],cfCol:PAL[2],tfCol:PAL[0],logOffset:0,logTotal:0,
};

// ══ API ══
const api=(method,path2,body)=>{
  const o={method,credentials:'include',headers:{}};
  if(body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
  return fetch('/api'+path2,o).then(r=>r.json()).then(d=>{if(!d.success)throw new Error(d.error||'Fehler');return d.data;});
};
const loading=v=>document.getElementById('loadingOv').classList.toggle('open',v);
async function fetchData(){
  loading(true);
  try{
    const d=await api('GET','/data');
    Object.assign(S,{users:d.users||[],categories:d.categories||[],tags:d.tags||[],events:d.events||[],tickets:d.tickets||[],allowances:d.allowances||[],messages:d.messages||[],clTemplates:d.clTemplates||[],currentUser:d.currentUser,permissions:d.permissions||{}});
    const ur=S.messages.filter(m=>!m.acked&&!m.isMine).length;
    const b=document.getElementById('msgBdg');if(b){b.textContent=ur;b.style.display=ur?'':'none';}
  }finally{loading(false);}
}

// ══ HELPERS ══
const getU=id=>S.users.find(u=>u.id===id);
const getCat=id=>S.categories.find(c=>c.id===id);
const getTag=id=>S.tags.find(t=>t.id===id);
const getTk=id=>S.tickets.find(t=>t.id===id);
const getAllw=(uid,y,m)=>S.allowances.find(a=>a.userId===uid&&a.year===y&&a.month===m)||{nd:0,fd:0,fw:0,c10:0};
const getRD=r=>ROLES.find(x=>x.id===r)||ROLES[6];
const fd=s=>{if(!s)return'—';const[y,m,d]=s.split('-');return`${d}.${m}.${y}`;};
const fdt=s=>{if(!s)return'—';const d=new Date(s);return`${fd(d.toISOString().slice(0,10))} ${d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})}`;};
const avH=(init,col,sz=24,fs=10)=>`<div style="width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:700;background:${col}22;color:${col};flex-shrink:0">${init}</div>`;
const rBdg=uid=>((getU(uid)?.roles)||['standard']).map(r=>{const d=getRD(r);return`<span class="rb rb-${r}">${d.icon} ${d.label}</span>`;}).join('');
const prioBdg=p=>`<span class="bdg pr-${p}">${PRIO.find(x=>x.id===p)?.label||p}</span>`;
const stBdg=s=>`<span class="bdg st-${s}">${STS.find(x=>x.id===s)?.label||s}</span>`;
const dBdg=d=>`<span class="bdg dp-${d}">${DLBL[d]||d}</span>`;
const tagC=tgs=>(tgs||[]).map(tid=>{const t=getTag(tid);return t?`<span class="tag-chip" style="background:${t.color}1a;color:${t.color};border:1px solid ${t.color}30">${t.label}</span>`:''}).join('');
const apBdg=ap=>ap==='approved'?`<span class="bdg ap-approved">✅ Genehmigt</span>`:ap==='rejected'?`<span class="bdg ap-rejected">❌ Abgelehnt</span>`:ap==='pending'?`<span class="bdg ap-pending">⏳ Ausstehend</span>`:'';
const curPal=()=>document.documentElement.getAttribute('data-theme')==='dark'?PAL_D:PAL;
const h2r=hex=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgb(${r}, ${g}, ${b})`;};

// ══ MOBILE ══
function toggleMob(){
  document.getElementById('SB').classList.toggle('mob-open');
  document.getElementById('sbOv').classList.toggle('mob-open');
}
function closeMob(){
  document.getElementById('SB').classList.remove('mob-open');
  document.getElementById('sbOv').classList.remove('mob-open');
}


// ══ UTILITIES ══
function toggleTheme(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme',dark?'light':'dark');
  document.getElementById('thBtn').textContent=dark?'🌙':'☀️';
  localStorage.setItem('lst_theme',dark?'light':'dark');
}
function openModal(id){document.getElementById(id)?.classList.add('open');}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
function eyeToggle(inputId,btn){const inp=document.getElementById(inputId);const show=inp.type==='password';inp.type=show?'text':'password';btn.textContent=show?'🙈':'👁';}
function toast(msg,type=''){
  const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),3000);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOv','clFormOv','msgFormOv'].forEach(closeModal);});
['evtOv','pwModal','allwOv','tkFormOv','tkDetOv','admOv','ufOv','cfOv','tfOv','clFormOv','msgFormOv'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('click',e=>{if(e.target===el)closeModal(id);});});

// ══ BOOT ══
(async()=>{
  const theme=localStorage.getItem('lst_theme')||'light';
  document.documentElement.setAttribute('data-theme',theme);
  document.getElementById('thBtn').textContent=theme==='dark'?'☀️':'🌙';
  await loadLoginUsers();
  document.getElementById('LS').classList.add('open');
  try{
    loading(true);
    const me=await api('GET','/auth/me');
    if(me?.userId){S.currentUser=me.userId;await fetchData();loginOK();}
  }catch(e){}
  finally{loading(false);}
})();
