# Savaged-Worlds Character Sheet

## Project Overview

A mobile-friendly, dynamic SWADE (Savage Worlds Adventure Edition) character sheet web app hosted on GitHub Pages. Designed for a tabletop RPG group — one shared `index.html`, each player connects their own Google Sheet for data persistence.

**Live URL:** `https://spradlinc25.github.io/Savaged-Worlds`  
**Repo:** `https://github.com/spradlinc25/Savaged-Worlds`  
**Primary character:** Bolo — a Lobo-inspired intergalactic bounty hunter (Super Powers Companion build)

---

## Architecture

### Single-File App

Everything lives in `index.html`. No build step, no dependencies, no npm. Pure HTML/CSS/JS.

### Data Layer — Google Sheets (per user)

- Each user has their own Google Sheet (copied from a shared template)
- Sheet ID is stored in `localStorage` and optionally in the URL as `?sheet=SHEET_ID`
- OAuth via Google Identity Services (Client ID: `499020138123-mj1nakqq9rrrv74pjrk0s476b3j10901.apps.googleusercontent.com`)
- OAuth is published — any Google account can authorize

### Google Sheet Structure (tabs)

|Tab|Purpose|
|---|---|
|`Attributes`|Core stats (Agility, Smarts, Spirit, Strength, Vigor) and die values|
|`Skills`|Skill names and die values|
|`Powers`|Super Powers Companion powers, SPP cost, active state|
|`Progressions`|All 20 planned Advances with checkbox state|
|`State`|Key-value store for name, wounds, fatigue, bennies, XP, etc.|
|`Edges`|Edge name, description, obtained state|
|`Hindrances`|Hindrance name, type (major/minor), description|
|`Gear` / `Weapons` / `Armor`|Equipment with equipped toggles|

---

## SWADE Rules Context

### Core Calculations

- **Parry** = 2 + (Fighting die / 2) + bonuses from edges (e.g., Block = +1)
- **Toughness** = 2 + (Vigor die / 2) + Armor bonus + power bonuses
- **Die steps:** d4 → d6 → d8 → d10 → d12 (each Advance raises by one step)
- **Wild Die:** Player characters always roll a Wild Die (d6) alongside trait dice

### Character-Specific Rules (Bolo)

- **Custom Alien Race:** Brawler Edge built-in (+1 Toughness, Str+d4 unarmed), Infravision, Strength attribute increase, Outsider hindrance
- **Hindrances (GM Required):** Wanted (Major), Outsider (Minor), Alien Form (Major)
- **Starting SPP:** 10 (not the standard 15)
- **Base Powers active at Tier 1:** Toughness +2, Melee Attack +2, Heavy Weapon, Armor (with Chameleon, Force Field, Scan+Tracker embedded)

### Advance / Progression System

Advances happen every 5 XP. Each advance can:

- Raise a skill (costs 1 advance if skill ≤ linked attribute, 2 if higher)
- Raise an attribute (costs 2 advances)
- Buy an Edge

### Power Tiers

|Tier|Name|Unlock|
|---|---|---|
|1|Tech-Hunter|Start|
|2|Apex Predator|Seasoned|
|3|Legendary Bastard|Veteran|
|4|Main Man|Legendary|

---

## UI Structure (4 Tabs)

1. **Character** — Attributes, Skills, Derived stats (Parry/Toughness), Status bar (Wounds/Fatigue/Bennies)
2. **Progressions** — All 20 advances with checkboxes; checking updates Character tab in real-time
3. **Power Tiers** — 4 tiers with individual power toggles; affect Toughness/other derived stats
4. **Dice Roller** — Roll any die with Wild Die, acing (exploding dice), modifiers

### Always-Visible Status Bar

- 🩸 Wounds (0–4; 4 = Incapacitated; each adds -1 penalty)
- 😓 Fatigue (0–2; 2 = Incapacitated)
- ⭐ Bennies (spend/add; Wild Cards start with 3)
- XP tracker with auto rank calculation

---

## Key Implementation Notes

### State Sync

- All interactive state (wounds, bennies, checked advances, power toggles) saves to both `localStorage` AND the Google Sheet `State` tab
- URL param `?sheet=SHEET_ID` allows bookmarking specific characters
- Multiple characters possible via multiple bookmarks

### Dynamic Recalculation

When an advance is checked or a power is toggled, the app must:

1. Recalculate the affected attribute/skill die value
2. Recompute Parry (Fighting die change) and Toughness (Vigor die change + power bonuses + armor)
3. Update all UI elements that display those values

### Edge Cases

- Brawler edge (from racial): adds +1 Toughness and upgrades unarmed to Str+d4 — this must be included in Toughness base, not counted separately from Power bonuses
- The `-1 SPP` modifier on armor powers means they can be removed; powers with this modifier are tracked separately
- Block edge = +1 Parry (stacks with Fighting die)

---

## Common Tasks

### Fix a bug in Toughness calculation

Look for `computeToughness()` function. Check that it sums:

- Base (2)
- Vigor die bonus (die value / 2)
- Armor from equipped armor items
- Active power bonuses (Toughness power = +2)
- Racial bonus (Brawler = +1)
- Edge bonuses (if any)

### Add a new UI element

Follow existing pattern: update HTML structure → update `renderCharacter()` → update `saveState()` → update `loadState()`

### Modify Google Sheets sync

The `syncToSheet()` and `loadFromSheet()` functions handle all Sheets API calls. They use the Sheets API v4 REST endpoint with the user's OAuth token.

---

## Do NOT

- Add npm dependencies or a build step — keep it a single deployable HTML file
- Change the OAuth Client ID without updating Google Cloud Console authorized origins
- Hardcode any Sheet ID — it must always come from localStorage or URL param
- Break mobile layout — the app is used on phones during game sessions