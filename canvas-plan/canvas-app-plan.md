# Canvas App Plan — Career Quick Capture (EDIT)

Mode: **EDIT**
App YAML directory (only `.pa.yaml` allowed here):
`C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas`
Plan artifact directory (all `.md` here):
`C:\Development\CareerDevelopmentHub\canvas-plan`

Shared plan: `C:\Development\CareerDevelopmentHub\canvas-plan\canvas-app-shared.md`
App file: **unchanged** — `App.pa.yaml` is orchestrator-owned and already carries every
global this edit needs.

Schema source of truth: `C:\Development\CareerDevelopmentHub\canvas-plan\REQUIREMENTS.md`.

The workspace currently compiles with 0 errors and 2 known delegation warnings. The files
have been round-tripped through Studio, so they are Studio-normalized: default-valued
properties are omitted and keys are alphabetized. **Read the current file before editing;
do not assume the originally generated formatting.**

---

## 1. Requirements (this edit)

Three changes, each confined to one screen file.

- **EDIT 1 — ScrContact.** Replace both lookup pickers with searchable comboboxes that
  support inline create. No dedicated "create" button anywhere.
- **EDIT 2 — ScrInteraction.** Bidirectional company cross-filtering between the contact
  picker and the application picker, routed through a global so no circular reference is
  created. Accept prefill from a completed follow-up.
- **EDIT 3 — Screen1.** Replace the immediate complete action with a modal confirmation
  dialog offering "Complete + log", "Complete" and "Cancel".

`ScrFollowUp.pa.yaml` and `ScrSaved.pa.yaml` are **not** in scope and must not be touched.

---

## 2. Discovery Summary (delta only)

### Verified Power Fx facts carried into this edit

| Fact | Consequence |
|---|---|
| A combobox's `Items` **may** reference its own `SearchText` | The inline-create option table is legal; this is not a circular reference. |
| `cmbA.Items` referencing `cmbB.Selected` while `cmbB.Items` references `cmbA.Selected` is a **hard error** ("This rule creates a circular reference between properties") | ScrInteraction cross-filtering must route through `varIntxCompanyId`; behaviour properties (`OnChange`) do not join the dependency graph. |
| `ItemDisplayText` has **no** implicit row scope | Always write `ThisItem.<col>`. |
| `IsBlank()` is rejected inside `ItemDisplayText` | Use `Len(...) > 0`, or a boolean column such as `ThisItem.IsNew`. |
| `Gallery` does not support `Radius*` properties | Unchanged from the original build. |
| `App.Formulas` (named formulas) unavailable | Every colour stays a literal `RGBA(...)`. |
| `GroupContainer` has **no** `OnSelect` input property (confirmed via `describe_control`) | The modal scrim is a `ModernText` (which *does* have `OnSelect` and `Fill`), not a container. |
| A `GroupContainer` with `Variant: AutoLayout` lays children out in flow and ignores child `X`/`Y` | An overlay cannot live inside `conHomeRoot`. It is a second, `ManualLayout` screen-level child placed after `conHomeRoot`. |

### Controls receiving a property/enum they do not already carry

`describe_control` was re-run for every one of these; the property lists and enum names are
reproduced in the briefs that need them.

| Control | New surface used by this edit |
|---|---|
| `ModernCombobox` | `IsSearchable`, `AllowExternalSelectedItems`, `OnChange`, `SearchText` (output) |
| `ModernText` | `OnSelect`, `Fill` (scrim); `Wrap: =true` (dialog body) |
| `GroupContainer` | `Variant: ManualLayout` (overlay host), child `X`/`Y` |
| `ModernTextInput` | `Default` (interaction-name prefill) |
| `ModernButton` | no new surface |

### Column names — logical vs display

Studio normalized **ScrInteraction** to display names (`Contact`, `'Interaction Date'`,
`'Contact Name'`, `Role`, `Company.'Company Name'`) and left **ScrContact** and **Screen1**
on logical names (`cws_companyname`, `cws_followupid`). Both forms compile. Rule for this
edit: **inside a file, match the spelling already in that file.** Each brief states which
form to use. The verified mapping for every column touched:

| Table | Logical | Display |
|---|---|---|
| Companies | `cws_companyid` / `cws_companyname` | `Company` / `'Company Name'` |
| Business Groups | `cws_businessgroupid` / `cws_businessgroupname` / `cws_Company` | `'Business Group'` / `'Business Group Name'` / `Company` |
| Networking Contacts | `cws_networkingcontactid` / `cws_contactname` / `cws_Company` | `'Networking Contact'` / `'Contact Name'` / `Company` |
| Job Applications | `cws_jobapplicationid` / `cws_role` / `cws_Company` | `'Job Application'` / `Role` / `Company` |
| Follow Ups | `cws_followupid` / `cws_title` / `cws_status` / `cws_completeddate` / `cws_relatedtype` / `cws_RelatedContact` / `cws_RelatedApplication` | `'Follow Up'` / `Title` / `'Status (cws_status)'` / `'Completed Date'` / `'Related Type'` / `'Related Contact'` / `'Related Application'` |

---

## 3. Requirement Coverage

| # | Requirement | Screen | Visible affordance | Notes |
|---|---|---|---|---|
| E1.1 | Company picker is a searchable combobox | ScrContact | `cmbContCompany`, `IsSearchable: =true`, `SelectMultiple: =false` | Replaces `inpContCompanySearch` |
| E1.2 | Remove the old company search UI | ScrContact | `inpContCompanySearch`, `galContCompanyResults`, `btnContCompanyOption`, `btnContCreateCompany` **deleted** | No orphaned labels remain; `txtContCompanyLabel` is retained and still used |
| E1.3 | No dedicated create button anywhere | ScrContact | No control whose sole purpose is create; creation happens in `cmbContCompany.OnChange` / `cmbContGroup.OnChange` | |
| E1.4 | Inline create for company, never leaving the form | ScrContact | `cmbContCompany.Items` appends a synthetic row; `ItemDisplayText` renders `Create "Northrop Grumman"` | `OnChange` Patches `Companies` and sets `varContCompany` |
| E1.5 | One consistent record schema across real and synthetic rows | ScrContact | Explicit `ForAll` projection to `{ OptId, OptName, IsNew }`, combined with `Ungroup(Table({t: ...}, {t: ...}), "t")` | Exact formula in the brief |
| E1.6 | Business Group gains the same inline create | ScrContact | `cmbContGroup` — same projection, same synthetic row | Creates with `cws_Company: varContCompany` |
| E1.7 | Business Group stays filtered to the selected company | ScrContact | `Filter('Business Groups', cws_Company.cws_companyid = varContCompany.cws_companyid, StartsWith(...))` | |
| E1.8 | Business Group keeps its disabled state and hint | ScrContact | `cmbContGroup.DisplayMode` unchanged; `txtContGroupHint` still reads "Enter a company first" | |
| E2.1 | Application selected -> contact picker shows only that company's contacts | ScrInteraction | `cmbIntxContact.Items` reads `varIntxCompanyId` | |
| E2.2 | Contact selected -> application picker shows only that company's applications | ScrInteraction | `cmbIntxApp.Items` reads `varIntxCompanyId` | |
| E2.3 | Neither filters when nothing is selected | ScrInteraction | `If(Len(varIntxCompanyId) = 0, <all>, <filtered>)` | `GUID()` is only reached on the non-empty branch |
| E2.4 | No circular reference | ScrInteraction | Both `Items` read the global; both `OnChange` write it. No `.Selected` cross-reference exists in any `Items`. | |
| E2.5 | No stale company filter between visits | ScrInteraction | `OnVisible` recomputes `varIntxCompanyId` from the prefill vars; `OnHidden` clears it | |
| E2.6 | Prefill from a completed follow-up | ScrInteraction | `cmbIntxApp.DefaultSelectedItems` reads `varPrefillAppId`; `cmbIntxContact.DefaultSelectedItems` still reads `varPrefillContactId` | Prefill vars cleared in `OnHidden`, never `OnVisible` |
| E2.7 | `varPrefillIntxName` prefills the interaction name field | ScrInteraction | **new** `inpIntxName` with `Default: =varPrefillIntxName` | See approximation A4 |
| E3.1 | Tapping the row check no longer completes anything | Screen1 | `btnHomeRowComplete.OnSelect` and `txtHomeRowTitle.OnSelect` only capture and open the dialog | |
| E3.2 | Modal dialog "Log an interaction?" | Screen1 | `conHomeOverlay` (ManualLayout) -> `txtHomeScrim` + `conHomeDialog`; `txtHomeDlgTitle.Text = "Log an interaction?"` | Gated on `varShowLogPrompt` |
| E3.3 | "Complete + log" primary, full width, on top | Screen1 | `btnHomeDlgCompleteLog`, `Appearance: =ButtonAppearance.Primary`, blue | Completes, prefills, navigates |
| E3.4 | "Complete" on the LEFT | Screen1 | `btnHomeDlgComplete`, first child of `conHomeDlgRow` (horizontal), secondary beige | Completes, dismisses, no navigation |
| E3.5 | "Cancel" on the RIGHT, visually different, low-emphasis | Screen1 | `btnHomeDlgCancel`, second child of `conHomeDlgRow`, `Appearance: =ButtonAppearance.Outline`, border + text in border/mutedFg — not destructive red | Dismisses only |
| E3.6 | Tapping the scrim behaves exactly like Cancel | Screen1 | `txtHomeScrim.OnSelect` is byte-identical to `btnHomeDlgCancel.OnSelect` | |
| E3.7 | The follow-up stays Open on Cancel and scrim-dismiss | Screen1 | Neither cancel path contains a `Patch` | |
| E3.8 | Overlay is the last screen-level child and renders above everything | Screen1 | Screen `Children:` becomes `[conHomeRoot, conHomeOverlay]`; `conHomeRoot` still contains every non-overlay control | See approximation A5 |
| E3.9 | Prefill mapping: Contact / Application / None per relatedtype | Screen1 | Captured at tap into `varPromptContactId` / `varPromptAppId`; Application prefills the app and leaves the contact **empty** | |
| E3.10 | `varIntxCompanyId` set from the prefilled record's company | Screen1 | Computed in `btnHomeDlgCompleteLog.OnSelect`, and independently recomputed by `ScrInteraction.OnVisible` | Both compute the same value |
| E3.11 | `varPrefillIntxName` carries the follow-up's title | Screen1 | `Set(varPrefillIntxName, varPromptTitle)` | |
| E3.12 | Home list refreshes the existing way | Screen1 | `RemoveIf(colHomeDue, ...)` + `RemoveIf(colHomeOpen, ...)`, identical to the code being replaced | |

### Recorded approximations

- **A4 — the interaction name field did not exist.** `varPrefillIntxName` is specified to
  "prefill the interaction name field", but ScrInteraction had no such field: the name was
  synthesised in the save `Patch`. A visible optional **"Interaction name"** input
  (`inpIntxName`) is added, with `Default: =varPrefillIntxName`. The save `Patch` uses the
  typed value when non-empty and otherwise falls back to the previous synthesised string,
  so existing behaviour is unchanged when the field is left alone.
- **A5 — the single-root rule is relaxed by exactly one sibling on Screen1.** The shared
  plan's skeleton says a screen's `Children:` holds exactly one root. A modal overlay
  cannot be a child of an AutoLayout container, because AutoLayout lays children out in
  flow and ignores their `X`/`Y`. Screen1 therefore gets a second screen-level child,
  `conHomeOverlay` (`Variant: ManualLayout`, full-bleed, `Visible: =varShowLogPrompt`),
  placed **after** `conHomeRoot`. `conHomeRoot` keeps every other control, so the existing
  containment structure is otherwise untouched. This exception applies to Screen1 only.
- **A6 — the selected-company chip is retained, and a matching one is added for the group.**
  A combobox re-evaluates `Items` after every selection and after the inline `Patch`; the
  just-created record has a new id and the synthetic row disappears, so the combobox's own
  display of the selection is not stable. `conContCompanyChosen` (which already exists) is
  kept as the settled-state display and `cmbContCompany` is shown only while
  `varContCompany` is blank — exactly the visibility swap `inpContCompanySearch` already
  used. `conContGroupChosen` is added as the symmetric chip for the group. This is not a
  second picker: only one control is interactive at a time, and there is still no create
  button.

---

## 4. Screen Sizing

| Screen | Controls before | Controls after | Delta |
|---|---|---|---|
| Screen1 | 20 | 27 | +7 overlay controls |
| ScrContact | 38 | 37 | -4 removed, +3 group chip |
| ScrInteraction | 20 | 22 | +2 name field |

All well inside the ~40-control budget. No screen splits.

---

## 5. Dispatch Table

| Action | Screen | Target File | YAML Key | Name Prefix | Screen Brief |
|--------|--------|-------------|----------|-------------|--------------|
| Modify | Home | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\Screen1.pa.yaml` | `Screen1` | `Home` | `C:\Development\CareerDevelopmentHub\canvas-plan\Screen1.screen-plan.md` |
| Modify | New Contact | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrContact.pa.yaml` | `ScrContact` | `Cont` | `C:\Development\CareerDevelopmentHub\canvas-plan\ScrContact.screen-plan.md` |
| Modify | Log Interaction | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrInteraction.pa.yaml` | `ScrInteraction` | `Intx` | `C:\Development\CareerDevelopmentHub\canvas-plan\ScrInteraction.screen-plan.md` |

One wave of three. No two rows share a target file or a name prefix. Every new control
carries its screen's prefix immediately after the control-type abbreviation.

`Screen1` must **not** be renamed — the user will do that in Studio.

---

## 6. App Changes

### Before builders — **ALREADY APPLIED by the orchestrator. No builder re-adds these.**

`App.pa.yaml` already reads:

```yaml
App:
  Properties:
    OnStart: |
      =Set(varReturnTo, "");
      Set(varPrefillContactId, "");
      Set(varSavedKind, "");
      Set(varSavedTitle, "");
      Set(varSavedContactId, "");
      Set(varSavedContactName, "");
      Set(varIntxCompanyId, "");
      Set(varPrefillAppId, "");
      Set(varPrefillIntxName, "");
      Set(varPromptFollowUpId, "");
      Set(varPromptContactId, "");
      Set(varShowLogPrompt, false)
    StartScreen: =Screen1
    Theme: =PowerAppsTheme
```

`varIntxCompanyId`, `varPrefillAppId`, `varPrefillIntxName`, `varPromptFollowUpId`,
`varPromptContactId` are Text `""`; `varShowLogPrompt` is `false`. Builders **read and
write** these; they do not declare them.

### After builders

None. `StartScreen` is already `Screen1` and no screen is added or removed.

### Screen-originated globals (not in `OnStart`, created by `Set` on their owning screen)

These follow the existing precedent of `varContCompany` and `varContNewRec`. They are
**not** an App change and no builder should attempt to add them to `App.pa.yaml`.

| Variable | Type | Owner | Purpose |
|---|---|---|---|
| `varContCompany` | Companies record | ScrContact | existing — selected/created company |
| `varContNewRec` | Networking Contacts record | ScrContact | existing — the contact just saved |
| `varContGroup` | Business Groups record | ScrContact | **new** — selected/created business group |
| `varPromptAppId` | Text | Screen1 | **new** — related application id of the tapped follow-up |
| `varPromptTitle` | Text | Screen1 | **new** — `cws_title` of the tapped follow-up |
