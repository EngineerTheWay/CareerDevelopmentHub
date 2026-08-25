# Career Development Hub

A job-search and professional-network tracker built as **one Dataverse data model behind four
different Power Platform surfaces** — a conversational agent, a React app, a model-driven
dashboard, and a phone app for capture-on-the-go.

The interesting part isn't any single surface. It's that they share one schema and one set of
business rules, and each exists because it's genuinely the right shape for a different moment:
typing at a desk, tapping at a conference, or asking a question out loud.

---

## Architecture

```mermaid
flowchart TB
    subgraph surfaces [ ]
        direction LR
        A["**Career Copilot**<br/>Copilot Studio agent<br/><i>ask, review, draft</i>"]
        B["**Code app**<br/>React 19 + Vite<br/><i>manage at a desk</i>"]
        C["**Model-driven app**<br/>generative page<br/><i>dashboard + drill-through</i>"]
        D["**Quick Capture**<br/>Canvas, phone<br/><i>enter during an event</i>"]
    end

    A -->|21 typed tools| F["Power Automate<br/>flow layer"]
    F --> DV[("**Dataverse**<br/>7 tables")]
    B -->|@microsoft/power-apps SDK| DV
    C -->|dataApi| DV
    D -->|native connector| DV

    F -.->|Outlook| EXT["Mail + Calendar"]
```

### Data model

Seven tables. `Company` and `BusinessGroup` give organisations structure; `NetworkingContact`
and `JobApplication` are the two things you actually track; `Interaction` and `FollowUp` are the
time-series around them; `ContactApplication` is the many-to-many that lets one person be
relevant to several applications.

---

## The agent

`Career Copilot` is a Copilot Studio agent whose entire capability surface is **21 typed Power
Automate flows** — [`flows/definitions/`](flows/definitions/). It has no direct database access.

Two decisions drove that design, both written up in [`FLOW-CATALOGUE.md`](FLOW-CATALOGUE.md):

**Typed tools, not a generic one.** The obvious move is a single
`DoThing(table, action, payload)` and let the model figure it out. That was rejected deliberately:

> The typed parameter list *is* the reliability mechanism. A tool that demands
> `contactName, companyId, relationship` cannot have its relationship field forgotten. A tool
> that takes `payload: object` is the generic Dataverse connector again, with extra latency.

**Resolve before you write.** Every mutation is preceded by `ResolveRecord`, which turns a name
into a GUID *and reports its own confidence* — `exact` / `close` / `ambiguous` / `none`. The agent
instructions ([`agent/instructions.md`](agent/instructions.md)) bind each outcome to a behaviour:
confirm on `close`, present candidates and stop on `ambiguous`, never invent on `none`. Most agent
data-corruption bugs are a confident write against a wrong match; this makes that path unreachable
rather than merely unlikely.

---

## The surfaces

| Surface | Stack | What it's for |
|---|---|---|
| [Code app](CareerDevelopmentHubCode/apps/career-development-hub/) | React 19, Vite, Tailwind 4, TanStack Query + Table, react-hook-form + Zod | Full CRUD, bulk edit, filtering |
| [Model-driven page](ModelApp/career-hub-dashboard/) | Generative page, Fluent UI, `dataApi` | Stat tiles that drill into saved views |
| [Quick Capture](CareerDevelopmentHubCanvas/) | Canvas app, phone layout | Contact / interaction / follow-up entry in seconds |
| [Web resources](ModelApp/webresources/) | Vanilla JS form scripts | Auto-naming, field guards, section logic |

---

## Repo map

Being explicit about what was authored versus scaffolded, since the tree contains both:

**Hand-written**
- `agent/` — instructions, evals, and the scripts that bind flows to the agent as tools
- `flows/definitions/` — all 21 flow definitions
- `CareerDevelopmentHubCode/apps/career-development-hub/src/` — `pages/`, `hooks/`, `lib/`, and
  the non-`ui/` `components/` (~26 files)
- `ModelApp/` — the generative page and the four web resources
- `CareerDevelopmentHubCanvas/` — five screens of Power Fx
- `canvas-plan/`, `FLOW-CATALOGUE.md` — design docs written before the code

**Scaffolded or generated** (included so the app builds, not offered as original work)
- `src/components/ui/` — shadcn/ui primitives (53 files)
- `src/generated/` — Dataverse models, services, validators generated from schema (35 files)
- `app-gen-sdk/` — vendored Power Apps SDK (47 files)

---

## About this repository

This is a **sanitized public mirror**. The working repository is private; this one is produced by
a publish script that copies hand-written source, rewrites tenant identifiers to placeholders, and
then re-scans its own output — failing the build if any GUID, org URL, email, or local path
survives. Placeholders like `<ENVIRONMENT_ID>` and `<ORG_NAME>` are that process, not omissions.

No solution export, no `customizations.xml`, no `.msapp`, and no environment state is published
here. Those carry the most tenant metadata and the least readable signal.
