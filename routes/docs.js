'use strict';
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { q, q1, newId } = require('../db');
const { auth, ok, bad } = require('../middleware');
const { sanitizeFilename, validateMime, assertUnderDir } = require('../fileutil');

const DOCS_DIR = path.resolve(__dirname, '..', 'uploads', 'docs');

if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

function extFromMime(mime, originalName) {
  const nameExt = originalName ? path.extname(originalName) : '';
  if (nameExt) return nameExt;
  const map = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt', 'text/csv': '.csv',
    'application/zip': '.zip',
  };
  return map[mime] || '';
}

// ── DOC CATEGORIES ────────────────────────────────────────────────────────────

router.get('/doc-categories', auth, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM doc_categories ORDER BY sort_order, name');
    ok(res, rows);
  } catch(e) { bad(res, e.message, 500); }
});

router.post('/doc-categories', auth, async (req, res) => {
  if (!req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
  const { name, icon, color, sortOrder } = req.body;
  if (!name) return bad(res, 'Name erforderlich', 400);
  try {
    const id = newId();
    const row = await q1(
      `INSERT INTO doc_categories (id,name,icon,color,sort_order,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, name, icon||'📁', color||'#3b6dd4', sortOrder||0, req.uid]
    );
    ok(res, row);
  } catch(e) { bad(res, e.message, 500); }
});

router.put('/doc-categories/:id', auth, async (req, res) => {
  if (!req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
  const { name, icon, color } = req.body;
  if (!name) return bad(res, 'Name erforderlich', 400);
  try {
    const row = await q1(
      `UPDATE doc_categories SET name=$1,icon=$2,color=$3 WHERE id=$4 RETURNING *`,
      [name, icon||'📁', color||'#3b6dd4', req.params.id]
    );
    if (!row) return bad(res, 'Nicht gefunden', 404);
    ok(res, row);
  } catch(e) { bad(res, e.message, 500); }
});

router.delete('/doc-categories/:id', auth, async (req, res) => {
  if (!req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
  try {
    const inUse = await q1('SELECT id FROM documents WHERE category_id=$1 LIMIT 1', [req.params.id]);
    if (inUse) {
      // Unlink instead of blocking — set category_id to null
      await q('UPDATE documents SET category_id=NULL WHERE category_id=$1', [req.params.id]);
    }
    await q('DELETE FROM doc_categories WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch(e) { bad(res, e.message, 500); }
});

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────

router.get('/docs', auth, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM documents ORDER BY created_at DESC');
    ok(res, rows);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/docs', auth, async (req, res) => {
  const { title, description, categoryId, name: originalName, mimeType, data } = req.body;
  if (!title) return bad(res, 'Titel erforderlich', 400);
  if (!originalName || !data) return bad(res, 'Datei fehlt', 400);
  const mime = mimeType || 'application/octet-stream';
  if (!validateMime(mime)) return bad(res, 'Dateityp nicht erlaubt', 400);
  try {
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 20 * 1024 * 1024) return bad(res, 'Datei zu groß (max. 20 MB)', 400);
    const id = newId();
    const safeName = sanitizeFilename(originalName);
    const ext = extFromMime(mime, safeName);
    const filename = id + ext;
    const destPath = path.join(DOCS_DIR, filename);
    assertUnderDir(DOCS_DIR, destPath);
    fs.writeFileSync(destPath, buf);
    const doc = await q1(
      `INSERT INTO documents (id,category_id,title,description,filename,original_name,mime_type,size_bytes,current_version,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9) RETURNING *`,
      [id, categoryId||null, title, description||'', filename, safeName, mime, buf.length, req.uid]
    );
    const vId = newId();
    await q(
      `INSERT INTO document_versions (id,document_id,version,filename,original_name,size_bytes,uploaded_by)
       VALUES ($1,$2,1,$3,$4,$5,$6)`,
      [vId, id, filename, safeName, buf.length, req.uid]
    );
    ok(res, doc);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.get('/docs/:id', auth, async (req, res) => {
  try {
    const doc = await q1('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!doc) return bad(res, 'Nicht gefunden', 404);
    const filePath = path.join(DOCS_DIR, doc.filename);
    assertUnderDir(DOCS_DIR, filePath);
    if (!fs.existsSync(filePath)) return bad(res, 'Datei nicht gefunden', 404);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.sendFile(filePath);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.put('/docs/:id', auth, async (req, res) => {
  try {
    const doc = await q1('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!doc) return bad(res, 'Nicht gefunden', 404);
    if (doc.uploaded_by !== req.uid && !req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
    const { title, description, categoryId } = req.body;
    if (!title) return bad(res, 'Titel erforderlich', 400);
    const updated = await q1(
      `UPDATE documents SET title=$1,description=$2,category_id=$3,updated_at=NOW() WHERE id=$4 RETURNING *`,
      [title, description||'', categoryId||null, req.params.id]
    );
    ok(res, updated);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.delete('/docs/:id', auth, async (req, res) => {
  try {
    const doc = await q1('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!doc) return bad(res, 'Nicht gefunden', 404);
    if (doc.uploaded_by !== req.uid && !req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
    const versions = await q('SELECT filename FROM document_versions WHERE document_id=$1', [req.params.id]);
    for (const v of versions) {
      const fp = path.join(DOCS_DIR, v.filename);
      assertUnderDir(DOCS_DIR, fp);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const mainFp = path.join(DOCS_DIR, doc.filename);
    assertUnderDir(DOCS_DIR, mainFp);
    if (fs.existsSync(mainFp)) fs.unlinkSync(mainFp);
    await q('DELETE FROM document_versions WHERE document_id=$1', [req.params.id]);
    await q('DELETE FROM documents WHERE id=$1', [req.params.id]);
    ok(res, { deleted: true });
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.post('/docs/:id/version', auth, async (req, res) => {
  try {
    const doc = await q1('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!doc) return bad(res, 'Nicht gefunden', 404);
    if (doc.uploaded_by !== req.uid && !req.p.manageUsers) return bad(res, 'Keine Berechtigung', 403);
    const { name: originalName, mimeType, data } = req.body;
    if (!originalName || !data) return bad(res, 'Datei fehlt', 400);
    const mime = mimeType || 'application/octet-stream';
    if (!validateMime(mime)) return bad(res, 'Dateityp nicht erlaubt', 400);
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 20 * 1024 * 1024) return bad(res, 'Datei zu groß (max. 20 MB)', 400);
    const safeName = sanitizeFilename(originalName);
    const newVersion = (doc.current_version || 1) + 1;
    const ext = extFromMime(mime, safeName);
    const newFilename = doc.id + '_v' + newVersion + ext;
    const destPath = path.join(DOCS_DIR, newFilename);
    assertUnderDir(DOCS_DIR, destPath);
    fs.writeFileSync(destPath, buf);
    const vId = newId();
    await q(
      `INSERT INTO document_versions (id,document_id,version,filename,original_name,size_bytes,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [vId, doc.id, doc.current_version, doc.filename, doc.original_name, doc.size_bytes, doc.uploaded_by]
    );
    const updated = await q1(
      `UPDATE documents SET filename=$1,original_name=$2,mime_type=$3,size_bytes=$4,current_version=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,
      [newFilename, safeName, mime, buf.length, newVersion, doc.id]
    );
    ok(res, updated);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.get('/docs/:id/versions', auth, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM document_versions WHERE document_id=$1 ORDER BY version DESC', [req.params.id]);
    ok(res, rows);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

router.get('/docs/:id/versions/:vid', auth, async (req, res) => {
  try {
    const ver = await q1('SELECT * FROM document_versions WHERE id=$1 AND document_id=$2', [req.params.vid, req.params.id]);
    if (!ver) return bad(res, 'Nicht gefunden', 404);
    const filePath = path.join(DOCS_DIR, ver.filename);
    assertUnderDir(DOCS_DIR, filePath);
    if (!fs.existsSync(filePath)) return bad(res, 'Datei nicht gefunden', 404);
    const doc = await q1('SELECT mime_type FROM documents WHERE id=$1', [req.params.id]);
    res.setHeader('Content-Type', doc?.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(ver.original_name)}`);
    res.sendFile(filePath);
  } catch(e) { bad(res, 'Serverfehler', 500); }
});

module.exports = router;
