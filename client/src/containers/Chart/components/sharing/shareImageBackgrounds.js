import dreamyAurora from "../../../../assets/backgrounds/dreamy_aurora.png";
import dreamyPastel from "../../../../assets/backgrounds/dreamy_pastel.png";
import monochromeGeometric from "../../../../assets/backgrounds/monochrome_geometric.png";
import monochromePoly from "../../../../assets/backgrounds/monochrome_poly.png";
import pastelMintPoly from "../../../../assets/backgrounds/pastel_mint_poly.png";
import pastelWash from "../../../../assets/backgrounds/pastel_wash.png";
import pastelWaves from "../../../../assets/backgrounds/pastel_waves.png";
import peachyCircles from "../../../../assets/backgrounds/peachy_circles.png";
import softBlueCircles from "../../../../assets/backgrounds/soft_blue_circles.png";
import whiteGeoGrid from "../../../../assets/backgrounds/white_geo_grid.png";

const SHARE_IMAGE_BACKGROUND_SOURCES = {
  dreamy_aurora: dreamyAurora,
  dreamy_pastel: dreamyPastel,
  monochrome_geometric: monochromeGeometric,
  monochrome_poly: monochromePoly,
  pastel_mint_poly: pastelMintPoly,
  pastel_wash: pastelWash,
  pastel_waves: pastelWaves,
  peachy_circles: peachyCircles,
  soft_blue_circles: softBlueCircles,
  white_geo_grid: whiteGeoGrid,
};

export function getShareImageBackgroundSrc(id) {
  return SHARE_IMAGE_BACKGROUND_SOURCES[id] || null;
}
