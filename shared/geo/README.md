# Map data

## Use a map

1. Add one dataset to a chart and select the Map chart type.
2. Select **Filled regions** or **Points**, then select the map area.
3. For filled regions, select the field with country names or codes. Country maps
   use subdivision names or codes, such as `California` or `US-CA`.
4. For points, select latitude and longitude fields in decimal degrees, or select
   a GeoJSON Point field. GeoJSON coordinates are `[longitude, latitude]`.
5. Select a value field and an aggregation. Leave the value empty to count rows.
6. Open the dataset's **Display** tab to set the low-value and high-value colors,
   or turn the legend on or off. These settings also apply to image exports.
   Wide maps place the legend vertically on the right. Narrow maps place it below.

Nested fields are supported. For example, select `location.geo_data` from this row:

```json
{
  "location": {
    "geo_data": { "type": "Point", "coordinates": [26.1025, 44.4268] }
  },
  "sales": 120
}
```

A GeoJSON Feature with a Point geometry is also supported. Select the whole Point
or Feature object. Separate nested coordinate fields, such as `location.lat` and
`location.lon`, also work. Multiple nested row arrays still need the existing
flatten transform.

Maps support one dataset and one value per chart. World and continent maps match
country names, two-letter codes, and three-letter codes. Ambiguous names are not
matched. Use full region codes when a short name can refer to more than one area.
Rows with invalid locations are excluded and a warning is shown in **Build**, not
on the map. Regions without
data remain unfilled; zero values are kept.

No API key, environment variable, or database migration is required. Map files are
included in the build and loaded when needed. CSV and image exports are supported.

## Use maps with AI

With the existing AI setup, ask for a map from a dataset. For example:

- "Show sales by country on a world map. Use location.country and sum sales."
- "Map location.geo_data as points and count the rows at each location."
- "Change this map to show US states. Use the state code field."

The AI chart tools accept map layers, nested geographic fields, and the same map
areas as the editor. The AI uses a full visualization specification to preserve
the area, display mode, and coordinate format during creation and updates.
Addresses and city names need prepared coordinates for point maps.

Run the AI map checks from `server/`:

```sh
npx vitest run --config vitest.pure.config.js tests/unit/orchestratorMaps.test.js tests/unit/orchestratorResponsesApi.test.js
```

These tests use simulated database and AI responses. They check the real chart
tools and rendering pipeline without calling an AI provider or writing to a database.

## Boundary source and updates

These files contain Natural Earth v5.1.2 boundaries. The country map uses the 1:50m
Admin 0 countries dataset. Country detail uses the 1:10m Admin 1 states and provinces
dataset. Unused properties are removed. Country maps across the date line wrap
longitudes by 360 degrees so the country remains together. Borders are not simplified.

Source: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson

Licence: public domain. https://www.naturalearthdata.com/about/terms-of-use/

Natural Earth uses de facto boundaries. Administrative levels and completeness vary
by country. The UK file includes local administrative areas, not just its four
constituent countries. Codes that are missing from the source use Natural Earth IDs;
names can still be matched. These boundaries are for reports, not navigation.

Run `npm --prefix server run maps:import` to download and rebuild all files.
For an offline import, add `-- --source-dir /path/to/downloads`. The directory must
contain `ne_50m_admin_0_countries.geojson` and
`ne_10m_admin_1_states_provinces.geojson` from the pinned source version.

Review changes to boundaries and codes before updating the source version.
