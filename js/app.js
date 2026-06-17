(function () {
  const params = window.SIMULATION_PARAMS;
  const simConfig = params.simulation;
  const tempSettings = params.temperatureSettings;

  const canvas = document.getElementById("simulationCanvas");
  const ctx = canvas.getContext("2d");
  const chartCanvas = document.getElementById("chartCanvas");
  const chartCtx = chartCanvas.getContext("2d");

  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const stopButton = document.getElementById("stopButton");
  const clearPointsButton = document.getElementById("clearPointsButton");
  const temperatureSlider = document.getElementById("temperatureSlider");
  const temperatureValue = document.getElementById("temperatureValue");
  const temperatureHint = document.getElementById("temperatureHint");
  const thermometerFill = document.getElementById("thermometerFill");
  const thermometerScale = document.getElementById("thermometerScale");
  const sliderLabels = document.getElementById("sliderLabels");
  const runStatus = document.getElementById("runStatus");

  const statTemperature = document.getElementById("statTemperature");
  const statConverted = document.getElementById("statConverted");
  const statActive = document.getElementById("statActive");
  const statDenatured = document.getElementById("statDenatured");
  const statTime = document.getElementById("statTime");
  const statVelocity = document.getElementById("statVelocity");
  const homeView = document.getElementById("homeView");
  const temperatureSimulationView = document.getElementById("temperatureSimulationView");
  const phLearningView = document.getElementById("phLearningView");
  const openTemperatureSimulation = document.getElementById("openTemperatureSimulation");
  const openPhLearning = document.getElementById("openPhLearning");
  const backToHomeFromPh = document.getElementById("backToHomeFromPh");
  const phLearningContent = document.getElementById("phLearningContent");
  const phLearningIntro = document.getElementById("phLearningIntro");

  const colors = {
    enzyme: "#7bc6a6",
    enzymeDark: "#4c9c7b",
    activeSite: "#2f7dd3",
    substrate: "#d94747",
    product: "#ee982a",
    denatured: "#9b8d7f",
    text: "#17211d",
    muted: "#5e6c65",
    grid: "#d7e1dc"
  };

  const bounds = { left: 34, top: 64, right: canvas.width - 34, bottom: canvas.height - 34 };
  const enzymeSize = { width: 118, height: 72 };
  const substrateSize = { width: 34, height: 18 };
  const productSize = 16;
  const temperatureSteps = simConfig.temperatureSteps;
  const minTemperature = Math.min(...temperatureSteps);
  const maxTemperature = Math.max(...temperatureSteps);

  let selectedTemperature = getDefaultTemperature();
  let runState = createInitialState(selectedTemperature);
  let animationFrame = null;
  let lastFrameTime = null;
  let measuredPoints = [];
  let phLearningData = null;

  function createInitialState(temperature) {
    const setting = tempSettings[temperature];
    const state = {
      status: "idle",
      temperature,
      setting,
      elapsed: 0,
      converted: 0,
      activeEnzymes: setting.activeEnzymesAtStart,
      denaturedEnzymes: 0,
      activeComplex: null,
      products: [],
      enzymes: [],
      substrates: []
    };
    state.enzymes = createEnzymes(state);
    state.substrates = createSubstrates(state);
    return state;
  }

  function getDefaultTemperature() {
    return temperatureSteps.includes(simConfig.optimumTemperature)
      ? simConfig.optimumTemperature
      : temperatureSteps[0];
  }

  function getTemperatureIndex(temperature) {
    const index = temperatureSteps.indexOf(temperature);
    return index >= 0 ? index : 0;
  }

  function getSelectedSliderTemperature() {
    const index = Number(temperatureSlider.value);
    return temperatureSteps[index] ?? temperatureSteps[0];
  }

  function setupTemperatureControl() {
    temperatureSlider.min = "0";
    temperatureSlider.max = String(Math.max(0, temperatureSteps.length - 1));
    temperatureSlider.step = "1";
    temperatureSlider.value = String(getTemperatureIndex(selectedTemperature));

    sliderLabels.innerHTML = "";
    temperatureSteps.forEach((temperature) => {
      const label = document.createElement("span");
      label.textContent = String(temperature);
      if (temperature === simConfig.optimumTemperature) label.className = "optimum-label";
      sliderLabels.appendChild(label);
    });

    thermometerScale.innerHTML = "";
    temperatureSteps
      .slice()
      .sort((a, b) => a - b)
      .forEach((temperature) => {
        const label = document.createElement("span");
        const percentage = ((temperature - minTemperature) / (maxTemperature - minTemperature)) * 100;
        label.textContent = String(temperature);
        label.style.bottom = `${percentage}%`;
        if (temperature === simConfig.optimumTemperature) label.className = "optimum-label";
        thermometerScale.appendChild(label);
      });
  }

  function getDenaturation(setting) {
    return typeof setting.denaturation === "string" ? { type: setting.denaturation } : setting.denaturation;
  }

  function createEnzymes(state) {
    const basePositions = [
      { x: 150, y: 125 },
      { x: 610, y: 110 },
      { x: 270, y: 320 },
      { x: 700, y: 330 }
    ];

    return Array.from({ length: simConfig.enzymeCount }, (_, index) => {
      const fallback = {
        x: bounds.left + 80 + (index % 4) * 180,
        y: bounds.top + 70 + Math.floor(index / 4) * 140
      };
      const base = basePositions[index] || fallback;
      return {
        id: index,
        x: clamp(base.x, bounds.left, bounds.right - enzymeSize.width),
        y: clamp(base.y, bounds.top, bounds.bottom - enzymeSize.height),
        vx: seededVelocity(index, state.temperature, 0.34),
        vy: seededVelocity(index + 9, state.temperature, 0.28),
        denatured: false,
        complexUntil: 0
      };
    });
  }

  function createSubstrates(state) {
    const columns = Math.ceil(Math.sqrt(simConfig.substrateCount));
    const rows = Math.ceil(simConfig.substrateCount / columns);
    const gapX = (bounds.right - bounds.left - substrateSize.width - 80) / Math.max(1, columns - 1);
    const gapY = (bounds.bottom - bounds.top - substrateSize.height - 80) / Math.max(1, rows - 1);

    return Array.from({ length: simConfig.substrateCount }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        id: index,
        x: bounds.left + 44 + column * gapX + (index % 2) * 12,
        y: bounds.top + 44 + row * gapY + (index % 3) * 9,
        vx: seededVelocity(index + 17, state.temperature, 0.9),
        vy: seededVelocity(index + 31, state.temperature, 0.82),
        converted: false,
        bound: false
      };
    });
  }

  function seededVelocity(seed, temperature, base) {
    const angle = ((seed * 137.5) % 360) * (Math.PI / 180);
    const speed = movementSpeed(temperature) * base;
    return Math.cos(angle) * speed;
  }

  function movementSpeed(temperature) {
    const optimum = Math.max(1, simConfig.optimumTemperature);
    const heatFactor = Math.min(1.35, 0.22 + (temperature / optimum) * 0.78);
    return 34 + heatFactor * 86;
  }

  function getReactionTiming() {
    const target = runState.setting.convertedSubstrates;
    if (target <= 0) return runState.setting.durationSeconds;
    const denaturation = getDenaturation(runState.setting);
    let availableTime = runState.setting.durationSeconds;
    if (denaturation.type === "progressive") availableTime *= 0.85;
    if (denaturation.type === "rapid") availableTime *= 0.25;
    return availableTime / target;
  }

  function getDenaturedCountForTime() {
    const denaturation = getDenaturation(runState.setting);
    if (denaturation.type === "rapid") {
      if (runState.converted >= runState.setting.convertedSubstrates || runState.elapsed >= runState.setting.durationSeconds * 0.7) return simConfig.enzymeCount;
      return runState.elapsed >= 0.15 ? denaturation.immediatelyDenaturedEnzymes : 0;
    }
    if (denaturation.type === "progressive") {
      if (runState.converted >= runState.setting.convertedSubstrates || runState.elapsed >= runState.setting.durationSeconds * 0.92) return simConfig.enzymeCount;
      return runState.elapsed >= 0.8 ? denaturation.earlyDenaturedEnzymes : 0;
    }
    return 0;
  }

  function updateDenaturation() {
    const targetDenatured = getDenaturedCountForTime();
    runState.enzymes.forEach((enzyme, index) => {
      enzyme.denatured = index >= simConfig.enzymeCount - targetDenatured;
    });
    runState.denaturedEnzymes = runState.enzymes.filter((enzyme) => enzyme.denatured).length;
    runState.activeEnzymes = runState.enzymes.filter((enzyme) => !enzyme.denatured).length;

    if (runState.activeComplex && runState.activeComplex.enzyme.denatured) {
      runState.activeComplex.substrate.bound = false;
      runState.activeComplex = null;
    }
  }

  function tick(time) {
    if (runState.status !== "running") return;
    if (lastFrameTime === null) lastFrameTime = time;
    const delta = Math.min((time - lastFrameTime) / 1000, 0.08);
    lastFrameTime = time;
    runState.elapsed += delta;

    updateDenaturation();
    prepareScheduledComplex();
    moveParticles(delta);
    advanceReaction();
    updateDisplays();
    drawSimulation();

    if (shouldEndRun()) {
      finishRun();
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function prepareScheduledComplex() {
    if (runState.activeComplex || runState.converted >= runState.setting.convertedSubstrates || runState.activeEnzymes <= 0) return;
    const reactionDuration = getReactionTiming();
    const nextConversionTime = (runState.converted + 1) * reactionDuration;
    const approachTime = Math.min(0.75, reactionDuration * 0.55);
    if (runState.elapsed < nextConversionTime - approachTime) return;

    const enzyme = chooseActiveEnzyme();
    const substrate = nearestFreeSubstrate(enzyme);
    if (!enzyme || !substrate) return;

    substrate.bound = true;
    enzyme.complexUntil = nextConversionTime;
    runState.activeComplex = { enzyme, substrate, conversionTime: nextConversionTime };
  }

  function chooseActiveEnzyme() {
    const active = runState.enzymes.filter((enzyme) => !enzyme.denatured);
    return active.length ? active[runState.converted % active.length] : null;
  }

  function nearestFreeSubstrate(enzyme) {
    if (!enzyme) return null;
    const free = runState.substrates.filter((substrate) => !substrate.converted && !substrate.bound);
    if (!free.length) return null;
    return free
      .map((substrate) => ({ substrate, distance: distanceBetween(substrateCenter(substrate), activeSiteCenter(enzyme)) }))
      .sort((a, b) => a.distance - b.distance)[0].substrate;
  }

  function moveParticles(delta) {
    const speed = movementSpeed(runState.temperature);
    const jitter = speed * 0.22;

    runState.enzymes.forEach((enzyme, index) => {
      const slowFactor = enzyme.denatured ? 0.55 : 1;
      enzyme.vx += Math.sin(runState.elapsed * 2.1 + index) * jitter * 0.012;
      enzyme.vy += Math.cos(runState.elapsed * 1.7 + index) * jitter * 0.012;
      limitVelocity(enzyme, speed * 0.42 * slowFactor);
      enzyme.x += enzyme.vx * delta * slowFactor;
      enzyme.y += enzyme.vy * delta * slowFactor;
      bounce(enzyme, enzymeSize.width, enzymeSize.height);
    });

    runState.substrates.forEach((substrate, index) => {
      if (substrate.converted) return;
      if (runState.activeComplex && runState.activeComplex.substrate === substrate) {
        moveBoundSubstrate(substrate, runState.activeComplex, delta);
        return;
      }

      substrate.vx += Math.sin(runState.elapsed * 5.2 + index * 1.7) * jitter * 0.03;
      substrate.vy += Math.cos(runState.elapsed * 4.4 + index * 1.3) * jitter * 0.03;
      limitVelocity(substrate, speed);
      substrate.x += substrate.vx * delta;
      substrate.y += substrate.vy * delta;
      bounce(substrate, substrateSize.width, substrateSize.height);
    });

    runState.products.forEach((product) => {
      product.age += delta;
      product.vx += Math.sin(runState.elapsed * 3 + product.id) * 8 * delta;
      product.vy += Math.cos(runState.elapsed * 2 + product.id) * 8 * delta;
      product.x += product.vx * delta;
      product.y += product.vy * delta;
      bounce(product, productSize, productSize);
    });
  }

  function moveBoundSubstrate(substrate, complex, delta) {
    const target = activeSiteTarget(complex.enzyme);
    const timeLeft = Math.max(0.05, complex.conversionTime - runState.elapsed);
    const pull = Math.min(1, delta / timeLeft);
    substrate.x += (target.x - substrate.x) * pull * 1.25;
    substrate.y += (target.y - substrate.y) * pull * 1.25;
    substrate.vx = (target.x - substrate.x) * 1.8;
    substrate.vy = (target.y - substrate.y) * 1.8;
  }

  function advanceReaction() {
    if (!runState.activeComplex || runState.elapsed < runState.activeComplex.conversionTime) return;
    const { enzyme, substrate } = runState.activeComplex;
    if (!enzyme.denatured && !substrate.converted && runState.converted < runState.setting.convertedSubstrates) {
      substrate.converted = true;
      substrate.bound = false;
      runState.converted += 1;
      releaseProducts(enzyme, runState.converted);
    }
    runState.activeComplex = null;
    updateDenaturation();
  }

  function releaseProducts(enzyme, reactionIndex) {
    const site = activeSiteCenter(enzyme);
    runState.products.push(createProduct(site.x - 8, site.y - 8, reactionIndex * 2, -1));
    runState.products.push(createProduct(site.x + 12, site.y + 8, reactionIndex * 2 + 1, 1));
  }

  function createProduct(x, y, id, direction) {
    const speed = movementSpeed(runState.temperature) * 0.72;
    return {
      id,
      x,
      y,
      vx: direction * speed * (0.55 + (id % 3) * 0.12),
      vy: speed * (id % 2 === 0 ? -0.35 : 0.38),
      age: 0
    };
  }

  function shouldEndRun() {
    return runState.converted >= runState.setting.convertedSubstrates || runState.activeEnzymes <= 0 || runState.elapsed >= runState.setting.durationSeconds;
  }

  function finishRun() {
    runState.status = "finished";
    runState.elapsed = Math.min(runState.elapsed, runState.setting.durationSeconds);
    updateDenaturation();

    if (getDenaturation(runState.setting).type !== "none") {
      runState.enzymes.forEach((enzyme) => {
        enzyme.denatured = true;
      });
      runState.denaturedEnzymes = simConfig.enzymeCount;
      runState.activeEnzymes = 0;
    }

    const existing = measuredPoints.find((point) => point.temperature === runState.temperature);
    if (existing) existing.velocity = runState.setting.relativeVelocity;
    else measuredPoints.push({ temperature: runState.temperature, velocity: runState.setting.relativeVelocity });
    measuredPoints.sort((a, b) => a.temperature - b.temperature);

    runStatus.textContent = "Durchlauf abgeschlossen. Messpunkt wurde ins Diagramm eingetragen.";
    statVelocity.textContent = String(runState.setting.relativeVelocity);
    setControlsForStatus("finished");
    updateDisplays();
    drawSimulation();
    drawChart();
  }

  function startRun() {
    if (runState.status === "running") return;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (runState.status === "paused") {
      runState.status = "running";
      runStatus.textContent = "Durchlauf läuft weiter.";
    } else {
      runState = createInitialState(selectedTemperature);
      runState.status = "running";
      runStatus.textContent = "Durchlauf läuft.";
    }
    lastFrameTime = null;
    setControlsForStatus("running");
    animationFrame = requestAnimationFrame(tick);
  }

  function pauseRun() {
    if (runState.status !== "running") return;
    runState.status = "paused";
    runStatus.textContent = "Durchlauf pausiert. Start setzt ihn fort.";
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    setControlsForStatus("paused");
    updateDisplays();
    drawSimulation();
  }

  function stopRun() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    runState = createInitialState(selectedTemperature);
    runStatus.textContent = "Durchlauf gestoppt und zurückgesetzt.";
    setControlsForStatus("idle");
    updateDisplays();
    drawSimulation();
  }

  function clearPoints() {
    measuredPoints = [];
    drawChart();
    runStatus.textContent = "Messpunkte wurden gelöscht.";
  }

  function setControlsForStatus(status) {
    const isRunning = status === "running";
    const isPaused = status === "paused";
    startButton.disabled = isRunning;
    startButton.textContent = isPaused ? "Fortsetzen" : "Start";
    pauseButton.disabled = !isRunning;
    stopButton.disabled = status === "idle";
    temperatureSlider.disabled = isRunning || isPaused;
    temperatureHint.textContent = temperatureSlider.disabled ? "Temperatur ist während des Durchlaufs gesperrt." : "Temperatur vor dem Start einstellen.";
  }

  function updateTemperatureDisplay() {
    temperatureValue.textContent = `${selectedTemperature} °C`;
    statTemperature.textContent = `${selectedTemperature} °C`;
    const range = Math.max(1, maxTemperature - minTemperature);
    thermometerFill.style.height = `${Math.max(5, ((selectedTemperature - minTemperature) / range) * 100)}%`;
  }

  function updateDisplays() {
    statTemperature.textContent = `${runState.temperature} °C`;
    statConverted.textContent = `${runState.converted} / ${simConfig.substrateCount}`;
    statActive.textContent = String(runState.activeEnzymes);
    statDenatured.textContent = String(runState.denaturedEnzymes);
    statTime.textContent = `${runState.elapsed.toFixed(1).replace(".", ",")} s`;
    if (runState.status !== "finished") statVelocity.textContent = "-";
  }

  function drawSimulation() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawProducts();
    drawEnzymes();
    drawSubstrates();
  }

  function drawBackground() {
    ctx.fillStyle = "#f7faf8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d7e1dc";
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.fillStyle = colors.muted;
    ctx.font = "18px Segoe UI, Arial";
    ctx.fillText("Reaktionsraum: freie Teilchenbewegung", bounds.left + 14, bounds.top - 16);
  }

  function drawEnzymes() {
    runState.enzymes.forEach((enzyme) => {
      if (enzyme.denatured) drawDenaturedEnzyme(enzyme);
      else drawActiveEnzyme(enzyme);
    });
  }

  function drawActiveEnzyme(enzyme) {
    roundedBlob(enzyme.x, enzyme.y, enzymeSize.width, enzymeSize.height, 24, colors.enzyme, colors.enzymeDark);
    const site = activeSiteTarget(enzyme);
    ctx.fillStyle = colors.activeSite;
    ctx.fillRect(site.x, site.y, substrateSize.width, substrateSize.height);
  }

  function drawDenaturedEnzyme(enzyme) {
    ctx.save();
    ctx.translate(enzyme.x + enzymeSize.width / 2, enzyme.y + enzymeSize.height / 2);
    ctx.rotate(-0.18);
    ctx.transform(1, 0.08, -0.18, 1, 0, 0);
    roundedBlob(-enzymeSize.width / 2, -enzymeSize.height / 2, enzymeSize.width, enzymeSize.height, 22, colors.denatured, "#75675d");
    ctx.strokeStyle = colors.activeSite;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(18, -16);
    ctx.lineTo(42, -6);
    ctx.lineTo(26, 16);
    ctx.lineTo(51, 18);
    ctx.stroke();
    ctx.strokeStyle = "#75675d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, -22);
    ctx.lineTo(-22, -6);
    ctx.moveTo(-30, 20);
    ctx.lineTo(-8, 5);
    ctx.stroke();
    ctx.restore();
  }

  function roundedBlob(x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.quadraticCurveTo(x + width - 4, y + 2, x + width, y + radius);
    ctx.quadraticCurveTo(x + width - 8, y + height - 4, x + width - radius, y + height);
    ctx.quadraticCurveTo(x + 10, y + height + 2, x, y + height - radius);
    ctx.quadraticCurveTo(x - 4, y + 8, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawSubstrates() {
    runState.substrates.forEach((substrate) => {
      if (!substrate.converted) drawSubstrate(substrate);
    });
  }

  function drawSubstrate(substrate) {
    const inComplex = runState.activeComplex && runState.activeComplex.substrate === substrate;
    ctx.fillStyle = colors.substrate;
    ctx.fillRect(substrate.x, substrate.y, substrateSize.width, substrateSize.height);
    ctx.strokeStyle = inComplex ? "#8f1f1f" : "#b83b3b";
    ctx.lineWidth = inComplex ? 3 : 2;
    ctx.strokeRect(substrate.x, substrate.y, substrateSize.width, substrateSize.height);
  }

  function drawProducts() {
    runState.products.forEach((product) => {
      ctx.fillStyle = colors.product;
      ctx.fillRect(product.x, product.y, productSize, productSize);
    });
  }

  function drawChart() {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    const padding = { left: 78, right: 28, top: 28, bottom: 68 };
    const width = chartCanvas.width - padding.left - padding.right;
    const height = chartCanvas.height - padding.top - padding.bottom;

    chartCtx.fillStyle = "#f7faf8";
    chartCtx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);
    chartCtx.strokeStyle = colors.grid;
    chartCtx.lineWidth = 1;

    simConfig.temperatureSteps.forEach((temperature) => {
      const x = padding.left + ((temperature - minTemperature) / (maxTemperature - minTemperature)) * width;
      chartCtx.beginPath();
      chartCtx.moveTo(x, padding.top);
      chartCtx.lineTo(x, padding.top + height);
      chartCtx.stroke();
    });
    for (let v = 0; v <= 100; v += 20) {
      const y = padding.top + height - (v / 100) * height;
      chartCtx.beginPath();
      chartCtx.moveTo(padding.left, y);
      chartCtx.lineTo(padding.left + width, y);
      chartCtx.stroke();
    }

    chartCtx.strokeStyle = colors.text;
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    chartCtx.moveTo(padding.left, padding.top);
    chartCtx.lineTo(padding.left, padding.top + height);
    chartCtx.lineTo(padding.left + width, padding.top + height);
    chartCtx.stroke();

    chartCtx.fillStyle = colors.text;
    chartCtx.font = "16px Segoe UI, Arial";
    chartCtx.textAlign = "center";
    simConfig.temperatureSteps.forEach((temperature) => {
      const x = padding.left + ((temperature - minTemperature) / (maxTemperature - minTemperature)) * width;
      chartCtx.fillText(String(temperature), x, padding.top + height + 28);
    });
    chartCtx.textAlign = "right";
    for (let v = 0; v <= 100; v += 20) {
      const y = padding.top + height - (v / 100) * height;
      chartCtx.fillText(String(v), padding.left - 12, y + 5);
    }

    chartCtx.textAlign = "center";
    chartCtx.fillText("Temperatur T in °C", padding.left + width / 2, chartCanvas.height - 18);
    chartCtx.save();
    chartCtx.translate(22, padding.top + height / 2);
    chartCtx.rotate(-Math.PI / 2);
    chartCtx.fillText("Geschwindigkeit v der Umsetzung (rel. Einheit)", 0, 0);
    chartCtx.restore();

    if (measuredPoints.length > 1) {
      chartCtx.strokeStyle = "#2370b8";
      chartCtx.lineWidth = 3;
      chartCtx.beginPath();
      measuredPoints.forEach((point, index) => {
        const mapped = mapChartPoint(point, padding, width, height);
        if (index === 0) chartCtx.moveTo(mapped.x, mapped.y);
        else chartCtx.lineTo(mapped.x, mapped.y);
      });
      chartCtx.stroke();
    }

    measuredPoints.forEach((point) => {
      const mapped = mapChartPoint(point, padding, width, height);
      chartCtx.fillStyle = "#d94747";
      chartCtx.beginPath();
      chartCtx.arc(mapped.x, mapped.y, 7, 0, Math.PI * 2);
      chartCtx.fill();
      chartCtx.strokeStyle = "#8f1f1f";
      chartCtx.lineWidth = 2;
      chartCtx.stroke();
      chartCtx.fillStyle = colors.text;
      chartCtx.font = "14px Segoe UI, Arial";
      chartCtx.textAlign = "center";
      chartCtx.fillText(`(${point.temperature} | ${point.velocity})`, mapped.x, mapped.y - 14);
    });
  }

  function mapChartPoint(point, padding, width, height) {
    return {
      x: padding.left + ((point.temperature - minTemperature) / (maxTemperature - minTemperature)) * width,
      y: padding.top + height - (point.velocity / 100) * height
    };
  }

  function activeSiteTarget(enzyme) {
    return { x: enzyme.x + 67, y: enzyme.y + 26 };
  }

  function activeSiteCenter(enzyme) {
    const target = activeSiteTarget(enzyme);
    return { x: target.x + substrateSize.width / 2, y: target.y + substrateSize.height / 2 };
  }

  function substrateCenter(substrate) {
    return { x: substrate.x + substrateSize.width / 2, y: substrate.y + substrateSize.height / 2 };
  }

  function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function bounce(particle, width, height) {
    if (particle.x < bounds.left) {
      particle.x = bounds.left;
      particle.vx = Math.abs(particle.vx);
    }
    if (particle.x + width > bounds.right) {
      particle.x = bounds.right - width;
      particle.vx = -Math.abs(particle.vx);
    }
    if (particle.y < bounds.top) {
      particle.y = bounds.top;
      particle.vy = Math.abs(particle.vy);
    }
    if (particle.y + height > bounds.bottom) {
      particle.y = bounds.bottom - height;
      particle.vy = -Math.abs(particle.vy);
    }
  }

  function limitVelocity(particle, maxSpeed) {
    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed <= maxSpeed || speed === 0) return;
    particle.vx = (particle.vx / speed) * maxSpeed;
    particle.vy = (particle.vy / speed) * maxSpeed;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function showView(viewName) {
    homeView.classList.toggle("view-hidden", viewName !== "home");
    temperatureSimulationView.classList.toggle("view-hidden", viewName !== "temperature");
    phLearningView.classList.toggle("view-hidden", viewName !== "ph");
  }

  async function openPhLearningArea() {
    showView("ph");
    phLearningContent.innerHTML = '<p class="loading-note">Lernbereich wird geladen...</p>';
    let response;
    try {
      response = await fetch(`data/enzyme_ph_learning_data.json?version=${Date.now()}`, { cache: "no-store" });
    } catch (error) {
      response = await fetch("data/enzyme_ph_learning_data.json", { cache: "no-store" });
    }
    if (!response.ok) response = await fetch("data/enzyme_ph_learning_data.json", { cache: "no-store" });
    phLearningData = repairTextDeep(await response.json());
    renderPhLearning(phLearningData);
  }

  function repairTextDeep(value) {
    if (Array.isArray(value)) return value.map(repairTextDeep);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairTextDeep(item)]));
    }
    if (typeof value !== "string") return value;
    try {
      return decodeURIComponent(escape(value));
    } catch (error) {
      return value;
    }
  }

  function renderPhLearning(data) {
    const helper = window.PhEnzymeLearning;
    const enzymes = helper.getEnzymes(data);
    const coreEnzymes = helper.getCoreEnzymes(data);
    phLearningIntro.textContent = data.meta?.description || "Kleinschrittiges Lernprogramm zur pH-Abhängigkeit von Enzymen.";
    phLearningContent.innerHTML = "";

    phLearningContent.append(
      renderInfoSection("1. pH-Wert verstehen", [
        "Die pH-Skala beschreibt, wie sauer oder alkalisch eine Lösung ist.",
        "Kleine pH-Werte sind sauer, pH 7 ist neutral, größere pH-Werte sind alkalisch."
      ], renderPhSortTask(data)),
      renderInfoSection("2. Enzyme und aktives Zentrum", [
        "Enzyme sind Proteine. Im aktiven Zentrum bindet das passende Substrat.",
        "Wenn der pH-Wert stark vom Optimum abweicht, können Ladungen und Form des aktiven Zentrums verändert werden."
      ], renderOrderTask(helper.getTaskById(data, "sequence_ph_effect_01"))),
      renderInfoSection("3. pH-Optimum", [
        "Jedes Enzym hat einen pH-Wert, bei dem es besonders gut arbeitet.",
        "Dieser höchste Punkt der Aktivitätskurve heißt pH-Optimum."
      ], renderDiagramReadingTask(data, helper.getTaskById(data, "read_pepsin_optimum_01"))),
      renderInfoSection("4. Enzyme vergleichen", [
        "Pepsin, Amylase und Trypsin sind an unterschiedliche Einsatzorte im Verdauungstrakt angepasst."
      ], renderEnzymeComparisonTask(data, coreEnzymes)),
      renderInfoSection("5. Diagramme zuordnen", [
        "Die Kurven werden direkt aus den JSON-Daten gezeichnet."
      ], renderDiagramMatchingTask(data, coreEnzymes)),
      renderInfoSection("6. Enzyme im Verdauungstrakt", [
        "Verdauungsenzyme wirken dort besonders gut, wo die pH-Bedingungen zu ihrem Optimum passen."
      ], renderBodyRegionTask(data, enzymes)),
      renderInfoSection("7. Wenn der pH-Wert nicht passt", [
        "Außerhalb des pH-Optimums sinkt die Aktivität, weil das aktive Zentrum schlechter zum Substrat passt."
      ], renderMismatchTasks(data)),
      // Abschnitte 8 und 9 bleiben im Projekt erhalten, werden aktuell aber nicht angezeigt.
    );
  }

  function renderInfoSection(title, paragraphs, taskElement) {
    const section = document.createElement("section");
    section.className = "learning-section";
    section.innerHTML = `<h3>${escapeHtml(title)}</h3>${paragraphs.filter(Boolean).map((text) => `<p>${escapeHtml(text)}</p>`).join("")}`;
    if (taskElement) section.appendChild(taskElement);
    return section;
  }

  function renderPhSortTask(data) {
    const task = window.PhEnzymeLearning.getTaskById(data, "ph_sort_01");
    const categories = ["stark sauer", "nahe neutral", "neutral", "neutral bis leicht alkalisch", "alkalisch"];
    const wrapper = createTaskWrapper(task.prompt);
    wrapper.body.appendChild(createPhScaleImage());
    const displayedItems = shuffle(task.items);
    displayedItems.forEach((item, index) => {
      wrapper.body.appendChild(createSelectRow(item.label, categories, `ph-sort-${index}`));
    });
    return wrapper.root;
  }

  function createPhScaleImage() {
    const image = document.createElement("img");
    image.className = "learning-image ph-scale-image";
    image.src = "assets/images/pH-Skala.png";
    image.alt = "pH-Skala von sauer über neutral bis alkalisch";
    image.loading = "lazy";
    return image;
  }

  function renderOrderTask(task) {
    const wrapper = createTaskWrapper(task.prompt);
    if (task.id === "sequence_ph_effect_01") {
      wrapper.body.appendChild(createEnzymePhEffectImage());
    }
    const visibleItems = task.id === "sequence_ph_effect_01"
      ? task.items.filter((item) => item.text !== "Ladungen im Enzym können sich verändern.")
      : task.items;
    const displayedItems = shuffle(visibleItems);
    const positionOptions = shuffle(Array.from({ length: visibleItems.length }, (_, index) => index + 1));
    displayedItems.forEach((item, index) => {
      const row = document.createElement("label");
      row.className = "choice-row";
      row.innerHTML = `<span>${escapeHtml(item.text)}</span><select id="${task.id}-${index}"><option value="">Position wählen</option>${positionOptions.map((position) => `<option value="${position}">${position}</option>`).join("")}</select>`;
      wrapper.body.appendChild(row);
    });
    return wrapper.root;
  }

  function createEnzymePhEffectImage() {
    const image = document.createElement("img");
    image.className = "learning-image enzyme-ph-effect-image";
    image.src = "assets/images/enzymwirkung_pH_bearbeitet.png";
    image.alt = "Modellhafte Darstellung: pH-Wert beeinflusst Ladungen, aktives Zentrum und Enzymaktivität";
    image.loading = "lazy";
    return image;
  }

  function renderDiagramReadingTask(data, task) {
    const enzyme = window.PhEnzymeLearning.getEnzymeById(data, task.enzymeId);
    if (task.checkMode === "model_solution_only") {
      const wrapper = createModelSolutionTask(task);
      wrapper.body.insertBefore(createCurveSvg(enzyme, true), wrapper.body.firstChild);
      return wrapper.root;
    }

    const wrapper = createTaskWrapper(task.prompt);
    wrapper.body.appendChild(createCurveSvg(enzyme, true));
    const input = document.createElement("input");
    input.id = task.id;
    input.className = "short-input";
    input.placeholder = "Antwort eingeben";
    wrapper.body.appendChild(input);
    addCheckButton(wrapper, () => feedback(task, window.PhEnzymeLearning.checkShortAnswer(task, input.value)));
    return wrapper.root;
  }

  function renderEnzymeComparisonTask(data, coreEnzymes) {
    const task = window.PhEnzymeLearning.getTaskById(data, "match_enzyme_cards_01");
    if (task.type === "reading_memory_matching") {
      return renderReadingMemoryMatchingTask(data, task);
    }

    const wrapper = createTaskWrapper(task.prompt);
    const organs = ["Magen", "Mund / Dünndarm", "Dünndarm"];
    const substrates = ["Proteine", "Stärke", "Proteine und Peptide"];
    const optima = ["pH 2", "pH 7", "pH 8"];
    shuffle(coreEnzymes).forEach((enzyme) => {
      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `<strong>${escapeHtml(enzyme.name)}</strong>`;
      card.append(
        createSelectRow("Einsatzort", shuffle(organs), `organ-${enzyme.id}`),
        createSelectRow("Substrat", shuffle(substrates), `substrate-${enzyme.id}`),
        createSelectRow("pH-Optimum", shuffle(optima), `optimum-${enzyme.id}`)
      );
      wrapper.body.appendChild(card);
    });
    return wrapper.root;
  }

  function renderReadingMemoryMatchingTask(data, task) {
    const root = document.createElement("div");
    root.className = "learning-task memory-task";

    const readingPanel = document.createElement("div");
    readingPanel.className = "memory-reading";
    readingPanel.innerHTML = `
      <p class="task-prompt">${escapeHtml(task.intro || "")}</p>
      <div class="memory-reading-text">${formatReadingText(task.readingText || "")}</div>
    `;

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = task.startButtonLabel || "Text schließen und Aufgabe starten";
    readingPanel.appendChild(startButton);

    const activity = createTaskWrapper(task.prompt);
    activity.root.classList.add("view-hidden");
    buildMatchingDropdowns(data, task, activity.body);

    const actions = document.createElement("div");
    actions.className = "memory-actions";
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "secondary";
    resetButton.textContent = task.resetButtonLabel || "Aufgabe zurücksetzen";
    const checkButton = document.createElement("button");
    checkButton.type = "button";
    checkButton.className = "secondary";
    checkButton.textContent = "Überprüfen";
    actions.append(resetButton, checkButton);
    activity.root.appendChild(actions);

    startButton.addEventListener("click", () => {
      if (task.hideTextAfterStart !== false) readingPanel.classList.add("view-hidden");
      startButton.classList.add("view-hidden");
      activity.root.classList.remove("view-hidden");
    });

    resetButton.addEventListener("click", () => {
      if (task.resetBehavior?.resetDropdowns !== false) {
        task.pairs.forEach((pair) => {
          getMatchingColumns(task).forEach((column) => {
            setSelectValue(getMatchingSelectId(task, pair, column), "");
          });
        });
      }
      if (task.resetBehavior?.clearFeedback !== false) {
        activity.feedbackBox.textContent = "";
        activity.feedbackBox.classList.remove("is-visible");
      }
      if (task.resetBehavior?.keepReadingTextHidden !== false && task.hideTextAfterStart !== false) {
        readingPanel.classList.add("view-hidden");
        startButton.classList.add("view-hidden");
      }
    });

    checkButton.addEventListener("click", () => {
      const correct = isMatchingTaskCorrect(task);
      activity.feedbackBox.textContent = correct ? task.feedbackCorrect : task.feedbackIncorrect;
      activity.feedbackBox.classList.add("is-visible");
    });

    root.append(readingPanel, activity.root);
    return root;
  }

  function buildMatchingDropdowns(data, task, body) {
    const columns = getMatchingColumns(task);
    const optionsByColumn = Object.fromEntries(columns.map((column) => [
      column.id,
      shuffle([...new Set(task.pairs.map((pair) => pair[column.id]).filter(Boolean))])
    ]));

    shuffle(task.pairs).forEach((pair) => {
      const enzyme = window.PhEnzymeLearning.getEnzymeById(data, pair.enzymeId);
      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `<strong>${escapeHtml(pair.enzymeName || enzyme?.name || pair.enzymeId)}</strong>`;
      columns.forEach((column) => {
        card.appendChild(createSelectRow(column.label, optionsByColumn[column.id], getMatchingSelectId(task, pair, column)));
      });
      body.appendChild(card);
    });
  }

  function isMatchingTaskCorrect(task) {
    const columns = getMatchingColumns(task);
    return task.pairs.every((pair) => {
      return columns.every((column) => getSelectValue(getMatchingSelectId(task, pair, column)) === pair[column.id]);
    });
  }

  function getMatchingColumns(task) {
    if (Array.isArray(task.columns) && task.columns.length > 0) return task.columns;
    return [
      { id: "organ", label: "Einsatzort" },
      { id: "substrate", label: "Substrat" },
      { id: "phOptimum", label: "pH-Optimum" }
    ];
  }

  function getMatchingSelectId(task, pair, column) {
    return `matching-${task.id}-${pair.enzymeId}-${column.id}`;
  }

  function renderDiagramMatchingTask(data, coreEnzymes) {
    const task = window.PhEnzymeLearning.getTaskById(data, "match_diagrams_01");
    const wrapper = createTaskWrapper(task.prompt);
    const enzymeOptions = shuffle(coreEnzymes).map((enzyme) => ({ label: enzyme.name, value: enzyme.id }));
    shuffle(task.diagrams).forEach((diagram) => {
      const enzyme = window.PhEnzymeLearning.getEnzymeById(data, diagram.correctEnzymeId);
      const card = document.createElement("div");
      card.className = "diagram-match-card";
      card.appendChild(createCurveSvg(enzyme, false));
      card.appendChild(createSelectRow("Diagramm gehört zu", enzymeOptions, `diagram-${diagram.diagramId}`));
      wrapper.body.appendChild(card);
    });
    return wrapper.root;
  }

  function renderBodyRegionTask(data, enzymes) {
    const module = window.PhEnzymeLearning.getModuleById(data, "digestive_tract");
    const task = window.PhEnzymeLearning.getTaskById(data, "body_region_match_01");
    const memoryTask = module?.tasks?.find((item) => item.type === "reading_memory_dragdrop");
    const stack = document.createElement("div");
    stack.className = "task-stack";

    if (task) {
      const wrapper = createTaskWrapper(task.prompt);
      const regions = shuffle(task.regions).map((region) => ({ label: region.label, value: region.regionId }));
      shuffle(["amylase", "pepsin", "trypsin", "lipase", "lactase"]).forEach((enzymeId) => {
        const enzyme = window.PhEnzymeLearning.getEnzymeById(data, enzymeId);
        wrapper.body.appendChild(createSelectRow(enzyme.name, regions, `region-${enzyme.id}`));
      });
      addCheckButton(wrapper, () => {
        const correct = task.regions.every((region) => region.correctEnzymeIds.every((enzymeId) => getSelectValue(`region-${enzymeId}`) === region.regionId));
        return feedback(task, correct);
      });
      stack.appendChild(wrapper.root);
    }

    if (memoryTask) {
      stack.appendChild(renderReadingMemoryDragDropTask(memoryTask));
    }

    return stack;
  }

  function renderReadingMemoryDragDropTask(task) {
    const root = document.createElement("div");
    root.className = "learning-task memory-task";
    const readingPanel = document.createElement("div");
    readingPanel.className = "memory-reading";
    readingPanel.innerHTML = `
      <p class="task-prompt">${escapeHtml(task.intro || "")}</p>
      <div class="memory-reading-text">${formatReadingText(task.readingText || "")}</div>
    `;

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = task.startButtonLabel || "Text schließen und Aufgabe starten";
    readingPanel.appendChild(startButton);

    const activity = document.createElement("div");
    activity.className = "memory-activity view-hidden";
    activity.innerHTML = `<p class="task-prompt">${escapeHtml(task.prompt || "")}</p>`;

    const board = document.createElement("div");
    board.className = "memory-board";
    const sourceZone = createMemoryZone("source", "Karten");
    board.appendChild(sourceZone.zone);

    const targetGrid = document.createElement("div");
    targetGrid.className = "memory-target-grid";
    task.targets.forEach((target) => {
      const targetZone = createMemoryZone(target.id, target.label);
      targetGrid.appendChild(targetZone.zone);
    });
    board.appendChild(targetGrid);
    activity.appendChild(board);

    const actions = document.createElement("div");
    actions.className = "memory-actions";
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "secondary";
    resetButton.textContent = task.resetButtonLabel || "Aufgabe zurücksetzen";
    const checkButton = document.createElement("button");
    checkButton.type = "button";
    checkButton.className = "secondary";
    checkButton.textContent = "Überprüfen";
    actions.append(resetButton, checkButton);

    const feedbackBox = document.createElement("p");
    feedbackBox.className = "task-feedback";
    activity.append(actions, feedbackBox);
    root.append(readingPanel, activity);

    const placements = {};
    const displayedCards = shuffle(task.cards);
    displayedCards.forEach((card) => {
      placements[card.id] = "source";
    });

    startButton.addEventListener("click", () => {
      if (task.hideTextAfterStart !== false) readingPanel.classList.add("view-hidden");
      startButton.classList.add("view-hidden");
      activity.classList.remove("view-hidden");
    });

    resetButton.addEventListener("click", () => {
      if (task.resetBehavior?.moveCardsToStart !== false) {
        displayedCards.forEach((card) => {
          placements[card.id] = "source";
        });
      }
      if (task.resetBehavior?.clearFeedback !== false) {
        feedbackBox.textContent = "";
        feedbackBox.classList.remove("is-visible");
      }
      if (task.resetBehavior?.keepReadingTextHidden !== false && task.hideTextAfterStart !== false) {
        readingPanel.classList.add("view-hidden");
        startButton.classList.add("view-hidden");
      }
      renderMemoryCards();
    });

    checkButton.addEventListener("click", () => {
      const correct = isMemoryTaskCorrect(task, placements);
      feedbackBox.textContent = correct ? task.feedbackCorrect : task.feedbackIncorrect;
      feedbackBox.classList.add("is-visible");
    });

    setupMemoryDropZone(sourceZone.zone, moveCard);
    targetGrid.querySelectorAll(".memory-zone").forEach((zone) => setupMemoryDropZone(zone, moveCard));

    function moveCard(cardId, targetId) {
      if (!displayedCards.some((card) => card.id === cardId)) return;
      placements[cardId] = targetId;
      feedbackBox.textContent = "";
      feedbackBox.classList.remove("is-visible");
      renderMemoryCards();
    }

    function renderMemoryCards() {
      root.querySelectorAll(".memory-card-list").forEach((list) => {
        list.innerHTML = "";
      });

      displayedCards.forEach((card) => {
        const zoneId = placements[card.id] || "source";
        const list = root.querySelector(`[data-target-id="${cssEscape(zoneId)}"] .memory-card-list`);
        if (!list) return;
        const cardElement = createMemoryCard(card);
        list.appendChild(cardElement);
      });
    }

    function createMemoryCard(card) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `memory-card memory-card-${normalizeClassToken(card.cardType || "default")}`;
      element.draggable = true;
      element.dataset.cardId = card.id;
      element.innerHTML = `<span>${escapeHtml(card.cardType || "Karte")}</span>${escapeHtml(card.label)}`;

      element.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
      });
      setupPointerDrag(element, moveCard);
      return element;
    }

    renderMemoryCards();
    return root;
  }

  function createMemoryZone(targetId, label) {
    const zone = document.createElement("div");
    zone.className = targetId === "source" ? "memory-zone memory-source" : "memory-zone memory-target";
    zone.dataset.targetId = targetId;
    zone.innerHTML = `<strong>${escapeHtml(label)}</strong><div class="memory-card-list"></div>`;
    return { zone };
  }

  function setupMemoryDropZone(zone, moveCard) {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-over");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("is-over");
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-over");
      const cardId = event.dataTransfer.getData("text/plain");
      moveCard(cardId, zone.dataset.targetId);
    });
  }

  function setupPointerDrag(card, moveCard) {
    let ghost = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      startX = event.clientX;
      startY = event.clientY;
      dragging = true;
      card.setPointerCapture(event.pointerId);
      ghost = card.cloneNode(true);
      ghost.classList.add("memory-card-ghost");
      document.body.appendChild(ghost);
      positionGhost(ghost, event.clientX, event.clientY);
      event.preventDefault();
    });

    card.addEventListener("pointermove", (event) => {
      if (!dragging || !ghost) return;
      positionGhost(ghost, event.clientX, event.clientY);
      event.preventDefault();
    });

    card.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      const cardId = card.dataset.cardId;
      cleanupGhost();
      dragging = false;
      const dropTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest(".memory-zone");
      if (dropTarget?.dataset?.targetId) moveCard(cardId, dropTarget.dataset.targetId);
      event.preventDefault();
    });

    card.addEventListener("pointercancel", () => {
      cleanupGhost();
      dragging = false;
    });

    function cleanupGhost() {
      if (ghost) ghost.remove();
      ghost = null;
    }
  }

  function positionGhost(ghost, x, y) {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }

  function isMemoryTaskCorrect(task, placements) {
    const allTargetCardIds = new Set(task.targets.flatMap((target) => target.correctCards));
    const noCardLeftInSource = task.cards.every((card) => placements[card.id] !== "source");
    if (!noCardLeftInSource) return false;
    if (!task.cards.every((card) => allTargetCardIds.has(card.id))) return false;

    return task.targets.every((target) => {
      const expected = [...target.correctCards].sort();
      const actual = task.cards
        .filter((card) => placements[card.id] === target.id)
        .map((card) => card.id)
        .sort();
      return expected.length === actual.length && expected.every((cardId, index) => cardId === actual[index]);
    });
  }

  function formatReadingText(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join("");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function normalizeClassToken(value) {
    return String(value || "default")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "default";
  }

  function renderMismatchTasks(data) {
    const wrapper = document.createElement("div");
    wrapper.className = "task-stack";
    wrapper.append(
      renderMultipleChoiceTask(window.PhEnzymeLearning.getTaskById(data, "case_amylase_stomach_01")),
      renderShortAnswerTask(window.PhEnzymeLearning.getTaskById(data, "case_trypsin_stomach_01"), "Warum wäre Trypsin im Magen kaum aktiv?"),
      renderPromptOnlyTask("Warum arbeitet Pepsin im Dünndarm nicht optimal?", "Pepsin hat sein Optimum im stark sauren Magen. Im Dünndarm ist der pH-Wert eher neutral bis alkalisch, daher passt die Form des aktiven Zentrums weniger gut.")
    );
    return wrapper;
  }

  function renderHypochlorhydriaTasks(data) {
    const wrapper = document.createElement("div");
    wrapper.className = "task-stack";
    wrapper.append(
      renderMultipleChoiceTask(window.PhEnzymeLearning.getTaskById(data, "hypo_step_01")),
      renderDiagramReadingTask(data, window.PhEnzymeLearning.getTaskById(data, "hypo_step_02")),
      renderOrderTask(createHypochlorhydriaChainTask(window.PhEnzymeLearning.getTaskById(data, "hypo_step_03"))),
      renderShortAnswerTask(window.PhEnzymeLearning.getTaskById(data, "hypo_transfer_01"))
    );
    return wrapper;
  }

  function createHypochlorhydriaChainTask(baseTask) {
    return {
      ...baseTask,
      items: [
        { text: "Es wird zu wenig Magensäure gebildet.", order: 1 },
        { text: "Der pH-Wert im Magen steigt.", order: 2 },
        { text: "Pepsinogen wird schlechter zu Pepsin aktiviert.", order: 3 },
        { text: "Pepsin arbeitet schlechter.", order: 4 },
        { text: "Proteine werden im Magen schlechter vorverdaut.", order: 5 },
        { text: "Es kann zu Verdauungsbeschwerden kommen.", order: 6 }
      ]
    };
  }

  function renderSelfCheck(data) {
    const task = window.PhEnzymeLearning.getTaskById(data, "final_selfcheck_01");
    const wrapper = createTaskWrapper(task.prompt);
    task.items.forEach((item, index) => {
      const label = document.createElement("label");
      label.className = "checkbox-row";
      label.innerHTML = `<input type="checkbox" id="self-${index}"><span>${escapeHtml(item)}</span>`;
      wrapper.body.appendChild(label);
    });
    addCheckButton(wrapper, () => {
      const checked = task.items.filter((_, index) => document.getElementById(`self-${index}`).checked).length;
      return checked === task.items.length
        ? "Stark. Du hast alle Punkte abgehakt."
        : `Du hast ${checked} von ${task.items.length} Punkten abgehakt.`;
    });
    return wrapper.root;
  }

  function renderMultipleChoiceTask(task) {
    const wrapper = createTaskWrapper(task.prompt);
    shuffle(task.options).forEach((option) => {
      const label = document.createElement("label");
      label.className = "checkbox-row";
      label.innerHTML = `<input type="radio" name="${task.id}" value="${option.id}"><span>${escapeHtml(option.text)}</span>`;
      wrapper.body.appendChild(label);
    });
    addCheckButton(wrapper, () => {
      const selected = wrapper.root.querySelector(`input[name="${task.id}"]:checked`);
      const option = task.options.find((item) => item.id === selected?.value);
      return feedback(task, Boolean(option?.correct));
    });
    return wrapper.root;
  }

  function renderShortAnswerTask(task, promptOverride) {
    if (task.checkMode === "model_solution_only") {
      return createModelSolutionTask(task, promptOverride).root;
    }

    const wrapper = createTaskWrapper(promptOverride || task.prompt);
    const textarea = document.createElement("textarea");
    textarea.className = "short-answer";
    textarea.placeholder = "Antwort formulieren";
    wrapper.body.appendChild(textarea);
    addCheckButton(wrapper, () => {
      const correct = window.PhEnzymeLearning.checkShortAnswer(task, textarea.value);
      return correct ? "Gute Erklärung. Wichtige Fachbegriffe sind enthalten." : `Vergleiche mit dieser Musterlösung: ${task.sampleAnswer}`;
    });
    return wrapper.root;
  }

  function createModelSolutionTask(task, promptOverride) {
    const wrapper = createTaskWrapper(promptOverride || task.prompt);
    const textarea = document.createElement("textarea");
    textarea.className = "short-answer";
    textarea.placeholder = "Antwort formulieren";
    wrapper.body.appendChild(textarea);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Musterlösung";
    button.addEventListener("click", () => {
      if (wrapper.feedbackBox.classList.contains("is-visible")) {
        wrapper.feedbackBox.innerHTML = "";
        wrapper.feedbackBox.classList.remove("is-visible", "self-check-feedback");
        return;
      }

      wrapper.feedbackBox.innerHTML = `
        <strong>Musterlösung zur Selbstkontrolle</strong>
        ${task.selfComparePrompt ? `<span>${escapeHtml(task.selfComparePrompt)}</span>` : ""}
        <span>${escapeHtml(task.modelSolution || task.sampleAnswer || "")}</span>
      `;
      wrapper.feedbackBox.classList.add("is-visible", "self-check-feedback");
    });
    wrapper.root.appendChild(button);
    return wrapper;
  }

  function renderPromptOnlyTask(prompt, sampleAnswer) {
    const wrapper = createTaskWrapper(prompt);
    const textarea = document.createElement("textarea");
    textarea.className = "short-answer";
    textarea.placeholder = "Antwort formulieren";
    wrapper.body.appendChild(textarea);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Musterlösung";
    button.addEventListener("click", () => {
      if (wrapper.feedbackBox.classList.contains("is-visible")) {
        wrapper.feedbackBox.innerHTML = "";
        wrapper.feedbackBox.classList.remove("is-visible", "self-check-feedback");
        return;
      }

      wrapper.feedbackBox.innerHTML = `
        <strong>Musterlösung zur Selbstkontrolle</strong>
        <span>Vergleiche deine Antwort mit der Musterlösung.</span>
        <span>${escapeHtml(sampleAnswer)}</span>
      `;
      wrapper.feedbackBox.classList.add("is-visible", "self-check-feedback");
    });
    wrapper.root.appendChild(button);
    return wrapper.root;
  }

  function createTaskWrapper(prompt) {
    const root = document.createElement("div");
    root.className = "learning-task";
    const body = document.createElement("div");
    body.className = "task-body";
    root.innerHTML = `<p class="task-prompt">${escapeHtml(prompt)}</p>`;
    root.appendChild(body);
    const feedbackBox = document.createElement("p");
    feedbackBox.className = "task-feedback";
    root.appendChild(feedbackBox);
    return { root, body, feedbackBox };
  }

  function createSelectRow(labelText, options, id) {
    const label = document.createElement("label");
    label.className = "choice-row";
    const normalizedOptions = shuffle(options).map((option) => typeof option === "string" ? { label: option, value: option } : option);
    label.innerHTML = `<span>${escapeHtml(labelText)}</span><select id="${id}"><option value="">auswählen</option>${normalizedOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}</select>`;
    return label;
  }

  function addCheckButton(wrapper, evaluate) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Prüfen";
    button.addEventListener("click", () => {
      wrapper.feedbackBox.textContent = evaluate();
      wrapper.feedbackBox.classList.add("is-visible");
    });
    wrapper.root.appendChild(button);
  }

  function feedback(task, correct) {
    return window.PhEnzymeLearning.getFeedback(task, correct);
  }

  function getSelectValue(id) {
    return document.getElementById(id)?.value || "";
  }

  function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (select) select.value = value;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function createCurveSvg(enzyme, withTitle) {
    const imagePaths = {
      pepsin: "assets/images/diagramm_pepsin.png",
      amylase: "assets/images/diagramm_Amylase.png",
      trypsin: "assets/images/diagramm_trypsin.png"
    };
    const image = document.createElement("img");
    image.className = "ph-curve ph-curve-image";
    image.src = imagePaths[enzyme.id] || "";
    image.alt = `${withTitle ? enzyme.name + ": " : ""}Diagramm zur pH-Abhängigkeit der Enzymaktivität`;
    image.loading = "lazy";
    return image;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  temperatureSlider.addEventListener("input", () => {
    selectedTemperature = getSelectedSliderTemperature();
    runState = createInitialState(selectedTemperature);
    updateTemperatureDisplay();
    updateDisplays();
    drawSimulation();
  });

  startButton.addEventListener("click", startRun);
  pauseButton.addEventListener("click", pauseRun);
  stopButton.addEventListener("click", stopRun);
  clearPointsButton.addEventListener("click", clearPoints);
  openTemperatureSimulation.addEventListener("click", () => showView("temperature"));
  openPhLearning.addEventListener("click", openPhLearningArea);
  backToHomeFromPh.addEventListener("click", () => showView("home"));

  setupTemperatureControl();
  updateTemperatureDisplay();
  updateDisplays();
  setControlsForStatus("idle");
  drawSimulation();
  drawChart();
  showView("home");
})();
