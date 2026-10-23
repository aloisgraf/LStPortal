'use strict';
const router = require('express').Router();
const { q, q1, newId, pool, parseRoles, canSeeAcl, canEditAcl } = require('../db');
const { auth, ok, bad } = require('../middleware');

// Kontakte sind standardmäßig nur für Ersteller + Admin sichtbar; Ordner
// (Kategorien) und/oder einzelne Kontakte können gezielt für Rollen und/oder
// Nutzer freigegeben werden (siehe canSeeAcl/canEditAcl in db.js) — Anlegen
// wie bei Dokumenten/Wiki über createContacts geregelt (Modul in lib/permissions.js).

// ── KATEGORIEN ────────────────────────────────────────────────────────────

async function contactCatMap() {
  const rows = await q('SELECT * FROM contact_categories');
  const m = {}; rows.forEach(c => m[c.id] = c); return m;
}

router.get('/contact-categories', auth, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM contact_categories ORDER BY sort_order, name');
    const roles = parseRoles(req.user.roles);
    const byId = {}; rows.forEach(c => byId[c.id] = c);
    ok(res, rows.filter(c => canSeeAcl(c, req.uid, roles, req.p, byId)));
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/contact-categories', auth, async (req, res) => {
  if (!req.p.createContacts) return bad(res, 'Keine Berechtigung', 403);
  try {
    const { name, icon, color, sortOrder, parentId, visibleRoles, editableRoles, visibleUsers, editableUsers } = req.body;
    if (!name?.trim()) return bad(res, 'Name erforderlich', 400);
    if (parentId) {
      const parent = await q1('SELECT id FROM contact_categories WHERE id=$1', [parentId]);
      if (!parent) return bad(res, 'Übergeordnete Kategorie nicht gefunden', 400);
    }
    const id = newId();
    const row = await q1(
      `INSERT INTO contact_categories (id,name,icon,color,sort_order,created_by,parent_id,visible_roles,editable_roles,visible_users,editable_users)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, name.trim(), icon||'📇', color||'#3b6dd4', sortOrder||0, req.uid, parentId||null,
       JSON.stringify(Array.isArray(visibleRoles)?visibleRoles:[]), JSON.stringify(Array.isArray(editableRoles)?editableRoles:[]),
       JSON.stringify(Array.isArray(visibleUsers)?visibleUsers:[]), JSON.stringify(Array.isArray(editableUsers)?editableUsers:[])]
    );
    ok(res, row);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.put('/contact-categories/:id', auth, async (req, res) => {
  try {
    const { name, icon, color, parentId, visibleRoles, editableRoles, visibleUsers, editableUsers } = req.body;
    if (!name?.trim()) return bad(res, 'Name erforderlich', 400);
    if (parentId === req.params.id) return bad(res, 'Kategorie kann nicht ihr eigener Unterordner sein', 400);
    const byId = await contactCatMap();
    const cat = byId[req.params.id];
    if (!cat) return bad(res, 'Nicht gefunden', 404);
    if (!canEditAcl(cat, req.uid, parseRoles(req.user.roles), req.p, byId)) return bad(res, 'Keine Berechtigung', 403);
    if (parentId) {
      const parent = await q1('SELECT id FROM contact_categories WHERE id=$1', [parentId]);
      if (!parent) return bad(res, 'Übergeordnete Kategorie nicht gefunden', 400);
    }
    const row = await q1(
      `UPDATE contact_categories SET name=$1,icon=$2,color=$3,parent_id=$4,
       visible_roles=COALESCE($5,visible_roles), editable_roles=COALESCE($6,editable_roles),
       visible_users=COALESCE($7,visible_users), editable_users=COALESCE($8,editable_users) WHERE id=$9 RETURNING *`,
      [name.trim(), icon||'📇', color||'#3b6dd4', parentId||null,
       Array.isArray(visibleRoles)?JSON.stringify(visibleRoles):null,
       Array.isArray(editableRoles)?JSON.stringify(editableRoles):null,
       Array.isArray(visibleUsers)?JSON.stringify(visibleUsers):null,
       Array.isArray(editableUsers)?JSON.stringify(editableUsers):null,
       req.params.id]
    );
    ok(res, row);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.delete('/contact-categories/:id', auth, async (req, res) => {
  try {
    const byId = await contactCatMap();
    const cat = byId[req.params.id];
    if (!cat) return bad(res, 'Nicht gefunden', 404);
    if (!canEditAcl(cat, req.uid, parseRoles(req.user.roles), req.p, byId)) return bad(res, 'Keine Berechtigung', 403);
    await pool.query('UPDATE contacts SET category_id=NULL WHERE category_id=$1', [req.params.id]);
    // Unterordner werden zu Top-Level-Kategorien statt mitgelöscht zu werden
    await pool.query('UPDATE contact_categories SET parent_id=NULL WHERE parent_id=$1', [req.params.id]);
    await pool.query('DELETE FROM contact_categories WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

// ── KONTAKTE ──────────────────────────────────────────────────────────────

router.get('/contacts', auth, async (req,res) => {
  try {
    const rows = await q('SELECT * FROM contacts ORDER BY name');
    const roles = parseRoles(req.user.roles);
    const byId = await contactCatMap();
    ok(res, rows.filter(c => canSeeAcl(c, req.uid, roles, req.p, byId)));
  }
  catch(e) { bad(res,'Serverfehler',500); }
});

router.post('/contacts', auth, async (req,res) => {
  try {
    if (!req.p.createContacts) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability,categoryId,visibleRoles,editableRoles,visibleUsers,editableUsers} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    const id = newId();
    await pool.query(
      `INSERT INTO contacts (id,title,name,email,phone1,phone2,company,responsible_for,availability,created_by,category_id,visible_roles,editable_roles,visible_users,editable_users)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id,(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),req.uid,
       categoryId||null,
       JSON.stringify(Array.isArray(visibleRoles)?visibleRoles:[]), JSON.stringify(Array.isArray(editableRoles)?editableRoles:[]),
       JSON.stringify(Array.isArray(visibleUsers)?visibleUsers:[]), JSON.stringify(Array.isArray(editableUsers)?editableUsers:[])]);
    ok(res,{id});
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.put('/contacts/:id', auth, async (req,res) => {
  try {
    const existing = await q1('SELECT * FROM contacts WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res,'Nicht gefunden',404);
    if (!canEditAcl(existing, req.uid, parseRoles(req.user.roles), req.p, await contactCatMap())) return bad(res,'Keine Berechtigung',403);
    const {title,name,email,phone1,phone2,company,responsibleFor,availability,categoryId,visibleRoles,editableRoles,visibleUsers,editableUsers} = req.body;
    if (!name?.trim()) return bad(res,'Name erforderlich');
    await pool.query(
      `UPDATE contacts SET title=$1,name=$2,email=$3,phone1=$4,phone2=$5,company=$6,responsible_for=$7,availability=$8,category_id=$9,updated_at=NOW(),
       visible_roles=COALESCE($10,visible_roles), editable_roles=COALESCE($11,editable_roles),
       visible_users=COALESCE($12,visible_users), editable_users=COALESCE($13,editable_users) WHERE id=$14`,
      [(title||'').trim(),name.trim(),(email||'').trim(),(phone1||'').trim(),(phone2||'').trim(),(company||'').trim(),(responsibleFor||'').trim(),(availability||'').trim(),
       categoryId||null,
       Array.isArray(visibleRoles)?JSON.stringify(visibleRoles):null,
       Array.isArray(editableRoles)?JSON.stringify(editableRoles):null,
       Array.isArray(visibleUsers)?JSON.stringify(visibleUsers):null,
       Array.isArray(editableUsers)?JSON.stringify(editableUsers):null,
       req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

router.delete('/contacts/:id', auth, async (req,res) => {
  try {
    const existing = await q1('SELECT * FROM contacts WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res,'Nicht gefunden',404);
    if (!canEditAcl(existing, req.uid, parseRoles(req.user.roles), req.p, await contactCatMap())) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM contacts WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res,'Serverfehler',500); }
});

module.exports = router;
