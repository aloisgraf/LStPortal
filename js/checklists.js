// ── CHECKLISTS ──
function renderChecklists(){
  const p=S.permissions;
  const myRoles=p.roles||[];
  const myTpls=S.clTemplates;
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">☑️ Checklisten-Vorlagen</div>
      <button class="btn-p" onclick="openClForm(null)">＋ Neue Vorlage</button>
    </div>
    <div class="ib3" style="margin-bottom:14px">Vorlagen sind nach Fachbereich gefiltert. Eine Vorlage kann in Tickets als Checkliste angehängt werden.</div>
    ${myTpls.length?myTpls.map(tpl=>`
      <div class="cl-tpl">
        <div class="cl-tpl-h">
          <span class="cl-tpl-name">📋 ${tpl.name}</span>
          ${dBdg(tpl.department)}
          <div style="display:flex;gap:4px">
            <button class="btn-e" onclick="openClForm('${tpl.id}')">✎</button>
            <button class="btn-d" onclick="deleteClTpl('${tpl.id}')">✕</button>
          </div>
        </div>
        <div style="font-size:11px;color:var(--mu);margin-bottom:6px">Erstellt von: ${getU(tpl.createdBy)?.name||'?'} · ${tpl.items.length} Einträge</div>
        <div style="display:flex;flex-direction:column;gap:2px">${tpl.items.map((it,i)=>`<div class="cl-it"><span style="color:var(--di);font-size:10px;min-width:16px">${i+1}.</span> ${it.text}</div>`).join('')}</div>
      </div>`).join('')
    :'<div class="empty">📭 Keine Checklisten-Vorlagen für deinen Fachbereich vorhanden.<br><small>Erstelle eine neue Vorlage mit dem Button oben.</small></div>'}`;
}
function openClForm(id){
  const tpl=id?S.clTemplates.find(t=>t.id===id):null;
  document.getElementById('clFormT').textContent=tpl?'Vorlage bearbeiten':'Neue Checkliste';
  document.getElementById('clFId').value=tpl?.id||'';
  document.getElementById('clFNm').value=tpl?.name||'';
  document.getElementById('clFDept').value=tpl?.department||(S.permissions.myDepts?.[0]||'technik');
  document.getElementById('clFItems').value=(tpl?.items||[]).map(i=>i.text).join('\n');
  openModal('clFormOv');
}
async function saveClTemplate(){
  const name=document.getElementById('clFNm').value.trim();
  const department=document.getElementById('clFDept').value;
  const items=document.getElementById('clFItems').value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(!name){toast('⚠️ Name erforderlich!');return;}
  if(!items.length){toast('⚠️ Mindestens einen Eintrag eingeben!');return;}
  const id=document.getElementById('clFId').value;
  try{
    if(id)await api('PUT','/checklists/templates/'+id,{name,department,items});
    else await api('POST','/checklists/templates',{name,department,items});
    await fetchData();closeModal('clFormOv');renderMain();toast(id?'✅ Vorlage aktualisiert!':'✅ Vorlage erstellt!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteClTpl(id){
  if(!confirm('Vorlage wirklich löschen?'))return;
  try{await api('DELETE','/checklists/templates/'+id);await fetchData();renderMain();toast('🗑️ Vorlage gelöscht.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

