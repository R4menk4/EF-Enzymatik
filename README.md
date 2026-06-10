# Experiment: Einfluss der Temperatur auf die Enzymaktivität

Diese browserbasierte Unterrichtssimulation zeigt modellhaft, wie die Temperatur die Aktivität einer Enzymreaktion beeinflusst. Sie ist für einen Biologie-Grundkurs der EF/11. Klasse gedacht und funktioniert ohne Backend.

## Didaktisches Modell

Die dargestellten Werte und Formen sind didaktisch vereinfacht. Enzyme, Substrate, Produkte und denaturierte Enzyme werden als Modellobjekte gezeigt. Die Messwerte sind fest vorgegeben und werden nicht zufällig erzeugt. Enzyme und Substrate bewegen sich frei im Reaktionsraum; bei höheren Temperaturen ist die Teilchenbewegung schneller.

## Nutzung

1. `index.html` im Browser öffnen.
2. Eine Temperatur zwischen 0 °C und 50 °C in 10er-Schritten einstellen.
3. Mit **Start** einen Durchlauf beginnen.
4. Mit **Pause** den Durchlauf anhalten und mit **Fortsetzen** weiterlaufen lassen.
5. Mit **Stopp** den aktuellen Durchlauf zurücksetzen.
6. Nach jedem abgeschlossenen Durchlauf erscheint der passende Messpunkt im Diagramm.
7. Mit **Messpunkte löschen** kann das Diagramm zurückgesetzt werden.

## GitHub Pages

Die App besteht nur aus HTML, CSS und JavaScript. Für GitHub Pages kann der Projektordner direkt in ein Repository hochgeladen und GitHub Pages für den Hauptbranch aktiviert werden.

## Modellparameter

Alle festen Simulationswerte stehen zentral in:

`js/simulationParams.js`

Dort können Enzymanzahl, Substratanzahl, Temperaturstufen, Durchlaufzeiten, Denaturierungsverhalten und relative Geschwindigkeiten angepasst werden.
