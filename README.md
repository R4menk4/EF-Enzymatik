# Experiment: Einfluss der Temperatur auf die Enzymaktivität

Diese browserbasierte Unterrichtssimulation zeigt modellhaft, wie die Temperatur die Aktivität einer Enzymreaktion beeinflusst. Sie ist für einen Biologie-Grundkurs der EF/11. Klasse gedacht und funktioniert ohne Backend.

Zusätzlich enthält die Startseite einen Lernbereich zur pH-Abhängigkeit von Enzymen. Die Inhalte werden dynamisch aus `data/enzyme_ph_learning_data.json` geladen.

## Didaktisches Modell

Die dargestellten Werte und Formen sind didaktisch vereinfacht. Enzyme, Substrate, Produkte und denaturierte Enzyme werden als Modellobjekte gezeigt. Die Messwerte sind fest vorgegeben und werden nicht zufällig erzeugt. Enzyme und Substrate bewegen sich frei im Reaktionsraum; bei höheren Temperaturen ist die Teilchenbewegung schneller.

## Nutzung

1. `index.html` im Browser öffnen.
2. Eine Temperaturstufe auswählen: 0, 10, 20, 30, 37, 40 oder 50 °C.
3. Mit **Start** einen Durchlauf beginnen.
4. Mit **Pause** den Durchlauf anhalten und mit **Fortsetzen** weiterlaufen lassen.
5. Mit **Stopp** den aktuellen Durchlauf zurücksetzen.
6. Nach jedem abgeschlossenen Durchlauf erscheint der passende Messpunkt im Diagramm.
7. Mit **Messpunkte löschen** kann das Diagramm zurückgesetzt werden.

## Fachliche Hinweise

37 °C ist in diesem Modell das Temperaturoptimum mit der höchsten relativen Geschwindigkeit. Ab 40 °C beginnt Denaturierung: Enzyme verändern ihre Form, das aktive Zentrum passt nicht mehr zum Substrat, und die Aktivität sinkt.

## GitHub Pages

Die App besteht nur aus HTML, CSS und JavaScript. Für GitHub Pages kann der Projektordner direkt in ein Repository hochgeladen und GitHub Pages für den Hauptbranch aktiviert werden.

## Modellparameter

Alle festen Simulationswerte stehen zentral in:

`js/simulationParams.js`

Dort können Enzymanzahl, Substratanzahl, Temperaturstufen, Durchlaufzeiten, Denaturierungsverhalten und relative Geschwindigkeiten angepasst werden.

Die Inhalte des pH-Lernbereichs liegen in:

`data/enzyme_ph_learning_data.json`
