# Career Copilot — Harness Analysis & Task Architecture

Environment: `<ENVIRONMENT_NAME>` (`<ENVIRONMENT_ID>`)
Solution: `CareerDevelopmentHub` — "Career Development Hub - Dataverse"
Agent: `Career Copilot` — botid `<AGENT_BOT_ID>`, `cliagent-1.0.0`
Date: 2026-08-18

---

## 1. What is actually deployed today

| Aspect | Current state |
|---|---|
| Harness | GitHub Copilot (`cliagent-1.0.0`) |
| Model | `claude-opus-5` |
| Channels | Microsoft 365 Copilot, Microsoft Teams |
| Memory | **Off** (`enableMemory: false`) |
| Web search | On |
| Tools | 4 MCP servers: Dataverse MCP (`InvokeMCP`), Work IQ Mail / Teams / Calendar |
| Skills | 1 — `lookup-association-and-safety-skill` |
| Topics | 0 (not available on this harness) |
| Knowledge sources | 0 |
| Typed actions / flows exposed as tools | 0 |
| Instructions | ~6,000 characters of prose |

Supporting assets in the solution: model-driven app `Career Data Management Suite`,
code app (reference), canvas app `Career Quick Capture`, and exactly one active
custom cloud flow — `Daily Brief — Career Development Hub`.

Data volume: Companies 8 · Business Groups 8 · Contacts 38 · Applications 22 ·
Follow-Ups 29 · Contact-Application junction 7 · Interactions 3.

---

## 2. Root cause of the unreliability — it is mostly not the harness

Six concrete defects were found in the current build. **Five of them would follow
the agent onto any harness.**

### 2.1 The table names in the instructions are wrong (highest impact)

The instruction table mixes *entity set* names with *logical* names:

| Instructions say | Actual logical name | Actual entity set |
|---|---|---|
| `cws_jobapplications` | `cws_jobapplication` | `cws_jobapplications` |
| `cws_followups` | `cws_followup` | `cws_followups` |
| `cws_networkingcontact` | `cws_networkingcontact` | `cws_networkingcontacts` |
| `cws_company` | `cws_company` | `cws_companies` |
| `cws_businessgroup` | `cws_businessgroup` | `cws_businessgroups` |

Worse, the **skill disagrees with the instructions** — the skill correctly says
`cws_followup` while the instructions say `cws_followups`. The model therefore has
two conflicting authorities and must guess which convention the Dataverse MCP
server wants on each call. That is a direct, per-turn source of "sometimes it works,
sometimes it doesn't."

Note also that `cws_company`'s entity set is `cws_companies`, not `cws_companys` — a
naive pluralisation the model will get wrong unless told.

### 2.2 The instructions say "five tables" but list six

And they exclude a table that exists and is directly relevant: **`cws_interaction`**
(3 records; columns `cws_interactiondate`, `cws_interactiontype`, `cws_notes`,
`cws_contact`, `cws_relatedapplication`). Meanwhile the same instructions promise
the agent can "summarize meeting notes." It cannot — interaction logging is the
single biggest capability gap.

### 2.3 No date semantics are given to the agent

`cws_duedate` and `cws_completeddate` are **DateOnly + UserLocal**. Equality filters
through the Dataverse connector silently return **zero rows** (documented during the
Daily Brief build). The agent free-writes OData every turn, so "what's overdue?"
is non-deterministic — sometimes an empty list, reported confidently as "nothing due."

### 2.4 Every data operation runs through one generic tool

`InvokeMCP` gives the agent generic read/create/update/delete over the environment.
There is no fixed contract for "get my dashboard" or "log an interaction" — the agent
re-plans the query on every turn. **This is the structural cause of cross-interaction
variance**, and it is what the "granularity" concern is really pointing at.

### 2.5 Safety rules are prose, not enforcement

"Always confirm before acting," "never replace notes — append," "never create a
Business Group," "confirm before delete" are all instructions the model may or may
not honour. None are enforced by the platform. Append-only notes in particular is a
data-loss risk currently stated as a plea.

### 2.6 Memory is off

Nothing carries between sessions, so every interaction re-derives context from
scratch — which also means the same question can produce a different plan tomorrow.

**Conclusion:** the agent was not built badly so much as built *thin* — one large
prompt plus one generic tool. The reliability gap is an architecture gap, not a
harness gap.

---

## 3. Business case for the standard harness

### 3.1 What the standard harness actually gives you

Microsoft positions the standard harness for "rule-based agents and structured,
repeatable workflows … where you want predictable behavior for well-understood
requests."

| Capability | Value for this solution |
|---|---|
| **Topics** | Confirm-before-write, disambiguation, and multi-field capture become authored nodes with Question + Condition — deterministic and auditable, not prose the model may skip. This is the direct answer to "reliable across interactions." |
| **Classic orchestration option** | Trigger-phrase matching selects exactly one topic, with zero planner variance, for the well-known asks. Generative orchestration stays available per-agent where you want flexibility. |
| **Power Fx on topic inputs** | Validation and formatting at the input boundary (e.g. forcing a due date to local midnight) instead of hoping the model formats it correctly. |
| **Prompt library / AI prompts** | Outreach drafts become named, versioned, testable assets rather than inline instruction text. |
| **Agent flows & Power Automate as first-class actions** | Typed inputs and outputs. The same contract every time. |
| **Billing model** | Copilot Studio capacity/licensing rather than Copilot Credits. On the GitHub Copilot harness, **building, testing, and evaluating also consume credits** — material for a project you iterate on heavily. |

### 3.2 What you give up

| Loss | Impact here |
|---|---|
| **Skills** (GH-harness only) | `lookup-association-and-safety-skill` has no direct equivalent. It must be rebuilt as a reusable subtopic plus a resolution flow — arguably *better*, since it becomes enforced rather than advisory. |
| **Memory** (GH-harness only) | Currently off, so no live loss. |
| **Native file creation** (Word/Excel/PPT/PDF) | Not used today. Would matter if you later want résumé tailoring or a PDF weekly review. |
| **Enhanced reasoning / error recovery** | Real loss on the open-ended work: stalled-application reasoning, prep briefs, "what should I do next." |
| **Model selection (`claude-opus-5`)** | Not carried over. |
| **Work IQ Mail/Teams/Calendar MCP tools** | Need re-plumbing via Office 365 connectors. **Verify before committing** — this is the least certain item in this analysis. |
| **No migration path** | Agents cannot be transferred between harnesses in either direction. Standard means a rebuild. |

### 3.3 The honest read

The harness split maps cleanly onto two halves of this agent:

- **Write path** (create/update/delete, capture, confirmations) — standard harness
  wins decisively. This work is rule-based and must be predictable.
- **Read/advise path** (summaries, outreach drafts, prep briefs, next-action
  recommendations, stalled-app reasoning) — GitHub Copilot harness wins. This is
  reasoning work where a fixed script is a liability.

Today one GH-harness agent does both, and the write path is where it hurts.

---

## 4. Recommendation

**Do not rebuild on the standard harness first.** Do the tool-typing work first —
it is required on either harness and closes most of the gap.

### Phase 1 — Type the operations (no rebuild; fixes most of the variance)

1. Fix the table names in the instructions; make instructions and skill agree.
   Use logical names, and state the entity sets explicitly (`cws_companies`, not `cws_companys`).
2. Bring `cws_interaction` into scope; correct "five tables" to six.
3. Add the DateOnly/UserLocal rule, and stop the agent filtering on dates in OData
   at all — bucket client-side or in a flow, mirroring what the model-app dashboard
   already does.
4. **Replace generic MCP calls with purpose-built cloud flows exposed as tools**
   (see §5.2). Keep the Dataverse MCP only as a read-only escape hatch, or remove it.
5. Turn memory on.

### Phase 2 — Decide, with evidence

Re-measure after Phase 1. If variance remains on the *conversational* paths —
confirmations, disambiguation, multi-turn capture — build the standard-harness
agent, because topics are precisely what fixes that and the GH harness has no
equivalent.

### Phase 3 (target architecture) — Keep both

Standard-harness agent as the primary interface for capture and record management;
the GitHub Copilot harness agent retained as a **connected agent** for open-ended
drafting and analysis. Copilot Studio supports agent-to-agent handoff, and both can
call the same typed flows from §5.2 — so the flows are built once regardless of
which harness ends up in front.

---

## 5. Core task catalogue

### 5.1 Deterministic topics (standard harness)

Each is a topic with typed inputs, Power Fx validation, an adaptive-card
confirmation, and a flow call to commit.

| # | Topic | Notes |
|---|---|---|
| T1 | **Log an Interaction** | type / date / contact or application / notes → `cws_interaction`. Closes the current gap. |
| T2 | **Add Contact** | Name + Company required. Calls company resolution (T9). Dedupe check before write. |
| T3 | **Add Job Application** | Role + Company required. Business Group is **search-only** — enforced by the flow, not by prose. |
| T4 | **Create Follow-Up** | Title + Due Date + related type. Writes the due date at local midnight so it matches what the app's date picker writes. |
| T5 | **Complete Follow-Up** | Pick from open list → status `771670001` + completed date. |
| T6 | **Update Application Status** | Restates old → new. Closed/Rejected/Withdrawn requires a second explicit confirm. |
| T7 | **Append Note** | Append-only guaranteed by read-modify-write in the flow. Never an overwrite. |
| T8 | **Delete Record** | Fetch → summarise → explicit confirm → delete. |
| T9 | **Resolve Company / Business Group** | Reusable subtopic. Replaces `lookup-association-and-safety-skill` with enforced logic. |
| T10 | **Link Contact ↔ Application** | Junction record via `cws_contactapplication`. |

### 5.2 Flows — typed tools (build once, reusable by either harness)

| # | Flow | Contract |
|---|---|---|
| F1 | `GetDashboard` | Active apps, recent apps, open/overdue/upcoming follow-ups, stalled apps. **Buckets server-side on local `YYYY-MM-DD` keys** — no date OData filters. |
| F2 | `ResolveCompany(name, allowCreate)` | → `{ id, matchKind: exact\|close\|ambiguous\|none, candidates[] }` |
| F3 | `ResolveContact(name)` / `ResolveApplication(role, jobId)` | Same output shape as F2. |
| F4 | `CreateContact` / `CreateApplication` / `CreateFollowUp` / `CreateInteraction` | Typed params; binds lookups via `@odata.bind`. |
| F5 | `AppendNotes(table, id, text)` | Read-modify-write. Structurally cannot overwrite. |
| F6 | `GetOpenFollowUps(bucket)` | `overdue` \| `dueSoon` \| `upcoming`. |
| F7 | `UpdateApplicationStatus(id, status)` | Returns the previous value so the agent can report the actual delta. |
| F8 | `RunDailyBriefOnDemand` | Wraps the existing Daily Brief so it can be requested, not only fired at 08:00. |
| F9 | `GetWeeklyReview` | **New.** Stalled applications (no status change or note 21+ days), contacts untouched in N days, follow-up completion rate. |

F1–F9 are the highest-value item in this document. They convert "the agent usually
gets this right" into "the agent gets this right."

### 5.3 AI prompts (named, versioned assets)

| # | Prompt |
|---|---|
| P1 | Draft networking outreach email (contact + context) |
| P2 | Draft thank-you / post-interview note |
| P3 | Draft LinkedIn connection note |
| P4 | Summarise interaction notes → structured summary + suggested next action |
| P5 | Interview / informational-interview prep brief from application + company + related contacts |

### 5.4 Knowledge sources

Résumé and positioning document, plus target-company notes — so drafted outreach is
grounded in real material rather than generated from the conversation alone. The
current agent has **no** knowledge sources at all.

---

## 6. Risks and open items

1. **Work IQ MCP parity on the standard harness is unverified.** Confirm the
   Mail/Teams/Calendar capabilities you rely on are reachable via Office 365
   connectors before committing to a rebuild.
2. **No harness migration exists.** Phase 3 means maintaining two agents.
3. **Credit consumption during iteration** on the GH harness applies to building,
   testing, and evaluating — worth measuring during Phase 1 before deciding.
4. The `cws_duedate` DateOnly/UserLocal design is the root of the date fragility.
   Changing the column behaviour is disruptive and not recommended; routing all date
   logic through flows (F1, F6) is the correct mitigation.
