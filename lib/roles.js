'use strict';
// Reine Rollen-Regeln für die Rolle "Assessment" — DB-frei, damit sie ohne
// Datenbank testbar sind (siehe test/roles.test.mjs).
//
// Assessment ist exklusiv: ein Mitarbeiter mit dieser Rolle darf daneben nur
// noch Administrator sein. Ein reiner Assessment-Nutzer (ohne Admin) sieht
// ausschließlich den Assessment-Bereich — auch serverseitig abgesichert
// (middleware.js), nicht nur über die Menü-Sichtbarkeit.

const ASSESSMENT_COMBINABLE = ['admin'];

// Liefert eine Fehlermeldung oder null, wenn die Rollenkombination gültig ist.
function validateRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return 'Mindestens eine Rolle erforderlich';
  if (roles.includes('assessment') && roles.some(r => r !== 'assessment' && !ASSESSMENT_COMBINABLE.includes(r)))
    return 'Die Rolle Assessment kann nur zusammen mit Administrator vergeben werden';
  return null;
}

const isAssessmentOnly = roles => roles.includes('assessment') && !roles.includes('admin');
const canSeeAssessment = roles => roles.includes('assessment') || roles.includes('admin');

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

module.exports = { ASSESSMENT_COMBINABLE, validateRoles, isAssessmentOnly, canSeeAssessment, assessmentOnlyAllowed };
