const { loadFolder } = require('../src/file_utils');
const reworkDifficulty = require('../src/rework_diffcalc');
const stableDifficulty = require('../src/stable_diffcalc');

const { formatMetadata } = require('../src/utils');

const { expect } = require('chai')

describe('Buff / Nerfs', () => {
  it('Farm maps should be nerfed', async () => {
    const maps = await loadFolder('test/data/farm');
    for (let map of maps) {
      const oldDiff = stableDifficulty.calculate(map);
      const newDiff = reworkDifficulty.calculate(map);
      expect(newDiff).to.be.lessThan(oldDiff, formatMetadata(map.metadata));
    }
  });

  it('Underweighted maps should be buffed', async () => {
    const maps = await loadFolder('test/data/buff');
    for (let map of maps) {
      const oldDiff = stableDifficulty.calculate(map);
      const newDiff = reworkDifficulty.calculate(map);
      expect(newDiff).to.be.greaterThan(oldDiff, formatMetadata(map.metadata));
    }
  });
})