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
// RENDER: HINDRANCES
// ============================================================
function renderHindrances() {
  const container = document.getElementById('hindrance-list');
  if (!container) return;
  container.innerHTML = '';

  // 1. Pull from the Starting Tab
  const startH = (state.starting || []).filter(s => 
    s.type && s.type.toLowerCase().startsWith('hindrance') && (s.name || '').trim() !== ''
  ).map(s => ({
    name: s.name,
    severity: s.type.toLowerCase().includes('major') ? 'Major' : 'Minor',
    effect: s.effect
  }));

  // 2. Pull from the Hindrances Tab (where acquired is set to TRUE)
  // Accommodates both variable names depending on the Promise.all fetch
  const sourceHindrances = state.allHindrances || state.hindrances || [];
  const acqH = sourceHindrances.filter(h => 
    String(h.acquired).toUpperCase() === 'TRUE' && (h.name || '').trim() !== ''
  ).map(h => ({
    name: h.name,
    severity: h.severity || 'Minor',
    effect: h.effect
  }));

  // Combine them together
  const allH = [...startH, ...acqH];

  if (!allH.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:13px;font-style:italic;">No hindrances. Add to Starting tab or check "acquired" in Hindrances tab.</div>';
    return;
  }

  allH.forEach(h => {
    container.innerHTML += `<div class="trait-row">
      <div class="trait-name">${h.name} <span class="h-sev">${h.severity}</span></div>
      <div class="trait-desc">${h.effect || ''}</div>
    </div>`;
  });
}

// ============================================================
// RENDER: EDGES
// ============================================================
function renderEdges() {
  const container = document.getElementById('edge-list');
  if (!container) return;
  container.innerHTML = '';

  // 1. Pull from the Starting Tab
  const startE = (state.starting || []).filter(s => 
    s.type && s.type.toLowerCase() === 'edge' && (s.name || '').trim() !== ''
  ).map(s => ({
    name: s.name,
    effect: s.effect || ''
  }));

  // 2. Pull from the Advances Tab
  const sourceEdges = state.allEdges || state.edges || [];
  const advE = (state.progressions || []).filter(p => 
    p.type && p.type.toLowerCase() === 'edge' && (p.selection || '').trim() !== ''
  ).map(p => {
    // Attempt to pull the description automatically from the Edges reference tab
    const ref = sourceEdges.find(re => (re.name || '').toLowerCase() === p.selection.toLowerCase());
    return {
      name: p.selection,
      effect: ref ? ref.effect : (p.effect || '')
    };
  });

  // Combine them together
  const allE = [...startE, ...advE];

  if (!allE.length) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:13px;font-style:italic;">No edges. Add to Starting or Advances tabs.</div>';
    return;
  }

  allE.forEach(e => {
    container.innerHTML += `<div class="trait-row">
      <div class="trait-name">${e.name}</div>
      <div class="trait-desc">${e.effect || ''}</div>
    </div>`;
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

function computeParry() {
  const fLvl = computeSkillLevel('Fighting');
  let p = 2 + Math.floor(dieVal(fLvl)/2);
  if(hasStart('Martial Artist')) p += 1;
  if(hasEdge('Martial Warrior')) p += 1;
  if(hasEdge('Imp. Block'))      p += 2;
  else if(hasEdge('Block'))      p += 1;
  return p;
}

function computeToughness() {
  const vigLvl = computeAttrLevel('Vigor');
  let t = 2 + Math.floor(dieVal(vigLvl)/2);
  if(hasStart('Brawler (Racial)')) t += 1;
  if(hasEdge('Brawler'))           t += 1; // non-racial version
  if(hasEdge('Bruiser'))           t += 1;
  if(hasEdge('Brawny'))            t += 1; // Brawny gives Size+1 = Toughness+1
  t += (state.size || 0);                  // Size modifier from State tab
  const tp = getActivePower('Toughness');
  if(tp) t += parseInt(tp.base)||0;
  return t;
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

function getWoundEdgeInfo() {
  const nosIgnore = hasEdge('Imp. Nerves of Steel') ? 2 : hasEdge('Nerves of Steel') ? 1 : 0;
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