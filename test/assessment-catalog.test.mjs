import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../lib/assessment');
const { normalizeCatalog } = require('../lib/assessment-catalog');

const copy = () => JSON.parse(JSON.stringify(A.CODE_SECTIONS));
const find = (secs, id) => secs.flatMap(s => s.blocks.flatMap(b => b.questions)).find(q => q.id === id);

describe('normalizeCatalog', () => {
  it('der Katalog aus dem Code ist gültig und bleibt gleich', () => {
    const a = normalizeCatalog(copy(), A.CODE_SECTIONS);
    expect(JSON.stringify(normalizeCatalog(a, A.CODE_SECTIONS))).toBe(JSON.stringify(a));
  });
  it('übernimmt geänderte Fragen und Lösungen', () => {
    const s = copy();
    find(s, 'nr2').text = 'Wo ist der Notfall?';
    find(s, 'r10').answer = '22,5';
    const n = normalizeCatalog(s, A.CODE_SECTIONS);
    expect(find(n, 'nr2').text).toBe('Wo ist der Notfall?');
    expect(find(n, 'r10').answer).toBe(22.5);
  });
  it('lehnt ungültige Angaben mit Ortsangabe ab', () => {
    const s = copy(); find(s, 'r10').answer = 'abc';
    expect(() => normalizeCatalog(s, A.CODE_SECTIONS)).toThrow(/Frage .*Zahl/);
    const c = copy(); const q = c.flatMap(x => x.blocks.flatMap(b => b.questions)).find(x => x.type === 'choice'); q.answer = 99;
    expect(() => normalizeCatalog(c, A.CODE_SECTIONS)).toThrow(/richtige Antwort/);
    const d = copy(); d[0].minutes = 0;
    expect(() => normalizeCatalog(d, A.CODE_SECTIONS)).toThrow(/Minuten/);
    const e = copy(); const t = e.flatMap(x => x.blocks.flatMap(b => b.questions)); t[1].id = t[0].id;
    expect(() => normalizeCatalog(e, A.CODE_SECTIONS)).toThrow(/doppelt/);
    expect(() => normalizeCatalog(copy().slice(1), A.CODE_SECTIONS)).toThrow(/Abschnitte/);
  });
  it('Fehlerwörter müssen im Text vorkommen', () => {
    const s = copy(); const m = s.flatMap(x => x.blocks.flatMap(b => b.questions)).find(q => q.type === 'markwords');
    m.errors = { ...m.errors, Gibtsnicht: 'Gibt' };
    expect(() => normalizeCatalog(s, A.CODE_SECTIONS)).toThrow(/Gibtsnicht/);
  });
  it('eine neue Version wird mit createCatalog nutzbar', () => {
    const s = copy(); s[0].minutes = 9;
    const K = A.createCatalog(normalizeCatalog(s, A.CODE_SECTIONS), 11);
    expect(K.VERSION).toBe(11);
    expect(K.TOTAL_MINUTES).toBe(A.TOTAL_MINUTES + 1);
  });
});
