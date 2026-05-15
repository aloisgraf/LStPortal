'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, getUser, logAct, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification, parseMentions } = require('../db');
const { auth, ok, bad } = require('../middleware');


router.post('/', auth, async (req,res) => {
  try {
    const {title,description,department,subcategory,tags,priority,status,bucket,assigneeId,parentTicketId,dueDate} = req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    const id=newId(), number=await nextTicketNumber();
    const subcat = subcategory||'';
    await pool.query('INSERT INTO tickets (id,number,title,description,department,subcategory,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [id,number,title.trim(),description||'',department||'technik',subcat,JSON.stringify(tags||[]),priority||'medium',status||'open',bucket||'',assigneeId||null,parentTicketId||null,req.uid,dueDate||null]);
    const uname = (await getUser(req.uid))?.name||'?';
    await auditNote(id,req.uid,`✅ Ticket erstellt von ${uname}${subcat?' ['+subcat+']':''}`);
    const deptUsers = await q('SELECT id FROM users WHERE roles @> $1::jsonb AND id != $2',
      [JSON.stringify([department]), req.uid]);
    for (const u of deptUsers)
      await createNotification(u.id,'new_ticket',`Neues Ticket in ${department}: ${title.trim()}`,id,null,req.uid);
    if (subcat) {
      const subcatUsers = await q(
        "SELECT DISTINCT id FROM users WHERE (roles::text LIKE '%schichtleiter%' OR roles::text LIKE '%leitung%' OR roles::text LIKE '%qm%') AND id != $1",
        [req.uid]);
      for (const u of subcatUsers)
        await createNotification(u.id,'new_ticket',`Neue Beschwerde: ${title.trim()}`,id,null,req.uid);
    }
    if (assigneeId && assigneeId!==req.uid)
      await createNotification(assigneeId,'assigned',`Dir wurde zugewiesen: ${title.trim()}`,id,null,req.uid);
    await logAct(req.uid,req.user.name,'create_ticket',{number,title:title.trim()});
    // Eigene Tickets direkt als gesehen markieren
    await pool.query(`INSERT INTO ticket_views (ticket_id,user_id,viewed_at) VALUES ($1,$2,NOW()) ON CONFLICT (ticket_id,user_id) DO UPDATE SET viewed_at=NOW()`,
      [id,req.uid]).catch(()=>{});
    ok(res,{id,number});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const b=req.body, setClauses=[], vals=[];
    const add=(col,val)=>{ vals.push(val); setClauses.push(`${col}=$${vals.length}`); };
    const uname=(await getUser(req.uid))?.name||'?';
    const PL={low:'Gering',medium:'Mittel',high:'Hoch'};
    const SL={open:'Offen',in_progress:'In Bearbeitung',on_hold:'Zurückgestellt',closed:'Abgeschlossen'};
    const DL={frei:'Frei',technik:'Technik',leitung:'Leitung',dienstplanung:'Dienstplanung',ausbildung:'Ausbildung',qm:'QM'};
    const BL={urgent:'Dringend',week:'Diese Woche',sched:'Dienstplanung',wait:'Wartet',it:'IT',proj:'Projekte',org:'Organisation',ideas:'Ideen'};
    const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
    // Audit: alle relevanten Feldänderungen protokollieren
    if (b.status!==undefined&&b.status!==tk.status)
      await auditNote(tk.id,req.uid,`FIELD:status:${SL[tk.status]||tk.status}:${SL[b.status]||b.status}`);
    if (b.priority!==undefined&&b.priority!==tk.priority)
      await auditNote(tk.id,req.uid,`FIELD:priority:${PL[tk.priority]||tk.priority}:${PL[b.priority]||b.priority}`);
    if (b.department!==undefined&&b.department!==tk.department)
      await auditNote(tk.id,req.uid,`FIELD:department:${DL[tk.department]||tk.department}:${DL[b.department]||b.department}`);
    if (b.title!==undefined&&b.title!==tk.title)
      await auditNote(tk.id,req.uid,`FIELD:title:${tk.title}:${b.title}`);
    if (b.bucket!==undefined&&(b.bucket||'')!==(tk.bucket||''))
      await auditNote(tk.id,req.uid,`FIELD:bucket:${BL[tk.bucket]||tk.bucket||'—'}:${BL[b.bucket]||b.bucket||'—'}`);
    if (b.isPublic!==undefined&&!!b.isPublic!==!!tk.is_public)
      await auditNote(tk.id,req.uid,`FIELD:visibility:${tk.is_public?'Öffentlich':'Privat'}:${b.isPublic?'Öffentlich':'Privat'}`);
    if (b.subcategory!==undefined&&(b.subcategory||'')!==(tk.subcategory||''))
      await auditNote(tk.id,req.uid,`FIELD:subcategory:${tk.subcategory||'—'}:${b.subcategory||'—'}`);
    if (b.dueDate!==undefined&&(b.dueDate||null)!==(tk.due_date?tk.due_date.toISOString?.().slice(0,10)||String(tk.due_date).slice(0,10):null))
      await auditNote(tk.id,req.uid,`FIELD:due_date:${fmtDate(tk.due_date)}:${fmtDate(b.dueDate)}`);
    if (b.snoozedUntil!==undefined&&(b.snoozedUntil||null)!==(tk.snoozed_until?String(tk.snoozed_until).slice(0,10):null))
      await auditNote(tk.id,req.uid,`FIELD:snoozed_until:${fmtDate(tk.snoozed_until)}:${fmtDate(b.snoozedUntil)}`);
    if (b.assigneeId!==undefined&&(b.assigneeId||null)!==(tk.assignee_id||null)) {
      const oldN=tk.assignee_id?(await getUser(tk.assignee_id))?.name||'?':'—';
      const newN=b.assigneeId?(await getUser(b.assigneeId))?.name||'?':'—';
      await auditNote(tk.id,req.uid,`FIELD:assignee:${oldN}:${newN}`);
      if (b.assigneeId && b.assigneeId!==req.uid)
        await createNotification(b.assigneeId,'assigned',`Dir wurde zugewiesen: ${tk.title}`,tk.id,null,req.uid);
    }
    if (b.parentTicketId!==undefined&&(b.parentTicketId||null)!==(tk.parent_ticket_id||null)) {
      const oldP=tk.parent_ticket_id?(await q1('SELECT number FROM tickets WHERE id=$1',[tk.parent_ticket_id]))?.number||'?':'—';
      const newP=b.parentTicketId?(await q1('SELECT number FROM tickets WHERE id=$1',[b.parentTicketId]))?.number||'?':'—';
      await auditNote(tk.id,req.uid,`FIELD:parent:${oldP}:${newP}`);
    }
    if (b.tags!==undefined) {
      const oldTags=(()=>{try{return JSON.parse(tk.tags||'[]');}catch{return[];}})();
      const newTags=b.tags||[];
      if (JSON.stringify([...oldTags].sort())!==JSON.stringify([...newTags].sort()))
        await auditNote(tk.id,req.uid,`FIELD:tags:${oldTags.length}:${newTags.length}`);
    }
    if (b.title!==undefined) add('title',b.title);
    if (b.description!==undefined) add('description',b.description);
    if (b.department!==undefined) add('department',b.department);
    if (b.tags!==undefined) add('tags',JSON.stringify(b.tags));
    if (b.priority!==undefined) add('priority',b.priority);
    if (b.status!==undefined) add('status',b.status);
    if (b.bucket!==undefined) add('bucket',b.bucket);
    if (b.isPublic!==undefined) add('is_public',!!b.isPublic);
    if (b.assigneeId!==undefined) add('assignee_id',b.assigneeId||null);
    if (b.parentTicketId!==undefined) add('parent_ticket_id',b.parentTicketId||null);
    if (b.subcategory!==undefined) add('subcategory',b.subcategory||'');
    if (b.dueDate!==undefined) add('due_date',b.dueDate||null);
    if (b.snoozedUntil!==undefined) add('snoozed_until',b.snoozedUntil||null);
    if (!setClauses.length) return ok(res);
    add('updated_at',new Date().toISOString());
    vals.push(req.params.id);
    await pool.query(`UPDATE tickets SET ${setClauses.join(',')} WHERE id=$${vals.length}`,vals);
    await pool.query(`INSERT INTO ticket_views (ticket_id,user_id,viewed_at) VALUES ($1,$2,NOW()) ON CONFLICT (ticket_id,user_id) DO UPDATE SET viewed_at=NOW()`,
      [req.params.id,req.uid]).catch(()=>{});
    await logAct(req.uid,req.user.name,'update_ticket',{id:req.params.id});
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/:id', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_notes WHERE ticket_id=$1',[req.params.id]);
    await pool.query('DELETE FROM tickets WHERE id=$1',[req.params.id]);
    await logAct(req.uid,req.user.name,'delete_ticket',{id:req.params.id});
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.post('/:id/notes', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const text=req.body?.text?.trim();
    if (!text) return bad(res,'Text erforderlich');
    const id=newId(), now=new Date().toISOString();
    const allUsers = await q('SELECT id,name FROM users');
    const mentioned = parseMentions(text, allUsers);
    const mentionedIds = mentioned.map(u=>u.id);
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,note_type,created_at,mentioned_users) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id,req.params.id,text,req.uid,'note',now,JSON.stringify(mentionedIds)]);
    // Add mentioned users to ticket so they can see it
    try {
      if(mentionedIds.length){
        const existing=(()=>{try{return JSON.parse(tk.mentioned_users||'[]');}catch{return[];}})();
        const merged=[...new Set([...existing,...mentionedIds])];
        await pool.query('UPDATE tickets SET mentioned_users=$1,updated_at=$2 WHERE id=$3',[JSON.stringify(merged),now,req.params.id]);
      } else {
        await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2',[now,req.params.id]);
      }
    } catch(mentionErr) {
      // mentioned_users column might not exist yet - just update updated_at
      await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2',[now,req.params.id]).catch(()=>{});
    }
    const author = await getUser(req.uid);
    for (const u of mentioned) {
      if (u.id === req.uid) continue;
      await createNotification(u.id,'mention',`${author?.name||'?'} erwähnte dich in ${tk.number}`,tk.id,id,req.uid);
    }
    ok(res,{id,createdAt:now});
  } catch(e) { bad(res,e.message,500); }
});

router.delete('/:id/notes/:noteId', auth, async (req,res) => {
  try {
    const note = await q1('SELECT * FROM ticket_notes WHERE id=$1 AND ticket_id=$2',[req.params.noteId,req.params.id]);
    if (!note) return bad(res,'Nicht gefunden',404);
    if (note.author_id!==req.uid && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    if (note.note_type==='audit') return bad(res,'Protokolleinträge können nicht gelöscht werden',403);
    await pool.query('DELETE FROM ticket_notes WHERE id=$1',[req.params.noteId]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// TICKET CHECKLISTS
router.post('/:id/checklists', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.body.templateId]);
    if (!tmpl) return bad(res,'Vorlage nicht gefunden',404);
    const items = await q('SELECT * FROM checklist_template_items WHERE template_id=$1 ORDER BY sort_order',[tmpl.id]);
    const clId=newId();
    await pool.query('INSERT INTO ticket_checklists (id,ticket_id,template_id,name,created_by) VALUES ($1,$2,$3,$4,$5)',[clId,req.params.id,tmpl.id,tmpl.name,req.uid]);
    for (const item of items)
      await pool.query('INSERT INTO ticket_checklist_items (id,checklist_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),clId,item.text,item.item_type||'check',item.sort_order]);
    await auditNote(req.params.id,req.uid,`📋 Checkliste angehängt: "${tmpl.name}"`);
    ok(res,{id:clId});
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/:id/checklists/:cid', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_checklist_items WHERE checklist_id=$1',[req.params.cid]);
    await pool.query('DELETE FROM ticket_checklists WHERE id=$1',[req.params.cid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id/checklists/:cid/sync', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const cl = await q1('SELECT * FROM ticket_checklists WHERE id=$1',[req.params.cid]);
    if (!cl||!cl.template_id) return bad(res,'Keine Vorlage verknüpft',400);
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[cl.template_id]);
    if (!tmpl) return bad(res,'Vorlage nicht gefunden',404);
    const tplItems = await q('SELECT * FROM checklist_template_items WHERE template_id=$1 ORDER BY sort_order',[cl.template_id]);
    const existing = await q('SELECT * FROM ticket_checklist_items WHERE checklist_id=$1',[req.params.cid]);
    // match by text to preserve completion state
    const existMap = {};
    for (const e of existing) existMap[e.text] = e;
    const tplTexts = new Set(tplItems.map(i=>i.text));
    // delete items no longer in template
    for (const e of existing) {
      if (!tplTexts.has(e.text))
        await pool.query('DELETE FROM ticket_checklist_items WHERE id=$1',[e.id]);
    }
    // add new items, update sort_order for existing
    for (const ti of tplItems) {
      if (existMap[ti.text]) {
        await pool.query('UPDATE ticket_checklist_items SET sort_order=$1,item_type=$2 WHERE id=$3',
          [ti.sort_order, ti.item_type||'check', existMap[ti.text].id]);
      } else {
        await pool.query('INSERT INTO ticket_checklist_items (id,checklist_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
          [newId(), req.params.cid, ti.text, ti.item_type||'check', ti.sort_order]);
      }
    }
    // update checklist name in case template was renamed
    await pool.query('UPDATE ticket_checklists SET name=$1 WHERE id=$2',[tmpl.name, req.params.cid]);
    await auditNote(req.params.id, req.uid, `🔄 Checkliste aktualisiert: "${tmpl.name}"`);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id/checklists/:cid/items/:iid', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk||!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    const item = await q1('SELECT * FROM ticket_checklist_items WHERE id=$1',[req.params.iid]);
    if (!item) return bad(res,'Item nicht gefunden',404);
    const {completed, userNote} = req.body;
    if (completed === true)
      await pool.query('UPDATE ticket_checklist_items SET completed_by=$1,completed_at=NOW(),user_note=$2 WHERE id=$3',
        [req.uid, userNote||item.user_note||'', req.params.iid]);
    else if (completed === false)
      await pool.query('UPDATE ticket_checklist_items SET completed_by=NULL,completed_at=NULL WHERE id=$1',[req.params.iid]);
    else if (userNote !== undefined)
      await pool.query('UPDATE ticket_checklist_items SET user_note=$1 WHERE id=$2',[userNote,req.params.iid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// CHECKLIST TEMPLATES
// ── TICKET ANSEHEN ──
router.delete('/:id', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!canEditTk(req.tp,tk,req.uid)) return bad(res,'Keine Berechtigung',403);
    await pool.query('UPDATE tickets SET is_deleted=true,deleted_at=NOW(),deleted_by=$1 WHERE id=$2',[req.uid,req.params.id]);
    await auditNote(req.params.id, req.uid, '🗑️ Ticket gelöscht');
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id/restore', auth, async (req,res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1',[req.params.id]);
    if (!tk) return bad(res,'Nicht gefunden',404);
    if (!req.tp.editAll && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('UPDATE tickets SET is_deleted=false,deleted_at=NULL,deleted_by=NULL WHERE id=$1',[req.params.id]);
    await auditNote(req.params.id, req.uid, '♻️ Ticket wiederhergestellt');
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id/view', auth, async (req,res) => {
  try {
    await pool.query(
      `INSERT INTO ticket_views (ticket_id,user_id,viewed_at) VALUES ($1,$2,NOW())
       ON CONFLICT (ticket_id,user_id) DO UPDATE SET viewed_at=NOW()`,
      [req.params.id, req.uid]
    );
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});


module.exports = router;
