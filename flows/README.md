# Flows

Two different things live here. One is Agent Flows and the other is a standard scheduled Cloud flow.

## `definitions/` — the agent's tool surface

Twenty-one flows, each bound to the **Career Copilot** agent as a typed tool. The agent has
no direct database access; every read and write it performs goes through one of these.

They are Copilot Studio flows (`modernflowtype: 1`), triggered by the agent calling them,
and each declares a typed request and response so the agent passes named arguments rather
than composing its own query.

| Group | Flows |
|---|---|
| Finding & reading | `ResolveRecord` · `GetDashboard` · `GetRecordSummary` · `GetReview` · `ListByCompany` |
| Creating | `CreateContact` · `CreateApplication` · `CreateFollowUp` · `CreateInteraction` |
| Changing | `AppendNotes` · `SetFollowUpStatus` · `UpdateApplicationStage` · `UpdateRecordFields` · `SetContactApplicationLink` · `DeleteRecord` |
| Email | `DraftEmail` · `UpdateDraft` · `ListDrafts` · `SendDraft` |
| Calendar | `CreateCalendarEvent` · `UpdateCalendarEvent` |

Design rationale is in [`../docs/FLOW-CATALOGUE.md`](../docs/FLOW-CATALOGUE.md).

## `scheduled/` — automation the agent never touches

`daily-brief.json` runs on a timer at 8am and posts the day's follow-ups, overdue
items, and calendar events to Teams. It is an ordinary Power Automate flow
(`modernflowtype: 0`) with a recurrence trigger.

Every date conversion in these flows reads the `cws_TimeZone` environment variable, so a
new environment only needs that one value set. The recurrence trigger is the exception:
Power Automate does not accept an expression for a trigger's `timeZone`, so the 8am is
pinned to the literal in `daily-brief.json` (`Pacific Standard Time`) and has to be edited
by hand per environment.

---

## Working with these

```
node deploy-flow.js <definition.json> --activate    # create or update, then activate
node test-flow.js deploy <name>                     # deploy a testable twin
node test-flow.js clean                             # remove all twins
```

`deploy-flow.js` writes the `workflow` record directly rather than going through the Flow
API, which is what keeps the connection reference intact instead of binding an embedded
connection. It is idempotent — re-running it rewrites the definition in place.

`test-flow.js` exists because the platform's run API cannot invoke a Skills-triggered flow
with a body, and a successful run reports no action outputs. It deploys a twin with the
trigger swapped for a button and the response converted to a terminate step, so the returned
payload is actually readable. A twin run reports **Failed** with `errorCode: TEST_RESULT` —
that is success, and the payload is in `errorMessage`.

Twins are deliberately not added to the solution.