'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { pool, q1, q, parseRoles, logActivity } = require('../db');
const { auth, adminOnly, dpOnly, ok, bad } = require('../middleware');
const { randomUUID } = require('crypto');

// ── CHECKLIST TEMPLATES ──
router.post('/checklists/templates', auth, async (req, res) => {
  try {
    const { name, department, items } = req.body;
    if (!name?.trim() || !department) return bad(res, 'Name und Fachbereich erforderlich');
    const roles = parseRoles(req.user.roles);
    if (!req.p.isAdmin && !roles.includes(department)) return bad(res, 'Keine Berechtigung für diesen Fachbereich', 403);
    const id = randomUUID();
    await pool.query('INSERT INTO checklist_templates (id,name,department,created_by) VALUES ($1,$2,$3,$4)', [id, name.trim(), department, req.uid]);
    for (let i = 0; i < (items || []).length; i++)
      if (items[i]?.trim())
        await pool.query('INSERT INTO checklist_template_items (id,template_id,text,sort_order) VALUES ($1,$2,$3,$4)', [randomUUID(), id, items[i].trim(), i]);
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});

router.put('/checklists/templates/:id', auth, async (req, res) => {
  try {
    const tpl = await q1('SELECT * FROM checklist_templates WHERE id=$1', [req.params.id]);
    if (!tpl) return bad(res, 'Nicht gefunden', 404);
    if (!req.p.isAdmin && tpl.created_by !== req.uid) return bad(res, 'Keine Berechtigung', 403);
    const { name, department, items } = req.body;
    await pool.query('UPDATE checklist_templates SET name=$1,department=$2 WHERE id=$3', [name || tpl.name, department || tpl.department, req.params.id]);
    await pool.query('DELETE FROM checklist_template_items WHERE template_id=$1', [req.params.id]);
    for (let i = 0; i < (items || []).length; i++)
      if (items[i]?.trim())
        await pool.query('INSERT INTO checklist_template_items (id,template_id,text,sort_order) VALUES ($1,$2,$3,$4)', [randomUUID(), req.params.id, items[i].trim(), i]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.delete('/checklists/templates/:id', auth, async (req, res) => {
  try {
    const tpl = await q1('SELECT * FROM checklist_templates WHERE id=$1', [req.params.id]);
    if (!tpl) return bad(res, 'Nicht gefunden', 404);
    if (!req.p.isAdmin && tpl.created_by !== req.uid) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM checklist_templates WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.delete('/ticket-checklists/:id', auth, async (req, res) => {
  try {
    const cl = await q1('SELECT * FROM ticket_checklists WHERE id=$1', [req.params.id]);
    if (!cl) return bad(res, 'Nicht gefunden', 404);
    if (!req.p.isAdmin && cl.created_by !== req.uid) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM ticket_checklists WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.put('/checklist-items/:id/toggle', auth, async (req, res) => {
  try {
    const item = await q1('SELECT tci.*,tc.ticket_id FROM ticket_checklist_items tci JOIN ticket_checklists tc ON tc.id=tci.checklist_id WHERE tci.id=$1', [req.params.id]);
    if (!item) return bad(res, 'Nicht gefunden', 404);
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [item.ticket_id]);
    const { canEditTk } = require('../db');
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    const nc = !item.checked;
    await pool.query('UPDATE ticket_checklist_items SET checked=$1,checked_by=$2,checked_at=$3 WHERE id=$4',
      [nc, nc ? req.uid : null, nc ? new Date().toISOString() : null, req.params.id]);
    ok(res, { checked: nc });
  } catch (e) { bad(res, e.message, 500); }
});

// ── MESSAGES ──
router.post('/messages', auth, async (req, res) => {
  try {
    if (!req.p.isDP) return bad(res, 'Keine Berechtigung', 403);
    const { title, body, toDepartment } = req.body;
    if (!title?.trim() || !body?.trim()) return bad(res, 'Titel und Text erforderlich');
    const id = randomUUID();
    await pool.query('INSERT INTO messages (id,from_user_id,to_department,title,body) VALUES ($1,$2,$3,$4,$5)',
      [id, req.uid, toDepartment || null, title.trim(), body.trim()]);
    await logActivity(req.uid, req.user.name, 'send_message', { message_id: id, title: title.trim(), toDepartment }, req.clientIp);
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});

router.post('/messages/:id/ack', auth, async (req, res) => {
  try {
    await pool.query('INSERT INTO message_acks (id,message_id,user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [randomUUID(), req.params.id, req.uid]);
    await logActivity(req.uid, req.user.name, 'ack_message', { message_id: req.params.id }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ── ALLOWANCES ──
router.put('/allowances', auth, async (req, res) => {
  try {
    if (!req.p.editAllw) return bad(res, 'Keine Berechtigung', 403);
    const { userId, year, month, nd, fd, fw, c10 } = req.body;
    await pool.query(
      `INSERT INTO allowances (id,user_id,year,month,nd,fd,fw,c10) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id,year,month) DO UPDATE SET nd=EXCLUDED.nd,fd=EXCLUDED.fd,fw=EXCLUDED.fw,c10=EXCLUDED.c10`,
      [randomUUID(), userId, year, month, nd || 0, fd || 0, fw || 0, c10 || 0]
    );
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ── CATEGORIES ──
router.post('/categories', auth, adminOnly, async (req, res) => {
  try {
    const { label, emoji, color } = req.body;
    if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
    const max = await q1('SELECT MAX(sort_order) as m FROM categories');
    await pool.query('INSERT INTO categories (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), label.trim(), emoji || '📌', color || '#64748b', (max?.m || 0) + 1]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
router.put('/categories/:id', auth, adminOnly, async (req, res) => {
  try { await pool.query('UPDATE categories SET label=$1,emoji=$2,color=$3 WHERE id=$4', [req.body.label, req.body.emoji || '📌', req.body.color || '#64748b', req.params.id]); ok(res); }
  catch (e) { bad(res, e.message, 500); }
});
router.delete('/categories/:id', auth, adminOnly, async (req, res) => {
  try { await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]); ok(res); }
  catch (e) { bad(res, e.message, 500); }
});

// ── TAGS ──
router.post('/tags', auth, adminOnly, async (req, res) => {
  try {
    const { label, color } = req.body;
    if (!label?.trim()) return bad(res, 'Bezeichnung erforderlich');
    await pool.query('INSERT INTO tags (id,label,color) VALUES ($1,$2,$3)', [randomUUID(), label.trim(), color || '#3b6dd4']);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
router.put('/tags/:id', auth, adminOnly, async (req, res) => {
  try { await pool.query('UPDATE tags SET label=$1,color=$2 WHERE id=$3', [req.body.label, req.body.color || '#3b6dd4', req.params.id]); ok(res); }
  catch (e) { bad(res, e.message, 500); }
});
router.delete('/tags/:id', auth, adminOnly, async (req, res) => {
  try { await pool.query('DELETE FROM tags WHERE id=$1', [req.params.id]); ok(res); }
  catch (e) { bad(res, e.message, 500); }
});

// ── USERS ──
router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, initials, roles, color } = req.body;
    if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
    await pool.query('INSERT INTO users (id,name,initials,roles,color,pw_hash,must_change_pw) VALUES ($1,$2,$3,$4,$5,$6,true)',
      [randomUUID(), name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles || ['standard']), color || '#64748b', await bcrypt.hash('Passwort1', 10)]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, initials, roles, color, resetPassword } = req.body;
    if (!name?.trim() || !initials?.trim()) return bad(res, 'Name und Kürzel erforderlich');
    await pool.query('UPDATE users SET name=$1,initials=$2,roles=$3,color=$4 WHERE id=$5',
      [name.trim(), initials.trim().toUpperCase(), JSON.stringify(roles || ['standard']), color || '#64748b', req.params.id]);
    if (resetPassword)
      await pool.query('UPDATE users SET pw_hash=$1,must_change_pw=true WHERE id=$2', [await bcrypt.hash('Passwort1', 10), req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.uid) return bad(res, 'Eigenen Account nicht löschbar');
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

// ── ACTIVITY LOG ──
router.get('/activity-log', auth, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 500);
    const offset = parseInt(req.query.offset || '0');
    const [logs, total] = await Promise.all([
      q('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      q1('SELECT COUNT(*) as n FROM activity_log'),
    ]);
    ok(res, { logs, total: parseInt(total?.n || 0) });
  } catch (e) { bad(res, e.message, 500); }
});

module.exports = router;
