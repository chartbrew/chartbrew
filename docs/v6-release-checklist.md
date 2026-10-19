# V6 release checklist

Date: 14 October 2026

Release rule: Keep the feature scope fixed. Add work before launch only to correct
a confirmed failure in the core reporting flow, data correctness, access control,
or production deployment. Unchecked items need confirmation; they are not known bugs.

## Complete

- [x] Staging migration. On 13 October, the staging setup used a fresh production
  backup, applied 39 migrations, and saved 2,147 snapshots. All 31 charts in
  Chartbrew Open and HealthCo loaded. Cached data and bindings were preserved.
  The founder then checked personal and main client dashboards and reported that
  they looked correct. The same 327 unresolved charts and four oversized snapshots
  remained; no new issues were reported.

Evidence: [Plan isolated v6 migration tests](codex://threads/01a11420-f217-70b2-9f3e-b10def9296a6).
This completes the staging migration check. It does not cover live source requests,
billing, email, or cleanup jobs.

## Before launch

- [ ] Select the release commit. Confirm that it includes the tested migration
  fixes and the final backfill change: cached conversion for all charts; live
  refresh only for unresolved charts with a successful refresh in the last 30 days.
  Run the required tests and build for that commit.
- [ ] Check one complete new-user flow with real data: sign in, connect a source,
  create a useful report, edit it, and share it or set up recurring delivery.
  Confirm correct values and a clear recovery path after a failed request.
- [ ] Check existing-user access: login, 2FA, team permissions, and shared links.
  Confirm that restricted users cannot read another team's data.
- [ ] Check production-only behavior in a controlled test: live refresh, scheduled
  updates, delivery, billing and usage limits, and cleanup jobs. Use existing test
  evidence where it applies to the release commit.
- [ ] Record how the remaining unresolved charts and oversized snapshots affect
  active customers. Fix confirmed release regressions. Record older failures
  separately; do not require every historical chart to be repaired before launch.
- [ ] Prepare the deployment and recovery steps: maintenance window, stopped
  writes and workers, fresh backup, available old release and configuration,
  confirmed restore procedure, migrations, cached backfill, and report review.
  Keep encryption keys unchanged. Check live-refresh load and request allowances.
- [ ] Prepare short release notes and setup or upgrade instructions. Check that
  launch copy describes available features. Remove unsupported promises.

## During deployment, before reopening

- [ ] Run the prepared deployment steps. Complete and review the cached backfill.
  Check key customer dashboards, values, and shared links. Run the planned live
  refresh for unresolved charts. Review failures before restoring normal operation.
- [ ] Reopen the app and enable workers and schedules in controlled steps. Check
  errors, refresh results, delivery, and usage. Use the recovery plan if a serious
  regression occurs.

## After launch

- New chart types, extra connectors, and a larger MCP catalogue.
- Optional animations, visual changes, and further editor redesign.
- Wider observation coverage and additional automatic analysis.
- New reporting flows or platform changes that are not needed for the core flow.
- Repairs to old inactive charts that do not affect the release checks above.

After launch, give priority to failures reported by users and repeated report use.
Measure paid adoption and recurring use before expanding the feature scope.
