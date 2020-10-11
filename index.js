const fs = require('fs').promises;
const path = require('path');

async function loadBeatmap(fileName) {
  /** @type {string} */
  const file = await fs.readFile(fileName, { encoding: 'utf-8' });
  const lines = file.split("\n").map(e => e.trim());

  const getProperty = (name) => lines.find(e => e.startsWith(name)).slice(name.length);

  const mode = parseInt(getProperty("Mode:"));
  if (mode !== 3) throw new Error("Invalid game mode");

  const title = getProperty("Title:");
  const artist = getProperty("Artist:");
  const creator = getProperty("Creator:");
  const version = getProperty("Version:");
  const OD = parseFloat(getProperty("OverallDifficulty:"));
  const columnCount = parseFloat(getProperty("CircleSize:"));

  let objectIndex = lines.indexOf('[HitObjects]');
  let notes = lines
    .filter((e, i) => e != "" && i > objectIndex)
    .map(object => {
      let [x, y, time, type, hitSound, params] = object.split(",");
      x = parseInt(x);
      time = parseInt(time);
      type = parseInt(type);
      let endTime = time;
      let sample;
      let isLN = false;
      if ((type & 128) > 0) {
        isLN = true;
        [endTime, sample] = params.split(":");
        endTime = parseInt(endTime);
      }
      let column = Math.floor(x * columnCount / 512);
      return { time, endTime, column, isLN };
    });
  return {
    metadata: {
      title, artist, creator, version
    },
    OD,
    columnCount,
    notes,
  };
}

async function loadFolder(folderName) {
  const folder = await fs.readdir(folderName);
  return Promise.all(folder.filter(e => e.endsWith('.osu')).map(e => loadBeatmap(path.join(folderName, e))));
}

function getTimingWindow(od, mods = "") {
  const marv = 16.5
  const perf = 64 - od * 3 + 0.5;
  const great = 97 - od * 3 + 0.5;
  const good = 127 - od * 3 + 0.5;
  const bad = 151 - od * 3 + 0.5;
  const miss = 188 - od * 3 + 0.5;
  let result = [marv, perf, great, good, bad, miss];
  if (mods.includes('EZ')) {
    return result.map(e => (e * 1.4) + 0.5);
  } else if (mods.includes('HR')) {
    return result.map(e => (e / 1.4) + 0.5);
  }
  return result;
}

function calculateDifficulty(columns, notes, timingWindow) {
  let totalStrain = 0;
  let columnStrains = [];
  let leftHandStrain = 0;
  let rightHandStrain = 0;
  for (let i = 0; i < columns; i++) {
    let columnStrain = 0;
    let columnNotes = notes.filter(e => e.column == i);
    for (let j = 0; j < columnNotes.length; j++) {
      let baseStrain = 0.1;
      let currentNote = columnNotes[j];
      if (j > 0) {
        let previousNote = columnNotes[j - 1];

        let timeDiff = currentNote.time - previousNote.endTime;
        let cappedTimeDiff = Math.max(timeDiff, timingWindow[1]);

        let noteStrain = 1.2 * 1000 / cappedTimeDiff + baseStrain;

        if (previousNote.isLN) {
          noteStrain *= 0.5
        }
        currentNote.strain = noteStrain;
      } else {
        currentNote.strain = baseStrain;
      }
    }
  }

  const averageStrain = Math.log(notes.map(e => Math.exp(e.strain)).reduce((a, b) => a + b) / notes.length);
  //const averageStrain = notes.map(e => (e.strain)).reduce((a, b) => a + b) / notes.length;

  return averageStrain;
}

const stableDifficulty = require('./stable_diffcalc');

const formatMetadata = ({ artist, title, creator, version }) => `${artist} - ${title} (${creator}) [${version}]`;

(async () => {
  let maps = await Promise.all([
    ...await loadFolder("data\\farm"),
    ...await loadFolder("data\\random"),
    ...await loadFolder("data\\testing"),
  ]);
  console.log(maps[0].notes.slice(-1));

  maps.forEach(e => {
    console.log(formatMetadata(e.metadata));
    console.log(calculateDifficulty(e.columnCount, e.notes, getTimingWindow(e.OD)));
    console.log(stableDifficulty.calculateDifficulty(e.columnCount, e.notes));
  });
})();

