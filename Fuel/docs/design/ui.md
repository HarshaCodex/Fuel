# Fuel mobile UI design

Source of truth for the React Native (Expo) client. Scope is the MVP: sign-in, text search and barcode logging, manual entry
with a personal food library, macro tracking, goals, dashboard, history, streaks. Photo, voice and AI features are out of scope.
Reference phone is 390 x 844 pt. Units are pt (density-independent). Never hard-code a colour, size or duration in a screen; use
the token names below (they are the keys to use in code).

## Principles
1. One purpose per screen. Each screen below states its single job; anything else moves elsewhere.
2. Warm and calm: paper-like neutrals, one indigo accent, generous whitespace, no promotional content.
3. Numbers are the hero. Calories and macros use large, tabular figures; chrome stays quiet.
4. Honest data: every food shows where its numbers came from (trust badge).
5. Motion only confirms an action or shows loading. No decorative animation.
6. No offline logging in the MVP. When offline, say so plainly, keep what the user typed, and offer Retry.

## 1. Tokens

### 1.1 Colour (`colors.*`)
Text pairs below are at least 4.5:1 on the surface named; UI shapes (borders of inputs, bars, ring) are at least 3:1.

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #FAF8F5 | #14120F | Screen background |
| surface | #FFFFFF | #1E1B17 | Cards, sheets, inputs, tab bar |
| surfaceMuted | #F3F0EB | #28241F | Chips, pressed rows, skeletons, segmented control track |
| border | #E6E1D9 | #38332C | Dividers, card outlines (decorative) |
| borderStrong | #7A7266 | #7A7266 | Input and checkbox outlines (3.6:1 or better) |
| text | #1F1B16 | #F5F1EA | Primary text (16:1) |
| textSecondary | #5E574D | #B8B0A3 | Supporting text (6.3:1 light, 8:1 dark) |
| textTertiary | #6F675C | #A39B8E | Captions, inactive tab (5.3:1 light, 6.2:1 dark) |
| placeholder | #7A7266 | #A39B8E | Input placeholder (4.7:1 on surface) |
| accent | #4F46E5 | #5B52EC | Primary button fill, active tab icon, ring progress |
| accentPressed | #4338CA | #4F46E5 | Pressed primary |
| accentText | #4F46E5 | #A5A0FA | Links and text buttons (5.9:1 on bg light, 8:1 dark) |
| accentSoft | #EEEDFC | #2A2753 | Selected chip, user-entered badge background |
| onAccent | #FFFFFF | #FFFFFF | Text on accent (6.3:1 or better) |
| ringTrack | #E4E0F7 | #35314F | Unfilled ring (decorative; the number carries meaning) |
| protein | #D04A1F | #F08A63 | Protein bar and dot |
| carbs | #A5660A | #E3A94A | Carbs bar and dot |
| fat | #0B8576 | #3CC4AE | Fat bar and dot |
| barTrack | #ECE7DF | #3A352E | Unfilled macro bar (bar fills are 3.6:1 or better on it) |
| success / successSoft | #166534 / #DCFCE7 | #86EFAC / #14301F | "USDA Verified" badge, success toast |
| info / infoSoft | #1D4ED8 / #DBEAFE | #93C5FD / #14233F | "Manufacturer Label" badge |
| caution / cautionSoft | #92400E / #FEF3C7 | #FCD34D / #3A2A0A | Over-goal note, offline banner, estimates (later phases) |
| danger / dangerSoft | #B42318 / #FDECEA | #FF8A80 / #3A1714 | Errors, destructive actions (6.2:1 on bg light) |
| scrim | rgba(31,27,22,0.45) | rgba(0,0,0,0.6) | Behind sheets |

Rule: meaning is never colour alone. Badges carry an icon and a label, errors carry an icon and text, over-goal carries words.

### 1.2 Type (`type.*`)
One family: the platform system font (`System`: SF Pro on iOS, Roboto on Android). No custom font download. Hierarchy comes from
size and weight. Use tabular figures (`fontVariant: ['tabular-nums']`) for every number.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| display | 44 / 48 | 700 | Ring centre number |
| title1 | 28 / 34 | 700 | Screen titles |
| title2 | 22 / 28 | 600 | Section titles, sheet titles |
| headline | 17 / 24 | 600 | Row titles, button labels, card titles |
| body | 17 / 24 | 400 | Default text, input text |
| callout | 15 / 20 | 400 | Supporting text, macro values |
| caption | 13 / 18 | 500 | Badges, tab labels, units, helper text |

All text honours the user's font size. Cap with `maxFontSizeMultiplier`: display 1.2, tab labels and badges 1.3, everything else 2.0.

### 1.3 Spacing (`space.*`, 4pt grid)
`xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`. Screen horizontal padding `lg` (16). Gap between cards `md` (12).
Gap between sections `xl` (24). Inside cards `lg` (16). Minimum gap between tappable targets `sm` (8).

### 1.4 Radius (`radius.*`)
`sm 8` (badges, chips inside rows), `md 12` (buttons, inputs, toasts), `lg 16` (cards, ring card), `xl 24` (top corners of sheets),
`full 999` (pills, FAB, avatar, progress bars).

### 1.5 Shadow (`shadow.*`, light theme; dark uses a 1pt `border` outline instead)
Shadow colour is the warm `#1F1B16`, never pure black.

| Token | Offset / blur / opacity / Android elevation | Use |
|---|---|---|
| none | - | Rows inside a card |
| sm | 0,1 / 3 / 0.06 / 1 | Cards, inputs on focus |
| md | 0,4 / 12 / 0.08 / 3 | Tab bar (upward, offset 0,-2), toast |
| lg | 0,8 / 24 / 0.14 / 8 | FAB, bottom sheets |

### 1.6 Motion (`motion.*`)
Easing `cubic-bezier(0.2, 0, 0, 1)`. `fast 120ms` press feedback; `base 200ms` sheet, toast, state swap; `slow 400ms` ring and bar
fill, played once when data first arrives or changes after a log. Skeleton shimmer 1200ms loop while loading only.
With Reduce Motion on: no fills or slides, use an instant swap or a 120ms fade.

### 1.7 Sizing
Touch target minimum 44 x 44. Button height lg 52, md 44. Input height 52. List row min height 64. Icon 24 (20 inside badges).
FAB 56. Tab bar 56 plus bottom safe area. Hit slop extends small icons to 44.

## 2. Components

**Button.** Label `headline`, radius `md`, horizontal padding `xl`, icon gap `sm`.
- Primary: fill `accent`, label `onAccent`. Pressed `accentPressed`. Disabled: fill `surfaceMuted`, label `textTertiary`. Loading: label replaced by a 20pt spinner, width fixed, taps ignored.
- Secondary: fill `surface`, 1.5pt `accent` outline, label `accentText`.
- Text: no fill, label `accentText`, min 44 high.
- Destructive: fill `danger`, label `onAccent` (confirmation dialogs only; swipe action uses it too).
- Sizes: lg (52, full width in forms, pinned above the keyboard or tab bar), md (44, inline).
- Focus (keyboard or switch access): 2pt `accent` ring offset 2.

**Text field.** Label `caption` above in `textSecondary`, field 52 high, `surface` fill, 1.5pt `borderStrong`, radius `md`, text `body`, placeholder `placeholder`. Optional unit suffix (`g`, `kcal`) in `textSecondary` inside the right edge.
- Focus: border `accent` 2pt plus `shadow.sm`. Filled: unchanged. Error: border `danger`, helper line below with alert icon and `danger` text (never colour alone). Disabled: fill `surfaceMuted`, text `textTertiary`.
- Numeric fields use `keyboardType="decimal-pad"` (calories, macros, serving) and `selectTextOnFocus`. Password field has a 44pt show/hide toggle.
- Helper text `caption` `textSecondary`. Errors appear on blur or submit, not on every keystroke.

**Card.** `surface`, radius `lg`, padding `lg`, `shadow.sm` (dark: 1pt `border`). Cards do not nest.

**Calorie ring.** 200 x 200 inside the ring card. Stroke 14, round caps, starts at 12 o'clock, clockwise. Track `ringTrack`, progress `accent`.
Centre: remaining calories in `display`, below it `caption` "kcal left". Under the ring: `callout` "1,450 of 2,200 eaten".
- Loading: track only plus skeleton text. Empty day (nothing logged): full-remaining number, no progress arc.
- Over goal: arc full in `caution`, centre shows the overage ("320") with caption "kcal over". Calm wording, no red, no alarm.
- Fill animates `slow` from the previous value. Accessible label: "750 calories remaining. 1,450 of 2,200 eaten." (one element).

**Macro pill (three, in a row).** Each `surface` card-like tile, radius `lg`, padding `md`, equal thirds with `sm` gaps, min height 88.
Top: 8pt dot in the macro colour plus name (`caption`, `textSecondary`). Middle: consumed grams in `headline` and "/ 165 g" in `caption`. Bottom: 6pt tall bar, radius `full`, fill = macro colour, track `barTrack`, width = min(consumed/goal, 1).
Over goal: bar full and the value text turns `caution`. Label: "Protein, 120 of 165 grams".

**Trust badge.** Height 24, padding 8 horizontal, radius `sm`, icon 16 plus `caption` label. Always shows icon and text.
| Source (API) | Label | Colours | Icon |
|---|---|---|---|
| `USDA` | USDA Verified | `success` on `successSoft` | check-circle |
| `OFF` | Manufacturer Label | `info` on `infoSoft` | tag |
| `USER` | You Entered | `accentText` on `accentSoft` | pencil |
Badge is informational, not a button, but tapping the meal row shows the source line in Food detail.

**Meal row.** Min height 64, `surface`, inside a card with `border` dividers between rows (inset `lg`). Left: food name (`headline`, 1 line, ellipsis; wraps to 2 lines at large text), below it trust badge and `caption` time. Right: calories `headline` with "kcal" `caption`, then a 44 x 44 "more" button (three-dot icon, `textSecondary`, label "More actions for <food>"). Below the name: `callout` macro line "P 46 - C 0 - F 5" in `textSecondary`.
- Swipe left reveals a Delete action (84 wide, `danger`, trash icon, "Delete" label). Full swipe deletes the row at once and shows a toast with Undo for 5s; the delete request is sent only when the toast ends, so Undo restores the row with no request. If the request fails, the row comes back with an error toast. Long press (400ms, light haptic) opens Edit entry. Pressed: `surfaceMuted`.
- Non-gesture alternative: the "more" button opens an action sheet with "Edit portion" and "Delete" (same results as long press and swipe, with the same Undo toast). The two are also exposed as screen reader custom actions.

**List row (generic).** Min height 64, optional 40pt leading icon on `surfaceMuted` (radius `md`), title `headline`, subtitle `callout` `textSecondary`, trailing chevron or value. Whole row tappable. Pressed `surfaceMuted`.

**Chips and segmented control.** Chip height 44 visual 36, radius `full`, `surfaceMuted`; selected `accentSoft` fill with 1.5pt `accent` border and `accentText` label. Segmented control: track `surfaceMuted`, radius `md`, 44 high, selected segment `surface` with `shadow.sm`.

**Bottom sheet.** `surface`, top radius `xl`, grabber 36 x 4 `borderStrong`, `shadow.lg`, `scrim` behind. Slides up `base`. Tap scrim, swipe down or the Close button dismisses it.

**Tab bar.** Exactly three tabs, left to right: Today, History, Profile. Height 56 plus safe area, `surface`, top hairline `border` (light also `shadow.md`). Each tab fills a third of the width (min 44 high), icon 24 above `caption` label. Active: icon and label `accent` (dark `accentText`), icon filled. Inactive: `textTertiary`, outline icon. Icons: sun-horizon (Today), calendar (History), person (Profile). No badges, no fourth tab. Hidden on Quick Log, Search, Scan, Manual Entry, Food detail and Edit entry (modal stack screens).

**FAB (Today only).** 56 circle, `accent`, white plus icon 28, `shadow.lg`, bottom right, `lg` from the edge and `lg` above the tab bar. Label "Log food". Hides while scrolling down, returns on scroll up (`base`). Never overlaps the last row: list has bottom padding 96.

**Toast.** Pill-shaped card, `radius md`, `shadow.md`, bottom `lg` above tab bar, text `callout`, optional text button ("Undo"). Variants by leading icon and tint: success (`successSoft`), error (`dangerSoft`), info (`surface`). Visible 4s (5s with an action), pauses while a screen reader is focused on it; announced as a live region.

**Empty state.** Centred, max width 280: 64pt line illustration in `textTertiary` (simple outline of a bowl or barcode, no mascots), `title2` headline, `callout` `textSecondary` sentence, one primary or text button. Copy is warm and short.

**Error state.** Same layout with an alert icon in `danger`. Always a plain-language cause and a Retry button; typed input is kept. Variants: inline (banner), full-screen (failed first load), field-level.

**Offline banner.** Full-width strip under the header, `cautionSoft`, `caution` text and wifi-off icon: "You're offline. Logging needs a connection." plus a Retry text button. It appears when a request fails for network reasons or the OS reports no connection, and clears on success. Submit buttons stay enabled (the tap simply retries) so nothing is lost.

**Skeleton.** `surfaceMuted` blocks matching the final layout with radius `md`, shimmer per motion tokens. Shown after 200ms of loading, replaced in place (no layout jump).

## 3. Navigation
Bottom tabs: Today (Dashboard), History, Profile. Each tab owns a stack. Logging flows and Edit entry open as full-screen modal stacks above the tabs with a back or close control at top left (44pt). Android back goes up one level, then exits the app from a tab root. No hamburger menus, no drawers. Auth screens sit in a separate stack shown when no session exists.

## 4. Screens
Common: screen title `title1` at `lg` padding (large title collapses on scroll), content scrolls under a `bg` header, each state below replaces the content area, never the whole chrome. Screen ids are used for screenshots.

### S01 Welcome and sign in (`auth-welcome`)
Purpose: get the user into their account.
Layout: wordmark "Fuel" (`title1`, `accent`) and one-line promise in `callout`; vertically near the upper third. Bottom stack: Continue with Apple (iOS only), Continue with Google (secondary buttons, lg, with brand glyphs), "or" divider, Email field, Password field, primary "Sign in", text buttons "Forgot password?" and "Create an account". Legal line `caption`.
States: loading (primary shows spinner, fields disabled); error (wrong credentials: field-level alert "Email or password is incorrect"; any failed sign-in shows the same generic message, never saying whether the email exists or is verified); offline (banner, retry, input kept); provider cancelled (no error shown).
Interactions: Return on Email moves to Password; Return on Password submits.

### S02 Create account (`auth-register`)
Purpose: create an email account. Layout: back, title "Create your account", Name, Email, Password (rules shown always: "8+ characters with upper and lower case, a number and a symbol", each rule ticks when met), primary "Create account", legal line. States: field errors on blur; loading; offline; email already registered shows the neutral banner "We couldn't create that account. If you already have one, sign in or reset your password." with both as text buttons (the message never confirms the email is registered). On success: S02b.

### S02b Verify email (`auth-verify`)
Purpose: confirm the emailed code. Layout: title "Check your email", `callout` "We sent a code to <email>" (same wording whatever the address), one Code field (up to 10 characters, auto-capitalise off, `oneTimeCode` autofill, centred `title1` with letter spacing), primary "Verify", text button "Resend code" with a cooldown label ("Resend in 0:45", disabled until 0), text button "Verify later" (accounts work unverified, so this goes to Onboarding). States: loading; invalid or expired code (field error "That code didn't work. Check it or request a new one."); rate limited (inline message "Too many tries. Try again in 5 minutes", resend disabled); resend success (info toast); offline (banner, code kept). Success: info toast "Email verified" and on to Onboarding (or Today if goals exist).

### S03 Forgot password (`auth-forgot`)
Purpose: request a reset code. Layout: back, title "Reset your password", `callout` "Enter your email and we'll send a code", one Email field, primary "Send code". Success is identical whether or not the account exists: the form is replaced by "If an account exists, a code is on its way" with primary "Enter code" (goes to S03b) and text button "Back to sign in". States: loading, offline, rate limited (inline message with wait time).

### S03b Reset password (`auth-reset`)
Purpose: set a new password with the emailed code. Layout: back, title "Choose a new password", Email (prefilled if coming from S03), Code field (as in S02b), New password (same rule ticks as S02), primary "Reset password", text button "Send a new code". States: invalid or expired code (field error "That code didn't work. Request a new one."), weak password (rule ticks), loading, rate limited, offline (all input kept). Success: toast "Password updated" and back to S01 with the email prefilled; the user signs in again.

### S04 Onboarding: body stats and goal (`onboarding`)
Purpose: set a starting calorie and macro goal. Three short steps with a progress dots indicator (no skip loop): 1 About you (age, gender (Male or Female, as the goal formula needs), height, weight, unit toggle metric or imperial), 2 Activity (five radio rows with a plain description each), 3 Your goal (Lose, Maintain, Gain as segmented control; for Lose or Gain a stepper for the daily calorie change in 50 kcal steps from 100 to 1,000, default 500, shown as "500 kcal below your maintenance") ending with a summary card: calorie goal and three macro grams, "You can change this anytime" and primary "Start tracking". "Set up later" text button on step 1 uses the default goal (2,000 kcal, balanced macros). States: field validation, loading while goals are calculated, error with Retry, offline.

### S05 Dashboard / Today (`dashboard`)
Purpose: show how today is going and what has been eaten.
Layout, top to bottom: header row (date title "Today", chevrons to step to a previous day, streak chip "12 day streak" with flame icon at right); ring card (calorie ring); macro pill row; section "Meals" with `title2`; meal rows grouped under small `caption` headings Breakfast, Lunch, Dinner, Snack (and "Other" for unlabelled), only for groups that have entries; FAB.
Interactions: pull to refresh (system spinner, `accent`); swipe a row to delete; long press to edit portion; the row "more" button does both without gestures; tap row for Food detail (read-only with source); tap FAB opens Quick Log; day chevrons change date, future days disabled.
States: loading (skeleton ring card, pills, three rows); empty (ring shows full goal, Meals section shows empty state "Nothing logged yet" with button "Log your first food"); error (full-screen error if first load fails, otherwise toast and stale data kept); offline (banner, cached last view stays visible, Retry); over goal (ring turns `caution`, see component).

### S06 Quick Log menu (`quick-log`)
Purpose: choose how to log. Bottom sheet over the dashboard, open for as short a time as possible.
Layout: title "Log food"; four large list rows: Search foods, Scan barcode, Enter manually, My Foods (each with icon and one-line hint); below, "Recent" with up to 5 recents as compact rows, each with a trailing 44pt "+" button that logs it at once with its last-used portion (default serving if none) and the meal label chosen by time of day, using the same rule as Food detail.
States: Recents loading (3 skeleton rows), no recents (section hidden), recents error (section shows "Couldn't load recents" with Retry; the four methods still work). Offline: banner inside the sheet; methods still open and show their own offline state.
Interactions: tapping "+" on a recent logs it, closes the sheet, shows toast "Added to Lunch. Undo". Here the entry is already saved, so Undo sends a delete for it. (Deleting a row on Today works the other way: the request waits until the toast ends.)

### S07 Search (`search`)
Purpose: find a food by name. Layout: back, search field (autofocus, clear button, "Search" return key), results list under it, each result a list row: name, brand and serving `callout`, trust badge, calories right; bottom of list loads next page.
States: idle (shows Recents, else a hint); loading (skeleton rows after 200ms); no results (empty state "No match for 'chikn'", buttons "Enter it manually" with the query prefilled, and "Scan barcode"); error (error state, Retry, query kept); offline (offline banner, Retry). Debounce 300ms, minimum 2 characters.
Interactions: tap a row opens Food detail; trailing "+" logs the default serving (as in Recent).

### S08 Barcode scan (`barcode`)
Purpose: read a product barcode. Layout: full-screen camera preview, 280 x 180 viewfinder with `radius lg` corner brackets in white, hint "Point at a barcode", close button top left, torch toggle top right, "Type the number instead" text button at the bottom. That button opens a sheet with one numeric field (`decimal-pad`, label "Barcode number", 8, 12 or 13 digits; inline error "Enter 8, 12 or 13 digits" until valid) and a primary "Look up" button that behaves like a scan result.
States: permission not asked (system dialog after a one-line explanation screen); permission denied (empty state "Camera access is off" with "Open Settings" and "Search instead"); looking up (viewfinder dims, spinner); found -> Food detail; not found (sheet "We don't have this product yet" with "Enter it manually", barcode prefilled, and "Scan again"); error/offline (sheet with Retry; scanning pauses until dismissed). Success feedback: one light haptic.
Note: web renders cannot show the camera; use the denied and not-found states in screenshots.

### S09 Manual entry (`manual-entry`)
Purpose: create a food from a label and log it. Layout: title "Enter a food", fields in this order: Name (text, autofocus), Brand (optional), Serving size (decimal) with unit selector (g, ml, oz, cup, tbsp, tsp, piece, serving), Calories, Protein, Carbs, Fat, Fiber (optional). Calories, protein, carbs, fat in a 2 x 2 grid of fields with `kcal` or `g` suffix. A switch row "Save to My Foods" (on by default). Primary "Log food" pinned above the keyboard.
Interactions: the numeric pad opens after Name; Next moves field to field; Done on the last field logs. Calories-from-macros hint (`caption`): "Macros add up to about 320 kcal" shown when it differs from entered calories by over 20%, informational only.
States: validation (name required, numbers not negative, errors on blur), saving, error (kept form, Retry), offline (banner, typed values kept, button retries). Leaving with edits asks "Discard this food?".

### S10 Food detail and portion confirm (`food-detail`)
Purpose: confirm how much was eaten, then log it.
Layout: back, food name `title1` (up to 3 lines), brand `callout`, trust badge and source line ("From USDA FoodData Central"); portion card: serving size stepper field with unit selector, quantity stepper (0.5 steps, min 0.5), meal chips (Breakfast, Lunch, Dinner, Snack; preselected by time of day: before 11 breakfast, 11 to 15 lunch, 15 to 17 snack, otherwise dinner); nutrition card showing calories in `display` and a P / C / F row that update live with portion; primary "Log food" pinned at the bottom with the calories ("Log 248 kcal"). Read-only mode (opened from a meal row) hides the log button and shows "Edit portion".
States: loading (skeleton), error (Retry, back), offline, validation (quantity above 0). Interactions: stepping values updates figures within `fast`; success closes the modal stack to Today with a toast.

### S11 My Foods (`my-foods`)
Purpose: manage and reuse foods the user created. Reached from the Quick Log row "My Foods" and from the Profile row "My Foods". Layout: title, search-in-list field, list rows (name, serving, calories, You Entered badge, 44pt "more" button), button "New food" (text button top right opens Manual entry in create-only mode).
Interactions: tap a row opens Food detail with "Log food" (the main job, as for search results). Edit is a separate action: swipe right, or "more" then "Edit", opens Manual entry prefilled and saves with an update. Delete: swipe left, or "more" then "Delete", with a confirmation dialog ("Past diary entries keep their numbers"). Empty: "Foods you create show up here." with "Enter a food". Loading, error and offline as in Search.

### S12 Edit entry (`edit-entry`)
Purpose: change the portion, quantity, meal or time of one logged entry. Opened by long press, or by "more" then "Edit portion", on a meal row. Layout: same as Food detail portion card with the food name as title, a time row (tap for time picker), primary "Save changes", destructive text button "Delete entry" at the bottom. States: saving, error with Retry and edits kept, offline, delete confirmation dialog (Delete / Cancel). Success returns to Today and updates the ring over `slow`.

### S13 History (`history`)
Purpose: look back over past days and open one. Layout: title; segmented control "7 days / 30 days / 90 days" (default 7); a summary card (average calories, days on goal, current streak, longest streak); a bar chart of calories with the goal as a dashed `borderStrong` line (bars `accent`, today highlighted, every bar labelled for screen readers). 7 and 30 days show one bar per day (8pt gap at 7, 2pt at 30); 90 days groups bars by week (average per logged day) so labels stay readable. Below, a list of days newest first, each row: weekday and date, calories, "P 120 - C 140 - F 45" macro totals in `callout`, entry count ("4 entries"), and a thin bar vs goal. Tapping a day opens a Day summary screen: that day's ring, macro pills and meals (same components and row actions as Today), plus a source line "8 of 9 foods from verified data".
States: loading (skeletons), empty ("Your history starts with your first log" with button to Today), error, offline (banner, last data kept), days with no logs show "No entries" in `textTertiary`.

### S14 Profile (`profile`)
Purpose: view and change who the user is tracking as. Layout: title; account card (initial avatar 56 `accentSoft`, name, email, timezone such as "Asia/Kolkata", and an "Edit profile" text button); "Goals" card (calorie goal in `headline`, three macro goals, auto-calculated note; the whole card and its "Edit goals" text button open the Edit goals sheet); "Body stats" card (height, weight, age, gender, activity; the card and its "Edit" button open the Edit body stats sheet); list rows: My Foods, Units (metric or imperial), Appearance (System, Light, Dark), Sign out; at the very bottom a quiet "Delete account" text button in `danger`.
Edit profile sheet: Name field and Timezone row (opens a searchable list of IANA timezones, device timezone suggested first), Save; saving shows a success toast and changes which calendar day Today shows. Edit goals sheet: calorie goal field; protein, carbs, fat in grams with a live "= 100%" check of calories from macros; "Recalculate from my body stats" secondary button with goal Lose, Maintain, Gain and pace; Save. Edit body stats sheet: the onboarding fields, Save recalculates goals only if the user confirms via a switch "Update my goals too".
Destructive flows: Sign out asks nothing (single tap, returns to S01). Delete account opens a dialog describing what is removed, password field (or typing DELETE for sign-in by Apple or Google), destructive "Delete account".
States: loading (skeleton cards), error (Retry), offline (banner; edits blocked with explanation but fields keep values), saving.

## 5. Flows

**First run.** Launch -> S01 Welcome. New user: Create account (S02) -> Verify email code (S02b, can be skipped) -> Onboarding (S04) -> Today (empty). Today's empty state points at the single "Log your first food" button. Returning signed-in user: launch lands directly on Today; session restored from secure storage with a skeleton, never a login flash.

**Sign-in.** Social: tap Continue with Apple or Google -> system sheet -> Today (or Onboarding if no goals set). Email: two fields, Return submits. Failures stay on the screen with inline errors and typed email kept. Session expiry returns to S01 with an info toast "Please sign in again".

**Log a food in the fewest taps.**
1. Repeat food: Today -> FAB -> "+" on a Recent row. Two taps, no typing, toast with Undo.
2. Searched food: Today -> FAB -> Search -> type -> "+" on result (4 taps plus typing), or tap result -> adjust -> "Log" (5 taps).
3. Barcode: Today -> FAB -> Scan -> Food detail -> "Log" (4 taps, no typing, default portion).
4. New food: Today -> FAB -> Enter manually -> fill label values -> "Log food".
After every log the user lands on Today, the ring and bar animate (`slow`), and a toast confirms. Mistakes are fixed by Undo, swipe-delete, or long-press edit.

## 6. Accessibility
- Contrast: all text 4.5:1 or better in both themes (values in 1.1). Non-text UI (input borders, bar fills, focus ring) 3:1 or better. Re-check any new colour before adding it as a token.
- Touch targets: 44 x 44 pt minimum for every control including icon buttons, chips, steppers, tab items, the row "more" button and the swipe action; gaps of 8pt or more.
- Screen reader: every control has `accessibilityRole` and a label that includes state and units. Examples: ring "750 calories remaining, 1,450 of 2,200 eaten"; macro "Protein, 120 of 165 grams"; meal row "Chicken breast, lunch, 248 calories, USDA Verified, 12:30"; FAB "Log food"; tab "Today, tab, 1 of 3, selected". Decorative icons and illustrations are hidden. Headings use the `header` role. Swipe and long-press actions are also exposed as custom accessibility actions ("Delete", "Edit portion"), and have a visible "more" button for everyone else. Toasts and errors are live regions. Focus moves to the first field with an error after a failed submit, and to the sheet title when a sheet opens.
- Large text: layouts reflow; rows grow and wrap instead of truncating below 200% except `display` (capped 1.2), tab labels and badges (1.3). Macro pills stack vertically at 150% and above. No fixed-height text containers.
- Colour independence: badges, errors and over-goal states use icon plus words. Macros have names, not just colours.
- Motion: respect Reduce Motion (see 1.6). No flashing, no auto-playing animation.
- Keyboard and forms: labels always visible (not only placeholders), correct `textContentType` and `autoComplete` for email and password, numeric keyboards for numbers, Return keys advance, forms scroll the focused field above the keyboard.
- Language: plain, kind, short. Say "Couldn't load" not "Error 500". Never shame (no red for going over).
- Verification note: web screenshots can check layout, colour, spacing and text but cannot prove gestures, camera, haptics, keyboard behaviour or screen reader output; those need a manual device pass.
