'use strict';
const router = require('express').Router();
const { q, q1, newId, pool } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { validateMime } = require('../fileutil');

// Wiki ist für alle eingeloggten Nutzer lesbar (interne Wissensdatenbank);
// Anlegen/Ändern/Löschen wie bei Kontakten/Links/Besprechungen über
// addGeneral geregelt.

// ── KATEGORIEN ────────────────────────────────────────────────────────────

router.get('/wiki-categories', auth, async (req, res) => {
  try { ok(res, await q('SELECT * FROM wiki_categories ORDER BY sort_order, name')); }
  catch (e) { bad(res, 'Serverfehler', 500); }
});

router.post('/wiki-categories', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const { name, icon, color, sortOrder } = req.body;
    if (!name?.trim()) return bad(res, 'Name erforderlich', 400);
    const id = newId();
    await pool.query(
      'INSERT INTO wiki_categories (id,name,icon,color,sort_order,created_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name.trim(), icon || '📚', color || '#3b6dd4', sortOrder || 0, req.uid]
    );
    ok(res, await q1('SELECT * FROM wiki_categories WHERE id=$1', [id]));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.put('/wiki-categories/:id', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const { name, icon, color } = req.body;
    if (!name?.trim()) return bad(res, 'Name erforderlich', 400);
    await pool.query('UPDATE wiki_categories SET name=$1,icon=$2,color=$3 WHERE id=$4',
      [name.trim(), icon || '📚', color || '#3b6dd4', req.params.id]);
    const row = await q1('SELECT * FROM wiki_categories WHERE id=$1', [req.params.id]);
    if (!row) return bad(res, 'Nicht gefunden', 404);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.delete('/wiki-categories/:id', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    await pool.query('UPDATE wiki_articles SET category_id=NULL WHERE category_id=$1', [req.params.id]);
    await pool.query('DELETE FROM wiki_categories WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// ── ARTIKEL ───────────────────────────────────────────────────────────────

router.get('/wiki-articles', auth, async (req, res) => {
  try { ok(res, await q('SELECT * FROM wiki_articles ORDER BY updated_at DESC')); }
  catch (e) { bad(res, 'Serverfehler', 500); }
});

router.post('/wiki-articles', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const { title, categoryId, tags, body } = req.body;
    if (!title?.trim()) return bad(res, 'Titel erforderlich', 400);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    const id = newId();
    await pool.query(
      `INSERT INTO wiki_articles (id,category_id,title,tags,body,version,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,1,$6,$6)`,
      [id, categoryId || null, title.trim(), tagsJson, body || '', req.uid]
    );
    await pool.query(
      `INSERT INTO wiki_article_versions (id,article_id,version,title,body,tags,edited_by) VALUES ($1,$2,1,$3,$4,$5,$6)`,
      [newId(), id, title.trim(), body || '', tagsJson, req.uid]
    );
    ok(res, await q1('SELECT * FROM wiki_articles WHERE id=$1', [id]));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.put('/wiki-articles/:id', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const existing = await q1('SELECT * FROM wiki_articles WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res, 'Nicht gefunden', 404);
    const { title, categoryId, tags, body } = req.body;
    if (title !== undefined && !title.trim()) return bad(res, 'Titel erforderlich', 400);
    // Bisherigen Stand vor dem Überschreiben archivieren.
    await pool.query(
      `INSERT INTO wiki_article_versions (id,article_id,version,title,body,tags,edited_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId(), existing.id, existing.version, existing.title, existing.body, existing.tags, existing.updated_by || existing.created_by]
    );
    const newVersion = existing.version + 1;
    await pool.query(
      `UPDATE wiki_articles SET title=COALESCE($1,title), category_id=$2, tags=COALESCE($3,tags),
       body=COALESCE($4,body), version=$5, updated_by=$6, updated_at=NOW() WHERE id=$7`,
      [title?.trim() || null,
       categoryId !== undefined ? (categoryId || null) : existing.category_id,
       tags !== undefined ? JSON.stringify(tags) : null,
       body !== undefined ? body : null,
       newVersion, req.uid, req.params.id]
    );
    ok(res, await q1('SELECT * FROM wiki_articles WHERE id=$1', [req.params.id]));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.delete('/wiki-articles/:id', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    await pool.query('DELETE FROM wiki_articles WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.get('/wiki-articles/:id/versions', auth, async (req, res) => {
  try {
    ok(res, await q(
      'SELECT id,version,title,edited_by,created_at FROM wiki_article_versions WHERE article_id=$1 ORDER BY version DESC',
      [req.params.id]
    ));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.get('/wiki-articles/:id/versions/:vid', auth, async (req, res) => {
  try {
    const row = await q1('SELECT * FROM wiki_article_versions WHERE id=$1 AND article_id=$2', [req.params.vid, req.params.id]);
    if (!row) return bad(res, 'Nicht gefunden', 404);
    ok(res, row);
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.post('/wiki-articles/:id/restore/:vid', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const existing = await q1('SELECT * FROM wiki_articles WHERE id=$1', [req.params.id]);
    if (!existing) return bad(res, 'Nicht gefunden', 404);
    const ver = await q1('SELECT * FROM wiki_article_versions WHERE id=$1 AND article_id=$2', [req.params.vid, req.params.id]);
    if (!ver) return bad(res, 'Version nicht gefunden', 404);
    await pool.query(
      `INSERT INTO wiki_article_versions (id,article_id,version,title,body,tags,edited_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId(), existing.id, existing.version, existing.title, existing.body, existing.tags, existing.updated_by || existing.created_by]
    );
    const newVersion = existing.version + 1;
    await pool.query(
      'UPDATE wiki_articles SET title=$1, body=$2, tags=$3, version=$4, updated_by=$5, updated_at=NOW() WHERE id=$6',
      [ver.title, ver.body, ver.tags, newVersion, req.uid, req.params.id]
    );
    ok(res, await q1('SELECT * FROM wiki_articles WHERE id=$1', [req.params.id]));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

// ── BILDER (für den Markdown-Editor) ───────────────────────────────────────

router.post('/wiki-images', auth, async (req, res) => {
  if (!req.p.addGeneral) return bad(res, 'Keine Berechtigung', 403);
  try {
    const { name, mimeType, data } = req.body;
    if (!name?.trim() || !data) return bad(res, 'Datei erforderlich', 400);
    const mime = mimeType || 'application/octet-stream';
    if (!validateMime(mime) || !mime.startsWith('image/')) return bad(res, 'Nur Bilder erlaubt', 400);
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 8 * 1024 * 1024) return bad(res, 'Bild zu groß (max. 8 MB)', 400);
    const id = newId();
    await pool.query(
      'INSERT INTO wiki_images (id,filename,mime_type,size_bytes,file_data,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name.trim(), mime, buf.length, buf.toString('base64'), req.uid]
    );
    ok(res, { id });
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

router.get('/wiki-images/:id', auth, async (req, res) => {
  try {
    const img = await q1('SELECT * FROM wiki_images WHERE id=$1', [req.params.id]);
    if (!img) return bad(res, 'Nicht gefunden', 404);
    res.setHeader('Content-Type', img.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from(img.file_data, 'base64'));
  } catch (e) { bad(res, 'Serverfehler', 500); }
});

module.exports = router;
