'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, q1, newId, pool, parseRoles, logAct, nextTicketNumber, getUser, createNotification } = require('../db');
const { auth, adminOnly, ok, bad } = require('../middleware');


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
    await logAct(req.uid,req.user.name,'send_message',{title:req.body.title,target:req.body.target||'all'});
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.post('/messages/:id/read', auth, async (req,res) => {
  try {
    await pool.query(
      `INSERT INTO message_reads (id,message_id,user_id,read_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (message_id,user_id)
       DO UPDATE SET read_at = COALESCE(message_reads.read_at, NOW())`,
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
router.put('/users/:id', auth, async (req,res) => {
  const isSelf = req.params.id === req.uid;
  const colorOnly = isSelf && Object.keys(req.body).every(k=>k==='color');
  if(!colorOnly && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
  try {
    if (colorOnly) {
      await pool.query('UPDATE users SET color=$1 WHERE id=$2',[req.body.color||'#64748b',req.params.id]);
      return ok(res);
    }
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
// ── DIENSTTAUSCH ──
router.post('/diensttausch', auth, async (req,res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return bad(res,'Text erforderlich');
    const id = newId();
    await pool.query(
      `INSERT INTO diensttausch (id,text,created_by,status) VALUES ($1,$2,$3,'pending')`,
      [id, text.trim(), req.uid]
    );
    ok(res, { id });
  } catch(e) { bad(res,e.message,500); }
});

router.put('/diensttausch/:id/decide', auth, async (req,res) => {
  try {
    if (!req.p.canApproveEvents) return bad(res,'Keine Berechtigung',403);
    const { decision, rejectReason } = req.body;
    if (!['approved','rejected'].includes(decision)) return bad(res,'Ungültige Entscheidung');
    await pool.query(
      `UPDATE diensttausch SET status=$1,decided_by=$2,decided_at=NOW(),reject_reason=$3 WHERE id=$4`,
      [decision, req.uid, rejectReason||null, req.params.id]
    );
    await logAct(req.uid,req.user.name,
      decision==='approved'?'approve_diensttausch':'reject_diensttausch',
      {id:req.params.id});
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

router.put('/diensttausch/:id/view', auth, async (req,res) => {
  try {
    await pool.query(
      `INSERT INTO diensttausch_reads (diensttausch_id,user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.uid]
    );
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

router.delete('/diensttausch/:id', auth, async (req,res) => {
  try {
    const dt = await q1('SELECT * FROM diensttausch WHERE id=$1',[req.params.id]);
    if (!dt) return bad(res,'Nicht gefunden',404);
    if (dt.created_by !== req.uid && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM diensttausch_reads WHERE diensttausch_id=$1',[req.params.id]);
    await pool.query('DELETE FROM diensttausch WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});


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


// ── NACHRICHTEN PIN ──
router.put('/messages/:id/pin', auth, async (req,res) => {
  try {
    const { pinned } = req.body;
    await pool.query(
      `INSERT INTO message_reads (id,message_id,user_id,pinned,read_at) VALUES ($1,$2,$3,$4,NULL) ON CONFLICT (message_id,user_id) DO UPDATE SET pinned=EXCLUDED.pinned`,
      [newId(), req.params.id, req.uid, !!pinned]
    );
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── MAILGUN WEBHOOK ──
router.post('/webhook/mailgun', async (req,res) => {
  try {
    // Simple token check – set MAILGUN_WEBHOOK_TOKEN in Render env vars
    const token = process.env.MAILGUN_WEBHOOK_TOKEN;
    if (token && req.body['webhook-token'] !== token && req.headers['x-mailgun-token'] !== token)
      return res.status(401).send('Unauthorized');

    const subject   = (req.body.subject || 'E-Mail Ticket').trim().slice(0,200);
    const bodyText  = (req.body['body-plain'] || req.body['body-stripped'] || req.body.text || '').trim();
    const sender    = req.body.sender || req.body.from || 'extern';
    const dept      = process.env.MAILGUN_DEFAULT_DEPT || 'technik';

    const id     = newId();
    const number = await nextTicketNumber();

    // Find a system user (first admin)
    const sysUser = await q1(`SELECT id,name FROM users WHERE roles::text LIKE '%admin%' LIMIT 1`);
    const createdBy = sysUser?.id || 'system';

    await pool.query(
      `INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,created_by)
       VALUES ($1,$2,$3,$4,$5,'[]','medium','open','',$6)`,
      [id, number, subject, `Von: ${sender}\n\n${bodyText}`, dept, createdBy]
    );

    await pool.query(
      `INSERT INTO activity_log (id,user_id,user_name,action,details,created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
      [newId(), createdBy, 'E-Mail', 'create_ticket', JSON.stringify({ number, subject, sender })]
    ).catch(()=>{});

    console.log('[Mailgun] Ticket erstellt:', number, subject);
    res.status(200).send('OK');
  } catch(e) {
    console.error('[Mailgun] Fehler:', e.message);
    res.status(500).send('Error');
  }
});

// ── HOMEOFFICE ──
router.get('/homeoffice/config', auth, async (req,res) => {
  try {
    const [config,boxes,dienste] = await Promise.all([
      q('SELECT * FROM homeoffice_config ORDER BY date'),
      q('SELECT * FROM homeoffice_boxes ORDER BY sort_order,label'),
      q('SELECT * FROM homeoffice_dienste ORDER BY sort_order,label'),
    ]);
    ok(res,{config,boxes,dienste});
  } catch(e){bad(res,e.message,500);}
});

router.get('/homeoffice/slots', auth, async (req,res) => {
  try {
    const {from,to} = req.query;
    const slots = from&&to
      ? await q('SELECT * FROM homeoffice_slots WHERE date>=$1 AND date<=$2 ORDER BY date',[from,to])
      : await q('SELECT * FROM homeoffice_slots ORDER BY date');
    ok(res,slots);
  } catch(e){bad(res,e.message,500);}
});

router.put('/homeoffice/config', auth, async (req,res) => {
  try {
    if(!req.p.canApproveEvents&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {date,maxSlots} = req.body;
    if(!date||maxSlots==null) return bad(res,'date und maxSlots erforderlich');
    const slots = parseInt(maxSlots);
    if (slots < 0) {
      await pool.query('DELETE FROM homeoffice_config WHERE date=$1',[date]);
    } else {
      await pool.query(
        `INSERT INTO homeoffice_config (id,date,max_slots,created_by,updated_at) VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (date) DO UPDATE SET max_slots=EXCLUDED.max_slots,updated_at=NOW()`,
        [newId(),date,slots,req.uid]
      );
    }
    await logAct(req.uid,req.user.name,'ho_config',{date,maxSlots});
    ok(res);
  } catch(e){bad(res,e.message,500);}
});

router.post('/homeoffice/slots', auth, async (req,res) => {
  try {
    const {date,box,dienst} = req.body;
    if(!date) return bad(res,'date erforderlich');
    // Check slots available
    const config = await q1('SELECT max_slots FROM homeoffice_config WHERE date=$1',[date]);
    const maxS = config?.max_slots ?? 2; // Standard: 2 Slots/Tag
    const taken = await q('SELECT COUNT(*) as n FROM homeoffice_slots WHERE date=$1',[date]);
    if(parseInt(taken[0]?.n||0) >= maxS) return bad(res,'Keine freien Plätze für diesen Tag');
    const id=newId();
    // Check box unique per day
    if(box) {
      const boxTaken = await q1('SELECT id FROM homeoffice_slots WHERE date=$1 AND box=$2 AND user_id!=$3',[date,box,req.uid]);
      if(boxTaken) return bad(res,'Diese Box ist an diesem Tag bereits vergeben');
    }
    // C10-Regel: letzter freier Slot muss C10 sein
    const slotsToday2 = await q('SELECT dienst FROM homeoffice_slots WHERE date=$1',[date]);
    const hasC10 = slotsToday2.some(s=>s.dienst==='C10');
    if(slotsToday2.length >= maxS-1 && !hasC10 && dienst!=='C10')
      return bad(res,'Einer der '+maxS+' Plätze muss für den Dienst C10 reserviert sein');
    await pool.query(
      `INSERT INTO homeoffice_slots (id,date,user_id,box,dienst) VALUES ($1,$2,$3,$4,$5)`,
      [id,date,req.uid,box||'',dienst||'']
    );
    await logAct(req.uid,req.user.name,'ho_eintragen',{date,box,dienst});
    ok(res,{id});
  } catch(e){bad(res,e.message,500);}
});

router.delete('/homeoffice/slots/:id', auth, async (req,res) => {
  try {
    const slot = await q1('SELECT * FROM homeoffice_slots WHERE id=$1',[req.params.id]);
    if(!slot) return bad(res,'Nicht gefunden',404);
    if(slot.user_id!==req.uid&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM homeoffice_slots WHERE id=$1',[req.params.id]);
    await logAct(req.uid,req.user.name,'ho_austragen',{date:slot.date});
    ok(res);
  } catch(e){bad(res,e.message,500);}
});

// Admin: Boxes & Dienste verwalten
router.post('/homeoffice/boxes', auth, adminOnly, async (req,res) => {
  try {
    const {label} = req.body;
    if(!label?.trim()) return bad(res,'Label erforderlich');
    const id=newId();
    await pool.query('INSERT INTO homeoffice_boxes (id,label) VALUES ($1,$2)',[id,label.trim()]);
    ok(res,{id});
  } catch(e){bad(res,e.message,500);}
});
router.delete('/homeoffice/boxes/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM homeoffice_boxes WHERE id=$1',[req.params.id]); ok(res); }
  catch(e){bad(res,e.message,500);}
});
router.post('/homeoffice/dienste', auth, adminOnly, async (req,res) => {
  try {
    const {label} = req.body;
    if(!label?.trim()) return bad(res,'Label erforderlich');
    const id=newId();
    await pool.query('INSERT INTO homeoffice_dienste (id,label) VALUES ($1,$2)',[id,label.trim()]);
    ok(res,{id});
  } catch(e){bad(res,e.message,500);}
});
router.delete('/homeoffice/dienste/:id', auth, adminOnly, async (req,res) => {
  try { await pool.query('DELETE FROM homeoffice_dienste WHERE id=$1',[req.params.id]); ok(res); }
  catch(e){bad(res,e.message,500);}
});

// ── NEWS ──
router.get('/news', auth, async (req,res) => {
  try {
    const canManage = req.p.manageUsers || req.p.roles?.includes('leitung');
    const today = new Date().toISOString().slice(0,10);
    const all = await q('SELECT * FROM news ORDER BY created_at DESC');
    const pins = await q('SELECT news_id FROM news_pins WHERE user_id=$1',[req.uid]);
    const pinSet = new Set(pins.map(p=>p.news_id));
    const mapped = all.map(n=>{
      const fDate = n.from_date ? (n.from_date.toISOString?.()?.slice(0,10)||String(n.from_date).slice(0,10)) : null;
      const tDate = n.to_date  ? (n.to_date.toISOString?.()?.slice(0,10) ||String(n.to_date).slice(0,10))  : null;
      return {
        id:n.id, title:n.title, body:n.body,
        fromDate:fDate, toDate:tDate,
        isImportant:n.is_important, createdBy:n.created_by, createdAt:n.created_at,
        isPinned:pinSet.has(n.id),
        isActive: (!fDate||(today>=fDate))&&(!tDate||(today<=tDate)),
        isExpired: !!(tDate && today>tDate),
      };
    });
    // All users see active news; expired = archiv (visible to all)
    ok(res, mapped);
  } catch(e) { bad(res,e.message,500); }
});

router.post('/news', auth, async (req,res) => {
  try {
    const isEditor = req.p.manageUsers || req.p.roles?.includes('leitung');
    if(!isEditor) return bad(res,'Keine Berechtigung',403);
    const {title,body,fromDate,toDate,isImportant} = req.body;
    if(!title?.trim()) return bad(res,'Titel erforderlich');
    const id = newId();
    await pool.query(
      'INSERT INTO news (id,title,body,from_date,to_date,is_important,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id,title.trim(),body||'',fromDate||null,toDate||null,!!isImportant,req.uid]
    );
    await logAct(req.uid,req.user.name,'create_news',{title});
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});

router.put('/news/:id', auth, async (req,res) => {
  try {
    const isEditor = req.p.manageUsers || req.p.roles?.includes('leitung');
    if(!isEditor) return bad(res,'Keine Berechtigung',403);
    const {title,body,fromDate,toDate,isImportant} = req.body;
    await pool.query(
      'UPDATE news SET title=$1,body=$2,from_date=$3,to_date=$4,is_important=$5 WHERE id=$6',
      [title,body,fromDate||null,toDate||null,!!isImportant,req.params.id]
    );
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

router.delete('/news/:id', auth, async (req,res) => {
  try {
    const isEditor = req.p.manageUsers || req.p.roles?.includes('leitung');
    if(!isEditor) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM news_pins WHERE news_id=$1',[req.params.id]);
    await pool.query('DELETE FROM news WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

router.put('/news/:id/pin', auth, async (req,res) => {
  try {
    if(req.body.pinned) {
      await pool.query('INSERT INTO news_pins (news_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.uid]);
    } else {
      await pool.query('DELETE FROM news_pins WHERE news_id=$1 AND user_id=$2',[req.params.id,req.uid]);
    }
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── URLAUB OVERVIEW ──
router.get('/vacation/config', auth, async (req,res) => {
  try {
    ok(res, await q('SELECT * FROM vacation_config ORDER BY date'));
  } catch(e) { bad(res,e.message,500); }
});

router.put('/vacation/config', auth, async (req,res) => {
  try {
    if(!req.p.canApproveEvents&&!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {date,maxSlots,note} = req.body;
    const slots = parseInt(maxSlots??8);
    if(slots<0) {
      await pool.query('DELETE FROM vacation_config WHERE date=$1',[date]);
    } else {
      await pool.query(
        `INSERT INTO vacation_config (id,date,max_slots,note,created_by,updated_at) VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (date) DO UPDATE SET max_slots=EXCLUDED.max_slots,note=EXCLUDED.note,updated_at=NOW()`,
        [newId(),date,slots,note||'',req.uid]
      );
    }
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});


// ── TICKET SUBCATEGORIES ──────────────────────────────────────────
router.get('/ticket-subcategories', auth, async (req,res) => {
  try {
    const rows = await q('SELECT * FROM ticket_subcategories ORDER BY department,sort_order,label');
    ok(res, rows);
  } catch(e) { bad(res,e.message,500); }
});
router.post('/ticket-subcategories', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {department,label,sort_order} = req.body;
    if(!department||!label) return bad(res,'department und label erforderlich');
    const id = newId();
    await pool.query('INSERT INTO ticket_subcategories (id,department,label,sort_order,created_by) VALUES ($1,$2,$3,$4,$5)',
      [id,department,label.trim(),parseInt(sort_order)||0,req.uid]);
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/ticket-subcategories/:id', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {label,sort_order} = req.body;
    await pool.query('UPDATE ticket_subcategories SET label=$1,sort_order=$2 WHERE id=$3',
      [label.trim(),parseInt(sort_order)||0,req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/ticket-subcategories/:id', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM ticket_subcategories WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── Note Templates ──
router.get('/note-templates', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM note_templates ORDER BY sort_order,label')); } catch(e) { bad(res,e.message,500); }
});
router.post('/note-templates', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Kein Zugriff',403);
    const {label,body} = req.body;
    if(!label?.trim()||!body?.trim()) return bad(res,'Label und Text erforderlich');
    await pool.query('INSERT INTO note_templates (id,label,body,created_by) VALUES ($1,$2,$3,$4)',
      [newId(),label.trim(),body.trim(),req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/note-templates/:id', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Kein Zugriff',403);
    const {label,body} = req.body;
    await pool.query('UPDATE note_templates SET label=$1,body=$2 WHERE id=$3',[label,body,req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/note-templates/:id', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Kein Zugriff',403);
    await pool.query('DELETE FROM note_templates WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── iCal Export ──
router.get('/ical/:userId', async (req,res) => {
  try {
    const user = await getUser(req.params.userId);
    if(!user) return res.status(404).send('Not found');
    const events = await q(
      `SELECT e.*, c.label as cat_label, c.emoji as cat_emoji FROM events e
       LEFT JOIN categories c ON c.id=e.category
       WHERE e.user_id=$1 AND e.is_general=false ORDER BY e.date_from`,
      [req.params.userId]
    );
    const esc = s => (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
    const fdt = d => {
      const dt = new Date(d);
      return dt.getFullYear()
        + String(dt.getMonth()+1).padStart(2,'0')
        + String(dt.getDate()).padStart(2,'0');
    };
    const uid_domain = '@lstportal.local';
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LSt Portal//DE',
      'CALSCALE:GREGORIAN','METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(user.name)} – Dienstplan`,
      'X-WR-TIMEZONE:Europe/Vienna',
    ];
    for(const ev of events){
      const dtEnd = new Date(ev.date_to||ev.date_from);
      dtEnd.setDate(dtEnd.getDate()+1);
      const summary = `${ev.cat_emoji||'📅'} ${esc(ev.reason||ev.cat_label||'Eintrag')}`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.id}${uid_domain}`);
      lines.push(`DTSTART;VALUE=DATE:${fdt(ev.date_from)}`);
      lines.push(`DTEND;VALUE=DATE:${fdt(dtEnd)}`);
      lines.push(`SUMMARY:${summary}`);
      if(ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type','text/calendar;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment;filename="dienstplan-${user.name.replace(/\s+/g,'-')}.ics"`);
    res.send(lines.join('\r\n'));
  } catch(e) { res.status(500).send(e.message); }
});

// STATISTIK
router.get('/statistik', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const [ticketsRaw, logins] = await Promise.all([
      q('SELECT id,created_by,assignee_id,status,department,updated_at FROM tickets WHERE is_deleted IS NOT TRUE'),
      q(`SELECT user_id, COUNT(*) as cnt FROM activity_log WHERE action='login' GROUP BY user_id`),
    ]);
    ok(res, { tickets: ticketsRaw, logins: logins.map(l=>({userId:l.user_id,count:parseInt(l.cnt)})) });
  } catch(e) { bad(res,e.message,500); }
});

// STATION SESSIONS
router.get('/stations', auth, async (req,res) => {
  try {
    const sessions = await q('SELECT * FROM station_sessions ORDER BY logged_in_at');
    ok(res, sessions.map(s=>({id:s.id,stationName:s.station_name,userId:s.user_id,shiftId:s.shift_id,loggedInAt:s.logged_in_at})));
  } catch(e) { bad(res,e.message,500); }
});
router.post('/stations/:name', auth, async (req,res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const {shiftId, breakTime} = req.body;
    await pool.query('DELETE FROM station_sessions WHERE user_id=$1 OR station_name=$2',[req.uid,name]);
    await pool.query('INSERT INTO station_sessions (id,station_name,user_id,shift_id,break_time) VALUES ($1,$2,$3,$4,$5)',
      [newId(),name,req.uid,shiftId||null,breakTime||null]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/stations/:name', auth, async (req,res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const sess = await q1('SELECT * FROM station_sessions WHERE station_name=$1',[name]);
    if (!sess) return ok(res);
    if (sess.user_id!==req.uid && !req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM station_sessions WHERE station_name=$1',[name]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
// STATION SHIFTS (admin)
router.get('/station-shifts', auth, async (req,res) => {
  try {
    const shifts = await q('SELECT * FROM station_shifts ORDER BY sort_order,label');
    ok(res, shifts.map(s=>({id:s.id,label:s.label,sortOrder:s.sort_order,serviceStart:s.service_start||'',serviceEnd:s.service_end||'',hasBreak:s.has_break!==false})));
  } catch(e) { bad(res,e.message,500); }
});
router.post('/station-shifts', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {label, serviceStart, serviceEnd, hasBreak} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    await pool.query('INSERT INTO station_shifts (id,label,sort_order,created_by,service_start,service_end,has_break) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId(),label.trim(),0,req.uid,serviceStart||'',serviceEnd||'',hasBreak!==false]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/station-shifts/:id', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM station_shifts WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── PORTAL LINKS ──
router.get('/portal-links', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM portal_links ORDER BY sort_order,label')); }
  catch(e) { bad(res,e.message,500); }
});
router.post('/portal-links', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {label,url,icon,description} = req.body;
    if (!label?.trim()||!url?.trim()) return bad(res,'Label und URL erforderlich');
    const cnt = await q('SELECT COUNT(*) as n FROM portal_links');
    await pool.query('INSERT INTO portal_links (id,label,url,icon,description,sort_order,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId(),label.trim(),url.trim(),icon||'🔗',description||'',parseInt(cnt[0].n)||0,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/portal-links/:id', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM portal_links WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── STATION OUTAGES ──
router.post('/station-outages', auth, async (req,res) => {
  try {
    const roles=req.p.roles||[];
    if(!roles.some(r=>['admin','leitung','technik'].includes(r))) return bad(res,'Keine Berechtigung',403);
    const {stationName,reason,endAt} = req.body;
    if (!stationName) return bad(res,'Station erforderlich');
    await pool.query('INSERT INTO station_outages (id,station_name,reason,start_at,end_at,created_by) VALUES ($1,$2,$3,NOW(),$4,$5)',
      [newId(),stationName,reason||'',endAt||null,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/station-outages/:id', auth, async (req,res) => {
  try {
    const roles=req.p.roles||[];
    if(!roles.some(r=>['admin','leitung','technik'].includes(r))) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM station_outages WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// ── ROLE PERMISSIONS ──
router.get('/role-permissions', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    ok(res, await q('SELECT * FROM role_permissions'));
  } catch(e) { bad(res,e.message,500); }
});
router.post('/role-permissions', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {role,permission,granted} = req.body;
    if(!role||!permission) return bad(res,'role und permission erforderlich');
    await pool.query(
      'INSERT INTO role_permissions (role,permission,granted) VALUES ($1,$2,$3) ON CONFLICT (role,permission) DO UPDATE SET granted=$3',
      [role,permission,granted!==false]
    );
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/role-permissions/:role/:permission', auth, async (req,res) => {
  try {
    if(!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM role_permissions WHERE role=$1 AND permission=$2',[req.params.role,req.params.permission]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

module.exports = router;
