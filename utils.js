
function parseBeatmap(data) {
  const lines = data.split("\n").map(e => e.trim());

  const getProperty = (name) => (lines.find(e => e.startsWith(name)) || "").slice(name.length);

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


module.exports = {
  parseBeatmap,
  getTimingWindow,
}