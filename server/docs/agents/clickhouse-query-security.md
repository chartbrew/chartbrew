# ClickHouse query security

Chartbrew checks ClickHouse SQL before execution and before returning cached query data.
The same check applies to manual charts, AI previews, saved charts, and scheduled refreshes.
The connector checks the final SQL after variable substitution and sends `readonly = 1` with each data query.

AI dataset creation, temporary chart creation, dashboard chart creation, and dataset updates
validate SQL before saving it. PostgreSQL and MySQL use the existing shared SQL guard;
ClickHouse uses its source-owned guard. `validate_query` reports the safety check result.
It does not execute the query or verify database syntax.

## Compatibility

- Ordinary SELECT/WITH queries, joins, aggregates, comments, quoted text, and Chartbrew variables remain supported.
- External table functions such as `url`, `s3`, `remote`, `mysql`, `postgresql`, `sqlite`,
  `redis`, `mongodb`, `file`, and `executable`, including the covered cluster and storage variants, are rejected.
- Multi-statement queries, write operations, and attempts to change protected settings are rejected.
- Quoted identifiers with backslash escapes are rejected. Use ordinary quoted identifiers instead.
- ClickHouse read-only mode can reject other table functions or query-level settings, depending on the database version and profile.
- Existing queries are not rewritten or deleted. Queries that use restricted functions must read from approved tables instead.
- The timeout is unchanged.

No migration, new environment variable, or dependency is required. Restart the server after deployment.

## Database permissions

The guard covers known external function families. It is not a full SQL parser or a sandbox
for administrator-installed functions, dictionaries, views, or external table engines.
Keep the ClickHouse account limited to approved data. Do not grant administrative or
unneeded external-source permissions. Review the guard when adding support for new ClickHouse versions.

## Tests

From `server/`:

```sh
npx vitest run --config vitest.pure.config.js tests/unit/clickhouseQuerySecurity.test.js tests/unit/runQueryTool.test.js tests/unit/orchestratorUpdateDataset.test.js
npm run lint
```

These tests replace database calls. They do not verify permissions on a live ClickHouse server.
