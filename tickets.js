// ── TICKETS ──
function getVisTks(closed=false){
  return S.tickets.filter(tk=>{
    if(closed!==(tk.status==='closed'))return false;
    if(S.tkFD&&tk.department!==S.tkFD)return false;
    if(S.tkFP&&tk.priority!==S.tkFP)return false;
    if(S.tkFB&&tk.bucket!==S.tkFB)return false;
    if(S.tkFS&&tk.status!==S.tkFS)return false;
    if(S.tkSrch){const s=S.tkSrch.toLowerCase();if(!tk.title.toLowerCase().includes(s)&&!tk.number.toLowerCase().includes(s))return false;}
    return true;
  }).sort((a,b)=>{const po={high:0,medium:1,low:2};return((po[a.priority]||1)-(po[b.priority]||1))||b.createdAt.localeCompare(a.createdAt);});
}
function renderTickets(){
  const closed=S.view==='tickets_closed';
  const tks=getVisTks(closed);
  document.getElementById('main').innerHTML=`
    <div class="ph">
      <div class="pt">${closed?'Abgeschlossene':'Offene'} Tickets <small>(${tks.length})</small></div>
      <button class="btn-p" onclick="openTkForm(null)">＋ Ticket erstellen</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <input class="srch" type="text" placeholder="Suchen …" value="${S.tkSrch}" oninput="S.tkSrch=this.value;renderMain()" style="width:200px">
      <select class="flt" onchange="S.tkFT2=this.value;renderMain()"><option value="">Alle Tags</option>${S.tags.map(t=>`<option value="${t.id}"${S.tkFT2===t.id?' selected':''}>${t.label}</option>`).join('')}</select>
      <select class="flt" onchange="S.tkFA=this.value;renderMain()"><option value="">Alle Bearbeiter</option>${S.users.map(u=>`<option value="${u.id}"${S.tkFA===u.id?' selected':''}>${u.name}</option>`).join('')}</select>
    </div>
    <div class="tw">
      <table><thead><tr><th>#</th><th>Titel</th><th>Fachbereich</th><th>Priorität</th><th>Status</th><th>Tags</th><th>Zuständig</th><th>Datum</th></tr></thead>
      <tbody>${tks.length?tks.map(tk=>{
        const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
        const asn=getU(tk.assigneeId);
        const bkt=BKTS.find(b=>b.id===tk.bucket);
        const isChild=!!tk.parentTicketId;
        return`<tr class="clickable${isChild?' tk-sub-row':''}" onclick="openTkDetail('${tk.id}')">
          <td style="white-space:nowrap"><span style="font-family:monospace;font-size:11px;color:var(--mu)">${isChild?'↳ ':''} ${tk.number}</span>${tk.isPublic?`<span class="bdg" style="font-size:9px;padding:1px 4px;margin-left:3px;background:color-mix(in srgb,var(--ok)12%,transparent);color:var(--ok)">🌐</span>`:''}</td>
          <td style="max-width:220px"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tk.title}</div>${bkt?`<div style="font-size:10px;color:var(--mu)">${bkt.label}</div>`:''}${tk.notes?.length?`<div style="font-size:10px;color:var(--di)">💬 ${tk.notes.filter(n=>!n.isSystem).length} Notizen</div>`:''}</td>
          <td>${dBdg(tk.department)}</td><td>${prioBdg(tk.priority)}</td><td>${stBdg(tk.status)}</td>
          <td>${tagC(tk.tags)}</td>
          <td>${asn?`<div style="display:flex;align-items:center;gap:5px">${avH(asn.initials,asn.color,20,8)}<span style="font-size:12px">${asn.name}</span></div>`:'<span style="color:var(--di);font-size:11px">—</span>'}</td>
          <td style="font-size:11px;color:var(--mu);white-space:nowrap">${fd(tk.createdAt?.slice(0,10))}</td>
        </tr>`;
      }).join(''):`<tr><td colspan="8"><div class="empty">📭 Keine Tickets</div></td></tr>`}
      </tbody></table>
    </div>`;
}
function openTkDetail(id){S.currentTicketId=id;renderTkDetail();openModal('tkDetOv');}
function renderTkDetail(){
  const tk=getTk(S.currentTicketId);if(!tk)return;
  const canEdit=tk._canEdit;
  const par=tk.parentTicketId?getTk(tk.parentTicketId):null;
  const subs=S.tickets.filter(t=>t.parentTicketId===tk.id);
  document.getElementById('tkDetNum').textContent=tk.number;
  document.getElementById('tkDetTitle').textContent=tk.title;
  document.getElementById('tkDetPrio').innerHTML=prioBdg(tk.priority);
  document.getElementById('tkDetSt').innerHTML=stBdg(tk.status);
  document.getElementById('tkDetEditBtn').style.display=canEdit?'':'none';
  const bkt=BKTS.find(b=>b.id===tk.bucket);
  // Main area
  document.getElementById('tkDetMain').innerHTML=`
    <div><label style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--di);display:block;margin-bottom:5px">BESCHREIBUNG</label>
      <div style="font-size:13px;line-height:1.6;color:${tk.description?'var(--tx)':'var(--di)'}">${tk.description||'Keine Beschreibung vorhanden.'}</div>
    </div>
    ${subs.length||canEdit?`<div>
      <label style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--di);display:block;margin-bottom:6px">UNTERTICKETS (${subs.length})</label>
      <div class="subl">${subs.map(st=>`<div class="subi" onclick="S.currentTicketId='${st.id}';renderTkDetail()">${avH('↳','#888',16,10)}<span style="font-family:monospace;font-size:11px;color:var(--mu)">${st.number}</span><span style="flex:1;font-size:12px;font-weight:500">${st.title}</span>${stBdg(st.status)}</div>`).join('')}
      ${canEdit?`<button class="btn-s" style="font-size:11px" onclick="openTkForm(null,'${tk.id}')">＋ Unterticket erstellen</button>`:''}
      </div></div>`:''}
    ${renderTkChecklists(tk,canEdit)}
    <div>
      <label style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--di);display:block;margin-bottom:6px">NOTIZEN & ÄNDERUNGEN (${(tk.notes||[]).length})</label>
      <div class="nfeed">${(tk.notes||[]).map(n=>{
        const a=n.authorId?getU(n.authorId):null;
        if(n.isSystem)return`<div class="ni2 sys"><span style="font-size:10px;color:var(--di)">🔄 ${fdt(n.createdAt)}</span><div class="nt sys">${n.text}</div></div>`;
        return`<div class="ni2"><div>${a?avH(a.initials,a.color,18,8):''}<span class="na">${a?.name||'?'}</span><span class="nd">${fdt(n.createdAt)}</span></div><div class="nt">${n.text}</div></div>`;
      }).join('')||'<div style="color:var(--di);font-size:12px">Noch keine Notizen.</div>'}
      </div>
      ${canEdit?`<div style="display:flex;gap:7px;align-items:flex-end;margin-top:10px"><textarea id="noteInp" rows="2" placeholder="Notiz hinzufügen …" class="textarea" style="flex:1;min-height:56px"></textarea><button class="btn-p" onclick="addNote('${tk.id}')" style="padding:8px 12px;white-space:nowrap">Senden</button></div>`:''}
    </div>`;
  // Sidebar
  const std=S.permissions.isStandard;
  document.getElementById('tkDetSB').innerHTML=`
    ${canEdit?`
    <div class="tkf"><label>Status</label>${std?stBdg(tk.status):`<select onchange="updateTkF('${tk.id}','status',this.value)">${STS.map(s=>`<option value="${s.id}"${tk.status===s.id?' selected':''}>${s.label}</option>`).join('')}</select>`}</div>
    <div class="tkf"><label>Priorität</label><select onchange="updateTkF('${tk.id}','priority',this.value)">${PRIO.map(p=>`<option value="${p.id}"${tk.priority===p.id?' selected':''}>${p.label}</option>`).join('')}</select></div>
    <div class="tkf"><label>Fachbereich</label><select onchange="updateTkF('${tk.id}','department',this.value)">${DEPTS.map(d=>`<option value="${d}"${tk.department===d?' selected':''}>${DLBL[d]}</option>`).join('')}</select></div>
    ${!std?`<div class="tkf"><label>Bucket</label><select onchange="updateTkF('${tk.id}','bucket',this.value)"><option value="">— keiner —</option>${BKTS.map(b=>`<option value="${b.id}"${tk.bucket===b.id?' selected':''}>${b.label}</option>`).join('')}</select></div>`:''}
    <div class="tkf"><label>Zuständig</label><div style="display:flex;gap:5px">
      <select onchange="updateTkF('${tk.id}','assigneeId',this.value||null)" style="flex:1"><option value="">— niemand —</option>${S.users.map(u=>`<option value="${u.id}"${tk.assigneeId===u.id?' selected':''}>${u.name}</option>`).join('')}</select>
      ${tk.assigneeId!==S.currentUser?`<button class="btn-ok" onclick="updateTkF('${tk.id}','assigneeId','${S.currentUser}')" title="Ticket übernehmen">Ich</button>`:''}
    </div></div>
    ${S.permissions.canSetPublic?`<div class="tkf"><label>Sichtbarkeit</label><button class="bdg ${tk.isPublic?'ap-approved':'ap-pending'}" onclick="updateTkF('${tk.id}','isPublic',${!tk.isPublic})" style="cursor:pointer;padding:5px 12px;border-radius:6px;font-size:12px;width:100%;justify-content:center">${tk.isPublic?'🌐 Öffentlich':'🔒 Privat'}</button></div>`:''}
    ${!std?`<div class="tkf"><label>Checkliste anhängen</label><div style="display:flex;gap:5px"><select id="clAttSel" style="flex:1;font-size:12px"><option value="">— Vorlage wählen —</option>${S.clTemplates.map(t=>`<option value="${t.id}">${t.name} (${DLBL[t.department]||t.department})</option>`).join('')}</select><button class="btn-p" onclick="attachChecklist('${tk.id}')" style="padding:5px 8px;font-size:12px">＋</button></div></div>`:''}
    <div class="tkf"><label>Elternticket</label><select onchange="updateTkF('${tk.id}','parentTicketId',this.value||null)"><option value="">— kein —</option>${S.tickets.filter(t=>t.id!==tk.id&&t.status!=='closed').map(t=>`<option value="${t.id}"${tk.parentTicketId===t.id?' selected':''}>${t.number}: ${t.title.slice(0,30)}</option>`).join('')}</select></div>
    `:`
    <div class="tkf"><label>Status</label><div class="val">${stBdg(tk.status)}</div></div>
    <div class="tkf"><label>Priorität</label><div class="val">${prioBdg(tk.priority)}</div></div>
    <div class="tkf"><label>Fachbereich</label><div class="val">${dBdg(tk.department)}</div></div>
    <div class="tkf"><label>Bucket</label><div class="val" style="font-size:12px">${bkt?.label||'—'}</div></div>
    <div class="tkf"><label>Zuständig</label><div class="val">${getU(tk.assigneeId)?`<div style="display:flex;align-items:center;gap:5px">${avH(getU(tk.assigneeId).initials,getU(tk.assigneeId).color,20,8)}<span style="font-size:12px">${getU(tk.assigneeId).name}</span></div>`:'—'}</div></div>
    `}
    <div class="tkdiv"></div>
    <div class="tkf"><label>Tags</label><div style="margin-top:3px">${tagC(tk.tags)||'<span style="color:var(--di);font-size:11px">Keine</span>'}</div></div>
    <div class="tkf"><label>Erstellt von</label><div class="val" style="font-size:12px">${getU(tk.createdBy)?.name||'?'}</div></div>
    <div class="tkf"><label>Erstellt am</label><div class="val" style="font-size:11px;color:var(--mu)">${fdt(tk.createdAt)}</div></div>
    <div class="tkf"><label>Zuletzt geändert</label><div class="val" style="font-size:11px;color:var(--mu)">${fdt(tk.updatedAt)}</div></div>
    ${par?`<div class="tkf"><label>Elternticket</label><div class="subi" style="padding:5px 8px;margin-top:3px;cursor:pointer" onclick="S.currentTicketId='${par.id}';renderTkDetail()"><span style="font-family:monospace;font-size:11px">${par.number}</span><span style="font-size:12px;flex:1;margin-left:6px">${par.title.slice(0,28)}</span></div></div>`:''}
    ${canEdit&&tk.status!=='closed'?`<div class="tkdiv"></div><button class="btn-ok" style="width:100%;justify-content:center;padding:7px" onclick="updateTkF('${tk.id}','status','closed')">✓ Ticket abschließen</button>`:''}
    ${canEdit?`<button class="btn-d" style="width:100%;justify-content:center;margin-top:4px;padding:5px" onclick="deleteTk('${tk.id}')">🗑️ Ticket löschen</button>`:''}
    `;
}
function renderTkChecklists(tk,canEdit){
  if(!tk.checklists||!tk.checklists.length)return'';
  return`<div>
    <label style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--di);display:block;margin-bottom:6px">CHECKLISTEN</label>
    ${tk.checklists.map(cl=>{
      const done=cl.items.filter(i=>i.checked).length,total=cl.items.length;
      return`<div class="tk-cl">
        <div class="tk-cl-h"><span>${cl.name} <span style="color:var(--mu);font-weight:400">(${done}/${total})</span></span>
        ${canEdit?`<button class="btn-d" style="font-size:10px;padding:2px 5px" onclick="detachChecklist('${cl.id}')">✕</button>`:''}
        </div>
        ${cl.items.map(it=>`<div class="tk-cl-it${it.checked?' done':''}">
          ${canEdit?`<input type="checkbox" ${it.checked?'checked':''} onchange="toggleClItem('${it.id}',this)">`:'<input type="checkbox" disabled '+( it.checked?'checked':'')+'>'}
          <span>${it.text}</span>
          ${it.checked&&it.checkedBy?`<span class="cl-who">${getU(it.checkedBy)?.name||'?'}</span>`:''}
        </div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;
}
async function attachChecklist(tkId){
  const sel=document.getElementById('clAttSel');
  if(!sel?.value){toast('⚠️ Bitte Vorlage wählen!');return;}
  try{await api('POST','/tickets/'+tkId+'/checklists',{templateId:sel.value});await fetchData();renderTkDetail();toast('✅ Checkliste angehängt!');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function detachChecklist(clId){
  if(!confirm('Checkliste vom Ticket entfernen?'))return;
  try{await api('DELETE','/ticket-checklists/'+clId);await fetchData();renderTkDetail();toast('🗑️ Checkliste entfernt.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function toggleClItem(itemId,cb){
  try{await api('PUT','/checklist-items/'+itemId+'/toggle',{});await fetchData();renderTkDetail();}
  catch(e){cb.checked=!cb.checked;toast('⚠️ '+e.message,'err');}
}
async function updateTkF(id,field,value){
  try{await api('PUT','/tickets/'+id,{[field]:value});await fetchData();renderMain();renderTkDetail();}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function addNote(tkId){
  const inp=document.getElementById('noteInp');
  if(!inp?.value.trim())return;
  try{await api('POST','/tickets/'+tkId+'/notes',{text:inp.value.trim()});await fetchData();renderTkDetail();}
  catch(e){toast('⚠️ '+e.message,'err');}
}
function editCurrentTicket(){openTkForm(S.currentTicketId);}
function openTkForm(id,parentId){
  const tk=id?getTk(id):null;
  document.getElementById('tkFT').textContent=tk?`Ticket bearbeiten: ${tk.number}`:'Neues Ticket';
  document.getElementById('tkFId').value=tk?.id||'';
  document.getElementById('tkFNm').value=tk?.title||'';
  document.getElementById('tkFDesc').value=tk?.description||'';
  document.getElementById('tkFDept').value=tk?.department||'technik';
  document.getElementById('tkFPrio').value=tk?.priority||'medium';
  document.getElementById('tkFSt').value=tk?.status||'open';
  document.getElementById('tkFBkt').innerHTML='<option value="">— kein Bucket —</option>'+BKTS.map(b=>`<option value="${b.id}"${tk?.bucket===b.id?' selected':''}>${b.label}</option>`).join('');
  document.getElementById('tkFTags').innerHTML=S.tags.map(t=>`<option value="${t.id}"${tk?.tags?.includes(t.id)?' selected':''}>${t.label}</option>`).join('');
  document.getElementById('tkFAsgn').innerHTML='<option value="">— niemand —</option>'+S.users.map(u=>`<option value="${u.id}"${tk?.assigneeId===u.id?' selected':''}>${u.name}</option>`).join('');
  document.getElementById('tkFPar').innerHTML='<option value="">— kein Elternticket —</option>'+S.tickets.filter(t=>!id||t.id!==id).map(t=>`<option value="${t.id}"${(tk?.parentTicketId||parentId)===t.id?' selected':''}>${t.number}: ${t.title.slice(0,40)}</option>`).join('');
  // Hide status/bucket for standard users
  document.getElementById('tkFAdvRow').style.display=S.permissions.isStandard?'none':'grid';
  closeModal('tkDetOv');openModal('tkFormOv');
}
async function saveTicket(){
  const nm=document.getElementById('tkFNm').value.trim();
  if(!nm){toast('⚠️ Titel ist erforderlich!');return;}
  const id=document.getElementById('tkFId').value;
  const tags=Array.from(document.getElementById('tkFTags').selectedOptions).map(o=>o.value);
  const body={title:nm,description:document.getElementById('tkFDesc').value.trim(),department:document.getElementById('tkFDept').value,priority:document.getElementById('tkFPrio').value,status:document.getElementById('tkFSt').value,bucket:document.getElementById('tkFBkt').value,tags,assigneeId:document.getElementById('tkFAsgn').value||null,parentTicketId:document.getElementById('tkFPar').value||null};
  try{
    if(id)await api('PUT','/tickets/'+id,body);
    else await api('POST','/tickets',body);
    await fetchData();closeModal('tkFormOv');renderMain();toast(id?'✅ Ticket aktualisiert!':'✅ Ticket erstellt!');
  }catch(e){toast('⚠️ '+e.message,'err');}
}
async function deleteTk(id){
  if(!confirm('Ticket wirklich löschen?'))return;
  try{await api('DELETE','/tickets/'+id);await fetchData();closeModal('tkDetOv');renderMain();toast('🗑️ Ticket gelöscht.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

