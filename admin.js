// ── ADMIN ──
function openAdminModal(){
  renderUsrList();renderCatList();renderTagList();renderRightsMatrix();
  openModal('admOv');swTab('users');
}
function swTab(t){
  ['users','cats','tags','rights','log'].forEach(x=>{
    document.getElementById('atb-'+x)?.classList.toggle('on',x===t);
    document.getElementById('atp-'+x)?.classList.toggle('on',x===t);
  });
}
function renderUsrList(){
  document.getElementById('usrList').innerHTML=S.users.map(u=>`<div class="ai">${avH(u.initials,u.color,32,12)}<div class="aii"><div class="ain">${u.name} ${rBdg(u.id)}</div><div class="ais">${u.mustChangePW?'⚠️ PW-Änderung ausstehend':'✓ Aktiv'}</div></div><div class="aia"><button class="btn-e" onclick="openUF('${u.id}')">✎</button>${S.users.length>1&&u.id!==S.currentUser?`<button class="btn-d" onclick="delUser('${u.id}')">✕</button>`:''}</div></div>`).join('');
}
function renderCatList(){
  document.getElementById('catList').innerHTML=S.categories.map(c=>`<div class="ai"><div style="width:12px;height:12px;border-radius:3px;background:${c.color};flex-shrink:0"></div><div class="aii"><div class="ain">${c.emoji} ${c.label}</div></div><div class="aia"><button class="btn-e" onclick="openCF('${c.id}')">✎</button><button class="btn-d" onclick="delCat('${c.id}')">✕</button></div></div>`).join('');
}
function renderTagList(){
  document.getElementById('tagList').innerHTML=S.tags.map(t=>`<div class="ai"><div style="width:12px;height:12px;border-radius:3px;background:${t.color};flex-shrink:0"></div><div class="aii"><div class="ain"><span class="tag-chip" style="background:${t.color}1a;color:${t.color};border:1px solid ${t.color}30">${t.label}</span></div></div><div class="aia"><button class="btn-e" onclick="openTF('${t.id}')">✎</button><button class="btn-d" onclick="delTag('${t.id}')">✕</button></div></div>`).join('');
}
function renderRightsMatrix(){
  const rids=ROLES.map(r=>r.id);
  document.getElementById('rightsMatrix').innerHTML=`<table class="rm-t"><thead><tr><th style="text-align:left">Berechtigung</th>${ROLES.map(r=>`<th>${r.icon}<br>${r.label}</th>`).join('')}</tr></thead><tbody>${RM.map(([p2,v])=>`<tr><td style="text-align:left;font-size:11px">${p2}</td>${rids.map(r=>`<td>${v[r]===1?'<span style="color:var(--ok);font-weight:700">✓</span>':v[r]===2?'<span style="color:var(--warn);font-weight:700">〰</span>':'<span style="color:var(--di)">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table><p style="font-size:11px;color:var(--di);margin-top:6px">✓ voll · 〰 eingeschränkt · – kein Zugriff</p>`;
}
// Activity log
let _logRows=[];
async function loadLog(reset=false){
  if(reset){_logRows=[];S.logOffset=0;document.getElementById('logContent').innerHTML='<div class="empty">Lade …</div>';}
  try{
    const data=await api('GET',`/activity-log?limit=50&offset=${S.logOffset}`);
    S.logTotal=data.total;
    _logRows=[..._logRows,...data.logs];
    S.logOffset=_logRows.length;
    const rows=_logRows.map(l=>{
      const det=l.details&&Object.keys(l.details).length?JSON.stringify(l.details).slice(0,80):'';
      return`<div class="log-row"><span style="color:var(--mu);font-size:11px">${fdt(l.created_at)}</span><span style="font-weight:600;font-size:12px">${l.user_name||'?'}</span><span class="log-act">${AL_LBL[l.action]||l.action}</span><span style="font-size:10px;color:var(--di)">${det}</span></div>`;
    }).join('');
    document.getElementById('logContent').innerHTML=rows||'<div class="empty">Keine Einträge.</div>';
    document.getElementById('logMoreBtn').style.display=_logRows.length<S.logTotal?'block':'none';
  }catch(e){document.getElementById('logContent').innerHTML=`<div class="empty">Fehler: ${e.message}</div>`;}
}

// Color picker
function buildCP(cid,sel,fn){document.getElementById(cid).innerHTML=curPal().map(col=>`<div class="cp ${col===sel?'on':''}" style="background:${col}" onclick="${fn}('${col}','${cid}')"></div>`).join('');}
function pickU(col,cid){S.ufCol=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickC(col,cid){S.cfCol=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}
function pickT(col,cid){S.tfCol=col;document.querySelectorAll('#'+cid+' .cp').forEach(el=>el.classList.toggle('on',el.style.backgroundColor===h2r(col)));}

// User form
function openUF(id){
  const u=id?getU(id):null;
  document.getElementById('ufT').textContent=u?'Benutzer bearbeiten':'Benutzer anlegen';
  document.getElementById('ufId').value=u?.id||'';
  document.getElementById('ufNm').value=u?.name||'';
  document.getElementById('ufIn').value=u?.initials||'';
  document.getElementById('ufPWRR').style.display=u?'block':'none';
  document.getElementById('ufPWRst').checked=false;
  S.ufCol=u?.color||curPal()[0];
  const uR=u?.roles||['standard'];
  document.getElementById('ufRoles').innerHTML=ROLES.map(r=>`<label class="rck"><input type="checkbox" value="${r.id}"${uR.includes(r.id)?' checked':''}><span>${r.icon} ${r.label}</span></label>`).join('');
  buildCP('ufCR',S.ufCol,'pickU');
  closeModal('admOv');openModal('ufOv');
}
async function saveUser(){
  const name=document.getElementById('ufNm').value.trim(),initials=document.getElementById('ufIn').value.trim().toUpperCase();
  if(!name||!initials){toast('⚠️ Name und Kürzel erforderlich!');return;}
  const roles=Array.from(document.querySelectorAll('#ufRoles input:checked')).map(cb=>cb.value);
  if(!roles.length){toast('⚠️ Mindestens eine Rolle!');return;}
  const resetPassword=document.getElementById('ufPWRst').checked;
  const id=document.getElementById('ufId').value;
  try{
    if(id)await api('PUT','/users/'+id,{name,initials,roles,color:S.ufCol,resetPassword});
    else await api('POST','/users',{name,initials,roles,color:S.ufCol});
    await fetchData();backToAdmin('users');await loadLoginUsers();toast('✅ Benutzer gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function delUser(id){
  if(!confirm('Benutzer wirklich löschen?'))return;
  try{await api('DELETE','/users/'+id);await fetchData();backToAdmin('users');await loadLoginUsers();toast('🗑️ Benutzer gelöscht.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
function backToAdmin(tab){['ufOv','cfOv','tfOv'].forEach(closeModal);openAdminModal();swTab(tab);}

// Cat form
function openCF(id){
  const c=id?getCat(id):null;
  document.getElementById('cfT').textContent=c?'Kategorie bearbeiten':'Neue Kategorie';
  document.getElementById('cfId').value=c?.id||'';
  document.getElementById('cfLb').value=c?.label||'';
  document.getElementById('cfEm').value=c?.emoji||'📌';
  S.cfCol=c?.color||curPal()[2];
  buildCP('cfCR',S.cfCol,'pickC');
  closeModal('admOv');openModal('cfOv');
}
async function saveCat(){
  const label=document.getElementById('cfLb').value.trim(),emoji=document.getElementById('cfEm').value.trim()||'📌';
  if(!label){toast('⚠️ Bezeichnung erforderlich!');return;}
  const id=document.getElementById('cfId').value;
  try{
    if(id)await api('PUT','/categories/'+id,{label,emoji,color:S.cfCol});
    else await api('POST','/categories',{label,emoji,color:S.cfCol});
    await fetchData();backToAdmin('cats');toast('✅ Kategorie gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function delCat(id){
  if(!confirm('Kategorie löschen?'))return;
  try{await api('DELETE','/categories/'+id);await fetchData();backToAdmin('cats');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

// Tag form
function openTF(id){
  const t=id?getTag(id):null;
  document.getElementById('tfT').textContent=t?'Tag bearbeiten':'Neuer Tag';
  document.getElementById('tfId').value=t?.id||'';
  document.getElementById('tfLb').value=t?.label||'';
  S.tfCol=t?.color||curPal()[0];
  buildCP('tfCR',S.tfCol,'pickT');
  closeModal('admOv');openModal('tfOv');
}
async function saveTag(){
  const label=document.getElementById('tfLb').value.trim();
  if(!label){toast('⚠️ Bezeichnung erforderlich!');return;}
  const id=document.getElementById('tfId').value;
  try{
    if(id)await api('PUT','/tags/'+id,{label,color:S.tfCol});
    else await api('POST','/tags',{label,color:S.tfCol});
    await fetchData();backToAdmin('tags');toast('✅ Tag gespeichert!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function delTag(id){
  if(!confirm('Tag löschen?'))return;
  try{await api('DELETE','/tags/'+id);await fetchData();backToAdmin('tags');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

