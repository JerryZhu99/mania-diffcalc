
const formatMetadata = ({ artist, title, creator, version }) => `${artist} - ${title} (${creator}) [${version}]`;

(async () => {
  const dataSets = [
    'farm',
    'random',
    'ln',
    'testing',
    'dans',
    'player0',
    'bringobrango',
    'vibro',
    'ranked',
  ]

  const mapData = await Promise.all(dataSets.map(async e => [await (await fetch(`/output/${e}.json`)).json(), e]));

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
      rangemode: 'nonnegative',
      constrain: 'range',
    },
    yaxis: {
      scaleanchor: 'x',
      scaleratio: 1,
    },
    height: 800,
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

  Plotly.newPlot('difficulty-scatter', plotData, layout);

  const toTableData = (data, name) => data.map(e => ({
    name: formatMetadata(e.metadata),
    group: name,
    ratingChange: e.newRating - e.oldRating,
    ...e,
  }))

  const tableData = [].concat(...mapData.map(e => toTableData(...e)));
  const ratingFormatter = e => e?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const difficultyTable = $('#difficulty-table');
  let highlightRows = false;

  difficultyTable.bootstrapTable({
    data: tableData,
    search: true,
    searchTimeOut: 0,
    showFullscreen: "true",
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
    }],
  })


})();