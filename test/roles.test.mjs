import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateRoles, isAssessmentOnly, canSeeAssessment, assessmentOnlyAllowed } = require('../roles.js');

test('Assessment allein ist gültig', () => {
  assert.equal(validateRoles(['assessment']), null);
});

test('Assessment mit Admin ist gültig', () => {
  assert.equal(validateRoles(['admin', 'assessment']), null);
});

test('Assessment mit anderen Rollen wird abgelehnt', () => {
  for (const other of ['standard', 'leitung', 'dienstplanung', 'technik', 'ausbildung', 'qm'])
    assert.match(validateRoles(['assessment', other]), /Assessment/);
  assert.match(validateRoles(['admin', 'assessment', 'qm']), /Assessment/);
});

test('bestehende Rollenkombinationen bleiben gültig', () => {
  assert.equal(validateRoles(['admin', 'leitung']), null);
  assert.equal(validateRoles(['standard']), null);
});

test('leere oder unbekannte Rollen werden abgelehnt', () => {
  assert.ok(validateRoles([]));
  assert.ok(validateRoles(['hacker']));
  assert.ok(validateRoles('admin'));
});

test('nur Assessment ohne Admin ist eingeschränkt', () => {
  assert.equal(isAssessmentOnly(['assessment']), true);
  assert.equal(isAssessmentOnly(['admin', 'assessment']), false);
  assert.equal(isAssessmentOnly(['standard']), false);
  assert.equal(canSeeAssessment(['assessment']), true);
  assert.equal(canSeeAssessment(['admin']), true);
  assert.equal(canSeeAssessment(['standard']), false);
});

test('erlaubte API-Pfade für reine Assessment-Nutzer', () => {
  for (const p of ['/api/assessment', '/api/assessment/', '/api/assessment/x', '/api/data', '/api/data/', '/api/auth/me', '/api/auth/change-password'])
    assert.equal(assessmentOnlyAllowed(p), true, p);
  for (const p of ['/api/tickets', '/api/news', '/api/users/1', '/api/events', '/api/assessmentX', '/api/data/x'])
    assert.equal(assessmentOnlyAllowed(p), false, p);
});
