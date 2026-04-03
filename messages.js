// ── MESSAGES ──
function renderMessages(){
  const isDP=S.permissions.isDP;
  const mine=S.messages.filter(m=>m.isMine);
  const received=S.messages.filter(m=>!m.isMine);
  document.getElementById('main').innerHTML=`
    <div class="ph"><div class="pt">✉️ Nachrichten</div>
      ${isDP?`<button class="btn-p" onclick="openModal('msgFormOv')">＋ Neue Nachricht</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h2 style="font-size:14px;font-weight:700;margin-bottom:10px">📥 Empfangen (${received.length})</h2>
        ${received.length?received.map(m=>{const snd=getU(m.fromUserId);return`<div class="msg-card${m.acked?'':' unread'}">
          <div class="msg-title">${m.title}</div>
          <div class="msg-meta">Von: ${snd?.name||'?'} · ${fdt(m.createdAt)} · ${m.toDepartment?DLBL[m.toDepartment]:'Alle Mitarbeiter'}</div>
          <div class="msg-body" style="margin-bottom:8px">${m.body}</div>
          ${m.acked?`<span class="bdg ap-approved">✓ Bestätigt</span>`:`<button class="btn-ok" onclick="ackMsg('${m.id}')">✓ Bestätigen & Quittieren</button>`}
        </div>`;}).join(''):'<div class="empty" style="padding:20px">📭 Keine Nachrichten erhalten.</div>'}
      </div>
      <div>
        <h2 style="font-size:14px;font-weight:700;margin-bottom:10px">📤 Gesendet (${mine.length})</h2>
        ${mine.length?mine.map(m=>`<div class="msg-card">
          <div class="msg-title">${m.title}</div>
          <div class="msg-meta">${fdt(m.createdAt)} · An: ${m.toDepartment?DLBL[m.toDepartment]:'Alle Mitarbeiter'}</div>
          <div class="msg-body">${m.body}</div>
        </div>`).join(''):`<div class="empty" style="padding:20px">${isDP?'Noch keine Nachrichten gesendet.':'Nur Dienstplanung kann Nachrichten senden.'}</div>`}
      </div>
    </div>`;
}
async function ackMsg(id){
  try{await api('POST','/messages/'+id+'/ack',{});await fetchData();renderMain();toast('✓ Nachricht bestätigt.');}
  catch(e){toast('⚠️ '+e.message,'err');}
}
async function sendMessage(){
  const title=document.getElementById('msgTitle').value.trim();
  const body=document.getElementById('msgBody').value.trim();
  const toDept=document.getElementById('msgTo').value;
  if(!title||!body){toast('⚠️ Betreff und Text sind erforderlich!');return;}
  try{await api('POST','/messages',{title,body,toDepartment:toDept||null});await fetchData();closeModal('msgFormOv');renderMain();toast('✅ Nachricht gesendet!');}
  catch(e){toast('⚠️ '+e.message,'err');}
}

