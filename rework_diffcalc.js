
const parameters = {
  BASE_STRAIN: 0.1,
  NOTE_STRAIN: 0.8 * 1000,
  LN_RELEASE_FACTOR: 0.65,
  WRIST_REDUCTION_FACTOR: 0.65,
};

const lerp = (a, b, t) => (a * (1 - t) + b * t)

function calculateDifficulty(columns, notes, timingWindow) {
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

        let timeDiff = currentNote.time - previousNote.endTime;
        let cappedTimeDiff = Math.max(timeDiff, timingWindow[1]);

        let noteStrain = parameters.NOTE_STRAIN / cappedTimeDiff + baseStrain;

        if (previousNote.isLN) {
          noteStrain *= parameters.LN_RELEASE_FACTOR
        }
        currentNote.strain = noteStrain;
        currentNote.fingerStrain = noteStrain;
      } else {
        currentNote.strain = baseStrain;
        currentNote.fingerStrain = baseStrain;
      }
    }
  }

  const computeWristStrains = (handColumns) => {
    let handNotes = notes.filter(e => handColumns.includes(e.column));
    for (let i = 0; i < handNotes.length; i++) {
      for (let j = i + 1; j < handNotes.length; j++) {
        if (i != j && handNotes[i].column != handNotes[j].column) {
          const delta = Math.abs(handNotes[i].time - handNotes[j].time);
          let strainFactor = 1;
          if (delta < timingWindow[2]) {
            strainFactor = lerp(parameters.WRIST_REDUCTION_FACTOR, 1, ((delta / timingWindow[2]) ** 2));
          }
          handNotes[i].strain = Math.min(handNotes[i].strain, handNotes[i].fingerStrain * strainFactor);
          handNotes[j].strain = Math.min(handNotes[j].strain, handNotes[j].fingerStrain * strainFactor);
        }
      }
    }
  }
  // left hand
  let leftHandColumns = [];
  for (let i = 0; i < Math.ceil(columns / 2); i++) {
    leftHandColumns.push(i)
  }
  computeWristStrains(leftHandColumns);

  // right hand
  let rightHandColumns = [];
  for (let i = Math.floor(columns / 2); i < columns; i++) {
    rightHandColumns.push(i)
  }
  computeWristStrains(rightHandColumns);

  const averageStrain = Math.log(notes.map(e => Math.exp(e.strain)).reduce((a, b) => a + b, 0) / notes.length);
  //const averageStrain = notes.map(e => (e.strain)).reduce((a, b) => a + b) / notes.length;

  return averageStrain;
}

module.exports = {
  calculateDifficulty,
}