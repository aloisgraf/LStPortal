'use strict';
const router = require('express').Router();
const { q, q1, pool, invalidateDeptCache } = require('../db');
const { auth, ok, bad } = require('../middleware');

const slugify = s => (s||'')
  .replace(/ä/gi,'ae').replace(/ö/gi,'oe').replace(/ü/gi,'ue').replace(/ß/gi,'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'') || 'bereich';

router.post('/departments', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {label,emoji,color} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    let id = slugify(label);
    const existing = await q('SELECT id FROM departments');
    const existingIds = new Set(existing.map(d=>d.id));
    if (existingIds.has(id)) {
      let i = 2;
      while (existingIds.has(id+i)) i++;
      id = id+i;
    }
    const maxOrd = await q1('SELECT MAX(sort_order) m FROM departments');
    await pool.query(
      `INSERT INTO departments (id,label,emoji,color,sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [id,label.trim(),(emoji||'').trim(),(color||'#64748b').trim(),(parseInt(maxOrd.m)||0)+1]);
    invalidateDeptCache();
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/departments/:id', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const {label,emoji,color} = req.body;
    if (!label?.trim()) return bad(res,'Bezeichnung erforderlich');
    await pool.query('UPDATE departments SET label=$1,emoji=$2,color=$3 WHERE id=$4',
      [label.trim(),(emoji||'').trim(),(color||'#64748b').trim(),req.params.id]);
    invalidateDeptCache();
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/departments/:id', auth, async (req,res) => {
  try {
    if (!req.p.manageUsers) return bad(res,'Keine Berechtigung',403);
    const tkCnt = await q1('SELECT COUNT(*) n FROM tickets WHERE department=$1',[req.params.id]);
    if (parseInt(tkCnt.n)>0) return bad(res,`Es gibt noch ${tkCnt.n} Ticket(s) in diesem Fachbereich — zuerst verschieben`);
    await pool.query('DELETE FROM departments WHERE id=$1',[req.params.id]);
    invalidateDeptCache();
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
