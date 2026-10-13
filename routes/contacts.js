'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, parseRoles, canSeeAcl, canEditAcl } = require('../db');
const { auth, ok, bad } = require('../middleware');

// Kontakte sind für alle eingeloggten Nutzer sichtbar (Telefonliste/Verzeichnis);
// Anlegen/Ändern/Löschen wie bei Links/Besprechungen über addGeneral geregelt.
router.get('/contacts', auth, async (req,res) => {
  try {
    const rows = await q('SELECT * FROM contacts ORDER BY name');
    const roles = parseRoles(req.user.roles);
    ok(res, rows.filter(c => canSeeAcl(c, req.uid, roles)));
  }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/contacts', auth, async (req,res) => {
  try {
    if (!req.p.addGeneral) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability,visibleRoles,editableRoles} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    const id = newId();
    await pool.query(
      `INSERT INTO contacts (id,title,name,email,phone1,phone2,company,responsible_for,availability,created_by,visible_roles,editable_roles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id,(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),req.uid,
       JSON.stringify(Array.isArray(visibleRoles)?visibleRoles:[]), JSON.stringify(Array.isArray(editableRoles)?editableRoles:[])]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/contacts/:id', auth, async (req,res) => {
  try {
    const existing = await q1('SELECT * FROM contacts WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res,'Nicht gefunden',404);
    if (!canEditAcl(existing, req.uid, parseRoles(req.user.roles), req.p)) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability,visibleRoles,editableRoles} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    await pool.query(
      `UPDATE contacts SET title=$1,name=$2,email=$3,phone1=$4,phone2=$5,company=$6,responsible_for=$7,availability=$8,updated_at=NOW(),
       visible_roles=COALESCE($9,visible_roles), editable_roles=COALESCE($10,editable_roles) WHERE id=$11`,
      [(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),
       Array.isArray(visibleRoles)?JSON.stringify(visibleRoles):null,
       Array.isArray(editableRoles)?JSON.stringify(editableRoles):null,
       req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/contacts/:id', auth, async (req,res) => {
  try {
    const existing = await q1('SELECT * FROM contacts WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res,'Nicht gefunden',404);
    if (!canEditAcl(existing, req.uid, parseRoles(req.user.roles), req.p)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM contacts WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
