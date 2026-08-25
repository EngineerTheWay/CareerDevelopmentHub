# Screen Brief — Saved (confirmation)

> **Design snapshot — 2026-08-18.** This is a plan written *before* the canvas app was built,
> kept as a record of intent. It is not maintained against the shipped implementation and
> may describe fields or behaviour that changed during the build. For what actually
> exists, read the code.

| | |
|---|---|
| Action | **Create** |
| Logical screen | Saved / confirmation |
| Target file | `C:\Development\CareerDevelopmentHub\CareerDevelopmentHubCanvas\ScrSaved.pa.yaml` |
| YAML key | `ScrSaved` |
| Control name prefix | **`Svd`** |

Read `canvas-app-shared.md` first. Palette, typography, screen skeleton, top-bar pattern,
transitions and the state contract are pinned there and must not be re-derived.

---

## 1. Purpose

Confirm the save and offer the one or two next steps that actually follow from it,
prefilled to the record just created. This screen is the app's "toast": canvas has no
toast primitive, so the confirmation is a full screen. Do not label anything "toast" and
do not add a timer that auto-dismisses.

This screen reads state only. It writes nothing to Dataverse and has **no** data source
binding at all — every value comes from the five `varSaved*` / `varPrefillContactId`
globals.

---

## 2. Screen properties

```yaml
Screens:
  ScrSaved:
    Properties:
      Fill: =RGBA(252, 246, 233, 1)
    Children:
      - conSvdRoot: ...
```

No `OnVisible`, no `OnHidden`. The variables are set by whichever form screen navigated
here, and each next-step button sets what the destination needs before it navigates.

---

## 3. Control tree

```
conSvdRoot                      GroupContainer / AutoLayout   (the ONLY screen child)
├─ conSvdTopBar                 GroupContainer / AutoLayout   (56px, NO back chevron)
│   └─ txtSvdTitleBar           ModernText    ="Saved"
├─ conSvdBody                   GroupContainer / AutoLayout   (scrolls, gap 16, pad 16)
│   ├─ conSvdHero               GroupContainer / AutoLayout   Height =176
│   │   ├─ icoSvdCheck          ModernIcon
│   │   ├─ txtSvdHeadline       ModernText
│   │   └─ txtSvdDetail         ModernText
│   ├─ txtSvdNextHeading        ModernText                    Height =24
│   ├─ btnSvdLogInteraction     ModernButton                  Height =60  (conditional)
│   ├─ btnSvdAddFollowUp        ModernButton                  Height =60  (conditional)
│   ├─ btnSvdAnotherContact     ModernButton                  Height =60  (conditional)
│   └─ btnSvdAnotherFollowUp    ModernButton                  Height =60  (conditional)
└─ conSvdFooter                 GroupContainer / AutoLayout   Height =76
    └─ btnSvdDone               ModernButton
```

There is **no** back chevron on this screen. Going "back" from a confirmation would land
on a form holding a record that was already saved. `btnSvdDone` in the footer is the way
out, and every next-step button is also a way out.

---

## 4. Layout budget (phone, single column)

Root = `Parent.Height`; top bar 56 fixed; body `FillPortions: =1` with
`LayoutOverflowY: =LayoutOverflow.Scroll`; footer 76 fixed.

Body, `LayoutGap: =16`, padding 16 all round. At most **two** next-step buttons are ever
visible at once (see the matrix in section 6), and hidden AutoLayout children collapse
out of the flow:

| State | Body content height |
|---|---|
| one next step | 176 + 16 + 24 + 16 + 60 = 292, +32 padding = 324 |
| two next steps | 292 + 16 + 60 = 368, +32 padding = 400 |

Both fit comfortably; the body scroll exists only as insurance on very short devices.

`conSvdHero` internal budget (`LayoutDirection: =LayoutDirection.Vertical`,
`LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =8`, `PaddingTop: =20`,
`PaddingBottom: =20`, `PaddingLeft: =16`, `PaddingRight: =16`):
20 + 56 icon + 8 + 30 headline + 8 + 34 detail + 20 = 176.

`Stretch` on `conSvdHero` is required: with `Center` the headline would be sized to its
intrinsic width and the longer detail line would be clipped.

There are no horizontal rows apart from the top bar. Nothing wraps, nothing has a width
breakpoint, and no layout variable exists.

---

## 5. Control specifications

### `conSvdTopBar` / `txtSvdTitleBar`

Shared top-bar pattern. `txtSvdTitleBar.Text: ="Saved"`, `FillPortions: =1`,
`AlignInContainer: =AlignInContainer.Stretch`. `PaddingLeft: =16` on the bar (there is no
chevron to sit at 6).

### `conSvdHero`

```
Control: GroupContainer   Variant: AutoLayout
LayoutDirection:  =LayoutDirection.Vertical
LayoutAlignItems: =LayoutAlignItems.Stretch
LayoutGap: =8
Height: =176
PaddingTop: =20   PaddingBottom: =20   PaddingLeft: =16   PaddingRight: =16
Fill: =RGBA(255, 255, 255, 1)
BorderStyle: =BorderStyle.Solid   BorderThickness: =1
BorderColor: =RGBA(211, 201, 185, 1)
RadiusTopLeft: =12  RadiusTopRight: =12  RadiusBottomLeft: =12  RadiusBottomRight: =12
```

```
icoSvdCheck   ModernIcon
  Icon: ="CheckmarkCircle"
  IconStyle: =IconStyle.Filled
  IconColor: =RGBA(213, 141, 37, 1)
  Fill: =RGBA(255, 255, 255, 1)
  Width: =56   Height: =56
  AlignInContainer: =AlignInContainer.Center
  AccessibleLabel: ="Saved"

txtSvdHeadline   ModernText
  Text: =Switch(
      varSavedKind,
      "Contact",     "Contact saved",
      "Interaction", "Interaction logged",
      "FollowUp",    "Follow-up added",
      "Saved"
  )
  Size: =22   FontWeight: =FontWeight.Semibold
  Color: =RGBA(8, 19, 28, 1)
  Align: =Align.Center   VerticalAlign: =VerticalAlign.Middle
  Height: =30   Wrap: =false

txtSvdDetail   ModernText
  Text: =varSavedTitle
  Size: =14   FontWeight: =FontWeight.Normal
  Color: =RGBA(45, 63, 78, 1)
  Align: =Align.Center   VerticalAlign: =VerticalAlign.Top
  Height: =34   Wrap: =true
```

`txtSvdDetail` is the only wrapping text on the screen; 34px holds two lines at Size 14,
which covers a long contact name or a long follow-up title.

The `Switch` fallback `"Saved"` covers the case where the screen is reached with
`varSavedKind` still `""` (e.g. a Studio preview started on this screen). Nothing errors.

### `txtSvdNextHeading`

```
Text: ="What's next?"
Size: =16   FontWeight: =FontWeight.Semibold   Color: =RGBA(8, 19, 28, 1)
Height: =24   Wrap: =false
```

### Next-step buttons — shared styling

All four use:

```
Appearance: =ButtonAppearance.Secondary       # enum ButtonAppearance
BasePaletteColor: =RGBA(232, 221, 196, 1)
Color: =RGBA(8, 19, 28, 1)                    # dark text on the light secondary fill
Layout: =ButtonLayout.TextOnly                # enum ButtonLayout
Align: =Align.Left
Font: =Font.'Segoe UI'   Size: =16   FontWeight: =FontWeight.Semibold
Height: =60
PaddingLeft: =18
RadiusTopLeft: =12  RadiusTopRight: =12  RadiusBottomLeft: =12  RadiusBottomRight: =12
```

`Layout: =ButtonLayout.TextOnly` on all four: no Fluent icon name is set, so none can
silently fail to resolve.

### `btnSvdLogInteraction`

```
Text: ="Log an interaction with " & varSavedContactName
Visible: =varSavedKind = "Contact" && varSavedContactId <> ""
OnSelect: |
  =Set(varPrefillContactId, varSavedContactId);
  Set(varReturnTo, "");
  Navigate(ScrInteraction, ScreenTransition.Fade)
```

### `btnSvdAddFollowUp`

```
Text: ="Add a follow-up for " & varSavedContactName
Visible: =(varSavedKind = "Contact" || varSavedKind = "Interaction") && varSavedContactId <> ""
OnSelect: |
  =Set(varPrefillContactId, varSavedContactId);
  Set(varReturnTo, "");
  Navigate(ScrFollowUp, ScreenTransition.Fade)
```

Setting `varPrefillContactId` is what makes the destination arrive prefilled: on
`ScrInteraction` it feeds `cmbIntxContact.DefaultSelectedItems`; on `ScrFollowUp` it feeds
both `ddFlwType.Default` (which preselects "A contact") and
`cmbFlwContact.DefaultSelectedItems`. `Navigate` resets the target screen's controls, so
those defaults re-evaluate on arrival.

### `btnSvdAnotherContact`

```
Text: ="Log another interaction"
Visible: =varSavedKind = "Interaction"
OnSelect: |
  =Set(varPrefillContactId, "");
  Set(varReturnTo, "");
  Navigate(ScrInteraction, ScreenTransition.Fade)
```

### `btnSvdAnotherFollowUp`

```
Text: ="Add another follow-up"
Visible: =varSavedKind = "FollowUp"
OnSelect: |
  =Set(varPrefillContactId, "");
  Set(varReturnTo, "");
  Navigate(ScrFollowUp, ScreenTransition.Fade)
```

The two "another" buttons clear `varPrefillContactId` explicitly. Without that the just-
saved contact would silently reappear in a form the user opened to capture someone else.

### `btnSvdDone`

Shared save-button styling (same footer treatment, primary), plus:

```
Text: ="Done"
Appearance: =ButtonAppearance.Primary
BasePaletteColor: =RGBA(0, 72, 126, 1)
Color: =RGBA(252, 248, 240, 1)
Height: =52
DisplayMode: =DisplayMode.Edit
OnSelect: |
  =Set(varPrefillContactId, "");
  Set(varReturnTo, "");
  Set(varSavedKind, "");
  Set(varSavedTitle, "");
  Set(varSavedContactId, "");
  Set(varSavedContactName, "");
  Navigate(Screen1, ScreenTransition.Fade)
```

`btnSvdDone` resets the whole cross-screen state back to its `App.OnStart` values, so the
next capture starts clean. Navigating to `Screen1` re-runs its `OnVisible`, which refetches
the follow-up list — so a follow-up just created appears immediately if it is due today.

---

## 6. Visibility matrix

Exactly which next-step buttons appear, by `varSavedKind`:

| `varSavedKind` | `btnSvdLogInteraction` | `btnSvdAddFollowUp` | `btnSvdAnotherContact` | `btnSvdAnotherFollowUp` |
|---|---|---|---|---|
| `"Contact"` | yes | yes | no | no |
| `"Interaction"` | no | yes (if the interaction had a contact — it always does) | yes | no |
| `"FollowUp"` (related to a contact) | no | no | no | yes |
| `"FollowUp"` (standalone / application) | no | no | no | yes |
| `""` (fallback) | no | no | no | no |

Never more than two at once, which is what the layout budget in section 4 assumes.

`btnSvdAddFollowUp` additionally guards on `varSavedContactId <> ""` so its label can
never render as "Add a follow-up for " with a trailing blank.

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

**ModernButton** — AccessibleLabel, Align, Appearance, BasePaletteColor, BorderColor,
BorderStyle, BorderThickness, Color, ContentLanguage, DisplayMode, Font, FontWeight,
Height, Icon, IconRotation, IconStyle, Italic, Layout, OnSelect, PaddingBottom,
PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft, RadiusBottomRight,
RadiusTopLeft, RadiusTopRight, Size, Strikethrough, Text, Tooltip, Underline,
VerticalAlign, Visible, Width, X, Y.
Enums: `ButtonAppearance` (Outline, Primary, Secondary, Subtle, Transparent) ·
`ButtonLayout` (IconAfter, IconBefore, IconOnly, TextOnly) · `IconStyle` (Filled,
Outline) · `DisplayMode` (Disabled, Edit, View) · `Align` · `VerticalAlign` · `Font` ·
`FontWeight`.
`ModernButton` has **no** `Fill` property — use `BasePaletteColor`.

**ModernIcon** — AccessibleLabel, BasePaletteColor, BorderColor, BorderStyle,
BorderThickness, ContentLanguage, DisplayMode, Fill, Height, Icon, IconColor, IconStyle,
OnSelect, PaddingBottom, PaddingLeft, PaddingRight, PaddingTop, RadiusBottomLeft,
RadiusBottomRight, RadiusTopLeft, RadiusTopRight, Rotation, Tooltip, Visible, Width, X, Y.
Enums: `IconStyle` (Filled, Outline) · `DisplayMode`.

---

## 8. Data reference for this screen

None. This screen binds to **no** data source and writes **no** Dataverse record. It reads
only these globals, all of them Text:

`varSavedKind`, `varSavedTitle`, `varSavedContactId`, `varSavedContactName`,
`varPrefillContactId`, `varReturnTo`.
