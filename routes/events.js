'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, logAct, getUser, createNotification } = require('../db');
const { auth, ok, bad } = require('../middleware');


router.post('/', auth, async (req,res) => {
  try {
    const {isGeneral,dateFrom,dateTo,timeFrom,timeTo,userId,category,reason} = req.body;
    if (!dateFrom||!reason?.trim()) return bad(res,'Datum und Beschreibung erforderlich');
    if (!isGeneral&&!userId) return bad(res,'Mitarbeiter erforderlich');
    if (isGeneral&&!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    if (!isGeneral&&userId!==req.uid&&!req.p.addForOthers) return bad(res,'Keine Berechtigung',403);
    const id=newId();
    await pool.query('INSERT INTO events (id,is_general,date_from,date_to,time_from,time_to,user_id,category,reason,approval_status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id,!!isGeneral,dateFrom,dateTo||dateFrom,timeFrom||'',timeTo||'',isGeneral?null:userId,category||'',reason.trim(),isGeneral?'approved':null,req.uid]);
    // Notify target user if someone else added an event for them
    if (!isGeneral && userId && userId !== req.uid) {
      const author = await getUser(req.uid);
      await createNotification(userId,'event_added',`${author?.name||'?'} hat einen Eintrag für dich eingetragen`,null,null,req.uid,id);
    }
    await logAct(req.uid,req.user.name,'create_event',{dateFrom,isGeneral:!!isGeneral});
    ok(res,{id});
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id', auth, async (req,res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Nicht gefunden',404);
    if (ev.created_by!==req.uid) return bad(res,'Nur Ersteller kann bearbeiten',403);
    const {dateFrom,dateTo,timeFrom,timeTo,category,reason} = req.body;
    await pool.query('UPDATE events SET date_from=$1,date_to=$2,time_from=$3,time_to=$4,category=$5,reason=$6 WHERE id=$7',
      [dateFrom,dateTo||dateFrom,timeFrom||'',timeTo||'',category||'',reason.trim(),req.params.id]);
    // Notify target if someone else edited their event
    if (ev.user_id && ev.user_id !== req.uid) {
      const author = await getUser(req.uid);
      await createNotification(ev.user_id,'event_changed',`${author?.name||'?'} hat deinen Eintrag geändert`,null,null,req.uid,ev.id);
    }
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.put('/:id/approval', auth, async (req,res) => {
  try {
    if (!req.p.canApproveEvents) return bad(res,'Keine Berechtigung',403);
    const {status} = req.body;
    if (!['approved','rejected'].includes(status)) return bad(res,'Ungültiger Status');
    await pool.query('UPDATE events SET approval_status=$1 WHERE id=$2 AND is_general=false',[status,req.params.id]);
    await logAct(req.uid,req.user.name,'approve_event',{eventId:req.params.id,status});
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.post('/:id/confirm', auth, async (req,res) => {
  try {
    await pool.query('INSERT INTO event_confirms (id,event_id,user_id) VALUES ($1,$2,$3) ON CONFLICT (event_id,user_id) DO NOTHING',
      [newId(),req.params.id,req.uid]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});
router.delete('/:id', auth, async (req,res) => {
  try {
    const ev = await q1('SELECT * FROM events WHERE id=$1',[req.params.id]);
    if (!ev) return bad(res,'Nicht gefunden',404);
    const canDel = req.p.manageUsers || req.p.canApproveEvents || (ev.is_general&&req.p.manageGeneral) || (!ev.is_general&&(req.p.editAllPersonal||ev.created_by===req.uid));
    if (!canDel) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM event_confirms WHERE event_id=$1',[req.params.id]);
    await pool.query('DELETE FROM events WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,e.message,500); }
});

// TICKETS
module.exports = router;
