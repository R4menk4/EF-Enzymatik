window.SIMULATION_PARAMS = {
  simulation: {
    enzymeCount: 4,
    substrateCount: 10,
    temperatureSteps: [0, 10, 20, 30, 40, 50],
    optimumTemperature: 30,
    denaturationStartsAt: 40
  },
  temperatureSettings: {
    0: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 10,
      durationSeconds: 40,
      relativeVelocity: 13,
      denaturation: "none"
    },
    10: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 10,
      durationSeconds: 20,
      relativeVelocity: 25,
      denaturation: "none"
    },
    20: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 10,
      durationSeconds: 10,
      relativeVelocity: 50,
      denaturation: "none"
    },
    30: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 10,
      durationSeconds: 5,
      relativeVelocity: 100,
      denaturation: "none"
    },
    40: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 4,
      durationSeconds: 5,
      relativeVelocity: 40,
      denaturation: {
        type: "progressive",
        earlyDenaturedEnzymes: 2,
        remainingActiveEnzymes: 2,
        finalDenaturedEnzymes: 2
      }
    },
    50: {
      activeEnzymesAtStart: 4,
      convertedSubstrates: 1,
      durationSeconds: 5,
      relativeVelocity: 5,
      denaturation: {
        type: "rapid",
        immediatelyDenaturedEnzymes: 3,
        remainingActiveEnzymes: 1,
        finalDenaturedEnzymes: 1
      }
    }
  }
};