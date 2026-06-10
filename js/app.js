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
  const runStatus = document.getElementById("runStatus");

  const statTemperature = document.getElementById("statTemperature");
  const statConverted = document.getElementById("statConverted");
  const statActive = document.getElementById("statActive");
  const statDenatured = document.getElementById("statDenatured");
  const statTime = document.getElementById("statTime");
  const statVelocity = document.getElementById("statVelocity");

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

  let selectedTemperature = Number(temperatureSlider.value);
  let runState = createInitialState(selectedTemperature);
  let animationFrame = null;
  let lastFrameTime = null;
  let measuredPoints = [];

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
    thermometerFill.style.height = `${Math.max(5, (selectedTemperature / 50) * 100)}%`;
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
      const x = padding.left + (temperature / 50) * width;
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
      const x = padding.left + (temperature / 50) * width;
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
    return { x: padding.left + (point.temperature / 50) * width, y: padding.top + height - (point.velocity / 100) * height };
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

  temperatureSlider.addEventListener("input", () => {
    selectedTemperature = Number(temperatureSlider.value);
    runState = createInitialState(selectedTemperature);
    updateTemperatureDisplay();
    updateDisplays();
    drawSimulation();
  });

  startButton.addEventListener("click", startRun);
  pauseButton.addEventListener("click", pauseRun);
  stopButton.addEventListener("click", stopRun);
  clearPointsButton.addEventListener("click", clearPoints);

  updateTemperatureDisplay();
  updateDisplays();
  setControlsForStatus("idle");
  drawSimulation();
  drawChart();
})();
