

const reworkDifficulty = require('./rework_diffcalc');
const stableDifficulty = require('./stable_diffcalc');
const { parseBeatmap, getTimingWindow, formatMetadata } = require('./utils');

(async () => {
  const dataSets = [
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

  let mapData = await Promise.all(dataSets.map(async e => [await (await fetch(`data/${e}.json`)).json(), e]));
  mapData.push([[], 'custom'])

  const toPlotData = (data, name) => ({
    x: data.map(e => e.oldRating),
    y: data.map(e => e.newRating),
    mode: 'markers',
    type: 'scattergl',
    name: name,
    text: data.map(e => formatMetadata(e.metadata)),
    marker: {
      size: 6,
      opacity: 0.5,
    },
  })

  const plotData = mapData.map(e => toPlotData(...e));

  const layout = {
    title: 'osu! reworked SR',
    xaxis: {
      title: 'Old SR',
      rangemode: 'nonnegative',
      constrain: 'range',
      dtick: 1,
    },
    yaxis: {
      title: 'New SR',
      scaleanchor: 'x',
      scaleratio: 1,
      dtick: 1,
    },
    height: 800,
    hovermode: 'closest',
    shapes: [
      {
        type: 'line',
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        line: {
          color: 'rgb(55, 128, 191)',
          width: 3
        },
      },
    ]
  };

  Plotly.react('difficulty-scatter', plotData, layout, { displaylogo: false });

  const toTableData = (data, name) => data.map(e => ({
    name: formatMetadata(e.metadata),
    group: name,
    ratingChange: e.newRating - e.oldRating,
    ...e,
  }))

  const tableData = [].concat(...mapData.map(e => toTableData(...e)));
  const ratingFormatter = e => e?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const durationFormatter = duration => {
    const pad = n => ('00' + n).slice(-2);
    const ms = duration % 1000;
    duration = (duration - ms) / 1000;
    const secs = duration % 60;
    duration = (duration - secs) / 60;
    const mins = duration % 60;
    const hrs = (duration - mins) / 60;
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
  }

  const difficultyTable = $('#difficulty-table');
  let highlightRows = false;

  difficultyTable.bootstrapTable({
    data: tableData,
    search: true,
    searchTimeOut: 500,
    showFullscreen: "true",
    showColumns: "true",
    columns: [{
      field: 'metadata',
      title: 'Map',
      sortable: true,
      formatter: formatMetadata,
    }, {
      field: 'columnCount',
      title: 'Keys',
      sortable: true,
    }, {
      field: 'length',
      title: 'Length',
      sortable: true,
      align: 'right',
      halign: 'right',
      formatter: durationFormatter,
    }, {
      field: 'lnPercent',
      title: 'LN %',
      sortable: true,
      formatter: e => `${(e * 100)?.toFixed(0)}%`,
    }, {
      field: 'oldRating',
      title: 'Old SR',
      sortable: true,
      formatter: ratingFormatter,
    }, {
      field: 'newRating',
      title: 'New SR',
      sortable: true,
      formatter: ratingFormatter,
    }, {
      field: 'ratingChange',
      title: 'SR Change',
      sortable: true,
      formatter: ratingFormatter,
    }, {
      field: 'group',
      title: 'Group',
      sortable: true,
      visible: false,
    }],
  })


  const plotStrains = (name, notes) => {
    const getPlotData = (name, visible = false) => ({
      x: notes.map(e => new Date(e.time)),
      y: notes.map(e => e[name]),
      mode: 'markers',
      type: 'scattergl',
      name: name,
      text: notes.map(e => e.time + "|" + e.column),
      marker: {
        size: 4,
        opacity: 0.5,
      },
      visible: visible || "legendonly",
    })

    const plotData = [
      getPlotData('strain', true),
      getPlotData('maxColumn'),
      getPlotData('devColumn'),
      getPlotData('baseStrain'),
      getPlotData('longNoteBonus'),
      getPlotData('staminaBonus'),
      getPlotData('releaseCoverage'),
    ]

    const layout = {
      title: name,
      xaxis: {
        title: 'Time',
        rangemode: 'nonnegative',
        constrain: 'range',
        tickformat: '%M:%S'
      },
      yaxis: {
        title: 'Strain',
        dtick: 1,
      },
      height: 400,
      hovermode: 'closest',
    };

    Plotly.react('difficulty-graph', plotData, layout, { displaylogo: false });
  }

  const osuUpload = document.getElementById('osu-upload');
  const osuUploadLabel = document.getElementById('osu-upload-label');
  /** @type {HTMLInputElement} */
  const rateOption = document.getElementById('options-rate');
  /** @type {HTMLButtonElement} */
  const calculateButton = document.getElementById('calculate');
  const difficultyInfo = document.getElementById('difficulty-info');

  let selectedMap;

  osuUpload.addEventListener('change', () => {
    const file = osuUpload.files[0];
    const fr = new FileReader();
    fr.addEventListener('load', () => {
      const rawData = fr.result;
      const map = parseBeatmap(rawData);
      const metadata = formatMetadata(map.metadata);
      osuUploadLabel.innerText = metadata;
      calculateButton.disabled = false;
      selectedMap = map;
    });
    fr.readAsText(file);
  });

  calculateButton.addEventListener('click', () => {
    if (!selectedMap) return;
    const rate = rateOption.valueAsNumber || 1;

    const map = { ...selectedMap };
    map.notes = map.notes.map(({ time, endTime, ...rest }) => ({ time: time / rate, endTime: endTime / rate, ...rest }));
    const oldRating = stableDifficulty.calculateDifficulty(map.columnCount, map.notes);
    const newRating = reworkDifficulty.calculateDifficulty(map.columnCount, map.notes, getTimingWindow(map.columnCount));
    let metadata = formatMetadata(map.metadata);
    if (rate === 1.5) metadata += ' +DT'
    else if (rate === 0.75) metadata += ' +HT'
    else if (rate !== 1) metadata += ` ${rate}x`

    const customPlot = plotData.find(e => e.name == 'custom');

    customPlot.x.push(oldRating);
    customPlot.y.push(newRating);
    customPlot.text.push(metadata);

    Plotly.redraw('difficulty-scatter');

    difficultyTable.bootstrapTable('append', toTableData([{ ...map, oldRating, newRating }], 'custom'))

    plotStrains(metadata, map.notes)


    difficultyInfo.innerText = `New SR: ${newRating.toFixed(2)}
    Old SR: ${oldRating.toFixed(2)}
    Diff: ${(newRating - oldRating).toFixed(2)}`;
  })

})();