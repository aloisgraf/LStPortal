import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../lib/assessment');
const { SECTIONS } = A;

describe('Fragenkatalog', () => {
  it('dauert insgesamt 45 Minuten', () => {
    expect(A.TOTAL_MINUTES).toBe(45);
  });
  it('enthält die fünf Teile in der vorgesehenen Reihenfolge', () => {
    expect(SECTIONS.map(s => s.key)).toEqual(['kognitiv', 'mathe', 'sprache', 'englisch', 'persoenlichkeit']);
  });
  it('hat eindeutige Frage-IDs und gültige Lösungen', () => {
    const ids = new Set();
    for (const s of SECTIONS) for (const q of s.questions) {
      expect(ids.has(q.id), q.id).toBe(false); ids.add(q.id);
      if (q.type === 'choice') {
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id).toBe(true);
        expect(new Set(q.options).size, q.id + ' doppelte Optionen').toBe(q.options.length);
      } else if (q.type === 'number') expect(typeof q.answer, q.id).toBe('number');
      else if (q.type === 'likert') expect(Object.keys(s.dims)).toContain(q.dim);
      else throw new Error('Unbekannter Typ ' + q.type);
    }
  });
  it('Merkfragen kommen am Ende ihres Abschnitts', () => {
    const k = SECTIONS[0].questions;
    const firstMem = k.findIndex(q => q.memory);
    expect(firstMem).toBeGreaterThan(0);
    expect(k.slice(firstMem).every(q => q.memory)).toBe(true);
  });
  it('Rechen-Lösungen stimmen', () => {
    const ans = Object.fromEntries(SECTIONS[1].questions.map(q => [q.id, q.answer]));
    expect(ans.m1).toBe(17 * 6);
    expect(ans.m2).toBe(144 / 12 + 7 * 3);
    expect(ans.m5).toBe(4 * 9 / 6);
    expect(ans.m6).toBe(240 * 0.85);
    expect(ans.m9).toBeCloseTo(1000 * 1.1 * 1.1);
    expect(ans.m10).toBe(18 / 72 * 60);
    expect(ans.m13).toBe((420 + 380 + 455 + 545) / 4);
  });
});

describe('publicSection — keine Lösungen an den Client', () => {
  it('entfernt answer, tol, dim und reverse', () => {
    for (let i = 0; i < SECTIONS.length; i++) {
      const json = JSON.stringify(A.publicSection(i));
      expect(json).not.toMatch(/"answer"|"tol"|"dim"|"reverse"/);
    }
  });
  it('liefert null für unbekannte Abschnitte', () => {
    expect(A.publicSection(99)).toBeNull();
  });
});

describe('Zeitlimit', () => {
  const start = new Date('2026-01-01T10:00:00Z');
  it('verbleibende Zeit sinkt ab Start', () => {
    expect(A.remainingSeconds(0, start, start.getTime())).toBe(12 * 60);
    expect(A.remainingSeconds(0, start, start.getTime() + 60000)).toBe(11 * 60);
  });
  it('gilt erst nach der Kulanzzeit als abgelaufen', () => {
    const end = start.getTime() + 12 * 60000;
    expect(A.isExpired(0, start, end + (A.GRACE_SECONDS - 1) * 1000)).toBe(false);
    expect(A.isExpired(0, start, end + (A.GRACE_SECONDS + 1) * 1000)).toBe(true);
  });
});

describe('parseNumber — deutsche Eingaben', () => {
  it.each([['59,5', 59.5], ['1.210', 1210], ['1210 €', 1210], ['25 %', 25], ['33', 33], ['59.5', 59.5], ['abc', null], ['', null]])('%s → %s', (inp, out) => {
    expect(A.parseNumber(inp)).toBe(out);
  });
});

describe('scoreSection', () => {
  it('zählt richtige Antworten und ignoriert unbekannte/ungültige', () => {
    const r = A.scoreSection(1, { m1: '102', m2: '34', m3: 3, m11: '59,5', m9: '1.210', bogus: 1, m14: 99 });
    expect(r.scored).toBe(true);
    expect(r.correct).toBe(4);
    expect(r.answered).toBe(5);
    expect(r.details.find(d => d.id === 'm2')).toMatchObject({ correct: false, given: '34', expected: '33' });
    expect(r.details.find(d => d.id === 'm14').given).toBeNull();
  });
  it('alle richtigen Antworten ergeben 100 %', () => {
    for (let i = 0; i < 4; i++) {
      const all = Object.fromEntries(SECTIONS[i].questions.map(q => [q.id, q.type === 'number' ? String(q.answer) : q.answer]));
      expect(A.scoreSection(i, all).percent, SECTIONS[i].key).toBe(100);
    }
  });
  it('Persönlichkeit: Mittelwerte je Dimension mit umgepolten Aussagen', () => {
    const ans = {};
    for (const q of SECTIONS[4].questions) ans[q.id] = q.reverse ? 1 : 5;
    const r = A.scoreSection(4, ans);
    expect(r.scored).toBe(false);
    expect(r.dims.every(d => d.score === 5)).toBe(true);
    const r2 = A.scoreSection(4, {});
    expect(r2.dims.every(d => d.score === null)).toBe(true);
  });
  it('summarize zählt Persönlichkeit nicht mit', () => {
    const res = [A.scoreSection(1, { m1: '102' }), A.scoreSection(4, { p1: 5 })];
    expect(A.summarize(res)).toEqual({ correct: 1, total: 15, percent: 7 });
  });
});
