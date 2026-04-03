'use strict';
const router = require('express').Router();
const { pool, q1, logActivity } = require('../db');
const { auth, dpOnly, ok, bad } = require('../middleware');
const { randomUUID } = require('crypto');

router.post('/', auth, async (req, res) => {
  try {
    const { isGeneral, dateFrom, dateTo, timeFrom, timeTo, userId, category, reason } = req.body;
    if (!dateFrom || !reason?.trim()) return bad(res, 'Datum und Beschreibung erforderlich');
    if (!category) return bad(res, 'Kategorie erforderlich');
    if (!isGeneral && !userId) return bad(res, 'Mitarbeiter erforderlich');
    if (isGeneral && !req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
    if (!isGeneral && userId !== req.uid && !req.p.addForOthers) return bad(res, 'Keine Berechtigung', 403);
    const id = randomUUID();
    const approved = isGeneral ? 'approved' : (req.p.canApproveEvents ? 'approved' : 'pending');
    await pool.query(
      'INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,approved,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id, !!isGeneral, dateFrom, dateTo || dateFrom, timeFrom || '', timeTo || '', isGeneral ? null : userId, category, reason.trim(), approved, req.uid]
    );
    await logActivity(req.uid, req.user.name, 'create_event', { event_id: id, dateFrom, isGeneral }, req.clientIp);
    ok(res, { id });
  } catch (e) { bad(res, e.message, 500); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!ev) return bad(res, 'Eintrag nicht gefunden', 404);
    if (ev.created_by !== req.uid) return bad(res, 'Nur der Ersteller darf bearbeiten', 403);
    const { dateFrom, dateTo, timeFrom, timeTo, category, reason } = req.body;
    const newApproved = req.p.canApproveEvents ? 'approved' : 'pending';
    await pool.query(
      'UPDATE events SET date_from=$1,date_to=$2,time_from=$3,time_to=$4,category=$5,reason=$6,approved=$7 WHERE id=$8',
      [dateFrom || ev.date_from, dateTo || ev.date_to, timeFrom || '', timeTo || '', category || ev.category, reason?.trim() || ev.reason, newApproved, req.params.id]
    );
    await logActivity(req.uid, req.user.name, 'edit_event', { event_id: req.params.id }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!ev) return bad(res, 'Eintrag nicht gefunden', 404);
    const canDel = (ev.is_general && req.p.manageGeneral) || (!ev.is_general && (req.p.editAllPersonal || ev.created_by === req.uid));
    if (!canDel) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
    await logActivity(req.uid, req.user.name, 'delete_event', { event_id: req.params.id }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

router.put('/:id/approve', auth, dpOnly, async (req, res) => {
  try {
    const { approved } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(approved)) return bad(res, 'Ungültiger Status');
    const ev = await q1('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!ev) return bad(res, 'Nicht gefunden', 404);
    if (ev.is_general) return bad(res, 'Allgemeine Einträge brauchen keine Freigabe');
    await pool.query('UPDATE events SET approved=$1 WHERE id=$2', [approved, req.params.id]);
    await logActivity(req.uid, req.user.name, 'approve_event', { event_id: req.params.id, approved }, req.clientIp);
    ok(res);
  } catch (e) { bad(res, e.message, 500); }
});

module.exports = router;
