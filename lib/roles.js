'use strict';
// Reine Rollen-Regeln für die Rolle "Assessment" — DB-frei, damit sie ohne
// Datenbank testbar sind (siehe test/roles.test.mjs).
//
// - Nur die Rolle Assessment: Bewerber. Sieht ausschließlich den
//   Assessment-Bereich — auch serverseitig abgesichert (middleware.js), nicht
//   nur über die Menü-Sichtbarkeit.
// - Assessment zusammen mit einer weiteren Rolle (z. B. Ausbildung, Leitung):
//   Prüfer. Sieht das Assessment wie die Administration (Live-Ansicht,
//   Ergebnisse, Nachbewertung, Abbrechen, Zurücksetzen, Testdurchgang), darf
//   aber keine Durchgänge löschen.
// - Administrator: alles, auch ohne die Rolle Assessment.

// Liefert eine Fehlermeldung oder null, wenn die Rollenkombination gültig ist.
function validateRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return 'Mindestens eine Rolle erforderlich';
  return null;
}

const isAssessmentOnly = roles => roles.includes('assessment') && roles.every(r => r === 'assessment');
const canSeeAssessment = roles => roles.includes('assessment') || roles.includes('admin');
const canManageAssessment = roles => roles.includes('admin') || (roles.includes('assessment') && !isAssessmentOnly(roles));

// API-Pfade, die ein reiner Assessment-Nutzer aufrufen darf. Die
// impersonate-Routen bleiben offen, damit ein Admin eine "Ansicht als" auf
// einen Assessment-Testuser auch wieder beenden kann (die Routen prüfen
// selbst req.realIsAdmin).
const ASSESSMENT_ONLY_PATHS = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout', '/api/data',
  '/api/impersonate/start', '/api/impersonate/stop'];
function assessmentOnlyAllowed(rawPath) {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  return ASSESSMENT_ONLY_PATHS.includes(path) || path === '/api/assessment' || path.startsWith('/api/assessment/');
}

module.exports = { validateRoles, isAssessmentOnly, canSeeAssessment, canManageAssessment, assessmentOnlyAllowed };
