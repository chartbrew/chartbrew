---

canonicalUrl: https://docs.chartbrew.com/migrations/v1.0.0-beta.9/

meta: 
    - property: og:url
      content: https://docs.chartbrew.com/migrations/v1.0.0-beta.9/

---

# Migrate to v1.0.0-beta.9.x

This is a big update on top of the previous versions, but the migration is mainly automated. Since the architecture and database schema changes dramatically, you should first back-up your database before continuing.

::: tip
Create a back-up of your database before continuing
:::

## How to migrate

**🔥 Breaking change**: This version is built with **Node v12.17.0** so make sure you don't use an older version when setting up the project.

If you used the [`create-chartbrew-app`](https://github.com/chartbrew/create-chartbrew-app) CLI tool:

```sh
cd yourChartbrewApp/
npx create-chartbrew-app update
```

If you [cloned the repository](https://github.com/chartbrew/chartbrew) do the following:

```sh
# checkout the new release tag (this really depends on your setup)
# It is recommended you merge the new release tag into one of your branches
# You might need to fix any merge conflicts that arise

cd yourChartbrewApp/
npm run setup

cd server/
npm run db:migration
```

**That's pretty much it**. Your existing charts and connections should work as normal, but you will notice a brand new chart builder interface.


## Architectural changes

The following section is just informational - _no action required_.

### Models changes

`ApiRequest` has become `DataRequest`. A new `DataRequest` object will be created for every `Dataset` that is trying to get data from somewhere.

All the pagination related fields (`paginate`, `limit`, etc) have been moved from `Chart` to `DataRequest`.

Moved `connection_id` from `Chart` to `Dataset`. Now each `Dataset` will be associated with a `Connection`.

### Controllers changes

Lots of improvements here, but the most important one is the `ChartController` now having a chart update method that compiles data from all the `DatasetControllers` which in turn have an obvious `runRequest()` method.

### Routes changes

The `/apiRequest` route is no more and in turn is replaced by `/dataRequest`. The full path is: `/project/:project_id/chart/:chart_id/dataRequest`.

New endpoint for `Dataset` can now be accessed at `/project/:project_id/chart/:chart_id/dataset`.

Since the `Dataset` model has a new route, the access control module was updated to restrict unwanted access to this data. Owners, admins and editors have all the access (`find`, `update`, `create` and `delete`) and members have only `find` access.