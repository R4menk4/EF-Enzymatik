(function () {
  function getEnzymes(data) {
    return Array.isArray(data?.enzymes) ? data.enzymes : [];
  }

  function getEnzymeById(data, enzymeId) {
    return getEnzymes(data).find((enzyme) => enzyme.id === enzymeId) || null;
  }

  function getCoreEnzymes(data) {
    const coreIds = ["pepsin", "amylase", "trypsin"];
    return getEnzymes(data).filter((enzyme) => coreIds.includes(enzyme.id));
  }

  function getActivityAtPh(enzyme, phValue) {
    if (!enzyme?.curve || typeof phValue !== "number") return null;
    const exactPoint = enzyme.curve.find((point) => point.ph === phValue);
    if (exactPoint) return exactPoint.activity;
    const sortedCurve = [...enzyme.curve].sort((a, b) => a.ph - b.ph);
    const lower = [...sortedCurve].reverse().find((point) => point.ph < phValue);
    const upper = sortedCurve.find((point) => point.ph > phValue);
    if (!lower || !upper) return null;
    const ratio = (phValue - lower.ph) / (upper.ph - lower.ph);
    return Math.round(lower.activity + ratio * (upper.activity - lower.activity));
  }

  function getOptimumFromCurve(enzyme) {
    if (!enzyme?.curve?.length) return null;
    return enzyme.curve.reduce((bestPoint, currentPoint) => {
      return currentPoint.activity > bestPoint.activity ? currentPoint : bestPoint;
    }, enzyme.curve[0]);
  }

  function checkDiagramMatch(diagramId, selectedEnzymeId) {
    const diagramToEnzyme = {
      curve_peak_ph2: "pepsin",
      curve_peak_ph7: "amylase",
      curve_peak_ph8: "trypsin"
    };
    return diagramToEnzyme[diagramId] === selectedEnzymeId;
  }

  function checkOrderedItems(task, userItemIdsOrTexts) {
    if (!task?.items || !Array.isArray(userItemIdsOrTexts)) return false;
    const correctOrder = [...task.items]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id || item.text);
    return correctOrder.every((itemKey, index) => itemKey === userItemIdsOrTexts[index]);
  }

  function normalizeAnswer(answer) {
    return String(answer || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function checkShortAnswer(task, userAnswer) {
    const normalized = normalizeAnswer(answerText(userAnswer));
    if (Array.isArray(task?.acceptedAnswers)) {
      return task.acceptedAnswers.some((accepted) => normalized === normalizeAnswer(answerText(accepted)));
    }
    if (Array.isArray(task?.keywords)) {
      return task.keywords.some((keyword) => normalized.includes(normalizeAnswer(answerText(keyword))));
    }
    return false;
  }

  function answerText(value) {
    return String(value || "");
  }

  function getFeedback(task, isCorrect) {
    if (!task) return "";
    return isCorrect
      ? task.feedbackCorrect || "Richtig."
      : task.feedbackIncorrect || "Das stimmt noch nicht ganz.";
  }

  function buildDiagramConfig(enzyme) {
    if (!enzyme) return null;
    return {
      title: `${enzyme.name}: Enzymaktivität in Abhängigkeit vom pH-Wert`,
      xLabel: "pH-Wert",
      yLabel: "relative Enzymaktivität (%)",
      xMin: 0,
      xMax: 12,
      yMin: 0,
      yMax: 100,
      curve: enzyme.curve,
      optimum: getOptimumFromCurve(enzyme),
      highActivityRange: enzyme.highActivityRange,
      legendLabel: enzyme.name
    };
  }

  function getModuleById(data, moduleId) {
    return Array.isArray(data?.modules)
      ? data.modules.find((module) => module.id === moduleId) || null
      : null;
  }

  function getTaskById(data, taskId) {
    if (!Array.isArray(data?.modules)) return null;
    for (const module of data.modules) {
      const task = module.tasks?.find((item) => item.id === taskId);
      if (task) return task;
    }
    return null;
  }

  window.PhEnzymeLearning = {
    getEnzymes,
    getEnzymeById,
    getCoreEnzymes,
    getActivityAtPh,
    getOptimumFromCurve,
    checkDiagramMatch,
    checkOrderedItems,
    checkShortAnswer,
    getFeedback,
    buildDiagramConfig,
    getModuleById,
    getTaskById
  };
})();
