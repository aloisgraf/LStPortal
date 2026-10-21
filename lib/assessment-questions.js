'use strict';
// Fragenkatalog des Assessments (Ablauf/Auswertung: lib/assessment.js). Die
// Lösungen (answer) verlassen nie den Server.
// Typen: choice (answer = Index der richtigen Option), number (answer = Zahl, tol = Toleranz),
// likert (Persönlichkeit, 1–5, kein richtig/falsch; dim = Dimension, reverse = umgekehrt gepolt).

const NET_CROSS =
`      [ A ]
[ B ] [ C ] [ D ] [ E ]
                  [ F ]`;

const DIAGRAM =
`Monat     | Einsätze
----------+---------
Jänner    |   420
Februar   |   380
März      |   455
April     |   545`;

const PASSAGE_DE =
`Seit Jahresbeginn gilt in der Leitstelle ein neues Schichtmodell. Statt drei Schichten zu je acht Stunden arbeiten die Teams nun in zwei Schichten zu je zwölf Stunden. Ziel ist es, die Zahl der Übergaben zu verringern, da bei jeder Übergabe Informationen verloren gehen können. Kritiker befürchten jedoch, dass die Konzentration gegen Ende einer langen Schicht nachlässt. Deshalb wurden zusätzliche Pausen eingeführt: Nach jeweils vier Stunden ist eine Pause von mindestens 20 Minuten vorgeschrieben. Nach einem halben Jahr soll das Modell anhand der Fehlerquote bewertet werden.`;

const PASSAGE_EN =
`Dear Ms Huber,

Thank you for your order of 12 March. Unfortunately, two of the five items are currently out of stock. We expect a new delivery at the end of next week.

We can either send the available items now and the remaining two later at no extra cost, or ship the complete order once everything is in stock. Please let us know which option you prefer by Friday.

Kind regards,
Tom Baker, Customer Service`;

const SECTIONS = [
  {
    key: 'kognitiv',
    title: 'Kognitive Fähigkeiten',
    description: 'Logisches Denken, räumliches Vorstellungsvermögen, Konzentration und Merkfähigkeit.',
    minutes: 12,
    memorize: {
      seconds: 45,
      text: 'Merke dir folgende Angaben. Fragen dazu kommen am Ende dieses Abschnitts.',
      facts: [
        'Ansprechpartnerin: Frau Berger, Abteilung Einkauf',
        'Durchwahl: 4127',
        'Termin: Donnerstag, 14:30 Uhr',
        'Raum: B 2.14',
        'Projekt: „Nordlicht“',
        'Budget: 18.500 Euro',
      ],
    },
    questions: [
      { id:'k1',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 2, 4, 8, 16, ?', answer:32 },
      { id:'k2',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 3, 5, 9, 15, 23, ?', answer:33 },
      { id:'k3',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 81, 27, 9, 3, ?', answer:1 },
      { id:'k4',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 2, 3, 5, 8, 13, ?', answer:21 },
      { id:'k5',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 4, 6, 12, 14, 28, 30, ?', answer:60 },
      { id:'k6',  topic:'Logisches Denken', type:'number', text:'Setze die Zahlenreihe fort: 1, 4, 9, 16, 25, ?', answer:36 },
      { id:'k7',  topic:'Analogien', type:'choice', text:'Kopf : Hut = Hand : ?', options:['Finger','Handschuh','Arm','Ring'], answer:1 },
      { id:'k8',  topic:'Analogien', type:'choice', text:'Arzt : Krankenhaus = Lehrer : ?', options:['Schüler','Tafel','Schule','Ferien'], answer:2 },
      { id:'k9',  topic:'Figurenmatrix', type:'choice', text:'Welche Figur ergänzt die Matrix?',
        pre:'○      ○○      ○○○\n△      △△      △△△\n□      □□      ?', options:['□','□□□□','△△△','□□□'], answer:3 },
      { id:'k10', topic:'Figurenmatrix', type:'choice', text:'Welche Figur ergänzt die Matrix?',
        pre:'▲   ▼   ▲\n▼   ▲   ▼\n▲   ▼   ?', options:['▼','▲','■','●'], answer:1 },
      { id:'k11', topic:'Logisches Denken', type:'choice',
        text:'Alle Disponenten sind Mitarbeiter. Einige Mitarbeiter arbeiten nachts. Welche Aussage folgt daraus sicher?',
        options:['Einige Disponenten arbeiten nachts.','Alle Mitarbeiter sind Disponenten.','Kein Disponent arbeitet nachts.','Keine dieser Aussagen folgt sicher.'], answer:3 },
      { id:'k12', topic:'Räumliches Vorstellungsvermögen', type:'number',
        text:'Bei einem Spielwürfel ergeben gegenüberliegende Seiten zusammen immer 7. Oben liegt die 2, vorne die 3. Welche Zahl liegt unten?', answer:5 },
      { id:'k13', topic:'Räumliches Vorstellungsvermögen', type:'number',
        text:'Ein Spielwürfel (Gegenseiten ergeben 7) zeigt oben die 1 und vorne die 2. Er wird einmal nach vorne gekippt, sodass die bisherige Oberseite nun vorne liegt. Welche Zahl liegt jetzt oben?', answer:5 },
      { id:'k14', topic:'Räumliches Vorstellungsvermögen', type:'choice',
        text:'Die abgebildete Faltvorlage wird zu einem Würfel gefaltet. Welche Fläche liegt gegenüber von A?', pre:NET_CROSS,
        options:['C','D','E','F'], answer:3 },
      { id:'k15', topic:'Räumliches Vorstellungsvermögen', type:'choice',
        text:'Dieselbe Faltvorlage: Welche Fläche liegt gegenüber von C?', pre:NET_CROSS,
        options:['B','D','E','F'], answer:2 },
      { id:'k16', topic:'Datenabgleich', type:'choice', text:'Sind die beiden Zeilen identisch?',
        pre:'Mayrhofer, Ing. Johann – 0664/3381927 – Lindenweg 14a\nMayrhofer, Ing. Johann – 0664/3381927 – Lindenweg 14a', options:['identisch','nicht identisch'], answer:0 },
      { id:'k17', topic:'Datenabgleich', type:'choice', text:'Sind die beiden Zeilen identisch?',
        pre:'Leitstelle Nord – Einsatz 26-04417 – 07:42 – RTW 3/12\nLeitstelle Nord – Einsatz 26-04471 – 07:42 – RTW 3/12', options:['identisch','nicht identisch'], answer:1 },
      { id:'k18', topic:'Postkorb', type:'choice', text:'Du findest morgens folgende Aufgaben vor. Was erledigst du zuerst?',
        options:['E-Mail der Chefin: Urlaubsplanung bis Freitag abgeben','Anruf: Ein Kunde meldet einen Systemausfall, der seit 10 Minuten den Betrieb blockiert','Kollege bittet um Hilfe bei einer Präsentation für nächste Woche','Firmen-Newsletter lesen'], answer:1 },
      { id:'k19', topic:'Postkorb', type:'choice', text:'Welche Aufgabe kannst du am ehesten verschieben oder delegieren?',
        options:['Rückruf an den Geschäftsführer, der die Zahlen heute vor 12 Uhr braucht','Sicherheitsmeldung: Ein Notausgang ist verstellt','Bestellung von Büromaterial – der Vorrat reicht noch drei Wochen','Angebotsfrist endet heute um 16 Uhr'], answer:2 },
      { id:'k20', topic:'Merkfähigkeit', memory:true, type:'number', text:'Wie lautete die Durchwahl von Frau Berger?', answer:4127 },
      { id:'k21', topic:'Merkfähigkeit', memory:true, type:'choice', text:'An welchem Wochentag war der Termin?', options:['Montag','Dienstag','Donnerstag','Freitag'], answer:2 },
      { id:'k22', topic:'Merkfähigkeit', memory:true, type:'choice', text:'Wie hoch war das Budget?', options:['15.800 Euro','18.050 Euro','18.500 Euro','81.500 Euro'], answer:2 },
    ],
  },
  {
    key: 'mathe',
    title: 'Mathematik & Rechenfertigkeiten',
    description: 'Kopfrechnen, Brüche, Prozent- und Zinsrechnung, Textaufgaben und Diagramme. Kein Taschenrechner.',
    minutes: 12,
    questions: [
      { id:'m1',  topic:'Grundrechenarten', type:'number', text:'17 × 6 = ?', answer:102 },
      { id:'m2',  topic:'Grundrechenarten', type:'number', text:'144 : 12 + 7 × 3 = ?', answer:33 },
      { id:'m3',  topic:'Bruchrechnen', type:'choice', text:'3/4 + 1/8 = ?', options:['4/12','1/2','5/8','7/8'], answer:3 },
      { id:'m4',  topic:'Bruchrechnen', type:'number', text:'Wie viel sind 2/3 von 150?', answer:100 },
      { id:'m5',  topic:'Dreisatz', type:'number', text:'4 Maschinen brauchen für einen Auftrag 9 Stunden. Wie viele Stunden brauchen 6 gleiche Maschinen?', answer:6 },
      { id:'m6',  topic:'Prozentrechnung', type:'number', text:'Ein Gerät kostet 240 €. Wie viel kostet es nach 15 % Rabatt (in €)?', answer:204 },
      { id:'m7',  topic:'Prozentrechnung', type:'number', text:'Der Preis steigt von 80 € auf 100 €. Um wie viel Prozent ist er gestiegen?', answer:25 },
      { id:'m8',  topic:'Zinsrechnung', type:'number', text:'5.000 € werden ein Jahr lang zu 3 % Zinsen angelegt. Wie viel Euro Zinsen ergibt das?', answer:150 },
      { id:'m9',  topic:'Zinsrechnung', type:'number', text:'1.000 € werden zwei Jahre lang zu 10 % mit Zinseszins angelegt. Wie hoch ist der Endbetrag in €?', answer:1210 },
      { id:'m10', topic:'Textaufgabe', type:'number', text:'Ein Rettungswagen fährt 18 km mit durchschnittlich 72 km/h. Wie viele Minuten braucht er?', answer:15 },
      { id:'m11', topic:'Textaufgabe', type:'number', text:'7 Mitarbeiter arbeiten je 8,5 Stunden. Wie viele Arbeitsstunden sind das insgesamt?', answer:59.5, tol:0.01 },
      { id:'m12', topic:'Textaufgabe', type:'number', text:'Ein Lager enthält 1.200 Stück. Täglich werden 75 Stück verbraucht. Nach wie vielen Tagen ist das Lager leer?', answer:16 },
      { id:'m13', topic:'Diagrammanalyse', type:'number', text:'Wie viele Einsätze gab es im Durchschnitt pro Monat?', pre:DIAGRAM, answer:450 },
      { id:'m14', topic:'Diagrammanalyse', type:'choice', text:'In welchem Monat war der Anstieg gegenüber dem Vormonat am größten?', pre:DIAGRAM, options:['Februar','März','April','Es gab keinen Anstieg'], answer:2 },
      { id:'m15', topic:'Diagrammanalyse', type:'choice', text:'Welchen Anteil hat der Jänner an allen Einsätzen der vier Monate?', pre:DIAGRAM, options:['ca. 18 %','ca. 23 %','ca. 28 %','ca. 42 %'], answer:1 },
    ],
  },
  {
    key: 'sprache',
    title: 'Sprachbeherrschung (Deutsch)',
    description: 'Rechtschreibung, Grammatik, Wortschatz und Textverständnis.',
    minutes: 9,
    questions: [
      { id:'s1',  topic:'Rechtschreibung', type:'choice', text:'Welche Schreibweise ist richtig?', options:['Rythmus','Rhythmus','Rhytmus','Rytmus'], answer:1 },
      { id:'s2',  topic:'Rechtschreibung', type:'choice', text:'Welche Schreibweise ist richtig?', options:['Standart','Stantard','Standard','Standarth'], answer:2 },
      { id:'s3',  topic:'Rechtschreibung', type:'choice', text:'Welches Wort ist falsch geschrieben? „Die Vorraussetzung für die Teilnahme ist eine gültige Anmeldung.“',
        options:['Vorraussetzung','Teilnahme','gültige','Anmeldung'], answer:0 },
      { id:'s4',  topic:'Kommasetzung', type:'choice', text:'Welcher Satz ist richtig?',
        options:['Ich hoffe dass, du morgen pünktlich bist.','Ich hoffe, dass du morgen pünktlich bist.','Ich hoffe dass du, morgen pünktlich bist.','Ich, hoffe dass du morgen pünktlich bist.'], answer:1 },
      { id:'s5',  topic:'Groß-/Kleinschreibung', type:'choice', text:'Welcher Satz ist richtig?',
        options:['Wir wünschen ihnen alles gute.','Wir Wünschen Ihnen alles Gute.','Wir wünschen Ihnen alles Gute.','wir wünschen Ihnen Alles gute.'], answer:2 },
      { id:'s6',  topic:'Grammatik', type:'choice', text:'Ich weiß, ___ das Protokoll noch fehlt.', options:['das','dass','des','dessen'], answer:1 },
      { id:'s7',  topic:'Grammatik', type:'choice', text:'Wegen ___ Unwetters fiel der Termin aus.', options:['dem','den','das','des'], answer:3 },
      { id:'s8',  topic:'Wortschatz', type:'choice', text:'Welches Wort bedeutet dasselbe wie „präzise“?', options:['genau','schnell','vorsichtig','freundlich'], answer:0 },
      { id:'s9',  topic:'Wortschatz', type:'choice', text:'Welches Wort bedeutet dasselbe wie „temporär“?', options:['dauerhaft','zeitgemäß','vorübergehend','zügig'], answer:2 },
      { id:'s10', topic:'Wortschatz', type:'choice', text:'Was ist das Gegenteil von „fördern“?', options:['unterstützen','hemmen','verlangen','fordern'], answer:1 },
      { id:'s11', topic:'Wortschatz', type:'choice', text:'Was ist das Gegenteil von „explizit“?', options:['deutlich','komplex','implizit','extra'], answer:2 },
      { id:'s12', topic:'Wortanalogie', type:'choice', text:'hell : dunkel = laut : ?', options:['Lärm','hören','Ton','leise'], answer:3 },
      { id:'s13', topic:'Textverständnis', type:'choice', passage:PASSAGE_DE, text:'Warum wurde das neue Schichtmodell eingeführt?',
        options:['Um Personal einzusparen','Um die Zahl der Übergaben zu verringern','Weil die Mitarbeiter längere Schichten wollten','Um die Pausen zu verlängern'], answer:1 },
      { id:'s14', topic:'Textverständnis', type:'choice', passage:PASSAGE_DE, text:'Wie viele vorgeschriebene Pausen hat eine Schicht mindestens?', options:['1','2','3','4'], answer:1 },
      { id:'s15', topic:'Textverständnis', type:'choice', passage:PASSAGE_DE, text:'Woran soll das Modell bewertet werden?',
        options:['An der Mitarbeiterzufriedenheit','An den Kosten','An der Fehlerquote','An der Zahl der Einsätze'], answer:2 },
    ],
  },
  {
    key: 'englisch',
    title: 'Englisch',
    description: 'Business English, Grammatik und Leseverständnis.',
    minutes: 7,
    questions: [
      { id:'e1',  topic:'Business English', type:'choice', text:'What does „invoice“ mean?', options:['Einladung','Rechnung','Angebot','Lieferung'], answer:1 },
      { id:'e2',  topic:'Business English', type:'choice', text:'What does „deadline“ mean?', options:['Frist','Abteilung','Besprechung','Kündigung'], answer:0 },
      { id:'e3',  topic:'Business English', type:'choice', text:'„to postpone a meeting“ means …', options:['eine Besprechung absagen','eine Besprechung vorbereiten','eine Besprechung verschieben','eine Besprechung leiten'], answer:2 },
      { id:'e4',  topic:'Business English', type:'choice', text:'Which word means „Buchhaltung“?', options:['accountability','accounting','counting','account manager'], answer:1 },
      { id:'e5',  topic:'Grammar', type:'choice', text:'She ___ for this company since 2019.', options:['works','is working','worked','has worked'], answer:3 },
      { id:'e6',  topic:'Grammar', type:'choice', text:'If I ___ more time, I would help you.', options:['have','had','will have','would have'], answer:1 },
      { id:'e7',  topic:'Grammar', type:'choice', text:'We look forward to ___ from you.', options:['hear','heard','hearing','be hearing'], answer:2 },
      { id:'e8',  topic:'Grammar', type:'choice', text:'The report ___ by the manager yesterday.', options:['was approved','approved','has approved','is approving'], answer:0 },
      { id:'e9',  topic:'Grammar', type:'choice', text:'I haven\'t received the files ___.', options:['already','still','since','yet'], answer:3 },
      { id:'e10', topic:'Reading', type:'number', passage:PASSAGE_EN, text:'How many items can be sent now?', answer:3 },
      { id:'e11', topic:'Reading', type:'choice', passage:PASSAGE_EN, text:'What happens if Ms Huber chooses the partial delivery?',
        options:['She pays extra shipping costs.','There are no extra costs.','The order is cancelled.','She gets a discount.'], answer:1 },
      { id:'e12', topic:'Reading', type:'choice', passage:PASSAGE_EN, text:'What does Mr Baker ask Ms Huber to do?',
        options:['Pay by Friday','Call him back today','Choose an option by Friday','Order the items again'], answer:2 },
    ],
  },
  {
    key: 'persoenlichkeit',
    title: 'Persönlichkeit',
    description: 'Fragen zu Arbeitsstil, Teamfähigkeit und Umgang mit Stress. Hier gibt es kein Richtig oder Falsch – antworte spontan.',
    minutes: 5,
    scale: ['trifft gar nicht zu','trifft eher nicht zu','teils, teils','trifft eher zu','trifft völlig zu'],
    dims: { team:'Teamfähigkeit', stress:'Belastbarkeit', struktur:'Gewissenhaftigkeit', initiative:'Eigeninitiative' },
    questions: [
      { id:'p1',  type:'likert', dim:'team',       text:'Ich arbeite gerne mit anderen an einer gemeinsamen Lösung.' },
      { id:'p2',  type:'likert', dim:'stress',     text:'In hektischen Situationen behalte ich den Überblick.' },
      { id:'p3',  type:'likert', dim:'struktur',   text:'Ich plane meine Aufgaben, bevor ich damit beginne.' },
      { id:'p4',  type:'likert', dim:'initiative', text:'Ich mache Verbesserungsvorschläge, auch wenn niemand danach fragt.' },
      { id:'p5',  type:'likert', dim:'team',       text:'Ich erledige Aufgaben lieber allein, als mich mit anderen abzustimmen.', reverse:true },
      { id:'p6',  type:'likert', dim:'stress',     text:'Wenn mehrere Dinge gleichzeitig passieren, werde ich schnell nervös.', reverse:true },
      { id:'p7',  type:'likert', dim:'struktur',   text:'Ich halte Termine und Zusagen zuverlässig ein.' },
      { id:'p8',  type:'likert', dim:'initiative', text:'Ich warte lieber auf klare Anweisungen, bevor ich handle.', reverse:true },
      { id:'p9',  type:'likert', dim:'team',       text:'Ich teile mein Wissen bereitwillig mit Kolleginnen und Kollegen.' },
      { id:'p10', type:'likert', dim:'stress',     text:'Kritik an meiner Arbeit beschäftigt mich noch lange danach.', reverse:true },
      { id:'p11', type:'likert', dim:'struktur',   text:'Ordnung am Arbeitsplatz ist mir nicht besonders wichtig.', reverse:true },
      { id:'p12', type:'likert', dim:'initiative', text:'Neue Arbeitsabläufe probiere ich gerne aus.' },
      { id:'p13', type:'likert', dim:'team',       text:'Bei Konflikten im Team suche ich aktiv das Gespräch.' },
      { id:'p14', type:'likert', dim:'stress',     text:'Unter Zeitdruck arbeite ich konzentriert weiter.' },
      { id:'p15', type:'likert', dim:'struktur',   text:'Kleine Fehler in meiner Arbeit fallen mir meist selbst auf.' },
      { id:'p16', type:'likert', dim:'initiative', text:'Wenn ich etwas nicht weiß, eigne ich es mir selbstständig an.' },
      { id:'p17', type:'likert', dim:'team',       text:'Erfolge sehe ich eher als Leistung des Teams als als meine eigene.' },
      { id:'p18', type:'likert', dim:'stress',     text:'Nach einem anstrengenden Tag kann ich gut abschalten.' },
      { id:'p19', type:'likert', dim:'struktur',   text:'Ich bringe angefangene Aufgaben zu Ende, auch wenn sie mühsam sind.' },
      { id:'p20', type:'likert', dim:'initiative', text:'Verantwortung zu übernehmen fällt mir leicht.' },
    ],
  },
];

module.exports = { SECTIONS };
