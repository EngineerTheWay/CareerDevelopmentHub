# Shared Plan — Career Quick Capture

> **Design snapshot — 2026-08-18.** This is a plan written *before* the canvas app was built,
> kept as a record of intent. It is not maintained against the shipped implementation and
> may describe fields or behaviour that changed during the build. For what actually
> exists, read the code.

Read this together with your screen brief. Everything here applies to **every** screen and
must not be re-derived, re-styled or re-invented per screen.

---

## 0. Read this first — the files are Studio-normalized

The app has been round-tripped through Power Apps Studio. Every `.pa.yaml` in the working
directory has had its default-valued properties dropped and its property keys alphabetized.

- **Read the current file before you edit it.** Do not reconstruct it from this plan.
- Keep the alphabetical key order when you insert a property, and keep the existing
  block-scalar style (`|-`) for multi-statement formulas.
- Touch only the controls your brief names. Leave every other property byte-identical.

### Column spelling — match the file you are in

Studio rewrote some files to Dataverse **display** names and left others on **logical**
names. Both compile. The rule is: **inside a file, use the spelling already in that file.**

| Table | Logical | Display |
|---|---|---|
| Companies | `cws_companyid` / `cws_companyname` | `Company` / `'Company Name'` |
| Business Groups | `cws_businessgroupid` / `cws_businessgroupname` / `cws_Company` | `'Business Group'` / `'Business Group Name'` / `Company` |
| Networking Contacts | `cws_networkingcontactid` / `cws_contactname` / `cws_Company` | `'Networking Contact'` / `'Contact Name'` / `Company` |
| Job Applications | `cws_jobapplicationid` / `cws_role` / `cws_Company` | `'Job Application'` / `Role` / `Company` |
| Follow Ups | `cws_followupid` / `cws_title` / `cws_status` / `cws_completeddate` / `cws_relatedtype` / `cws_RelatedContact` / `cws_RelatedApplication` | `'Follow Up'` / `Title` / `'Status (cws_status)'` / `'Completed Date'` / `'Related Type'` / `'Related Contact'` / `'Related Application'` |

Screen1 and ScrContact are on **logical** names. ScrInteraction is mixed — its `Patch` and
`ItemDisplayText` use display names; new formulas there are specified explicitly in that
brief.

### Drop shadows

The user removed drop shadows from every beige-on-beige surface. Every field-wrapper
`GroupContainer` filled `RGBA(252, 246, 233, 1)` carries `DropShadow: =DropShadow.None`.
**Any new beige-on-beige container must do the same.** White-on-beige surfaces (gallery
rows, the footer, the dialog card) keep their default shadow — do not add
`DropShadow: =DropShadow.None` to those.

---

## 1. Palette — copy these literals verbatim

Named formulas are **not available** in this authoring session (see the plan index). There
is no `clrPrimary` token. Write the literal `RGBA(...)` at every point of use.

| Token (documentation only) | Literal to type | Used for |
|---|---|---|
| background | `RGBA(252, 246, 233, 1)` | screen `Fill`, root container `Fill` |
| foreground | `RGBA(8, 19, 28, 1)` | body text, field values, headings |
| card | `RGBA(255, 255, 255, 1)` | field surfaces, footer bar, gallery rows |
| primary | `RGBA(0, 72, 126, 1)` | top bar fill, primary button fill |
| primaryFg | `RGBA(252, 248, 240, 1)` | **text/icons on primary** |
| secondary | `RGBA(232, 221, 196, 1)` | secondary button fill |
| muted | `RGBA(239, 231, 215, 1)` | disabled / inert surfaces |
| mutedFg | `RGBA(45, 63, 78, 1)` | field labels, hints, secondary text **on background or card** |
| accent | `RGBA(213, 141, 37, 1)` | success check icon, "Today" emphasis |
| destructive | `RGBA(176, 10, 29, 1)` | "Overdue" emphasis, validation text |
| border | `RGBA(211, 201, 185, 1)` | container `BorderColor` |

### Foreground rules — no dark-on-dark, no light-on-light

- Anything sitting on `RGBA(0, 72, 126, 1)` (primary) uses `RGBA(252, 248, 240, 1)`.
- Anything sitting on `RGBA(252, 246, 233, 1)` (background) or `RGBA(255, 255, 255, 1)`
  (card) uses `RGBA(8, 19, 28, 1)` for primary text and `RGBA(45, 63, 78, 1)` for labels
  and hints.
- `ModernButton` with `Appearance: =ButtonAppearance.Primary` sets
  `BasePaletteColor: =RGBA(0, 72, 126, 1)` and `Color: =RGBA(252, 248, 240, 1)`.
- `ModernButton` with `Appearance: =ButtonAppearance.Secondary` sets
  `BasePaletteColor: =RGBA(232, 221, 196, 1)` and `Color: =RGBA(8, 19, 28, 1)`.

---

## 2. Typography

| Role | Control | Size | FontWeight | Color |
|---|---|---|---|---|
| Top-bar title / wordmark | `ModernText` | `=18` | `=FontWeight.Semibold` | `=RGBA(252, 248, 240, 1)` |
| Section heading | `ModernText` | `=16` | `=FontWeight.Semibold` | `=RGBA(8, 19, 28, 1)` |
| Field label | `ModernText` | `=12` | `=FontWeight.Semibold` | `=RGBA(45, 63, 78, 1)` |
| Field hint / helper | `ModernText` | `=11` | `=FontWeight.Normal` | `=RGBA(45, 63, 78, 1)` |
| Body / row title | `ModernText` | `=15` | `=FontWeight.Semibold` | `=RGBA(8, 19, 28, 1)` |
| Row secondary line | `ModernText` | `=12` | `=FontWeight.Normal` | `=RGBA(45, 63, 78, 1)` |
| Tile button | `ModernButton` | `=17` | `=FontWeight.Semibold` | per Appearance rule above |
| Save button | `ModernButton` | `=16` | `=FontWeight.Semibold` | `=RGBA(252, 248, 240, 1)` |

`Font: =Font.'Segoe UI'` on every text-bearing control. Corner radius is **12** on every
container, input and button: set all four of `RadiusTopLeft`, `RadiusTopRight`,
`RadiusBottomLeft`, `RadiusBottomRight` to `=12`. `GroupContainer` uses the same four
names.

---

## 3. Layout strategy

This is a **phone** app. Every screen is a single column. There is no multi-column
desktop composition to degrade, so there is no `LayoutWrap` and no `LayoutDirection`
breakpoint anywhere in this app. All widths derive from `Parent.Width`; **no layout
variable is initialised in `OnVisible`** and `varIsMobile` / `varColumns` do not exist.

### The four-part screen skeleton (every screen)

The screen's `Children:` list holds **exactly one** control: `con<Prefix>Root`.

```
con<Prefix>Root        GroupContainer, Variant: AutoLayout
  LayoutDirection:  =LayoutDirection.Vertical
  LayoutAlignItems: =LayoutAlignItems.Stretch
  LayoutOverflowY:  =LayoutOverflow.Hide      <- root does NOT scroll; body does
  LayoutGap:        =0
  Width:  =Parent.Width
  Height: =Parent.Height
  X: =0   Y: =0
  Fill:   =RGBA(252, 246, 233, 1)
  |
  +-- con<Prefix>TopBar    fixed 56px, see the Top Bar pattern below
  +-- con<Prefix>Body      the scrolling region:
  |     LayoutDirection:  =LayoutDirection.Vertical
  |     LayoutAlignItems: =LayoutAlignItems.Stretch
  |     LayoutOverflowY:  =LayoutOverflow.Scroll
  |     LayoutGap:        =16
  |     FillPortions:     =1
  |     PaddingLeft/Right/Top/Bottom: =16
  |     Fill: =RGBA(252, 246, 233, 1)
  +-- con<Prefix>Footer    fixed, only on the three form screens and ScrSaved
        LayoutDirection:  =LayoutDirection.Vertical
        LayoutAlignItems: =LayoutAlignItems.Stretch
        Height: =76   LayoutMinHeight: =76
        PaddingLeft/Right: =16   PaddingTop/Bottom: =12
        Fill: =RGBA(255, 255, 255, 1)
        BorderStyle: =BorderStyle.Solid  BorderThickness: =1
        BorderColor: =RGBA(211, 201, 185, 1)
```

Pinning the top bar and the save footer outside the scrolling body is what makes the app
one-handed: the primary action is always under the thumb.

### AutoLayout heights are explicit

`GroupContainer` AutoLayout does **not** auto-size to its content. Every child of a
vertical AutoLayout container needs an explicit `Height`. Use the field-group budget
below; do not leave a container's `Height` at its default.

A child whose `Visible` is `=false` collapses out of the AutoLayout flow, so conditional
sections do not leave a hole.

### Vertical containers holding text

Every vertical AutoLayout container that holds a `ModernText` sets
`LayoutAlignItems: =LayoutAlignItems.Stretch`. With `Start`, `Center` or `End` the text is
sized to its intrinsic width and silently clipped.

---

## 4. Top bar pattern

This block appears on all five screens. It is a **pattern**, not a shared block of
control names: each screen instantiates it under its own prefix (`conHomeTopBar`,
`conContTopBar`, `conIntxTopBar`, `conFlwTopBar`, `conSvdTopBar`). Never write a bare
`TopBar` or `btnBack`.

The **values** below are fixed and identical on every screen. Copy them exactly; do not
substitute your own spacing, colours or strings.

```
con<Prefix>TopBar    GroupContainer, Variant: AutoLayout
  LayoutDirection:  =LayoutDirection.Horizontal
  LayoutAlignItems: =LayoutAlignItems.Center
  LayoutJustifyContent: =LayoutJustifyContent.Start
  LayoutGap: =8
  Height: =56    LayoutMinHeight: =56
  PaddingLeft: =6   PaddingRight: =16
  Fill: =RGBA(0, 72, 126, 1)
  RadiusTopLeft/TopRight/BottomLeft/BottomRight: =0

  ico<Prefix>Back    ModernIcon           (omitted on Screen1 and ScrSaved)
    Icon: ="ChevronLeft"
    IconStyle: =IconStyle.Filled          # enum IconStyle: Filled, Outline (only these two)
    IconColor: =RGBA(252, 248, 240, 1)
    Width: =44   Height: =44   LayoutMinWidth: =44
    AccessibleLabel: ="Back"

  txt<Prefix>Title   ModernText
    Font: =Font.'Segoe UI'   Size: =18   FontWeight: =FontWeight.Semibold
    Color: =RGBA(252, 248, 240, 1)
    VerticalAlign: =VerticalAlign.Middle
    Wrap: =false
    Height: =44
    FillPortions: =1
    AlignInContainer: =AlignInContainer.Stretch
```

Exact title strings — do not paraphrase:

| Screen | `txt<Prefix>Title.Text` |
|---|---|
| Screen1 | `="Career Quick Capture"` |
| ScrContact | `="New contact"` |
| ScrInteraction | `="Log interaction"` |
| ScrFollowUp | `="New follow-up"` |
| ScrSaved | `="Saved"` |

Screen1 and ScrSaved have **no** back chevron. Screen1 places `icoHomeRefresh`
(`Icon: ="ArrowClockwise"`, same 44x44 sizing, `LayoutMinWidth: =44`) at the end of the
bar with `AlignInContainer: =AlignInContainer.End`.

---

## 5. Field group pattern

Every labelled input on the three form screens is one `GroupContainer`:

```
con<Prefix>Fld<Field>   GroupContainer, Variant: AutoLayout
  LayoutDirection:  =LayoutDirection.Vertical
  LayoutAlignItems: =LayoutAlignItems.Stretch
  LayoutGap: =6
  Fill: =RGBA(252, 246, 233, 1)
  Height: <from the budget table below>

  txt<Prefix><Field>Label   ModernText   Height: =18
      Size: =12  FontWeight: =FontWeight.Semibold  Color: =RGBA(45, 63, 78, 1)
      Wrap: =false
  <the input>               Height: =48
  [txt<Prefix><Field>Hint]  ModernText   Height: =18   Size: =11
      Color: =RGBA(45, 63, 78, 1)   Wrap: =false
```

### Height budget

| Composition | Arithmetic | `Height` |
|---|---|---|
| label + input | 18 + 6 + 48 | `=72` |
| label + input + hint | 18 + 6 + 48 + 6 + 18 | `=96` |
| label + multiline notes (96) | 18 + 6 + 96 | `=120` |
| company block (ScrContact) | computed — see that brief | dynamic |

Labels end with an asterisk when the field is required: `="Contact name *"`. Optional
fields carry no marker.

### Input styling (identical on every `ModernTextInput`, `ModernDropdown`, `ModernCombobox`, `ModernDatePicker`)

```
Appearance: =Appearance.Outline
Fill: =RGBA(255, 255, 255, 1)
Color: =RGBA(8, 19, 28, 1)
BorderColor: =RGBA(211, 201, 185, 1)
Font: =Font.'Segoe UI'
Size: =15
Height: =48
RadiusTopLeft/TopRight/BottomLeft/BottomRight: =12
```

`ModernTextInput` and `ModernDatePicker` use enum `Appearance` with values
`FilledDarker, FilledLighter, Outline`. `ModernDropdown` and `ModernCombobox` use the
same enum name `Appearance`. `ModernButton` uses a **different** enum,
`ButtonAppearance` (`Outline, Primary, Secondary, Subtle, Transparent`), and `Badge` uses
`BadgeCanvas.Appearance` (`Filled, Ghost, Outline, Tint`). Do not transfer one for
another.

---

## 6. Save button and required-field gating

Every form screen's footer holds exactly one save button:

```
btn<Prefix>Save   ModernButton
  Text: ="Save <thing>"
  Appearance: =ButtonAppearance.Primary
  BasePaletteColor: =RGBA(0, 72, 126, 1)
  Color: =RGBA(252, 248, 240, 1)
  Layout: =ButtonLayout.TextOnly
  Font: =Font.'Segoe UI'  Size: =16  FontWeight: =FontWeight.Semibold
  Height: =52
  RadiusTopLeft/TopRight/BottomLeft/BottomRight: =12
  DisplayMode: <see below>
```

**Gating rule.** `DisplayMode` is derived **directly from the current input values**. Do
not create a validity flag, do not clear anything in an input's `OnChange`, and do not
maintain a "submitted" variable. Each brief gives the exact expression for its screen; it
always has this shape:

```
=If( <all required inputs currently populated>, DisplayMode.Edit, DisplayMode.Disabled )
```

Emptiness tests to use, and why:

| Control | Test |
|---|---|
| `ModernTextInput` | `Len(Trim(inpX.Text)) > 0` |
| `ModernDatePicker` | `!IsBlank(dpX.SelectedDate)` |
| `ModernDropdown` | `!IsBlank(ddX.Selected.Label)` — the inline option tables all carry a `Label` column, so this is a plain text test |
| `ModernCombobox` | `CountRows(cmbX.SelectedItems) > 0` — more reliable than `IsBlank` on a record |
| record variable | `!IsBlank(varX)` |

---

## 7. Choice pickers — explicit inline option tables

Do **not** use `Choices(...)`. Every choice field uses a `ModernDropdown` whose `Items`
is a literal two-column table (`Label` text, `Val` option-set value). This pins the label
text, pins the order, and makes the option-set literal explicit at the point of use.

```
Items: =Table(
  { Label: "New",  Val: 'Relationship (Networking Contacts)'.New },
  ...
)
ItemDisplayText: =Label
```

`ModernDropdown.Selected` then returns that record, so:

- the display value is `ddX.Selected.Label`
- the value written to Dataverse is `ddX.Selected.Val`

The three literal tables are reproduced in full in the briefs that need them.

### Members that must be quoted

`'Hiring Manager'`, `'Networking Chat'`, `'None/Standalone'` contain a space or a slash
and must be single-quoted after the dot. An unquoted `'Related Type (Follow Ups)'.None/Standalone`
fails with a diagnostic that never mentions enums.

### `cws_status` vs `statecode`

`cws_status` uses the option set `'Status (Follow Ups)'` with members `Open` and
`Completed`. `statecode` uses `'Status (Follow Ups)_1'` with `Active` / `Inactive`.
`'Status (Follow Ups)'.Active` does not exist. This app never reads or writes `statecode`.

---

## 8. Cross-screen state contract

Twelve globals are initialised in `App.OnStart` — eleven Text (`""`) and one Boolean
(`false`). They are Text, not records, deliberately: a record variable that `OnStart`
initialises to `Blank()` gets a conflicting inferred type later.

**`App.pa.yaml` is orchestrator-owned and already contains all twelve. No builder adds,
removes or edits an `OnStart` declaration.**

| Variable | Type | Meaning | Written by | Read by |
|---|---|---|---|---|
| `varReturnTo` | Text | `""` = normal flow; `"Interaction"` = ScrContact was opened from ScrInteraction's "+ New contact" | ScrInteraction, ScrContact, Screen1 | ScrContact |
| `varPrefillContactId` | Text | GUID (as text) of the contact to preselect on ScrInteraction / ScrFollowUp; `""` = none | Screen1, ScrContact, ScrInteraction, ScrFollowUp, ScrSaved | ScrInteraction, ScrFollowUp |
| `varPrefillAppId` | Text | GUID (as text) of the job application to preselect on ScrInteraction; `""` = none | Screen1 | ScrInteraction |
| `varPrefillIntxName` | Text | text to prefill `inpIntxName` with; `""` = none | Screen1 | ScrInteraction |
| `varIntxCompanyId` | Text | GUID (as text) of the company that ScrInteraction's two pickers are cross-filtered to; `""` = no filter | Screen1, ScrInteraction | ScrInteraction |
| `varPromptFollowUpId` | Text | GUID (as text) of the follow-up the confirmation dialog is about; `""` = dialog idle | Screen1 | Screen1 |
| `varPromptContactId` | Text | related contact GUID (as text) of that follow-up; `""` if the follow-up is not Contact-typed | Screen1 | Screen1 |
| `varShowLogPrompt` | Boolean | `true` while the Screen1 confirmation dialog is open | Screen1 | Screen1 |
| `varSavedKind` | Text | `"Contact"` / `"Interaction"` / `"FollowUp"` | the three form screens | ScrSaved |
| `varSavedTitle` | Text | human-readable description of the record just saved | the three form screens | ScrSaved |
| `varSavedContactId` | Text | GUID (as text) of the contact the saved record relates to; `""` if none | the three form screens | ScrSaved |
| `varSavedContactName` | Text | that contact's `cws_contactname`; `""` if none | the three form screens | ScrSaved |

### Screen-originated globals — created by `Set`, never declared in `OnStart`

| Variable | Type | Owner | Meaning |
|---|---|---|---|
| `varContCompany` | Companies record | ScrContact | selected or just-created company |
| `varContGroup` | Business Groups record | ScrContact | selected or just-created business group |
| `varContNewRec` | Networking Contacts record | ScrContact | the contact just saved |
| `varPromptAppId` | Text | Screen1 | related application GUID (as text) of the tapped follow-up; `""` if not Application-typed |
| `varPromptTitle` | Text | Screen1 | `cws_title` of the tapped follow-up |

Record-typed screen globals infer their type from the record assigned to them; clearing
one with `Set(varContGroup, Blank())` is fine. The two new Text globals are always assigned
a Text value (`Text(...)` or a string literal), never `Blank()`, so they stay Text.

### Guarding `GUID()`

`GUID("")` is an error. Every call must sit on a branch that has already proved the string
is non-empty:

```
If( Len(varPrefillAppId) > 0, Filter('Job Applications', cws_jobapplicationid = GUID(varPrefillAppId)) )
If( Len(varIntxCompanyId) = 0, <unfiltered>, Filter(<t>, cws_Company.cws_companyid = GUID(varIntxCompanyId)) )
```

Use `Len(varX) > 0` / `Len(varX) = 0`, not `IsBlank`, for these Text globals — it is the
convention already used across the app and it also holds inside `ItemDisplayText`, where
`IsBlank()` is rejected outright.

### Navigation graph

```
Screen1 --tile--> ScrContact | ScrInteraction | ScrFollowUp
ScrInteraction --"+ New contact"--> ScrContact --save--> ScrInteraction (contact preselected)
ScrContact | ScrInteraction | ScrFollowUp --save--> ScrSaved
ScrSaved --next step--> ScrInteraction | ScrFollowUp | ScrContact
ScrSaved --"Done"--> Screen1
any form --back chevron--> Screen1   (or ScrInteraction, when varReturnTo = "Interaction")
```

### Transitions — use these exactly

| Direction | Transition |
|---|---|
| Home -> a form, or a form -> a deeper form | `ScreenTransition.CoverRight` |
| back chevron, or returning to the screen you came from | `ScreenTransition.UnCoverRight` |
| form -> ScrSaved, and ScrSaved -> anywhere | `ScreenTransition.Fade` |

### Prefill lifetime

`varPrefillContactId` is cleared by the screen that consumed it, in that screen's
`OnHidden` — **never** in `OnVisible`. `OnVisible` and control initialisation are not
ordered, so clearing it in `OnVisible` can wipe the value before
`DefaultSelectedItems` reads it.

Every navigation that must **not** prefill sets `Set(varPrefillContactId, "")` explicitly
before `Navigate`. Screen1's "Log interaction" and "New follow-up" tiles both do this.

`Navigate` resets the target screen's controls, so `DefaultSelectedItems` and
`DefaultDate` re-evaluate on every arrival. That is what makes the prefill work.

---

## 9. The date trap — read before touching `cws_duedate`

`cws_duedate` and `cws_completeddate` are **Date-only + User-Local**. OData equality
filtering on them is known-broken in this org. Never write
`Filter('Follow Ups', cws_duedate = Today())` or any server-side comparison on those
columns.

The only sanctioned pattern, used on Screen1:

1. Query the server by `cws_status` **alone** — that is a delegable choice filter — and
   land the rows in a collection.
2. Bucket the **in-memory collection** on an explicit local date key.

The local date key is built with `Date(Year(x), Month(x), Day(x))`, never with
`Text(x, "yyyy-mm-dd")`. The custom format string is ambiguous between month and minute;
`Date(Year/Month/Day)` is not, and it lands on local midnight.

Always guard for a blank due date first: `Year(Blank())` yields 0, which would sort a
blank-dated follow-up into "Overdue".

```
!IsBlank(cws_duedate) && Date(Year(cws_duedate), Month(cws_duedate), Day(cws_duedate)) <= Today()
```

Do not filter on `cws_notes` anywhere: it is a multiline String and `Filter`/`StartsWith`
on it is not delegable. Company and contact name searches use `StartsWith`, which is.

---

## 10. Lookup writes

Dataverse lookups are `DataEntity` columns. `Patch` them with a **whole record**, never a
GUID.

```
cws_Company:      varContCompany                      // a Companies record
cws_Contact:      cmbIntxContact.Selected             // a Networking Contacts record
cws_RelatedContact: If(<cond>, cmbFlwContact.Selected) // two-arg If; blank when false
```

The two-argument `If` is deliberate on ScrFollowUp: with the condition false it yields
blank, which clears the lookup. Do not try to vary the shape of the `Patch` change record
between branches — differently-shaped records will not unify.

---

## 11. YAML conventions

- One screen per file. Top-level key is `Screens:`, then the screen's YAML key.
- Every property value is a Power Fx expression and starts with `=`.
- Multi-statement behaviour formulas use a YAML block scalar and put the `=` on the first
  line only:

  ```yaml
  OnSelect: |
    =Set(varReturnTo, "");
    Navigate(ScrContact, ScreenTransition.CoverRight)
  ```

- `Control:` values carry **no** `@version` suffix. Write `Control: ModernButton`, not
  `Control: ModernButton@1.2.3`.
- `Variant:` is **mandatory** for `GroupContainer` (`AutoLayout`) and `Gallery`
  (`Vertical`). Omitting it fails the compile with a message that names no control.
- Control order inside `Children:` is the visual order in an AutoLayout container.
- Control names are unique across the **whole app**. Always
  `<type-abbrev><ScreenPrefix><Name>`: `conHomeRoot`, `conContRoot`, `btnIntxSave`.
  Abbreviations: `con` container, `gal` gallery, `txt` ModernText, `inp` ModernTextInput,
  `btn` ModernButton, `ico` ModernIcon, `dd` ModernDropdown, `cmb` ModernCombobox,
  `dp` ModernDatePicker, `bdg` Badge.
- Screen properties used in this app: `Fill`, `OnVisible`, `OnHidden`. Set
  `Fill: =RGBA(252, 246, 233, 1)` on every screen.

---

## 12. Pattern — searchable combobox with inline create (ScrContact only)

Used twice on ScrContact, once for Company and once for Business Group. It is a
**pattern**: each instance carries its own control name and its own table, but the shape of
every formula below is fixed. There is **no create button** — creation happens in
`OnChange`.

### Verified Power Fx facts this pattern depends on

- A combobox's `Items` **may** reference its own `SearchText`. This is not a circular
  reference; it compiled clean.
- `Items` must return **one consistent record schema** across the real rows and the
  synthetic create row. Never emit a mixed schema.
- `ItemDisplayText` has **no** implicit row scope — always `ThisItem.<col>` — and
  `IsBlank()` is rejected inside it.

### The projection

Both real and synthetic rows are projected to the same three columns:

| Column | Real row | Synthetic create row |
|---|---|---|
| `OptId` | `Text(<table>id)` | `""` |
| `OptName` | the name column | `Trim(cmb<X>.SearchText)` |
| `IsNew` | `false` | `true` |

### The `Items` shape

```
=Ungroup(
    Table(
        { t: ForAll( FirstN(SortByColumns(<matching rows>, "<namecol>", SortOrder.Ascending), 20),
                     { OptId: Text(<idcol>), OptName: <namecol>, IsNew: false } ) },
        { t: ForAll( Filter( Table({ x: 1 }), <create-row condition> ),
                     { OptId: "", OptName: Trim(cmb<X>.SearchText), IsNew: true } ) }
    ),
    "t"
)
```

`Filter(Table({ x: 1 }), <row-independent condition>)` yields exactly zero or one rows and
is the reliable way to conditionally contribute a row without an `If` whose two branches
would have to unify. Do **not** write `If(cond, Table({...}), Table())` — the empty
`Table()` has no schema and will not unify.

The create-row condition is always "the trimmed `SearchText` is non-empty **and** matches
no existing row case-insensitively":

```
Len(Trim(cmb<X>.SearchText)) > 0
  && IsBlank(LookUp(<table>, Lower(<namecol>) = Lower(Trim(cmb<X>.SearchText))))
```

### The display text

```
ItemDisplayText: =If( ThisItem.IsNew,
                      "Create """ & ThisItem.OptName & """",
                      ThisItem.OptName )
```

`""` inside a Power Fx string literal is one literal double quote, so this renders exactly
`Create "Northrop Grumman"`. `ThisItem.IsNew` is a Boolean, so the `IsBlank`-in-
`ItemDisplayText` restriction does not apply.

### The `OnChange`

`OnChange` is a **behaviour** property, so it may read `.Selected` freely and it does not
join the dependency graph. It always resolves the selection to a **whole Dataverse record**
held in a screen global, because `Patch` needs a record, not the `{OptId, OptName, IsNew}`
projection:

```
=If(
    CountRows(cmb<X>.SelectedItems) = 0,
    Set(var<X>, Blank()),
    cmb<X>.Selected.IsNew,
    Set(var<X>, Patch(<table>, Defaults(<table>), { <namecol>: cmb<X>.Selected.OptName, ...})),
    Set(var<X>, LookUp(<table>, <idcol> = GUID(cmb<X>.Selected.OptId)))
)
```

`GUID(...)` is only reached on the third branch, where `IsNew` is false and `OptId` is
therefore a real GUID string.

### Settled-state chip — required, not optional

A combobox re-evaluates `Items` after every selection and again after the inline `Patch`.
Once the record exists the synthetic row disappears and the just-created record has a new
id, so the combobox's own rendering of the selection is not stable. Every instance of this
pattern therefore pairs the combobox with a **chip**:

```
con<Prefix><X>Chosen   GroupContainer, Variant: AutoLayout, Horizontal
  Fill: =RGBA(232, 221, 196, 1)      Height: =48    LayoutAlignItems: =LayoutAlignItems.Center
  LayoutGap: =8   PaddingLeft: =12   PaddingRight: =8
  Radius* : =12                      Visible: =!IsBlank(var<X>)
  +-- txt<Prefix><X>Name   ModernText, FillPortions: =1, Height: =44, Size: =15,
        FontWeight: =FontWeight.Semibold, Color: =RGBA(8, 19, 28, 1), Wrap: =false
  +-- btn<Prefix>Clear<X>  ModernButton, Icon: ="Dismiss", Layout: =ButtonLayout.IconOnly,
        Appearance: =ButtonAppearance.Transparent, Color: =RGBA(8, 19, 28, 1),
        Width: =44, Height: =44, LayoutMinWidth: =44, Text: =""
```

and the combobox carries `Visible: =IsBlank(var<X>)`. Exactly one of the two is visible, so
the field wrapper's height is a constant 48 for the input row. The chip is `secondary`
beige on a beige wrapper, so like every other beige-on-beige container it takes
`DropShadow: =DropShadow.None`.

Clearing the chip does `Set(var<X>, Blank()); Reset(cmb<X>)`.

---

## 13. Pattern — modal overlay (Screen1 only)

`GroupContainer` has **no** `OnSelect` input property, and a `GroupContainer` with
`Variant: AutoLayout` lays its children out in flow and ignores their `X`/`Y`. Those two
facts fix the shape of a modal:

1. The overlay cannot live inside an AutoLayout root. It is a **second screen-level child**,
   placed **after** the root, so document order puts it on top. This is the one sanctioned
   exception to the "screen `Children:` holds exactly one control" rule in section 3.
2. The overlay host is `GroupContainer` with `Variant: **ManualLayout**`, `X: =0`, `Y: =0`,
   `Width: =Parent.Width`, `Height: =Parent.Height`, `Visible: =<the gate variable>`. Its
   children are positioned with `X`/`Y`.
3. The **scrim is a `ModernText`**, not a container, because `ModernText` has both `Fill`
   and `OnSelect`. `Text: =""`, full-bleed, `Fill: =RGBA(8, 19, 28, 0.55)`.
4. The dialog card is a white `GroupContainer` (`Variant: AutoLayout`, Vertical,
   `LayoutAlignItems: =LayoutAlignItems.Stretch`) centred with
   `X: =(Parent.Width - Self.Width) / 2` and `Y: =(Parent.Height - Self.Height) / 2`.
   It is white on a dark scrim, so it **keeps its default drop shadow**.
5. Scrim-dismiss must be byte-identical to the dialog's cancel action. Write the same
   formula in both places; do not write a shorter "close" variant in one of them.

Every action button in a dialog is at least 48px tall, per the phone tap-target rule.
