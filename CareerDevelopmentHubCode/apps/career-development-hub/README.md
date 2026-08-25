# Career Development Hub — code app

A React app running as a **Power Apps code app**: it deploys into a Power Platform environment
and talks to Dataverse through the `@microsoft/power-apps` SDK rather than a REST backend of its
own. Authentication, hosting, and data access come from the platform; everything above that is
ordinary React.

This is one of four surfaces over a shared Dataverse model. See the
[repository root](../../../) for the wider architecture.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · shadcn/ui (Radix) · TanStack Query + Table ·
react-hook-form + Zod · date-fns · Recharts

## How data flows

```
pages/  ──►  hooks/use-career-data.ts  ──►  generated/hooks + services  ──►  Dataverse
                    (facade)                    (typed per table)
```

`use-career-data.ts` is a deliberate seam. The generated layer exposes one hook set per table
(`useNetworkingContactList`, `useCreateJobApplication`, …); the facade re-exports them under
domain names and adds the label/lookup helpers that would otherwise be duplicated across pages.
Pages import from the facade only, so regenerating the data layer doesn't ripple into the UI.

## Worth a look

**[`scripts/check-drift.mjs`](scripts/check-drift.mjs)** — the data layer is hand-maintained, so
it can silently disagree with the tables it describes. Drift fails *quietly* at runtime: an
unmapped choice is dropped with a warning, a stale column is sent in the write payload and
rejected with a generic error. This script selects every mapped column from every table (catching
renames and case mismatches, since Dataverse logical-name lookup is case-sensitive) and compares
each choice column against the `stringmap` table. It exits non-zero, so it can gate a deploy.

**[`src/lib/follow-up-utils.ts`](src/lib/follow-up-utils.ts)** — date handling for Dataverse
`DateOnly` columns. These have no timezone, so treating them as instants shifts due dates across
a day boundary depending on the viewer's offset. Everything is normalised to a `yyyy-MM-dd` key
before comparison rather than being passed through `Date`.

**[`src/components/admin-panel.tsx`](src/components/admin-panel.tsx)** and
[`src/lib/unique-records.ts`](src/lib/unique-records.ts) — bulk edit and duplicate detection
across contacts and applications.

## Local development

Requires an authenticated PAC CLI profile (`pac auth list`) against an environment containing the
solution's seven tables.

```bash
npm install
npm run dev
```

```bash
npm run check
```

Runs typecheck, a bundle smoke test, lint, and a Tailwind build concurrently.

```bash
npm run check:drift
```

Validates the hand-maintained data layer against live Dataverse metadata.

## What's authored here

`src/pages/`, `src/hooks/`, `src/lib/`, and the non-`ui/` files in `src/components/` — roughly 26
files. `src/components/ui/` is shadcn/ui, `src/generated/` is generated from the Dataverse schema,
and `app-gen-sdk/` is the vendored Power Apps SDK; those are included so the app builds, not
offered as original work.

> `power.config.json` in the public mirror carries placeholders (`<ENVIRONMENT_ID>`,
> `<CODE_APP_ID>`) where environment-specific identifiers belong.
