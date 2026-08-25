# Screen Brief — ScrContact (EDIT)

| | |
|---|---|
| Action | **Modify** |
| Logical screen | New Contact |
| Target file | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrContact.pa.yaml` |
| YAML key | `ScrContact` |
| Control name prefix | `Cont` |

Read `canvas-app-shared.md` first — especially **section 0** (the file is Studio-normalized;
this screen is on **logical** column names) and **section 12** (the inline-create combobox
pattern, whose formula shapes you must follow).

Do not touch `App.pa.yaml`. Do not touch any other screen file.

---

## Goal

Replace both lookup pickers with searchable comboboxes that support inline create. The user
must never leave the form to create a company or a business group, and there must be **no
dedicated create button anywhere on this screen**.

---

## 1. Controls to DELETE

Remove these four controls and every property they carry:

| Control | Where |
|---|---|
| `inpContCompanySearch` | child of `conContFldCompany` |
| `galContCompanyResults` | child of `conContFldCompany` |
| `btnContCompanyOption` | child of `galContCompanyResults` (goes with its gallery) |
| `btnContCreateCompany` | child of `conContFldCompany` |

`txtContCompanyLabel` ("Company *") is **kept** — it is the field's label and is not
orphaned. `conContCompanyChosen`, `txtContCompanyName` and `btnContClearCompany` are
**kept** (see shared plan section 12: the settled-state chip).

After the deletion, no formula anywhere in the file may still reference
`inpContCompanySearch` or `btnContCreateCompany`. The only place they appear today is
`conContFldCompany.Height`, which you are replacing in step 2.

---

## 2. `conContFldCompany` — the company field

Container properties: keep everything as-is except `Height`, which becomes a constant.
Exactly one of the chip and the combobox is visible, and an invisible child collapses out
of the AutoLayout flow, so the height is label 18 + gap 6 + input 48:

```yaml
Height: =72
```

Delete the whole existing multi-line `Height` expression.

Children, in this order:

1. `txtContCompanyLabel` — unchanged.
2. `conContCompanyChosen` — unchanged **except** `btnContClearCompany.OnSelect`, which
   becomes:

   ```
   =Set(varContCompany, Blank());
   Set(varContGroup, Blank());
   Reset(cmbContCompany);
   Reset(cmbContGroup)
   ```

3. `cmbContCompany` — **new**, `Control: ModernCombobox` (no `Variant`, no `@version`).

### `cmbContCompany`

Styling is the shared input styling (shared plan section 5): `Appearance: =Appearance.Outline`,
`Fill: =RGBA(255, 255, 255, 1)`, `Color: =RGBA(8, 19, 28, 1)`,
`BorderColor: =RGBA(211, 201, 185, 1)`, `Font: =Font.'Segoe UI'`, `Size: =15`,
`Height: =48`, all four `Radius*: =12`, `AlignInContainer: =AlignInContainer.Stretch`.

Behaviour properties:

```yaml
AccessibleLabel: ="Company, search or create"
AllowExternalSelectedItems: =true
InputTextPlaceholder: ="Search or type a new company"
IsSearchable: =true
SelectMultiple: =false
Visible: =IsBlank(varContCompany)
```

`Items` — this is the riskiest formula in the edit. Compile and iterate until clean:

```
=Ungroup(
    Table(
        { t: ForAll(
                 FirstN(
                     SortByColumns(
                         Filter(Companies, StartsWith(cws_companyname, Trim(cmbContCompany.SearchText))),
                         "cws_companyname",
                         SortOrder.Ascending
                     ),
                     20
                 ),
                 { OptId: Text(cws_companyid), OptName: cws_companyname, IsNew: false }
             ) },
        { t: ForAll(
                 Filter(
                     Table({ x: 1 }),
                     Len(Trim(cmbContCompany.SearchText)) > 0
                       && IsBlank(LookUp(Companies, Lower(cws_companyname) = Lower(Trim(cmbContCompany.SearchText))))
                 ),
                 { OptId: "", OptName: Trim(cmbContCompany.SearchText), IsNew: true }
             ) }
    ),
    "t"
)
```

`ItemDisplayText`:

```
=If(
    ThisItem.IsNew,
    "Create """ & ThisItem.OptName & """",
    ThisItem.OptName
)
```

`OnChange`:

```
=If(
    CountRows(cmbContCompany.SelectedItems) = 0,
    Set(varContCompany, Blank()),
    cmbContCompany.Selected.IsNew,
    Set(
        varContCompany,
        Patch(Companies, Defaults(Companies), { cws_companyname: cmbContCompany.Selected.OptName })
    ),
    Set(varContCompany, LookUp(Companies, cws_companyid = GUID(cmbContCompany.Selected.OptId)))
);
Set(varContGroup, Blank());
Reset(cmbContGroup)
```

Changing the company always drops the business group — a group belongs to exactly one
company.

---

## 3. `conContFldGroup` — the business group field

Container: keep `Height: =96` (label 18 + gap 6 + input 48 + gap 6 + hint 18) and every
other property. It is beige on beige and already carries `DropShadow: =DropShadow.None` —
leave that.

Children, in this order:

1. `txtContGroupLabel` — unchanged.
2. `conContGroupChosen` — **new** chip, per shared plan section 12. Beige-on-beige, so it
   takes `DropShadow: =DropShadow.None`.

   ```yaml
   conContGroupChosen:
     Control: GroupContainer
     Variant: AutoLayout
     Properties:
       DropShadow: =DropShadow.None
       Fill: =RGBA(232, 221, 196, 1)
       FillPortions: =0
       Height: =48
       LayoutAlignItems: =LayoutAlignItems.Center
       LayoutDirection: =LayoutDirection.Horizontal
       LayoutGap: =8
       PaddingLeft: =12
       PaddingRight: =8
       RadiusBottomLeft: =12
       RadiusBottomRight: =12
       RadiusTopLeft: =12
       RadiusTopRight: =12
       Visible: =!IsBlank(varContGroup)
   ```

   - `txtContGroupName` — `ModernText`, `Text: =varContGroup.cws_businessgroupname`,
     `AccessibleLabel: ="Selected business group " & varContGroup.cws_businessgroupname`,
     `FillPortions: =1`, `AlignInContainer: =AlignInContainer.Stretch`, `Height: =44`,
     `Size: =15`, `FontWeight: =FontWeight.Semibold`, `Color: =RGBA(8, 19, 28, 1)`,
     `Font: =Font.'Segoe UI'`, `Wrap: =false`.
   - `btnContClearGroup` — `ModernButton`, `Icon: ="Dismiss"`,
     `IconStyle: =IconStyle.Filled`, `Layout: =ButtonLayout.IconOnly`,
     `Appearance: =ButtonAppearance.Transparent`, `Color: =RGBA(8, 19, 28, 1)`,
     `Width: =44`, `Height: =44`, `LayoutMinWidth: =44`,
     `AlignInContainer: =AlignInContainer.Center`, `Text: =""`,
     `Tooltip: ="Change business group"`, `AccessibleLabel: ="Clear business group"`,
     `Font: =Font.'Segoe UI'`, and

     ```
     OnSelect: |-
       =Set(varContGroup, Blank());
       Reset(cmbContGroup)
     ```

3. `cmbContGroup` — **modify in place**.
4. `txtContGroupHint` — modify `Visible` only.

### `cmbContGroup` changes

Keep all styling and keep `DisplayMode` exactly as it is:

```
DisplayMode: =If(IsBlank(varContCompany), DisplayMode.Disabled, DisplayMode.Edit)
```

Add / replace:

```yaml
AllowExternalSelectedItems: =true
IsSearchable: =true
Visible: =IsBlank(varContGroup)
```

`Items` — replace the existing `If(!IsBlank(varContCompany), Filter(...))`. The outer guard
is dropped: with no company selected `varContCompany.cws_companyid` is blank, the filter
returns nothing, and the control is disabled anyway.

```
=Ungroup(
    Table(
        { t: ForAll(
                 FirstN(
                     SortByColumns(
                         Filter(
                             'Business Groups',
                             cws_Company.cws_companyid = varContCompany.cws_companyid,
                             StartsWith(cws_businessgroupname, Trim(cmbContGroup.SearchText))
                         ),
                         "cws_businessgroupname",
                         SortOrder.Ascending
                     ),
                     20
                 ),
                 { OptId: Text(cws_businessgroupid), OptName: cws_businessgroupname, IsNew: false }
             ) },
        { t: ForAll(
                 Filter(
                     Table({ x: 1 }),
                     !IsBlank(varContCompany)
                       && Len(Trim(cmbContGroup.SearchText)) > 0
                       && IsBlank(
                              LookUp(
                                  'Business Groups',
                                  cws_Company.cws_companyid = varContCompany.cws_companyid
                                    && Lower(cws_businessgroupname) = Lower(Trim(cmbContGroup.SearchText))
                              )
                          )
                 ),
                 { OptId: "", OptName: Trim(cmbContGroup.SearchText), IsNew: true }
             ) }
    ),
    "t"
)
```

`ItemDisplayText` — replace `=ThisItem.cws_businessgroupname` with:

```
=If(
    ThisItem.IsNew,
    "Create """ & ThisItem.OptName & """",
    ThisItem.OptName
)
```

`OnChange` — new:

```
=If(
    CountRows(cmbContGroup.SelectedItems) = 0,
    Set(varContGroup, Blank()),
    cmbContGroup.Selected.IsNew,
    Set(
        varContGroup,
        Patch(
            'Business Groups',
            Defaults('Business Groups'),
            { cws_businessgroupname: cmbContGroup.Selected.OptName,
              cws_Company: varContCompany }
        )
    ),
    Set(varContGroup, LookUp('Business Groups', cws_businessgroupid = GUID(cmbContGroup.Selected.OptId)))
)
```

### `txtContGroupHint`

Keep the `Text` formula exactly as it is ("Enter a company first" / "No groups yet for X").
Only `Visible` changes, so the hint disappears once a group has actually been chosen:

```
=IsBlank(varContGroup)
&& (
     IsBlank(varContCompany)
     || CountRows(Filter('Business Groups', cws_Company.cws_companyid = varContCompany.cws_companyid)) = 0
   )
```

---

## 4. Screen `OnVisible`

```
=Set(varContCompany, Blank());
Set(varContGroup, Blank())
```

---

## 5. `btnContSave`

`DisplayMode` is unchanged — company is still gated on `!IsBlank(varContCompany)` and the
group is optional.

In `OnSelect`, change exactly one line of the `Patch` change record:

```
cws_BusinessGroup: cmbContGroup.Selected,
```

becomes

```
cws_BusinessGroup: varContGroup,
```

`cmbContGroup.Selected` is now a `{ OptId, OptName, IsNew }` projection, not a
`Business Groups` record, so it can no longer satisfy the lookup. Everything else in
`OnSelect` stays byte-identical.

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
As a child of an AutoLayout container it also accepts `LayoutMinWidth`, `LayoutMaxWidth`,
`LayoutMinHeight`, `LayoutMaxHeight`, `FillPortions`, `AlignInContainer`.
Output properties used here: `SearchText`, `Selected`, `SelectedItems`.

Enums set on this screen:

```
Appearance   -> Appearance.Outline
Font         -> Font.'Segoe UI'
DisplayMode  -> DisplayMode.Disabled / DisplayMode.Edit
```

### `GroupContainer` (`Variant: AutoLayout` — mandatory)

`BorderColor`, `BorderStyle`, `BorderThickness`, `ContentLanguage`, `DropShadow`,
`EnableChildFocus`, `Fill`, `Height`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`,
`PaddingTop`, `RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`,
`Visible`, `Width`, `X`, `Y`, plus `LayoutAlignItems`, `LayoutDirection`, `LayoutGap`,
`LayoutJustifyContent`, `LayoutOverflowX`, `LayoutOverflowY`, `LayoutWrap`.

```
DropShadow           -> DropShadow.None
LayoutAlignItems     -> LayoutAlignItems.Center / LayoutAlignItems.Stretch
LayoutDirection      -> LayoutDirection.Horizontal / LayoutDirection.Vertical
```

### `ModernButton`

`AccessibleLabel`, `Align`, `Appearance`, `BasePaletteColor`, `BorderColor`, `BorderStyle`,
`BorderThickness`, `Color`, `ContentLanguage`, `DisplayMode`, `Font`, `FontWeight`,
`Height`, `Icon`, `IconRotation`, `IconStyle`, `Italic`, `Layout`, `OnSelect`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `PaddingTop`, `RadiusBottomLeft`,
`RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`, `Size`, `Strikethrough`, `Text`,
`Tooltip`, `Underline`, `VerticalAlign`, `Visible`, `Width`, `X`, `Y`.

```
Appearance -> ButtonAppearance.Transparent    (enum name: ButtonAppearance)
IconStyle  -> IconStyle.Filled                (enum name: IconStyle — only Filled, Outline)
Layout     -> ButtonLayout.IconOnly           (enum name: ButtonLayout)
```

`Icon` is **Text**, not an enum: `Icon: ="Dismiss"`.

### `ModernText`

`AccessibleLabel`, `Align`, `AutoHeight`, `BorderColor`, `BorderStyle`, `BorderThickness`,
`Color`, `ContentLanguage`, `DisplayMode`, `Fill`, `Font`, `FontWeight`, `Height`,
`Italic`, `OnSelect`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`, `PaddingTop`,
`RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`, `Size`,
`Strikethrough`, `Text`, `Underline`, `VerticalAlign`, `Visible`, `Width`, `Wrap`, `X`, `Y`.

```
Font       -> Font.'Segoe UI'
FontWeight -> FontWeight.Semibold / FontWeight.Normal
```

---

## 7. Acceptance checks

- No control on this screen exists whose only job is to create a record.
- Typing a company that does not exist shows a final option reading `Create "<typed text>"`;
  choosing it creates the `Companies` row and immediately shows the chip, without leaving
  the screen.
- Typing a company that **does** exist (case-insensitively) shows **no** create option.
- The group combobox stays disabled and shows "Enter a company first" until a company is
  chosen; its options are only that company's groups.
- Creating a group writes both `cws_businessgroupname` and `cws_Company`.
- Clearing the company clears the group as well.
- Saving a contact with a newly created group writes that group into `cws_BusinessGroup`.
- `conContFldCompany` renders at 72px whether the chip or the combobox is showing.
- Compile is clean. A delegation **warning** on `Lower(...)` inside the duplicate-check
  `LookUp` is expected and acceptable; a delegation **error** is not.
