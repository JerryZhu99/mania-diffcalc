

const reworkDifficulty = require('./rework_diffcalc');
const stableDifficulty = require('./stable_diffcalc');
const { parseBeatmap, getTimingWindow, formatMetadata } = require('./utils');

(async () => {
  const dataSets = [
    'farm',
    // 'random',
    'ln',
    'chordjack',
    // 'testing',
    'dans',
    // 'player0',
    // 'bringobrango',
    'vibro',
    'ranked-4k',
    'ranked-7k',
  ]

  let mapData = await Promise.all(dataSets.map(async e => [await (await fetch(`/output/${e}.json`)).json(), e]));
  mapData.push([[], 'custom'])

  const toPlotData = (data, name) => ({
    x: data.map(e => e.oldRating),
    y: data.map(e => e.newRating),
    mode: 'markers',
    type: 'scatter',
    name: name,
    text: data.map(e => formatMetadata(e.metadata)),
    marker: { size: 12 },
  })

  const plotData = mapData.map(e => toPlotData(...e));

  const layout = {
    title: 'osu! reworked SR',
    xaxis: {
      title: 'New SR',
      rangemode: 'nonnegative',
      constrain: 'range',
    },
    yaxis: {
      title: 'Old SR',
      scaleanchor: 'x',
      scaleratio: 1,
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

  Plotly.newPlot('difficulty-scatter', plotData, layout, { displaylogo: false });

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
    searchTimeOut: 0,
    showFullscreen: "true",
    showColumns: "true",
    buttons: () => ({
      btnAdd: {
        text: 'Highlight changes',
        icon: 'fa-palette',
        event: () => {
          highlightRows = !highlightRows;
          difficultyTable.bootstrapTable('refreshOptions', {
            rowStyle: (row, index) => {
              if (!highlightRows) return {};
              let classes = '';
              if (row.ratingChange > 1.5) classes = 'table-success';
              if (row.ratingChange < -1.5) classes = 'table-danger';
              return { classes };
            },
          })
        },
        attributes: {
          title: 'Show star rating changes with colour',
        },
      },
    }),
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

  const osuUpload = document.getElementById('osu-upload');
  osuUpload.addEventListener('change', () => {
    const file = osuUpload.files[0];
    const fr = new FileReader();
    fr.addEventListener('load', () => {
      const rawData = fr.result;
      const map = parseBeatmap(rawData);
      const oldRating = stableDifficulty.calculateDifficulty(map.columnCount, map.notes);
      const newRating = reworkDifficulty.calculateDifficulty(map.columnCount, map.notes, getTimingWindow(map.columnCount));
      const metadata = formatMetadata(map.metadata);
      const customPlot = plotData.find(e => e.name == 'custom');

      customPlot.x.push(oldRating);
      customPlot.y.push(newRating);
      customPlot.text.push(metadata);

      Plotly.redraw('difficulty-scatter');

      difficultyTable.bootstrapTable('append', toTableData([{ ...map, oldRating, newRating }], 'custom'))
    });
    fr.readAsText(file);
  });

})();