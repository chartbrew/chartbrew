---
id: FS-20260813-team-onboarding
owner: Raz
status: done
links: []
scope: web, server
---

# Team Onboarding And Business Profile

## Summary

Add one onboarding flow for each new team. A normal signup enters the flow for the team that
Chartbrew creates for the new owner. An invited signup does not enter this flow and does not create
a separate owned team. The team switcher starts the same flow when an existing user creates a team.

Base the client structure and the team-details step on `chartbrew-cloud/client/src/containers/Onboarding`.
Do not copy plan selection, trial, Stripe, or other billing behavior into Chartbrew OS.

The flow asks for the team name, the primary Chartbrew use case, and a public business website.
Chartbrew reads a small set of public website pages and proposes a business profile. The owner can
review and edit the proposal before Chartbrew saves it. Chartbrew can use the approved profile as AI
context only after a separate, optional owner consent.

## Goals

- Run onboarding once for every team that a user creates as its owner.
- Do not run owner onboarding for a user who joins through an invitation.
- Reuse the cloud component names, layout, use-case values, and `/start` route where possible.
- Save an owner-approved business name, description, logo, domain, and small metadata set.
- Keep website discovery safe, bounded, optional, and recoverable.
- Let the owner control if the approved profile can enter an AI request.
- Send both completed flows to `/connections/new` with the new team active.

## Non-Goals

- Plans, trials, payments, entitlements, or feature flags.
- A general-purpose web crawler, search index, or copy of the website.
- JavaScript page rendering, authenticated pages, forms, or files other than safe logo images.
- Automatic changes to a dashboard theme, report logo, connection, or dataset.
- Product analytics or outbound Chartbrew OS telemetry.

## Entry Rules And Flow

Onboarding belongs to a team, not to a user.

| Entry | Behavior |
| --- | --- |
| Normal signup | Create the initial owned team with onboarding incomplete. Go to `/start` and show a short welcome heading before team setup. |
| Invited signup | Create the user without a personal team, accept the invitation, and go to the invited team. Do not show this onboarding. |
| Create team | Replace the current name modal with `/start?new=1`. Start with team setup and do not show welcome text. Create the team after the first step is valid. |
| Incomplete owned team | Selecting it resumes `/start?team=<id>` at the first incomplete step. |
| Existing team | A migration marks it complete. Existing users must not get a new interruption. |

Only the owner of the target team can open or complete its onboarding. Team restriction settings
continue to control team creation. A user without an owned team must not be sent to owner onboarding.

The steps are:

1. **Team setup**: Ask for team name and the same primary use-case choices as cloud: `client`,
   `internal`, `embedded`, `explore`, or a non-empty `other` value.
2. **Business profile**: Ask for a business website, for example `example.com`. Let the user skip
   this step or enter the profile manually. A discovery failure must not block onboarding.
3. **Review**: Show the proposed logo, business name, and description as editable values. Show a
   concise optional control: `Allow Chartbrew AI to use this business profile when it is relevant`.
   It is off by default and it is not required to finish.
4. **Finish**: Save the approved values and completion time in one transaction. Refresh the team
   state, make the team active, and go to `/connections/new`.

Do not show crawl status, job names, source fields, model names, or other implementation details.
For a read failure, use: `We could not read that website. Check the address or add the details
yourself.` Provide retry, manual entry, and skip actions.

## Website Discovery

The server accepts a domain or URL, adds HTTPS when the scheme is absent, removes credentials,
query, and fragment values, and keeps a canonical public start URL. It fetches static HTML only.

- Use `server/modules/safeRequest.js` for the first URL, every redirect, every extra page, and every
  image. Set `allowPrivateHost: false` for this feature even when private source connections are
  enabled. Allow only HTTP or HTTPS on ports 80 and 443.
- Block loopback, private, link-local, metadata, and unsafe DNS results. Revalidate each redirect.
- Read the home page and at most two same-origin About or Company pages that the home page links to.
  Respect `robots.txt` for extra pages. Do not discover more links from those pages.
- Limit the operation to 10 seconds, three HTML pages, 1 MB per page, three redirects, and one logo
  image of at most 512 KB. Accept HTML for pages and raster PNG, JPEG, WebP, or ICO images for the
  saved logo. Do not accept SVG in the first release.
- Do not send cookies, authorization headers, source credentials, or user headers. Do not run page
  scripts. Discard raw HTML after extraction.
- Apply a per-user and per-domain rate limit. Log bounded security outcomes without website content.

Use this extraction priority:

1. JSON-LD `Organization` or `WebSite` name, description, and logo.
2. Open Graph site name, title, description, and image.
3. Standard title, meta description, favicon links, and `/favicon.ico`.

The proposed metadata can contain the HTML language, declared locale, theme color, public social
profile links, and declared keywords or industry. Use an allowlist and size limits. Do not collect
contact people, email addresses, phone numbers, page text, analytics identifiers, or script URLs.
Never silently replace a team name with a discovered business name.

## Data And API Contract

Add these team fields:

- `useCases`: nullable text, with the same name and type as Chartbrew Cloud.
- `onboardingCompletedAt`: nullable date. Backfill it for all teams that exist when the migration
  runs. New teams start with `null`.

Add a one-to-one `TeamBusinessProfile` record with `team_id`, canonical `websiteUrl`, `domain`,
`businessName`, `description`, `logoMimeType`, bounded `logoData`, allowlisted `metadata`,
`aiContextAllowed`, and normal timestamps. Keep logo bytes out of normal team list responses and
serve them through an authorized image route. Delete the profile with the team.

Add or change these authenticated contracts:

- `POST /team` accepts only validated team creation fields. It can accept `name` and `useCases` for
  the new-team onboarding entry and returns the incomplete team.
- `POST /team/:id/onboarding/discover` accepts `{ websiteUrl }` and returns a preview. It does not
  save or approve raw website content.
- `PATCH /team/:id/onboarding` accepts the allowlisted step values. The final call saves the profile,
  owner consent, and `onboardingCompletedAt` atomically.
- `GET /team/:id/business-profile/logo` returns the stored image with a correct type,
  `X-Content-Type-Options: nosniff`, and a cache policy.
- The Team settings profile editor reuses discovery and review so an owner or team admin can change
  the saved profile later. Only the owner can change AI consent.

Do not pass request bodies directly to `Team.update()`. Use explicit field allowlists. Team creation
must create the team, owner role, and default projects in one database transaction.

## AI Context Rules

The saved profile is ordinary team data. Saving it does not grant AI access. Add a bounded
`business_profile` section to the workspace context service only when all these conditions are true:

- The team owner enabled `aiContextAllowed`.
- Chartbrew AI and the applicable platform controls are enabled.
- The current request can access the team and needs this profile.

The section can include only the approved name, domain, description, use case, and allowlisted
metadata. It must not include logo bytes, raw HTML, source page text, or rejected draft values. When
an external provider receives the section, add `business_profile` to the existing egress manifest.
Turning consent off must stop future use at once. Existing audit and retention rules still apply.

## Cloud Merge Alignment

- Keep `Onboarding.jsx` and `components/OnboardingTeam.jsx` as the shared base. Preserve the existing
  `onContinue` and `team` props and the cloud use-case values.
- Add `components/OnboardingBusiness.jsx` for discovery and review. Keep billing steps outside this
  component so Cloud can compose them separately.
- Keep `/start` as the route. Use query state only to select a target team or the new-team entry.
- Do not import Stripe modules, plan selectors, trial components, or cloud-only flags in shared OS
  onboarding files.

## Acceptance Criteria

- A normal signup enters welcome onboarding for its incomplete owned team.
- An invited signup creates no extra owned team and never enters owner onboarding.
- Create team opens the full flow without welcome copy; cancel before the first step creates no team.
- Refresh or team selection resumes an incomplete owned team. A completed or legacy team does not
  enter the flow again.
- Website discovery extracts fixture metadata in the stated priority and lets the owner edit it.
- Invalid, private, redirected-private, oversized, slow, non-HTML, and unsafe image targets fail
  closed while manual setup and skip remain available.
- The database stores the approved logo and profile, but not raw HTML.
- AI context excludes the profile by default and after consent is removed. With consent, it includes
  only the approved bounded fields and records external sharing in the manifest.
- Owner checks exist on every onboarding write. Direct route access cannot change another team.
- Client tests cover both entry variants, resume, skip, retry, review edits, and completion. Server
  tests cover migration backfill, invitation behavior, transactions, extraction, SSRF controls,
  field allowlists, consent, and AI context gating.

## Important Product Ideas

- Use the saved logo as the team-switcher avatar. This gives the profile an immediate visible use.
- If discovery finds a better business name, offer it as a one-click team-name suggestion. Do not
  apply it automatically.
- Later, offer the approved logo and theme color as defaults for a new dashboard or report. Require
  confirmation and never change existing content.
- Later, use public technology hints only to suggest relevant connections. Do not add this to the
  first crawler because it increases collection and false matches.
