# LSt Portal – Deployment auf Render + Supabase

Multi-User Web-App für Dienstplanung & Ticketsystem.  
Backend: Node.js + Express | Datenbank: **PostgreSQL (Supabase)** | Hosting: **Render**

---

## Architektur

```
Browser → Render (Node.js App) → Supabase (PostgreSQL)
```

- **Supabase** = kostenlose PostgreSQL-Datenbank (Free Tier: 500 MB)
- **Render** = kostenloses Hosting für die Node.js App (Free Tier: schläft nach 15 Min Inaktivität)

---

## Schritt 1: Supabase einrichten

1. Konto anlegen auf [supabase.com](https://supabase.com)
2. **New Project** erstellen (Name z.B. `lst-portal`)
3. Passwort merken!
4. Warten bis das Projekt hochgefahren ist (~1 Min)
5. Gehe zu **Project Settings → Database → Connection string → URI**
6. Connection String kopieren – sieht so aus:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
7. `?sslmode=require` ans Ende anhängen!

> Die Tabellen werden beim ersten App-Start **automatisch angelegt** – nichts manuell ausführen nötig.

---

## Schritt 2: Code auf GitHub

1. GitHub-Repository anlegen (kann privat sein)
2. Alle Projektdateien hochladen:
   ```
   lst-portal/
   ├── server.js
   ├── package.json
   ├── .env.example
   └── public/
       └── index.html
   ```
3. **Wichtig:** `.env` **NICHT** ins Git – nur `.env.example`!

---

## Schritt 3: Render einrichten

1. Konto anlegen auf [render.com](https://render.com)
2. **New → Web Service** → GitHub-Repo verbinden
3. Einstellungen:
   | Feld | Wert |
   |---|---|
   | Name | `lst-portal` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | `Free` |

4. **Environment Variables** setzen (Tab „Environment"):
   | Variable | Wert |
   |---|---|
   | `DATABASE_URL` | Supabase Connection String (mit `?sslmode=require`) |
   | `SESSION_SECRET` | Zufälliger langer String (mind. 32 Zeichen) |
   | `NODE_ENV` | `production` |

5. **Deploy** → Render baut und startet die App automatisch

---

## Standard-Zugangsdaten (erster Start)

| Benutzer | Passwort |
|---|---|
| Administrator | Passwort1 |
| Dienstplanung | Passwort1 |

---

## Updates deployen

Einfach Code ins GitHub-Repo pushen → Render deployed automatisch neu.

### Versionsnummer & Aktualisierungsdatum

Bei jedem Push/Merge auf den Live-Branch (`claude/review-project-status-KYW7a`, den Render deployed) zählt die GitHub Action **„Version hochzählen“** die Version in `public/version.json` automatisch hoch (z. B. 3.0.0 → 3.0.1), setzt das Aktualisierungsdatum und trägt den PR-Titel ins Changelog ein. Das Portal zeigt Version und Datum unten in der Sidebar; ein Klick öffnet das Changelog.

- `[minor]` im PR-Titel → 3.1.0, `[major]` → 4.0.0

---

## Projektstruktur

```
lst-portal/
├── server.js          ← Backend (Express + PostgreSQL)
├── package.json
├── .env.example       ← Vorlage (ohne Passwörter!)
└── public/
    └── index.html     ← Frontend (SPA)
```

Die Datenbank-Tabellen werden beim ersten Start automatisch erstellt.

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| App startet nicht | `DATABASE_URL` in Render-Env prüfen |
| SSL-Fehler | `?sslmode=require` am Ende der DATABASE_URL |
| Session läuft sofort ab | `SESSION_SECRET` setzen |
| App schläft ein | Render Free Tier – erster Request dauert ~30 Sek |
| Daten weg | Niemals! Daten sind in Supabase, nicht auf Render |
