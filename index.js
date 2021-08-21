const { promises: fs, existsSync } = require('fs');
const path = require('path');

const { parseBeatmap, getTimingWindow } = require('./src/utils');
const { loadFolder } = require('./src/file_utils');

const reworkDifficulty = require('./src/rework_diffcalc');
const stableDifficulty = require('./src/stable_diffcalc');

(async () => {
  let folders = [
    'reform-dans',
    'ln-v2-dans',
    '7k-regular-dans',
    '7k-ln-dans',
    'ranked-4k',
    'ranked-7k',
    'loved-4k',
    'loved-7k',
    'vibro-dans',
    'vibro',
  ]

  if (!existsSync('dist/data')) {
    await fs.mkdir('dist/data');
  }

  for (let folder of folders) {
    let maps = await loadFolder(path.join('data', folder));
    console.log(`processing ${folder} (${maps.length})`)

    let results = maps
      .map(e => ({
        metadata: e.metadata,
        columnCount: e.columnCount,
        lnPercent: e.lnPercent,
        length: e.length,
        oldRating: stableDifficulty.calculateDifficulty(e.columnCount, e.notes),
        newRating: reworkDifficulty.calculateDifficulty(e.columnCount, e.notes, getTimingWindow(e.overallDifficulty)),
      }));

    await fs.writeFile(`dist/data/${folder}.json`, JSON.stringify(results));
  }
})();

