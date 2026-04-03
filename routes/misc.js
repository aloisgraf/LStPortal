'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, q1, newId, pool, parseRoles, canSeeMsg } = require('../db');
const { auth, adminOnly, ok, bad } = require('../middleware');

async function logAct(pool, newId, uid, name, action, details={}) {
  await pool.query(
    'INSERT INTO activity_log (id,user_id,user_name,action,details,created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
    [newId(), uid, name, action, JSON.stringify(details)]
  ).catch(()=>{});
}

router.put('/allowances', auth, async (req,res) => {
  try {
    if (!req.p.editAllw) return bad(res,'Keine Berechtigung',403);
    const {userId,year,month,nd,fd,fw,c10} = req.body;
    await pool.query(`INSERT INTO allowances (id,user_id,year,month,nd,fd,fw,c10) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id,year,month) DO UPDATE SET nd=EXCLUDED.nd,fd=EXCLUDED.fd,fw=EXCLUDED.fw,c10=EXCLUDED.c10`,
      [newId(),userId,year,month,nd||0,fd||0,fw||0,c10||0]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ABRECHNUNG
router.post('/abrechnung/einspringer', auth, async (req,res) => {
  try {
    const {date,note} = req.body;
    if (!date) return bad(res,'Datum erforderlich');
    const id=newId();
    await pool.query('INSERT INTO abrechnung_einspringer (id,user_id,edate,note) VALUES ($1,$2,$3,$4)',
      [id,req.uid,date,note||'']);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/abrechnung/einspringer/:id', auth, async (req, res) => {
  try {
    const row = await q1('SELECT * FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    if (row.user_id!==req.uid&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {date,note} = req.body;
    await pool.query('UPDATE abrechnung_einspringer SET edate=$1,note=$2 WHERE id=$3',[date||row.edate,note??row.note,req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/abrechnung/einspringer/:id/reject', auth, async (req,res) => {
  try {
    if (!req.p.seeAllAbrechnung) return bad(res,'Keine Berechtigung',403);
    const row = await q1('SELECT * FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    if (req.body.undo) {
      await pool.query('UPDATE abrechnung_einspringer SET rejected_by=NULL,rejected_reason=NULL,rejected_at=NULL WHERE id=$1',[req.params.id]);
    } else {
      const {reason} = req.body;
      if (!reason?.trim()) return bad(res,'Begründung erforderlich');
      await pool.query('UPDATE abrechnung_einspringer SET rejected_by=$1,rejected_reason=$2,rejected_at=NOW() WHERE id=$3',
        [req.uid, reason.trim(), req.params.id]);
      // Notify the affected employee
      const rejector = await getUser(req.uid);
      const dateStr = row.edate || '?';
      await createNotification(
        row.user_id,
        'einspringer_rejected',
        `${rejector?.name||'?'} hat deinen Einspringerdienst vom ${dateStr} abgelehnt: ${reason.trim()}`,
        null, null, req.uid
      );
    }
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/abrechnung/einspringer/:id', auth, async (req,res) => {
  try {
    const row = await q1('SELECT * FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    // Only the creator (user_id) can delete their own entry
    if (row.user_id!==req.uid) return bad(res,'Nur der Ersteller kann löschen',403);
    await pool.query('DELETE FROM abrechnung_einspringer WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/abrechnung/homeoffice', auth, async (req,res) => {
  try {
    const {year,month,days} = req.body;
    await pool.query(`INSERT INTO abrechnung_homeoffice (id,user_id,year,month,days) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,year,month) DO UPDATE SET days=EXCLUDED.days`,
      [newId(),req.uid,year,month,days||0]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// NOTIFICATIONS
router.post('/notifications/:id/read', auth, async (req,res) => {
  try {
    await pool.query('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2',[req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.post('/notifications/read-all', auth, async (req,res) => {
  try {
    await pool.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// MESSAGES
router.post('/messages', auth, async (req,res) => {
  try {
    if (!req.p.canSendMessages) return bad(res,'Keine Berechtigung',403);
    const {title,body,targetType,targetValue} = req.body;
    if (!title?.trim()||!body?.trim()) return bad(res,'Titel und Text erforderlich');
    const id=newId();
    await pool.query('INSERT INTO messages (id,title,body,sender_id,target_type,target_value) VALUES ($1,$2,$3,$4,$5,$6)',
      [id,title.trim(),body.trim(),req.uid,targetType||'all',targetValue||null]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.post('/messages/:id/read', auth, async (req,res) => {
  try {
    await pool.query('INSERT INTO message_reads (id,message_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (message_id,user_id) DO NOTHING',
      [newId(),req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/messages/:id', auth, async (req,res) => {
  try {
    const msg=await q1('SELECT * FROM messages WHERE id=$1',[req.params.id]);
    if (!msg) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&msg.sender_id!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM message_reads WHERE message_id=$1',[req.params.id]);
    await pool.query('DELETE FROM messages WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// CATEGORIES / TAGS / USERS
router.post('/categories', auth, adminOnly, async (req,res) => {
  try {
    const {label,emoji,color}=req.body; if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const maxR=await q1('SELECT MAX(sort_order) as m FROM categories'); const id=newId();
    await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',[id,label.trim(),emoji||'📌',color||'#64748b',(maxR?.m||0)+1]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/categories/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('UPDATE categories SET label=$1,emoji=$2,color=$3 WHERE id=$4',[req.body.label,req.body.emoji||'📌',req.body.color||'#64748b',req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
router.delete('/categories/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
router.post('/tags', auth, adminOnly, async (req,res) => {
  try {
    const {label,color}=req.body; if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const id=newId(); await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)',[id,label.trim(),color||'#3b6dd4']); ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/tags/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('UPDATE tags SET label=$1,color=$2 WHERE id=$3',[req.body.label,req.body.color||'#3b6dd4',req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
router.delete('/tags/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM tags WHERE id=$1',[req.params.id]); ok(res); } catch(e) { bad(res,e.message,500); }
});
router.post('/users', auth, adminOnly, async (req,res) => {
  try {
    const {name,initials,roles,color}=req.body;
    if (!name?.trim()||!initials?.trim()) return bad(res,'Name und Kürzel erforderlich');
    const id=newId(), hash=await bcrypt.hash('Passwort1',10);
    await pool.query('INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES ($1,$2,$3,$4,$5,$6,true)',
      [id,name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',hash]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/users/:id', auth, adminOnly, async (req,res) => {
  try {
    const {name,initials,roles,color,resetPassword}=req.body;
    if (!name?.trim()||!initials?.trim()) return bad(res,'Name und Kürzel erforderlich');
    await pool.query('UPDATE users SET name=$1,initials=$2,roles=$3,color=$4 WHERE id=$5',
      [name.trim(),initials.trim().toUpperCase(),JSON.stringify(roles||['standard']),color||'#64748b',req.params.id]);
    if (resetPassword) await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=true WHERE id=$2',
      [await bcrypt.hash('Passwort1',10),req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/users/:id', auth, adminOnly, async (req,res) => {
  try {
    if (req.params.id===req.uid) return bad(res,'Eigenen Account nicht löschbar');
    await pool.query('DELETE FROM users WHERE id=$1',[req.params.id]); ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── DIENSTPLAENE ──────────────────────────────────────────────────────────────
router.post('/dienstplaene', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    const {month,year,label,filename,fileData} = req.body;
    if (!month||!year||!label?.trim()||!fileData) return bad(res,'Alle Felder erforderlich');
    const existing = await q('SELECT id,version FROM dienstplaene WHERE month=$1 AND year=$2 AND is_archived=false',[month,year]);
    let nextVersion = 1;
    for (const ex of existing) {
      await pool.query('UPDATE dienstplaene SET is_archived=true,archived_at=NOW() WHERE id=$1',[ex.id]);
      if (ex.version >= nextVersion) nextVersion = ex.version + 1;
    }
    const id=newId();
    await pool.query('INSERT INTO dienstplaene (id,month,year,label,version,filename,file_data,is_archived,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)',
      [id,month,year,label.trim(),nextVersion,filename||'dienstplan.pdf',fileData,req.uid]);
    ok(res,{id,version:nextVersion});
  } catch(e) { bad(res,e.message,500); }
});
router.get('/dienstplaene/:id/file', auth, async (req,res) => {
  try {
    const row = await q1('SELECT filename,file_data FROM dienstplaene WHERE id=$1',[req.params.id]);
    if (!row) return bad(res,'Nicht gefunden',404);
    const base64 = row.file_data.replace(/^data:[^;]+;base64,/,'');
    const buf = Buffer.from(base64,'base64');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','inline');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.send(buf);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/dienstplaene/:id', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM dienstplaene WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
// ── CHECKLISTEN-VORLAGEN ──
router.post('/checklists', auth, async (req,res) => {
  try {
    const {name,department,items=[]} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    const id=newId();
    await pool.query('INSERT INTO checklist_templates (id,name,department,created_by) VALUES ($1,$2,$3,$4)',[id,name.trim(),department,req.uid]);
    for (let i=0;i<items.length;i++)
      await pool.query('INSERT INTO checklist_template_items (id,template_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),id,items[i].text||items[i],items[i].itemType||'check',i]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/checklists/:id', auth, async (req,res) => {
  try {
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tmpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&tmpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const {name,department,items=[]} = req.body;
    await pool.query('UPDATE checklist_templates SET name=$1,department=$2 WHERE id=$3',[name.trim(),department,req.params.id]);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1',[req.params.id]);
    for (let i=0;i<items.length;i++)
      await pool.query('INSERT INTO checklist_template_items (id,template_id,text,item_type,sort_order) VALUES ($1,$2,$3,$4,$5)',
        [newId(),req.params.id,items[i].text||items[i],items[i].itemType||'check',i]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/checklists/:id', auth, async (req,res) => {
  try {
    const tmpl = await q1('SELECT * FROM checklist_templates WHERE id=$1',[req.params.id]);
    if (!tmpl) return bad(res,'Nicht gefunden',404);
    if (!req.p.roles.includes('admin')&&tmpl.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1',[req.params.id]);
    await pool.query('DELETE FROM checklist_templates WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ALLOWANCES
// ── AKTIVITÄTSLOG ──
router.get('/activity-log', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const limit  = Math.min(parseInt(req.query.limit||'50'), 200);
    const offset = parseInt(req.query.offset||'0');
    const [logs, total] = await Promise.all([
      q('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      q1('SELECT COUNT(*) as n FROM activity_log'),
    ]);
    ok(res, { logs, total: parseInt(total?.n||0) });
  } catch(e) { bad(res,e.message,500); }
});


module.exports = router;
