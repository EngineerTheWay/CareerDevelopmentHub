# Career Copilot

A Copilot Studio agent that manages a job search conversationally — networking contacts, job
applications, follow-ups, and logged interactions — and connects those records to Outlook mail
and calendar.

It is one of four surfaces over a shared Dataverse model. See the
[repository root](../) for the others, or the
[project write-up](https://calebway.io/projects/career-copilot/) for screenshots and the
design reasoning.

---

## How it reaches data

The agent has **no direct database access.** Every read and every write goes through one of
**21 typed flows** in [`../flows/definitions/`](../flows/definitions/), each bound to the agent
as a tool with named inputs and outputs.

```
Career Copilot  (Copilot Studio, standard harness)
        ↓
21 typed flows  ../flows/definitions/
        ↓
Dataverse  ·  Outlook mail  ·  Outlook calendar
```

That indirection is the point. A generic data tool lets the agent compose its own query every
turn, so the same request takes a different path each time. A tool that requires
`contactName`, `companyId`, and `relationship` cannot be called with the relationship missing.

Two consequences worth knowing:

- **Every write starts with `ResolveRecord`**, which turns a name into an id and reports the
  match confidence — `exact`, `close`, `ambiguous`, or `none`. On `ambiguous` it returns the
  candidates and writes nothing, so the agent has to ask rather than pick.
- **The flows enforce the safety rules themselves.** `UpdateRecordFields` refuses any notes
  field and points at `AppendNotes`. `DeleteRecord` refuses unless the supplied name matches
  the record exactly. `SendDraft` refuses unless the subject matches the real draft. A refusal
  comes back as a normal response with a remedy, not an error.

Flow design rationale is in [`../docs/FLOW-CATALOGUE.md`](../docs/FLOW-CATALOGUE.md). How to
deploy and test them is in [`../flows/README.md`](../flows/README.md).

---

## What is in this folder

| Path | What it is |
|---|---|
| `instructions.md` | The agent's instructions — the tool table, when to use each one, and the rules it must follow. This is the agent's behaviour, in full. |
| `description.txt` | The one-paragraph description shown in Copilot Studio and to users. |
| `evals/evals.json` | 28 prompts mapped to the tool each should invoke, covering 19 tools plus the guard cases. Source for `configure-evals.js`. |
| `evals/evaluation-set.csv` | 15 test cases with expected behaviour, in the format Copilot Studio's test-case importer takes. |
| `scripts/configure-agent.js` | Binds the flows to the agent as tools, and writes the instructions. |
| `scripts/configure-evals.js` | Pushes `evals.json` into the agent's test cases. |
| `scripts/lean-topics.js` | Disables the stock system topics that misbehave under generative orchestration. |
| `scripts/clean-solution-testcases.js` | Removes test cases from solution membership so the solution explorer renders. |

---

## The instructions

[`instructions.md`](instructions.md) is the substantive file here. Beyond the tool table, it
covers the parts that took the most iteration: which inputs accept `none` so the agent stops
asking about fields the user never mentioned, how to chain two calls rather than claiming a
capability is missing, how to read a refusal, and the drafting sequence — save the draft
immediately because that is reversible, but never send in the same turn as an edit.

It also carries rules the tools cannot enforce on their own:

- Never create a Business Group. Search only; they are managed in the app.
- Only create a Company deliberately, after the user confirms it is genuinely new.
- Never bulk-write from a vague instruction. List the records first and get agreement.
- Report only what happened. If a tool fails, say so and stop.

---

## Why the scripts exist

Copilot Studio's **Add a tool → Flow** picker only surfaced some of the flows, even though all
of them met the documented criteria. A tool is just a `botcomponent` record, so
`configure-agent.js` writes them directly, using a shape copied verbatim from the one tool that
the picker did add. That also means every binding is identical instead of hand-configured.

`lean-topics.js` exists for a subtler reason. The stock system topics are written for classic
orchestration, where a canned reply to "thanks" is the whole point. Under generative
orchestration they fire on trigger phrases mid-conversation and cut across the orchestrator —
`Greeting` calls `CancelAllDialogs`, which kills work in progress.

```
node scripts/configure-agent.js list           # current tools on the agent
node scripts/configure-agent.js tools          # create/update a tool per flow
node scripts/configure-agent.js instructions   # push instructions.md
node scripts/configure-evals.js apply          # push evals.json as test cases
node scripts/lean-topics.js status             # which system topics are live
```

> The agent is configured from these files, not the other way round. Changes made in the
> Copilot Studio portal will be overwritten the next time a script runs.
