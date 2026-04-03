'use strict';
const router = require('express').Router();
const { pool, q1, getUser, parseTags, canEditTk, addSystemNote, logActivity } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { randomUUID } = require('crypto');

const PRIO_LBL = { low: 'Gering', medium: 'Mittel', high: 'Hoch' };
const ST_LBL   = { open: 'Offen', in_progress: 'In Bearbeitung', on_hold: 'Zurückgestellt', closed: 'Abgeschlossen' };
const DEPT_LBL = { technik: 'Technik', leitung: 'Leitung', dienstplanung: 'Dienstplanung', ausbildung: 'Ausbildung', qm: 'QM' };

async function nextTicketNumber() {
  const row = await q1(`SELECT number FROM tickets ORDER BY CAST(REPLACE(number,'TK-','') AS INTEGER) DESC LIMIT 1`);
  if (!row) return 'TK-1001';
  return `TK-${(parseInt(row.number.replace('TK-', '')) + 1).toString().padStart(4, '0')}`;
}

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, department, tags, priority, status, bucket, assigneeId, parentTicketId } = req.body;
    if (!title?.trim()) return bad(res, 'Titel erforderlich');
    const id = randomUUID(), number = await nextTicketNumber(), now = new Date().toISOString();
    const std = req.tp.isStandard;
    await pool.query(
      'INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,parent_ticket_id,created_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)',
      [id, number, title.trim(), description || '', department || 'technik', JSON.stringify(tags || []),
       priority || 'medium', std ? 'open' : (status || 'open'), std ? '' : (bucket || ''),
       assigneeId || null, parentTicketId || null, req.uid, now]
    );
    await logActivity(req.uid, req.user.name, 'create_ticket', { ticket_id: id, number, title: title.trim() }, req.clientIp);
    ok(res, { id, number });
  } catch (e) { bad(res, e.message, 500); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    const b = req.body, std = req.tp.isStandard;
    const changes = [], set = [], vals = [];
    const add = (col, val) => { vals.push(val); set.push(`${col}=$${vals.length}`); };

    if (b.title !== undefined)       add('title', b.title);
    if (b.description !== undefined) add('description', b.description);
    if (b.department !== undefined)  { if (b.department !== tk.department) changes.push(`Fachbereich: ${DEPT_LBL[tk.department]} → ${DEPT_LBL[b.department]}`); add('department', b.department); }
    if (b.tags !== undefined)        add('tags', JSON.stringify(b.tags));
    if (b.priority !== undefined)    { if (b.priority !== tk.priority) changes.push(`Priorität: ${PRIO_LBL[tk.priority]} → ${PRIO_LBL[b.priority]}`); add('priority', b.priority); }
    if (b.status !== undefined && !std) { if (b.status !== tk.status) changes.push(`Status: ${ST_LBL[tk.status]} → ${ST_LBL[b.status]}`); add('status', b.status); }
    if (b.bucket !== undefined && !std) add('bucket', b.bucket);
    if (b.isPublic !== undefined)    add('is_public', !!b.isPublic);
    if (b.assigneeId !== undefined) {
      if (b.assigneeId !== tk.assignee_id) {
        if (b.assigneeId === req.uid) changes.push(`Ticket übernommen von ${req.user.name}`);
        else if (!b.assigneeId) changes.push(`Zuweisung aufgehoben`);
        else { const nu = await getUser(b.assigneeId); changes.push(`Zuständig → ${nu?.name || '?'}`); }
      }
      add('assignee_id', b.assigneeId || null);
    }
    if (b.parentTicketId !== undefined) add('parent_ticket_id', b.parentTicketId || null);
    add('updated_at', new Date().toISOString());

    if (set.length > 1) { vals.push(req.params.id); await pool.query(`UPDATE tickets SET ${set.join(',')} WHERE id=$${vals.length}`, vals); }
    for (const c of changes) await addSystemNote(tk.id, c);
    if (changes.length) await logActivity(req.uid, req.user.name, 'update_ticket', { ticket_id: tk.id, number: tk.number, changes }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM ticket_notes WHERE ticket_id=$1', [req.params.id]);
    await pool.query('DELETE FROM tickets WHERE id=$1', [req.params.id]);
    await logActivity(req.uid, req.user.name, 'delete_ticket', { ticket_id: req.params.id, number: tk.number }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.post('/:id/notes', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk) return bad(res, 'Nicht gefunden', 404);
    if (!canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    const text = req.body?.text?.trim();
    if (!text) return bad(res, 'Text erforderlich');
    const id = randomUUID(), now = new Date().toISOString();
    await pool.query('INSERT INTO ticket_notes (id,ticket_id,text,author_id,is_system,created_at) VALUES ($1,$2,$3,$4,false,$5)', [id, req.params.id, text, req.uid, now]);
    await pool.query('UPDATE tickets SET updated_at=$1 WHERE id=$2', [now, req.params.id]);
    ok(res, { id, createdAt: now });
  } catch (e) { bad(res, e.message, 500); }
});

// Checklists on tickets
router.post('/:id/checklists', auth, async (req, res) => {
  try {
    const tk = await q1('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
    if (!tk || !canEditTk(req.tp, tk, req.uid)) return bad(res, 'Keine Berechtigung', 403);
    const tpl = await q1('SELECT * FROM checklist_templates WHERE id=$1', [req.body.templateId]);
    if (!tpl) return bad(res, 'Vorlage nicht gefunden', 404);
    const items = await pool.query('SELECT * FROM checklist_template_items WHERE template_id=$1 ORDER BY sort_order', [tpl.id]).then(r => r.rows);
    const clId = randomUUID();
    await pool.query('INSERT INTO ticket_checklists (id,ticket_id,template_id,name,created_by) VALUES ($1,$2,$3,$4,$5)', [clId, req.params.id, tpl.id, tpl.name, req.uid]);
    for (const it of items)
      await pool.query('INSERT INTO ticket_checklist_items (id,checklist_id,text,sort_order) VALUES ($1,$2,$3,$4)', [randomUUID(), clId, it.text, it.sort_order]);
    ok(res, { id: clId });
  } catch (e) { bad(res, e.message, 500); }
});

module.exports = router;
