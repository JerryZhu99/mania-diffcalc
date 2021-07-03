const { getTimingWindow } = require("./utils");

const parameters = {
  STRAIN_FACTOR: 1.25,
  STAMINA_HALF_LIFE: 4000,
  STAMINA_STRAIN_FACTOR: 0.5,
  LN_SHORT_THRESHOLD: 100,
  LN_SHORT_BONUS: 0.25,
  LN_LONG_LOWER_THRESHOLD: 200,
  LN_LONG_UPPER_THRESHOLD: 350,
  LN_LONG_BONUS: 0.75,
  NEIGHBOURHOOD_SIZE: 400, //ms
  DEVIATION_WEIGHT: 0.75,
  TOTAL_STRAIN_FACTOR: 0.5,
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

  // Neighbourhood
  let startIndex = 0;
  for (let i = 0; i < notes.length; i++) {
    // notes[i].neighbours = notes.filter(note => Math.abs(note.time - notes[i].time) < parameters.NEIGHBOURHOOD_SIZE);
    notes[i].neighbours = []
    for (let j = startIndex; j < notes.length; j++) {
      if (notes[j].time < notes[i].time - parameters.NEIGHBOURHOOD_SIZE) {
        startIndex = j + 1;
      } else if (notes[j].time > notes[i].time + parameters.NEIGHBOURHOOD_SIZE) {
        break;
      } else {
        notes[i].neighbours.push(notes[j])
      }
    }
  }
}

function calculateStrains(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  preprocessNotes(columns, notes);

  for (let i = 0; i < notes.length; i++) {
    let currentNote = notes[i];

    let {
      // prev: previousNote,
      columnPrev: previousNote,
    } = currentNote;

    let longNoteFactor = 0;

    // LN release bonus
    if (currentNote.isLN) {
      const lnLength = currentNote.endTime - currentNote.time;
      // const cappedLnLength = Math.max(lnLength, 40) // Cap strain at perfect window
      if (lnLength < parameters.LN_SHORT_THRESHOLD) {
        // Releasing a LN quickly creates strain
        longNoteFactor = ((1 - lnLength / parameters.LN_SHORT_THRESHOLD)) * parameters.LN_SHORT_BONUS;
      } else if (lnLength > parameters.LN_LONG_LOWER_THRESHOLD) {
        // Releasing a LN separately from the press creates strain
        const t = (lnLength - parameters.LN_LONG_LOWER_THRESHOLD) / (parameters.LN_LONG_UPPER_THRESHOLD - parameters.LN_LONG_LOWER_THRESHOLD);
        longNoteFactor = Math.min(1, t) * parameters.LN_LONG_BONUS;
      }
    }

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
    let strain = max * (1 - parameters.DEVIATION_WEIGHT) + deviation * parameters.DEVIATION_WEIGHT;

    currentNote.strain = parameters.STRAIN_FACTOR * strain;

    currentNote.longNoteBonus = longNoteFactor * currentNote.strain;
    currentNote.strain += currentNote.longNoteBonus;

    currentNote.staminaBonus = 0
    if (previousNote && previousNote.strain) {
      const timeDiff = currentNote.time - previousNote.time;
      const currentStaminaStrain = (2 ** (-timeDiff / parameters.STAMINA_HALF_LIFE)) * previousNote.strain;
      currentNote.staminaBonus += currentStaminaStrain * parameters.STAMINA_STRAIN_FACTOR;
    }
    currentNote.strain += currentNote.staminaBonus;
  }
}

function calculateDifficulty(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  calculateStrains(columns, notes.filter(e => e.column < Math.floor(columns / 2)), timingWindow);
  calculateStrains(columns, notes.filter(e => e.column >= Math.floor(columns / 2)), timingWindow);

  // Weighted average
  const averageStrain = (notes.map(e => e.strain ** 6).reduce((a, b) => a + b, 0) / notes.length) ** (1 / 6);
  //const averageStrain = notes.map(e => (e.strain)).reduce((a, b) => a + b) / notes.length;

  let maxTotalStrain = 0;
  for (let i = 0; i < columns; i++) {
    const columnNotes = notes.filter(e => e.column == i);
    const columnTotalStrain = Math.log(1 + columnNotes.map(e => e.strain).reduce((a, b) => a + b, 0) / 200);
    maxTotalStrain = Math.max(maxTotalStrain, columnTotalStrain);
  }

  return averageStrain + parameters.TOTAL_STRAIN_FACTOR * maxTotalStrain;
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