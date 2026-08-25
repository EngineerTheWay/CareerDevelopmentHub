# Screen Brief — Screen1 / Home (EDIT)

| | |
|---|---|
| Action | **Modify** |
| Logical screen | Home |
| Target file | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\Screen1.pa.yaml` |
| YAML key | `Screen1` |
| Control name prefix | `Home` |

Read `canvas-app-shared.md` first — especially **section 0** (the file is Studio-normalized;
this screen is on **logical** column names), **section 8** (state contract, `GUID()` guard)
and **section 13** (the modal overlay pattern).

**Do not rename `Screen1`** — the user will do that in Studio. Do not touch `App.pa.yaml`.
Do not touch any other screen file.

---

## Goal

Tapping a follow-up's check no longer completes it. It captures the follow-up and opens a
modal confirmation dialog offering three actions. The follow-up is completed **only** by
"Complete + log" or "Complete"; "Cancel" and scrim-dismiss leave it Open.

---

## 1. Row tap — capture only, no `Patch`

`btnHomeRowComplete.OnSelect` and `txtHomeRowTitle.OnSelect` currently each contain an
identical `Patch` + two `RemoveIf` calls. Replace **both** with this identical capture
formula. Nothing is written to Dataverse here.

```
=Set(varPromptFollowUpId, Text(ThisItem.cws_followupid));
Set(varPromptTitle, ThisItem.cws_title);
Set(
    varPromptContactId,
    If(
        ThisItem.cws_relatedtype = 'Related Type (Follow Ups)'.Contact,
        Text(ThisItem.cws_RelatedContact.cws_networkingcontactid),
        ""
    )
);
Set(
    varPromptAppId,
    If(
        ThisItem.cws_relatedtype = 'Related Type (Follow Ups)'.Application,
        Text(ThisItem.cws_RelatedApplication.cws_jobapplicationid),
        ""
    )
);
Set(varShowLogPrompt, true)
```

Everything is captured **at tap time**, inside the gallery's row scope, into Text globals.
The dialog never needs `ThisItem` and never needs a `LookUp` to render, so no display
formula on this screen ever calls `GUID()`.

`varPromptFollowUpId`, `varPromptContactId` and `varShowLogPrompt` are declared in
`App.OnStart`. `varPromptTitle` and `varPromptAppId` are Screen1-originated globals — see
shared plan section 8. Do **not** add them to `App.pa.yaml`.

`btnHomeRowComplete` also updates two strings, since it no longer completes anything on tap:

```yaml
AccessibleLabel: ="Complete " & ThisItem.cws_title
Tooltip: ="Complete this follow-up"
```

Everything else about the gallery, its rows, the badge, the tiles and the top bar is
**unchanged**. `OnVisible` and `icoHomeRefresh.OnSelect` are unchanged.

---

## 2. Screen `Children:` — add one sibling

`Screen1.Children:` becomes exactly two entries, in this order:

```
- conHomeRoot        (unchanged, still holds every non-overlay control)
- conHomeOverlay     (new, last -> renders on top)
```

This is the one sanctioned exception to the "one root per screen" rule, and it is forced by
two verified facts: `GroupContainer` has **no** `OnSelect` input property, and a
`GroupContainer` with `Variant: AutoLayout` lays children out in flow and ignores their
`X`/`Y`. An overlay therefore cannot live inside `conHomeRoot`. The dialog is a
**screen-level** overlay driven by `varShowLogPrompt` — it is not inside the gallery.

---

## 3. `conHomeOverlay`

```yaml
- conHomeOverlay:
    Control: GroupContainer
    Variant: ManualLayout
    Properties:
      Height: =Parent.Height
      Visible: =varShowLogPrompt
      Width: =Parent.Width
      X: =0
      Y: =0
```

`Variant: ManualLayout` is mandatory here and is what makes child `X`/`Y` meaningful. Give
it no `Fill` — the scrim supplies the tint.

Children, in this order (document order is Z order):

### 3a. `txtHomeScrim` — the dismissable backdrop

A `ModernText`, not a container, because `ModernText` has **both** `Fill` and `OnSelect`.

```yaml
- txtHomeScrim:
    Control: ModernText
    Properties:
      AccessibleLabel: ="Dismiss dialog"
      Fill: =RGBA(8, 19, 28, 0.55)
      Height: =Parent.Height
      OnSelect: |-
        =Set(varShowLogPrompt, false);
        Set(varPromptFollowUpId, "");
        Set(varPromptContactId, "");
        Set(varPromptAppId, "");
        Set(varPromptTitle, "")
      Text: =""
      Width: =Parent.Width
      X: =0
      Y: =0
```

`OnSelect` must be **byte-identical** to `btnHomeDlgCancel.OnSelect` — scrim-dismiss is
exactly Cancel and completes nothing.

### 3b. `conHomeDialog` — the card

Height budget: padding 20 + title 28 + gap 12 + body 44 + gap 12 + primary 52 + gap 12 +
row 52 + padding 20 = **252**.

White on a dark scrim, so it **keeps its default drop shadow** — do not set `DropShadow`.

```yaml
- conHomeDialog:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      Fill: =RGBA(255, 255, 255, 1)
      Height: =252
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutDirection: =LayoutDirection.Vertical
      LayoutGap: =12
      PaddingBottom: =20
      PaddingLeft: =20
      PaddingRight: =20
      PaddingTop: =20
      RadiusBottomLeft: =12
      RadiusBottomRight: =12
      RadiusTopLeft: =12
      RadiusTopRight: =12
      Width: =Min(Parent.Width - 48, 380)
      X: =(Parent.Width - Self.Width) / 2
      Y: =(Parent.Height - Self.Height) / 2
```

`LayoutAlignItems: =LayoutAlignItems.Stretch` is required — with `Start` or `Center` the
title and body text would be sized to their intrinsic width and silently clipped.

---

## 4. Dialog children

### `txtHomeDlgTitle`

```yaml
AccessibleLabel: ="Log an interaction?"
AlignInContainer: =AlignInContainer.Stretch
Color: =RGBA(8, 19, 28, 1)
Font: =Font.'Segoe UI'
FontWeight: =FontWeight.Semibold
Height: =28
Size: =18
Text: ="Log an interaction?"
Wrap: =false
```

### `txtHomeDlgBody`

Shows which follow-up is being acted on. `Wrap: =true`, so a long title stays readable.

```yaml
AccessibleLabel: ="Follow-up " & varPromptTitle
AlignInContainer: =AlignInContainer.Stretch
Color: =RGBA(45, 63, 78, 1)
Font: =Font.'Segoe UI'
Height: =44
Size: =13
Text: =varPromptTitle
Wrap: =true
```

### `btnHomeDlgCompleteLog` — primary, full width, on top

```yaml
AccessibleLabel: ="Complete this follow-up and log an interaction"
AlignInContainer: =AlignInContainer.Stretch
Appearance: =ButtonAppearance.Primary
BasePaletteColor: =RGBA(0, 72, 126, 1)
Color: =RGBA(252, 248, 240, 1)
Font: =Font.'Segoe UI'
FontWeight: =FontWeight.Semibold
Height: =52
Layout: =ButtonLayout.TextOnly
RadiusBottomLeft: =12
RadiusBottomRight: =12
RadiusTopLeft: =12
RadiusTopRight: =12
Size: =16
Text: ="Complete + log"
```

`OnSelect`:

```
=Patch(
    'Follow Ups',
    LookUp('Follow Ups', cws_followupid = GUID(varPromptFollowUpId)),
    { cws_status: 'Status (Follow Ups)'.Completed,
      cws_completeddate: Today() }
);
RemoveIf(colHomeDue, cws_followupid = GUID(varPromptFollowUpId));
RemoveIf(colHomeOpen, cws_followupid = GUID(varPromptFollowUpId));
Set(varPrefillContactId, varPromptContactId);
Set(varPrefillAppId, varPromptAppId);
Set(varPrefillIntxName, varPromptTitle);
Set(
    varIntxCompanyId,
    If(
        Len(varPromptContactId) > 0,
        Text(LookUp('Networking Contacts', cws_networkingcontactid = GUID(varPromptContactId)).cws_Company.cws_companyid),
        Len(varPromptAppId) > 0,
        Text(LookUp('Job Applications', cws_jobapplicationid = GUID(varPromptAppId)).cws_Company.cws_companyid),
        ""
    )
);
Set(varReturnTo, "");
Set(varShowLogPrompt, false);
Set(varPromptFollowUpId, "");
Set(varPromptContactId, "");
Set(varPromptAppId, "");
Set(varPromptTitle, "");
Navigate(ScrInteraction, ScreenTransition.CoverRight)
```

Statement order matters: both `RemoveIf` calls read `varPromptFollowUpId`, so they run
before it is cleared, and `Navigate` runs last.

**Prefill mapping** — this is what the capture in step 1 and the assignments above deliver:

| `cws_relatedtype` | `varPrefillContactId` | `varPrefillAppId` | `varIntxCompanyId` |
|---|---|---|---|
| `Contact` | the related contact's id | `""` | that contact's company |
| `Application` | `""` — deliberately **empty**; Interactions require a contact and the user picks it, with the picker already narrowed | the related application's id | that application's company |
| `None/Standalone` | `""` | `""` | `""` |

In every case `varPrefillIntxName` carries the follow-up's `cws_title`.

`GUID()` is only ever reached here inside a branch guarded by `Len(...) > 0`, or from a
button that can only be pressed while the dialog is open — at which point
`varPromptFollowUpId` is guaranteed non-empty.

### `conHomeDlgRow` — the secondary action row

Horizontal, `Complete` first (left) and `Cancel` second (right), each taking half the width.

```yaml
- conHomeDlgRow:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255, 255, 255, 1)
      Height: =52
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutDirection: =LayoutDirection.Horizontal
      LayoutGap: =12
      LayoutMinHeight: =52
```

White on white, so leave its shadow at the default. Its two children each carry
`FillPortions: =1` and `LayoutMinWidth: =120`, which fits "Complete" and "Cancel" at
`Size: =15` even on the narrowest phone (dialog width floor 380 - 48 outer - 40 padding -
12 gap = 140 per button).

#### `btnHomeDlgComplete` — LEFT, secondary beige

```yaml
AccessibleLabel: ="Complete this follow-up without logging an interaction"
Appearance: =ButtonAppearance.Secondary
BasePaletteColor: =RGBA(232, 221, 196, 1)
Color: =RGBA(8, 19, 28, 1)
FillPortions: =1
Font: =Font.'Segoe UI'
FontWeight: =FontWeight.Semibold
Height: =52
Layout: =ButtonLayout.TextOnly
LayoutMinWidth: =120
RadiusBottomLeft: =12
RadiusBottomRight: =12
RadiusTopLeft: =12
RadiusTopRight: =12
Size: =15
Text: ="Complete"
```

`OnSelect` — completes and dismisses, **no navigation**:

```
=Patch(
    'Follow Ups',
    LookUp('Follow Ups', cws_followupid = GUID(varPromptFollowUpId)),
    { cws_status: 'Status (Follow Ups)'.Completed,
      cws_completeddate: Today() }
);
RemoveIf(colHomeDue, cws_followupid = GUID(varPromptFollowUpId));
RemoveIf(colHomeOpen, cws_followupid = GUID(varPromptFollowUpId));
Set(varShowLogPrompt, false);
Set(varPromptFollowUpId, "");
Set(varPromptContactId, "");
Set(varPromptAppId, "");
Set(varPromptTitle, "")
```

#### `btnHomeDlgCancel` — RIGHT, low-emphasis outline

Visually different from both other actions: no fill, a `border`-coloured outline and
`mutedFg` text. It is a benign dismissal, so it is deliberately **not** destructive red —
`RGBA(176, 10, 29, 1)` must not appear on this control.

```yaml
AccessibleLabel: ="Cancel, leave this follow-up open"
Appearance: =ButtonAppearance.Outline
BorderColor: =RGBA(211, 201, 185, 1)
Color: =RGBA(45, 63, 78, 1)
FillPortions: =1
Font: =Font.'Segoe UI'
FontWeight: =FontWeight.Semibold
Height: =52
Layout: =ButtonLayout.TextOnly
LayoutMinWidth: =120
RadiusBottomLeft: =12
RadiusBottomRight: =12
RadiusTopLeft: =12
RadiusTopRight: =12
Size: =15
Text: ="Cancel"
```

`OnSelect` — byte-identical to `txtHomeScrim.OnSelect`. **No `Patch`, no `RemoveIf`.**

```
=Set(varShowLogPrompt, false);
Set(varPromptFollowUpId, "");
Set(varPromptContactId, "");
Set(varPromptAppId, "");
Set(varPromptTitle, "")
```

---

## 5. Compile-ready enum and option-set literals used on this screen

```
'Status (Follow Ups)'.Completed
'Related Type (Follow Ups)'.Contact
'Related Type (Follow Ups)'.Application
'Related Type (Follow Ups)'.'None/Standalone'
```

`cws_status` uses `'Status (Follow Ups)'` (Open / Completed). `statecode` uses
`'Status (Follow Ups)_1'` (Active / Inactive) and this app never touches it.
`'None/Standalone'` contains a slash and must be single-quoted after the dot.

Control enums:

```
Appearance      -> ButtonAppearance.Primary / ButtonAppearance.Secondary / ButtonAppearance.Outline
Layout          -> ButtonLayout.TextOnly / ButtonLayout.IconOnly
Font            -> Font.'Segoe UI'
FontWeight      -> FontWeight.Semibold
LayoutDirection -> LayoutDirection.Vertical / LayoutDirection.Horizontal
LayoutAlignItems-> LayoutAlignItems.Stretch
AlignInContainer-> AlignInContainer.Stretch
ScreenTransition-> ScreenTransition.CoverRight
```

---

## 6. Control property reference

Only the valid **input** property names are listed.

### `GroupContainer` — `Variant` is **mandatory**: `ManualLayout` for `conHomeOverlay`, `AutoLayout` for `conHomeDialog` and `conHomeDlgRow`

All variants: `BorderColor`, `BorderStyle`, `BorderThickness`, `ContentLanguage`,
`DropShadow`, `EnableChildFocus`, `Fill`, `Height`, `PaddingBottom`, `PaddingLeft`,
`PaddingRight`, `PaddingTop`, `RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`,
`RadiusTopRight`, `Visible`, `Width`, `X`, `Y`.
AutoLayout adds: `LayoutAlignItems`, `LayoutDirection`, `LayoutGap`,
`LayoutJustifyContent`, `LayoutOverflowX`, `LayoutOverflowY`, `LayoutWrap`.
ManualLayout adds: `ChildTabPriority`.
As an AutoLayout child it also accepts `LayoutMinWidth`, `LayoutMaxWidth`,
`LayoutMinHeight`, `LayoutMaxHeight`, `FillPortions`, `AlignInContainer`.

`DropShadow` enum values: `Bold, ExtraBold, Light, None, Regular, Semibold, Semilight`.

### `ModernText`

`AccessibleLabel`, `Align`, `AutoHeight`, `BorderColor`, `BorderStyle`, `BorderThickness`,
`Color`, `ContentLanguage`, `DisplayMode`, `Fill`, `Font`, `FontWeight`, `Height`,
`Italic`, `OnSelect`, `PaddingBottom`, `PaddingLeft`, `PaddingRight`, `PaddingTop`,
`RadiusBottomLeft`, `RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`, `Size`,
`Strikethrough`, `Text`, `Underline`, `VerticalAlign`, `Visible`, `Width`, `Wrap`, `X`, `Y`.

`Fill` and `OnSelect` are both valid inputs — that is why the scrim is a `ModernText`.

### `ModernButton`

`AccessibleLabel`, `Align`, `Appearance`, `BasePaletteColor`, `BorderColor`, `BorderStyle`,
`BorderThickness`, `Color`, `ContentLanguage`, `DisplayMode`, `Font`, `FontWeight`,
`Height`, `Icon`, `IconRotation`, `IconStyle`, `Italic`, `Layout`, `OnSelect`,
`PaddingBottom`, `PaddingLeft`, `PaddingRight`, `PaddingTop`, `RadiusBottomLeft`,
`RadiusBottomRight`, `RadiusTopLeft`, `RadiusTopRight`, `Size`, `Strikethrough`, `Text`,
`Tooltip`, `Underline`, `VerticalAlign`, `Visible`, `Width`, `X`, `Y`.

`Appearance` uses the enum **`ButtonAppearance`** (`Outline, Primary, Secondary, Subtle,
Transparent`) — not the `Appearance` enum used by inputs. `Icon` is **Text**.

---

## 7. Layout / responsiveness note

Phone-only, single column. The overlay derives every dimension directly from
`Parent.Width` / `Parent.Height` and `Self.Width` / `Self.Height`; **no layout variable is
set in `OnVisible`**, and there is no `LayoutWrap` or width breakpoint on this screen.

- Dialog width `=Min(Parent.Width - 48, 380)` keeps a 24px margin on the narrowest phone
  and caps the card on a wide one.
- All three action buttons are 52px tall, above the 48px tap-target floor, and the dialog is
  vertically centred so they stay thumb-reachable.
- Dialog card content is 212px inside 40px of vertical padding = the declared `Height: =252`;
  it never needs to scroll, so no `LayoutOverflowY` is set on it.
- Foreground on every surface: `RGBA(252, 248, 240, 1)` on the blue primary button,
  `RGBA(8, 19, 28, 1)` on the beige secondary button, `RGBA(45, 63, 78, 1)` on the white
  card for the Cancel button and the body text, `RGBA(8, 19, 28, 1)` on white for the title.
  Nothing renders dark-on-dark.

---

## 8. Acceptance checks

- Tapping the row check or the row title writes **nothing** to Dataverse; it only opens the
  dialog.
- The dialog reads "Log an interaction?" and names the follow-up beneath it.
- "Complete + log" completes the follow-up, removes it from `colHomeDue` and `colHomeOpen`,
  and navigates to ScrInteraction with the prefill mapping in the table above.
- "Complete" completes and dismisses, with no navigation; the row leaves the list.
- "Cancel" and a tap on the scrim both dismiss with the follow-up still Open, and their
  `OnSelect` formulas are identical.
- "Complete" sits on the left and "Cancel" on the right; "Cancel" is neither blue nor red.
- The overlay renders above the tiles, the gallery and the top bar.
- No new global is added to `App.pa.yaml`.
- `Screen1` is still named `Screen1`.
- Compile is clean.
