const { promises: fs } = require('fs');
const path = require('path');

const { parseBeatmap, getTimingWindow } = require('./src/utils');
const { loadFolder } = require('./src/file_utils');

const reworkDifficulty = require('./src/rework_diffcalc');
const stableDifficulty = require('./src/stable_diffcalc');

(async () => {
  let folders = [
    'farm',
    'random',
    'ln',
    'chordjack',
    'testing',
    'dans',
    // 'player0',
    // 'bringobrango',
    'vibro',
    'ranked-4k',
    'ranked-5k',
    'ranked-6k',
    'ranked-7k',
    'ranked-8k',
    'ranked-9k',
  ]

  for (let folder of folders) {
    let maps = await loadFolder(path.join('data', folder));
    console.log(`processing ${folder} (${maps.length})`)

    let results = maps
      .filter(e => !folder.startsWith('ranked') || Math.random() < 0.2)
      .map(e => ({
        metadata: e.metadata,
        columnCount: e.columnCount,
        lnPercent: e.lnPercent,
        length: e.length,
        oldRating: stableDifficulty.calculateDifficulty(e.columnCount, e.notes),
        newRating: reworkDifficulty.calculateDifficulty(e.columnCount, e.notes, getTimingWindow(e.overallDifficulty)),
      }));

    await fs.writeFile(`output/${folder}.json`, JSON.stringify(results));
  }
})();

