
class Skill {
  constructor() {
    this.strainPeaks = [];
    this.decayWeight = 0.9;
    this.currentStrain = 1;
    this.currentSectionPeak = 1;
    this.previous = [];
    this.skillMultiplier = 0;
    this.strainDecayBase = 0
  }


  /// <summary>
  /// Process a <see cref="DifficultyHitObject"/> and update current strain values accordingly.
  /// </summary>
  process(current) {
    this.currentStrain *= this.strainDecay(current.deltaTime);
    this.currentStrain += this.strainValueOf(current) * this.skillMultiplier;

    this.currentSectionPeak = Math.max(this.currentStrain, this.currentSectionPeak);

    this.previous.push(current);
  }

  /// <summary>
  /// Saves the current peak strain level to the list of strain peaks, which will be used to calculate an overall difficulty.
  /// </summary>
  saveCurrentPeak() {
    if (this.previous.length > 0)
      this.strainPeaks.push(this.currentSectionPeak);
  }

  /// <summary>
  /// Sets the initial strain level for a new section.
  /// </summary>
  /// <param name="offset">The beginning of the new section in milliseconds.</param>
  startNewSectionFrom(offset) {
    // The maximum strain of the new section is not zero by default, strain decays as usual regardless of section boundaries.
    // This means we need to capture the strain level at the beginning of the new section, and use that as the initial peak level.
    if (this.previous.length > 0)
      this.currentSectionPeak = this.currentStrain * this.strainDecay(offset - this.previous[0].time);
  }

  /// <summary>
  /// Returns the calculated difficulty value representing all processed <see cref="DifficultyHitObject"/>s.
  /// </summary>
  difficultyValue() {
    let difficulty = 0;
    let weight = 1;

    // Difficulty is the weighted sum of the highest strains from every section.
    // We're sorting from highest to lowest strain.
    for (let strain of this.strainPeaks.sort((a, b) => b - a)) {
      difficulty += strain * weight;
      weight *= this.decayWeight;
    }

    return difficulty;
  }

  /// <summary>
  /// Calculates the strain value of a <see cref="DifficultyHitObject"/>. This value is affected by previously processed objects.
  /// </summary>
  strainDecay(ms) {
    return Math.pow(this.strainDecayBase, ms / 1000.0);
  }
}

class IndividualSkill extends Skill {
  constructor(column, columnCount) {
    super();
    this.column = column;

    this.holdEndTimes = new Array(columnCount).fill(0.0);

    this.skillMultiplier = 1.0;
    this.strainDecayBase = 0.125;
  }

  strainValueOf(current) {
    let endTime = current.endTime;

    try {
      if (current.column != this.column)
        return 0;

      // We give a slight bonus if something is held meanwhile
      return this.holdEndTimes.some(t => t > endTime) ? 2.5 : 2.0;
    } finally {
      this.holdEndTimes[current.column] = endTime;
    }
  }
}

class OverallSkill extends Skill {
  constructor(columnCount) {
    super();
    this.skillMultiplier = 1.0;
    this.strainDecayBase = 0.3;
    this.columnCount = columnCount;
    this.holdEndTimes = new Array(columnCount).fill(0.0);
  }

  strainValueOf(current) {
    let endTime = current.endTime;

    let holdFactor = 1.0; // Factor in case something else is held
    let holdAddition = 0; // Addition to the current note in case it's a hold and has to be released awkwardly

    for (let i = 0; i < this.columnCount; i++) {
      // If there is at least one other overlapping end or note, then we get an addition, buuuuuut...
      if (current.time < this.holdEndTimes[i] && endTime > this.holdEndTimes[i])
        holdAddition = 1.0;

      // ... this addition only is valid if there is _no_ other note with the same ending.
      // Releasing multiple notes at the same time is just as easy as releasing one
      if (endTime == this.holdEndTimes[i])
        holdAddition = 0;

      // We give a slight bonus if something is held meanwhile
      if (this.holdEndTimes[i] > endTime)
        holdFactor = 1.25;
    }

    this.holdEndTimes[current.column] = endTime;

    return (1 + holdAddition) * holdFactor;
  }


}

class DifficultyCalculator {

  calculate(columnCount, notes) {
    if (notes.length == 0) return 0;
    notes = notes.sort((a, b) => a.time - b.time);

    let objects = [];
    for (let i = 1; i < notes.length; i++) {
      objects.push({ deltaTime: notes[i].time - notes[i - 1].time, ...notes[i] })
    }
    const sectionLength = 400;

    let skills = this.createSkills(columnCount);
    let currentSectionEnd = Math.ceil(notes[0].time / sectionLength) * sectionLength;

    for (let h of objects) {
      while (h.time > currentSectionEnd) {
        for (let s of skills) {
          s.saveCurrentPeak();
          s.startNewSectionFrom(currentSectionEnd);
        }

        currentSectionEnd += sectionLength;
      }

      for (let s of skills) {
        s.process(h);
      }
    }
    // The peak strain will not be saved for the last section in the above loop
    for (let s of skills) {
      s.saveCurrentPeak();
    }

    return this.createDifficultyAttributes(columnCount, objects, skills)
  }

  createSkills(columnCount) {
    let skills = [new OverallSkill(columnCount)];

    for (let i = 0; i < columnCount; i++)
      skills.push(new IndividualSkill(i, columnCount));

    return skills;
  }

  createDifficultyAttributes(columnCount, objects, skills) {
    const star_scaling_factor = 0.018;

    let [overall, ...individualSkills] = skills;

    let aggregatePeaks = new Array(overall.strainPeaks.length).fill(0.0);

    for (let individual of individualSkills) {
      for (let i = 0; i < individual.strainPeaks.length; i++) {
        let aggregate = individual.strainPeaks[i] + overall.strainPeaks[i];

        if (aggregate > aggregatePeaks[i])
          aggregatePeaks[i] = aggregate;
      }
    }

    aggregatePeaks.sort((a, b) => b - a); // Sort from highest to lowest strain.

    let difficulty = 0.0;
    let weight = 1.0;

    // Difficulty is the weighted sum of the highest strains from every section.
    for (let strain of aggregatePeaks) {
      difficulty += strain * weight;
      weight *= 0.9;
    }

    return difficulty * star_scaling_factor;
  }
}

function calculateDifficulty(columnCount, notes, timingWindow) {
  return new DifficultyCalculator().calculate(columnCount, notes)
}

function calculate(map) {
  return calculateDifficulty(map.columnCount, map.notes);
}

module.exports = {
  calculateDifficulty,
  calculate,
};