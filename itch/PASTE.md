# itch.io page: exactly what to put in each field

Everything below is ready to paste. Nothing here claims anything the game does
not do, which matters more on the accessibility fields than anywhere else.

Create the page at **https://itch.io/game/new**.

---

## Upload

| Field | Value |
|---|---|
| File | `itch/beamline-web.zip` (172 KB) |
| Tick | **This file will be played in the browser** |

The zip has `index.html` at its root and runs with no network access at all,
which has been verified by extracting it and loading it from a bare static
server with request logging on.

---

## The basics

| Field | Value |
|---|---|
| **Title** | `Beamline` |
| **Project URL** | `beamline` |
| **Short description** | `Route coloured light through mirrors, splitters and filters. Twenty levels, exact piece budgets, no guessing.` |
| **Classification** | Games |
| **Kind of project** | HTML |
| **Release status** | Released |
| **Pricing** | No payments |

---

## Embed options

| Field | Value |
|---|---|
| Embed type | Embed in page |
| Width | `1000` |
| Height | `720` |
| **Fullscreen button** | **Tick.** This matters: the board fits the frame but the side panel runs below it, and fullscreen is how someone reaches the level list without scrolling the itch page. |
| Mobile friendly | Tick, orientation **landscape** |
| Automatically start on page load | Tick |

At 1000x720 the whole board is visible without scrolling, with the level name
and controls beside it. The level picker and legend sit below the fold, which is
why the fullscreen button is not optional.

---

## Description

> Paste this into the description editor. itch accepts basic formatting; the
> headings below are plain bold lines so nothing depends on its markdown.

**Light goes in. You decide where it comes out.**

A lamp fires a beam across a grid. You place mirrors to turn it, splitters to
copy it, and work around walls and filters until every sensor is reading the
colour it wants.

Colour mixes the way light actually mixes. Red and green arriving at the same
sensor make yellow. All three make white. A sensor that wants green is **not**
satisfied by receiving red and green, so part of the puzzle is keeping colours
apart as much as bringing them together.

Later on some sensors want darkness instead, and the problem inverts: now stray
light is the thing to route around.

**Twenty levels across two chapters.** Every budget is exactly the size of the
optimal solution, so there is no stumbling into a win and no padding. Each level
has been proved solvable by an exhaustive search before shipping.

**What is in it**

- Twenty hand-edited levels in two chapters
- Mirrors, splitters, colour filters, and sensors that want darkness
- Undo, a clear board, and a solution you can reveal if a level beats you
- Progress saved in your browser, never sent anywhere

**Playing without a mouse**

Fully keyboard playable. Arrow keys move around the board, Enter places and
cycles a piece, and every cell announces what it holds. Nothing is timed and
nothing needs reflexes.

**Playing without colour**

Every lamp, filter and sensor carries a letter code (R, G, B, Y, M, C, W, and D
for darkness), shown by default. A sensor receiving the wrong colour shows both
what it wants and what it is getting. A puzzle about mixing colour should not
require you to see colour, so none of the rules are carried by hue alone. The
codes can be switched off if you would rather read the board by colour.

**No account, no cookies, no tracking, no network requests after it loads.**

Source is at https://github.com/gplonisch/beamline

---

## Metadata ("More information")

| Field | Value |
|---|---|
| **Genre** | Puzzle |
| **Tags** | `puzzle`, `logic`, `color`, `minimalist`, `accessible`, `keyboard`, `singleplayer`, `browser`, `relaxing`, `no-ads` |
| **Average session** | About a half-hour |
| **Languages** | English |
| **Inputs** | Keyboard, Mouse |
| **Multiplayer** | None |
| **Custom noun** | `puzzle` |

### Accessibility

Tick only these two:

- [x] **Color-blind friendly** - every lamp, filter and sensor carries a letter
      code, on by default, and no rule depends on hue alone.
- [x] **Interactive tutorial** - the first chapter introduces one mechanic at a
      time with a hint on each level.

Leave these **unticked**, and the reason matters:

- [ ] Blind friendly. Every cell has a generated accessible name and there is a
      live region announcing what changed, and the automated WCAG 2.1 AA checks
      pass in both colour schemes. But it has not been tested with a real screen
      reader user, and ticking this box is a promise to somebody who will rely
      on it. Tick it after testing, not before.
- [ ] High-contrast. The contrast passes AA, but there is no dedicated
      high-contrast mode, which is what this box means.
- [ ] Configurable controls, One button, Textless, Subtitles. None apply.

---

## Community and visibility

| Field | Value |
|---|---|
| Community | Comments |
| Visibility | Draft while you check it, then Public |

Before switching to public, open the draft page and confirm the game loads in
the frame, the fullscreen button appears, and the cover looks right at the small
size it gets in search results.

---

## Images

| Slot | File | Size |
|---|---|---|
| Cover image | `itch/cover.png` | 630x500 |
| Screenshot | `itch/shot-9.png` | colour mixing |
| Screenshot | `itch/shot-13.png` | the darkness sensor |
| Screenshot | `itch/shot-16.png` | crossing beams |
| Screenshot | `itch/shot-18.png` | one lamp, three filters |

All five are real captures of the running game taken through Playwright by
`itch/shots.mjs`, not mockups. Regenerate them after any visual change:

```bash
node itch/shots.mjs      # screenshots, straight from the game
python3 itch/cover.py    # composes the cover from board-18.png
./itch/build_zip.sh      # repackages the upload
```

---

## One thing to decide

The description says progress never leaves your browser, and that is true. If
you later add analytics of any kind, that sentence has to change and the page
needs a privacy note. It is easier to keep the promise than to amend it.
