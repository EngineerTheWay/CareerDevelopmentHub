# Career Development Hub — Flow Catalogue

Environment: `<ENVIRONMENT_NAME>` (`<ENVIRONMENT_ID>`)
Solution: `CareerDevelopmentHub`
Date: 2026-08-18

Companion to [AGENT-HARNESS-ANALYSIS.md](AGENT-HARNESS-ANALYSIS.md).

**Scope decisions already made:**
- No Outlook → Dataverse reminder sync. The `cws_reminder_*` / `cws_outlook_*` columns
  on `cws_followup` are leftover artifacts and stay unused.
- Email drafting **and sending** are in scope; logging sent mail back to Dataverse is not.
- Harness (standard vs. GitHub Copilot) is undecided. Every flow below works on either.

---

## Design rule

Type by **task shape**, not by table — but stop before a single generic
`DoThing(table, action, payload)`. The typed parameter list is the reliability
mechanism: a tool that demands `contactName, companyId, relationship` cannot have
its relationship field forgotten. A tool that takes `payload: object` is the generic
Dataverse MCP again, with extra latency.

Power Automate flow inputs are flat, so conditional required fields can't be
expressed in one signature. That is why the four creates stay separate.

---

## Option set reference

| Column | Values |
|---|---|
| `cws_jobapplication.cws_stage` | 771670000 Researching · 771670001 Applied · 771670002 Interviewing · 771670003 Offer · 771670004 Closed |
| `cws_jobapplication.cws_arrangement` | 771670000 Remote · 771670001 On-site · 771670002 Hybrid |
| `cws_networkingcontact.cws_relationship` | 771670000 Warm · 771670001 New · 771670002 Dormant · 771670003 Mentor · 771670004 Recruiter · 771670005 Hiring Manager |
| `cws_followup.cws_relatedtype` | 771670000 Contact · 771670001 Application · 771670002 None/Standalone |
| `cws_followup.cws_status` | 771670000 Open · 771670001 Completed |
| `cws_interaction.cws_interactiontype` | 771670000 Networking Chat · 771670001 LinkedIn · 771670002 Email · 771670003 Call · 771670004 Meeting · 771670005 Event · 771670006 Interview · 771670009 Other |

## Table reference

| Table | Logical name | Entity set | Primary name |
|---|---|---|---|
| Company | `cws_company` | `cws_companies` | `cws_companyname` |
| Business Group | `cws_businessgroup` | `cws_businessgroups` | `cws_businessgroupname` |
| Contact | `cws_networkingcontact` | `cws_networkingcontacts` | `cws_contactname` |
| Job Application | `cws_jobapplication` | `cws_jobapplications` | `cws_role` |
| Follow-Up | `cws_followup` | `cws_followups` | `cws_title` |
| Contact-Application | `cws_contactapplication` | `cws_contactapplications` | `cws_contactapplicationname` |
| Interaction | `cws_interaction` | `cws_interactions` | `cws_interactionname` |

---

## Tier 1 — the eight that fix reliability

### 1. `ResolveRecord(type, name, scope?, allowCreate?)`

Replaces `lookup-association-and-safety-skill` with enforced logic. Every write calls
it first.

- `type`: `company` | `businessGroup` | `contact` | `application` | `followUp`
- `scope`: **required** `companyId` when type is `businessGroup` (BG has a required
  company lookup); optional company hint for `contact` / `application`
- `allowCreate`: honoured **only** for `company`. Never for `businessGroup` — those are
  managed in the app.
- Returns `{ matchKind: exact | close | ambiguous | none, id, candidates[] }`

Normalises input before matching: trim, case-fold, collapse whitespace, ignore minor
punctuation. On `ambiguous`, returns candidates and writes nothing.

Also serves as cross-table search.

### 2. `GetDashboard()`

Active applications by stage, recent activity (14 days), follow-ups bucketed
**overdue / due soon / upcoming**, stalled applications, recent interactions.

All date bucketing is computed **server-side on local `YYYY-MM-DD` keys**. No OData
date filters anywhere — `cws_duedate` is DateOnly + UserLocal and equality filters
through the connector silently return zero rows.

### 3. `GetRecordSummary(type, id)`

The grounding flow. Feeds every summary *and* every email draft.

| type | Returns |
|---|---|
| `contact` | Contact, company, business group, relationship, **notes**, **interaction history (date desc)**, follow-ups, linked applications via junction |
| `application` | Role, company, business group, stage, next step, date applied, job link, **notes**, **interaction history**, follow-ups, linked contacts via junction |
| `followUp` | Title, due date, status, notes, related record plus that record's company and notes |

Notes and interaction history are **required** in the payload — they are what
"use interactions and notes as reference" depends on.

### 4. `CreateContact(contactName, companyId, relationship, role?, email?, city?, businessGroupId?, notes?)`

Required: `contactName`, `companyId`, `relationship`. `companyId` comes from flow 1.

### 5. `CreateApplication(role, companyId, stage, businessGroupId?, dateApplied?, jobId?, jobLink?, city?, arrangement?, nextStep?, notes?)`

Required: `role`, `companyId`, `stage`.

### 6. `CreateFollowUp(title, dueDate, relatedType, relatedId?, notes?)`

Required: `title`, `dueDate`, `relatedType`. Status defaults to Open (771670000).

`dueDate` is snapped to **local midnight** so the stored value matches what the model
app's date picker writes. Writes `cws_relatedcontact` or `cws_relatedapplication`
according to `relatedType`.

### 7. `SetFollowUpStatus(followUpId, status, completedDate?)`

Ports `cws_followup_completeddate.js` server-side — that rule currently only fires on
the model-driven form, so every agent write bypasses it.

- → Completed: stamp `cws_completeddate` at local midnight **only if empty**, so a
  deliberately backdated completion is never overwritten
- → Open: clear `cws_completeddate`

### 8. `AppendNotes(table, recordId, text, timestamp?)`

Read → concat → write. Makes note loss structurally impossible rather than a plea in
the instructions. The only flow permitted to write a `cws_notes` column.

---

## Tier 2 — completing coverage

### 9. `CreateInteraction(interactionType, interactionDate, contactId?, applicationId?, notes?)`

Generates `cws_interactionname` server-side as `Type — Contact — Mon DD, YYYY`,
capped at 850 chars — porting `cws_interaction_autoname.js`, which is form-only today.
Its own source comment anticipates "the server-side workflow"; this is that workflow.

### 10. `UpdateRecordFields(table, recordId, fields)`

General scalar updates. Two guards are what make a generic updater safe:

- **Refuses** any `cws_notes` field → routes to flow 8
- **Refuses** `cws_stage` → routes to flow 11

### 11. `UpdateApplicationStage(applicationId, stage, confirmClosed?)`

Returns `previousStage` so the agent can report the real delta rather than restating
its own intent. Moving to **Closed** (771670004) requires `confirmClosed: true`.

### 12. `SetContactApplicationLink(contactId, applicationId, linked)`

Creates or removes the junction row. Generates `cws_contactapplicationname`, which is
Application Required with no generator anywhere today.

### 13. `DeleteRecord(table, recordId, confirmToken)`

Two-phase. The token is issued by a prior `GetRecordSummary` call, so a delete cannot
be executed without having first fetched and shown the record.

### 14. `GetReview(period)`

Stalled applications (no stage change or note in 21+ days while not Closed), dormant
contacts, follow-up completion rate, pipeline counts by stage and relationship.

---

## Email — no flow required

Drafting and sending both stay outside the flow layer.

| Step | Handled by | Why |
|---|---|---|
| Gather facts | Flow 3 `GetRecordSummary` | Same grounding data every time |
| Write the draft | The model | Wrapping a prompt in Power Automate adds nothing |
| Show for approval | Harness | Topic node (standard) or instruction (GH harness) |
| Send | Outlook MCP / Office 365 connector | Touches no Dataverse state |

This follows the general rule: **MCP for browsing and outbound, flows for anything
that touches Dataverse state.**

Send is irreversible, so the confirmation guardrail lives at the harness layer, not
the flow layer — worth weighing when the harness is chosen. A topic can make approval
structural; on the GitHub Copilot harness it remains an instruction the model follows.

If sent mail should ever become an Interaction record, that is flow 9 called after
the send — additive, not a redesign.

---

## Deferred

| Flow | Why deferred |
|---|---|
| `DormantContactSweep` | Should propose follow-ups, never auto-create. Nice-to-have |
| `DataHygieneCheck` | Duplicate companies, orphaned junctions, applications missing a business group |
| `WeeklyReview` (scheduled) | Trivial scheduled wrapper over flow 14 once that exists |

## Existing

`Daily Brief — Career Development Hub` — active, recurrence 08:00 Pacific, Flow bot DM.
Keep as-is. Optionally refactor later to call flow 2 so the brief and the agent agree.

---

## Open cleanup item

The unused `cws_outlook_event_id`, `cws_outlook_calendar_id`, `cws_reminder_enabled`,
`cws_reminder_start_at`, `cws_reminder_end_at`, `cws_reminder_all_day`,
`cws_reminder_time_zone`, `cws_reminder_last_synced_at`, `cws_reminder_sync_error`, and
`cws_reminder_snyc_status` columns remain on `cws_followup` (0 of 29 rows populated).

Harmless to leave, but the agent reads table metadata and may try to populate them.
Either delete them or name them off-limits in the agent instructions.
