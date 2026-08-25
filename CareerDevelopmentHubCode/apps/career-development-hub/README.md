# Career Development Hub — code app

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

A React app running as a **Power Apps code app**. It deploys into a Power Platform
environment and reads and writes Dataverse through the `@microsoft/power-apps` SDK, so
authentication, hosting, and data access come from the platform rather than a backend of its
own.

One of four surfaces over a shared Dataverse model — see the [repository root](../../../).

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · shadcn/ui (Radix) · TanStack Query + Table ·
react-hook-form + Zod · date-fns · Recharts

---

## Layout

| Path | Contents |
|---|---|
| `src/pages/` | One file per route: applications, contacts, interactions, follow-ups, dashboard |
| `src/components/` | Forms, admin panel, filters (the non-`ui/` files) |
| `src/components/ui/` | shadcn/ui primitives — scaffolded |
| `src/hooks/` | `use-career-data.ts` plus session, user, and viewport hooks |
| `src/lib/` | Date handling, follow-up logic, duplicate detection, query client |
| `src/generated/` | Models, services, validators generated from the Dataverse schema |
| `app-gen-sdk/` | Vendored Power Apps SDK |

`src/hooks/use-career-data.ts` re-exports the generated per-table hooks under domain names
(`useContacts`, `useCreateApplication`) and holds the label and lookup helpers that would
otherwise repeat across pages. Pages use a mix of these and direct `@/generated` imports.

---

## Worth a look

### `scripts/check-drift.mjs`

The data layer is hand-maintained, so it can disagree with the tables it describes. Drift
fails quietly at runtime — an unmapped choice is dropped with a warning, a stale column is
sent in the write payload and rejected with a generic error.

This script selects every mapped column from every table, which catches renames and case
mismatches since Dataverse logical-name lookup is case-sensitive, and compares each choice
column against the `stringmap` table. It exits non-zero so it can gate a deploy.

It caught `cws_priority` remaining in the mapping after the column was deleted from
Dataverse, which had been breaking every job-application create and update.

### `app-gen-sdk/data/dataverse/dataverse-data-source-operations.ts`

Dataverse generates sequential GUIDs whose version nibble is `f` rather than an RFC-4122
version. The SDK's default `isValidRecordId` is `uuid.validate`, which rejects them.

Records created in this app passed, because the client generates a v4 uuid on create. Records
created by the model-driven app, canvas app, or a flow did not — delete and fetch-by-id
failed with `The recordId is not valid for this data source`. `isValidRecordId` is overridden
here to accept any well-formed hex GUID.

The generated Zod validators still use `.uuid()`. That's latent rather than broken, since no
form currently uses `zodResolver`.

### `src/lib/follow-up-utils.ts`

Dataverse `DateOnly` columns carry no timezone, so passing them through `Date` shifts due
dates across a day boundary depending on the viewer's offset. Values are normalised to a
`yyyy-MM-dd` key before comparison.

---

## Local development

Requires an authenticated PAC CLI profile (`pac auth list`) against an environment containing
the solution's seven tables. There is no sandbox — this runs against real Dataverse data.

```bash
npm install
```

```bash
npm run dev
```

```bash
pac code run -a http://localhost:5173
```

Then open the `apps.powerapps.com/play/e/<env>/app/local?...` URL that `pac code run` prints.

### Other scripts

| Command | Does |
|---|---|
| `npm run check` | Typecheck, bundle smoke test, lint, and Tailwind build, concurrently |
| `npm run check:drift` | Validates the data layer against live Dataverse metadata |
| `npm run build` | Typecheck then Vite production build |

---

## Notes

The app started in **Power Apps Vibe** and was moved out for more control over the
implementation. Vibe-created apps are locked to the Vibe authoring experience — `pac code
push` against one fails with `AppSubtypeImmutable` — so the app was recreated outside Vibe.
Nothing regenerates `app-gen-sdk/` or `src/generated/` any more, which is why
`check:drift` exists.

`@microsoft/power-apps` is pinned at `0.5.2`. The `pac code` command group is being replaced
by an npm CLI that needs SDK 1.0.4 or higher, so adopting it means a major upgrade against
the vendored SDK.

In the public mirror, `power.config.json` carries placeholders (`<ENVIRONMENT_ID>`,
`<CODE_APP_ID>`) where environment-specific identifiers belong.
