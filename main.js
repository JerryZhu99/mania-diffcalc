/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is not neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/rework_diffcalc.js":
/*!********************************!*\
  !*** ./src/rework_diffcalc.js ***!
  \********************************/
/*! unknown exports (runtime-defined) */
/*! runtime requirements: module, __webpack_require__ */
/*! CommonJS bailout: module.exports is used directly at 185:0-14 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("const { getTimingWindow } = __webpack_require__(/*! ./utils */ \"./src/utils.js\");\n\nconst parameters = {\n  STRAIN_FACTOR: 0.68,\n  STRAIN_EXPONENT: 1.1,\n\n  STAMINA_HALF_LIFE: 4000,\n  STAMINA_STRAIN_FACTOR: 0.5,\n\n  LN_SHORT_BONUS: 0.2,\n  LN_SHORT_THRESHOLD: 200,\n  LN_LONG_THRESHOLD: 500,\n  LN_LONG_BONUS: 0.2,\n\n  LN_INVERSE_MIN_THRESHOLD: 200,\n  LN_INVERSE_BONUS: 0.6,\n\n  LN_RELEASE_MIN_THRESHOLD: 400,\n  LN_RELEASE_MAX_THRESHOLD: 600,\n  LN_RELEASE_BONUS: 1,\n\n  NEIGHBOURHOOD_SIZE: 400,\n  DEVIATION_WEIGHT: 0.3,\n\n  WEIGHT_EXPONENT: 4,\n};\n\nfunction preprocessNotes(columns, notes) {\n  // Per note\n  for (let i = 1; i < notes.length; i++) {\n    notes[i].prev = notes[i - 1];\n    notes[i].delta = notes[i].time - notes[i - 1].time\n  }\n\n  // Per finger\n  for (let i = 0; i < columns; i++) {\n    let columnNotes = notes.filter(e => e.column == i);\n    for (let j = 1; j < columnNotes.length; j++) {\n      columnNotes[j].columnPrev = columnNotes[j - 1];\n      columnNotes[j].columnDelta = columnNotes[j].time - columnNotes[j - 1].time;\n      columnNotes[j - 1].columnNext = columnNotes[j];\n    }\n  }\n\n  // Releases with significant overlap with held LN\n  for (let i = 0; i < notes.length; i++) {\n    notes[i].releaseCoverage = 0;\n  }\n\n  for (let i = 0; i < notes.length; i++) {\n    for (let j = i + 1; j < notes.length; j++) {\n      if (notes[j].time > notes[i].endTime) {\n        break;\n      }\n      if (notes[j].endTime < notes[i].endTime) {\n        const start = Math.max(notes[j].endTime - parameters.LN_RELEASE_MAX_THRESHOLD / 2, notes[i].time)\n        const end = Math.min(notes[j].endTime + parameters.LN_RELEASE_MAX_THRESHOLD / 2, notes[i].endTime)\n        const range = Math.max(0, end - start);\n        const coverage = (range - parameters.LN_RELEASE_MIN_THRESHOLD)\n          / (parameters.LN_RELEASE_MAX_THRESHOLD - parameters.LN_RELEASE_MIN_THRESHOLD);\n\n        notes[j].releaseCoverage = Math.max(notes[j].releaseCoverage, coverage);\n      }\n    }\n  }\n\n  // Neighbourhood\n  let startIndex = 0;\n  for (let i = 0; i < notes.length; i++) {\n    // notes[i].neighbours = notes.filter(note => Math.abs(note.time - notes[i].time) < parameters.NEIGHBOURHOOD_SIZE);\n    // Optimization of the above\n    notes[i].neighbours = []\n    for (let j = startIndex; j < notes.length; j++) {\n      if (notes[j].time < notes[i].time - parameters.NEIGHBOURHOOD_SIZE) {\n        startIndex = j + 1;\n      } else if (notes[j].time > notes[i].time + parameters.NEIGHBOURHOOD_SIZE) {\n        break;\n      } else {\n        notes[i].neighbours.push(notes[j])\n      }\n    }\n  }\n}\n\nfunction calculateStrains(columns, notes, timingWindow) {\n  if (notes.length == 0) return 0;\n\n  preprocessNotes(columns, notes);\n\n  for (let i = 0; i < notes.length; i++) {\n    let currentNote = notes[i];\n\n    let {\n      prev: previousNote,\n      columnNext: columnNextNote,\n    } = currentNote;\n\n    // Base strain\n    let columnDensities = []\n    for (let j = 0; j < columns; j++) {\n      let notes = currentNote.neighbours.filter(e => e.column == j);\n      columnDensities[j] = notes\n        .map(note => {\n          let delta = Math.abs(note.time - currentNote.time);\n          let weight = (parameters.NEIGHBOURHOOD_SIZE - delta) / parameters.NEIGHBOURHOOD_SIZE\n          return Math.sqrt(weight);\n        })\n        .reduce((a, b) => a + b, 0);\n    }\n\n    const max = Math.max(...columnDensities)\n    const deviation = columnDensities.map(e => 2 * Math.sqrt(e * (max - e))).reduce((a, b) => a + b, 0) / max;\n    const devBonus = 1 + parameters.DEVIATION_WEIGHT * deviation;\n    let strain = parameters.STRAIN_FACTOR * devBonus * (max ** parameters.STRAIN_EXPONENT);\n\n    currentNote.maxColumn = max;\n    currentNote.devColumn = deviation;\n    currentNote.baseStrain = strain;\n\n    // Burst stamina\n    currentNote.staminaBonus = 0\n    if (previousNote && previousNote.baseStrain) {\n      const timeDiff = currentNote.time - previousNote.time;\n      const currentStaminaStrain = (2 ** (-timeDiff / parameters.STAMINA_HALF_LIFE)) * previousNote.baseStrain;\n      currentNote.staminaBonus += currentStaminaStrain * parameters.STAMINA_STRAIN_FACTOR;\n    }\n\n    currentNote.baseStrain += currentNote.staminaBonus\n\n    // LN bonuses\n    let longNoteFactor = 0;\n    if (currentNote.isLN) {\n      let lnLength = currentNote.endTime - currentNote.time;\n      lnLength = Math.max(parameters.LN_SHORT_THRESHOLD, lnLength);\n      lnLength = Math.min(parameters.LN_LONG_THRESHOLD, lnLength);\n      const relativeLength = (lnLength - parameters.LN_SHORT_THRESHOLD)\n        / (parameters.LN_LONG_THRESHOLD - parameters.LN_SHORT_THRESHOLD);\n\n      // Give a bonus depending on LN length\n      longNoteFactor = relativeLength * parameters.LN_LONG_BONUS + (1 - relativeLength) * parameters.LN_SHORT_BONUS;\n\n      // If the next note is close to the release (shields / inverse)\n      if (columnNextNote) {\n        const delta = columnNextNote.time - currentNote.endTime;\n        const inverseFactor = Math.max(0, 1 - delta / parameters.LN_INVERSE_MIN_THRESHOLD);\n        // Only apply inverse buff to long LNs\n        longNoteFactor += relativeLength * inverseFactor * parameters.LN_INVERSE_BONUS;\n      }\n\n      // If the LN released during another LN body\n      longNoteFactor *= 1 + currentNote.releaseCoverage * parameters.LN_RELEASE_BONUS\n    }\n\n    currentNote.longNoteBonus = longNoteFactor * currentNote.baseStrain;\n\n    // Sum\n    currentNote.strain = currentNote.baseStrain + currentNote.longNoteBonus;\n  }\n}\n\nfunction calculateDifficulty(columns, notes, timingWindow) {\n  if (notes.length == 0) return 0;\n\n  calculateStrains(columns, notes.filter(e => e.column < Math.floor(columns / 2)), timingWindow);\n  calculateStrains(columns, notes.filter(e => e.column >= Math.floor(columns / 2)), timingWindow);\n\n  // Weighted average\n  const averageStrain = (notes.map(e => e.strain ** parameters.WEIGHT_EXPONENT)\n    .reduce((a, b) => a + b, 0) / notes.length) ** (1 / parameters.WEIGHT_EXPONENT);\n\n  return averageStrain;\n}\n\nfunction calculate(map) {\n  const columns = map.columnCount;\n  const notes = map.notes;\n  const mirrorNotes = map.notes.map(e => ({ ...e, column: columns - 1 - e.column }));\n  const timingWindow = getTimingWindow(map.overallDifficulty);\n  // Assume mirror\n  return Math.min(\n    calculateDifficulty(columns, notes, timingWindow),\n    calculateDifficulty(columns, mirrorNotes, timingWindow));\n}\n\nmodule.exports = {\n  calculateDifficulty,\n  calculate,\n}\n\n//# sourceURL=webpack://mania-diffcalc/./src/rework_diffcalc.js?");

/***/ }),

/***/ "./src/stable_diffcalc.js":
/*!********************************!*\
  !*** ./src/stable_diffcalc.js ***!
  \********************************/
/*! unknown exports (runtime-defined) */
/*! runtime requirements: module */
/*! CommonJS bailout: module.exports is used directly at 220:0-14 */
/***/ ((module) => {

eval("// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the MIT Licence.\n\nclass Skill {\n  constructor() {\n    this.strainPeaks = [];\n    this.decayWeight = 0.9;\n    this.currentStrain = 1;\n    this.currentSectionPeak = 1;\n    this.previous = [];\n    this.skillMultiplier = 0;\n    this.strainDecayBase = 0\n  }\n\n\n  /// <summary>\n  /// Process a <see cref=\"DifficultyHitObject\"/> and update current strain values accordingly.\n  /// </summary>\n  process(current) {\n    this.currentStrain *= this.strainDecay(current.deltaTime);\n    this.currentStrain += this.strainValueOf(current) * this.skillMultiplier;\n\n    this.currentSectionPeak = Math.max(this.currentStrain, this.currentSectionPeak);\n\n    this.previous.push(current);\n  }\n\n  /// <summary>\n  /// Saves the current peak strain level to the list of strain peaks, which will be used to calculate an overall difficulty.\n  /// </summary>\n  saveCurrentPeak() {\n    if (this.previous.length > 0)\n      this.strainPeaks.push(this.currentSectionPeak);\n  }\n\n  /// <summary>\n  /// Sets the initial strain level for a new section.\n  /// </summary>\n  /// <param name=\"offset\">The beginning of the new section in milliseconds.</param>\n  startNewSectionFrom(offset) {\n    // The maximum strain of the new section is not zero by default, strain decays as usual regardless of section boundaries.\n    // This means we need to capture the strain level at the beginning of the new section, and use that as the initial peak level.\n    if (this.previous.length > 0)\n      this.currentSectionPeak = this.currentStrain * this.strainDecay(offset - this.previous[0].time);\n  }\n\n  /// <summary>\n  /// Returns the calculated difficulty value representing all processed <see cref=\"DifficultyHitObject\"/>s.\n  /// </summary>\n  difficultyValue() {\n    let difficulty = 0;\n    let weight = 1;\n\n    // Difficulty is the weighted sum of the highest strains from every section.\n    // We're sorting from highest to lowest strain.\n    for (let strain of this.strainPeaks.sort((a, b) => b - a)) {\n      difficulty += strain * weight;\n      weight *= this.decayWeight;\n    }\n\n    return difficulty;\n  }\n\n  /// <summary>\n  /// Calculates the strain value of a <see cref=\"DifficultyHitObject\"/>. This value is affected by previously processed objects.\n  /// </summary>\n  strainDecay(ms) {\n    return Math.pow(this.strainDecayBase, ms / 1000.0);\n  }\n}\n\nclass IndividualSkill extends Skill {\n  constructor(column, columnCount) {\n    super();\n    this.column = column;\n\n    this.holdEndTimes = new Array(columnCount).fill(0.0);\n\n    this.skillMultiplier = 1.0;\n    this.strainDecayBase = 0.125;\n  }\n\n  strainValueOf(current) {\n    let endTime = current.endTime;\n\n    try {\n      if (current.column != this.column)\n        return 0;\n\n      // We give a slight bonus if something is held meanwhile\n      return this.holdEndTimes.some(t => t > endTime) ? 2.5 : 2.0;\n    } finally {\n      this.holdEndTimes[current.column] = endTime;\n    }\n  }\n}\n\nclass OverallSkill extends Skill {\n  constructor(columnCount) {\n    super();\n    this.skillMultiplier = 1.0;\n    this.strainDecayBase = 0.3;\n    this.columnCount = columnCount;\n    this.holdEndTimes = new Array(columnCount).fill(0.0);\n  }\n\n  strainValueOf(current) {\n    let endTime = current.endTime;\n\n    let holdFactor = 1.0; // Factor in case something else is held\n    let holdAddition = 0; // Addition to the current note in case it's a hold and has to be released awkwardly\n\n    for (let i = 0; i < this.columnCount; i++) {\n      // If there is at least one other overlapping end or note, then we get an addition, buuuuuut...\n      if (current.time < this.holdEndTimes[i] && endTime > this.holdEndTimes[i])\n        holdAddition = 1.0;\n\n      // ... this addition only is valid if there is _no_ other note with the same ending.\n      // Releasing multiple notes at the same time is just as easy as releasing one\n      if (endTime == this.holdEndTimes[i])\n        holdAddition = 0;\n\n      // We give a slight bonus if something is held meanwhile\n      if (this.holdEndTimes[i] > endTime)\n        holdFactor = 1.25;\n    }\n\n    this.holdEndTimes[current.column] = endTime;\n\n    return (1 + holdAddition) * holdFactor;\n  }\n\n\n}\n\nclass DifficultyCalculator {\n\n  calculate(columnCount, notes) {\n    if (notes.length == 0) return 0;\n    notes = notes.sort((a, b) => a.time - b.time);\n\n    let objects = [];\n    for (let i = 1; i < notes.length; i++) {\n      objects.push({ deltaTime: notes[i].time - notes[i - 1].time, ...notes[i] })\n    }\n    const sectionLength = 400;\n\n    let skills = this.createSkills(columnCount);\n    let currentSectionEnd = Math.ceil(notes[0].time / sectionLength) * sectionLength;\n\n    for (let h of objects) {\n      while (h.time > currentSectionEnd) {\n        for (let s of skills) {\n          s.saveCurrentPeak();\n          s.startNewSectionFrom(currentSectionEnd);\n        }\n\n        currentSectionEnd += sectionLength;\n      }\n\n      for (let s of skills) {\n        s.process(h);\n      }\n    }\n    // The peak strain will not be saved for the last section in the above loop\n    for (let s of skills) {\n      s.saveCurrentPeak();\n    }\n\n    return this.createDifficultyAttributes(columnCount, objects, skills)\n  }\n\n  createSkills(columnCount) {\n    let skills = [new OverallSkill(columnCount)];\n\n    for (let i = 0; i < columnCount; i++)\n      skills.push(new IndividualSkill(i, columnCount));\n\n    return skills;\n  }\n\n  createDifficultyAttributes(columnCount, objects, skills) {\n    const star_scaling_factor = 0.018;\n\n    let [overall, ...individualSkills] = skills;\n\n    let aggregatePeaks = new Array(overall.strainPeaks.length).fill(0.0);\n\n    for (let individual of individualSkills) {\n      for (let i = 0; i < individual.strainPeaks.length; i++) {\n        let aggregate = individual.strainPeaks[i] + overall.strainPeaks[i];\n\n        if (aggregate > aggregatePeaks[i])\n          aggregatePeaks[i] = aggregate;\n      }\n    }\n\n    aggregatePeaks.sort((a, b) => b - a); // Sort from highest to lowest strain.\n\n    let difficulty = 0.0;\n    let weight = 1.0;\n\n    // Difficulty is the weighted sum of the highest strains from every section.\n    for (let strain of aggregatePeaks) {\n      difficulty += strain * weight;\n      weight *= 0.9;\n    }\n\n    return difficulty * star_scaling_factor;\n  }\n}\n\nfunction calculateDifficulty(columnCount, notes, timingWindow) {\n  return new DifficultyCalculator().calculate(columnCount, notes)\n}\n\nfunction calculate(map) {\n  return calculateDifficulty(map.columnCount, map.notes);\n}\n\nmodule.exports = {\n  calculateDifficulty,\n  calculate,\n};\n\n//# sourceURL=webpack://mania-diffcalc/./src/stable_diffcalc.js?");

/***/ }),

/***/ "./src/utils.js":
/*!**********************!*\
  !*** ./src/utils.js ***!
  \**********************/
/*! unknown exports (runtime-defined) */
/*! runtime requirements: module */
/*! CommonJS bailout: module.exports is used directly at 71:0-14 */
/***/ ((module) => {

eval("\nfunction parseBeatmap(data) {\n  const lines = data.split(\"\\n\").map(e => e.trim());\n\n  const getProperty = (name) => (lines.find(e => e.startsWith(name)) || \"\").slice(name.length);\n\n  const mode = parseInt(getProperty(\"Mode:\"));\n  if (mode !== 3) throw new Error(\"Invalid game mode\");\n\n  const title = getProperty(\"Title:\");\n  const artist = getProperty(\"Artist:\");\n  const creator = getProperty(\"Creator:\");\n  const version = getProperty(\"Version:\");\n  const beatmapId = getProperty(\"BeatmapID:\");\n  const beatmapSetId = getProperty(\"BeatmapSetID:\");\n  const overallDifficulty = parseFloat(getProperty(\"OverallDifficulty:\"));\n  const columnCount = parseFloat(getProperty(\"CircleSize:\"));\n\n  let objectIndex = lines.indexOf('[HitObjects]');\n  let notes = lines\n    .filter((e, i) => e != \"\" && i > objectIndex)\n    .map(object => {\n      let [x, y, time, type, hitSound, params] = object.split(\",\");\n      x = parseInt(x);\n      time = parseInt(time);\n      type = parseInt(type);\n      let endTime = time;\n      let sample;\n      let isLN = false;\n      if ((type & 128) > 0) {\n        isLN = true;\n        [endTime, sample] = params.split(\":\");\n        endTime = parseInt(endTime);\n      }\n      let column = Math.floor(x * columnCount / 512);\n      return { time, endTime, column, isLN };\n    });\n\n  const lnPercent = notes.filter(e => e.isLN).length / Math.max(1, notes.length);\n  const length = notes.length === 0 ? 0 : notes[notes.length - 1].endTime - notes[0].time;\n  return {\n    metadata: {\n      title, artist, creator, version, beatmapId, beatmapSetId\n    },\n    overallDifficulty,\n    columnCount,\n    lnPercent,\n    length,\n    notes,\n  };\n}\n\nfunction getTimingWindow(od, mods = \"\") {\n  const marv = 16.5\n  const perf = 64 - od * 3 + 0.5;\n  const great = 97 - od * 3 + 0.5;\n  const good = 127 - od * 3 + 0.5;\n  const bad = 151 - od * 3 + 0.5;\n  const miss = 188 - od * 3 + 0.5;\n  let result = [marv, perf, great, good, bad, miss];\n  if (mods.includes('EZ')) {\n    return result.map(e => (e * 1.4) + 0.5);\n  } else if (mods.includes('HR')) {\n    return result.map(e => (e / 1.4) + 0.5);\n  }\n  return result;\n}\n\nconst formatMetadata = ({ artist, title, creator, version }) => `${artist} - ${title} (${creator}) [${version}]`;\n\nmodule.exports = {\n  parseBeatmap,\n  getTimingWindow,\n  formatMetadata,\n}\n\n//# sourceURL=webpack://mania-diffcalc/./src/utils.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! unknown exports (runtime-defined) */
/*! runtime requirements: __webpack_require__ */
eval("\n\nconst reworkDifficulty = __webpack_require__(/*! ./rework_diffcalc */ \"./src/rework_diffcalc.js\");\nconst stableDifficulty = __webpack_require__(/*! ./stable_diffcalc */ \"./src/stable_diffcalc.js\");\nconst { parseBeatmap, getTimingWindow, formatMetadata } = __webpack_require__(/*! ./utils */ \"./src/utils.js\");\n\n(async () => {\n  const dataSets = [\n    'reform-dans',\n    'ln-v2-dans',\n    '7k-regular-dans',\n    '7k-ln-dans',\n    'ranked-4k',\n    'ranked-7k',\n    'loved-4k',\n    'loved-7k',\n    'vibro-dans',\n    'vibro',\n  ]\n\n  let mapData = await Promise.all(dataSets.map(async e => [await (await fetch(`data/${e}.json`)).json(), e]));\n  mapData.push([[], 'custom'])\n\n  const toPlotData = (data, name) => ({\n    x: data.map(e => e.oldRating),\n    y: data.map(e => e.newRating),\n    mode: 'markers',\n    type: 'scattergl',\n    name: name,\n    text: data.map(e => formatMetadata(e.metadata)),\n    marker: {\n      size: 6,\n      opacity: 0.5,\n    },\n  })\n\n  const plotData = mapData.map(e => toPlotData(...e));\n\n  const layout = {\n    title: 'osu! reworked SR',\n    xaxis: {\n      title: 'Old SR',\n      rangemode: 'nonnegative',\n      constrain: 'range',\n      dtick: 1,\n    },\n    yaxis: {\n      title: 'New SR',\n      scaleanchor: 'x',\n      scaleratio: 1,\n      dtick: 1,\n    },\n    height: 800,\n    hovermode: 'closest',\n    shapes: [\n      {\n        type: 'line',\n        x0: 0,\n        y0: 0,\n        x1: 10,\n        y1: 10,\n        line: {\n          color: 'rgb(55, 128, 191)',\n          width: 3\n        },\n      },\n    ]\n  };\n\n  Plotly.react('difficulty-scatter', plotData, layout, { displaylogo: false });\n\n  const toTableData = (data, name) => data.map(e => ({\n    name: formatMetadata(e.metadata),\n    group: name,\n    ratingChange: e.newRating - e.oldRating,\n    ...e,\n  }))\n\n  const tableData = [].concat(...mapData.map(e => toTableData(...e)));\n  const ratingFormatter = e => e?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });\n\n  const durationFormatter = duration => {\n    const pad = n => ('00' + n).slice(-2);\n    const ms = duration % 1000;\n    duration = (duration - ms) / 1000;\n    const secs = duration % 60;\n    duration = (duration - secs) / 60;\n    const mins = duration % 60;\n    const hrs = (duration - mins) / 60;\n    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;\n  }\n\n  const difficultyTable = $('#difficulty-table');\n  let highlightRows = false;\n\n  difficultyTable.bootstrapTable({\n    data: tableData,\n    search: true,\n    searchTimeOut: 500,\n    showFullscreen: \"true\",\n    showColumns: \"true\",\n    columns: [{\n      field: 'metadata',\n      title: 'Map',\n      sortable: true,\n      formatter: formatMetadata,\n    }, {\n      field: 'columnCount',\n      title: 'Keys',\n      sortable: true,\n    }, {\n      field: 'length',\n      title: 'Length',\n      sortable: true,\n      align: 'right',\n      halign: 'right',\n      formatter: durationFormatter,\n    }, {\n      field: 'lnPercent',\n      title: 'LN %',\n      sortable: true,\n      formatter: e => `${(e * 100)?.toFixed(0)}%`,\n    }, {\n      field: 'oldRating',\n      title: 'Old SR',\n      sortable: true,\n      formatter: ratingFormatter,\n    }, {\n      field: 'newRating',\n      title: 'New SR',\n      sortable: true,\n      formatter: ratingFormatter,\n    }, {\n      field: 'ratingChange',\n      title: 'SR Change',\n      sortable: true,\n      formatter: ratingFormatter,\n    }, {\n      field: 'group',\n      title: 'Group',\n      sortable: true,\n      visible: false,\n    }],\n  })\n\n\n  const plotStrains = (name, notes) => {\n    const getPlotData = (name, visible = false) => ({\n      x: notes.map(e => new Date(e.time)),\n      y: notes.map(e => e[name]),\n      mode: 'markers',\n      type: 'scattergl',\n      name: name,\n      text: notes.map(e => e.time + \"|\" + e.column),\n      marker: {\n        size: 4,\n        opacity: 0.5,\n      },\n      visible: visible || \"legendonly\",\n    })\n\n    const plotData = [\n      getPlotData('strain', true),\n      getPlotData('maxColumn'),\n      getPlotData('devColumn'),\n      getPlotData('baseStrain'),\n      getPlotData('longNoteBonus'),\n      getPlotData('staminaBonus'),\n      getPlotData('releaseCoverage'),\n    ]\n\n    const layout = {\n      title: name,\n      xaxis: {\n        title: 'Time',\n        rangemode: 'nonnegative',\n        constrain: 'range',\n        tickformat: '%M:%S'\n      },\n      yaxis: {\n        title: 'Strain',\n        dtick: 1,\n      },\n      height: 400,\n      hovermode: 'closest',\n    };\n\n    Plotly.react('difficulty-graph', plotData, layout, { displaylogo: false });\n  }\n\n  const osuUpload = document.getElementById('osu-upload');\n  const osuUploadLabel = document.getElementById('osu-upload-label');\n  /** @type {HTMLInputElement} */\n  const rateOption = document.getElementById('options-rate');\n  /** @type {HTMLButtonElement} */\n  const calculateButton = document.getElementById('calculate');\n  const difficultyInfo = document.getElementById('difficulty-info');\n\n  let selectedMap;\n\n  osuUpload.addEventListener('change', () => {\n    const file = osuUpload.files[0];\n    const fr = new FileReader();\n    fr.addEventListener('load', () => {\n      const rawData = fr.result;\n      const map = parseBeatmap(rawData);\n      const metadata = formatMetadata(map.metadata);\n      osuUploadLabel.innerText = metadata;\n      calculateButton.disabled = false;\n      selectedMap = map;\n    });\n    fr.readAsText(file);\n  });\n\n  calculateButton.addEventListener('click', () => {\n    if (!selectedMap) return;\n    const rate = rateOption.valueAsNumber || 1;\n\n    const map = { ...selectedMap };\n    map.notes = map.notes.map(({ time, endTime, ...rest }) => ({ time: time / rate, endTime: endTime / rate, ...rest }));\n    const oldRating = stableDifficulty.calculateDifficulty(map.columnCount, map.notes);\n    const newRating = reworkDifficulty.calculateDifficulty(map.columnCount, map.notes, getTimingWindow(map.columnCount));\n    let metadata = formatMetadata(map.metadata);\n    if (rate === 1.5) metadata += ' +DT'\n    else if (rate === 0.75) metadata += ' +HT'\n    else if (rate !== 1) metadata += ` ${rate}x`\n\n    const customPlot = plotData.find(e => e.name == 'custom');\n\n    customPlot.x.push(oldRating);\n    customPlot.y.push(newRating);\n    customPlot.text.push(metadata);\n\n    Plotly.redraw('difficulty-scatter');\n\n    difficultyTable.bootstrapTable('append', toTableData([{ ...map, oldRating, newRating }], 'custom'))\n\n    plotStrains(metadata, map.notes)\n\n\n    difficultyInfo.innerText = `New SR: ${newRating.toFixed(2)}\n    Old SR: ${oldRating.toFixed(2)}\n    Diff: ${(newRating - oldRating).toFixed(2)}`;\n  })\n\n})();\n\n//# sourceURL=webpack://mania-diffcalc/./src/index.js?");
})();

/******/ })()
;