module.exports = (hexcolor) => {
  const black = "#0c293c";
  let r;
  let g;
  let b;
  let a;

  if (!hexcolor) return black;
  if (hexcolor === "#fff") return black;
  if (hexcolor === "#000") return "white";
  if (hexcolor.indexOf("#") > -1) {
    r = parseInt(hexcolor.substr(0, 2), 16);
    g = parseInt(hexcolor.substr(2, 2), 16);
    b = parseInt(hexcolor.substr(4, 2), 16);
  } else if (hexcolor.indexOf("rgb") > -1) {
    const rgb = hexcolor.substring(hexcolor.indexOf("(") + 1, hexcolor.indexOf(")"));
    if (rgb) {
      const rgbArray = rgb.split(",");
      [r, g, b, a] = rgbArray;
      r = parseInt(r, 10);
      g = parseInt(g, 10);
      b = parseInt(b, 10);
      if (a) a = parseInt(a, 10);
    }
  }

  if (r === 0 && g === 0 && b === 0 && !a) return black;
  if (r === 0 && g === 0 && b === 0 && a > 0) return "white";

  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? black : "white";
};
