# CLAUDE.md — Savaged-Worlds Character Sheet

## Project Overview

A mobile-first SWADE (Savage Worlds Adventure Edition) character sheet web app. Hosted on GitHub Pages. One shared codebase — each player connects their own Google Sheet for character data and cloud saves.

**Live URL:** `https://spradlinc25.github.io/Savaged-Worlds` **Repo:** `https://github.com/spradlinc25/Savaged-Worlds` **Local folder:** `C:\Users\CalebSpradlin\OneDrive - DA Engineering\Documents\TTRPG Vault\Savaged Worlds - Library` **Test sheet ID:** `1nT2vNBvf2C49CmY9X5WAHgZh3zi17PABeBsY5r4Tw0I` (Bolo's sheet)

---

## File Structure

```
Savaged Worlds - Library/
├── index.html          ← HTML structure only (347 lines)
├── style.css           ← All CSS and CSS variables (304 lines)
├── js/
│   ├── engine.js       ← State object, SWADE rules engine, computed stats (479 lines)
│   ├── render.js       ← All render* functions, DOM updates, UI logic (1322 lines)
│   └── sync.js         ← Google OAuth, Sheets read/write, boot, setup screen (590 lines)
├── rules/              ← Markdown reference files
│   ├── SWADE_01_Characters_and_Skills.md
│   ├── SWADE_02_Hindrances.md
│   ├── SWADE_03_Edges.md
│   ├── SWADE_04_Gears_and_Weapons.md
│   ├── SWADE_05_Combat_and_Rules.md
│   ├── SWADE_06_Powers_and_Arcane_Background.md
│   ├── SPC_01_Characters_and_Edges.md
│   ├── SPC_02_Gear_and_Bases.md
│   ├── SPC_03_Setting_Rules.md
│   ├── SPC_04_Power_Mechanics.md
│   └── SPC_05_Powers.md
└── CLAUDE.md
```

**No build step. No npm. No data files.** All character data lives in Google Sheets.

---

## Script Load Order (critical)

`index.html` loads scripts in this exact order — do not change it:

```html
<script src="js/engine.js"></script>   ← must be first (defines state, helpers)
<script src="js/render.js"></script>   ← depends on engine.js
<script src="js/sync.js"></script>     ← depends on both; calls boot() at end
```

---

## What Each File Does

### index.html

Pure HTML structure. No inline JS or CSS. Contains:

- `<link rel="stylesheet" href="style.css">`
- Nav bar, stat bar, all tab `<div>` containers
- Setup overlay and change-sheet modal
- The three `<script src="js/...">` tags at the bottom before `</body>`

### style.css

All visual styling. Key things:

- CSS variables in `:root {}` — edit colors/spacing here
- `@media(max-width:600px)` — mobile overrides, never break this
- Primary palette: `--accent:#e85d26`, `--accent2:#f4a436`, `--bg:#0a0c0f`

### js/engine.js

The rules engine. Contains:

- `SHEET_ID` — read from URL `?sheet=` param or localStorage
- `state{}` — single runtime source of truth for all character data
- `isTrue()`, `fetchSheet()`, `f()` field resolver
- `computeAttrLevel()`, `computeSkillLevel()`, `computeParry()`, `computeToughness()`
- `computeSkillMods()`, `getActivePower()`, `hasEdge()`, `hasStart()`
- Die scale: `DIE_NAMES = ['d4','d6','d8','d10','d12','d12+1','d12+2']`
- Armor slot logic, acquired/equipped helpers, sheet write-back (`writeBackCell`)

### js/render.js

All DOM rendering. Contains:

- `renderAttrs()`, `renderSkills()`, `renderHindrances()`, `renderEdges()`
- `renderWeapons()`, `renderArmor()`, `renderGear()`
- `renderProgressions()`, `renderPowerTiers()`, `renderStarting()`
- `renderBennies()`, `renderEdgesRef()`, `renderSPRef()` etc.
- `updateStatusBar()`, `updateWoundDisplay()`, `updateFatigueDisplay()`
- `toggleWound()`, `toggleFatigue()`, `toggleShaken()`, `toggleFF()`
- `fullRefresh()` — re-renders everything, call after any state change
- `showTab()`, `rollDie()`, dice roller logic

### js/sync.js

All Google/persistence logic. Contains:

- `GOOGLE_CLIENT_ID` — OAuth client ID (do not change without updating GCloud)
- `saveState()` → localStorage + debounced Sheets write
- `loadState()` → from localStorage
- `loadFromSheets()` / `doSheetsSync()` — Sheets API v4 read/write
- `loadAllSheets()` — fetches all 14 tabs in parallel, populates `state{}`
- `boot()` — entry point called on page load
- `showSetupScreen()`, `setupLoadSheet()` — first-run sheet ID entry
- `openChangeSheet()`, `confirmChangeSheet()` — change sheet modal
- `STATE_RANGE = 'State!B2'` — where JSON save blob lives in the sheet
- `SAVE_KEY = 'bolo_swade_v4'` — localStorage key

---

## Data Flow

```
URL ?sheet=ID  →  SHEET_ID  →  loadAllSheets()  →  state{}
                                     ↓
                          14 Google Sheet tabs fetched in parallel
                          (Attributes, Skills, Starting, Advances,
                           PowerTiers, Powers, Hindrances, Weapons,
                           Armor, Gear, Edges, SPCPowers, State)
                                     ↓
                          fullRefresh() renders everything to DOM
                                     ↓
                   User interaction → saveState() → localStorage
                                               ↘ doSheetsSync() → State!B2
```

---

## Google Sheet Tab Columns (verified from template)

|Tab|Columns|
|---|---|
|`Attributes`|name, base, Die Type, description|
|`Skills`|name, base, die type, linkedattr, description|
|`Starting`|name, type, cost, effect, defaulton|
|`Advances`|adv, rank, type, selection, Category, prereq, effect, defaultactive|
|`PowerTiers`|tier, title, spplabel, defaultactive|
|`Powers`|tier, name, mod, base, adj, spp, effect, upgrades, defaultactive|
|`Hindrances`|name, severity, effect, acquired, source, book, active|
|`Weapons`|name, damage, skill, tags, notes, source, dynamic, acquired, equipped, book|
|`Armor`|name, armorvalue, weight, notes, Location, category, minstr, acquired, equipped, book|
|`Gear`|name, weight, cost, notes, category, acquired, book|
|`Edges`|name, category, prereq, effect, source, book, active|
|`SPCPowers`|name, basecost, costtype, summary, notes, source, active|
|`State`|key, value, notes — row `wounds` at B2 holds the full JSON save blob|

---

## SWADE Rules Reference

### Core Formulas

```
Parry     = 2 + floor(FightingDie / 2) + edge bonuses
Toughness = 2 + floor(VigorDie / 2) + racial bonus + power bonuses + equipped armor + Size
```

### Die Scale

Level 1=d4, 2=d6, 3=d8, 4=d10, 5=d12, 6=d12+1, 7=d12+2

### Bolo (primary test character)

- Custom alien race: Brawler (racial) = +1 Toughness, fists Str+d4
- GM hindrances: Wanted (Major), Outsider (Minor), Alien Form (Major)
- Starting SPP: 10. Base powers: Toughness+2, Melee Attack+2, Heavy Weapon, Armor set
- Force Field powers down when Shaken; restores when un-Shaken
- Power tiers: Tech-Hunter (1) → Apex Predator (2) → Legendary Bastard (3) → Main Man (4)

---

## Common Tasks — Which File to Edit

|Task|File|
|---|---|
|Fix Toughness / Parry calculation|`js/engine.js` → `computeToughness()` / `computeParry()`|
|Fix a rendering bug|`js/render.js` → relevant `render*()` function|
|Fix sheet not loading|`js/sync.js` → `loadAllSheets()` or `fetchSheet()`|
|Add a new UI element|`index.html` (HTML) + `js/render.js` (logic)|
|Change colors or layout|`style.css`|
|Fix OAuth / sync issue|`js/sync.js` → `handleSyncBtn()` / `doSheetsSync()`|
|Add edge bonus to a stat|`js/engine.js` → `computeParry()` or `computeToughness()`|
|Add skill modifier for an edge|`js/engine.js` → `computeSkillMods()`|
|Fix mobile layout|`style.css` → `@media(max-width:600px)` block|

---

## Hard Rules

- **Never** add a build step or npm dependency
- **Never** hardcode a Sheet ID — always from URL param or localStorage
- **Never** change `GOOGLE_CLIENT_ID` without updating Google Cloud Console
- **Never** break the `@media(max-width:600px)` mobile layout
- **Always** maintain script load order: engine.js → render.js → sync.js
- **Always** call `fullRefresh()` after state changes affecting multiple UI sections
- **Always** call `saveState()` after any user interaction that changes state

---

## Deploy Workflow

1. Edit files locally in Cowork
2. Open GitHub Desktop → commit changed files → Push to main
3. Wait ~60 seconds for GitHub Pages to rebuild
4. Test: `https://spradlinc25.github.io/Savaged-Worlds?sheet=1nT2vNBvf2C49CmY9X5WAHgZh3zi17PABeBsY5r4Tw0I`