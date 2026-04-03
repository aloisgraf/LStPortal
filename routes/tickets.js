'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, getUser, canSeeTk, canEditTk, nextTicketNumber, auditNote, createNotification, parseMentions } = require('../db');
const { auth, ok, bad } = require('../middleware');

async function logAct(pool, newId, uid, name, action, details={}) {
  await pool.query(
    'INSERT INTO activity_log (id,user_id,user_name,action,details,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
    [newId(), uid, name, action, JSON.stringify(details)]
  ).catch(()=>{});
}

router.post('/', auth, async (req,res) => {
  try {
    const {title,description,department,tags,priority,status,bucket,assigneeId,parentTicketId} = req.body;
    if (!title?.trim()) return bad(res,'Titel erforderlich');
    const id=newId(), number=await nextTicketNumber();
    await pool.query('INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id,number,title.trim(),description||'',department||'technik',JSON.stringify(tags||[]),priority||'medium',status||'open',bucket||'',assigneeId||null,parentTicketId||null,req.uid]);
    const uname = (await getUser(req.uid))?.name||'?';
    await auditNote(id,req.uid,`✅ Ticket erstellt von ${uname}`);
    const deptUsers = await q('SELECT id FROM users WHERE roles @> $1::jsonb AND id != $2',
      [JSON.stringify([department]), req.uid]);
    for (const u of deptUsers)
      await createNotification(u.id,'new_ticket',`Neues Ticket in ${department}: ${title.trim()}`,id,null,req.uid);
    if (assigneeId && assigneeId!==req.uid)
      await createNotification(assigneeId,'assigned',`Dir wurde zugewiesen: ${title.trim()}`,id,null,req.uid);
    await logAct(pool,newId,req.uid,req.user.name,'create_ticket',{number,title:title.trim()});
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
    const DL={technik:'Technik',leitung:'Leitung',dienstplanung:'Dienstplanung',ausbildung:'Ausbildung',qm:'QM'};
    if (b.status!==undefined&&b.status!==tk.status) await auditNote(tk.id,req.uid,`🔄 Status: ${SL[tk.status]} → ${SL[b.status]} (${uname})`);
    if (b.priority!==undefined&&b.priority!==tk.priority) await auditNote(tk.id,req.uid,`⚡ Priorität: ${PL[tk.priority]} → ${PL[b.priority]} (${uname})`);
    if (b.department!==undefined&&b.department!==tk.department) await auditNote(tk.id,req.uid,`🏢 Fachbereich: ${DL[tk.department]} → ${DL[b.department]} (${uname})`);
    if (b.assigneeId!==undefined&&b.assigneeId!==tk.assignee_id) {
      const oldN=tk.assignee_id?(await getUser(tk.assignee_id))?.name||'?':'niemand';
      const newN=b.assigneeId?(await getUser(b.assigneeId))?.name||'?':'niemand';
      const msg = b.assigneeId===req.uid ? `🙋 ${uname} hat das Ticket übernommen` : `👤 Zuständigkeit: ${oldN} → ${newN} (${uname})`;
      await auditNote(tk.id,req.uid,msg);
      if (b.assigneeId && b.assigneeId!==req.uid)
        await createNotification(b.assigneeId,'assigned',`Dir wurde zugewiesen: ${tk.title}`,tk.id,null,req.uid);
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
    if (!setClauses.length) return ok(res);
    add('updated_at',new Date().toISOString());
    vals.push(req.params.id);
    await pool.query(`UPDATE tickets SET ${setClauses.join(',')} WHERE id=$${vals.length}`,vals);
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
    await logAct(pool,newId,req.uid,req.user.name,'delete_ticket',{id:req.params.id});
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
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,note_type,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id,req.params.id,text,req.uid,'note',now]);
    await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2',[now,req.params.id]);
    const allUsers = await q('SELECT id,name FROM users');
    const mentioned = parseMentions(text, allUsers);
    const author = await getUser(req.uid);
    for (const u of mentioned) {
      if (u.id === req.uid) continue;
      await createNotification(u.id,'mention',`${author?.name||'?'} erwähnte dich in ${tk.number}`,tk.id,id,req.uid);
    }
    ok(res,{id,createdAt:now});
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
