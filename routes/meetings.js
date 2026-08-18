'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, getUser, auditNote, nextTicketNumber } = require('../db');
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
    const { title, type, rhythm, rhythmDay, rhythmTime, description, link } = req.body;
    if (!title) return bad(res, 'Titel erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO meetings (id, title, type, rhythm, rhythm_day, rhythm_time, description, link, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, title, type || 'einmalig', rhythm || null, rhythmDay || null, rhythmTime || '', description || '', link || null, req.uid]
    );
    const row = await q1('SELECT * FROM meetings WHERE id=$1', [id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// PUT update meeting
router.put('/meetings/:id', auth, async (req, res) => {
  try {
    const { title, type, rhythm, rhythmDay, rhythmTime, description, link } = req.body;
    await pool.query(
      `UPDATE meetings SET title=$1, type=$2, rhythm=$3, rhythm_day=$4, rhythm_time=$5, description=$6, link=$7
       WHERE id=$8`,
      [title, type || 'einmalig', rhythm || null, rhythmDay || null, rhythmTime || '', description || '', link || null, req.params.id]
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
    const { date, time, notes, title } = req.body;
    const id = newId();
    await pool.query(
      `INSERT INTO meeting_instances (id, meeting_id, date, time, notes, title, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.params.id, date||null, time || '', notes || '', title || null, req.uid]
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
    const { date, time, status, notes, title } = req.body;
    const inst = await q1('SELECT * FROM meeting_instances WHERE id=$1', [req.params.id]);
    if (!inst) return bad(res, 'Termin nicht gefunden', 404);
    // date can be explicitly set to null ("Datum noch offen")
    const newDate = Object.prototype.hasOwnProperty.call(req.body,'date') ? (date||null) : inst.date;
    await pool.query(
      `UPDATE meeting_instances SET date=$1, time=COALESCE($2,time), status=COALESCE($3,status), notes=COALESCE($4,notes), title=COALESCE($5,title) WHERE id=$6`,
      [newDate, time !== undefined ? time : null, status || null, notes !== undefined ? notes : null, title || null, req.params.id]
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
    const { title, description, dueDate, delegatedTo, participants, link } = req.body;
    if (!title) return bad(res, 'Titel erforderlich', 400);
    const id = newId();
    await pool.query(
      `INSERT INTO discussion_items (id, instance_id, title, description, status, due_date, delegated_to, link, created_by)
       VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8)`,
      [id, req.params.id, title, description || '', dueDate || null, delegatedTo || null, link || null, req.uid]
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

// Helper: append a protokoll entry to an item
async function addProtokoll(itemId, entry) {
  await pool.query(
    `UPDATE discussion_items SET protokoll = COALESCE(protokoll,'[]'::jsonb) || $1::jsonb WHERE id=$2`,
    [JSON.stringify([entry]), itemId]
  );
}

const STATUS_LABEL = {open:'Zu besprechen',done:'Besprochen',redo:'Nochmal besprechen',delegate:'Delegiert'};

// PUT update discussion item
router.put('/discussion-items/:id', auth, async (req, res) => {
  try {
    const existingItem = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if(!existingItem) return bad(res,'Nicht gefunden',404);
    const meetingOwner = await q1('SELECT created_by FROM meetings WHERE id=$1',[existingItem.meeting_id]);
    const isParticipant = await q1('SELECT id FROM discussion_participants WHERE item_id=$1 AND user_id=$2',[req.params.id,req.uid]);
    if(!req.p.manageUsers && existingItem.created_by!==req.uid && !isParticipant && meetingOwner?.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const { title, description, status, dueDate, meetingDate, delegatedTo, result, link } = req.body;
    const now = new Date().toISOString();

    // Detect status change → add protokoll entry
    const oldStatus = existingItem.status;
    const newStatus = status || oldStatus;
    if (newStatus !== oldStatus) {
      const entry = {ts:now,by:req.uid,type:'status',from:oldStatus,to:newStatus};
      await addProtokoll(req.params.id, entry);
      // Also notify all linked siblings
      if (existingItem.group_id) {
        const meeting = await q1('SELECT title FROM meetings WHERE id=$1',[existingItem.meeting_id]);
        const siblings = await q('SELECT id FROM discussion_items WHERE group_id=$1 AND id!=$2',[existingItem.group_id,req.params.id]);
        const sibEntry = {ts:now,by:req.uid,type:'linked_status',fromMeeting:meeting?.title||'',from:oldStatus,to:newStatus};
        for (const s of siblings) await addProtokoll(s.id, sibEntry);
      }
    }

    await pool.query(
      `UPDATE discussion_items SET
        title=COALESCE($1,title), description=COALESCE($2,description),
        status=COALESCE($3,status), due_date=$4, meeting_date=$5,
        delegated_to=$6, result=COALESCE($7,result), link=COALESCE($8,link)
       WHERE id=$9`,
      [title || null, description !== undefined ? description : null, status || null,
       dueDate || null, meetingDate || null, delegatedTo || null, result !== undefined ? result : null,
       link || null, req.params.id]
    );

    // Sync content to linked items (title/description/dueDate/delegatedTo — but NOT status/result)
    if (existingItem.group_id && (title || description !== undefined || dueDate !== undefined || delegatedTo !== undefined)) {
      const meeting = await q1('SELECT title FROM meetings WHERE id=$1',[existingItem.meeting_id]);
      const siblings = await q('SELECT id FROM discussion_items WHERE group_id=$1 AND id!=$2',[existingItem.group_id,req.params.id]);
      for (const s of siblings) {
        await pool.query(
          `UPDATE discussion_items SET title=COALESCE($1,title), description=COALESCE($2,description), due_date=$3, delegated_to=$4 WHERE id=$5`,
          [title||null, description!==undefined?description:null, dueDate||null, delegatedTo||null, s.id]
        );
        await addProtokoll(s.id, {ts:now,by:req.uid,type:'content_synced',fromMeeting:meeting?.title||''});
      }
    }

    const row = await q1('SELECT * FROM discussion_items WHERE id=$1', [req.params.id]);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST Besprechungspunkt in ein Ticket umwandeln. Wird automatisch am Punkt
// (converted_ticket_id/converted_by/converted_at) sowie im Protokoll des
// Punkts vermerkt — der Punkt bleibt bestehen, ist aber nur einmal umwandelbar.
router.post('/discussion-items/:id/convert-to-ticket', auth, async (req, res) => {
  try {
    const item = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if (!item) return bad(res,'Nicht gefunden',404);
    if (item.converted_ticket_id) return bad(res,'Punkt wurde bereits in ein Ticket umgewandelt',400);
    const meetingOwner = await q1('SELECT created_by FROM meetings WHERE id=$1',[item.meeting_id]);
    const isParticipant = await q1('SELECT id FROM discussion_participants WHERE item_id=$1 AND user_id=$2',[req.params.id,req.uid]);
    if (!req.p.manageUsers && item.created_by!==req.uid && !isParticipant && meetingOwner?.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);

    const {department, priority, description} = req.body;
    let {assigneeId} = req.body;
    if (!department) return bad(res,'Fachbereich erforderlich',400);
    const desc = description!==undefined ? description : (item.description||'');

    const meeting = await q1('SELECT title FROM meetings WHERE id=$1',[item.meeting_id]);
    const ticketId = newId(), number = await nextTicketNumber();
    await pool.query(
      `INSERT INTO tickets (id,number,title,description,department,tags,priority,status,bucket,assignee_id,created_by)
       VALUES ($1,$2,$3,$4,$5,'[]',$6,'open','',$7,$8)`,
      [ticketId, number, item.title, desc, department, priority||'medium', assigneeId||null, req.uid]
    );
    const uname = (await getUser(req.uid))?.name||'?';
    await auditNote(ticketId, req.uid, `✅ Ticket erstellt von ${uname} (aus Besprechungspunkt „${item.title}“, Besprechung „${meeting?.title||'?'}“)`);

    // Beschreibung wird auch als "Ergebnis / Notiz" beim Punkt selbst vermerkt
    await pool.query(
      `UPDATE discussion_items SET converted_ticket_id=$1, converted_at=NOW(), converted_by=$2, result=$3 WHERE id=$4`,
      [ticketId, req.uid, desc, item.id]
    );
    const now = new Date().toISOString();
    await addProtokoll(item.id, {ts:now, by:req.uid, type:'converted_to_ticket', ticketId, ticketNumber:number});

    const row = await q1('SELECT * FROM discussion_items WHERE id=$1', [item.id]);
    ok(res, {item:row, ticketId, number});
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST move item to another instance of the same meeting
router.post('/discussion-items/:id/move', auth, async (req, res) => {
  try {
    const { targetInstanceId } = req.body;
    if (!targetInstanceId) return bad(res,'targetInstanceId erforderlich',400);
    const item = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if (!item) return bad(res,'Nicht gefunden',404);
    const targetInst = await q1('SELECT * FROM meeting_instances WHERE id=$1',[targetInstanceId]);
    if (!targetInst) return bad(res,'Ziel-Termin nicht gefunden',404);
    const meetingOwner = await q1('SELECT created_by FROM meetings WHERE id=$1',[item.meeting_id]);
    if (!req.p.manageUsers && meetingOwner?.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const fromInst = await q1('SELECT * FROM meeting_instances WHERE id=$1',[item.instance_id]);
    const now = new Date().toISOString();
    await pool.query('UPDATE discussion_items SET instance_id=$1 WHERE id=$2',[targetInstanceId,req.params.id]);
    const fromDate = fromInst?.date ? String(fromInst.date).slice(0,10) : 'offen';
    const toDate = targetInst.date ? String(targetInst.date).slice(0,10) : 'offen';
    await addProtokoll(req.params.id,{ts:now,by:req.uid,type:'moved',fromInstanceId:item.instance_id,toInstanceId:targetInstanceId,fromDate,toDate});
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1',[req.params.id]);
    ok(res, row);
  } catch(e) { console.error(e); bad(res,'Serverfehler',500); }
});

// POST copy item to another meeting (linked)
router.post('/discussion-items/:id/copy-to-meeting', auth, async (req, res) => {
  try {
    const { targetInstanceId } = req.body;
    if (!targetInstanceId) return bad(res,'targetInstanceId erforderlich',400);
    const item = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if (!item) return bad(res,'Nicht gefunden',404);
    const targetInst = await q1('SELECT mi.*, m.title as meeting_title FROM meeting_instances mi JOIN meetings m ON m.id=mi.meeting_id WHERE mi.id=$1',[targetInstanceId]);
    if (!targetInst) return bad(res,'Ziel-Termin nicht gefunden',404);
    const now = new Date().toISOString();

    // Assign group_id if not already set
    const groupId = item.group_id || newId();
    if (!item.group_id) {
      await pool.query('UPDATE discussion_items SET group_id=$1 WHERE id=$2',[groupId,req.params.id]);
    }

    // Create linked copy
    const newItemId = newId();
    await pool.query(
      `INSERT INTO discussion_items (id,instance_id,title,description,status,due_date,delegated_to,group_id,protokoll,created_by)
       VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8::jsonb,$9)`,
      [newItemId,targetInstanceId,item.title,item.description||'',item.due_date||null,item.delegated_to||null,groupId,
       JSON.stringify([{ts:now,by:req.uid,type:'copied_from',fromMeeting:item.meeting_id}]),req.uid]
    );
    // Copy participants
    const parts = await q('SELECT * FROM discussion_participants WHERE item_id=$1',[req.params.id]);
    for (const p of parts) {
      await pool.query(
        `INSERT INTO discussion_participants (id,item_id,user_id,role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [newId(),newItemId,p.user_id,p.role]
      );
    }
    const srcMeeting = await q1('SELECT title FROM meetings WHERE id=$1',[item.meeting_id]);
    await addProtokoll(req.params.id,{ts:now,by:req.uid,type:'copied_to',toMeeting:targetInst.meeting_title||'',toInstanceId:targetInstanceId});
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1',[newItemId]);
    ok(res, row);
  } catch(e) { console.error(e); bad(res,'Serverfehler',500); }
});

// DELETE discussion item
router.delete('/discussion-items/:id', auth, async (req, res) => {
  try {
    const existingItem2 = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if(existingItem2){
      const meetingOwner2 = await q1('SELECT created_by FROM meetings WHERE id=$1',[existingItem2.meeting_id]);
      if(!req.p.manageUsers && existingItem2.created_by!==req.uid && meetingOwner2?.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
      if(existingItem2.status==='done') return bad(res,'Bereits besprochene Punkte können nicht gelöscht werden');
    }
    await pool.query('DELETE FROM discussion_items WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// POST unlink copied item (break group_id link)
router.post('/discussion-items/:id/unlink', auth, async (req, res) => {
  try {
    const item = await q1('SELECT di.*, mi.meeting_id FROM discussion_items di JOIN meeting_instances mi ON mi.id=di.instance_id WHERE di.id=$1',[req.params.id]);
    if (!item) return bad(res,'Nicht gefunden',404);
    if (!item.group_id) return bad(res,'Punkt ist nicht verknüpft',400);
    const meetingOwner = await q1('SELECT created_by FROM meetings WHERE id=$1',[item.meeting_id]);
    if (!req.p.manageUsers && item.created_by!==req.uid && meetingOwner?.created_by!==req.uid) return bad(res,'Keine Berechtigung',403);
    const now = new Date().toISOString();
    const oldGroupId = item.group_id;
    await pool.query('UPDATE discussion_items SET group_id=NULL WHERE id=$1',[req.params.id]);
    await addProtokoll(req.params.id,{ts:now,by:req.uid,type:'unlinked',fromGroupId:oldGroupId});
    const row = await q1('SELECT * FROM discussion_items WHERE id=$1',[req.params.id]);
    ok(res, row);
  } catch(e) { console.error(e); bad(res,'Serverfehler',500); }
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
