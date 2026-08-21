'use strict';
const router = require('express').Router();
const Anthropic = require('@anthropic-ai/sdk');
const { q } = require('../db');
const { auth, ok, bad } = require('../middleware');

// Ohne Schlüssel bleibt die Funktion einfach deaktiviert (503), kein harter Fehler.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const STOPWORDS = new Set(['dass','oder','nicht','eine','einen','einer','einem','wird','wurde','wurden','haben','habe','hatte','sein','sind','auch','wenn','dann','über','unter','ohne','beim','beide','sowie','kann','können','muss','müssen','soll','sollte','sollten','bitte','danke','heute','morgen','immer','wieder','schon','noch','diese','dieser','dieses','dabei','damit','durch']);

// Grobe Stichwort-Suche (kein Volltext-/Vektorindex vorhanden) — reicht aber
// aus, um thematisch verwandte, bereits gelöste Tickets als Kontext für die
// KI zu finden, ohne zusätzliche Infrastruktur.
function keywords(text) {
  return [...new Set((text || '').toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || [])]
    .filter(w => !STOPWORDS.has(w)).slice(0, 12);
}

async function findSimilarTickets(title, description, excludeId) {
  const words = keywords(title + ' ' + description);
  if (!words.length) return [];
  const conditions = words.map((_, i) => `(title ILIKE $${i + 2} OR description ILIKE $${i + 2})`).join(' OR ');
  const params = [excludeId || '', ...words.map(w => '%' + w + '%')];
  const rows = await q(
    `SELECT id,number,title,description,status FROM tickets WHERE id!=$1 AND is_deleted=false AND (${conditions}) ORDER BY updated_at DESC LIMIT 60`,
    params
  );
  const scored = rows.map(r => {
    const hay = (r.title + ' ' + (r.description || '')).toLowerCase();
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    return { ...r, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  for (const t of scored) {
    t.notes = await q('SELECT text FROM ticket_notes WHERE ticket_id=$1 ORDER BY created_at DESC LIMIT 5', [t.id]);
  }
  return scored;
}

router.post('/ai/suggest', auth, async (req, res) => {
  try {
    if (!client) return bad(res, 'KI-Funktion nicht konfiguriert (ANTHROPIC_API_KEY fehlt)', 503);
    const { type, title, description, id } = req.body;
    if (!title?.trim()) return bad(res, 'Titel erforderlich');

    const similar = await findSimilarTickets(title, description || '', id || '');
    const ticketContext = similar.length
      ? similar.map(t => `Ticket ${t.number} (${t.status}): ${t.title}\n${(t.description || '').slice(0, 300)}\nNotizen dazu: ${(t.notes || []).map(n => n.text).join(' | ').slice(0, 500) || '(keine)'}`).join('\n---\n')
      : 'Keine thematisch ähnlichen Tickets in der Datenbank gefunden.';

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: `Du bist ein Assistent für ein Betriebs-/IT-Ticketsystem einer Leitstelle. Ein Mitarbeiter beschreibt ein Problem (aus einem Ticket, Todo oder Besprechungspunkt). Deine Aufgabe:
1. Prüfe die mitgelieferten, bereits vorhandenen ähnlichen Tickets aus der Datenbank auf eine passende Lösung.
2. Nutze zusätzlich die Websuche, um im Internet nach Lösungen für dieses konkrete Problem zu suchen.
3. Gib konkrete, umsetzbare Lösungsvorschläge — keine allgemeinen Plattitüden.

WICHTIG: Jeder Vorschlag MUSS eine Quelle nennen — entweder "Ticket <Nummer>" (wenn aus der Datenbank übernommen) oder "Internet" mit der genauen, echten URL der Fundstelle. Erfinde niemals eine Quelle oder URL. Wenn du nichts Passendes findest, sag das ehrlich statt zu spekulieren.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, kein Text davor oder danach, exakt in diesem Format:
{"suggestions":[{"title":"Kurzer Titel des Vorschlags","text":"Konkrete Lösung in 2-4 Sätzen","source":"Ticket TK-123 ODER Internet","sourceUrl":"https://... (nur bei Internet, sonst leerer String)"}],"summary":"Ein Satz Gesamteinschätzung"}
Falls keine sinnvollen Vorschläge existieren: {"suggestions":[],"summary":"kurze ehrliche Begründung"}`,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages: [{
        role: 'user',
        content: `Problem (Typ: ${type || 'Ticket'}): ${title}\n\nBeschreibung: ${description || '(keine)'}\n\n--- Ähnliche Tickets aus der Datenbank ---\n${ticketContext}`,
      }],
    });

    const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    let parsed;
    try {
      const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlocks);
    } catch (e) {
      parsed = { suggestions: [{ title: 'Antwort der KI', text: textBlocks.trim() || 'Keine verwertbare Antwort erhalten.', source: 'KI', sourceUrl: '' }], summary: '' };
    }
    ok(res, {
      suggestions: parsed.suggestions || [],
      summary: parsed.summary || '',
      similarTickets: similar.map(t => ({ number: t.number, title: t.title, id: t.id })),
    });
  } catch (e) {
    console.error('[ai/suggest]', e.message);
    if (e instanceof Anthropic.AuthenticationError) return bad(res, 'KI-Anfrage fehlgeschlagen: ungültiger API-Key', 500);
    if (e instanceof Anthropic.RateLimitError) return bad(res, 'KI ist gerade überlastet, bitte kurz erneut versuchen', 429);
    bad(res, 'KI-Anfrage fehlgeschlagen: ' + e.message, 500);
  }
});

module.exports = router;
