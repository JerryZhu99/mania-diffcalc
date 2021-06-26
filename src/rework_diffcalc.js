const { getTimingWindow } = require("./utils");

const parameters = {
  BASE_STRAIN: 0.0,
  STRAIN_FACTOR: 1.5,
  NOTE_STRAIN: 1.2 * 1000,
  LN_RELEASE_FACTOR: 0.60,
  STAMINA_HALF_LIFE: 4000,
  STAMINA_STRAIN_FACTOR: 0.5,
  JACK_REDUCTION_FACTOR: 0.6,
  LN_SHORT_THRESHOLD: 100,
  LN_SHORT_BONUS: 0.8,
  LN_LONG_BONUS: 0.5,
  NEIGHBOURHOOD_SIZE: 400, //ms
  DEVIATION_WEIGHT: 0.75,
};

const lerp = (a, b, t) => (a * (1 - t) + b * t)

function preprocessNotes(columns, notes) {
  // Per note
  for (let i = 1; i < notes.length; i++) {
    notes[i].prev = notes[i - 1];
    notes[i].delta = notes[i].time - notes[i - 1].time
  }

  // Per finger
  for (let i = 0; i < columns; i++) {
    let columnNotes = notes.filter(e => e.column == i);
    for (let j = 1; j < columnNotes.length; j++) {
      columnNotes[j].columnPrev = columnNotes[j - 1];
      columnNotes[j].columnDelta = columnNotes[j].time - columnNotes[j - 1].time;
    }
  }

  // Per hand
  let maxDeltas = new Array(columns).fill(0);

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    if (!note.columnPrev) continue;
    const delta = Math.max(0, note.time - note.prev.time);
    for (let c = 0; c < columns; c++) {
      maxDeltas[c] = Math.max(delta, maxDeltas[c]);
    }
    if (note.prev) {
      const maxDelta = maxDeltas[note.column]
      note.handDelta = maxDelta;
    }
    maxDeltas[note.column] = 0;
  }

  // Neighbourhood
  for (let i = 0; i < notes.length; i++) {
    notes[i].neighbours = notes.filter(note => Math.abs(note.time - notes[i].time) < parameters.NEIGHBOURHOOD_SIZE);
  }
}

function calculateStrains(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  preprocessNotes(columns, notes);

  for (let i = 0; i < notes.length; i++) {
    let currentNote = notes[i];

    let {
      prev: previousNote,
      columnPrev: previousNoteColumn,
      delta, columnDelta, handDelta
    } = currentNote;

    let strainBonus = 0;

    // LN release bonus
    if (currentNote.isLN) {
      const lnLength = currentNote.endTime - currentNote.time;
      const cappedLnLength = Math.max(lnLength, timingWindow[1]) // Cap strain at perfect window
      if (lnLength < parameters.LN_SHORT_THRESHOLD) {
        // Releasing a LN quickly creates strain
        strainBonus = ((1 - cappedLnLength / parameters.LN_SHORT_THRESHOLD) ** 2) * parameters.LN_SHORT_BONUS;
      } else {
        // Releasing a LN separately from the press creates strain
        strainBonus = Math.min(1, (cappedLnLength / parameters.LN_SHORT_THRESHOLD - 1) ** 2) * parameters.LN_LONG_BONUS;
      }
    }

    // if (!previousNoteColumn) {
    //   currentNote.strainStaminaFactor = 0;
    //   currentNote.strain = parameters.BASE_STRAIN;
    //   currentNote.strain *= (1 + strainBonus);
    //   continue;
    // }

    // // Wrist (jack)
    // let cappedColumnDelta = Math.max(columnDelta, timingWindow[1]);
    // let wristStrain = parameters.NOTE_STRAIN / cappedColumnDelta + parameters.BASE_STRAIN;

    // const emptyRatio = Math.min(1, (handDelta / columnDelta));
    // const reductionFactor = 1 - parameters.JACK_REDUCTION_FACTOR * (Math.max(0, 2 * emptyRatio - 1));

    // wristStrain *= reductionFactor;

    // let strain = wristStrain

    // // Stamina decays exponentially
    // const staminaStrain = (2 ** (-columnDelta / parameters.STAMINA_HALF_LIFE)) * previousNoteColumn.strainStaminaFactor;
    // strain += staminaStrain;
    // currentNote.strainStaminaFactor = staminaStrain + parameters.STAMINA_STRAIN_FACTOR * wristStrain;

    // strain *= (1 + strainBonus);

    let strain = 0;

    let columnDensities = []
    for (let i = 0; i < columns; i++) {
      let notes = currentNote.neighbours.filter(e => e.column == i);
      columnDensities[i] = notes
        .map(note => {
          let delta = Math.abs(note.time - currentNote.time);
          let weight = (parameters.NEIGHBOURHOOD_SIZE - delta) / parameters.NEIGHBOURHOOD_SIZE
          return Math.sqrt(weight);
        })
        .reduce((a, b) => a + b, 0);
    }

    const mean = columnDensities.reduce((a, b) => a + b, 0);
    const max = Math.max(...columnDensities)
    const deviation = Math.sqrt(columnDensities.map(e => e * (max - e)).reduce((a, b) => a + b, 0));
    strain = max * (1 - parameters.DEVIATION_WEIGHT) + deviation * parameters.DEVIATION_WEIGHT;

    currentNote.strain = parameters.BASE_STRAIN + parameters.STRAIN_FACTOR * strain * (1 + strainBonus);

    if (previousNote && previousNote.strain) {
      const timeDiff = currentNote.time - previousNote.time;
      const currentStaminaStrain = (2 ** (-timeDiff / parameters.STAMINA_HALF_LIFE)) * previousNote.strain;
      currentNote.strain += currentStaminaStrain * parameters.STAMINA_STRAIN_FACTOR;
    }
  }
}

function calculateDifficulty(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  let totalStrain = 0;

  calculateStrains(columns, notes.filter(e => e.column < Math.floor(columns / 2)), timingWindow);
  calculateStrains(columns, notes.filter(e => e.column >= Math.floor(columns / 2)), timingWindow);

  // Weighted average
  const averageStrain = (notes.map(e => e.strain ** 6).reduce((a, b) => a + b, 0) / notes.length) ** (1 / 6);
  //const averageStrain = notes.map(e => (e.strain)).reduce((a, b) => a + b) / notes.length;

  return averageStrain;
}

function calculate(map) {
  const columns = map.columnCount;
  const notes = map.notes;
  const mirrorNotes = map.notes.map(e => ({ ...e, column: columns - 1 - e.column }));
  const timingWindow = getTimingWindow(map.overallDifficulty);
  // Assume mirror
  return Math.min(
    calculateDifficulty(columns, notes, timingWindow),
    calculateDifficulty(columns, mirrorNotes, timingWindow));
}

module.exports = {
  calculateDifficulty,
  calculate,
}