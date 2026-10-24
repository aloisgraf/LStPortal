import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { nextVersion, bumpLevel, changeText, viennaIso, bump } = require('../scripts/bump-version.js');

test('Patch wird standardmäßig hochgezählt', () => {
  assert.equal(nextVersion('2.2.4', bumpLevel('Fix: Login')), '2.2.5');
});

test('[minor] und [major] steuern die Stufe', () => {
  assert.equal(nextVersion('2.2.4', bumpLevel('Neues Modul [minor]')), '2.3.0');
  assert.equal(nextVersion('2.2.4', bumpLevel('Umbau [major]')), '3.0.0');
});

test('Changelog-Text aus Squash- und Merge-Commits', () => {
  assert.equal(changeText('Neue Rolle "Assessment" (#2)\n\n* details'), 'Neue Rolle "Assessment" (#2)');
  assert.equal(changeText('Merge pull request #5 from aloisgraf/x\n\nRechte pro Modul'), 'Rechte pro Modul');
  assert.equal(changeText('Add files via upload'), 'Dateien aktualisiert');
  assert.equal(changeText('Neues Modul [minor]'), 'Neues Modul');
});

test('Datum in Wiener Zeit', () => {
  assert.equal(viennaIso(new Date('2026-10-24T14:28:00Z')), '2026-10-24T16:28:00+02:00');
  assert.equal(viennaIso(new Date('2026-12-24T14:28:00Z')), '2026-12-24T15:28:00+01:00');
});

test('bump setzt Version, Datum und neuen Changelog-Eintrag oben', () => {
  const r = bump({ version: '2.2.4', date: '', changelog: [{ version: '2.2.4', date: '', changes: ['alt'] }] },
    'Versionsanzeige', new Date('2026-10-24T14:28:00Z'));
  assert.equal(r.version, '2.2.5');
  assert.equal(r.date, '2026-10-24T16:28:00+02:00');
  assert.deepEqual(r.changelog[0], { version: '2.2.5', date: '2026-10-24T16:28:00+02:00', changes: ['Versionsanzeige'] });
  assert.equal(r.changelog.length, 2);
});
