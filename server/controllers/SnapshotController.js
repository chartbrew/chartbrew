const puppeteer = require("puppeteer");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports.snapChart = async (chart) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(`${settings.client}/chart/${chart.id}/embedded?isSnapshot=true`);
  await page.waitForSelector("div.chart-container canvas");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.snapshots/snap-${chart.id}.png`, omitBackground: true });

  await browser.close();
};
