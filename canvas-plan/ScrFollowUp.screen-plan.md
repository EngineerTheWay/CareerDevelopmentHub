# Screen Brief — New Follow-up

> **Design snapshot — 2026-08-18.** This is a plan written *before* the canvas app was built,
> kept as a record of intent. It is not maintained against the shipped implementation and
> may describe fields or behaviour that changed during the build. For what actually
> exists, read the code.

| | |
|---|---|
| Action | **Create** |
| Logical screen | New Follow-up |
| Target file | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrFollowUp.pa.yaml` |
| YAML key | `ScrFollowUp` |
| Control name prefix | **`Flw`** |

Read `canvas-app-shared.md` first. Palette, typography, screen skeleton, top-bar pattern,
field-group pattern, input styling, save-gating rule and the state contract are pinned
there and must not be re-derived.

---

## 1. Hard constraint — read before writing any formula

**Do not write any `cws_reminder_*` column.** The `Follow Ups` table exposes
`cws_reminder_all_day`, `cws_reminder_enabled`, `cws_reminder_end_at`,
`cws_reminder_last_synced_at`, `cws_reminder_snyc_status`, `cws_reminder_start_at`,
`cws_reminder_sync_error` and `cws_reminder_time_zone`. This app creates **plain**
follow-ups only. None of those names may appear in this file, in any `Patch`, or in any
control. The Outlook sync that owns them is not part of this app.

Also do not write `statecode` or `statuscode`.

---

## 2. Purpose

Capture a "don't forget to…" in a few taps. Title and due date are required, due date
defaults to today, status is always Open. Related Type decides which single lookup — if
any — is on screen.

---

## 3. Screen properties

```yaml
Screens:
  ScrFollowUp:
    Properties:
      Fill: =RGBA(252, 246, 233, 1)
      OnHidden: =Set(varPrefillContactId, "")
    Children:
      - conFlwRoot: ...
```

`varPrefillContactId` is cleared in **`OnHidden`**, never in `OnVisible`. `OnVisible` and
control initialisation are not ordered, so clearing on arrival can wipe the value before
`ddFlwType.Default` and `cmbFlwContact.DefaultSelectedItems` read it.

This screen has no `OnVisible`.

---

## 4. Control tree

```
conFlwRoot                     GroupContainer / AutoLayout   (the ONLY screen child)
├─ conFlwTopBar                GroupContainer / AutoLayout   (56px)
│   ├─ icoFlwBack              ModernIcon    ="ChevronLeft"
│   └─ txtFlwTitleBar          ModernText    ="New follow-up"
├─ conFlwBody                  GroupContainer / AutoLayout   (scrolls, gap 16, pad 16)
│   ├─ conFlwFldTitle          GroupContainer / AutoLayout   Height =72
│   │   ├─ txtFlwTitleLabel    ModernText
│   │   └─ inpFlwTitle         ModernTextInput
│   ├─ conFlwFldDue            GroupContainer / AutoLayout   Height =72
│   │   ├─ txtFlwDueLabel      ModernText
│   │   └─ dpFlwDue            ModernDatePicker
│   ├─ conFlwFldType           GroupContainer / AutoLayout   Height =72
│   │   ├─ txtFlwTypeLabel     ModernText
│   │   └─ ddFlwType           ModernDropdown
│   ├─ conFlwFldContact        GroupContainer / AutoLayout   Height =72   (conditional)
│   │   ├─ txtFlwContactLabel  ModernText
│   │   └─ cmbFlwContact       ModernCombobox
│   ├─ conFlwFldApp            GroupContainer / AutoLayout   Height =72   (conditional)
│   │   ├─ txtFlwAppLabel      ModernText
│   │   └─ cmbFlwApp           ModernCombobox
│   ├─ conFlwFldNotes          GroupContainer / AutoLayout   Height =120
│   │   ├─ txtFlwNotesLabel    ModernText
│   │   └─ inpFlwNotes         ModernTextInput (Multiline)
│   └─ txtFlwStatusNote        ModernText                    Height =18
└─ conFlwFooter                GroupContainer / AutoLayout   Height =76
    └─ btnFlwSave              ModernButton
```

---

## 5. Layout budget (phone, single column)

Root = `Parent.Height`; top bar 56 fixed; body `FillPortions: =1` with
`LayoutOverflowY: =LayoutOverflow.Scroll`; footer 76 fixed.

At most **one** of `conFlwFldContact` / `conFlwFldApp` is ever visible, and a hidden
AutoLayout child collapses out of the flow, so the form never leaves a gap:

| State | Body content height |
|---|---|
| type unset or None/Standalone | 72+16+72+16+72+16+120+16+18 = 418, +32 padding = 450 |
| type Contact or Application | 418 + 72 + 16 = 506, +32 padding = 538 |

Both fit a 640×1136 phone without scrolling; on a shorter device the body scrolls and the
save button stays pinned under the thumb.

There are no horizontal rows apart from the top bar. Nothing wraps, nothing has a width
breakpoint, and no layout variable exists.

---

## 6. Control specifications

### `icoFlwBack`

Per the shared top-bar pattern, plus:

```
OnSelect: |
  =Set(varPrefillContactId, "");
  Navigate(Screen1, ScreenTransition.UnCoverRight)
```

### Title

```
txtFlwTitleLabel.Text: ="What needs doing? *"
inpFlwTitle:
  Placeholder: ="e.g. Send Priya my portfolio"
  Type: =TextInputType.SingleLine
  MaxLength: =200
  (plus the shared input styling block)
```

### Due date

```
txtFlwDueLabel.Text: ="Due date *"

dpFlwDue   ModernDatePicker
  DefaultDate: =Today()
  Format: =DatePickerFormat.LongAbbreviated     # enum DatePickerFormat
  DateTimeZone: =DateTimeZone.Local             # enum DateTimeZone
  StartOfWeek: =StartOfWeek.Sunday              # enum StartOfWeek
  IsEditable: =false
  Placeholder: ="Pick a date"
  (plus the shared input styling block)
```

`cws_duedate` is Date-only + User-Local. `DateTimeZone.Local` plus `.SelectedDate`
(local midnight) is the correct pairing. Do **not** set `DateTimeZone.UTC` — that shifts
the stored day.

The output property is `.SelectedDate`.

### Related type — the conditional reveal

```
txtFlwTypeLabel.Text: ="Related to *"

ddFlwType   ModernDropdown
  Items: =Table(
      { Label: "A contact",     Val: 'Related Type (Follow Ups)'.Contact },
      { Label: "An application", Val: 'Related Type (Follow Ups)'.Application },
      { Label: "Nothing in particular", Val: 'Related Type (Follow Ups)'.'None/Standalone' }
  )
  ItemDisplayText: =Label
  Default: =If(
      varPrefillContactId <> "",
      { Label: "A contact", Val: 'Related Type (Follow Ups)'.Contact }
  )
  OnChange: |
    =Reset(cmbFlwContact);
    Reset(cmbFlwApp)
  (plus the shared input styling block)
```

`'None/Standalone'` contains a slash and **must** be single-quoted after the dot. Unquoted
it fails with a diagnostic that never mentions option sets.

**`OnChange` is the clearing rule.** Switching the related type resets **both** pickers,
so the one that is being hidden cannot retain a value and cannot be written on save. It
resets both rather than only the other one because the newly revealed picker should also
start empty. Nothing else in the app touches those two controls' state — there is no
shadow variable to keep in sync.

`Default` prefills "A contact" when the user arrived from the Saved screen's "Add a
follow-up for &lt;name&gt;" next step. The two-argument `If` yields blank otherwise, which
leaves the dropdown unselected.

### Related contact (revealed)

```
conFlwFldContact.Visible: =ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Contact

txtFlwContactLabel.Text: ="Contact *"

cmbFlwContact   ModernCombobox
  Items: =SortByColumns('Networking Contacts', "cws_contactname", SortOrder.Ascending)
  ItemDisplayText: =cws_contactname
  IsSearchable: =true
  SelectMultiple: =false
  InputTextPlaceholder: ="Search contacts"
  DefaultSelectedItems: =If(
      varPrefillContactId <> "",
      Filter('Networking Contacts', cws_networkingcontactid = GUID(varPrefillContactId))
  )
  (plus the shared input styling block)
```

Put `Visible` on the **field group container**, not on the combobox, so the label
disappears with it and the container collapses out of the AutoLayout flow.

### Related application (revealed)

```
conFlwFldApp.Visible: =ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Application

txtFlwAppLabel.Text: ="Application *"

cmbFlwApp   ModernCombobox
  Items: =SortByColumns('Job Applications', "cws_role", SortOrder.Ascending)
  ItemDisplayText: =cws_role
                 & If(IsBlank(cws_Company.cws_companyname),
                      "",
                      " - " & cws_Company.cws_companyname)
  IsSearchable: =true
  SelectMultiple: =false
  InputTextPlaceholder: ="Search applications"
  (plus the shared input styling block)
```

`'Job Applications'` has no single display-name column, so the label is role + company via
the `cws_Company` lookup.

### Notes and status note

```
txtFlwNotesLabel.Text: ="Notes"
inpFlwNotes:
  Placeholder: ="Any detail you'll want later"
  Type: =TextInputType.Multiline
  MaxLength: =2000
  Height: =96
  (plus the shared input styling block)

txtFlwStatusNote
  Text: ="Saves as Open. Complete it from the home screen."
  Size: =11   Color: =RGBA(45, 63, 78, 1)
  Height: =18   Wrap: =false
```

`txtFlwStatusNote` is the visible statement of the Open default. There is no status
control, because status is not the user's choice at creation time.

### `btnFlwSave`

Shared save-button styling, plus:

```
Text: ="Save follow-up"
DisplayMode: =If(
    Len(Trim(inpFlwTitle.Text)) > 0
      && !IsBlank(dpFlwDue.SelectedDate)
      && !IsBlank(ddFlwType.Selected.Label)
      && (
           ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.'None/Standalone'
           || (ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Contact
               && CountRows(cmbFlwContact.SelectedItems) > 0)
           || (ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Application
               && CountRows(cmbFlwApp.SelectedItems) > 0)
         ),
    DisplayMode.Edit,
    DisplayMode.Disabled
)
OnSelect: |
  =Patch('Follow Ups', Defaults('Follow Ups'),
      { cws_title:      Trim(inpFlwTitle.Text),
        cws_duedate:    dpFlwDue.SelectedDate,
        cws_status:     'Status (Follow Ups)'.Open,
        cws_relatedtype: ddFlwType.Selected.Val,
        cws_notes:      inpFlwNotes.Text,
        cws_RelatedContact: If(
            ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Contact,
            cmbFlwContact.Selected
        ),
        cws_RelatedApplication: If(
            ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Application,
            cmbFlwApp.Selected
        ) }
  );
  Set(varSavedKind, "FollowUp");
  Set(varSavedTitle, Trim(inpFlwTitle.Text));
  Set(varSavedContactId,
      If(ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Contact,
         Text(cmbFlwContact.Selected.cws_networkingcontactid),
         ""));
  Set(varSavedContactName,
      If(ddFlwType.Selected.Val = 'Related Type (Follow Ups)'.Contact,
         cmbFlwContact.Selected.cws_contactname,
         ""));
  Set(varPrefillContactId, "");
  Set(varReturnTo, "");
  Navigate(ScrSaved, ScreenTransition.Fade)
```

Notes on the save:

- `DisplayMode` reads the **current** control values only. No validity flag, no `OnChange`
  bookkeeping, nothing cleared per-input. The whole conditional-requirement rule lives in
  this one expression.
- `cws_status: 'Status (Follow Ups)'.Open` is written explicitly. The option set is
  `'Status (Follow Ups)'` with members `Open` / `Completed`. `'Status (Follow Ups)'.Active`
  does **not** exist — that member belongs to `'Status (Follow Ups)_1'`, the `statecode`
  option set, which this app never touches.
- The two-argument `If` on each lookup yields blank when its type is not selected, which
  leaves that lookup empty. Keep both keys in a **single** change record; do not try to
  vary the shape of the record between branches — differently-shaped records will not
  unify and the `Patch` will not compile.
- Both lookups are `DataEntity` and are patched with whole records, never GUIDs.
- The `Patch` change record above is the complete list of columns written. No
  `cws_reminder_*`, no `cws_completeddate` (that is set only when completing, on Screen1),
  no `statecode`.

---

## 7. Valid property names for the control types on this screen

**GroupContainer** (`Variant: AutoLayout` mandatory) — BorderColor, BorderStyle,
BorderThickness, ContentLanguage, DropShadow, EnableChildFocus, Fill, Height,
PaddingBottom, PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft,
RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Visible, Width, X, Y,
LayoutAlignItems, LayoutDirection, LayoutGap, LayoutJustifyContent, LayoutOverflowX,
LayoutOverflowY, LayoutWrap; as an AutoLayout child also LayoutMinWidth, LayoutMaxWidth,
LayoutMinHeight, LayoutMaxHeight, FillPortions, AlignInContainer.
Enums: `LayoutDirection` (Horizontal, Vertical) · `LayoutAlignItems` (Center, End, Start,
Stretch) · `LayoutJustifyContent` (Center, End, SpaceBetween, Start) · `LayoutOverflow`
(Hide, Scroll) · `BorderStyle` (Dashed, Dotted, None, Solid).

**ModernText** — AccessibleLabel, Align, AutoHeight, BorderColor, BorderStyle,
BorderThickness, Color, ContentLanguage, DisplayMode, Fill, Font, FontWeight, Height,
Italic, OnSelect, PaddingBottom, PaddingLeft, PaddingRight, PaddingTop,
RadiusBottomLeft, RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Size, Strikethrough,
Text, Underline, VerticalAlign, Visible, Width, Wrap, X, Y.
Enums: `Align` (Center, Justify, Left, Right) · `VerticalAlign` (Bottom, Middle, Top) ·
`Font` · `FontWeight` (Bold, Lighter, Normal, Semibold).

**ModernTextInput** — AccessibleLabel, Align, Appearance, BasePaletteColor, BorderColor,
BorderStyle, BorderThickness, Color, ContentLanguage, Default, DisplayMode, Fill, Font,
FontWeight, Height, Italic, MaxLength, OnChange, PaddingBottom, PaddingLeft,
PaddingRight, PaddingTop, Placeholder, RadiusBottomLeft, RadiusBottomRight,
RadiusTopLeft, RadiusTopRight, Required, Size, Strikethrough, TriggerOutput, Type,
Underline, ValidationState, Visible, Width, X, Y.
Enums: `Appearance` (FilledDarker, FilledLighter, Outline) · `TextInputType` (Multiline,
Password, Search, SingleLine) · `TriggerOutput` (Delayed, FocusOut, Keypress) ·
`ValidationState` (Error, None) · `DisplayMode` (Disabled, Edit, View) · `Align` ·
`Font` · `FontWeight` · `BorderStyle`.
Output used: `.Text`.

**ModernDatePicker** — AccessibleLabel, Appearance, BasePaletteColor, BorderColor,
BorderStyle, BorderThickness, Color, ContentLanguage, DateTimeZone, DefaultDate,
DisplayMode, EndDate, Fill, Font, FontWeight, Format, Height, IsEditable, Italic,
OnChange, PaddingBottom, PaddingLeft, PaddingRight, PaddingTop, Placeholder,
RadiusBottomLeft, RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Size, StartDate,
StartOfWeek, Strikethrough, Underline, ValidationState, Visible, Width, X, Y.
Enums: `Appearance` (FilledDarker, FilledLighter, Outline) · `DatePickerFormat`
(LongAbbreviated, Short, YearMonth) · `DateTimeZone` (Local, UTC) · `StartOfWeek`
(Friday, Monday, MondayZero, Saturday, Sunday, Thursday, Tuesday, Wednesday) ·
`ValidationState` · `DisplayMode` · `Font` · `FontWeight` · `BorderStyle`.
Output used: `.SelectedDate`.

**ModernDropdown** — AccessibleLabel, Appearance, BasePaletteColor, BorderColor,
BorderStyle, BorderThickness, Color, ContentLanguage, Default, DisplayMode, Fill, Font,
FontWeight, Height, Italic, ItemDisplayText, Items, OnChange, PaddingBottom, PaddingLeft,
PaddingRight, PaddingTop, RadiusBottomLeft, RadiusBottomRight, RadiusTopLeft,
RadiusTopRight, Required, Size, Strikethrough, Underline, ValidationState, Visible,
Width, X, Y.
Enums: `Appearance` (FilledDarker, FilledLighter, Outline) · `ValidationState` ·
`DisplayMode` · `Font` · `FontWeight` · `BorderStyle`.
Output used: `.Selected` (a record — here `{ Label, Val }`).

**ModernCombobox** — AccessibleLabel, AllowExternalSelectedItems, Appearance,
BasePaletteColor, BorderColor, BorderStyle, BorderThickness, Color, ContentLanguage,
DefaultSelectedItems, DelayOutput, DisplayMode, Fill, Font, FontWeight, Height,
InputTextPlaceholder, IsSearchable, Italic, ItemDisplayText, Items, MultiValueDelimiter,
OnChange, PaddingBottom, PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft,
RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Required, SelectMultiple, Size,
Strikethrough, Underline, ValidationState, Visible, Width, X, Y.
Enums: `Appearance` (FilledDarker, FilledLighter, Outline) · `ValidationState` ·
`DisplayMode` · `Font` · `FontWeight` · `BorderStyle`.
Outputs used: `.Selected`, `.SelectedItems`.
The placeholder property is `InputTextPlaceholder`, **not** `Placeholder`.

**ModernButton** — AccessibleLabel, Align, Appearance, BasePaletteColor, BorderColor,
BorderStyle, BorderThickness, Color, ContentLanguage, DisplayMode, Font, FontWeight,
Height, Icon, IconRotation, IconStyle, Italic, Layout, OnSelect, PaddingBottom,
PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft, RadiusBottomRight,
RadiusTopLeft, RadiusTopRight, Size, Strikethrough, Text, Tooltip, Underline,
VerticalAlign, Visible, Width, X, Y.
Enums: `ButtonAppearance` (Outline, Primary, Secondary, Subtle, Transparent) ·
`ButtonLayout` (IconAfter, IconBefore, IconOnly, TextOnly) · `IconStyle` (Filled,
Outline) · `DisplayMode` · `Align` · `Font` · `FontWeight`.
`ModernButton` has **no** `Fill` — use `BasePaletteColor`.

**ModernIcon** — AccessibleLabel, BasePaletteColor, BorderColor, BorderStyle,
BorderThickness, ContentLanguage, DisplayMode, Fill, Height, Icon, IconColor, IconStyle,
OnSelect, PaddingBottom, PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft,
RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Rotation, Tooltip, Visible, Width, X, Y.
Enums: `IconStyle` (Filled, Outline) · `DisplayMode`.

---

## 8. Data reference for this screen

| Table | Power Fx name | Columns used here |
|---|---|---|
| Follow Ups | `'Follow Ups'` (quoted) | `cws_title` (String), `cws_duedate` (DateTime, Date-only + User-Local), `cws_status` (OptionSetValue), `cws_relatedtype` (OptionSetValue), `cws_RelatedContact` (DataEntity), `cws_RelatedApplication` (DataEntity), `cws_notes` (String) |
| Networking Contacts | `'Networking Contacts'` (quoted) | `cws_contactname` (String), `cws_networkingcontactid` (Guid) |
| Job Applications | `'Job Applications'` (quoted) | `cws_role` (String), `cws_Company` (DataEntity) → `cws_companyname` |

Compile-ready option-set literals used on this screen:

```
'Related Type (Follow Ups)'.Contact
'Related Type (Follow Ups)'.Application
'Related Type (Follow Ups)'.'None/Standalone'
'Status (Follow Ups)'.Open
```

Never filter on `cws_notes` — multiline String, not delegable. Never filter on
`cws_duedate` server-side — Date-only + User-Local, equality filtering is broken in this
org. This screen only writes that column; it never queries it.
