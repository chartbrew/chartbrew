const { chromium } = require("playwright");
const path = require("path");
const jwt = require("jsonwebtoken");
const { nanoid } = require("nanoid");
const getEmbeddedChartData = require("./getEmbeddedChartData");
const kpiFont = require("../../shared/visualization/kpiFont.json");
const fs = require("fs");
const { resolveReportMode } = require("../../shared/reportAppearance.mjs");
const { validate: isUuid, v4: uuid } = require("uuid");

const settings = require("../settings");

const fontStylesheets = new Map();

function snapshotFontCss(family, file, weight) {
  if (!fontStylesheets.has(family)) {
    const data = fs.readFileSync(file).toString("base64");
    fontStylesheets.set(family, `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2")}`);
  }
  return fontStylesheets.get(family);
}

function getSnapshotFontStylesheet(url) {
  if (url.href === "https://rsms.me/inter/inter.css") {
    return snapshotFontCss("Inter", require.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), "100 900");
  }
  if (url.origin !== "https://fonts.googleapis.com" || url.pathname !== "/css2") return null;

  const family = url.searchParams.get("family")?.split(":")[0];
  if (family === kpiFont.family) return snapshotFontCss(family, require.resolve(kpiFont.file), "600");
  if (family === "Inter Tight") {
    return snapshotFontCss(family, require.resolve("@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2"), "100 900");
  }
  return null;
}

async function captureChart(shareString, { token, chart, outputPath }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: chart ? { width: 640, height: 360 } : { width: 1024, height: 768 },
      deviceScaleFactor: chart ? 2 : 1,
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const url = new URL(`${settings.client}/chart/${shareString}/embedded`);
    url.searchParams.set("isSnapshot", "true");
    if (token) url.searchParams.set("token", token);
    const embedded = chart && getEmbeddedChartData(chart);
    if (embedded?.type === "markdown") embedded.content = chart.content;
    await page.route("**/*", async (route) => {
      const request = route.request();
      const target = new URL(request.url());
      const stylesheet = request.resourceType() === "stylesheet" && getSnapshotFontStylesheet(target);
      if (stylesheet) return route.fulfill({ contentType: "text/css", body: stylesheet });
      if (embedded && request.resourceType() === "fetch" && request.method() === "GET"
        && request.frame() === page.mainFrame() && request.frame().url() === url.href
        && target.pathname.endsWith(`/chart/${shareString}/embedded`) && target.searchParams.get("snapshot") === "true") {
        return route.fulfill({ json: embedded });
      }
      if (embedded && target.origin !== url.origin) return route.abort();
      return route.continue();
    });
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    const card = page.locator('#chart-container[data-snapshot-ready="true"]');
    await card.waitFor();
    await page.evaluate(() => document.fonts.ready.then(() => true));
    return await card.screenshot({ path: outputPath, animations: "disabled" });
  } finally {
    await browser.close();
  }
}

module.exports.snapChartPreview = (chart) => captureChart(uuid(), { chart });

module.exports.snapChart = async (shareString, chartId) => {
  if (!isUuid(shareString) || !Number.isInteger(chartId) || chartId <= 0) return null;
  try {
    const token = jwt.sign({ snapshotToken: shareString, chartId }, settings.encryptionKey, {
      algorithm: "HS256", audience: "chart-snapshot", expiresIn: 300,
    });
    const file = `uploads/snapshots/snap-${nanoid(20)}.png`;
    const outputPath = path.resolve(__dirname, "..", file);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await captureChart(shareString, { token, outputPath });
    return file;
  } catch (err) {
    console.log("Could not take snapshot", err); // oxlint-disable-line no-console
    return null;
  }
};

module.exports.snapDashboard = async (dashboard, options = {}) => {
  if (!dashboard) {
    throw new Error("Dashboard not found");
  }

  // create a temporary accessToken (bypasses SharePolicy for internal snapshots)
  const accessToken = jwt.sign(
    { project_id: dashboard.id },
    settings.encryptionKey,
    { expiresIn: 300 },
  );

  const {
    viewport, theme, removeStyling, removeHeader
  } = options;

  const width = (viewport?.width && parseInt(viewport.width, 10)) || 1440;
  const height = (viewport?.height && parseInt(viewport.height, 10)) || 900;

  let browser = null;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({
      width,
      height,
    });

    const reportTheme = resolveReportMode({ query: theme, mode: dashboard.reportAppearance?.mode, prefersDark: false });
    const reportPath = dashboard.reportAppearance ? "report" : "b";
    let url = `${settings.client}/${reportPath}/${dashboard.brewName}?theme=${reportTheme}&accessToken=${accessToken}`;

    // apply options
    if (removeStyling) {
      url += "&removeStyling=true";
    }

    if (removeHeader) {
      url += "&removeHeader=true";
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('div.dashboard-container[data-dashboard-loading="false"]', { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);

    const snapshotId = nanoid(20);
    const snapshotsDirectory = path.resolve(__dirname, "../uploads/snapshots");
    const snapshotPath = path.join(snapshotsDirectory, `snap-${snapshotId}.png`);
    await fs.promises.mkdir(snapshotsDirectory, { recursive: true });
    await page.screenshot({ path: snapshotPath, fullPage: true, omitBackground: true });

    await browser.close();

    return `uploads/snapshots/snap-${snapshotId}.png`;
  } catch (err) {
    console.log("Could not take dashboard snapshot", err); // oxlint-disable-line no-console
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
