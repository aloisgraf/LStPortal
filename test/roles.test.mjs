import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateRoles, isAssessmentOnly, canSeeAssessment, canManageAssessment, assessmentOnlyAllowed } = require('../lib/roles');

describe('validateRoles', () => {
  it('Assessment ist mit jeder Rolle kombinierbar', () => {
    expect(validateRoles(['assessment'])).toBeNull();
    for (const other of ['admin', 'standard', 'leitung', 'ausbildung', 'qm', 'neuerfachbereich'])
      expect(validateRoles(['assessment', other])).toBeNull();
  });
  it('leere Rollenliste wird abgelehnt', () => {
    expect(validateRoles([])).toBeTruthy();
    expect(validateRoles('admin')).toBeTruthy();
  });
});

describe('Bewerber, Prüfer und Administration', () => {
  it('nur die Rolle Assessment = Bewerber, eingeschränkt', () => {
    expect(isAssessmentOnly(['assessment'])).toBe(true);
    expect(isAssessmentOnly(['assessment', 'ausbildung'])).toBe(false);
    expect(isAssessmentOnly(['admin', 'assessment'])).toBe(false);
    expect(isAssessmentOnly(['standard'])).toBe(false);
  });
  it('Assessment mit weiterer Rolle = Prüfer', () => {
    expect(canManageAssessment(['assessment', 'ausbildung'])).toBe(true);
    expect(canManageAssessment(['leitung', 'assessment'])).toBe(true);
    expect(canManageAssessment(['admin'])).toBe(true);
    expect(canManageAssessment(['assessment'])).toBe(false);
    expect(canManageAssessment(['ausbildung'])).toBe(false);
  });
  it('Assessment-Bereich sehen Assessment-Nutzer und Admins', () => {
    expect(canSeeAssessment(['assessment'])).toBe(true);
    expect(canSeeAssessment(['assessment', 'leitung'])).toBe(true);
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
