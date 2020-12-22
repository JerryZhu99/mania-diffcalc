const { promises: fs, lstatSync } = require('fs');
const path = require('path');
const { parseBeatmap } = require('./utils');

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

module.exports = {
  loadBeatmap,
  loadFolder,
  loadFolderNested,
}