'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// E-MAIL-BENACHRICHTIGUNGEN — kostenlos über ein bestehendes SMTP-Postfach
// (z. B. GMX: mail.gmx.net:587, Gmail: smtp.gmail.com:587 mit App-Passwort).
//
// Konfiguration über Umgebungsvariablen (z. B. im Render-Dashboard):
//   SMTP_HOST  z. B. mail.gmx.net
//   SMTP_PORT  587 (STARTTLS, Standard) oder 465 (TLS)
//   SMTP_USER  Postfach-Login, z. B. portal@gmx.at
//   SMTP_PASS  Passwort bzw. App-Passwort
//   SMTP_FROM  optional, Absenderadresse (Standard: SMTP_USER)
//
// Ohne Konfiguration ist das Modul ein No-op — das Portal funktioniert
// unverändert, es werden nur keine Mails verschickt.
// ─────────────────────────────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const { q1 } = require('../db');

let transporter = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.log(`[mailer] SMTP aktiv: ${process.env.SMTP_HOST}:${port}`);
  }
  return transporter;
}

// Mail an eine Adresse. Fehler werden geloggt, nie geworfen.
async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t || !to) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to, subject, text,
    });
    return true;
  } catch(e) {
    console.error('[mailer]', e.message);
    return false;
  }
}

// Mail an einen Portal-Benutzer (löst dessen hinterlegte E-Mail-Adresse auf).
async function mailUser(userId, subject, text) {
  if (!isConfigured() || !userId) return false;
  try {
    const u = await q1('SELECT email,name FROM users WHERE id=$1', [userId]);
    if (!u?.email) return false;
    return sendMail(u.email, subject, `Hallo ${u.name},\n\n${text}\n\n— LSt Portal (automatische Benachrichtigung)`);
  } catch(e) {
    console.error('[mailer]', e.message);
    return false;
  }
}

module.exports = { isConfigured, sendMail, mailUser };
