'use strict';
// Rollen-Regeln, die ohne Datenbank auskommen (auch in test/ verwendet).

const ROLE_IDS = ['admin','leitung','dienstplanung','technik','ausbildung','qm','standard','assessment'];

// Assessment ist exklusiv: daneben ist nur noch Admin erlaubt.
const ASSESSMENT_COMBINABLE = ['admin'];

// Liefert eine Fehlermeldung oder null, wenn die Rollen gültig sind.
function validateRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return 'Mindestens eine Rolle erforderlich';
  const unknown = roles.filter(r => !ROLE_IDS.includes(r));
  if (unknown.length) return 'Unbekannte Rolle: ' + unknown.join(', ');
  if (roles.includes('assessment') && roles.some(r => r !== 'assessment' && !ASSESSMENT_COMBINABLE.includes(r)))
    return 'Die Rolle Assessment kann nur zusammen mit Administrator vergeben werden';
  return null;
}

// Nutzer mit Assessment und ohne Admin sehen ausschließlich den Assessment-Bereich.
const isAssessmentOnly = roles => roles.includes('assessment') && !roles.includes('admin');
const canSeeAssessment = roles => roles.includes('assessment') || roles.includes('admin');

// API-Pfade, die ein reiner Assessment-Nutzer aufrufen darf.
const ASSESSMENT_ONLY_PATHS = ['/api/auth/me', '/api/auth/change-password', '/api/data'];
const assessmentOnlyAllowed = rawPath => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  return ASSESSMENT_ONLY_PATHS.includes(path) || path === '/api/assessment' || path.startsWith('/api/assessment/');
};

module.exports = { ROLE_IDS, validateRoles, isAssessmentOnly, canSeeAssessment, assessmentOnlyAllowed };
