// ══ NAVIGATION ══
function toggleNS(id){
  document.getElementById(id+'Hdr').classList.toggle('open');
  document.getElementById(id+'Sub').classList.toggle('open');
}
function setView(v){
  S.view=v;
  ['dashboard','schedule','allw','tickets','tickets_closed','checklists','messages'].forEach(x=>{
    const el=document.getElementById('ni-'+x);if(el)el.classList.toggle('active',x===v);
  });
  renderSBF();renderMain();closeMob();
}

// ══ SIDEBAR ══
function renderSBF(){
  const el=document.getElementById('sbf');
  if(S.view==='schedule'){
    el.innerHTML=`<div>
      <div class="sfl">Jahr & Monat</div>
      <div class="yr-row"><button class="yb" onclick="S.year--;renderSBF();renderMain()">‹</button><span class="yv">${S.year}</span><button class="yb" onclick="S.year++;renderSBF();renderMain()">›</button></div>
      <div class="mgrid"><button class="mb ${S.month===null?'on':''}" onclick="S.month=null;renderSBF();renderMain()">Alle</button>${MONTHS.map((m,i)=>`<button class="mb ${S.month===i?'on':''}" onclick="S.month=${i};renderSBF();renderMain()">${m.slice(0,3)}</button>`).join('')}</div>
    </div>
    ${S.permissions.seeAllEntries?`<div><div class="sfl">Mitarbeiter</div><select class="sbsel" onchange="S.filterUser=this.value||null;renderMain()"><option value="">Alle Mitarbeiter</option>${S.users.filter(u=>!(u.roles||[]).includes('admin')).map(u=>`<option value="${u.id}"${S.filterUser===u.id?' selected':''}>${u.name}</option>`).join('')}</select></div>`:''}`;
  }else if(S.view==='allw'){
    el.innerHTML=`<div>
      <div class="sfl">Jahr</div>
      <div class="yr-row"><button class="yb" onclick="S.allwYear--;renderSBF();renderMain()">‹</button><span class="yv">${S.allwYear}</span><button class="yb" onclick="S.allwYear++;renderSBF();renderMain()">›</button></div>
      <div class="sfl" style="margin-top:8px">Zeitraum</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${['month','h1','h2','year'].map(p=>`<button class="mb ${S.allwPeriod===p?'on':''}" style="text-align:left;padding:5px 7px" onclick="S.allwPeriod='${p}';renderSBF();renderMain()">${{month:'Monatlich',h1:'1. Halbjahr',h2:'2. Halbjahr',year:'Gesamtjahr'}[p]}</button>`).join('')}
      </div>
      ${S.allwPeriod==='month'?`<div style="margin-top:8px"><div class="sfl">Monat</div><div class="mgrid">${MONTHS.map((m,i)=>`<button class="mb ${S.allwMonth===i+1?'on':''}" onclick="S.allwMonth=${i+1};renderSBF();renderMain()">${m.slice(0,3)}</button>`).join('')}</div></div>`:''}
    </div>`;
  }else if(S.view==='tickets'||S.view==='tickets_closed'){
    const myD=S.permissions.isAdmin||S.permissions.isDP?DEPTS:(S.permissions.myDepts||[]);
    el.innerHTML=`
      <div><div class="sfl">Fachbereich</div><div style="display:flex;flex-direction:column;gap:3px">
        <button class="mb ${!S.tkFD?'on':''}" onclick="S.tkFD='';renderMain()" style="text-align:left;padding:4px 7px">Alle</button>
        ${myD.map(d=>`<button class="mb ${S.tkFD===d?'on':''}" onclick="S.tkFD='${d}';renderMain()" style="text-align:left;padding:4px 7px;font-size:11px">${DLBL[d]}</button>`).join('')}
      </div></div>
      <div><div class="sfl">Priorität</div><div style="display:flex;flex-direction:column;gap:3px">
        <button class="mb ${!S.tkFP?'on':''}" onclick="S.tkFP='';renderMain()" style="text-align:left;padding:4px 7px">Alle</button>
        ${PRIO.map(p=>`<button class="mb ${S.tkFP===p.id?'on':''}" onclick="S.tkFP='${p.id}';renderMain()" style="text-align:left;padding:4px 7px">${p.label}</button>`).join('')}
      </div></div>
      <div><div class="sfl">Status</div><div style="display:flex;flex-direction:column;gap:3px">
        <button class="mb ${!S.tkFS?'on':''}" onclick="S.tkFS='';renderMain()" style="text-align:left;padding:4px 7px">Alle</button>
        ${STS.filter(s=>S.view==='tickets_closed'?s.id==='closed':s.id!=='closed').map(s=>`<button class="mb ${S.tkFS===s.id?'on':''}" onclick="S.tkFS='${s.id}';renderMain()" style="text-align:left;padding:4px 7px;font-size:11px">${s.label}</button>`).join('')}
      </div></div>
      <div><div class="sfl">Bucket</div><div style="display:flex;flex-direction:column;gap:3px">
        <button class="mb ${!S.tkFB?'on':''}" onclick="S.tkFB='';renderMain()" style="text-align:left;padding:4px 7px">Alle</button>
        ${BKTS.map(b=>`<button class="mb ${S.tkFB===b.id?'on':''}" onclick="S.tkFB='${b.id}';renderMain()" style="text-align:left;padding:4px 7px;font-size:10px">${b.label}</button>`).join('')}
      </div></div>`;
  }else el.innerHTML='';
}

// ══ MAIN RENDER ══
function renderMain(){
  if(S.view==='dashboard')renderDashboard();
  else if(S.view==='schedule')renderSchedule();
  else if(S.view==='allw')renderAllw();
  else if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();
  else if(S.view==='checklists')renderChecklists();
  else if(S.view==='messages')renderMessages();
}

