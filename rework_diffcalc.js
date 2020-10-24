
const parameters = {
  BASE_STRAIN: 0.7,
  NOTE_STRAIN: 1.3 * 1000,
  LN_RELEASE_FACTOR: 0.60,
  STAMINA_HALF_LIFE: 1000,
  STAMINA_STRAIN_FACTOR: 0.016,
  CHORD_REDUCTION_FACTOR: 0.0,
  JACK_REDUCTION_FACTOR: 0.6,
  LN_LONG_BONUS: 0.2,
  LN_SHORT_THRESHOLD: 100,
  LN_SHORT_BONUS: 0.4,
};

const lerp = (a, b, t) => (a * (1 - t) + b * t)

function calculateDifficulty(columns, notes, timingWindow) {
  if (notes.length == 0) return 0;

  let totalStrain = 0;
  let columnStrains = [];
  let leftHandStrain = 0;
  let rightHandStrain = 0;

  for (let i = 0; i < columns; i++) {
    let columnNotes = notes.filter(e => e.column == i);
    for (let j = 0; j < columnNotes.length; j++) {
      let baseStrain = parameters.BASE_STRAIN;
      let currentNote = columnNotes[j];
      if (j > 0) {
        let previousNote = columnNotes[j - 1];
        currentNote.prev = previousNote;

        const timeDiff = currentNote.time - previousNote.endTime;
        const cappedTimeDiff = Math.max(timeDiff, timingWindow[1]); // Cap strain at perfect window

        let noteStrain = parameters.NOTE_STRAIN / cappedTimeDiff + baseStrain;

        // LN release is easier than jack
        if (previousNote.isLN) {
          noteStrain *= parameters.LN_RELEASE_FACTOR;
        }

        // LN release bonus
        if (currentNote.isLN) {
          const lnLength = currentNote.endTime - currentNote.time;
          const cappedLnLength = Math.max(lnLength, timingWindow[1]) // Cap strain at perfect window
          let strainBonus = 0;
          if (lnLength < parameters.LN_SHORT_THRESHOLD) {
            // Releasing a LN quickly creates strain
            strainBonus = ((1 - cappedLnLength / parameters.LN_SHORT_THRESHOLD) ** 2) * parameters.LN_SHORT_BONUS;
          } else {
            // Releasing a LN separately from the press creates strain
            strainBonus = Math.min(1, (cappedLnLength / parameters.LN_SHORT_THRESHOLD - 1) ** 2) * parameters.LN_LONG_BONUS;
          }

          noteStrain *= (1 + strainBonus);
        }


        currentNote.fingerStrain = noteStrain;

        // Stamina decays exponentially
        const currentStaminaStrain = (2 ** (-timeDiff / parameters.STAMINA_HALF_LIFE)) * previousNote.staminaFactor;
        currentNote.fingerStrain += currentStaminaStrain;
        currentNote.staminaFactor = currentStaminaStrain + parameters.STAMINA_STRAIN_FACTOR * noteStrain;
      } else {
        currentNote.staminaFactor = 0;
        currentNote.fingerStrain = baseStrain;
      }
    }
  }

  const computeWristStrains = (handColumns) => {
    let handNotes = notes.filter(e => handColumns.includes(e.column));
    let maxDeltas = new Array(columns).fill(0);

    /*
    for (let i = 0; i < handNotes.length; i++) {
      // Chords are not finger strains
      for (let j = i + 1; j < handNotes.length; j++) {
        if (handNotes[i].column != handNotes[j].column) {
          const delta = handNotes[j].time - handNotes[i].time;
          let strainFactor = 1;
          if (delta < timingWindow[2]) {
            strainFactor = 1 - lerp(parameters.CHORD_REDUCTION_FACTOR, 0, ((delta / timingWindow[2]) ** 2));
          }
          handNotes[i].strain = Math.min(handNotes[i].strain, handNotes[i].fingerStrain * strainFactor);
          handNotes[j].strain = Math.min(handNotes[j].strain, handNotes[j].fingerStrain * strainFactor);
        }
      }
    }
    */

    for (let i = 0; i < handNotes.length; i++) {
      // Reduce strain for wristjacks
      if (i > 0) {
        const delta = Math.max(0, handNotes[i].time - handNotes[i - 1].time);
        for (let c = 0; c < columns; c++) {
          maxDeltas[c] = Math.max(delta, maxDeltas[c]);
        }
      }
      if (handNotes[i].prev) {
        const maxDelta = maxDeltas[handNotes[i].column] + timingWindow[1];
        const deltaColumn = handNotes[i].time - handNotes[i].prev.endTime;
        const emptyRatio = Math.min(1, (maxDelta / deltaColumn));
        const reductionFactor = 1 - parameters.JACK_REDUCTION_FACTOR * (Math.max(0, 2 * emptyRatio - 1));
        handNotes[i].jackFactor = Math.min(handNotes[i].jackFactor || 1, reductionFactor);
      }
      maxDeltas[handNotes[i].column] = 0;
    }
  }
  // Left hand
  let leftHandColumns = [];
  for (let i = 0; i < Math.ceil(columns / 2); i++) {
    leftHandColumns.push(i)
  }
  computeWristStrains(leftHandColumns);

  // Right hand
  let rightHandColumns = [];
  for (let i = Math.floor(columns / 2); i < columns; i++) {
    rightHandColumns.push(i)
  }
  computeWristStrains(rightHandColumns);

  // Final strain
  for (let currentNote of notes) {
    currentNote.strain = currentNote.fingerStrain;
    if (currentNote.jackFactor !== undefined) {
      currentNote.strain *= currentNote.jackFactor;
    }
  }

  // Average of exponentials
  const averageStrain = Math.log2(notes.map(e => 2 ** e.strain).reduce((a, b) => a + b, 0) / notes.length);
  //const averageStrain = notes.map(e => (e.strain)).reduce((a, b) => a + b) / notes.length;

  return averageStrain;
}

module.exports = {
  calculateDifficulty,
}