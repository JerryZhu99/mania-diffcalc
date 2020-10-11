
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
      rangemode: 'tozero',
      constrain: 'range',
    },
    yaxis: {
      rangemode: 'tozero',
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

})();