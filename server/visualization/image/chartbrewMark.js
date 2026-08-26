function renderChartbrewMark({ color, size, x, y }) {
  const scale = size / 24;
  return `<g aria-hidden="true" transform="translate(${x} ${y}) scale(${scale})">`
    + `<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V17a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7.5Z" fill="none" stroke="${color}" stroke-width="1.8"/>`
    + `<path d="M19 9h1.2a2.8 2.8 0 0 1 0 5.6H19" fill="none" stroke="${color}" stroke-width="1.8"/>`
    + `<path d="M7 14v3M11 11v6M15 8v9" stroke="${color}" stroke-linecap="round" stroke-width="1.8"/>`
    + "</g>";
}

module.exports = {
  renderChartbrewMark,
};
