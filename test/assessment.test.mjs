import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../lib/assessment');
const { SECTIONS } = A;
const idx = key => SECTIONS.findIndex(s => s.key === key);
const qs = key => A.questionsOf(SECTIONS[idx(key)]);

describe('Fragenkatalog', () => {
  it('dauert insgesamt 88 Minuten', () => {
    expect(A.TOTAL_MINUTES).toBe(88);
  });
  it('hat die vorgegebene Reihenfolge mit der Pause an Position 5', () => {
    expect(SECTIONS.map(s => s.key)).toEqual(['rechtschreibung', 'geografie', 'it', 'motivation', 'pause', 'englisch', 'logik', 'merken', 'rechnen', 'persoenlichkeit', 'abschrift']);
    expect(SECTIONS[4].kind).toBe('pause');
    expect(SECTIONS[4].minutes).toBe(5);
  });
  it('enthält die Aufgabenzahlen laut Vorgabe', () => {
    const count = key => qs(key).length;
    expect(count('geografie')).toBe(35);
    expect(count('it')).toBe(25);
    expect(count('englisch')).toBe(36);
    expect(count('logik')).toBe(20);
    expect(count('merken')).toBe(5);
    expect(count('rechnen')).toBe(40);
    expect(count('persoenlichkeit')).toBe(40);
    expect(A.overview().find(s => s.key === 'rechtschreibung').maxPoints).toBe(40);
  });
  it('hat eindeutige Frage-IDs und gültige Lösungen', () => {
    const ids = new Set();
    for (const s of SECTIONS) for (const q of A.questionsOf(s)) {
      expect(ids.has(q.id), q.id).toBe(false); ids.add(q.id);
      if (q.type === 'choice') {
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id).toBe(true);
        expect(new Set(q.options).size, q.id + ' doppelte Optionen').toBe(q.options.length);
      } else if (q.type === 'number') expect(typeof q.answer, q.id).toBe('number');
      else if (q.type === 'text') expect(q.accept.length, q.id).toBeGreaterThan(0);
      else if (q.type === 'likert') expect(Object.keys(s.dims)).toContain(q.dim);
      else if (!['markwords', 'writing'].includes(q.type)) throw new Error('Unbekannter Typ ' + q.type);
    }
  });
  it('jedes der 10 Protokollfehler-Wörter kommt genau einmal im Text vor', () => {
    const q = qs('rechtschreibung').find(x => x.type === 'markwords');
    const words = A.tokenize(q.passage).map(A.coreWord);
    for (const w of Object.keys(q.errors)) expect(words.filter(x => x === w).length, w).toBe(1);
    expect(Object.keys(q.errors).length).toBe(10);
  });
  it('englisches Protokoll: 10 Fehlerwörter, jedes genau einmal', () => {
    const q = qs('englisch').find(x => x.type === 'markwords');
    const words = A.tokenize(q.passage).map(A.coreWord);
    for (const w of Object.keys(q.errors)) expect(words.filter(x => x === w).length, w).toBe(1);
    expect(Object.keys(q.errors).length).toBe(10);
    expect(A.overview().find(s => s.key === 'englisch').maxPoints).toBe(55);
  });
  it('Persönlichkeit: je Skala 6 Aussagen, beide Pole vertreten, 4 Kontrollfragen', () => {
    const s = SECTIONS[idx('persoenlichkeit')];
    for (const [k, d] of Object.entries(s.dims)) {
      const items = qs('persoenlichkeit').filter(q => q.dim === k);
      if (d.control) { expect(items.length).toBe(4); continue; }
      expect(items.length, k).toBe(6);
      expect(new Set(items.map(q => q.pole)), k).toEqual(new Set(['a', 'b']));
    }
  });
  it('schwere Zahlenreihen stimmen', () => {
    const ans = Object.fromEntries(qs('logik').map(q => [q.id, q.answer]));
    expect(ans.z10).toBe(52 + 48);
    expect(ans.z11).toBe(31 + 5 * 5);
    expect(ans.z12).toBe(11 * 12);
    expect(ans.z13).toBe(64 - 1);
    expect(ans.z14).toBe(5 ** 5);
  });
  it('Grundrechnungsarten stimmen', () => {
    const ans = Object.fromEntries(qs('rechnen').map(q => [q.id, q.answer]));
    const calc = { mr3: 289 + 315, mr4: 1450 + 780, mr8: 1000 - 456, mr9: 812 - 379, mr13: 25 * 16, mr19: 1200 / 25, mr20: 91 / 13, mr23: 10 ** 3, mr24: Math.sqrt(81), mr26: 3 + 4 * 2, mr27: 20 - 6 / 2, mr28: 5 * 3 + 2 * 4, mr29: 18 / 3 - 1, mr30: 10 + 2 * 5 - 4 };
    for (const [k, v] of Object.entries(calc)) expect(ans[k], k).toBe(v);
    expect(Object.keys(ans).filter(k => k.startsWith('mr')).length).toBe(30);
  });
  it('Rechen-Lösungen stimmen', () => {
    const ans = Object.fromEntries(qs('rechnen').map(q => [q.id, q.answer]));
    expect(ans.r8).toBe(240 * 0.85);
    expect(ans.r9).toBe(5 * 72);
    expect(ans.r10).toBe(18 / 80 * 100);
    expect(ans.r14).toBe(12 / 90 * 60);
    expect(ans.r15).toBe(12 * 60 - 40);
  });
});

describe('publicSection — keine Lösungen an den Client', () => {
  it('entfernt answer, accept, errors, tol, dim und pole', () => {
    for (let i = 0; i < SECTIONS.length; i++) {
      const json = JSON.stringify(A.publicSection(i));
      expect(json).not.toMatch(/"answer"|"accept"|"errors"|"tol"|"dim"|"pole"|"passage"/);
    }
  });
  it('liefert den Protokolltext als Wortliste', () => {
    const sec = A.publicSection(idx('rechtschreibung'));
    expect(sec.freeOrder).toBe(true);
    expect(sec.blocks[0].questions[0].tokens.join('')).toContain('Verkehrsunfal');
  });
  it('liefert null für unbekannte Abschnitte', () => {
    expect(A.publicSection(99)).toBeNull();
  });
});

describe('Zeitlimit (vergangene Sekunden aus der Datenbank)', () => {
  it('verbleibende Zeit sinkt ab Start', () => {
    expect(A.remainingSeconds(0, 0)).toBe(8 * 60);
    expect(A.remainingSeconds(0, 60)).toBe(7 * 60);
    expect(A.remainingSeconds(0, null)).toBeNull();
  });
  it('gilt erst nach der Kulanzzeit als abgelaufen', () => {
    expect(A.isExpired(0, 8 * 60 + A.GRACE_SECONDS - 1)).toBe(false);
    expect(A.isExpired(0, 8 * 60 + A.GRACE_SECONDS + 1)).toBe(true);
  });
});

describe('parseNumber — deutsche Eingaben', () => {
  it.each([['59,5', 59.5], ['1.210', 1210], ['1210 €', 1210], ['25 %', 25], ['33', 33], ['59.5', 59.5], ['abc', null], ['', null], ['30 Liter', 30], ['ca. 8 min', 8], ['22,5 %', 22.5], ['12 Std 30 min', null]])('%s → %s', (inp, out) => {
    expect(A.parseNumber(inp)).toBe(out);
  });
});

describe('Zwischenstand', () => {
  it('neuere Antworten gewinnen, abgeschlossene Texte bleiben gesperrt', () => {
    const merged = A.mergeAnswers({ g1: 0, mo1: { text: 'fertig', log: [], done: true } }, { g1: 2, mo1: { text: 'geändert', log: [], done: false } });
    expect(merged.g1).toBe(2);
    expect(merged.mo1.text).toBe('fertig');
  });
  it('übernimmt Textprotokolle nur in gültiger Form', () => {
    const i = idx('motivation');
    const a = A.sanitizeAnswers(i, { mo1: { text: 'Hallo', log: [[100, 0, '', 'H'], ['x', 0, '', 'a'], [200, 1, '', 'allo']], done: true } });
    expect(a.mo1).toEqual({ text: 'Hallo', log: [[100, 0, '', 'H'], [200, 1, '', 'allo']], done: true });
  });
});

describe('scoreSection', () => {
  it('Rechtschreibung: Punkte fürs Markieren, Verbessern und Abzug für falsche Markierungen', () => {
    const i = idx('rechtschreibung');
    const q = qs('rechtschreibung').find(x => x.type === 'markwords');
    const tokens = A.tokenize(q.passage);
    const at = w => tokens.findIndex(t => A.coreWord(t) === w);
    const r = A.scoreSection(i, {
      rs1: { [at('Verkehrsunfal')]: 'Verkehrsunfall', [at('Bensin')]: 'Bensin', [at('Motorrad')]: 'Motorrad' },
      sw1: 1, sw2: 1, lt1: 'Reanimation', lt8: 'kohlenmonoxid',
    });
    const mw = r.blocks[0].details[0];
    expect(mw.points).toBe(2 + 1 - 1);
    expect(mw.falseMarks.map(f => f.word)).toEqual(['Motorrad']);
    expect(r.points).toBe(2 + 1 + 1);
    expect(r.max).toBe(40);
  });
  it('Protokollaufgabe fällt nie unter 0 Punkte', () => {
    const i = idx('rechtschreibung');
    const tokens = A.tokenize(qs('rechtschreibung')[0].passage);
    const marks = {}; tokens.forEach((t, n) => { if (/\S/.test(t) && n < 40) marks[n] = ''; });
    expect(A.scoreSection(i, { rs1: marks }).blocks[0].details[0].points).toBe(0);
  });
  it('alle richtigen Antworten ergeben 100 %', () => {
    SECTIONS.forEach((s, i) => {
      if (!A.overview()[i].scored) return;
      const all = {};
      for (const q of A.questionsOf(s)) {
        if (q.type === 'number') all[q.id] = String(q.answer).replace('.', ',');
        else if (q.type === 'choice') all[q.id] = q.answer;
        else if (q.type === 'text') all[q.id] = q.accept[0];
        else if (q.type === 'markwords') {
          const tokens = A.tokenize(q.passage);
          all[q.id] = Object.fromEntries(tokens.map((t, n) => [n, q.errors[A.coreWord(t)]]).filter(([, v]) => v));
        }
      }
      expect(A.scoreSection(i, all).percent, s.key).toBe(100);
    });
  });
  it('Persönlichkeit: Pol a ergibt 1, Pol b ergibt 5, Kontrolle wird markiert', () => {
    const i = idx('persoenlichkeit');
    const ans = {};
    for (const q of qs('persoenlichkeit')) ans[q.id] = q.pole === 'a' ? 5 : q.pole === 'b' ? 1 : 5;
    const r = A.scoreSection(i, ans);
    expect(r.scored).toBe(false);
    for (const d of r.dims) {
      if (d.control) expect(d.level).toBe('sehr auffällig');
      else expect(d.score, d.key).toBe(1);
    }
    expect(A.scoreSection(i, {}).dims.every(d => d.score === null)).toBe(true);
  });
  it('Texte: Statistik aus dem Änderungsprotokoll', () => {
    const r = A.scoreSection(idx('abschrift'), { ab1: { text: 'Die Leitstelle', log: [[0, 0, '', 'Die Leitstele'], [5000, 12, 'e', ''], [9000, 12, '', 'le']], done: true } });
    const d = r.blocks[0].details[0];
    expect(d.stats).toMatchObject({ words: 2, chars: 14, corrections: 1, deletedChars: 1, seconds: 9 });
    expect(d.done).toBe(true);
    expect(r.scored).toBe(false);
  });
  it('Kürzel-Abschlussfragen: Freitext tolerant bei Schreibweise', () => {
    const r = A.scoreSection(idx('geografie'), { gk1: 'salzburg umgebung', gk2: 'Sankt Johann im Pongau', gk3: 'Tamsweg ', gk4: 'Halein', gk5: 'zell am see' });
    expect(r.blocks[1].details.map(d => d.correct)).toEqual([true, true, true, false, true]);
  });
  it('Notruf-Video: offene Antworten über Stichwörter', () => {
    const i = idx('englisch');
    const ok = (id, t) => A.scoreSection(i, { [id]: t }).blocks[2].details.find(d => d.id === id).correct;
    expect(ok('nr1', '515 780 5613')).toBe(true);
    expect(ok('nr1', '515-780-561')).toBe(false);
    expect(ok('nr2', '8505 Harbaugh Blvd')).toBe(true);
    expect(ok('nr2', 'Harbaugh Boulevard')).toBe(false);
    expect(ok('nr3', 'Male, around 60 years')).toBe(true);
    expect(ok('nr3', 'female, 60')).toBe(false);
    expect(ok('nr4', 'middle of the chest')).toBe(true);
    expect(ok('nr5', 'two per second')).toBe(true);
    expect(ok('nr5', '120 per minute')).toBe(true);
    expect(ok('nr5', '100 per minute')).toBe(false);
    expect(ok('nr6', 'an AED')).toBe(true);
    expect(ok('nr7', "No, she didn't")).toBe(true);
    expect(ok('nr7', 'Yes')).toBe(false);
    expect(ok('nr8', 'she is alone')).toBe(true);
    expect(ok('nr9', 'Harbach Center, a library')).toBe(true);
    expect(ok('nr9', 'a library')).toBe(false);
    expect(ok('nr10', 'no shock')).toBe(true);
    expect(A.scoreSection(i, {}).blocks[2].details[0].expected).toBe('515-780-5613');
  });
  it('summarize zählt nur bewertete Abschnitte', () => {
    const res = [A.scoreSection(idx('geografie'), { g1: 0 }), A.scoreSection(idx('persoenlichkeit'), { p1: 5 })];
    expect(A.summarize(res)).toEqual({ points: 1, max: 35, percent: 3 });
  });
});

describe('Nachbewertung', () => {
  it('setzt falsche Antworten auf richtig und rechnet Punkte neu', () => {
    const i = idx('geografie');
    const r = [A.scoreSection(i, { gk4: 'Halein' })];
    const before = r[0].points;
    const out = A.applyOverrides(r, { 'geografie/gk4': { correct: true, by: 'Admin', at: 'x' } });
    const d = out[0].blocks[1].details.find(x => x.id === 'gk4');
    expect(d.correct).toBe(true);
    expect(d.override).toEqual({ by: 'Admin', at: 'x', original: false });
    expect(out[0].points).toBe(before + 1);
    expect(A.summarize(out).points).toBe(before + 1);
    expect(r[0].points).toBe(before);
  });
  it('ignoriert Texte, Protokollaufgabe und unbekannte Fragen', () => {
    const r = [A.scoreSection(idx('abschrift'), {})];
    expect(A.applyOverrides(r, { 'abschrift/ab1': { correct: true } })[0].points).toBe(0);
    expect(A.applyOverrides(r, {})).toBe(r);
  });
});

describe('Zeitauswertung je Abschnitt', () => {
  it('ohne Zeitangabe keine time', () => {
    expect(A.scoreSection(idx('englisch'), {}).time).toBeUndefined();
  });
  it('Restzeit bei vorzeitiger Abgabe und Zeit je Block', () => {
    const i = idx('englisch'), limit = SECTIONS[i].minutes * 60;
    const r = A.scoreSection(i, {}, { used: 600, blockAt: { 1: 200, 2: 450 } });
    expect(r.time).toEqual({ limit, used: 600, remaining: limit - 600, expired: false });
    expect(r.blocks.map(b => b.used)).toEqual([200, 250, 150]);
  });
  it('abgelaufen bei Zeitablauf, auch mit Kulanz über dem Limit', () => {
    const i = idx('englisch'), limit = SECTIONS[i].minutes * 60;
    const r = A.scoreSection(i, {}, { used: limit + 15, late: true, blockAt: {} });
    expect(r.time).toEqual({ limit, used: limit, remaining: 0, expired: true });
    expect(r.blocks[1].used).toBeNull();
  });
});
