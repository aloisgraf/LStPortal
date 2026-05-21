'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── MEETINGS ──────────────────────────────────────────────────────────────────

// GET all meetings
router.get('/meetings', auth, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM meetings ORDER BY created_at DESC');
    ok(res, rows);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST create meeting
router.post('/meetings', auth, async (req, res) => {
  try {
    const { title, type, rhythm, rhythmDay, rhythmTime, description } = req.body;
    if (!title) return bad(res, 'Titel erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO meetings (id, title, type, rhythm, rhythm_day, rhythm_time, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, title, type || 'einmalig', rhythm || null, rhythmDay || null, rhythmTime || '', description || '', req.uid]
    );
    const row = await q1('SELECT * FROM meetings WHERE id=$1', [id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// PUT update meeting
router.put('/meetings/:id', auth, async (req, res) => {
  try {
    const { title, type, rhythm, rhythmDay, rhythmTime, description } = req.body;
    await pool.query(
      `UPDATE meetings SET title=$1, type=$2, rhythm=$3, rhythm_day=$4, rhythm_time=$5, description=$6
       WHERE id=$7`,
      [title, type || 'einmalig', rhythm || null, rhythmDay || null, rhythmTime || '', description || '', req.params.id]
    );
    const row = await q1('SELECT * FROM meetings WHERE id=$1', [req.params.id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// DELETE meeting
router.delete('/meetings/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM meetings WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// ── INSTANCES ────────────────────────────────────────────────────────────────

// POST create instance for meeting
router.post('/meetings/:id/instances', auth, async (req, res) => {
  try {
    const { date, time, notes } = req.body;
    if (!date) return bad(res, 'Datum erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO meeting_instances (id, meeting_id, date, time, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, req.params.id, date, time || '', notes || '', req.uid]
    );
    const row = await q1('SELECT * FROM meeting_instances WHERE id=$1', [id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST generate next instance for jour_fixe
router.post('/meetings/:id/next-instance', auth, async (req, res) => {
  try {
    const meeting = await q1('SELECT * FROM meetings WHERE id=$1', [req.params.id]);
    if (!meeting) return bad(res, 'Besprechung nicht gefunden', 404);

    // Find latest instance
    const latest = await q1(
      'SELECT * FROM meeting_instances WHERE meeting_id=$1 ORDER BY date DESC LIMIT 1',
      [req.params.id]
    );

    // Calculate next date
    let nextDate;
    const baseDate = latest ? new Date(latest.date) : new Date();
    const rhythm = meeting.rhythm || 'weekly';
    nextDate = new Date(baseDate);
    if (rhythm === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (rhythm === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
    else if (rhythm === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (rhythm === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else nextDate.setDate(nextDate.getDate() + 7);

    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const newInstId = newId();
    await pool.query(
      `INSERT INTO meeting_instances (id, meeting_id, date, time, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [newInstId, req.params.id, nextDateStr, meeting.rhythm_time || '', '', req.uid]
    );

    // Copy open/redo items from latest instance
    if (latest) {
      const openItems = await q(
        `SELECT * FROM discussion_items WHERE instance_id=$1 AND status IN ('open','redo') ORDER BY sort_order, created_at`,
        [latest.id]
      );
      for (const item of openItems) {
        const newItemId = newId();
        await pool.query(
          `INSERT INTO discussion_items (id, instance_id, title, description, status, due_date, meeting_date, parent_id, delegated_to, result, sort_order, created_by)
           VALUES ($1,$2,$3,$4,'open',$5,NULL,$6,$7,$8,$9,$10)`,
          [newItemId, newInstId, item.title, item.description || '', item.due_date || null, item.id, item.delegated_to || null, '', item.sort_order || 0, req.uid]
        );
        // Copy participants
        const parts = await q('SELECT * FROM discussion_participants WHERE item_id=$1', [item.id]);
        for (const p of parts) {
          await pool.query(
            `INSERT INTO discussion_participants (id, item_id, user_id, role) VALUES ($1,$2,$3,$4) ON CONFLICT (item_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
            [newId(), newItemId, p.user_id, p.role]
          );
        }
      }
    }

    const row = await q1('SELECT * FROM meeting_instances WHERE id=$1', [newInstId]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// PUT update instance
router.put('/meeting-instances/:id', auth, async (req, res) => {
  try {
    const { date, time, status, notes } = req.body;
    const inst = await q1('SELECT * FROM meeting_instances WHERE id=$1', [req.params.id]);
    if (!inst) return bad(res, 'Termin nicht gefunden', 404);
    await pool.query(
      `UPDATE meeting_instances SET date=COALESCE($1,date), time=COALESCE($2,time), status=COALESCE($3,status), notes=COALESCE($4,notes) WHERE id=$5`,
      [date || null, time !== undefined ? time : null, status || null, notes !== undefined ? notes : null, req.params.id]
    );
    const row = await q1('SELECT * FROM meeting_instances WHERE id=$1', [req.params.id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// DELETE instance
router.delete('/meeting-instances/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM meeting_instances WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// ── DISCUSSION ITEMS ──────────────────────────────────────────────────────────

// POST create item in instance
router.post('/meeting-instances/:id/items', auth, async (req, res) => {
  try {
    const { title, description, dueDate, delegatedTo, participants } = req.body;
    if (!title) return bad(res, 'Titel erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO discussion_items (id, instance_id, title, description, status, due_date, delegated_to, created_by)
       VALUES ($1,$2,$3,$4,'open',$5,$6,$7)`,
      [id, req.params.id, title, description || '', dueDate || null, delegatedTo || null, req.uid]
    );
    // Add participants
    if (Array.isArray(participants)) {
      for (const p of participants) {
        if (p.userId) {
          await pool.query(
            `INSERT INTO discussion_participants (id, item_id, user_id, role) VALUES ($1,$2,$3,$4) ON CONFLICT (item_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
            [newId(), id, p.userId, p.role || 'required']
          );
        }
      }
    }
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1', [id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// PUT update discussion item
router.put('/discussion-items/:id', auth, async (req, res) => {
  try {
    const { title, description, status, dueDate, meetingDate, delegatedTo, result } = req.body;
    await pool.query(
      `UPDATE discussion_items SET
        title=COALESCE($1,title), description=COALESCE($2,description),
        status=COALESCE($3,status), due_date=$4, meeting_date=$5,
        delegated_to=$6, result=COALESCE($7,result)
       WHERE id=$8`,
      [title || null, description !== undefined ? description : null, status || null,
       dueDate || null, meetingDate || null, delegatedTo || null, result !== undefined ? result : null,
       req.params.id]
    );
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1', [req.params.id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// DELETE discussion item
router.delete('/discussion-items/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM discussion_items WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST follow-up item
router.post('/discussion-items/:id/followup', auth, async (req, res) => {
  try {
    const { instanceId, title, dueDate } = req.body;
    if (!instanceId) return bad(res, 'instanceId erforderlich', 400);
    const orig = await q1('SELECT * FROM discussion_items WHERE id=$1', [req.params.id]);
    if (!orig) return bad(res, 'Punkt nicht gefunden', 404);
    const newItemId = newId();
    await pool.query(
      `INSERT INTO discussion_items (id, instance_id, title, description, status, due_date, parent_id, delegated_to, created_by)
       VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8)`,
      [newItemId, instanceId, title || orig.title, orig.description || '', dueDate || null, req.params.id, orig.delegated_to || null, req.uid]
    );
    // Copy participants
    const parts = await q('SELECT * FROM discussion_participants WHERE item_id=$1', [req.params.id]);
    for (const p of parts) {
      await pool.query(
        `INSERT INTO discussion_participants (id, item_id, user_id, role) VALUES ($1,$2,$3,$4) ON CONFLICT (item_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
        [newId(), newItemId, p.user_id, p.role]
      );
    }
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1', [newItemId]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// ── PARTICIPANTS ──────────────────────────────────────────────────────────────

// POST add/update participant
router.post('/discussion-items/:id/participants', auth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId) return bad(res, 'userId erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO discussion_participants (id, item_id, user_id, role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (item_id, user_id) DO UPDATE SET role=EXCLUDED.role`,
      [id, req.params.id, userId, role || 'required']
    );
    ok(res, { ok: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// DELETE participant
router.delete('/discussion-items/:id/participants/:uid', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM discussion_participants WHERE item_id=$1 AND user_id=$2',
      [req.params.id, req.params.uid]
    );
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

module.exports = router;
