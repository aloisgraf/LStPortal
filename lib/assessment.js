'use strict';
// Reine, DB-freie Assessment-Logik (Ablauf, Zeitlimits, Auswertung) — von
// routes/assessment.js (DB/HTTP) getrennt, damit sie ohne Datenbank testbar
// ist (siehe test/assessment.test.mjs). Die Lösungen aus
// lib/assessment-questions.js verlassen nie den Server: publicSection()
// entfernt sie, bevor Fragen an den Client gehen.

const { SECTIONS } = require('./assessment-questions');

// Version des Fragenkatalogs. Laufende Durchgänge einer älteren Version
// passen nicht mehr zu den Abschnitten und werden verworfen; abgeschlossene
// bleiben mit ihrer gespeicherten Auswertung sichtbar.
const VERSION = 8;

// Nach Ablauf eines Abschnitts werden Abgaben noch so lange angenommen
// (Netzwerk-Latenz, automatische Abgabe des Clients bei 0:00).
const GRACE_SECONDS = 20;

const TOTAL_MINUTES = SECTIONS.reduce((s, sec) => s + sec.minutes, 0);

const questionsOf = s => s.blocks.flatMap(b => b.questions);
const isScoredType = t => t === 'choice' || t === 'number' || t === 'text' || t === 'markwords';
const isScoredSection = s => questionsOf(s).some(q => isScoredType(q.type));

// markwords: der Text wird an Leerräumen zerlegt, Wörter werden über ihren
// Index in dieser Liste angesprochen (Client und Server zerlegen gleich).
const tokenize = text => text.split(/(\s+)/);
const isWordToken = t => /\S/.test(t);
const coreWord = t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

function maxPoints(q) {
  if (q.type === 'markwords') return Object.keys(q.errors).length * 2;
  return isScoredType(q.type) ? 1 : 0;
}

function overview() {
  return SECTIONS.map(s => ({
    key: s.key, short: s.short, title: s.title, description: s.description, minutes: s.minutes,
    kind: s.kind || 'tasks', count: questionsOf(s).filter(q => q.type !== 'writing').length,
    scored: isScoredSection(s), maxPoints: questionsOf(s).reduce((n, q) => n + maxPoints(q), 0),
  }));
}

function publicQuestion(q) {
  const out = { id: q.id, type: q.type, text: q.text };
  for (const k of ['pre', 'hint', 'options', 'compact', 'drag', 'targetWords', 'lockWords', 'final', 'loose', 'unit']) if (q[k] !== undefined) out[k] = q[k];
  if (q.type === 'markwords') out.tokens = tokenize(q.passage);
  return out;
}

// Fragen ohne Lösungen für den Client.
function publicSection(idx) {
  const s = SECTIONS[idx];
  if (!s) return null;
  return {
    index: idx, key: s.key, short: s.short, title: s.title, description: s.description, minutes: s.minutes,
    kind: s.kind || 'tasks', freeOrder: !!s.freeOrder, scale: s.scale || null,
    blocks: s.blocks.map(b => ({
      key: b.key, title: b.title, instruction: b.instruction, memorize: b.memorize || null,
      questions: b.questions.map(publicQuestion),
    })),
  };
}

// Verbleibende Sekunden eines gestarteten Abschnitts (negativ = abgelaufen).
// elapsed kommt aus der Datenbank (NOW() − section_started_at), damit eine
// abweichende Uhr des Servers oder Browsers keine Rolle spielt.
function remainingSeconds(idx, elapsed) {
  const s = SECTIONS[idx];
  if (!s || elapsed === null || elapsed === undefined) return null;
  return Math.round(s.minutes * 60 - Number(elapsed));
}
// Abgelaufen inkl. Kulanzzeit: ab hier zählt nur noch der zuletzt
// zwischengespeicherte Stand.
function isExpired(idx, elapsed) {
  const r = remainingSeconds(idx, elapsed);
  return r !== null && r < -GRACE_SECONDS;
}

// Deutsche Zahleneingaben: "59,5", "1.210", "1210 €", "25 %".
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  // Einheiten und Wörter („30 Liter“, „ca. 8 min“, „22,5 %“) zählen nicht als
  // Fehler: gewertet wird die einzige Zahl in der Eingabe. Stehen mehrere
  // Zahlen da, ist die Antwort nicht eindeutig.
  const nums = v.match(/-?\d[\d.,]*/g);
  if (!nums || nums.length !== 1) return null;
  let t = nums[0].replace(/[.,]$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

const MAX_TEXT = 20000;
const MAX_LOG = 30000;

// Änderungsprotokoll eines Textfelds: [ms seit Beginn, Position, gelöscht, eingefügt].
function sanitizeLog(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw.slice(0, MAX_LOG)) {
    if (!Array.isArray(e) || e.length < 4) continue;
    const [t, p, d, i] = e;
    if (!Number.isFinite(t) || !Number.isInteger(p) || p < 0 || typeof d !== 'string' || typeof i !== 'string') continue;
    out.push([Math.max(0, Math.round(t)), p, d.slice(0, MAX_TEXT), i.slice(0, MAX_TEXT)]);
  }
  return out;
}

// Nur bekannte Fragen und gültige Werte übernehmen.
function sanitizeAnswers(idx, raw) {
  const s = SECTIONS[idx];
  const out = {};
  if (!s || !raw || typeof raw !== 'object') return out;
  for (const q of questionsOf(s)) {
    const v = raw[q.id];
    if (v === undefined || v === null || v === '') continue;
    if (q.type === 'choice') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n < q.options.length) out[q.id] = n;
    } else if (q.type === 'likert') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) out[q.id] = n;
    } else if (q.type === 'number' || q.type === 'text') {
      const str = String(v).slice(0, 80);
      if (str.trim()) out[q.id] = str;
    } else if (q.type === 'markwords') {
      if (typeof v !== 'object') continue;
      const tokens = tokenize(q.passage);
      const marks = {};
      for (const [k, c] of Object.entries(v)) {
        const i = Number(k);
        if (Number.isInteger(i) && i >= 0 && i < tokens.length && isWordToken(tokens[i])) marks[i] = String(c ?? '').slice(0, 60);
      }
      if (Object.keys(marks).length) out[q.id] = marks;
    } else if (q.type === 'writing') {
      if (typeof v !== 'object' || typeof v.text !== 'string') continue;
      out[q.id] = { text: v.text.slice(0, MAX_TEXT), log: sanitizeLog(v.log), done: v.done === true };
    }
  }
  return out;
}

// Zwischenstand zusammenführen: neuere Antworten gewinnen, ein mit
// „Abschließen“ gesperrter Text bleibt aber, wie er war.
function mergeAnswers(stored, incoming) {
  const out = { ...(stored || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (out[k] && typeof out[k] === 'object' && out[k].done) continue;
    out[k] = v;
  }
  return out;
}

const wordCount = t => (t.trim().match(/\S+/g) || []).length;

function writingStats(a) {
  const log = a.log || [];
  const corrections = log.filter(e => e[2].length > 0);
  return {
    words: wordCount(a.text), chars: a.text.length,
    seconds: log.length ? Math.round(log[log.length - 1][0] / 1000) : 0,
    corrections: corrections.length,
    deletedChars: corrections.reduce((n, e) => n + e[2].length, 0),
  };
}

function scoreMarkwords(q, marks) {
  const tokens = tokenize(q.passage);
  const found = [], falseMarks = [];
  tokens.forEach((t, i) => {
    if (!isWordToken(t)) return;
    const word = coreWord(t), right = q.errors[word];
    const given = marks?.[i];
    if (right !== undefined) {
      const marked = given !== undefined;
      found.push({ wrong: word, right, marked, given: marked ? given : null, corrected: marked && given.trim() === right });
    } else if (given !== undefined) falseMarks.push({ word, given });
  });
  const raw = found.reduce((n, f) => n + (f.marked ? 1 : 0) + (f.corrected ? 1 : 0), 0) - falseMarks.length;
  return { found, falseMarks, points: Math.max(0, raw) };
}

function scoreQuestion(q, given) {
  const max = maxPoints(q);
  if (q.type === 'choice') {
    const correct = given === q.answer;
    return { given: given === undefined ? null : q.options[given], expected: q.options[q.answer], correct, points: correct ? 1 : 0, max };
  }
  if (q.type === 'number') {
    const n = given === undefined ? null : parseNumber(given);
    const correct = n !== null && Math.abs(n - q.answer) <= (q.tol ?? 0.0001);
    return { given: given ?? null, expected: String(q.answer).replace('.', ','), correct, points: correct ? 1 : 0, max };
  }
  if (q.type === 'text') {
    const norm = t => q.loose ? t.toLowerCase().replace(/sankt/g, 'st').replace(/[^\p{L}\p{N}]/gu, '') : t.trim();
    const correct = given !== undefined && q.accept.some(a => norm(a) === norm(given));
    return { given: given ?? null, expected: q.accept.join(' / '), correct, points: correct ? 1 : 0, max };
  }
  if (q.type === 'markwords') {
    const r = scoreMarkwords(q, given);
    return { ...r, correct: r.points === max, max };
  }
  if (q.type === 'writing') {
    const a = given || { text: '', log: [], done: false };
    return { given: a.text, log: a.log, done: a.done, stats: writingStats(a), points: 0, max: 0 };
  }
  if (q.type === 'likert') return { given: given ?? null, points: 0, max: 0 };
  return { given: null, points: 0, max: 0 };
}

// Persönlichkeit: je Skala Mittelwert von 1 (Pol a) bis 5 (Pol b); bei der
// Ehrlichkeitskontrolle der Mittelwert der Zustimmung.
function scoreDims(s, answers) {
  return Object.entries(s.dims).map(([key, d]) => {
    const vals = questionsOf(s).filter(q => q.dim === key && answers[q.id] !== undefined)
      .map(q => d.control ? answers[q.id] : (q.pole === 'b' ? answers[q.id] : 6 - answers[q.id]));
    const score = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
    const out = { key, label: d.label, a: d.a || null, b: d.b || null, control: !!d.control, n: vals.length, score };
    if (d.control) out.level = score === null ? null : score >= 4.5 ? 'sehr auffällig' : score >= 3.75 ? 'auffällig' : 'unauffällig';
    return out;
  });
}

// Auswertung eines Abschnitts. late = Abgabe kam nach Ablauf der Kulanzzeit
// (dann wurde der zuletzt zwischengespeicherte Stand gewertet).
function scoreSection(idx, rawAnswers, { late = false } = {}) {
  const s = SECTIONS[idx];
  const answers = sanitizeAnswers(idx, rawAnswers);
  const qs = questionsOf(s);
  const blocks = s.blocks.map(b => ({
    key: b.key, title: b.title,
    details: b.questions.map(q => ({ id: q.id, type: q.type, text: q.text, ...(q.hint ? { hint: q.hint } : {}), ...scoreQuestion(q, answers[q.id]) })),
  }));
  for (const b of blocks) {
    b.points = b.details.reduce((n, d) => n + d.points, 0);
    b.max = b.details.reduce((n, d) => n + d.max, 0);
  }
  const points = blocks.reduce((n, b) => n + b.points, 0);
  const max = blocks.reduce((n, b) => n + b.max, 0);
  const out = {
    key: s.key, short: s.short, title: s.title, kind: s.kind || 'tasks', version: VERSION,
    scored: max > 0, late, answered: Object.keys(answers).length, total: qs.length,
    points, max, percent: max ? Math.round(points / max * 100) : null, blocks,
  };
  if (s.dims) out.dims = scoreDims(s, answers);
  return out;
}

// Nachbewertung: die Administration kann einzelne Antworten (Auswahl, Zahl,
// Freitext) abweichend werten. Die gespeicherte Auswertung bleibt unverändert,
// die Korrekturen werden beim Anzeigen darübergelegt.
const OVERRIDABLE = ['choice', 'number', 'text'];
const overrideKey = (sectionKey, qid) => `${sectionKey}/${qid}`;
function applyOverrides(results, overrides) {
  if (!overrides || !Object.keys(overrides).length) return results;
  return (results || []).map(r => {
    if (!r.blocks) return r;
    const blocks = r.blocks.map(b => {
      const details = (b.details || []).map(d => {
        const o = overrides[overrideKey(r.key, d.id)];
        if (!o || !OVERRIDABLE.includes(d.type) || o.correct === d.correct) return d;
        return { ...d, correct: o.correct, points: o.correct ? d.max : 0, override: { by: o.by, at: o.at, original: d.correct } };
      });
      return { ...b, details, points: details.reduce((n, d) => n + (d.points || 0), 0) };
    });
    const points = blocks.reduce((n, b) => n + b.points, 0);
    return { ...r, blocks, points, percent: r.max ? Math.round(points / r.max * 100) : r.percent };
  });
}

// Gesamtwert über alle bewerteten Abschnitte.
function summarize(results) {
  const scored = (results || []).filter(r => r.scored);
  const points = scored.reduce((s, r) => s + (r.points ?? r.correct ?? 0), 0);
  const max = scored.reduce((s, r) => s + (r.max ?? r.total ?? 0), 0);
  return { points, max, percent: max ? Math.round(points / max * 100) : null };
}

module.exports = {
  SECTIONS, VERSION, GRACE_SECONDS, TOTAL_MINUTES, overview, publicSection, remainingSeconds, isExpired,
  parseNumber, sanitizeAnswers, mergeAnswers, scoreSection, summarize, tokenize, coreWord, questionsOf,
  applyOverrides, overrideKey, OVERRIDABLE,
};
