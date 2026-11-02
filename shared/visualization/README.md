# KPI font

`kpiFont.json` is the shared source for KPI typography in Chartbrew OS.
It controls native KPI values, chart overlays, gauge and donut values, and image exports.
Body text and chart labels use their separate font settings.

To change the font:

1. Install its font package in `server` and remove the old package if unused.
2. Set `family` to the CSS family name, `stylesheet` to its browser stylesheet,
   and `file` to the installed WOFF2 file in `kpiFont.json`.
3. Use weight 600 for the browser font and export file. Keep the same font version
   and character coverage in both. Include the digits, currency symbols, and units you use.
4. Restart the client and server, then reload the browser. Vite generates the
   browser font link and CSS variable from the shared settings.
5. Run the checks below and inspect KPI, gauge, and donut values at small sizes.

```sh
cd client
npm run test:visualization
npm run build
cd ../server
npx vitest run --config vitest.pure.config.js tests/unit/echartsCompiler.test.js tests/unit/chartImageRenderer.test.js
```

Update compiler font assertions when changing the family. Review export snapshots if
font metrics change. The stable export family `Chartbrew KPI` embeds the configured
font file. `font-tw` remains a compatibility class for native KPI text; it reads the
shared CSS variable. No environment variable is needed.

`legacyFamilies` identifies older saved chart options. Keep those aliases when changing
the current font, and add the outgoing family to that list if it is different.
New options use the shared family automatically.
