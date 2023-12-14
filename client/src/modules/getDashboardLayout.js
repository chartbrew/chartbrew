export default function getDashboardLayout(charts) {
  const layouts = { xxs: [], xs: [], sm: [], md: [], lg: [] };
  charts.forEach((chart) => {
    if (chart.layout) {
      Object.keys(chart.layout).forEach((key) => {
        layouts[key].push({
          i: chart.id.toString(),
          x: chart.layout[key][0] || 0,
          y: chart.layout[key][1] || 0,
          w: chart.layout[key][2],
          h: chart.layout[key][3],
          minW: 2,
        });
      });
    }
  });

  return layouts;
}
