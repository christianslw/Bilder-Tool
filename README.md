# Bilder-Tool

Web-Tool zum strukturierten Umbenennen und Ablegen von JPG-Bildern nach Standort und Bereich.

## Funktionen

- Zielordner-Auswahl (File System Access API) mit Fallback-Pfadfeld.
- Standortauswahl über `standorte.js` (`nummer` + `name` werden genutzt).
- Grafische Bereiche für:
  - Grundstück
  - Kabine
  - Mast (inkl. Steigleiter / Kabel)
  - Energietechnik (ZAS)
  - Zufahrt
- Drag-and-Drop oder Klick auf Bereich zum Hinzufügen von JPG-Dateien.
- Automatisches Dateinamen-Schema:
  - `Standortnummer_Aufnahmedatum_Sache[_Kommentar].jpg`
- Zielpfad-Schema:
  - `Zielordner/{Nummer Name}/Bilder/{Sache}`
- Kompakte Dateiliste mit:
  - erwartetem Unterordnerpfad
  - editierbaren Dateinamen-Segmenten (Nummer, Datum, Sache, Kommentar)
  - altem Namen als dezente Referenz
  - Löschfunktion pro Eintrag
- Bildkompression auf möglichst `< 1 MB` pro Datei.

## Start

Die Anwendung ist statisch und benötigt keinen Build:

1. Dateien lokal bereitstellen.
2. `index.html` im Browser öffnen.
3. Optional einen lokalen Webserver verwenden, z. B.:

```bash
python3 -m http.server 4173
```

Dann `http://localhost:4173` öffnen.
