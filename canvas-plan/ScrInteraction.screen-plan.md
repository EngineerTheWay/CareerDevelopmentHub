# Screen Brief — ScrInteraction (EDIT)

| | |
|---|---|
| Action | **Modify** |
| Logical screen | Log Interaction |
| Target file | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrInteraction.pa.yaml` |
| YAML key | `ScrInteraction` |
| Control name prefix | `Intx` |

Read `canvas-app-shared.md` first — especially **section 0** (the file is Studio-normalized)
and **section 8** (the cross-screen state contract and the `GUID()` guard rule).

Do not touch `App.pa.yaml`. Do not touch any other screen file.

---

## Goal

1. Bidirectional company cross-filtering between the contact picker and the application
   picker, routed through `varIntxCompanyId`.
2. Accept prefill arriving from a completed follow-up on Screen1.

---

## CRITICAL — why this must route through a variable

Making `cmbIntxContact.Items` reference `cmbIntxApp.Selected` while `cmbIntxApp.Items`
references `cmbIntxContact.Selected` is a **hard compile error**, verified:

```
This rule creates a circular reference between properties, which is not allowed.
```

The working pattern, verified clean: **both `Items` read `varIntxCompanyId`; both
`OnChange` write it.** `Items` is a data property and joins the dependency graph;
`OnChange` is a behaviour property and does not. **No `Items` on this screen may contain
`.Selected` of any control.**

---

## Column spelling on this screen

This file was Studio-normalized to **display** names in its `Patch` and its existing
`ItemDisplayText` (`Contact`, `'Interaction Date'`, `'Interaction Type'`,
`'Related Application'`, `Notes`, `'Interaction Name'`, `'Contact Name'`, `Role`,
`Company.'Company Name'`, `'Networking Contact'`). **Leave every existing expression's
spelling alone.** All new formulas below are written for you explicitly — copy them
verbatim; do not re-spell them.

---

## 1. Screen properties

`OnVisible` does not currently exist — add it. It derives the cross-filter deterministically
on every arrival, which is what guarantees a stale company filter can never leak in.
It sets **only** `varIntxCompanyId`; it must not clear any `varPrefill*` variable, because
`OnVisible` races `DefaultSelectedItems`.

```yaml
OnVisible: |-
  =Set(
      varIntxCompanyId,
      If(
          Len(varPrefillContactId) > 0,
          Text(LookUp('Networking Contacts', cws_networkingcontactid = GUID(varPrefillContactId)).cws_Company.cws_companyid),
          Len(varPrefillAppId) > 0,
          Text(LookUp('Job Applications', cws_jobapplicationid = GUID(varPrefillAppId)).cws_Company.cws_companyid),
          ""
      )
  )
```

`OnHidden` currently reads `=Set(varPrefillContactId, "")`. Replace with:

```yaml
OnHidden: |-
  =Set(varPrefillContactId, "");
  Set(varPrefillAppId, "");
  Set(varPrefillIntxName, "");
  Set(varIntxCompanyId, "")
```

Prefill variables are cleared in `OnHidden`, **never** in `OnVisible`. That is the existing
convention in this app and it is why the prefill works at all.

---

## 2. `cmbIntxContact`

Add:

```yaml
AllowExternalSelectedItems: =true
```

so a prefilled contact stays selected even when the company filter narrows `Items`.

`DefaultSelectedItems` is **unchanged**.

Replace `Items` (currently `=SortByColumns('Networking Contacts', "cws_contactname", SortOrder.Ascending)`):

```
=If(
    Len(varIntxCompanyId) = 0,
    SortByColumns('Networking Contacts', "cws_contactname", SortOrder.Ascending),
    SortByColumns(
        Filter('Networking Contacts', cws_Company.cws_companyid = GUID(varIntxCompanyId)),
        "cws_contactname",
        SortOrder.Ascending
    )
)
```

Both branches yield a `Networking Contacts` table, so they unify. `GUID()` is only reached
once `Len(varIntxCompanyId) = 0` is false.

Add `OnChange`. A selected contact wins; if the contact is cleared, fall back to the
application's company; if neither is selected, drop the filter entirely:

```
=Set(
    varIntxCompanyId,
    If(
        CountRows(cmbIntxContact.SelectedItems) > 0,
        Text(cmbIntxContact.Selected.cws_Company.cws_companyid),
        CountRows(cmbIntxApp.SelectedItems) > 0,
        Text(cmbIntxApp.Selected.cws_Company.cws_companyid),
        ""
    )
)
```

`Text(Blank())` is `""`, so a contact with no company correctly produces "no filter".

---

## 3. `cmbIntxApp`

Add:

```yaml
AllowExternalSelectedItems: =true
```

Add `DefaultSelectedItems`:

```
=If(
    Len(varPrefillAppId) > 0,
    Filter('Job Applications', cws_jobapplicationid = GUID(varPrefillAppId))
)
```

The two-argument `If` yields blank when the condition is false, which is a valid empty
selection.

Replace `Items` (currently `=SortByColumns('Job Applications', "cws_role", SortOrder.Ascending)`):

```
=If(
    Len(varIntxCompanyId) = 0,
    SortByColumns('Job Applications', "cws_role", SortOrder.Ascending),
    SortByColumns(
        Filter('Job Applications', cws_Company.cws_companyid = GUID(varIntxCompanyId)),
        "cws_role",
        SortOrder.Ascending
    )
)
```

`ItemDisplayText` is **unchanged** — it already reads
`=ThisItem.Role & If(Len(ThisItem.Company.'Company Name') > 0, " - " & ThisItem.Company.'Company Name', "")`.
Note it uses `Len(...) > 0` rather than `IsBlank`, because `IsBlank()` is rejected inside
`ItemDisplayText`. Keep it that way.

Add `OnChange` — the mirror image of the contact's:

```
=Set(
    varIntxCompanyId,
    If(
        CountRows(cmbIntxApp.SelectedItems) > 0,
        Text(cmbIntxApp.Selected.cws_Company.cws_companyid),
        CountRows(cmbIntxContact.SelectedItems) > 0,
        Text(cmbIntxContact.Selected.cws_Company.cws_companyid),
        ""
    )
)
```

---

## 4. New field — Interaction name

`varPrefillIntxName` has to land somewhere visible. This screen has no name field today —
the name is synthesised in the save `Patch`. Add an optional **"Interaction name"** field
group as a child of `conIntxBody`, positioned **after `conIntxFldApp` and before
`conIntxFldNotes`**.

It is a beige-on-beige field wrapper, so it takes `DropShadow: =DropShadow.None`. Height is
the standard label + input budget: 18 + 6 + 48 = 72.

```yaml
- conIntxFldName:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      DropShadow: =DropShadow.None
      Fill: =RGBA(252, 246, 233, 1)
      FillPortions: =0
      Height: =72
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutDirection: =LayoutDirection.Vertical
      LayoutGap: =6
      LayoutMinHeight: =0
      LayoutMinWidth: =0
      RadiusBottomLeft: =12
      RadiusBottomRight: =12
      RadiusTopLeft: =12
      RadiusTopRight: =12
    Children:
      - txtIntxNameLabel:
          Control: ModernText
          Properties:
            AccessibleLabel: ="Interaction name, optional"
            AlignInContainer: =AlignInContainer.Stretch
            Color: =RGBA(45, 63, 78, 1)
            Font: =Font.'Segoe UI'
            FontWeight: =FontWeight.Semibold
            Height: =18
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            PaddingTop: =0
            Size: =12
            Text: ="Interaction name"
            Wrap: =false
      - inpIntxName:
          Control: ModernTextInput
          Properties:
            AccessibleLabel: ="Interaction name"
            AlignInContainer: =AlignInContainer.Stretch
            Appearance: =Appearance.Outline
            BorderColor: =RGBA(211, 201, 185, 1)
            Color: =RGBA(8, 19, 28, 1)
            Default: =varPrefillIntxName
            Fill: =RGBA(255, 255, 255, 1)
            Font: =Font.'Segoe UI'
            Height: =48
            MaxLength: =200
            Placeholder: ="Leave blank to name it automatically"
            RadiusBottomLeft: =12
            RadiusBottomRight: =12
            RadiusTopLeft: =12
            RadiusTopRight: =12
            Size: =15
```

`Default` is the correct property name on `ModernTextInput` (there is no `DefaultText`).
Because `Navigate` resets the target screen's controls, `Default` re-evaluates on every
arrival, which is what makes the prefill work.

---

## 5. `btnIntxSave`

`DisplayMode` is **unchanged** — the interaction name is optional and must not gate save.

In `OnSelect`, change exactly two expressions so a typed name wins and the previous
auto-generated name remains the fallback. Everything else in `OnSelect` stays
byte-identical, including its display-name spellings.

`'Interaction Name'` inside the `Patch` change record becomes:

```
'Interaction Name': If(
    Len(Trim(inpIntxName.Text)) > 0,
    Trim(inpIntxName.Text),
    ddIntxType.Selected.Label & " with " & cmbIntxContact.Selected.'Contact Name'
)
```

`Set(varSavedTitle, ...)` becomes the same expression, so the confirmation screen shows
what was actually written:

```
Set(varSavedTitle, If(
    Len(Trim(inpIntxName.Text)) > 0,
    Trim(inpIntxName.Text),
    ddIntxType.Selected.Label & " with " & cmbIntxContact.Selected.'Contact Name'
));
```

`OnSelect` already ends by clearing `varPrefillContactId` and `varReturnTo`. Add the two
new prefill vars and the filter var to that clearing block, immediately before `Navigate`:

```
Set(varPrefillAppId, "");
Set(varPrefillIntxName, "");
Set(varIntxCompanyId, "");
```

---

## 6. Control property reference

Only the valid **input** property names are listed. Anything not on a control's list is an
`Unknown property` compile error.

### `ModernCombobox`

`AccessibleLabel`, `AllowExternalSelectedItems`, `Appearance`, `BasePaletteColor`,
`BorderColor`, `BorderStyle`, `BorderThickness`, `Color`, `ContentLanguage`,
`DefaultSelectedItems`, `DelayOutput`, `DisplayMode`, `Fill`, `Font`, `FontWeight`,
`Height`, `InputTextPlaceholder`, `IsSearchable`, `Italic`, `ItemDisplayText`, `Items`,
`MultiValueDelimiter`, `OnChange`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`,
`PaddingTop`, `RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`,
`Required`, `SelectMultiple`, `Size`, `Strikethrough`, `Underline`, `ValidationState`,
`Visible`, `Width`, `X`, `Y`.
Plus, as an AutoLayout child: `LayoutMinWidth`, `LayoutMaxWidth`, `LayoutMinHeight`,
`LayoutMaxHeight`, `FillPortions`, `AlignInContainer`.
Output properties used here: `Selected`, `SelectedItems`.

### `ModernTextInput`

`AccessibleLabel`, `Align`, `Appearance`, `BasePaletteColor`, `BorderColor`, `BorderStyle`,
`BorderThickness`, `Color`, `ContentLanguage`, `Default`, `DisplayMode`, `Fill`, `Font`,
`FontWeight`, `Height`, `Italic`, `MaxLength`, `OnChange`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `PaddingTop`, `Placeholder`, `RadiusBottomLeft`, `RadiusBottomRight`,
`RadiusTopLeft`, `RadiusTopRight`, `Required`, `Size`, `Strikethrough`, `TriggerOutput`,
`Type`, `Underline`, `ValidationState`, `Visible`, `Width`, `X`, `Y`.
Plus the AutoLayout child properties above. Output used here: `Text`.

```
Appearance -> Appearance.Outline        (enum name: Appearance — FilledDarker, FilledLighter, Outline)
Type       -> TextInputType.Multiline   (enum name: TextInputType — only on inpIntxNotes; inpIntxName omits Type)
Font       -> Font.'Segoe UI'
```

### `ModernText`

`AccessibleLabel`, `Align`, `AutoHeight`, `BorderColor`, `BorderStyle`, `BorderThickness`,
`Color`, `ContentLanguage`, `DisplayMode`, `Fill`, `Font`, `FontWeight`, `Height`,
`Italic`, `OnSelect`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`, `PaddingTop`,
`RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`, `Size`,
`Strikethrough`, `Text`, `Underline`, `VerticalAlign`, `Visible`, `Width`, `Wrap`, `X`, `Y`.

```
Font       -> Font.'Segoe UI'
FontWeight -> FontWeight.Semibold
```

### `GroupContainer` (`Variant: AutoLayout` — mandatory)

`BorderColor`, `BorderStyle`, `BorderThickness`, `ContentLanguage`, `DropShadow`,
`EnableChildFocus`, `Fill`, `Height`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`,
`PaddingTop`, `RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`,
`Visible`, `Width`, `X`, `Y`, plus `LayoutAlignItems`, `LayoutDirection`, `LayoutGap`,
`LayoutJustifyContent`, `LayoutOverflowX`, `LayoutOverflowY`, `LayoutWrap`.

```
DropShadow       -> DropShadow.None
LayoutAlignItems -> LayoutAlignItems.Stretch
LayoutDirection  -> LayoutDirection.Vertical
```

---

## 7. Layout note

`conIntxBody` already carries `LayoutOverflowY: =LayoutOverflow.Scroll` and
`LayoutAlignItems: =LayoutAlignItems.Stretch`. Adding a 72px field group grows the scroll
content by 72 + the 16px `LayoutGap`; no other height changes. The top bar and the save
footer stay pinned outside the scroll region, so the primary action remains
thumb-reachable. This is a phone-only single-column screen — do not add a `LayoutWrap` or a
width breakpoint.

---

## 8. Acceptance checks

- No `Items` expression on this screen contains `.Selected`.
- Selecting an application narrows the contact picker to that application's company;
  selecting a contact narrows the application picker to that contact's company.
- With nothing selected, both pickers show every row.
- Clearing one picker falls back to the other picker's company rather than dropping the
  filter outright; clearing both drops it.
- Leaving and re-entering the screen never carries a company filter over: `OnHidden` clears
  it and `OnVisible` recomputes it from the prefill vars.
- Arriving from Screen1's "Complete + log" on a Contact-typed follow-up preselects the
  contact and narrows the application picker.
- Arriving from an Application-typed follow-up preselects the application, leaves the
  contact **empty**, and narrows the contact picker to that application's company.
- The interaction name field shows the follow-up's title on arrival, and the save writes it.
- Compile is clean. `GUID()` is never reached on a blank string.
