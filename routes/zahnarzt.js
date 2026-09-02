'use strict';
const router  = require('express').Router();
const { pool, q, q1, newId, logAct } = require('../db');
const { auth, ok, bad } = require('../middleware');

// ── helpers ──────────────────────────────────────────────────────
function excelDateToISO(serial) {
  // Excel date serial → YYYY-MM-DD (base: Dec 30, 1899)
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().slice(0,10);
}

function canEdit(req) { return true; } // all authenticated users can edit entries

const isTechnik = req =>
  (Array.isArray(req.p.roles) ? req.p.roles : []).some(r =>
    ['admin','technik','leitung','dienstplanung'].includes(r));

// ── GET all entries ───────────────────────────────────────────────
router.get('/dienste', auth, async (req,res) => {
  try {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM zahnarzt_dienste';
    const params = [];
    if (from && to) {
      sql += ' WHERE datum BETWEEN $1 AND $2';
      params.push(from, to);
    } else if (from) {
      sql += ' WHERE datum >= $1';
      params.push(from);
    }
    sql += ' ORDER BY datum, bezirk, zahnarzt';
    const rows = await q(sql, params);
    ok(res, rows.map(r => ({
      id: r.id, bezirk: r.bezirk,
      datum: r.datum instanceof Date ? r.datum.toISOString().slice(0,10) : String(r.datum).slice(0,10),
      tag: r.tag, uhrzeit: r.uhrzeit, erreichbarkeit: r.erreichbarkeit,
      zahnarzt: r.zahnarzt, createdBy: r.created_by,
    })));
  } catch(e) { bad(res, e.message, 500); }
});

// ── POST single entry ─────────────────────────────────────────────
router.post('/dienste', auth, async (req,res) => {
  try {
    if (!isTechnik(req)) return bad(res,'Keine Berechtigung',403);
    const { bezirk, datum, tag, uhrzeit, erreichbarkeit, zahnarzt } = req.body;
    if (!bezirk || !datum || !zahnarzt) return bad(res,'bezirk, datum und zahnarzt erforderlich');
    const id = newId();
    await pool.query(
      'INSERT INTO zahnarzt_dienste (id,bezirk,datum,tag,uhrzeit,erreichbarkeit,zahnarzt,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, bezirk, datum, tag||'', uhrzeit||'', erreichbarkeit||'', zahnarzt, req.uid]
    );
    await logAct(req.uid, req.user.name, 'zahnarzt_create', { bezirk, datum, zahnarzt });
    ok(res, { id });
  } catch(e) { bad(res, e.message, 500); }
});

// ── PUT update entry (all users) ──────────────────────────────────
router.put('/dienste/:id', auth, async (req,res) => {
  try {
    const { bezirk, datum, tag, uhrzeit, erreichbarkeit, zahnarzt } = req.body;
    await pool.query(
      'UPDATE zahnarzt_dienste SET bezirk=$1,datum=$2,tag=$3,uhrzeit=$4,erreichbarkeit=$5,zahnarzt=$6,updated_at=NOW() WHERE id=$7',
      [bezirk, datum, tag||'', uhrzeit||'', erreichbarkeit||'', zahnarzt, req.params.id]
    );
    await logAct(req.uid, req.user.name, 'zahnarzt_edit', { id: req.params.id, zahnarzt });
    ok(res);
  } catch(e) { bad(res, e.message, 500); }
});

// ── DELETE entry ──────────────────────────────────────────────────
router.delete('/dienste/:id', auth, async (req,res) => {
  try {
    if (!isTechnik(req)) return bad(res,'Keine Berechtigung',403);
    await pool.query('DELETE FROM zahnarzt_dienste WHERE id=$1',[req.params.id]);
    ok(res);
  } catch(e) { bad(res, e.message, 500); }
});

// ── POST upload Excel ─────────────────────────────────────────────
router.post('/upload', auth, async (req,res) => {
  try {
    if (!isTechnik(req)) return bad(res,'Keine Berechtigung',403);
    const { fileData, fileName, replaceExisting } = req.body;
    if (!fileData) return bad(res,'Keine Datei');

    const XLSX = require('xlsx');
    const buf  = Buffer.from(fileData, 'base64');
    const wb   = XLSX.read(buf, { type:'buffer', cellDates:false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

    if (!rows.length) return bad(res,'Leere Datei');

    // Detect header row (first row with >=4 non-empty cells)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (rows[i].filter(Boolean).length >= 4) { headerIdx = i; break; }
    }
    const header = rows[headerIdx].map(h => String(h).toLowerCase().trim());
    const col = name => header.findIndex(h => h.includes(name));

    const cBezirk = col('bezirk');
    const cDatum  = col('datum') !== -1 ? col('datum') : col('date');
    const cTag    = col('tag');
    const cUhr    = col('uhrzeit') !== -1 ? col('uhrzeit') : col('uhr');
    const cErr    = col('erreichbarkeit') !== -1 ? col('erreichbarkeit') : col('telefon');
    const cZahn   = col('zahnarzt') !== -1 ? col('zahnarzt') : col('arzt');

    if (cBezirk === -1 || cDatum === -1 || cZahn === -1)
      return bad(res,'Spalten Bezirk, Datum, Zahnarzt nicht gefunden');

    const entries = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = row[cDatum];
      if (!rawDate || !row[cZahn]) continue;

      let datum;
      if (typeof rawDate === 'number') {
        datum = excelDateToISO(rawDate);
      } else {
        const s = String(rawDate).trim();
        // Try DD.MM.YYYY or YYYY-MM-DD
        const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        datum = m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : s.slice(0,10);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

      entries.push({
        id: newId(),
        bezirk: String(cBezirk !== -1 ? row[cBezirk] : '').trim(),
        datum,
        tag: String(cTag !== -1 ? row[cTag] : '').trim(),
        uhrzeit: String(cUhr !== -1 ? row[cUhr] : '').trim(),
        erreichbarkeit: String(cErr !== -1 ? row[cErr] : '').trim(),
        zahnarzt: String(row[cZahn]).trim(),
      });
    }

    if (!entries.length) return bad(res,'Keine gültigen Einträge gefunden');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (replaceExisting) {
        const dates = [...new Set(entries.map(e => e.datum))];
        for (const d of dates)
          await client.query('DELETE FROM zahnarzt_dienste WHERE datum=$1',[d]);
      }
      for (const e of entries) {
        await client.query(
          'INSERT INTO zahnarzt_dienste (id,bezirk,datum,tag,uhrzeit,erreichbarkeit,zahnarzt,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [e.id,e.bezirk,e.datum,e.tag,e.uhrzeit,e.erreichbarkeit,e.zahnarzt,req.uid]
        );
      }
      await client.query('COMMIT');
    } catch(err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }

    await logAct(req.uid, req.user.name, 'zahnarzt_upload', { count: entries.length, fileName });
    ok(res, { count: entries.length });
  } catch(e) { bad(res, e.message, 500); }
});

module.exports = router;
