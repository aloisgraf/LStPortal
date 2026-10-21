'use strict';
// Reine, DB-freie Assessment-Logik (Ablauf, Zeitlimits, Auswertung) — von
// routes/assessment.js (DB/HTTP) getrennt, damit sie ohne Datenbank testbar
// ist (siehe test/assessment.test.mjs). Die Lösungen aus
// lib/assessment-questions.js verlassen nie den Server: publicSection()
// entfernt sie, bevor Fragen an den Client gehen.

const { SECTIONS } = require('./assessment-questions');

// Nach Ablauf eines Abschnitts werden Abgaben noch so lange angenommen
// (Netzwerk-Latenz, automatische Abgabe des Clients bei 0:00).
const GRACE_SECONDS = 20;

const TOTAL_MINUTES = SECTIONS.reduce((s, sec) => s + sec.minutes, 0);

function overview() {
  return SECTIONS.map(s => ({
    key: s.key, title: s.title, description: s.description,
    minutes: s.minutes, count: s.questions.length, scored: !isLikertSection(s),
  }));
}

const isLikertSection = s => s.questions.every(q => q.type === 'likert');

// Fragen ohne Lösungen für den Client.
function publicSection(idx) {
  const s = SECTIONS[idx];
  if (!s) return null;
  return {
    index: idx, key: s.key, title: s.title, description: s.description, minutes: s.minutes,
    memorize: s.memorize || null, scale: s.scale || null,
    questions: s.questions.map(q => {
      const out = { id: q.id, type: q.type, text: q.text };
      if (q.topic) out.topic = q.topic;
      if (q.pre) out.pre = q.pre;
      if (q.passage) out.passage = q.passage;
      if (q.options) out.options = q.options;
      if (q.memory) out.memory = true;
      return out;
    }),
  };
}

// Verbleibende Sekunden eines gestarteten Abschnitts (negativ = abgelaufen).
function remainingSeconds(idx, startedAt, now = Date.now()) {
  const s = SECTIONS[idx];
  if (!s || !startedAt) return null;
  return Math.round(s.minutes * 60 - (now - new Date(startedAt).getTime()) / 1000);
}
// Abgelaufen inkl. Kulanzzeit: ab hier zählt nur noch der zuletzt
// zwischengespeicherte Stand.
function isExpired(idx, startedAt, now = Date.now()) {
  const r = remainingSeconds(idx, startedAt, now);
  return r !== null && r < -GRACE_SECONDS;
}

// Deutsche Zahleneingaben: "59,5", "1.210", "1210 €", "25 %".
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let t = v.trim().replace(/[€%\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

// Nur bekannte Fragen und gültige Werte übernehmen.
function sanitizeAnswers(idx, raw) {
  const s = SECTIONS[idx];
  const out = {};
  if (!s || !raw || typeof raw !== 'object') return out;
  for (const q of s.questions) {
    const v = raw[q.id];
    if (v === undefined || v === null || v === '') continue;
    if (q.type === 'choice') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n < q.options.length) out[q.id] = n;
    } else if (q.type === 'likert') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) out[q.id] = n;
    } else if (q.type === 'number') {
      const str = String(v).slice(0, 30);
      if (str.trim()) out[q.id] = str;
    }
  }
  return out;
}

function isCorrect(q, given) {
  if (given === undefined) return false;
  if (q.type === 'choice') return given === q.answer;
  if (q.type === 'number') {
    const n = parseNumber(given);
    return n !== null && Math.abs(n - q.answer) <= (q.tol ?? 0.0001);
  }
  return false;
}

// Auswertung eines Abschnitts. late = Abgabe kam nach Ablauf der Kulanzzeit
// (dann wurde der zuletzt zwischengespeicherte Stand gewertet).
function scoreSection(idx, rawAnswers, { late = false } = {}) {
  const s = SECTIONS[idx];
  const answers = sanitizeAnswers(idx, rawAnswers);
  const answered = Object.keys(answers).length;
  if (isLikertSection(s)) {
    const sums = {};
    for (const q of s.questions) {
      const v = answers[q.id];
      if (v === undefined) continue;
      const val = q.reverse ? 6 - v : v;
      (sums[q.dim] ||= { sum: 0, n: 0 });
      sums[q.dim].sum += val; sums[q.dim].n++;
    }
    const dims = Object.entries(s.dims).map(([key, label]) => ({
      key, label, n: sums[key]?.n || 0,
      score: sums[key]?.n ? Math.round(sums[key].sum / sums[key].n * 10) / 10 : null,
    }));
    return {
      key: s.key, title: s.title, scored: false, late, answered, total: s.questions.length, dims,
      details: s.questions.map(q => ({ id: q.id, text: q.text, given: answers[q.id] ?? null, reverse: !!q.reverse, dim: q.dim })),
    };
  }
  const details = s.questions.map(q => ({
    id: q.id, topic: q.topic, text: q.text,
    given: answers[q.id] === undefined ? null : (q.type === 'choice' ? q.options[answers[q.id]] : answers[q.id]),
    expected: q.type === 'choice' ? q.options[q.answer] : String(q.answer).replace('.', ','),
    correct: isCorrect(q, answers[q.id]),
  }));
  const correct = details.filter(d => d.correct).length;
  return {
    key: s.key, title: s.title, scored: true, late, answered, total: s.questions.length, correct,
    percent: Math.round(correct / s.questions.length * 100), details,
  };
}

// Gesamtwert über alle bewerteten Abschnitte (Persönlichkeit zählt nicht).
function summarize(results) {
  const scored = (results || []).filter(r => r.scored);
  const correct = scored.reduce((s, r) => s + r.correct, 0);
  const total = scored.reduce((s, r) => s + r.total, 0);
  return { correct, total, percent: total ? Math.round(correct / total * 100) : null };
}

module.exports = {
  SECTIONS, GRACE_SECONDS, TOTAL_MINUTES, overview, publicSection, remainingSeconds, isExpired,
  parseNumber, sanitizeAnswers, scoreSection, summarize,
};
