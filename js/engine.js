// UTILITIES & GLOBALS
// ============================================================
let SHEET_ID = new URLSearchParams(window.location.search).get('sheet') || localStorage.getItem('swade_sheet_id') || '';

function isTrue(val) {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toLowerCase();
  return str === 'true' || str === 'yes' || str === 'y' || str === '1';
}

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${sheetName}`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = []; let row = []; let inQuotes = false; let currentVal = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { row.push(currentVal.replace(/^"|"$/g, '').trim()); currentVal = ''; }
    else if (char === '\n' && !inQuotes) { row.push(currentVal.replace(/^"|"$/g, '').trim()); rows.push(row); row = []; currentVal = ''; }
    else currentVal += char;
  }
  if (currentVal) row.push(currentVal.replace(/^"|"$/g, '').trim());
  if (row.length > 0) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().trim());
  return rows.slice(1).map(r => {
    const obj = {}; headers.forEach((h, i) => obj[h] = r[i] || ''); return obj;
  });
}

// ============================================================
// STATE
// ============================================================
const state = {
  // These get populated from sheets on load
  attrs: [],        // [{name, base}]
  skills: [],       // [{name, base, linkedattr}]
  starting: [],     // [{name, type, effect, defaulton}] + .on
  progressions: [], // [{adv, rank, type, selection, prereq, effect}] + .checked
  powerTiers: [],   // [{tier, title, spplabel, defaultactive}]
  powers: [],       // [{tier, name, mod, base, adj, spp, effect, upgrades}] + .active
  hindrances: [],   // [{name, severity, effect, bolohad, source}]
  allEdges: [],     // reference only
  allWeapons: [],   // [{name, damage, skill, tags, notes, source, dynamic, acquired, equipped, book}]
  allArmor: [],     // [{name, armorvalue, weight, notes, location, acquired, equipped, category, minstr, book}]
  allGear: [],      // [{name, weight, cost, notes, category, acquired, book}]
  // Runtime toggle state — overrides sheet on current session
  // keyed by item name: {Sword: true, Shield: true}
  acqState: {},     // acquired overrides
  eqState: {},      // equipped overrides
  edgesRef: [],
  hindrancesRef: [],
  spPowers: [],
  weaponsRef: [],
  armorRef: [],

  activeEdgeToggles: {},   // { 'berserk': true/false, ... }
  edgeTrackers: {},        // { 'connections': true/false, ... }

  // Session state
  bennies: 3, maxBennies: 3,
  wounds: [false,false,false,false,false],
  woundIncap: false,
  fatigue: [false,false],
  fatigueIncap: false,
  shaken: false,
  forceField: false,
  pace: 6,
  size: 0,
  showUnskilled: true,
  loaded: false
};

// ============================================================
// COMPUTED
// ============================================================
const DIE_NAMES = ['d4','d6','d8','d10','d12','d12+1','d12+2'];

// Hand-coded entries for edges whose effects can't be reliably parsed from text.
// activeModifiers: applied when the edge is toggled ON (active type only)
// passiveNote / trackerNote: display-only reminders for Part 2 UI rendering
const EDGE_FALLBACK_MAP = {
  'berserk': {
    activeModifiers: [
      { stat: 'fighting',      value: +2, label: 'Berserk (+2 Fighting)' },
      { stat: 'toughness',     value: +2, label: 'Berserk (+2 Toughness)' },
      { stat: 'parry',         value: -2, label: 'Berserk (-2 Parry)' },
      { stat: 'wound_penalty', value: 999, label: 'Berserk (ignore Wound penalties)' },
    ],
    triggerNote: 'Activate after taking a Wound + failed Smarts roll'
  },
  'level headed': {
    passiveNote: 'Draw 2 Action Cards, keep best — no stat modifier'
  },
  'improved level headed': {
    passiveNote: 'Draw 3 Action Cards, keep best — no stat modifier'
  },
  'quick': {
    passiveNote: 'Redraw Action Cards of 5 or lower — no stat modifier'
  },
  'dead shot': {
    trackerNote: 'Double damage on a Joker — mark when Joker is drawn'
  },
  'mighty blow': {
    trackerNote: 'Double Fighting damage on a Joker — mark when Joker is drawn'
  },
  'connections': {
    trackerNote: 'Once per session — contact provides aid, info, or equipment'
  },
  'first strike': {
    passiveNote: 'Free Attack when foe moves adjacent — handled in play'
  },
  'improved first strike': {
    passiveNote: 'Free Attack against every foe moving adjacent — handled in play'
  },
  'counterattack': {
    passiveNote: 'Free Attack on failed enemy Fighting roll — handled in play'
  },
  'improved counterattack': {
    passiveNote: 'Free Attack against all failed Fighting rolls — handled in play'
  },
  'elan': {
    passiveNote: '+2 when spending a Benny to reroll — reminder only'
  },
  'no mercy': {
    trackerNote: 'Spend a Benny to reroll damage — tracker for session awareness'
  },
  'hard to kill': {
    passiveNote: 'Ignore Wound penalties on Incapacitation rolls — reminder only'
  },
  'harder to kill': {
    passiveNote: 'Spirit roll to survive death — reminder only'
  },
  'combat reflexes': {
    passiveNote: '+2 Spirit to recover from Shaken — already in computeSkillMods'
  },
};
function dieFor(lvl) { return DIE_NAMES[Math.min(Math.max(lvl-1,0), DIE_NAMES.length-1)]; }
function dieVal(lvl) { return [4,6,8,10,12,12,12][Math.min(Math.max(lvl-1,0),6)]; }
function dieMod(lvl) { return Math.max(0, lvl - 5); } // returns +1 or +2 for d12+1/+2
function hasEdge(name) {
  const n = name.toLowerCase().trim();
  return !!state.progressions.find(p => p.checked && (p.selection||'').toLowerCase().trim() === n);
}
function hasStart(name) {
  const n = name.toLowerCase().trim();
  return !!state.starting.find(s => s.on && (s.name||'').toLowerCase().trim() === n);
}

// Returns array of { name, effect, type } for all edges the character currently has
function getActiveEdges() {
  const results = [];
  const seen = new Set();
  const edgesRef = state.edgesRef || [];

  const addEdge = (name) => {
    const n = (name || '').toLowerCase().trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    const ref = edgesRef.find(e => (e.name||'').toLowerCase().trim() === n);
    const effect = ref ? (ref.effect || '') : '';
    const type = (ref && ref.type) ? ref.type.toLowerCase().trim()
                                   : classifyEdgeType(n, effect);
    results.push({ name: n, effect, type });
  };

  (state.starting || [])
    .filter(s => s.on && (f(s,'type')||'').toLowerCase().trim() === 'edge')
    .forEach(s => addEdge(f(s,'name') || ''));

  (state.progressions || [])
    .filter(p => p.checked && f(p,'type') === 'Edge')
    .forEach(p => addEdge(f(p,'selection','name') || ''));

  return results;
}

// Heuristic fallback when the markdown type field is missing
function classifyEdgeType(name, effect) {
  const eff = (effect || '').toLowerCase();

  // Tracker signals
  if (/once per session|once per scene|per session|free reroll|spend a benny/i.test(eff))
    return 'tracker';

  // Active signals — conditional modifiers that only apply in certain states
  if (/while berserk|while active|when using|may activate|toggled/i.test(eff))
    return 'active';
  if (/while .{1,30}[,;]\s*(add|subtract|\+|-)\d/i.test(eff))
    return 'active';

  return 'passive';
}

function computeAttrLevel(name) {
  const a = state.attrs.find(x => x.name && x.name.toLowerCase()===name.toLowerCase());
  if(!a) return 1;
  let lvl = parseInt(a.base)||1;
  // Progression advances
  state.progressions.forEach(p=>{
    if(!p.checked) return;
    if(p.type==='Attribute' && p.selection && p.selection.toLowerCase().includes(name.toLowerCase())) lvl++;
  });
  // Super Attribute power bonuses
  const shortMap = {strength:'str',vigor:'vig',agility:'agi',smarts:'sma',spirit:'spi'};
  const shortName = shortMap[name.toLowerCase()] || name.toLowerCase().substring(0,3);
  const superPowers = state.powers.filter(p => {
    if (!p.active) return false;
    const pname = (f(p,'name','power')||'').toLowerCase();
    return pname.includes('super attr') && pname.includes(shortName);
  });
  if (superPowers.length) {
    const best = superPowers.reduce((a,b) => (parseInt(b.base)||0) > (parseInt(a.base)||0) ? b : a);
    lvl += Math.floor((parseInt(best.base)||0) / 2);
  }
  return Math.min(7, lvl); // d4=1 through d12+2=7
}

function computeSkillLevel(name) {
  const s = state.skills.find(x => x.name && x.name.toLowerCase()===name.toLowerCase());
  if(!s) return 0;
  // base=0 means unskilled, base=1 means d4 trained
  let lvl = parseInt(s.base)||0;
  state.progressions.forEach(p=>{
    if(!p.checked) return;
    const isSkill = p.type==='Skill'||p.type==='Skill (Above Attr)'||p.type==='Skill x2'||p.type==='Skill (Above Attr / x2)';
    // All skill types give 1 die raise — "Above Attr" just costs more advances, same result
    if(isSkill && p.selection && p.selection.toLowerCase().includes(name.toLowerCase()))
      lvl += 1;
  });
  return Math.min(5,lvl);
}

function getActivePower(name) {
  // Get ALL active powers matching the name, return highest tier (highest base value)
  const matches = state.powers.filter(p => {
    if (!p.active) return false;
    const pname = f(p,'name','power') || '';
    return pname.replace(/\s*↑+$/,'') === name;
  });
  if (!matches.length) return null;
  // Return the one with the highest base value (cumulative upgrades)
  return matches.reduce((best, p) => {
    return (parseInt(p.base)||0) > (parseInt(best.base)||0) ? p : best;
  });
}

// Parses an edge effect string and returns an array of modifier objects.
// Each object: { stat, value, condition, label }
function parseEdgeEffects(edgeName, effectText) {
  const mods = [];
  const eff = effectText || '';
  const nm  = edgeName || '';

  // Normalise a raw stat/skill name to the keys used in state
  function normStat(raw) {
    const r = raw.toLowerCase().trim();
    const map = {
      'fighting':'fighting','notice':'notice','parry':'parry',
      'toughness':'toughness','spirit':'spirit','shooting':'shooting',
      'athletics':'athletics','intimidation':'intimidation',
      'persuasion':'persuasion','stealth':'stealth','pace':'pace',
      'strength':'strength','agility':'agility','smarts':'smarts',
      'vigor':'vigor','performance':'performance','research':'research',
      'repair':'repair','survival':'survival',
    };
    for (const [k,v] of Object.entries(map)) { if (r.includes(k)) return v; }
    return r;
  }

  function add(stat, value, condition, label) {
    mods.push({ stat: normStat(stat), value, condition: condition || null, label });
  }

  // Pattern 1: "+N to [Stat] rolls [when condition]" — negative lookbehind prevents matching "add +N to ..." (Pattern 3 handles that)
  const p1 = /(?<!add )([+-]\d+) to ([\w][\w\s]+?)(?:\s+rolls?)?(?:\s+when\s+([\w\s,]+?))?(?=[.,;]|$)/gi;
  let m;
  while ((m = p1.exec(eff)) !== null) {
    add(m[2], parseInt(m[1]), m[3]||null, `${nm} (${m[1]} ${m[2].trim()})`);
  }

  // Pattern 2: "subtract N from [Stat]"
  const p2 = /subtract (\d+) from ([\w][\w\s]+?)(?=[.,;]|$)/gi;
  while ((m = p2.exec(eff)) !== null) {
    add(m[2], -parseInt(m[1]), null, `${nm} (-${m[1]} ${m[2].trim()})`);
  }

  // Pattern 3: "add +N to [Stat]"
  const p3 = /add ([+-]\d+) to ([\w][\w\s]+?)(?=[.,;]|$)/gi;
  while ((m = p3.exec(eff)) !== null) {
    add(m[2], parseInt(m[1]), null, `${nm} (${m[1]} ${m[2].trim()})`);
  }

  // Pattern 4: "Parry bonus increases to +N" or "Parry is +N"
  const p4 = /[Pp]arry (?:bonus )?(?:increases? to|is) \+(\d+)/;
  if ((m = p4.exec(eff))) add('parry', parseInt(m[1]), null, `${nm} (+${m[1]} Parry)`);

  // Pattern 5: "Toughness by +N" or "Toughness increases by +N"
  const p5 = /[Tt]oughness (?:by )?\+(\d+)/;
  if ((m = p5.exec(eff))) add('toughness', parseInt(m[1]), null, `${nm} (+${m[1]} Toughness)`);

  // Pattern 6: "Pace is increased by +N"
  const p6 = /[Pp]ace (?:is )?increased by \+?(\d+)/;
  if ((m = p6.exec(eff))) add('pace', parseInt(m[1]), null, `${nm} (+${m[1]} Pace)`);

  // Pattern 7: "ignore N point(s) of Wound penalties"
  const p7 = /ignore (\d+) points? of [Ww]ound penalt/;
  if ((m = p7.exec(eff))) add('wound_penalty', parseInt(m[1]), null, `${nm} (ignore ${m[1]} Wound penalty)`);

  // Pattern 8: "+N damage" or "add +N to damage"
  const p8 = /(?:add )?\+(\d+)(?:\s+to)?\s+(?:total\s+)?damage/i;
  if ((m = p8.exec(eff))) add('damage', parseInt(m[1]), null, `${nm} (+${m[1]} damage)`);

  return mods;
}

function computeParry() {
  const fLvl = computeSkillLevel('Fighting');
  let parry = 2 + Math.floor(dieVal(fLvl)/2);
  if(hasStart('Martial Artist')) parry += 1;
  if(hasEdge('Martial Warrior')) parry += 1;
  if(hasEdge('Imp. Block'))      parry += 2;
  else if(hasEdge('Block'))      parry += 1;

  // Generic passive edge bonuses to Parry (parser-driven)
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'passive') return;
    // Skip edges already handled above to avoid double-counting
    const skip = new Set(['block','improved block','imp. block','trademark weapon','acrobat','martial artist','martial warrior']);
    if (skip.has(name)) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? [] : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat === 'parry').forEach(m => { parry += m.value; });
  });

  // Generic active edge bonuses to Parry (only when toggled on)
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'active') return;
    const isOn = state.activeEdgeToggles[name];
    if (!isOn) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? (fallback.activeModifiers || []) : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat === 'parry').forEach(m => { parry += m.value; });
  });

  return parry;
}

function computeToughness() {
  const vigLvl = computeAttrLevel('Vigor');
  let toughness = 2 + Math.floor(dieVal(vigLvl)/2);
  if(hasStart('Brawler (Racial)')) toughness += 1;
  if(hasEdge('Brawler'))           toughness += 1; // non-racial version
  if(hasEdge('Bruiser'))           toughness += 1;
  if(hasEdge('Brawny'))            toughness += 1; // Brawny gives Size+1 = Toughness+1
  toughness += (state.size || 0);                  // Size modifier from State tab
  const tp = getActivePower('Toughness');
  if(tp) toughness += parseInt(tp.base)||0;

  // Generic passive edge bonuses to Toughness
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'passive') return;
    const skip = new Set(['brawler','brawler (racial)','bruiser','brawny','nerves of steel','improved nerves of steel']);
    if (skip.has(name)) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? [] : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat === 'toughness').forEach(m => { toughness += m.value; });
  });

  // Generic active edge bonuses to Toughness (only when toggled on)
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'active') return;
    if (!state.activeEdgeToggles[name]) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? (fallback.activeModifiers || []) : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat === 'toughness').forEach(m => { toughness += m.value; });
  });

  return toughness;
}

// ── Armor location parsing ────────────────────────────────────
// Parses 'location' field into an array of slot names
// Handles: "Torso", "Torso,Arms", "Torso,Arms,Legs", "Full", "All"
const ARMOR_SLOTS = ['Head','Torso','Arms','Legs'];

function parseArmorLocations(locStr) {
  if (!locStr) return [];
  const s = locStr.trim().toLowerCase();
  if (s === 'full' || s === 'all') return [...ARMOR_SLOTS];
  return locStr.split(',').map(l => l.trim()).filter(l =>
    ARMOR_SLOTS.some(sl => sl.toLowerCase() === l.toLowerCase())
  ).map(l => ARMOR_SLOTS.find(sl => sl.toLowerCase() === l.toLowerCase()));
}

// Returns equipped armor items from sheet (isTrue(equipped))
// ── Acquired / Equipped helpers ──────────────────────────────
// Runtime state overrides sheet checkbox if present
function isAcquired(item) {
  const nm = (item.name||'').trim();
  if (state.acqState.hasOwnProperty(nm)) return state.acqState[nm];
  return isTrue(item.acquired);
}
function isEquipped(item) {
  const nm = (item.name||'').trim();
  if (state.eqState.hasOwnProperty(nm)) return state.eqState[nm];
  return isTrue(item.equipped);
}
// ── Sheet write-back ─────────────────────────────────────────
// Writes TRUE/FALSE to a specific cell in the background if OAuth is connected
async function writeBackCell(sheetName, row, col, value) {
  if (!isConnected || !gAuthToken || Date.now() > gTokenExpiry) return;
  const colLetter = String.fromCharCode(64 + col); // 1=A, 2=B, etc.
  const range = `${sheetName}!${colLetter}${row}`;
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${gAuthToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[value ? 'TRUE' : 'FALSE']] })
      }
    );
  } catch(e) {
    console.warn('writeBackCell failed:', range, e);
  }
}

// Column indices for each tab
const COL = {
  WEAPONS_ACQUIRED: 8,   // col H
  WEAPONS_EQUIPPED: 9,   // col I
  ARMOR_ACQUIRED:   8,   // col H
  ARMOR_EQUIPPED:   9,   // col I
  GEAR_ACQUIRED:    6,   // col F
  HINDRANCES_ACQUIRED: 4 // col D (renamed from bolohad)
};

function toggleAcquired(name) {
  const newVal = !isAcquired({name, acquired: false}); // compute new value
  // Find item in each tab to get row + determine which tab
  const weapon = state.allWeapons.find(i => (i.name||'').trim() === name);
  const armor  = state.allArmor.find(i  => (i.name||'').trim() === name);
  const gear   = state.allGear.find(i   => (i.name||'').trim() === name);
  const item   = weapon || armor || gear;
  if (!item) return;
  const current = isAcquired(item);
  state.acqState[name] = !current;
  if (current) state.eqState[name] = false; // un-acquiring clears equipped
  saveState();
  // Write back to sheet in background
  if (weapon) {
    writeBackCell('Weapons', weapon._row, COL.WEAPONS_ACQUIRED, !current);
    if (current) writeBackCell('Weapons', weapon._row, COL.WEAPONS_EQUIPPED, false);
  } else if (armor) {
    writeBackCell('Armor', armor._row, COL.ARMOR_ACQUIRED, !current);
    if (current) writeBackCell('Armor', armor._row, COL.ARMOR_EQUIPPED, false);
  } else if (gear) {
    writeBackCell('Gear', gear._row, COL.GEAR_ACQUIRED, !current);
  }
  renderWeapons(); renderArmor(); renderGear();
  renderWeaponsRef(); renderArmorRef(); renderGearRef();
  updateStatusBar(); // armor acquired state can affect Toughness
}
function toggleEquipped(name) {
  const weapon = state.allWeapons.find(i => (i.name||'').trim() === name);
  const armor  = state.allArmor.find(i  => (i.name||'').trim() === name);
  const item   = weapon || armor;
  if (!item) return;
  const current = isEquipped(item);
  state.eqState[name] = !current;
  if (!current) state.acqState[name] = true; // equipping implies acquired
  saveState();
  // Write back to sheet in background
  if (weapon) {
    writeBackCell('Weapons', weapon._row, COL.WEAPONS_EQUIPPED, !current);
    if (!current) writeBackCell('Weapons', weapon._row, COL.WEAPONS_ACQUIRED, true);
  } else if (armor) {
    writeBackCell('Armor', armor._row, COL.ARMOR_EQUIPPED, !current);
    if (!current) writeBackCell('Armor', armor._row, COL.ARMOR_ACQUIRED, true);
  }
  renderWeapons(); renderArmor();
  renderWeaponsRef(); renderArmorRef();
  updateStatusBar();
}

function getEquippedArmor() {
  return state.allArmor.filter(a => {
    const nm = String(a.name||'').trim();
    return isEquipped(a) && nm && !ARMOR_SLOTS.includes(nm);
  });
}

// Compute effective armor per slot, applying SWADE stacking rules:
// Multiple items on the same slot: highest = full, others = half (round down)
function computeArmorBySlot() {
  const equipped = getEquippedArmor();
  const slotItems = {}; // slot -> array of armorvalue numbers
  ARMOR_SLOTS.forEach(s => slotItems[s] = []);

  equipped.forEach(a => {
    const locs = parseArmorLocations(a.location||'');
    const val = parseInt(a.armorvalue)||0;
    locs.forEach(loc => slotItems[loc].push(val));
  });

  // Apply stacking: sort descending, first = full, rest = half rounded down
  const result = {};
  ARMOR_SLOTS.forEach(slot => {
    const vals = slotItems[slot].sort((a,b) => b-a);
    if (!vals.length) { result[slot] = 0; return; }
    result[slot] = vals[0] + vals.slice(1).reduce((s,v) => s + Math.floor(v/2), 0);
  });
  return result;
}

// Total armor bonus = average of all covered slots (torso is the reference for Toughness)
// SWADE: worn armor adds to Toughness based on torso coverage
// If no torso armor, use highest single slot value as fallback
function computeArmorBonus() {
  const ap = getActivePower('Armor');
  // Armor power: +2 Toughness per level (base field = number of levels)
  const powerArmor = ap ? (parseInt(ap.base)||1) * 2 : 0;
  const slots = computeArmorBySlot();
  const wornArmor = slots['Torso'] || 0;
  // Per SPC rules: Armor power does NOT stack with worn armor — use the higher value
  return Math.max(powerArmor, wornArmor);
}

function computeFFDR() {
  // Force Field = damage reduction, not Toughness bonus
  // Each level (base field) reduces incoming damage by 1 point
  const ffp = getActivePower('Force Field');
  if (!ffp || !state.forceField || state.shaken) return 0;
  return parseInt(ffp.base) || 1;
}

function buildToughnessDisplay() {
  const base = computeToughness();
  const ap = getActivePower('Armor');
  const powerAr = ap ? (parseInt(ap.base)||1) * 2 : 0;
  const slots = computeArmorBySlot();
  const wornAr = slots['Torso'] || 0;
  // Force Field is damage reduction — NOT added to Toughness
  // Use higher of power armor vs worn armor (don't stack per SPC rules)
  const arBonus = Math.max(powerAr, wornAr);
  const total = base + arBonus;

  const parts = [];
  if (arBonus > 0) {
    parts.push(powerAr >= wornAr ? `${arBonus}P` : `${arBonus}W`);
  }
  if (parts.length) return `${total} (${parts.join(' + ')})`;
  return `${total}`;
}

function computeCarryLimit() {
  const strLvl = computeAttrLevel('Strength');
  const strDie = dieVal(strLvl);
  return (strDie / 4) * 20; // d4=20,d6=40,d8=60,d10=80,d12=100
}

function getWoundPenaltyIgnore() {
  // Existing hardcoded checks (keep these)
  if (hasEdge('Imp. Nerves of Steel') || hasStart('Improved Nerves of Steel')) return 2;
  if (hasEdge('Nerves of Steel') || hasStart('Nerves of Steel')) return 1;

  // Generic: active-toggled edges with wound_penalty modifier
  let ignore = 0;
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'active' || !state.activeEdgeToggles[name]) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? (fallback.activeModifiers || []) : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat === 'wound_penalty')
        .forEach(m => { ignore = Math.max(ignore, m.value >= 99 ? 999 : m.value); });
  });
  return ignore;
}

function getWoundEdgeInfo() {
  const nosIgnore = getWoundPenaltyIgnore();
  const maxWounds = hasEdge('Tougher than Nails') ? 5 : hasEdge('Tough as Nails') ? 4 : 3;
  return {nosIgnore, maxWounds};
}

function computeRank() {
  const checked = state.progressions.filter(p=>p.checked).length;
  if(checked>=16) return 'Legendary';
  if(checked>=12) return 'Heroic';
  if(checked>=8)  return 'Veteran';
  if(checked>=4)  return 'Seasoned';
  return 'Novice';
}

function rankColor(rank) {
  return {Novice:'var(--blue)',Seasoned:'var(--green)',Veteran:'var(--accent2)',Heroic:'var(--accent)',Legendary:'#cc44ff'}[rank]||'var(--text)';
}

// ============================================================
// SKILL MODIFIERS
// ============================================================
// Returns an object mapping skill names to arrays of { label, value }
// representing all active modifiers from edges, hindrances, and powers.
function computeSkillMods() {
  const result = {};

  function addMod(skill, label, value) {
    const k = (skill || '').toLowerCase().trim();
    if (!k) return;
    if (!result[k]) result[k] = [];
    result[k].push({ label, value });
  }

  // Hardcoded edge skill bonuses (edges in the skip set for generic loops)
  if (hasEdge('Alertness')     || hasStart('Alertness'))     addMod('notice',       'Alertness (+2 Notice)', 2);
  if (hasEdge('Martial Artist')|| hasStart('Martial Artist'))addMod('fighting',     'Martial Artist (+1 Fighting unarmed)', 1);
  if (hasEdge('Martial Warrior'))                            addMod('fighting',     'Martial Warrior (+2 Fighting unarmed)', 2);
  if (hasEdge('Combat Reflexes'))                            addMod('spirit',       'Combat Reflexes (+2 Spirit vs Shaken)', 2);
  if (hasEdge('Investigator')  || hasStart('Investigator'))  addMod('research',     'Investigator (+2 Research)', 2);
  if (hasEdge('Streetwise')    || hasStart('Streetwise'))    addMod('intimidation', 'Streetwise (+2)', 2);
  if (hasEdge('Assassin')      || hasStart('Assassin'))      addMod('damage',       'Assassin (+2 damage, conditional)', 2);
  if (hasEdge('Woodsman')      || hasStart('Woodsman')) {
    addMod('survival',   'Woodsman (+2 Survival)', 2);
    addMod('stealth',    'Woodsman (+2 Stealth in wild)', 2);
  }
  if (hasEdge('Menacing')      || hasStart('Menacing'))      addMod('intimidation', 'Menacing (+2 Intimidation)', 2);
  if (hasEdge('Strong Willed') || hasStart('Strong Willed')) {
    addMod('smarts', 'Strong Willed (+2 resist Tests)', 2);
    addMod('spirit', 'Strong Willed (+2 resist Tests)', 2);
  }
  if (hasEdge('Acrobat')       || hasStart('Acrobat'))       addMod('athletics',   'Acrobat (free reroll acrobatics)', 0);

  // Generic passive edge skill bonuses
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'passive') return;
    const skip = new Set(['alertness','martial artist','martial warrior','combat reflexes',
                          'investigator','streetwise','assassin','acrobat','woodsman',
                          'menacing','strong willed']);
    if (skip.has(name)) return;
    const mods = parseEdgeEffects(name, effect);
    mods.filter(m => m.stat !== 'parry' && m.stat !== 'toughness' && m.stat !== 'pace'
                  && m.stat !== 'wound_penalty' && m.stat !== 'damage')
        .forEach(m => addMod(m.stat, m.label, m.value));
  });

  // Generic active edge skill bonuses (only when toggled on)
  getActiveEdges().forEach(({name, effect, type}) => {
    if (type !== 'active') return;
    if (!state.activeEdgeToggles[name]) return;
    const fallback = EDGE_FALLBACK_MAP[name];
    const mods = fallback ? (fallback.activeModifiers || []) : parseEdgeEffects(name, effect);
    mods.filter(m => m.stat !== 'parry' && m.stat !== 'toughness' && m.stat !== 'pace'
                  && m.stat !== 'wound_penalty' && m.stat !== 'damage')
        .forEach(m => addMod(m.stat, m.label, m.value));
  });

  return result;
}

// ============================================================
// FIELD RESOLVER — handles slight CSV header variations
// ============================================================
// Tries a list of possible key names and returns the first non-empty match
function f(obj, ...keys) {
  if (!obj) return '';
  for (const k of keys) {
    // exact match
    if (obj[k] !== undefined && obj[k] !== '') return obj[k];
    // lowercase match
    const lk = k.toLowerCase();
    if (obj[lk] !== undefined && obj[lk] !== '') return obj[lk];
    // try without underscores / spaces
    const flat = lk.replace(/_/g,'');
    const found = Object.keys(obj).find(ok => ok.toLowerCase().replace(/_/g,'') === flat);
    if (found && obj[found] !== '') return obj[found];
  }
  // Last resort: return the value of the first key that has any content
  const firstFilled = Object.values(obj).find(v => v && v.trim && v.trim());
  return firstFilled || '';
}

// ============================================================