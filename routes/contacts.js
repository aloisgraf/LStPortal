'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');

// Kontakte sind für alle eingeloggten Nutzer sichtbar (Telefonliste/Verzeichnis);
// Anlegen/Ändern/Löschen wie bei Links/Besprechungen über addGeneral geregelt.
router.get('/contacts', auth, async (req,res) => {
  try { ok(res, await q('SELECT * FROM contacts ORDER BY name')); }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/contacts', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    const id = newId();
    await pool.query(
      `INSERT INTO contacts (id,title,name,email,phone1,phone2,company,responsible_for,availability,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id,(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),req.uid]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/contacts/:id', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    await pool.query(
      `UPDATE contacts SET title=$1,name=$2,email=$3,phone1=$4,phone2=$5,company=$6,responsible_for=$7,availability=$8,updated_at=NOW() WHERE id=$9`,
      [(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/contacts/:id', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM contacts WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
