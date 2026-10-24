'use strict';
// Versionierter Fragenkatalog des Assessments. Die Administration bearbeitet
// den Katalog im Portal; jedes Speichern mit Änderungen legt eine neue Version
// an (Tabelle assessment_catalogs). Ein Durchgang bleibt bei der Version, mit
// der er begonnen wurde, deshalb hält catalogOf() alle Versionen bereit.
//
// normalizeCatalog() ist DB-frei (test/assessment-catalog.test.mjs): sie prüft
// einen bearbeiteten Katalog gegen den aktuellen und liefert ihn bereinigt
// zurück oder wirft einen Fehler mit der Stelle, an der etwas nicht passt.

const A = require('./assessment');

const isStr = v => typeof v === 'string';
const str = (v, max = 5000) => (isStr(v) ? v : '').slice(0, max);
const strList = v => (Array.isArray(v) ? v.filter(isStr).map(x => x.trim()).filter(Boolean) : []);

function fail(where, msg) { throw new Error(`${where}: ${msg}`); }

function normalizeQuestion(q, where) {
  if (!q || typeof q !== 'object') fail(where, 'ungültige Frage');
  if (!isStr(q.id) || !/^[A-Za-z0-9_-]{1,40}$/.test(q.id)) fail(where, 'ungültige Frage-ID');
  const out = { ...q, text: str(q.text, 2000).trim() };
  if (!out.text && q.type !== 'writing') fail(where, 'Fragetext fehlt');
  if (q.hint !== undefined) out.hint = str(q.hint, 500);
  if (q.pre !== undefined) out.pre = str(q.pre, 2000);
  if (q.unit !== undefined) out.unit = str(q.unit, 30);
  switch (q.type) {
    case 'choice': {
      out.options = strList(q.options);
      if (out.options.length < 2) fail(where, 'mindestens zwei Antwortmöglichkeiten nötig');
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= out.options.length) fail(where, 'richtige Antwort auswählen');
      break;
    }
    case 'number': {
      const n = typeof q.answer === 'number' ? q.answer : A.parseNumber(String(q.answer ?? ''));
      if (n === null || !Number.isFinite(n)) fail(where, 'Lösung muss eine Zahl sein');
      out.answer = n;
      if (q.tol !== undefined && q.tol !== null && q.tol !== '') {
        const t = typeof q.tol === 'number' ? q.tol : A.parseNumber(String(q.tol));
        if (t === null || t < 0) fail(where, 'Toleranz muss eine Zahl ≥ 0 sein');
        out.tol = t;
      } else delete out.tol;
      break;
    }
    case 'text': {
      out.accept = strList(q.accept);
      if (!out.accept.length) fail(where, 'mindestens eine richtige Antwort nötig');
      if (q.open) {
        if (q.keywords !== undefined && q.keywords !== null) {
          // Kombinationen → Gruppen → gleichwertige Wörter
          const kw = Array.isArray(q.keywords) ? q.keywords.map(c => (Array.isArray(c) ? c.map(strList).filter(g => g.length) : [])).filter(c => c.length) : [];
          if (kw.length) out.keywords = kw; else delete out.keywords;
        }
        if (q.digits !== undefined && q.digits !== null && q.digits !== '') {
          const d = String(q.digits).replace(/\D/g, '');
          if (d) out.digits = d; else delete out.digits;
        } else delete out.digits;
      }
      break;
    }
    case 'markwords': {
      out.passage = str(q.passage, 20000);
      if (!out.passage.trim()) fail(where, 'Text fehlt');
      const errors = {};
      for (const [k, v] of Object.entries(q.errors && typeof q.errors === 'object' ? q.errors : {})) {
        const w = String(k).trim(), r = String(v ?? '').trim();
        if (w && r) errors[w] = r;
      }
      if (!Object.keys(errors).length) fail(where, 'mindestens ein Fehlerwort nötig');
      const words = new Set(A.tokenize(out.passage).map(A.coreWord));
      const missing = Object.keys(errors).filter(w => !words.has(w));
      if (missing.length) fail(where, `Fehlerwort nicht im Text: ${missing.join(', ')}`);
      out.errors = errors;
      break;
    }
    case 'writing': {
      if (q.targetWords !== undefined) {
        const t = Number(q.targetWords);
        if (!Number.isInteger(t) || t < 1 || t > 5000) fail(where, 'Zielwortzahl ungültig');
        out.targetWords = t;
      }
      break;
    }
    case 'likert': break;
    default: fail(where, `unbekannter Fragetyp ${q.type}`);
  }
  return out;
}

function normalizeCatalog(sections, current) {
  if (!Array.isArray(sections) || sections.length !== current.length) throw new Error('Die Abschnitte passen nicht zum aktuellen Katalog');
  const ids = new Set();
  return sections.map((s, si) => {
    const base = current[si];
    const where = `Abschnitt ${si + 1} (${base.title})`;
    if (!s || s.key !== base.key) fail(where, 'Reihenfolge oder Schlüssel der Abschnitte geändert');
    const minutes = Number(s.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) fail(where, 'Minuten müssen eine ganze Zahl von 1 bis 180 sein');
    const out = { ...s, key: base.key, kind: base.kind, title: str(s.title, 200).trim() || base.title, description: str(s.description, 3000), minutes };
    if (base.short) out.short = str(s.short, 40).trim() || base.short;
    if (!Array.isArray(s.blocks)) fail(where, 'Blöcke fehlen');
    out.blocks = s.blocks.map((b, bi) => {
      const bw = `${where}, Block ${bi + 1}`;
      if (!b || typeof b !== 'object') fail(bw, 'ungültiger Block');
      const ob = { ...b, title: str(b.title, 200), instruction: str(b.instruction, 3000) };
      if (b.video !== undefined && b.video !== null) {
        const v = str(b.video, 40).trim();
        if (v && !/^[A-Za-z0-9_-]{6,20}$/.test(v)) fail(bw, 'YouTube-ID ungültig');
        if (v) ob.video = v; else delete ob.video;
      }
      if (b.memorize) {
        const sec = Number(b.memorize.seconds);
        if (!Number.isInteger(sec) || sec < 5 || sec > 600) fail(bw, 'Merkzeit muss 5 bis 600 Sekunden sein');
        ob.memorize = { seconds: sec, text: str(b.memorize.text, 500), facts: strList(b.memorize.facts) };
      }
      if (!Array.isArray(b.questions)) fail(bw, 'Fragen fehlen');
      ob.questions = b.questions.map((q, qi) => {
        const qw = `${bw}, Frage ${qi + 1}`;
        const nq = normalizeQuestion(q, qw);
        if (ids.has(nq.id)) fail(qw, `Frage-ID ${nq.id} doppelt`);
        ids.add(nq.id);
        return nq;
      });
      return ob;
    });
    if (base.kind !== 'pause' && !out.blocks.some(b => b.questions.length)) fail(where, 'mindestens eine Frage nötig');
    return out;
  });
}

// ── Speicher ────────────────────────────────────────────────────────────────
// Alle Versionen liegen im Speicher (der Katalog ist klein), nach jedem
// Speichern wird neu geladen.
const store = { versions: new Map(), meta: [], latest: A.CODE_VERSION };
const codeCatalog = A;

async function loadCatalogs(pool) {
  // Erster Start: der Katalog aus dem Code wird Version CODE_VERSION.
  await pool.query(`INSERT INTO assessment_catalogs (version, sections, created_by, note)
    SELECT $1, $2, 'System', 'Ausgangsstand' WHERE NOT EXISTS (SELECT 1 FROM assessment_catalogs)`,
    [A.CODE_VERSION, JSON.stringify(A.CODE_SECTIONS)]);
  const r = await pool.query('SELECT version, sections, created_at, created_by, note FROM assessment_catalogs ORDER BY version');
  const versions = new Map();
  for (const row of r.rows) {
    try { versions.set(row.version, A.createCatalog(JSON.parse(row.sections), row.version)); }
    catch (e) { console.error('[assessment-catalog] Version', row.version, e.message); }
  }
  if (!versions.size) versions.set(A.CODE_VERSION, codeCatalog);
  store.versions = versions;
  store.meta = r.rows.map(x => ({ version: x.version, createdAt: x.created_at, createdBy: x.created_by, note: x.note }));
  store.latest = Math.max(...versions.keys());
}

const latest = () => store.versions.get(store.latest) || codeCatalog;
const catalogOf = v => store.versions.get(v) || null;
const hasCatalog = v => store.versions.has(v);
const catalogVersions = () => store.meta.slice().reverse();

// Speichert eine neue Version, wenn sich etwas geändert hat.
async function saveCatalog(pool, sections, { by, note }) {
  const cur = latest();
  const clean = normalizeCatalog(sections, cur.SECTIONS);
  if (JSON.stringify(clean) === JSON.stringify(normalizeCatalog(cur.SECTIONS, cur.SECTIONS))) return { changed: false, version: cur.VERSION };
  const r = await pool.query(`INSERT INTO assessment_catalogs (version, sections, created_by, note)
    SELECT COALESCE(MAX(version), 0) + 1, $1, $2, $3 FROM assessment_catalogs RETURNING version`,
    [JSON.stringify(clean), by || '', str(note, 300)]);
  await loadCatalogs(pool);
  return { changed: true, version: r.rows[0].version };
}

module.exports = { normalizeCatalog, loadCatalogs, latest, catalogOf, hasCatalog, catalogVersions, saveCatalog };
