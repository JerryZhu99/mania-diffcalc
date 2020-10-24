const { promises: fs, lstatSync } = require('fs');
const path = require('path');

const { parseBeatmap, getTimingWindow } = require('./src/utils');

const reworkDifficulty = require('./src/rework_diffcalc');
const stableDifficulty = require('./src/stable_diffcalc');

async function loadBeatmap(fileName) {
  const file = await fs.readFile(fileName, { encoding: 'utf-8' });
  return parseBeatmap(file);
}

async function loadFolder(folderName) {
  const folder = await fs.readdir(folderName);
  const files = folder.filter(e => e.endsWith('.osu'));
  const results = await Promise.all(files.map(e => loadBeatmap(path.join(folderName, e)).catch(e => (console.error(e), null))));
  return results.filter(e => e != null);
}

async function loadFolderNested(outerFolderName) {
  const outer = (await fs.readdir(outerFolderName)).map(e => path.join(outerFolderName, e));
  const folders = outer.filter(e => lstatSync(e).isDirectory);
  const maps = await Promise.all(folders.map(loadFolder));
  return [].concat(...maps);
}

(async () => {
  let folders = [
    'farm',
    'random',
    'ln',
    'chordjack',
    'testing',
    'dans',
    'player0',
    'bringobrango',
    'vibro',
    'ranked',
  ]

  for (let folder of folders) {
    let maps = await loadFolder(path.join('data', folder));

    let results = maps.map(e => ({
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

