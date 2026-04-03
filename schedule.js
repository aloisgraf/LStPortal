// ══ MAIN RENDER ══
function renderMain(){
  if(S.view==='dashboard')renderDashboard();
  else if(S.view==='schedule')renderSchedule();
  else if(S.view==='allw')renderAllw();
  else if(S.view==='tickets'||S.view==='tickets_closed')renderTickets();
  else if(S.view==='checklists')renderChecklists();
  else if(S.view==='messages')renderMessages();
}

// ── DASHBOARD ──
function renderDashboard(){
  const u=getU(S.currentUser);
  const h=new Date().getHours();
  const gr=h<12?'☀️ Guten Morgen':h<18?'🌤️ Guten Tag':'🌙 Guten Abend';
  const myEvts=S.events.filter(ev=>!ev.isGeneral&&(ev.userId===S.currentUser||ev.createdBy===S.currentUser));
  const apC=myEvts.filter(e=>e.approved==='approved').length;
  const pC=myEvts.filter(e=>e.approved==='pending').length;
  const rC=myEvts.filter(e=>e.approved==='rejected').length;
  const unread=S.messages.filter(m=>!m.acked&&!m.isMine);
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">${gr}, <span>${u?.name||'?'}</span></div></div>
    <div class="dash-grid">
      <div class="dash-card">
        <h3>🟢 Aktuell eingeloggt (${S.activeUsers.length})</h3>
        <div class="au-list">${S.activeUsers.length?S.activeUsers.map(u2=>`<div class="au-chip">${avH(u2.initials,u2.color,20,8)}<div class="au-dot"></div><span>${u2.name}</span></div>`).join(''):'<span style="color:var(--di);font-size:12px">Keine anderen Benutzer aktiv</span>'}</div>
      </div>
      <div class="dash-card">
        <h3>📋 Meine Einträge</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div class="sc" style="flex:1;min-width:70px"><div class="sv" style="color:var(--ok)">${apC}</div><div class="sl">✅ Genehmigt</div></div>
          <div class="sc" style="flex:1;min-width:70px"><div class="sv" style="color:var(--warn)">${pC}</div><div class="sl">⏳ Ausstehend</div></div>
          <div class="sc" style="flex:1;min-width:70px"><div class="sv" style="color:var(--danger)">${rC}</div><div class="sl">❌ Abgelehnt</div></div>
        </div>
        <button class="btn-s" style="width:100%;margin-top:10px;font-size:12px" onclick="setView('schedule')">Meine Einträge anzeigen →</button>
      </div>
      <div class="dash-card" style="grid-column:1/-1">
        <h3>📬 Ungelesene Nachrichten (${unread.length})</h3>
        ${unread.length?unread.slice(0,5).map(m=>{const snd=getU(m.fromUserId);return`<div class="msg-card unread"><div class="msg-title">${m.title}</div><div class="msg-meta">Von: ${snd?.name||'?'} · ${fdt(m.createdAt)}${m.toDepartment?' · '+DLBL[m.toDepartment]:' · Alle'}</div><div class="msg-body">${m.body.slice(0,200)}${m.body.length>200?'…':''}</div><button class="btn-ok" style="margin-top:8px" onclick="ackMsg('${m.id}')">✓ Bestätigen</button></div>`;}).join('')+'<br>'+
        (unread.length>5?`<button class="btn-s" onclick="setView('messages')">Alle ${unread.length} Nachrichten ansehen →</button>`:'')
        :'<span style="color:var(--di);font-size:13px">Keine ungelesenen Nachrichten. 🎉</span>'}
      </div>
    </div>`;
}

// ── SCHEDULE ──
function getVisEvts(){
  let evs=[...S.events];
  if(!S.permissions.seeAllEntries) evs=evs.filter(ev=>ev.isGeneral||ev.userId===S.currentUser||ev.createdBy===S.currentUser);
  if(S.filterUser) evs=evs.filter(ev=>!ev.isGeneral&&ev.userId===S.filterUser);
  if(S.month!==null) evs=evs.filter(ev=>{const d=new Date(ev.dateFrom);return d.getFullYear()===S.year&&d.getMonth()===S.month;});
  else evs=evs.filter(ev=>new Date(ev.dateFrom).getFullYear()===S.year);
  return evs.sort((a,b)=>a.dateFrom.localeCompare(b.dateFrom));
}
function renderSchedule(){
  const evs=getVisEvts();
  const fuN=S.filterUser?getU(S.filterUser)?.name:null;
  const counts={};S.categories.forEach(c=>counts[c.id]=0);evs.forEach(ev=>{if(counts[ev.category]!==undefined)counts[ev.category]++;});
  document.getElementById('main').innerHTML=`
    <div class="ph">
      <div class="pt">Eintragsübersicht <span>${S.month!==null?MONTHS[S.month]+' ':''+ S.year}</span>${fuN?`<small>· Ansicht von Mitarbeiter: <b>${fuN}</b></small>`:''}</div>
      <button class="btn-p" onclick="openEvtModal()">＋ Eintrag hinzufügen</button>
    </div>
    <div class="sr">${S.categories.slice(0,4).map(c=>`<div class="sc"><div class="sv" style="color:${c.color}">${counts[c.id]||0}</div><div class="sl">${c.emoji} ${c.label}</div></div>`).join('')}</div>
    <div class="tw">
      <div class="tt"><h2>Einträge</h2>
        <input class="srch" type="text" placeholder="Suchen …" oninput="renderSchedRows(this.value)" style="width:150px">
        <select class="flt" onchange="renderSchedRows(undefined,this.value)"><option value="">Alle Kategorien</option>${S.categories.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('')}</select>
        <select class="flt" onchange="renderSchedRows(undefined,undefined,this.value)"><option value="">Alle Status</option><option value="pending">Ausstehend</option><option value="approved">Genehmigt</option><option value="rejected">Abgelehnt</option></select>
      </div>
      <table><thead><tr><th>Datum</th><th>Zeit</th><th>Mitarbeiter</th><th>Kategorie</th><th>Beschreibung</th><th>Status</th><th>Aktionen</th></tr></thead>
      <tbody id="scTb">${buildEvRows(evs)}</tbody></table>
      ${!evs.length?'<div class="empty">📭 Keine Einträge für diesen Zeitraum.</div>':''}
    </div>`;
}
function buildEvRows(evs,srch='',catF='',apF=''){
  const p=S.permissions;
  return evs.filter(ev=>{
    if(catF&&!ev.isGeneral&&ev.category!==catF)return false;
    if(apF&&!ev.isGeneral&&ev.approved!==apF)return false;
    if(srch){const s=srch.toLowerCase();const un=getU(ev.userId)?.name.toLowerCase()||'';if(!ev.reason.toLowerCase().includes(s)&&!un.includes(s))return false;}
    return true;
  }).map(ev=>{
    const cat=ev.isGeneral?null:getCat(ev.category)||{label:'?',color:'#888',emoji:'📌'};
    const emp=ev.isGeneral?null:getU(ev.userId)||{name:'?',color:'#888',initials:'?'};
    const ds=ev.dateTo&&ev.dateTo!==ev.dateFrom?`${fd(ev.dateFrom)} – ${fd(ev.dateTo)}`:fd(ev.dateFrom);
    const ts=ev.timeFrom?(ev.timeTo?`${ev.timeFrom}–${ev.timeTo}`:ev.timeFrom):'—';
    const canDel=(ev.isGeneral&&p.manageGeneral)||(!ev.isGeneral&&(p.editAllPersonal||ev.createdBy===S.currentUser));
    const canEdit=ev._canEdit&&!ev.isGeneral;
    const canAppr=ev._canApprove&&!ev.isGeneral;
    const isAnon=ev._anon;
    const empCell=ev.isGeneral?`<span class="bdg" style="background:color-mix(in srgb,var(--ok)12%,transparent);color:var(--ok)">🌐 Allgemein</span>`:
      emp?`<div style="display:flex;align-items:center;gap:6px">${avH(emp.initials,emp.color,20,8)}<span>${emp.name}</span></div>`:'—';
    const catCell=isAnon?`<span style="color:var(--di);font-size:12px">🔒 Anonym</span>`:
      ev.isGeneral?`<span class="bdg" style="background:color-mix(in srgb,var(--ok)8%,transparent);color:var(--ok)">Allgemein</span>`:
      cat?`<span class="bdg" style="background:${cat.color}1a;color:${cat.color};border:1px solid ${cat.color}28">${cat.emoji} ${cat.label}</span>`:'—';
    const bgStyle=ev.isGeneral?'style="background:color-mix(in srgb,var(--ok)3%,var(--sf))"':ev._anon?'style="background:color-mix(in srgb,var(--warn)3%,var(--sf))"':'';
    return`<tr ${bgStyle}>
      <td style="font-size:11px;color:var(--mu);white-space:nowrap">${ds}</td>
      <td style="font-size:11px;color:var(--mu)">${ts}</td>
      <td>${empCell}</td><td>${catCell}</td>
      <td style="max-width:200px">${isAnon?'<span style="color:var(--di)">(ausstehend)</span>':ev._blurred?`<span class="blur-c">${ev.reason}</span>`:ev.reason}</td>
      <td>${ev.isGeneral?'':apBdg(ev.approved)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        ${canEdit?`<button class="btn-e" onclick="openEvtEdit('${ev.id}')">✎</button>`:''}
        ${canAppr&&ev.approved!=='approved'?`<button class="btn-ok" onclick="approveEvt('${ev.id}','approved')" title="Genehmigen">✅</button>`:''}
        ${canAppr&&ev.approved!=='rejected'?`<button class="btn-d" onclick="approveEvt('${ev.id}','rejected')" title="Ablehnen" style="font-size:13px;padding:3px 6px">❌</button>`:''}
        ${canAppr&&ev.approved!=='pending'?`<button class="btn-w" onclick="approveEvt('${ev.id}','pending')" title="Zurücksetzen">↩</button>`:''}
        ${canDel?`<button class="btn-d" onclick="deleteEvt('${ev.id}')">✕</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}
let _scSrch='',_scCat='',_scAp='';
function renderSchedRows(srch,cat,ap){
  if(srch!==undefined)_scSrch=srch;if(cat!==undefined)_scCat=cat;if(ap!==undefined)_scAp=ap;
  const tb=document.getElementById('scTb');if(tb)tb.innerHTML=buildEvRows(getVisEvts(),_scSrch,_scCat,_scAp);
}

// ── ALLOWANCES ──
function getPeriodMonths(){
  if(S.allwPeriod==='month')return[S.allwMonth];
  if(S.allwPeriod==='h1')return[1,2,3,4,5,6];
  if(S.allwPeriod==='h2')return[7,8,9,10,11,12];
  return[1,2,3,4,5,6,7,8,9,10,11,12];
}
function sumAllw(uid,year,months){
  return months.reduce((a,m)=>{const r=getAllw(uid,year,m);return{nd:a.nd+r.nd,fd:a.fd+r.fd,fw:a.fw+r.fw,c10:a.c10+r.c10};},{nd:0,fd:0,fw:0,c10:0});
}
function numCell(n,col){
  if(!n)return`<td style="text-align:center;color:var(--di)">–</td>`;
  return`<td style="text-align:center"><span style="display:inline-block;min-width:28px;text-align:center;font-weight:600;padding:1px 6px;border-radius:4px;background:${col}18;color:${col}">${n}</span></td>`;
}
function renderAllw(){
  const months=getPeriodMonths(),yr=S.allwYear;
  const pLbl={month:MONTHS[S.allwMonth-1],h1:'1. Halbjahr',h2:'2. Halbjahr',year:'Gesamtjahr'}[S.allwPeriod];
  const showUsers=S.permissions.seeAllAllw?S.users.filter(u=>!(u.roles||[]).includes('admin')):[getU(S.currentUser)].filter(Boolean);
  const canEdit=S.permissions.editAllw&&S.allwPeriod==='month';
  const totals=showUsers.reduce((t,u)=>{const sv=sumAllw(u.id,yr,months);return{nd:t.nd+sv.nd,fd:t.fd+sv.fd,fw:t.fw+sv.fw,c10:t.c10+sv.c10};},{nd:0,fd:0,fw:0,c10:0});
  // Average (for DP role, when multiple months)
  const showAvg=S.permissions.isDP&&months.length>1;
  const avgRow=showAvg&&showUsers.length>1?`<tr style="border-top:1px dashed var(--border);font-style:italic"><td style="color:var(--mu);font-size:12px">⌀ Durchschnitt/MA</td>
    ${['nd','fd','fw','c10'].map(k=>`<td style="text-align:center;color:var(--teal);font-size:12px">${showUsers.length?(totals[k]/showUsers.length).toFixed(1):0}</td>`).join('')}
    ${canEdit?'<td></td>':''}</tr>`:'';
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">Zulagendienste <span>${pLbl} ${yr}</span></div></div>
    ${!S.permissions.seeAllAllw?`<div class="ib3" style="margin-bottom:12px">ℹ️ Deine Zulagen sind schreibgeschützt – Bearbeitung durch die Dienstplanung.</div>`:''}
    <div class="tw">
      <div class="tt"><h2>${S.permissions.seeAllAllw?'Alle Mitarbeiter':'Meine Zulagen'}</h2></div>
      <table><thead><tr><th>Mitarbeiter</th><th style="text-align:center">🌙 Nacht</th><th style="text-align:center">🎉 Feiertag</th><th style="text-align:center">🏖️ Freie WE</th><th style="text-align:center">📋 C10</th>${canEdit?'<th></th>':''}</tr></thead>
      <tbody>
        ${showUsers.map(u=>{const sv=sumAllw(u.id,yr,months);return`<tr><td><div style="display:flex;align-items:center;gap:7px">${avH(u.initials,u.color,22,9)}<span>${u.name}</span></div></td>${numCell(sv.nd,'#3b6dd4')}${numCell(sv.fd,'#10b981')}${numCell(sv.fw,'#f59e0b')}${numCell(sv.c10,'#7c3aed')}${canEdit?`<td><button class="btn-e" onclick="openAllwM('${u.id}',${yr},${S.allwMonth})">✏️</button></td>`:''}</tr>`;}).join('')}
        ${showUsers.length>1?`<tr style="border-top:2px solid var(--border);font-weight:700"><td>Gesamt</td>${numCell(totals.nd,'#3b6dd4')}${numCell(totals.fd,'#10b981')}${numCell(totals.fw,'#f59e0b')}${numCell(totals.c10,'#7c3aed')}${canEdit?'<td></td>':''}</tr>`:''}
        ${avgRow}
      </tbody></table>
    </div>`;
}
function openAllwM(uid,year,month){
  const u=getU(uid),a=getAllw(uid,year,month);
  document.getElementById('allwT').textContent=`${u?.name} – ${MONTHS[month-1]} ${year}`;
  document.getElementById('allwInfo').textContent=`Zulagen für ${MONTHS[month-1]} ${year}`;
  ['aUid','aYr','aMo'].forEach((id,i)=>document.getElementById(id).value=[uid,year,month][i]);
  document.getElementById('aND').value=a.nd||'';document.getElementById('aFD').value=a.fd||'';
  document.getElementById('aFW').value=a.fw||'';document.getElementById('aC10').value=a.c10||'';
  openModal('allwOv');
}
async function saveAllw(){
  const uid=document.getElementById('aUid').value,year=+document.getElementById('aYr').value,month=+document.getElementById('aMo').value;
  try{
    await api('PUT','/allowances',{userId:uid,year,month,nd:+document.getElementById('aND').value||0,fd:+document.getElementById('aFD').value||0,fw:+document.getElementById('aFW').value||0,c10:+document.getElementById('aC10').value||0});
    await fetchData();closeModal('allwOv');renderMain();toast('✅ Zulagen gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}

// ── EVENT CRUD ──
function openEvtModal(editId){
  const ev=editId?S.events.find(e=>e.id===editId):null;
  document.getElementById('evtTitle').textContent=ev?'Eintrag bearbeiten':'Neuer Eintrag';
  document.getElementById('evtId').value=ev?.id||'';
  const p=S.permissions;
  document.getElementById('genRow').style.display=p.addGeneral?'block':'none';
  document.getElementById('fGen').checked=false;
  document.getElementById('empRow').style.display='block';
  const empSel=document.getElementById('fEmp');empSel.innerHTML='';
  if(p.addForOthers){S.users.filter(u=>!(u.roles||[]).includes('admin')).forEach(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;empSel.appendChild(o);});}
  else{const o=document.createElement('option');o.value=S.currentUser;o.textContent=getU(S.currentUser)?.name||'Ich';empSel.appendChild(o);}
  if(ev)empSel.value=ev.userId||'';
  else empSel.value=S.currentUser;
  document.getElementById('fCat').innerHTML='<option value="">— wählen —</option>'+S.categories.map(c=>`<option value="${c.id}"${ev?.category===c.id?' selected':''}>${c.emoji} ${c.label}</option>`).join('');
  document.getElementById('fD1').value=ev?.dateFrom||'';document.getElementById('fD2').value=ev?.dateTo||'';
  document.getElementById('fT1').value=ev?.timeFrom||'';document.getElementById('fT2').value=ev?.timeTo||'';
  document.getElementById('fRsn').value=ev?.reason||'';
  openModal('evtOv');
}
function openEvtEdit(id){openEvtModal(id);}
function onGenToggle(){document.getElementById('empRow').style.display=document.getElementById('fGen').checked?'none':'block';}
async function saveEvent(){
  const id=document.getElementById('evtId').value;
  const isGeneral=document.getElementById('fGen').checked;
  const d1=document.getElementById('fD1').value,d2=document.getElementById('fD2').value;
  const userId=isGeneral?null:document.getElementById('fEmp').value;
  const category=document.getElementById('fCat').value;
  const reason=document.getElementById('fRsn').value.trim();
  if(!d1){toast('⚠️ Datum von ist erforderlich!');return;}
  if(!isGeneral&&!userId){toast('⚠️ Mitarbeiter auswählen!');return;}
  if(!category){toast('⚠️ Kategorie auswählen!');return;}
  if(!reason){toast('⚠️ Beschreibung ist erforderlich!');return;}
  const body={isGeneral,dateFrom:d1,dateTo:d2||d1,timeFrom:document.getElementById('fT1').value,timeTo:document.getElementById('fT2').value,userId,category,reason};
  try{
    if(id)await api('PUT','/events/'+id,body);
    else await api('POST','/events',body);
    await fetchData();closeModal('evtOv');renderMain();toast(id?'✅ Eintrag aktualisiert!':'✅ Eintrag gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function approveEvt(id,approved){
  try{await api('PUT','/events/'+id+'/approve',{approved});await fetchData();renderMain();toast(approved==='approved'?'✅ Genehmigt!':approved==='rejected'?'❌ Abgelehnt.':'↩ Zurückgesetzt.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteEvt(id){
  if(!confirm('Eintrag wirklich löschen?'))return;
  try{await api('DELETE','/events/'+id);await fetchData();renderMain();toast('🗑️ Eintrag gelöscht.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

