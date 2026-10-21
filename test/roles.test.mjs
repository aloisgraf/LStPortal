import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateRoles, isAssessmentOnly, canSeeAssessment, assessmentOnlyAllowed } = require('../lib/roles');

describe('validateRoles — Assessment ist exklusiv', () => {
  it('Assessment allein ist gültig', () => {
    expect(validateRoles(['assessment'])).toBeNull();
  });
  it('Assessment mit Admin ist gültig', () => {
    expect(validateRoles(['admin', 'assessment'])).toBeNull();
  });
  it('Assessment mit jeder anderen Rolle wird abgelehnt', () => {
    for (const other of ['standard', 'leitung', 'dienstplanung', 'schichtleiter', 'technik', 'qm', 'ausbildung', 'neuerfachbereich'])
      expect(validateRoles(['assessment', other])).toMatch(/Assessment/);
    expect(validateRoles(['admin', 'assessment', 'qm'])).toMatch(/Assessment/);
  });
  it('bestehende Kombinationen und Fachbereichs-Rollen bleiben gültig', () => {
    expect(validateRoles(['admin', 'leitung'])).toBeNull();
    expect(validateRoles(['standard', 'neuerfachbereich'])).toBeNull();
  });
  it('leere Rollenliste wird abgelehnt', () => {
    expect(validateRoles([])).toBeTruthy();
    expect(validateRoles('admin')).toBeTruthy();
  });
});

describe('isAssessmentOnly / canSeeAssessment', () => {
  it('nur Assessment ohne Admin ist eingeschränkt', () => {
    expect(isAssessmentOnly(['assessment'])).toBe(true);
    expect(isAssessmentOnly(['admin', 'assessment'])).toBe(false);
    expect(isAssessmentOnly(['standard'])).toBe(false);
  });
  it('Assessment-Bereich sehen Assessment-Nutzer und Admins', () => {
    expect(canSeeAssessment(['assessment'])).toBe(true);
    expect(canSeeAssessment(['admin'])).toBe(true);
    expect(canSeeAssessment(['leitung'])).toBe(false);
  });
});

describe('assessmentOnlyAllowed — serverseitige Sperre', () => {
  it('erlaubt nur Login-, Daten- und Assessment-Pfade', () => {
    for (const p of ['/api/assessment', '/api/assessment/', '/api/assessment/start', '/api/data', '/api/data/', '/api/auth/me', '/api/auth/change-password', '/api/impersonate/stop'])
      expect(assessmentOnlyAllowed(p), p).toBe(true);
  });
  it('sperrt alle anderen Bereiche', () => {
    for (const p of ['/api/tickets', '/api/news', '/api/users/1', '/api/events', '/api/chat/threads', '/api/game', '/api/assessmentX', '/api/data/x'])
      expect(assessmentOnlyAllowed(p), p).toBe(false);
  });
});
