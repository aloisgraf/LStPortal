'use strict';
const router = require('express').Router();
const { auth, ok, bad } = require('../middleware');

// Liefert für mehrere gängige Feldnamen den ersten nicht-leeren Wert — das
// .msg-Parser-Paket hat je nach Version leicht unterschiedliche Feldnamen,
// defensiv nachschlagen ist robuster als sich auf einen einzigen zu verlassen.
const pick = (obj, keys) => {
  for (const k of keys) { if (obj && obj[k] != null && obj[k] !== '') return obj[k]; }
  return '';
};
const stripHtml = html => String(html||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
// Bei intern verschickten Outlook-Mails liefert das X.500-Feld (statt einer
// SMTP-Adresse) oft eine Exchange-Legacy-DN wie
// "/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP.../CN=RECIPIENTS/CN=..."
// — so etwas darf nie als Absenderadresse durchgereicht werden.
const isRealEmail = s => /^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(String(s||'').trim());

function parseMsg(buffer) {
  const MsgReaderMod = require('@kenjiuno/msgreader');
  const MsgReader = MsgReaderMod.default || MsgReaderMod;
  const reader = new MsgReader(buffer);
  const fileData = reader.getFileData();
  const subject = pick(fileData, ['subject','Subject']);
  const senderName = pick(fileData, ['senderName','SenderName']);
  let senderEmail = pick(fileData, ['senderSmtpAddress','senderEmail','SenderEmail']);
  if (!isRealEmail(senderEmail)) {
    // Fallback: rohe Internet-Header (falls im .msg erhalten) nach "From:" durchsuchen
    const headers = pick(fileData, ['headers','transportMessageHeaders']);
    const m = String(headers||'').match(/^From:.*?<?([^\s<>]+@[^\s<>]+)>?\s*$/im);
    senderEmail = m && isRealEmail(m[1]) ? m[1] : '';
  }
  let body = pick(fileData, ['body','Body']);
  if (!body) body = stripHtml(pick(fileData, ['bodyHTML','bodyHtml']));
  return { subject, senderName, senderEmail, body };
}

async function parseEml(buffer) {
  const { simpleParser } = require('mailparser');
  const parsed = await simpleParser(buffer);
  const from = parsed.from?.value?.[0] || {};
  return {
    subject: parsed.subject || '',
    senderName: from.name || '',
    senderEmail: from.address || '',
    body: parsed.text || stripHtml(parsed.html || ''),
  };
}

router.post('/email/parse', auth, async (req,res) => {
  try {
    const { filename, data } = req.body;
    if (!data) return bad(res,'Keine Datei erhalten');
    const buffer = Buffer.from(data, 'base64');
    const name = (filename||'').toLowerCase();
    let result;
    if (name.endsWith('.msg')) result = parseMsg(buffer);
    else if (name.endsWith('.eml')) result = await parseEml(buffer);
    else return bad(res,'Nur .msg- oder .eml-Dateien werden unterstützt');
    ok(res, result);
  } catch(e) { console.error('[email/parse]', e.message); bad(res,'E-Mail konnte nicht gelesen werden — Format eventuell nicht unterstützt',500); }
});

module.exports = router;
