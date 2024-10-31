const { chromium } = require("playwright");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports.snapChart = async (shareString) => {
  let browser = null;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.goto(`${settings.client}/chart/${shareString}/embedded?isSnapshot=true`);
    await page.waitForSelector("div#chart-container");
    await page.waitForTimeout(500);

    const snapshotPath = `uploads/snapshots/snap-${shareString}.png`;
    await page.screenshot({ path: snapshotPath, omitBackground: true });

    await browser.close();

    return snapshotPath;
  } catch (err) {
    console.log("Could not take snapshot", err); // eslint-disable-line no-console
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
