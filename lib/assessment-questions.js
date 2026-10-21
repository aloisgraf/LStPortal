'use strict';
// Fragenkatalog des Assessments (Ablauf/Auswertung: lib/assessment.js). Die
// Lösungen verlassen nie den Server.
//
// Grundlage: „Assessment Leitstelle, Version A“ (Teil 1–4), ergänzt um
// Motivationstext, Zahlenreihen/Logik, Merkfähigkeit, Rechnen, Persönlichkeit
// und zum Schluss die Abschrift vom Blatt (Easytipping). Reihenfolge und
// Pause nach Vorgabe der Leitung. Jeder
// Abschnitt hat eine eigene Uhr; der nächste beginnt erst, wenn aktiv auf
// „Weiter“ geklickt wird.
//
// Abschnitte: kind 'pause' (Pflichtpause, Weiter erst nach Ablauf) oder
// Aufgaben in Blöcken. freeOrder = alle Blöcke auf einer Seite (Reihenfolge
// frei), sonst Block für Block mit „Fertig, weiter“. Ein Block kann eine
// Merkphase (memorize) haben.
//
// Fragetypen:
//   choice    answer = Index der richtigen Option (compact = Optionen in einer Zeile)
//   number    answer = Zahl (tol = optionale Toleranz)
//   text      accept = erlaubte Schreibweisen (exakt, inkl. Groß/klein; loose = tolerant)
//   markwords Fehler im Text markieren und verbessern; errors = falsch →
//             richtig. Je Fehler 1 Punkt fürs Markieren, 1 fürs Verbessern,
//             −1 je zu Unrecht markiertem Wort (Aufgabe nie unter 0).
//   writing   freier Text, jede Änderung wird protokolliert; lockWords =
//             abgeschlossene Wörter (nach dem Leerzeichen) sind gesperrt,
//             Markieren ist nicht möglich; final = „Abschließen“ sperrt den Text
//   likert    1–5 ohne richtig/falsch; dim = Skala aus DIMS, pole = a/b

const PROTOKOLL =
`ELS-PROTOKOLL · EINSATZ 2026-10-4417 · 14:32:07

Der Notruf ging um 14:32 Uhr ein. Gemeldet wird ein schwerer Verkehrsunfal auf der Landstraße L 217 in Höhe Kilometer 12. Beteiligt sind ein PKW und ein Motorrad. Der Motorradfahrer ist ansprechbahr, klagt aber über starke Schmerzen im linken Unterschänkel. Die Beifahrerin des PKW ist bewustlos, die Atmung ist vorhanden. Aus dem Motorrad läuft Bensin aus, die Feuerwehr wurde zur Absicherung alarmiert.

Rückmeldung RTW 20-203 um 14:41 Uhr: Sauerstoffsetigung der Beifahrerin bei 91 Prozent, Nachforderung Notartzt. Der Defibrilator ist einsatzbereit, wird aber derzeit nicht benötigt. Die Polizei richtet eine Strassensperre ein und bittet alle Fahrzeuge, eine Rettungsgase zu bilden.`;

const ABC = ['A', 'B', 'C'];
const spell = (id, a, b, c, answer) => ({ id, type:'choice', compact:true, text:`Welche Schreibweise ist richtig?`, options:[a, b, c].map((w, i) => `${ABC[i]}) ${w}`), answer });
const gap = (id, text, hint, accept) => ({ id, type:'text', text, hint, accept });

// Gaue über die Bezirkskennzeichen: SL Flachgau, HA Tennengau, JO Pongau,
// ZE Pinzgau, TA Lungau. drag = Kürzel per Ziehen zuordnen (Antwort = Index).
const KZ = ['SL', 'HA', 'JO', 'ZE', 'TA'];
const gau = (id, text, kz) => ({ id, type:'choice', drag:true, text, options:KZ, answer:KZ.indexOf(kz) });
// Abschlussfragen als Freitext; loose = Groß/klein, Leer- und Satzzeichen
// sowie „Sankt“/„St.“ egal.
const kz = (id, k, accept) => ({ id, type:'text', loose:true, text:`Wofür steht ${k}?`, accept });

const ABCD = ['a', 'b', 'c', 'd'];
const mc = (id, text, options, letter) => ({ id, type:'choice', text, options:options.map((o, i) => `${ABCD[i]}) ${o}`), answer:ABCD.indexOf(letter) });

// Persönlichkeit: jede Skala hat zwei gleichwertige Pole (kein „gut“ oder
// „schlecht“), G ist die Ehrlichkeitskontrolle.
const DIMS = {
  A: { label:'Arbeitsweise', a:'Tempo', b:'Gründlichkeit' },
  B: { label:'Entscheiden', a:'Bauch', b:'Kopf' },
  C: { label:'Umgang mit Druck', a:'sucht Druck', b:'braucht Erholung' },
  D: { label:'Zusammenarbeit', a:'führt', b:'hält sich zurück' },
  E: { label:'Kontakt mit Menschen', a:'mitfühlend', b:'distanziert' },
  F: { label:'Arbeitsumfeld', a:'Struktur', b:'Abwechslung' },
  G: { label:'Ehrlichkeitskontrolle', control:true },
};

const SECTIONS = [
  {
    key: 'rechtschreibung', short: 'Rechtschreibung',
    title: 'Teil 1: Rechtschreibung',
    description: 'Drei Aufgaben, die Reihenfolge ist frei, insgesamt 40 Punkte. Es gilt die deutsche Rechtschreibung mit ß und Umlauten, „ae“ oder „ss“ statt „ß“ zählen als Fehler. Die Rechtschreibprüfung ist ausgeschaltet. Nur bei Aufgabe 1 gibt es Minuspunkte für zu Unrecht markierte Wörter.',
    minutes: 10, freeOrder: true,
    blocks: [
      { key: 'protokoll', title: 'Aufgabe 1: Fehler im Einsatzprotokoll', instruction: 'Im Protokoll stecken 10 Rechtschreibfehler. Tippe jedes falsch geschriebene Wort an und schreibe die richtige Schreibweise in das Feld, das darunter erscheint. Zahlen, Uhrzeiten und Funkrufnamen sind richtig. Richtzeit 4 Minuten, maximal 20 Punkte.', questions: [
        { id:'rs1', type:'markwords', text:'Einsatzprotokoll', passage:PROTOKOLL, errors:{
          Verkehrsunfal:'Verkehrsunfall', ansprechbahr:'ansprechbar', 'Unterschänkel':'Unterschenkel', bewustlos:'bewusstlos',
          Bensin:'Benzin', Sauerstoffsetigung:'Sauerstoffsättigung', Notartzt:'Notarzt', Defibrilator:'Defibrillator',
          Strassensperre:'Straßensperre', Rettungsgase:'Rettungsgasse' } },
      ]},
      { key: 'schreibweise', title: 'Aufgabe 2: Schreibweise wählen', instruction: 'Bei jedem Fachbegriff ist genau eine der drei Schreibweisen richtig. Richtzeit 2 Minuten, maximal 10 Punkte.', questions: [
        spell('sw1', 'Rettungsdiehnst', 'Rettungsdienst', 'Retungsdienst', 1),
        spell('sw2', 'Notfallsanitäter', 'Notfallsanitaeter', 'Notfallsannitäter', 0),
        spell('sw3', 'Adrenallin', 'Addrenalin', 'Adrenalin', 2),
        spell('sw4', 'Herzstilstand', 'Herzstillstand', 'Herzstillstant', 1),
        spell('sw5', 'Einsatzleiter', 'Einsazleiter', 'Einsatzleitter', 0),
        spell('sw6', 'Atemwegsverlägung', 'Atemwegsferlegung', 'Atemwegsverlegung', 2),
        spell('sw7', 'Schädel-Hiern-Trauma', 'Schedel-Hirn-Trauma', 'Schädel-Hirn-Trauma', 2),
        spell('sw8', 'Allarmierung', 'Alarmierung', 'Alarmirung', 1),
        spell('sw9', 'Bewusstseinsstörung', 'Bewustseinsstörung', 'Bewusstseinstörung', 0),
        spell('sw10', 'Hyperventillation', 'Hyperfentilation', 'Hyperventilation', 2),
      ]},
      { key: 'lueckentext', title: 'Aufgabe 3: Lückentext', instruction: 'In jedem Satz fehlt ein Fachwort. Der Hinweis erklärt, was gemeint ist, nicht wie es geschrieben wird. Richtzeit 4 Minuten, maximal 10 Punkte.', questions: [
        gap('lt1', 'Die Anruferin wird telefonisch zur ____ angeleitet.', 'Fachwort für Wiederbelebung', ['Reanimation']),
        gap('lt2', 'Der Patient hat einen ____, der ganze Körper zuckt.', 'epileptischer Anfall', ['Krampfanfall', 'Grand-Mal-Anfall', 'Grand-mal-Anfall']),
        gap('lt3', 'Nach dem Wespenstich entwickelt sie eine ____.', 'lebensbedrohliche allergische Reaktion', ['Anaphylaxie']),
        gap('lt4', 'Der gestürzte Radfahrer klagt über Rückenschmerzen, Verdacht auf ____.', 'Verletzung im Bereich des Rückgrats, ein Wort', ['Wirbelsäulenverletzung', 'Wirbelsäulentrauma', 'Wirbelsäulenfraktur', 'Wirbelfraktur', 'Wirbelbruch']),
        gap('lt5', 'Der ____ landet auf der Wiese neben der Unfallstelle.', 'fliegendes Rettungsmittel', ['Rettungshubschrauber', 'Notarzthubschrauber', 'Hubschrauber', 'Notarzthelikopter', 'Rettungshelikopter', 'Helikopter']),
        gap('lt6', 'Der Mann wurde aus dem See gezogen und leidet an einer ____.', 'Körpertemperatur stark abgesunken', ['Unterkühlung', 'Hypothermie']),
        gap('lt7', 'Die Atmung hat ausgesetzt, es liegt ein ____ vor.', 'Atmung fehlt vollständig', ['Atemstillstand']),
        gap('lt8', 'Im Heizungskeller wurden erhöhte Werte von ____ gemessen.', 'giftiges, geruchloses Gas (CO)', ['Kohlenmonoxid', 'Kohlenstoffmonoxid']),
        gap('lt9', 'Die ältere Dame ist gestürzt, Verdacht auf ____.', 'Bruch des Knochens nahe der Hüfte, ein Wort', ['Oberschenkelhalsbruch', 'Schenkelhalsbruch', 'Oberschenkelhalsfraktur', 'Schenkelhalsfraktur']),
        gap('lt10', 'Die ____ auf Licht ist beidseits erhalten.', 'Reaktion der Augen', ['Pupillenreaktion']),
      ]},
    ],
  },
  {
    key: 'geografie', short: 'Geografie',
    title: 'Teil 2: Geografie Land Salzburg',
    description: 'Ordne jeden Ort bzw. jede Sehenswürdigkeit dem richtigen Gau zu, danach folgen fünf Abschlussfragen. 35 Punkte.',
    minutes: 5,
    blocks: [
      { key: 'gaue', title: 'Gaue zuordnen', instruction: 'Ziehe das passende Kürzel (SL, HA, JO, ZE, TA) in das Feld neben dem Ort. Jedes Kürzel kann mehrmals verwendet werden. Alternativ: Kürzel antippen, dann das Feld antippen.', questions: [
        gau('g1', 'Seekirchen am Wallersee', 'SL'), gau('g2', 'Bad Gastein', 'JO'), gau('g3', 'Zell am See', 'ZE'),
        gau('g4', 'Tamsweg', 'TA'), gau('g5', 'Hallein', 'HA'), gau('g6', 'Mattsee', 'SL'),
        gau('g7', 'Saalfelden', 'ZE'), gau('g8', 'Radstadt', 'JO'), gau('g9', 'Golling', 'HA'),
        gau('g10', 'Mauterndorf', 'TA'), gau('g11', 'Krimmler Wasserfälle', 'ZE'), gau('g12', 'Eisriesenwelt', 'JO'),
        gau('g13', 'Salzachöfen', 'HA'), gau('g14', 'Samsonumzug', 'TA'), gau('g15', 'St. Gilgen am Wolfgangsee', 'SL'),
        gau('g16', 'Großglockner Hochalpenstraße, Nordrampe (Fusch/Bruck)', 'ZE'), gau('g17', 'Bischofshofen', 'JO'), gau('g18', 'Abtenau', 'HA'),
        gau('g19', 'Thalgau', 'SL'), gau('g20', 'Kaprun', 'ZE'), gau('g21', 'Flachau', 'JO'),
        gau('g22', 'St. Michael im Lungau', 'TA'), gau('g23', 'Dürrnberg', 'HA'), gau('g24', 'Lofer', 'ZE'),
        gau('g25', 'Wagrain', 'JO'), gau('g26', 'Bad Hofgastein', 'JO'), gau('g27', 'Taxenbach', 'ZE'),
        gau('g28', 'Lessach', 'TA'), gau('g29', 'Oberalm', 'HA'), gau('g30', 'Köstendorf', 'SL'),
      ]},
      { key: 'kuerzel', title: 'Abschlussfragen', instruction: 'Schreibe aus, wofür das Kürzel steht.', questions: [
        kz('gk1', 'SL', ['Salzburg-Umgebung']), kz('gk2', 'JO', ['St. Johann im Pongau', 'St. Johann']),
        kz('gk3', 'TA', ['Tamsweg']), kz('gk4', 'HA', ['Hallein']), kz('gk5', 'ZE', ['Zell am See']),
      ]},
    ],
  },
  {
    key: 'it', short: 'IT',
    title: 'Teil 3: IT-Verständnis',
    description: 'Wähle pro Frage die richtige Antwort. 25 Punkte.',
    minutes: 10,
    blocks: [
      { key: 'it', title: 'IT-Verständnis', instruction: 'Pro Frage ist genau eine Antwort richtig.', questions: [
        mc('it1', 'Was macht ein VPN?', ['Beschleunigt die Internetverbindung', 'Baut einen verschlüsselten Tunnel durch ein unsicheres Netz', 'Löscht Viren', 'Vergibt IP-Adressen'], 'b'),
        mc('it2', 'Wofür ist DNS zuständig?', ['Verschlüsselt E-Mails', 'Vergibt IP-Adressen automatisch', 'Übersetzt Namen (z. B. Webadressen) in IP-Adressen', 'Sichert Daten'], 'c'),
        mc('it3', 'Welche Aufgabe hat eine Firewall?', ['Filtert den Datenverkehr nach festgelegten Regeln', 'Sichert Daten auf einem zweiten Medium', 'Überbrückt Stromausfälle', 'Sperrt den Bildschirm'], 'a'),
        mc('it4', 'Was ist Phishing?', ['Ein Kabelfehler', 'Ein Backup-Verfahren', 'Ein Virenscanner', 'Ein Betrugsversuch, um Zugangsdaten zu erschleichen'], 'd'),
        mc('it5', 'Was bedeutet Zwei-Faktor-Authentifizierung?', ['Zwei Benutzer melden sich gleichzeitig an', 'Anmeldung mit zwei verschiedenen Nachweisen (z. B. Passwort + Code)', 'Zwei gleiche Passwörter', 'Zwei Bildschirme'], 'b'),
        mc('it6', 'Was vergibt im Netzwerk automatisch IP-Adressen?', ['DHCP', 'DNS', 'VPN', 'HDMI'], 'a'),
        mc('it7', 'Welche dieser IP-Adressen ist eine private Adresse?', ['8.8.8.8', '93.184.216.34', '192.168.1.20', '1.1.1.1'], 'c'),
        mc('it8', 'Was besagt die 3-2-1-Backup-Regel?', ['3 Server, 2 Switches, 1 Router', '3 Passwörter, 2 Faktoren, 1 Code', '3 Monitore, 2 Tastaturen, 1 Maus', '3 Kopien, 2 verschiedene Medien, 1 extern gelagert'], 'd'),
        mc('it9', 'Was macht RAID 1?', ['Verteilt Daten ohne Redundanz', 'Spiegelt Daten auf zwei Platten', 'Verschlüsselt Daten', 'Komprimiert Daten'], 'b'),
        mc('it10', 'Wozu dient eine USV?', ['Überbrückt kurze Stromausfälle', 'Beschleunigt das Internet', 'Verschlüsselt Daten', 'Trennt Netzwerke'], 'a'),
        mc('it11', 'Wie viele Bit hat ein Byte?', ['4', '16', '8', '10'], 'c'),
        mc('it12', 'Welches Gerät verbindet mehrere Geräte im lokalen Netzwerk?', ['Monitor', 'Drucker', 'Webcam', 'Switch'], 'd'),
        mc('it13', 'Was ist eine SSD?', ['Speicher ohne bewegliche Teile (Flash)', 'Magnetplatte mit Schreibkopf', 'Netzteil', 'Grafikkarte'], 'a'),
        mc('it14', 'Woran erkennt man eine verschlüsselte Webverbindung?', ['HTTP', 'HTTPS', 'FTP', 'Telnet'], 'b'),
        mc('it15', 'Welches Passwort ist am sichersten?', ['Geburtsdatum', 'Passwort123', 'Lang, zufällig, nur für diesen einen Dienst', 'Name des Haustiers'], 'c'),
        mc('it16', 'Was passiert bei einem DDoS-Angriff?', ['Daten werden verschlüsselt', 'Passwort wird erraten', 'E-Mail wird gefälscht', 'Ein Dienst wird mit Anfragen überlastet'], 'd'),
        mc('it17', 'Was ist Ransomware?', ['Schadsoftware, die Daten verschlüsselt und Lösegeld fordert', 'Antivirenprogramm', 'Backup-Werkzeug', 'Firewall-Typ'], 'a'),
        mc('it18', 'Was ist WPA3?', ['Eine Kabelart', 'Ein WLAN-Sicherheitsstandard', 'Ein Frequenzband', 'Eine Router-Marke'], 'b'),
        mc('it19', 'Ein Server fällt aus und ein zweiter übernimmt automatisch. Das nennt man …', ['Phishing', 'Routing', 'Failover', 'Backup'], 'c'),
        mc('it20', 'Was ist Cloud-Speicher?', ['USB-Stick', 'Lokale Festplatte', 'Arbeitsspeicher', 'Speicher auf Servern eines Anbieters, erreichbar über das Internet'], 'd'),
        mc('it21', 'Was unterscheidet RAM von einer Festplatte?', ['RAM speichert dauerhaft, die Festplatte flüchtig', 'RAM ist flüchtiger Arbeitsspeicher, die Festplatte speichert dauerhaft', 'Beides ist gleich', 'RAM ist nur für Bilder'], 'b'),
        mc('it22', '1 GB entspricht etwa …', ['1000 MB', '100 MB', '10 MB', '1 Million MB'], 'a'),
        mc('it23', 'Welche Dateiendung gehört typischerweise zu einem komprimierten Archiv?', ['.txt', '.jpg', '.zip', '.mp3'], 'c'),
        mc('it24', 'Wozu dient der Befehl „ping“?', ['Datei löschen', 'Passwort ändern', 'Drucken', 'Prüfen, ob ein Gerät im Netz erreichbar ist'], 'd'),
        mc('it25', 'Wozu dient ein Update bzw. Patch?', ['Behebt Fehler und schließt Sicherheitslücken', 'Löscht Daten', 'Dimmt den Bildschirm', 'Sperrt den Zugang'], 'a'),
      ]},
    ],
  },
  {
    key: 'motivation', short: 'Motivation',
    title: 'Motivationstext',
    description: 'Fasse in etwa 100 Wörtern zusammen, warum du dich bewirbst. Mit „Abschließen“ gibst du den Text endgültig ab, danach ist er nicht mehr veränderbar.',
    minutes: 6,
    blocks: [
      { key: 'motivation', title: 'Motivation für die Bewerbung', instruction: 'Schreibe etwa 100 Wörter. Wenn du fertig bist, klicke auf „Abschließen“.', questions: [
        { id:'mo1', type:'writing', text:'Warum bewirbst du dich bei uns?', targetWords:100, final:true },
      ]},
    ],
  },
  {
    key: 'pause', short: 'Pause', kind: 'pause',
    title: 'Pause',
    description: 'Pflichtpause von 5 Minuten. Weiter geht es erst, wenn die Pause abgelaufen ist.',
    minutes: 5, blocks: [],
  },
  {
    key: 'englisch', short: 'Englisch',
    title: 'Teil 4: Englisch',
    description: 'Wähle pro Frage die richtige Antwort. 25 Punkte.',
    minutes: 8,
    blocks: [
      { key: 'englisch', title: 'Englisch', instruction: 'Pro Frage ist genau eine Antwort richtig.', questions: [
        mc('en1', '„unconscious“ bedeutet …', ['bewusstlos', 'unvorsichtig', 'unverletzt', 'ungeduldig'], 'a'),
        mc('en2', '„choking“ bedeutet …', ['husten', 'ersticken / Atemwege verlegt', 'erbrechen', 'frieren'], 'b'),
        mc('en3', 'Welcher Satz ist richtig?', ['Is he breathe?', 'Is he breathing?', 'Does he breathing?', 'He is breathe?'], 'b'),
        mc('en4', '„Please stay on the line.“ heißt …', ['Bitte gehen Sie in die Reihe.', 'Bitte rufen Sie später an.', 'Bleiben Sie bitte in der Leitung.', 'Legen Sie bitte auf.'], 'c'),
        mc('en5', '„The building is on fire.“ heißt …', ['Das Gebäude ist verlassen.', 'Das Gebäude brennt.', 'Das Gebäude stürzt ein.', 'Das Gebäude ist neu.'], 'b'),
        mc('en6', 'My wife ___ a pain in her chest.', ['have', 'has', 'are', 'do'], 'b'),
        mc('en7', '„How many people are injured?“ heißt …', ['Wie viele Personen sind betroffen?', 'Wie viele Personen sind tot?', 'Wie viele Personen sind verletzt?', 'Wie viele Personen sind vermisst?'], 'c'),
        mc('en8', 'The car ___ into a tree yesterday.', ['crash', 'crashes', 'crashed', 'crashing'], 'c'),
        mc('en9', '„Turn left at the traffic lights.“ heißt …', ['Rechts abbiegen bei der Kreuzung.', 'Links abbiegen bei der Ampel.', 'Geradeaus bei der Ampel.', 'Links abbiegen beim Kreisverkehr.'], 'b'),
        mc('en10', 'Welches Wort bedeutet dasselbe wie „immediately“?', ['later', 'slowly', 'right away', 'sometimes'], 'c'),
        mc('en11', '„I can’t feel my legs.“ heißt …', ['Ich kann meine Beine nicht bewegen.', 'Ich spüre meine Beine nicht.', 'Meine Beine tun weh.', 'Ich habe keine Beine.'], 'b'),
        mc('en12', 'Welche Frage erfragt die Adresse?', ['What is your address?', 'What is your age?', 'What is your name?', 'What happened?'], 'a'),
        mc('en13', 'He ___ from a ladder.', ['falled', 'fall', 'fell', 'felt'], 'c'),
        mc('en14', '„trapped“ bedeutet …', ['eingeklemmt / eingeschlossen', 'verletzt', 'verloren', 'verbrannt'], 'a'),
        mc('en15', '„Do not hang up.“ heißt …', ['Nicht aufhängen.', 'Nicht auflegen.', 'Nicht anrufen.', 'Nicht warten.'], 'b'),
        mc('en16', '„chest pain“ bedeutet …', ['Brustschmerzen', 'Rückenschmerzen', 'Kopfschmerzen', 'Bauchschmerzen'], 'a'),
        mc('en17', '„How old is the patient?“ heißt …', ['Wie schwer ist der Patient?', 'Wie groß ist der Patient?', 'Wie alt ist der Patient?', 'Wie heißt der Patient?'], 'c'),
        mc('en18', 'He ___ lying on the floor.', ['are', 'do', 'have', 'is'], 'd'),
        mc('en19', '„Is the person conscious?“ heißt …', ['Ist die Person verletzt?', 'Ist die Person allein?', 'Ist die Person bei Bewusstsein?', 'Ist die Person aggressiv?'], 'c'),
        mc('en20', '„smoke“ bedeutet …', ['Rauch', 'Feuer', 'Wasser', 'Gas'], 'a'),
        mc('en21', '„I’m sending an ambulance.“ heißt …', ['Ich schicke einen Rettungswagen.', 'Ich rufe einen Arzt.', 'Ich fahre selbst.', 'Ich bin im Krankenhaus.'], 'a'),
        mc('en22', 'She ___ no pulse.', ['have', 'are', 'is', 'has'], 'd'),
        mc('en23', '„Can you repeat that, please?“ heißt …', ['Können Sie das bitte buchstabieren?', 'Können Sie bitte lauter sprechen?', 'Können Sie das bitte wiederholen?', 'Können Sie bitte warten?'], 'c'),
        mc('en24', '„to evacuate“ bedeutet …', ['verletzen', 'bergen', 'evakuieren', 'löschen'], 'c'),
        mc('en25', '„Where exactly are you?“ heißt …', ['Wo genau sind Sie?', 'Wer sind Sie?', 'Was ist passiert?', 'Wie geht es Ihnen?'], 'a'),
      ]},
    ],
  },
  {
    key: 'logik', short: 'Logik',
    title: 'Zahlenreihen und logisches Denken',
    description: 'Zahlenreihen fortsetzen, danach Aufgaben zum logischen Denken. Die Aufgaben werden schwieriger.',
    minutes: 8,
    blocks: [
      { key: 'zahlenreihen', title: 'Zahlenreihen', instruction: 'Setze die Zahlenreihe fort.', questions: [
        { id:'z1', type:'number', text:'3, 6, 9, 12, ?', answer:15 },
        { id:'z2', type:'number', text:'64, 32, 16, 8, ?', answer:4 },
        { id:'z3', type:'number', text:'2, 6, 18, 54, ?', answer:162 },
        { id:'z4', type:'number', text:'1, 2, 4, 7, 11, ?', answer:16 },
        { id:'z5', type:'number', text:'5, 10, 8, 16, 14, ?', answer:28 },
        { id:'z6', type:'number', text:'3, 4, 7, 11, 18, ?', answer:29 },
        { id:'z7', type:'number', text:'2, 3, 5, 9, 17, ?', answer:33 },
        { id:'z8', type:'number', text:'1, 1, 2, 6, 24, ?', answer:120 },
        { id:'z9', type:'number', text:'2, 5, 11, 23, 47, ?', answer:95 },
        { id:'z10', type:'number', text:'7, 10, 16, 28, 52, ?', answer:100 },
        { id:'z11', type:'number', text:'1, 2, 6, 15, 31, ?', answer:56 },
        { id:'z12', type:'number', text:'2, 12, 30, 56, 90, ?', answer:132 },
        { id:'z13', type:'number', text:'2, 4, 3, 9, 8, 64, ?', answer:63 },
        { id:'z14', type:'number', text:'1, 4, 27, 256, ?', answer:3125 },
      ]},
      { key: 'logik', title: 'Logisches Denken', instruction: 'Wähle die richtige Antwort.', questions: [
        { id:'l1', type:'choice', text:'Feuerwehr : Brand = Rettung : ?', options:['Krankenhaus','Notfall','Sirene','Arzt'], answer:1 },
        { id:'l2', type:'choice', text:'Welches Wort passt nicht in die Reihe?', options:['RTW','NEF','KTW','Drehleiter'], answer:3 },
        { id:'l3', type:'choice', text:'Welches Zeichen ergänzt die Matrix?', pre:'■   □   ■\n□   ■   □\n■   □   ?', options:['□','●','■','▲'], answer:2 },
        { id:'l4', type:'choice', text:'Alle Einsatzfahrzeuge haben Funk. Wagen 7 hat keinen Funk. Was folgt daraus sicher?',
          options:['Wagen 7 ist ein Einsatzfahrzeug.','Wagen 7 ist kein Einsatzfahrzeug.','Alle Fahrzeuge ohne Funk sind Einsatzfahrzeuge.','Darüber lässt sich nichts sagen.'], answer:1 },
        { id:'l5', type:'choice', text:'Wenn es regnet, ist die Straße nass. Die Straße ist nass. Was folgt daraus sicher?',
          options:['Es regnet.','Es hat geregnet.','Es regnet nicht.','Nichts davon folgt sicher.'], answer:3 },
        { id:'l6', type:'choice', text:'Anna ist älter als Ben. Clara ist jünger als Ben. David ist älter als Anna. Wer ist am jüngsten?',
          options:['Anna','Ben','Clara','David'], answer:2 },
      ]},
    ],
  },
  {
    key: 'merken', short: 'Merkfähigkeit',
    title: 'Merkfähigkeit',
    description: 'Eine Einsatzmeldung wird kurz eingeblendet und verschwindet dann. Danach folgen Fragen dazu.',
    minutes: 4,
    blocks: [
      { key: 'einsatz', title: 'Einsatzmeldung', instruction: 'Beantworte die Fragen aus dem Gedächtnis.',
        memorize: { seconds: 60, text: 'Merke dir die Einsatzmeldung.', facts: [
          'Einsatznummer: 26-30518', 'Stichwort: Verkehrsunfall mit 2 PKW', 'Ort: B1, Kilometer 47,3, Richtung Salzburg',
          'Verletzte: 3, davon 1 eingeklemmt', 'Alarmiert: RTW 20-202, NEF 10-101, FF Eugendorf'] },
        questions: [
          { id:'m1', type:'choice', text:'Wie lautete die Einsatznummer?', options:['26-30518','26-35018','26-30581','26-03518'], answer:0 },
          { id:'m2', type:'number', text:'Wie viele Personen waren verletzt?', answer:3 },
          { id:'m3', type:'choice', text:'Bei welchem Kilometer war der Unfall?', options:['43,7','74,3','47,3','37,4'], answer:2 },
          { id:'m4', type:'choice', text:'In welche Richtung?', options:['Richtung Wien','Richtung Linz','Richtung Salzburg','Richtung Graz'], answer:2 },
          { id:'m5', type:'choice', text:'Welches Fahrzeug wurde NICHT alarmiert?', options:['RTW 20-202','NEF 10-101','FF Eugendorf','RTW 20-205'], answer:3 },
        ]},
    ],
  },
  {
    key: 'rechnen', short: 'Rechnen',
    title: 'Rechnen und Zahlenverständnis',
    description: 'Grundrechnungsarten, Prozent und Dreisatz, Textaufgaben aus dem Einsatzalltag. Kein Taschenrechner.',
    minutes: 10,
    blocks: [
      { key: 'grundrechnen', title: 'Grundrechnungsarten', instruction: 'Rechne im Kopf. Achte auf Punkt vor Strich.', questions: [
        { id:'mr1', type:'number', text:'34 + 58 = ?', answer:92 },
        { id:'mr2', type:'number', text:'127 + 46 = ?', answer:173 },
        { id:'mr3', type:'number', text:'289 + 315 = ?', answer:604 },
        { id:'mr4', type:'number', text:'1.450 + 780 = ?', answer:2230 },
        { id:'mr5', type:'number', text:'67 + 98 + 45 = ?', answer:210 },
        { id:'mr6', type:'number', text:'93 − 47 = ?', answer:46 },
        { id:'mr7', type:'number', text:'250 − 128 = ?', answer:122 },
        { id:'mr8', type:'number', text:'1.000 − 456 = ?', answer:544 },
        { id:'mr9', type:'number', text:'812 − 379 = ?', answer:433 },
        { id:'mr10', type:'number', text:'2.005 − 1.998 = ?', answer:7 },
        { id:'mr11', type:'number', text:'7 × 8 = ?', answer:56 },
        { id:'mr12', type:'number', text:'12 × 15 = ?', answer:180 },
        { id:'mr13', type:'number', text:'25 × 16 = ?', answer:400 },
        { id:'mr14', type:'number', text:'9 × 13 = ?', answer:117 },
        { id:'mr15', type:'number', text:'45 × 20 = ?', answer:900 },
        { id:'mr16', type:'number', text:'72 : 8 = ?', answer:9 },
        { id:'mr17', type:'number', text:'144 : 12 = ?', answer:12 },
        { id:'mr18', type:'number', text:'630 : 7 = ?', answer:90 },
        { id:'mr19', type:'number', text:'1.200 : 25 = ?', answer:48 },
        { id:'mr20', type:'number', text:'91 : 13 = ?', answer:7 },
        { id:'mr21', type:'number', text:'2² (2 hoch 2) = ?', answer:4 },
        { id:'mr22', type:'number', text:'√25 (Wurzel aus 25) = ?', answer:5 },
        { id:'mr23', type:'number', text:'10³ (10 hoch 3) = ?', answer:1000 },
        { id:'mr24', type:'number', text:'√81 (Wurzel aus 81) = ?', answer:9 },
        { id:'mr25', type:'number', text:'5² (5 hoch 2) = ?', answer:25 },
        { id:'mr26', type:'number', text:'3 + 4 × 2 = ?', answer:11 },
        { id:'mr27', type:'number', text:'20 − 6 : 2 = ?', answer:17 },
        { id:'mr28', type:'number', text:'5 × 3 + 2 × 4 = ?', answer:23 },
        { id:'mr29', type:'number', text:'18 : 3 − 1 = ?', answer:5 },
        { id:'mr30', type:'number', text:'10 + 2 × 5 − 4 = ?', answer:16 },
      ]},
      { key: 'prozent', title: 'Prozent und Dreisatz', instruction: 'Gib das Ergebnis als Zahl ein.', questions: [
        { id:'r6', type:'number', text:'Wie viel sind 20 % von 350?', answer:70 },
        { id:'r7', type:'number', text:'Ein RTW verbraucht 12 Liter Diesel auf 100 km. Wie viele Liter braucht er für 250 km?', answer:30 },
        { id:'r8', type:'number', text:'Ein Gerät kostet 240 € und wird um 15 % billiger. Wie viel Euro kostet es danach?', answer:204 },
        { id:'r9', type:'number', text:'Ein Medikament wird mit 5 mg pro kg Körpergewicht dosiert. Wie viele mg bekommt ein Patient mit 72 kg?', answer:360 },
        { id:'r10', type:'number', text:'Von 80 Einsätzen waren 18 Fehlalarme. Wie viel Prozent sind das?', answer:22.5, tol:0.01 },
      ]},
      { key: 'text', title: 'Textaufgaben', instruction: 'Gib das Ergebnis als Zahl ein.', questions: [
        { id:'r11', type:'number', text:'RTW 20-204 fährt um 14:52 Uhr los und ist um 15:09 Uhr am Einsatzort. Wie viele Minuten dauert die Anfahrt?', answer:17 },
        { id:'r12', type:'number', text:'In 12 Stunden gehen 168 Notrufe ein, gleichmäßig verteilt. Wie viele Notrufe sind das pro Stunde?', answer:14 },
        { id:'r13', type:'number', text:'Ein Tank fasst 80 Liter und ist zu drei Vierteln voll. Wie viele Liter fehlen, bis er voll ist?', answer:20 },
        { id:'r14', type:'number', text:'Ein NEF fährt mit 90 km/h zu einem 12 km entfernten Einsatzort. Wie viele Minuten braucht es?', answer:8 },
        { id:'r15', type:'number', text:'Eine Schicht dauert 12 Stunden. Nach der 4. und nach der 8. Stunde gibt es je 20 Minuten Pause. Wie viele Minuten wird ohne Pausen gearbeitet?', answer:680 },
      ]},
    ],
  },
  {
    key: 'persoenlichkeit', short: 'Persönlichkeit',
    title: 'Persönlichkeitsfragen',
    description: 'Wie sehr trifft die Aussage auf dich zu? Es gibt kein Richtig oder Falsch. Antworte spontan.',
    minutes: 5, dims: DIMS,
    scale: ['trifft gar nicht zu', 'trifft eher nicht zu', 'teils, teils', 'trifft eher zu', 'trifft voll zu'],
    blocks: [
      { key: 'persoenlichkeit', title: 'Persönlichkeitsfragen', instruction: '1 = trifft gar nicht zu … 5 = trifft voll zu', questions: [
        { id:'p6', type:'likert', text:'Mich stören Kleinigkeiten, die anderen gar nicht auffallen.', dim:'A', pole:'b' },
        { id:'p36', type:'likert', text:'Ich mache mir lieber selbst Notizen, als mich auf Systeme oder Checklisten anderer zu verlassen.', dim:'F', pole:'b' },
        { id:'p13', type:'likert', text:'Ich arbeite am besten, wenn kurz vor Schluss noch richtig Druck da ist.', dim:'C', pole:'a' },
        { id:'p20', type:'likert', text:'Ich halte mich mit meiner Meinung zurück, bis ich die Lage gut kenne.', dim:'D', pole:'b' },
        { id:'p16', type:'likert', text:'Unerledigte Aufgaben gehen mir auch in der Freizeit durch den Kopf.', dim:'C', pole:'b' },
        { id:'p11', type:'likert', text:'Mir fällt es leichter, eine falsche Entscheidung zu korrigieren, als gar keine zu treffen.', dim:'B', pole:'a' },
        { id:'p31', type:'likert', text:'Ich habe gern feste Abläufe, auch wenn sie manchmal umständlich sind.', dim:'F', pole:'a' },
        { id:'p22', type:'likert', text:'Mir ist ein gutes Klima im Team wichtiger, als in jeder Sachfrage recht zu behalten.', dim:'D', pole:'b' },
        { id:'p9', type:'likert', text:'Wenn ich zu lange über eine Entscheidung nachdenke, wird sie meist nicht besser.', dim:'B', pole:'a' },
        { id:'p12', type:'likert', text:'Ich habe lieber klare Regeln, als jedes Mal selbst abwägen zu müssen.', dim:'B', pole:'b' },
        { id:'p40', type:'likert', text:'Ich habe noch nie etwas gesagt, das ich später bereut habe.', dim:'G' },
        { id:'p1', type:'likert', text:'Eine schnelle, gute Lösung ist mir oft lieber als eine perfekte, die später kommt.', dim:'A', pole:'a' },
        { id:'p29', type:'likert', text:'Unhöflichkeit von anderen nehme ich mir manchmal länger zu Herzen, als ich sollte.', dim:'E', pole:'a' },
        { id:'p15', type:'likert', text:'Wenn viel auf einmal kommt, werde ich eher ruhiger als hektischer.', dim:'C', pole:'a' },
        { id:'p39', type:'likert', text:'Ich bin immer freundlich, auch wenn ich müde bin.', dim:'G' },
        { id:'p19', type:'likert', text:'Ich bin bei Teamentscheidungen oft diejenige oder derjenige, die oder der zuerst etwas vorschlägt.', dim:'D', pole:'a' },
        { id:'p23', type:'likert', text:'Ich sage offen, wenn ich die Arbeit einer Kollegin oder eines Kollegen für schlecht halte.', dim:'D', pole:'a' },
        { id:'p32', type:'likert', text:'Wiederkehrende Tätigkeiten erledige ich gern, weil ich dabei sicher bin.', dim:'F', pole:'a' },
        { id:'p28', type:'likert', text:'In schwierigen Gesprächen konzentriere ich mich mehr auf die Fakten als auf die Gefühle.', dim:'E', pole:'b' },
        { id:'p25', type:'likert', text:'Wenn jemand am Telefon weint, fällt es mir schwer, sachlich zu bleiben.', dim:'E', pole:'a' },
        { id:'p18', type:'likert', text:'Ich merke Stress bei mir körperlich, bevor ich ihn bewusst wahrnehme.', dim:'C', pole:'b' },
        { id:'p33', type:'likert', text:'Ich probiere gern neue Wege aus, auch wenn der alte funktioniert hat.', dim:'F', pole:'b' },
        { id:'p8', type:'likert', text:'Bevor ich mich entscheide, frage ich gern noch jemanden nach seiner Meinung.', dim:'B', pole:'b' },
        { id:'p27', type:'likert', text:'Ich spüre oft, dass etwas nicht stimmt, bevor es jemand ausspricht.', dim:'E', pole:'a' },
        { id:'p38', type:'likert', text:'Ich war noch nie auf jemanden neidisch.', dim:'G' },
        { id:'p14', type:'likert', text:'Ich brauche nach einem stressigen Erlebnis kurz Zeit für mich, bevor ich weitermachen kann.', dim:'C', pole:'b' },
        { id:'p3', type:'likert', text:'Bei Routineaufgaben verlasse ich mich auf meine Erfahrung, statt jeden Schritt zu prüfen.', dim:'A', pole:'a' },
        { id:'p2', type:'likert', text:'Ich lese eine Anweisung meist ganz, bevor ich anfange, auch wenn ich ungefähr weiß, worum es geht.', dim:'A', pole:'b' },
        { id:'p34', type:'likert', text:'Wenn ein Plan sich kurzfristig ändert, ärgert mich das zuerst einmal.', dim:'F', pole:'a' },
        { id:'p17', type:'likert', text:'Ein Tag ohne Überraschungen ist für mich eher langweilig als angenehm.', dim:'C', pole:'a' },
        { id:'p30', type:'likert', text:'Andere halten mich manchmal für kühler, als ich bin.', dim:'E', pole:'b' },
        { id:'p37', type:'likert', text:'Ich habe noch nie eine Aufgabe aufgeschoben.', dim:'G' },
        { id:'p24', type:'likert', text:'Ich arbeite gern an Aufgaben, bei denen ich nicht ständig abstimmen muss.', dim:'D', pole:'b' },
        { id:'p7', type:'likert', text:'Meine ersten Eindrücke von Menschen stellen sich meistens als richtig heraus.', dim:'B', pole:'a' },
        { id:'p35', type:'likert', text:'Ich langweile mich schnell, wenn eine Aufgabe zu lange gleich bleibt.', dim:'F', pole:'b' },
        { id:'p5', type:'likert', text:'Ich fange lieber an und korrigiere unterwegs, als lange zu planen.', dim:'A', pole:'a' },
        { id:'p4', type:'likert', text:'Ich werde unruhig, wenn ich etwas abgeben muss, das ich nicht noch einmal kontrollieren konnte.', dim:'A', pole:'b' },
        { id:'p26', type:'likert', text:'Ich kann mich gut von den Problemen anderer abgrenzen.', dim:'E', pole:'b' },
        { id:'p10', type:'likert', text:'Ich ändere meine Meinung, wenn jemand ein gutes Argument hat, auch mitten in der Umsetzung.', dim:'B', pole:'b' },
        { id:'p21', type:'likert', text:'Wenn etwas schiefläuft, übernehme ich lieber selbst, statt zu erklären, wie es geht.', dim:'D', pole:'a' },
      ]},
    ],
  },
  {
    key: 'abschrift', short: 'Abschrift',
    title: 'Abschrift vom Blatt',
    description: 'Schreibe den Text vom vorgelegten Blatt so schnell und so genau wie möglich ab. Ein Wort kannst du nur korrigieren, solange du noch kein Leerzeichen gesetzt hast, danach ist es gesperrt. Markieren und Einfügen sind nicht möglich.',
    minutes: 10,
    blocks: [
      { key: 'abschrift', title: 'Abschrift vom Blatt', instruction: 'Abgeschlossene Wörter (nach dem Leerzeichen) lassen sich nicht mehr ändern. Wenn du fertig bist, klicke auf „Abschließen“.', questions: [
        { id:'ab1', type:'writing', text:'Schreibe den Text vom vorgelegten Blatt ab.', lockWords:true, final:true },
      ]},
    ],
  },
];

module.exports = { SECTIONS, DIMS };
