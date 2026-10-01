# AI usage records

OS records provider use. Cloud owns model prices, credits, subscriptions, and plan limits.

Run `npm run db:migrate` from `server/` before starting the updated server. No new environment variables are required.

## Provider calls

All OpenAI Responses and Chat Completions calls go through `server/modules/ai/usage.js`.
`withAiUsageContext({ teamId, conversationId?, activity? }, operation)` sets the trusted team and request ID.
Nested calls share the request ID. Concurrent requests keep separate context. A nested call cannot change teams.
Pass the team from an authorized database record or access scope. Do not use a model-generated team ID.

`callAiProvider({ client, request, purpose, api?, options? })` saves an `AiUsage` row before calling the provider.
Use `api: "chat"` for Chat Completions; the default is `"responses"`.
The recorder saves returned usage before callers parse or validate output. It records calls inside tools too.
Completion updates only the provider result fields. It preserves removed chat references and costs saved by Cloud.
SDK retries are disabled. A deliberate retry must call the recorder again and get its own usage ID.

New records include:

| Field | Meaning |
| --- | --- |
| `id` | Stable ID for one call record. Use this to prevent duplicate Cloud charges. |
| `request_id` | ID shared by all calls in one user request or background operation. |
| `team_id`, `conversation_id` | Team and optional saved conversation. Temporary chats have no conversation ID. |
| `provider`, `model`, `provider_response_id` | Provider, returned model name when available, and response ID. |
| `purpose` | Work done by this call, such as `workspace_planner`, `generate_sql`, or `inline_chart`. |
| `activity` | `interactive`, `background` for dataset enrichment, or `internal` for observation audits. |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | Provider counts. A missing total is calculated only when both input and output are known. |
| `cached_tokens`, `reasoning_tokens` | Details within input and output. Do not add these again to total tokens. Missing details remain null. |
| `provider_usage` | The full provider usage object, for model-specific pricing details. Contains no prompt or answer. |
| `usage_status` | See below. |

New records leave `cost_micros` null. OS does not estimate costs or assign credits.
Old records keep their counts and get `usage_status: "legacy"` and `activity: "legacy"`.
Their missing details cannot be reconstructed by this migration. Keep Cloud's existing billing rule for them until a chosen cutoff.

## Status and failures

- `pending`: The start record exists. The call may be in progress, or the process/final database write failed.
- `reported`: The provider returned input, output, and total counts. This does not mean the user's task succeeded.
- `unknown`: The provider call threw an error or did not return complete counts. Do not treat missing counts as zero.
- `rejected`: The before-call hook stopped the call. No provider request was sent.
- `legacy`: A record made before the new recorder.

If the start record cannot be saved, the provider call does not run.
If the final write fails, the error propagates and the durable start record remains pending.
A timeout can still incur provider charges. Reconcile unknown and old pending records with provider records.
There is no automatic reconciliation worker in OS.

Requests that need no model call do not create usage rows. Orchestrator results expose `requestId`,
`usageComplete`, `usage`, and `usageRecords`. The totals include nested calls and earlier calls before fallback.
`usageComplete: false` means some use is still unknown. Never use a partial total as a final charge.

## Cloud integration

Register these hooks once during Cloud server and worker startup:

```js
const aiUsage = require("./modules/ai/usage");

aiUsage.beforeAiCall = async (record) => {
  // Apply Cloud's own limits. Throw to stop the provider call.
  await checkAiAllowance(record.team_id, record.activity);
};

aiUsage.afterAiUsage = async (record) => {
  if (record.usage_status !== "reported") return;
  // Price the returned model and token details. Prevent duplicate charges with record.id.
  await recordCloudAiUsage(record);
};
```

The after-call hook runs after the usage row is saved. A hook error does not discard the AI response or the row.
Cloud must retry undelivered records from `AiUsage`. The hook is not a durable delivery queue.
Use the same usage ID for retries. The before-call hook must handle concurrent allowance checks in Cloud.
Exclude internal audits from customer charges unless Cloud explicitly chooses to charge for them.

For a billing-period summary:

```js
const { getUsageSummary } = require("./modules/ai/usage");

const groups = await getUsageSummary({
  teamId: 7,
  from: "2026-10-01T00:00:00Z",
  to: "2026-11-01T00:00:00Z",
  activity: "interactive",
});
```

The period includes `from` and excludes `to`, using record creation time. Adjacent periods do not overlap.
Use explicit timezone offsets. Groups separate provider, model, purpose, activity, and usage status.
`records` counts rows in each group; pending and rejected rows are not completed provider calls.
Omit `activity` to include all activities, including legacy records. SQL aggregate values can be strings on MySQL or PostgreSQL.
Use detailed rows and `provider_usage` when pricing needs fields beyond the grouped token counts.

The existing usage API remains available for old clients. Its cost total is not a price estimate.
Use this module and the saved records for Cloud billing. Stop the old end-of-conversation inserts when merging these changes into Cloud;
otherwise each main call will be counted twice. This applies to both the AI controller and the Slack controller.

## Check

From `server/`:

```sh
npm run test:pure -- tests/unit/aiUsage.test.js
```
