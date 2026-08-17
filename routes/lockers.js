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
    const {number,assigneeType,assigneeUserId,assigneeLabel,note,categoryId} = req.body;
    if (!number?.trim()) return bad(res,'Spind-Nummer erforderlich');
    const type = ['user','general','none'].includes(assigneeType) ? assigneeType : 'none';
    const id = newId();
    await pool.query(
      `INSERT INTO lockers (id,number,assignee_type,assignee_user_id,assignee_label,note,created_by,category_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, number.trim(), type,
       type==='user'?(assigneeUserId||null):null,
       type==='general'?(assigneeLabel||'').trim():'',
       (note||'').trim(), req.uid, categoryId||null]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/lockers/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {number,assigneeType,assigneeUserId,assigneeLabel,note,categoryId} = req.body;
    if (!number?.trim()) return bad(res,'Spind-Nummer erforderlich');
    const type = ['user','general','none'].includes(assigneeType) ? assigneeType : 'none';
    await pool.query(
      `UPDATE lockers SET number=$1,assignee_type=$2,assignee_user_id=$3,assignee_label=$4,note=$5,updated_by=$6,updated_at=NOW(),category_id=$7 WHERE id=$8`,
      [number.trim(), type,
       type==='user'?(assigneeUserId||null):null,
       type==='general'?(assigneeLabel||'').trim():'',
       (note||'').trim(), req.uid, categoryId||null, req.params.id]);
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

// ── Spind-Kategorien (Arten) ────────────────────────────────────────────────
router.post('/locker-categories', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {label,emoji} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    const id = newId();
    const maxOrd = await q1('SELECT MAX(sort_order) m FROM locker_categories');
    await pool.query('INSERT INTO locker_categories (id,label,emoji,sort_order) VALUES ($1,$2,$3,$4)',
      [id, label.trim(), (emoji||'').trim(), (parseInt(maxOrd.m)||0)+1]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/locker-categories/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    const {label,emoji} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    await pool.query('UPDATE locker_categories SET label=$1,emoji=$2 WHERE id=$3',
      [label.trim(), (emoji||'').trim(), req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/locker-categories/:id', auth, async (req,res) => {
  try {
    if (!requireManage(req,res)) return;
    await pool.query('DELETE FROM locker_categories WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
