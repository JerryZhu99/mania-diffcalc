const { getTimingWindow } = require("./utils");

const parameters = {
  STRAIN_FACTOR: 0.67,
  STRAIN_EXPONENT: 1.05,

  STAMINA_HALF_LIFE: 2000,
  STAMINA_STRAIN_FACTOR: 0.5,

  LN_SHORT_BONUS: 0.2,
  LN_SHORT_THRESHOLD: 200,
  LN_LONG_THRESHOLD: 500,
  LN_LONG_BONUS: 0.2,

  LN_INVERSE_MIN_THRESHOLD: 200,
  LN_INVERSE_BONUS: 0.6,

  LN_RELEASE_MIN_THRESHOLD: 400,
  LN_RELEASE_MAX_THRESHOLD: 600,
  LN_RELEASE_BONUS: 1,

  NEIGHBOURHOOD_SIZE: 400,
  DEVIATION_WEIGHT: 0.4,
};

function preprocessNotes(columns, notes) {
  // Per finger
  for (let i = 0; i < columns; i++) {
    let columnNotes = notes.filter(e => e.column == i);
    for (let j = 1; j < columnNotes.length; j++) {
      columnNotes[j].columnPrev = columnNotes[j - 1];
      columnNotes[j].columnDelta = columnNotes[j].time - columnNotes[j - 1].time;
      columnNotes[j - 1].columnNext = columnNotes[j];
    }
  }

  // Releases with significant overlap with held LN
  for (let i = 0; i < notes.length; i++) {
    notes[i].releaseCoverage = 0;
  }

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      if (notes[j].time > notes[i].endTime) {
        break;
      }
      if (notes[j].endTime < notes[i].endTime) {
        const start = Math.max(notes[j].endTime - parameters.LN_RELEASE_MAX_THRESHOLD / 2, notes[i].time)
        const end = Math.min(notes[j].endTime + parameters.LN_RELEASE_MAX_THRESHOLD / 2, notes[i].endTime)
        const range = Math.max(0, end - start);
        const coverage = (range - parameters.LN_RELEASE_MIN_THRESHOLD)
          / (parameters.LN_RELEASE_MAX_THRESHOLD - parameters.LN_RELEASE_MIN_THRESHOLD);

        notes[j].releaseCoverage = Math.max(notes[j].releaseCoverage, coverage);
      }
    }
  }

  // Neighbourhood
  let startIndex = 0;
  for (let i = 0; i < notes.length; i++) {
    // notes[i].neighbours = notes.filter(note => Math.abs(note.time - notes[i].time) < parameters.NEIGHBOURHOOD_SIZE);
    // Optimization of the above
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
      columnPrev: previousNote,
      columnNext: nextNote,
    } = currentNote;

    // Base strain
    let columnDensities = []
    for (let j = 0; j < columns; j++) {
      let notes = currentNote.neighbours.filter(e => e.column == j);
      columnDensities[j] = notes
        .map(note => {
          let delta = Math.abs(note.time - currentNote.time);
          let weight = (parameters.NEIGHBOURHOOD_SIZE - delta) / parameters.NEIGHBOURHOOD_SIZE
          return Math.sqrt(weight);
        })
        .reduce((a, b) => a + b, 0);
    }

    const max = Math.max(...columnDensities)
    const deviation = columnDensities.map(e => 2 * Math.sqrt(e * (max - e))).reduce((a, b) => a + b, 0) / max;
    const devBonus = 1 + parameters.DEVIATION_WEIGHT * deviation;
    let strain = parameters.STRAIN_FACTOR * devBonus * (max ** parameters.STRAIN_EXPONENT);

    currentNote.maxColumn = max;
    currentNote.devColumn = deviation;
    currentNote.baseStrain = strain;

    // Burst stamina
    currentNote.staminaBonus = 0
    if (previousNote && previousNote.baseStrain) {
      const timeDiff = currentNote.time - previousNote.time;
      const currentStaminaStrain = (2 ** (-timeDiff / parameters.STAMINA_HALF_LIFE)) * previousNote.baseStrain;
      currentNote.staminaBonus += currentStaminaStrain * parameters.STAMINA_STRAIN_FACTOR;
    }

    currentNote.baseStrain += currentNote.staminaBonus

    // LN bonuses
    let longNoteFactor = 0;
    if (currentNote.isLN) {
      let lnLength = currentNote.endTime - currentNote.time;
      lnLength = Math.max(parameters.LN_SHORT_THRESHOLD, lnLength);
      lnLength = Math.min(parameters.LN_LONG_THRESHOLD, lnLength);
      const relativeLength = (lnLength - parameters.LN_SHORT_THRESHOLD)
        / (parameters.LN_LONG_THRESHOLD - parameters.LN_SHORT_THRESHOLD);

      // Give a bonus depending on LN length
      longNoteFactor = relativeLength * parameters.LN_LONG_BONUS + (1 - relativeLength) * parameters.LN_SHORT_BONUS;

      // If the next note is close to the release (shields / inverse)
      if (nextNote) {
        const delta = nextNote.time - currentNote.endTime;
        const inverseFactor = Math.max(0, 1 - delta / parameters.LN_INVERSE_MIN_THRESHOLD);
        // Only apply inverse buff to long LNs
        longNoteFactor += relativeLength * inverseFactor * parameters.LN_INVERSE_BONUS;
      }

      // If the LN released during another LN body
      longNoteFactor *= 1 + currentNote.releaseCoverage * parameters.LN_RELEASE_BONUS
    }

    currentNote.longNoteBonus = longNoteFactor * currentNote.baseStrain;

    // Sum
    currentNote.strain = currentNote.baseStrain + currentNote.longNoteBonus;
  }
}

function calculateDifficulty(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  calculateStrains(columns, notes.filter(e => e.column < Math.floor(columns / 2)), timingWindow);
  calculateStrains(columns, notes.filter(e => e.column >= Math.floor(columns / 2)), timingWindow);

  // Weighted average
  const averageStrain = (notes.map(e => e.strain ** 6).reduce((a, b) => a + b, 0) / notes.length) ** (1 / 6);

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