# LSt Portal – Server-Installation

Multi-User Web-App für Dienstplanung & Ticketsystem.  
Backend: Node.js + Express | Datenbank: SQLite | Auth: Sessions + bcrypt

---

## Systemvoraussetzungen (4lima VPS)

- Node.js **18+** (`node --version`)
- npm (`npm --version`)
- Optional: PM2 für dauerhaften Betrieb

---

## 1. Installation

```bash
# Dateien auf den Server übertragen (z.B. via SFTP oder git)
cd /var/www/lst-portal    # oder dein Wunschpfad

# Abhängigkeiten installieren
npm install

# Konfiguration anlegen
cp .env.example .env
nano .env
```

**In `.env` unbedingt anpassen:**
```
PORT=3000
SESSION_SECRET=dein-langer-zufaelliger-geheimer-schluessel-hier
DATA_DIR=./data
NODE_ENV=production
```

---

## 2. Testen

```bash
node server.js
# → http://localhost:3000
```

**Standard-Zugangsdaten:**
| Benutzer | Passwort |
|---|---|
| Administrator | Passwort1 |
| Dienstplanung | Passwort1 |

---

## 3. Dauerhafter Betrieb mit PM2

```bash
# PM2 installieren (einmalig)
npm install -g pm2

# App starten
pm2 start server.js --name lst-portal

# Beim Serverstart automatisch starten
pm2 save
pm2 startup

# Logs anzeigen
pm2 logs lst-portal

# Neu starten
pm2 restart lst-portal
```

---

## 4. Nginx Reverse Proxy (empfohlen)

Damit das Portal unter einer Domain / Port 80/443 erreichbar ist:

```nginx
server {
    listen 80;
    server_name deine-domain.at;   # ← anpassen

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Nginx-Konfig testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

**HTTPS mit Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.at
```

Nach HTTPS in `.env` setzen: `NODE_ENV=production` → aktiviert Secure Cookies.

---

## 5. Datensicherung

Die gesamte Datenbank liegt im `data/`-Verzeichnis:

```bash
# Backup erstellen
cp -r /var/www/lst-portal/data /backup/lst-portal-$(date +%Y%m%d)

# Automatisches tägliches Backup (crontab -e)
0 2 * * * cp -r /var/www/lst-portal/data /backup/lst-$(date +\%Y\%m\%d)
```

---

## 6. Update

```bash
# Neue Dateien übertragen, dann:
cd /var/www/lst-portal
npm install
pm2 restart lst-portal
```

---

## Projektstruktur

```
lst-portal/
├── server.js          ← Backend (Express + SQLite)
├── package.json
├── .env               ← Konfiguration (NICHT ins Git!)
├── .env.example       ← Vorlage
├── data/              ← Wird automatisch angelegt
│   ├── lst.db         ← Alle Daten (SQLite)
│   └── sessions.db    ← Login-Sessions
└── public/
    └── index.html     ← Frontend (SPA)
```

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| Port 3000 belegt | `PORT=3001` in .env |
| Session läuft sofort ab | `SESSION_SECRET` setzen |
| Seite nicht erreichbar | Nginx-Config + Firewall prüfen |
| Daten weg nach Neustart | PM2 `pm2 startup` ausführen |
