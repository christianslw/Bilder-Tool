# Bilder-Tool

Web-Tool zum strukturierten Ablegen und Umbenennen von JPG-Bildern für Standorte.

## Funktionen
- Zielordner über den Browser auswählen (File System Access API).
- Standortauswahl über `standorte.js` (`nummer` + `name`).
- Bilder per Drag & Drop oder Klick auf Bereiche zuordnen:
  - Sendemast / Steigleiter / Kabel am Mast → `Mast`
  - Kabine / Betriebshaus → `Kabine`
  - Grundstück / Zaun → `Grundstück`
  - Zufahrt → `Zufahrt`
  - ZAS Elektro-Anschlusskasten → `Energietechnik`
- Dateinamen automatisch erzeugen:
  - `Standortnummer_Aufnahmedatum_Sache(_Kommentar).jpg`
- Zielpfad automatisch erzeugen:
  - `<Zielordner>/<Standortnummer Standortname>/Bilder/<Sache>/...`
- Kompakte Dateiliste mit:
  - neuem Namen,
  - ursprünglichem Namen,
  - Ziel-Unterordner,
  - Inline-Bearbeitung der Namensbestandteile,
  - Löschen per `X`.
- JPG-Komprimierung im Browser auf möglichst unter 1 MB pro Bild.

## Start
Einfach `index.html` im Browser öffnen oder lokal hosten, z. B.:

```bash
python3 -m http.server 4173
```
