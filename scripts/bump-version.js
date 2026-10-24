'use strict';
// Zählt die App-Version hoch, setzt das Aktualisierungsdatum und ergänzt das Changelog.
// Wird von .github/workflows/version-bump.yml bei jedem Push auf main ausgeführt.
// Aufruf: node scripts/bump-version.js "<Commit-Nachricht>"
const fs   = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'public', 'version.json');
const PKG_FILE     = path.join(__dirname, '..', 'package.json');
const MAX_ENTRIES  = 50;

// [major] / [minor] in der Commit-Nachricht steuern die Stufe, sonst Patch.
function bumpLevel(msg) {
  if (/\[major\]/i.test(msg)) return 'major';
  if (/\[minor\]/i.test(msg)) return 'minor';
  return 'patch';
}

function nextVersion(v, level) {
  const [ma, mi, pa] = String(v).split('.').map(n => parseInt(n, 10) || 0);
  if (level === 'major') return `${ma + 1}.0.0`;
  if (level === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

// Macht aus der Commit-Nachricht eine lesbare Changelog-Zeile.
function changeText(msg) {
  const lines = String(msg || '').split('\n').map(l => l.trim()).filter(Boolean);
  let text = lines[0] || '';
  // Merge-Commit von GitHub: eigentlicher PR-Titel steht in der nächsten Zeile
  if (/^Merge pull request #\d+/.test(text)) text = lines[1] || text.replace(/ from .*$/, '');
  if (/^(Add|Update|Delete) files via upload$/i.test(text)) text = 'Dateien aktualisiert';
  return text.replace(/\[(major|minor)\]/ig, '').replace(/\s+/g, ' ').trim() || 'Aktualisierung';
}

// ISO-Zeitstempel in Wiener Ortszeit, z. B. 2026-10-24T16:28:00+02:00
function viennaIso(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  }).formatToParts(d).map(p => [p.type, p.value]));
  const off = (parts.timeZoneName || 'GMT').replace('GMT', '') || '+00:00';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${off}`;
}

function bump(info, msg, now = new Date()) {
  const version = nextVersion(info.version, bumpLevel(msg));
  const date = viennaIso(now);
  const changelog = [{ version, date, changes: [changeText(msg)] }, ...(info.changelog || [])].slice(0, MAX_ENTRIES);
  return { ...info, version, date, changelog };
}

if (require.main === module) {
  const msg  = process.argv[2] || process.env.COMMIT_MSG || '';
  const info = bump(JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')), msg);
  fs.writeFileSync(VERSION_FILE, JSON.stringify(info, null, 2) + '\n');
  const pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
  pkg.version = info.version;
  fs.writeFileSync(PKG_FILE, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Version ${info.version} (${info.date})`);
}

module.exports = { bumpLevel, nextVersion, changeText, viennaIso, bump };
