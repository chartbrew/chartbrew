# Home and useful first results

## Goal

Keep users on Home after team setup. Help them reach their first useful chart
with the data and access they have. Use the normal Chartbrew agent for all teams.
Do not use a fixed interview, business categories, or a required report proposal.

## Home

- Finish team setup on `/`.
- Keep `Good to see you, {name}.` and `What are we exploring today?`.
- Use current team content and permissions, not account age, to choose content.
- Keep Get started before chat until the first chart exists. Show only available
  actions. Keep normal setup controls available when AI is unavailable.
- For an empty team, use `What are you trying to understand from your data?` in
  the input. Explain that a goal, source name, or business description is enough.
  Do not show category buttons or assumed answers.
- With connections but no datasets, offer to explore connected data. With datasets,
  offer to create a chart or find trends. With charts, offer summaries and watches.
  Give data failures priority over these suggestions.
- Show Discover only after charts exist. Keep real dashboards visible. Do not fill
  an empty page with sections that need data the team does not have.
- Keep restricted members within their accessible reports. Do not equate lack of
  access with an empty team.
- Refresh after chat actions, on return to Home, and on team change. Keep active
  chat mounted during refresh. Offer Retry on failure and discard stale responses.

## Normal agent behaviour

Use this loop: understand the request, inspect available resources, take the next
useful action, and ask only when blocked.

Accept a goal, source, business description, or direct task. Use conversation
history and permitted team facts. Do not ask for facts already supplied. Choose
reasonable chart types, names and date ranges. Ask at most one question when its
answer changes the next action. Let actual source data and tool results determine
whether a question is needed.

`How do I get started?` gets brief practical guidance. For an empty team, explain
that connecting one source and describing what they want to understand is enough.
If they do not know what to track, they can describe their business. Do not create
anything or launch a questionnaire from this request.

When a source is known, check it. Reuse an existing connection. If connection setup
is needed, recommend one relevant source. If a user has product events in PostHog
and customer records in Postgres, start with the event source for product activity.
Do not promise source support or metric coverage without tool evidence.

When no source is known, inspect existing resources first. If nothing is suitable,
ask where the relevant data lives. Offer `/connections/new` as a separate browse
link when useful. An unfiltered lookup with no connections returns no catalogue.

After connection setup, check the connection, inspect capabilities and actual
schema, events or samples, and continue the original request. Build useful chart
previews using existing tools. Reuse existing previews and ambiguity controls.
Do not require a separate proposal or a special acceptance phrase.

Create a dashboard only when useful charts can be added. The shared AI dashboard
tool rejects creation if the team has neither an active connection nor a saved
dataset. This guard checks the minimum data requirement; tool inspection must
still establish that the data supports the requested charts. Do not claim the
requested report is complete until its charts exist.

## Chat UI

- Use compact HeroUI connection cards: source name, necessary access guidance,
  and a connection action. Keep errors visible. Remove storage and protocol prose.
- Use existing chart preview cards after useful work.
- Use choice buttons for actual data ambiguity or concrete actions, not broad
  business categories. Free-text replies remain available.
- Keep the saved conversation through connection setup and continue the original
  request on return. Credentials belong in connection forms.

## Implementation

- Remove the interview state, fixed opening response, read-only interview tool
  filter, and `prepare_report` tool.
- Let the agent choose tools without forced creation on visualization keywords.
- Keep the narrow capability matcher so help requests reach conversation.
- Supply bounded, permission-scoped workspace facts through the existing
  normalization and external-data checks. Do not persist this background in chat.
- Keep source lookup within the source registry and existing role checks.
- No new dependencies, feature flags, environment variables, or migrations.

## Checks and use

Open Home with an empty team and start a new conversation. Try a goal, a source
name, a business description, and `How do I get started?`. Continue after source
setup to check that the agent inspects data and produces a useful preview.
Existing saved replies remain unchanged; start a new conversation to assess the
new behaviour.

```sh
npm --prefix server run test:pure -- tests/unit/homeConversation.test.js tests/unit/homeSetup.test.js tests/unit/connectionSetup.test.js
node --test client/src/containers/Home/*.test.js
npm --prefix client run build
```

Validation: 180 server tests and 20 client tests pass. The client build passes.
The empty Home page and refresh were checked in the existing browser session.
Conversation tests use a mocked AI provider; they check routing, available tools,
source setup, real-choice rendering, and the empty-dashboard guard. They do not
prove live model response quality. A live AI test remains unverified: automatic
approval review previously rejected sending private team context to the provider.

Measure success by time from team setup to a useful chart with data. Use existing
tracking; a new analytics system is outside this change.
