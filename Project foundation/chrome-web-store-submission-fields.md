# Chrome Web Store Submission Fields (Dreamlab Canvas)

Last updated: 2026-02-19

Use these values for the German Chrome Web Store publisher form fields shown in your screenshots.

## Gründe für die Berechtigung

### Begründung für `contextMenus`
Die Berechtigung `contextMenus` wird benötigt, damit Nutzer Inhalte direkt per Rechtsklick speichern können (Seite, Bild, markierter Text, Link). Aktionen werden nur nach explizitem Nutzerklick ausgelöst und dienen ausschließlich dem Speichern in Dreamlab Canvas.

### Begründung für `storage`
Die Berechtigung `storage` wird benötigt, um lokale Erweiterungseinstellungen zu speichern, z. B. Widget an/aus, ausgeschlossene Domains, Position und Capture-Ziel. Ohne `storage` müssten Nutzer diese Einstellungen bei jeder Sitzung neu setzen.

### Begründung für `activeTab`
`activeTab` wird für nutzerinitiierte Capture-Aktionen im aktuell aktiven Tab benötigt (z. B. Sichtbereich-Screenshot, Full-Page-Capture, Picker-Tools). Der Zugriff erfolgt nur nach explizitem Nutzer-Trigger (Shortcut, Kontextmenü oder Widget-Button).

### Begründung für `tabs`
`tabs` wird benötigt, um den aktiven Tab für Capture-Workflows zu ermitteln, Befehle im richtigen Tab auszuführen und Erweiterungsseiten (Optionen/Compliance-Dokumente) zu öffnen. Die Berechtigung wird nicht für passive Überwachung verwendet.

### Begründung für `scripting`
`scripting` wird benötigt, um lokal gebündelte Erweiterungsskripte für Auswahl- und Capture-Overlays auszuführen (z. B. Area-Capture, Smart Picker). Es werden keine extern gehosteten Skripte injiziert oder ausgeführt.

### Begründung für Hostberechtigung (`<all_urls>`)
Die Erweiterung bietet bewusst ein always-on Capture-Widget auf allen Websites. `<all_urls>` ist erforderlich, damit Nutzer ohne wiederholte Freigabe-Prompts auf jeder Seite denselben Capture-Flow nutzen können. Erfassung/Übertragung erfolgt nur nach expliziter Nutzeraktion; sensible/unsupported Seiten werden blockiert.

## Nutzt du remote code?

### Auswahl
`Nein, ich verwende "remote code" nicht`

### Optionaler Hinweistext (falls ein Freitextfeld angezeigt wird)
Die Erweiterung führt keinen Remote-Code aus. Erweiterungslogik ist lokal im Paket enthalten; es werden keine extern gehosteten Skripte zur Laufzeit geladen und kein `eval`/`new Function` für Feature-Code verwendet.

## Datennutzung

### Welche Nutzerdaten werden erfasst? (Checkboxen)
Aktivieren:
- `Webprotokoll`
- `Websitecontent`

Nicht aktivieren:
- `Personenidentifizierbare Informationen`
- `Gesundheitsinformationen`
- `Finanzdaten und Zahlungsinformationen`
- `Authentifizierungsdaten`
- `Persönliche Kommunikation`
- `Ort`
- `Nutzeraktivität`

## Bestätigungen (alle 3 anhaken)
- Ich verkaufe oder übertrage keine Nutzerdaten an Dritte, außer in genehmigten Anwendungsfällen.
- Nutzerdaten werden nicht aus Gründen verwendet oder übertragen, die nichts mit dem alleinigen Zweck des Artikels zu tun haben.
- Nutzerdaten werden nicht zur Ermittlung der Kreditwürdigkeit oder für Darlehenszwecke verwendet oder übertragen.

## Privacy Policy URL (öffentlich)
- `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`

## Data Compliance URL (öffentlich)
- `https://dreamlab-canvas.vercel.app/extension-data-compliance.html`

## Reviewer Notes (empfohlen)
Dreamlab Canvas nutzt bewusst `<all_urls>`, um ein always-on Capture-Widget ohne wiederholte Freigabeabfragen zu ermöglichen. Inhalte werden ausschließlich nach Nutzeraktion erfasst/übertragen (Kontextmenü, Shortcut, Widget-Button). Unsupported URLs und sensible Flächen (z. B. Login/Payment/Auth) werden blockiert. Lokale/private Netzwerkziele werden für Metadaten-Extraktion blockiert.
