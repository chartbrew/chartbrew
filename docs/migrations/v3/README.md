---

canonicalUrl: https://docs.chartbrew.com/migrations/v3/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/migrations/v3/

---

# Migrate from v2 to v3

::: tip
V3 is still in beta and the docs are under construction :construction:
:::

::: warning
Since this is a major release, we recommend you to back up your current v2 database before migrating to v3. All the database migration scripts are automated, but it's always better to be safe than sorry.
:::

## Major architectural changes

- The client project is now using [Vite](https://vitejs.dev/) instead of [Create React App](https://create-react-app.dev/)
- Major changes to the database schema
  - The `Connection` table is now related to `Team` instead of `Project`
  - The `Dataset` table is now related to `Team` instead of `Chart`
  - Introducing a new table called `ChartDatasetConfig` to store the relationship and configuration between a `Chart` and a `Dataset`
  - New roles within a `Team` called: `teamOwner`, `teamAdmin`, `projectAdmin`, `projectViewer`
- The UI has been upgraded from NextUI v1 to v2
- The UI is now using [TailwindCSS](https://tailwindcss.com/)
- The minimum version of NodeJS is now v20

## :fire: Breaking changes - actions required

- `REACT_APP_API_HOST` is now `VITE_APP_API_HOST`
- `REACT_APP_CLIENT_HOST` is now `VITE_APP_CLIENT_HOST`
- New variable `VITE_APP_CLIENT_PORT` to specify where the app runs or is served. The default value is `4018`, but you will have to change this if you run the app on a different port.
- NodeJS v20 is required as a minimum version
- Team roles have changed. The previous `admin` and `editor` roles are now set as `projectAdmin`. This will not allow them to create connections and dataset, so you might have to reassign the roles for your team members in the UI.