'use strict';
const path = require('path');

const ALLOWED_MIME = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv',
  'application/zip','application/x-zip-compressed',
  'application/octet-stream',
]);

// Strip path components, control chars, and dangerous characters from filenames
function sanitizeFilename(name) {
  return path.basename(name)
    .replace(/[^\w.\-\(\) äöüÄÖÜß]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 200) || 'datei';
}

function validateMime(mime) {
  return ALLOWED_MIME.has(mime);
}

// Ensure a resolved path stays within the expected base directory
function assertUnderDir(base, resolved) {
  if (!resolved.startsWith(base + path.sep) && resolved !== base)
    throw new Error('Ungültiger Dateipfad');
}

module.exports = { sanitizeFilename, validateMime, assertUnderDir };
