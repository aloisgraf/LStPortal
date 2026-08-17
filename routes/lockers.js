'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// Spintvergabe: fest auf admin/leitung/technik beschränkt (sehen UND
// bearbeiten) — bewusst kein über Einstellungen/Rollen-Rechte konfigurierbares
// Recht wie bei manageSop, sondern hart wie z.B. canManageDp.
const canManageSpint = req => (req.p?.roles||[]).some(r=>['admin','leitung','technik'].includes(r));
const requireManage = (req,res) => { if(!canManageSpint(req)){ bad(res,'Keine Berechtigung',403); return false; } return true; };

router.post('/lockers', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {number,assigneeType,assigneeUserId,assigneeLabel,note} = req.body;
    if (!number?.trim()) return bad(res,'Spind-Nummer erforderlich');
    const type = ['user','general','none'].includes(assigneeType) ? assigneeType : 'none';
    const id = newId();
    await pool.query(
      `INSERT INTO lockers (id,number,assignee_type,assignee_user_id,assignee_label,note,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, number.trim(), type,
       type==='user'?(assigneeUserId||null):null,
       type==='general'?(assigneeLabel||'').trim():'',
       (note||'').trim(), req.uid]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/lockers/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {number,assigneeType,assigneeUserId,assigneeLabel,note} = req.body;
    if (!number?.trim()) return bad(res,'Spind-Nummer erforderlich');
    const type = ['user','general','none'].includes(assigneeType) ? assigneeType : 'none';
    await pool.query(
      `UPDATE lockers SET number=$1,assignee_type=$2,assignee_user_id=$3,assignee_label=$4,note=$5,updated_by=$6,updated_at=NOW() WHERE id=$7`,
      [number.trim(), type,
       type==='user'?(assigneeUserId||null):null,
       type==='general'?(assigneeLabel||'').trim():'',
       (note||'').trim(), req.uid, req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/lockers/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    await pool.query('DELETE FROM lockers WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
