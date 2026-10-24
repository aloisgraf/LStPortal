import { test, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { nextVersion, bumpLevel, changeText, viennaIso, bump } = require('../scripts/bump-version.js');

test('Patch wird standardmäßig hochgezählt', () => {
  expect(nextVersion('2.2.4', bumpLevel('Fix: Login'))).toBe('2.2.5');
});

test('[minor] und [major] steuern die Stufe', () => {
  expect(nextVersion('2.2.4', bumpLevel('Neues Modul [minor]'))).toBe('2.3.0');
  expect(nextVersion('2.2.4', bumpLevel('Umbau [major]'))).toBe('3.0.0');
});

test('Changelog-Text aus Squash- und Merge-Commits', () => {
  expect(changeText('Neue Rolle "Assessment" (#2)\n\n* details')).toBe('Neue Rolle "Assessment" (#2)');
  expect(changeText('Merge pull request #5 from aloisgraf/x\n\nRechte pro Modul')).toBe('Rechte pro Modul');
  expect(changeText('Add files via upload')).toBe('Dateien aktualisiert');
  expect(changeText('Neues Modul [minor]')).toBe('Neues Modul');
});

test('Datum in Wiener Zeit', () => {
  expect(viennaIso(new Date('2026-10-24T14:28:00Z'))).toBe('2026-10-24T16:28:00+02:00');
  expect(viennaIso(new Date('2026-12-24T14:28:00Z'))).toBe('2026-12-24T15:28:00+01:00');
});

test('bump setzt Version, Datum und neuen Changelog-Eintrag oben', () => {
  const r = bump({ version: '2.2.4', date: '', changelog: [{ version: '2.2.4', date: '', changes: ['alt'] }] },
    'Versionsanzeige', new Date('2026-10-24T14:28:00Z'));
  expect(r.version).toBe('2.2.5');
  expect(r.date).toBe('2026-10-24T16:28:00+02:00');
  expect(r.changelog[0]).toEqual({ version: '2.2.5', date: '2026-10-24T16:28:00+02:00', changes: ['Versionsanzeige'] });
  expect(r.changelog.length).toBe(2);
});
