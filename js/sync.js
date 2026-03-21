// GOOGLE OAUTH + SHEETS SYNC
// ============================================================
// REPLACE THIS with your actual OAuth Client ID from Google Cloud Console:
// APIs & Services → Credentials → OAuth 2.0 Client ID → Web application
// Authorized JavaScript origins: https://spradlinc25.github.io
const GOOGLE_CLIENT_ID = '499020138123-mj1nakqq9rrrv74pjrk0s476b3j10901.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

let gAuthToken = null;       // current access token
let gTokenExpiry = 0;        // token expiry timestamp
let syncPending = false;     // debounce flag
let syncTimer = null;        // debounce timer
let isConnected = false;     // OAuth connected state

// State tab range — we write a single JSON blob to State!B2
const STATE_RANGE = 'State!B2';

function buildSavePayload() {
  return JSON.stringify({
    _ts:         Date.now(),
    starting:    state.starting.map(s => s.on),
    progressions:state.progressions.map(p => p.checked),
    powers:      state.powers.map(p => p.active),
    bennies:     state.bennies,
    maxBennies:  state.maxBennies,
    showUnskilled: state.showUnskilled,
    wounds:      state.wounds,
    woundIncap:  state.woundIncap,
    fatigue:     state.fatigue,
    fatigueIncap:state.fatigueIncap,
    shaken:      state.shaken,
    forceField:  state.forceField,
    acqState:          state.acqState,
    eqState:           state.eqState,
    advancesCount:     state.advancesCount,
    activeEdgeToggles: state.activeEdgeToggles,
    edgeTrackers:      state.edgeTrackers
  });
}

// ── localStorage save (always happens, instant) ──────────────
const SAVE_KEY = 'bolo_swade_v4';
let localSaveTimer = null;

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, buildSavePayload());
  } catch(e) {}
  // Queue a Google Sheets sync (debounced 1.5s so we don't spam on rapid clicks)
  if (isConnected) scheduleSheetsSync();
  else flashSave('local');
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    applyPayload(JSON.parse(raw));
  } catch(e) {}
}

function applyPayload(s) {
  if (!s) return;
  if (s.starting)      s.starting.forEach((on, i) => { if (state.starting[i]) state.starting[i].on = on; });
  if (s.progressions)  s.progressions.forEach((c, i) => { if (state.progressions[i]) state.progressions[i].checked = c; });
  if (s.powers)        s.powers.forEach((a, i) => { if (state.powers[i]) state.powers[i].active = a; });
  if (s.bennies !== undefined)      state.bennies = s.bennies;
  if (s.maxBennies !== undefined)   state.maxBennies = s.maxBennies;
  if (s.wounds)                     state.wounds = s.wounds;
  if (s.woundIncap !== undefined)   state.woundIncap = s.woundIncap;
  if (s.fatigue)                    state.fatigue = s.fatigue;
  if (s.fatigueIncap !== undefined) state.fatigueIncap = s.fatigueIncap;
  if (s.shaken !== undefined)       state.shaken = s.shaken;
  if (s.forceField !== undefined)   state.forceField = s.forceField;
  if (s.showUnskilled !== undefined) state.showUnskilled = s.showUnskilled;
  if (s.acqState) state.acqState = s.acqState;
  if (s.eqState)  state.eqState  = s.eqState;
  if (s.advancesCount !== undefined) state.advancesCount = s.advancesCount;
  if (s.activeEdgeToggles) state.activeEdgeToggles = s.activeEdgeToggles;
  if (s.edgeTrackers)      state.edgeTrackers      = s.edgeTrackers;
}

// ── Google Sheets write ───────────────────────────────────────
function scheduleSheetsSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doSheetsSync(), 1500);
}

async function doSheetsSync() {
  if (!gAuthToken || Date.now() > gTokenExpiry) {
    // Token expired — try silent refresh
    const refreshed = await silentRefresh();
    if (!refreshed) {
      flashSave('local');
      return;
    }
  }
  setSyncStatus('saving');
  try {
    const payload = buildSavePayload();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(STATE_RANGE)}?valueInputOption=RAW`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${gAuthToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [[payload]] })
    });
    if (!resp.ok) {
      // ── HOOK 1: 403 means connected account doesn't own this sheet ──
      if (resp.status === 403 && typeof handleSheetWriteForbidden === 'function') {
        handleSheetWriteForbidden();
      }
      throw new Error(`Sheets write failed: ${resp.status}`);
    }
    flashSave('cloud');
    // Also persist token info
    localStorage.setItem('bolo_gtoken', JSON.stringify({ token: gAuthToken, expiry: gTokenExpiry }));
  } catch(err) {
    console.warn('Sheets sync failed:', err);
    flashSave('local');
  }
}

async function fetchCloudRaw() {
  if (!gAuthToken) return null;
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(STATE_RANGE)}`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${gAuthToken}` } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.values?.[0]?.[0] || null;
  } catch(e) { return null; }
}

async function loadFromSheets() {
  const raw = await fetchCloudRaw();
  if (!raw) return false;
  try {
    applyPayload(JSON.parse(raw));
    localStorage.setItem(SAVE_KEY, raw);
    return true;
  } catch(e) { return false; }
}

// ── OAuth flow ────────────────────────────────────────────────
function handleSyncBtn() {
  if (isConnected) {
    // Disconnect
    gAuthToken = null; gTokenExpiry = 0; isConnected = false;
    localStorage.removeItem('bolo_gtoken');
    setSyncStatus('disconnected');
    // ── HOOK 2 (disconnect): re-check ownership to update banner ──
    if (typeof checkSheetOwnership === 'function') checkSheetOwnership();
    return;
  }
  if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com') {
    alert('Google sync not configured yet.\n\nTo enable cross-device sync:\n1. Go to console.cloud.google.com\n2. Create a project → Enable Sheets API\n3. Create OAuth 2.0 Client ID (Web application)\n4. Add https://spradlinc25.github.io as authorized origin\n5. Paste the Client ID into the HTML file\n\nFor now, use Export/Import buttons to transfer saves between devices.');
    return;
  }
  // Trigger Google OAuth popup
  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SHEETS_SCOPE,
    callback: async (resp) => {
      if (resp.error) { console.error('OAuth error:', resp); return; }
      gAuthToken = resp.access_token;
      gTokenExpiry = Date.now() + (resp.expires_in * 1000) - 60000; // 1min buffer
      isConnected = true;
      setSyncStatus('connected');
      // ── HOOK 2 (connect): register with roster + check ownership ──
      if (typeof tryAutoRegister === 'function') tryAutoRegister();
      // Try to load cloud save — if it's newer than local, use it
      setSyncStatus('loading');
      const loaded = await loadFromSheets();
      if (loaded) {
        fullRefresh();
        flashSave('loaded');
      } else {
        // No cloud save yet — push local state up
        await doSheetsSync();
      }
    }
  });
  client.requestAccessToken();
}

async function silentRefresh() {
  // Check if we have a stored token that's still valid
  try {
    const stored = localStorage.getItem('bolo_gtoken');
    if (!stored) return false;
    const { token, expiry } = JSON.parse(stored);
    if (Date.now() < expiry) {
      gAuthToken = token;
      gTokenExpiry = expiry;
      isConnected = true;
      setSyncStatus('connected');
      return true;
    }
  } catch(e) {}
  return false;
}

// ── UI helpers ────────────────────────────────────────────────
function setSyncStatus(status) {
  const btn = document.getElementById('sync-btn');
  const ind = document.getElementById('save-indicator');
  if (!btn || !ind) return;
  switch(status) {
    case 'connected':
      btn.textContent = '☁ Synced';
      btn.className = 'sync-btn connected';
      btn.title = 'Connected — click to disconnect';
      ind.textContent = 'Cloud sync on';
      ind.style.color = 'var(--green)';
      break;
    case 'saving':
      btn.textContent = '☁ Saving…';
      btn.className = 'sync-btn saving';
      ind.textContent = 'Saving to cloud…';
      ind.style.color = 'var(--accent2)';
      break;
    case 'loading':
      btn.textContent = '☁ Loading…';
      btn.className = 'sync-btn saving';
      ind.textContent = 'Loading from cloud…';
      ind.style.color = 'var(--accent2)';
      break;
    case 'disconnected':
      btn.textContent = '☁ Connect Sync';
      btn.className = 'sync-btn connect';
      btn.title = 'Connect Google account to sync across devices';
      ind.textContent = 'Local only';
      ind.style.color = 'var(--text-dim)';
      break;
    case 'loaded':
      btn.textContent = '☁ Synced';
      btn.className = 'sync-btn connected';
      ind.textContent = 'Loaded from cloud ✓';
      ind.style.color = 'var(--green)';
      setTimeout(() => { if(isConnected) { ind.textContent = 'Cloud sync on'; } }, 3000);
      break;
  }
}

function flashSave(mode='local') {
  const ind = document.getElementById('save-indicator');
  if (!ind) return;
  if (mode === 'cloud') {
    ind.textContent = '☁ Saved to cloud ✓';
    ind.style.color = 'var(--green)';
    const btn = document.getElementById('sync-btn');
    if (btn) { btn.textContent = '☁ Synced'; btn.className = 'sync-btn connected'; }
    setTimeout(() => { if (isConnected) { ind.textContent = 'Cloud sync on'; ind.style.color = 'var(--green)'; } }, 2500);
  } else {
    ind.textContent = '✓ Saved locally';
    ind.style.color = 'var(--text-dim)';
    clearTimeout(localSaveTimer);
    localSaveTimer = setTimeout(() => {
      ind.textContent = isConnected ? 'Cloud sync on' : 'Auto-saves locally';
      ind.style.color = isConnected ? 'var(--green)' : 'var(--text-dim)';
    }, 2000);
  }
}

function clearSave() {
  if (!confirm('Reset everything to defaults? This clears local save and cloud save.')) return;
  localStorage.removeItem(SAVE_KEY);
  if (isConnected) {
    // Clear cloud save too
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(STATE_RANGE)}?valueInputOption=RAW`;
    fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${gAuthToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['']] })
    }).catch(() => {});
  }
  location.reload();
}

// ── Export / Import ───────────────────────────────────────────
function exportSave() {
  const data = localStorage.getItem(SAVE_KEY) || '{}';
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bolo-save.json';
  a.click();
}

function importSave() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        localStorage.setItem(SAVE_KEY, ev.target.result);
        location.reload();
      } catch(err) { alert('Failed to import: ' + err); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================================
// MAIN LOAD — fetch all sheets
// ============================================================
async function loadAllSheets() {
  const indicator=document.getElementById('save-indicator');
  indicator.textContent='Fetching sheet data...';

  try {
    // Fetch all sheets in parallel
    const [
      attrsData, skillsData, startingData, progData,
      tierData, powersData, hindrancesData,
      weaponsData, armorData, gearData,
      edgesRefData, hindrancesRefData, spData, charStateData
    ] = await Promise.all([
      fetchSheet('Attributes'), fetchSheet('Skills'),
      fetchSheet('Starting'),   fetchSheet('Advances'),
      fetchSheet('PowerTiers'), fetchSheet('Powers'),
      fetchSheet('Hindrances'),
      fetchSheet('Weapons'),    fetchSheet('Armor'),
      fetchSheet('Gear'),
      fetchSheet('Edges'),      fetchSheet('Hindrances'),
      fetchSheet('SPCPowers'),  fetchSheet('State')
    ]);

    // ── Populate state (headers now match exactly) ───────────
    // Filter out empty rows or budget warning rows from Attributes
    state.attrs = attrsData.filter(a => {
      const nm = (a.name||'').trim();
      return nm && !nm.startsWith('⚠') && nm.toLowerCase() !== 'name';
    });
    // Filter out note rows (name starts with ⚠ or base is not a number)
    state.skills = skillsData.filter(s => {
      const nm = (s.name||'').trim();
      if (!nm || nm.startsWith('⚠') || nm.startsWith('NOTE')) return false;
      return true;
    });
    // Filter Starting tab — only keep rows with a real name
    state.starting = startingData
      .filter(s => {
        const nm = (s.name||'').trim();
        if (!nm || nm.startsWith('⚠') || nm.toLowerCase() === 'name') return false;
        return true;
      })
      .map(s=>({...s, on: isTrue(s.defaulton)}));
    state.progressions = progData.map(p=>({...p, checked: false}));
    state.powerTiers   = tierData;
    state.powers       = powersData.map(p=>({...p, active: isTrue(p.defaultactive)}));
    state.hindrances   = hindrancesData;
    // Store row numbers (1-indexed, header=1, data starts row 2)
    state.allWeapons   = weaponsData.map((w,i) => ({...w, _row: i+2}));
    state.allArmor     = armorData.map((a,i)  => ({...a, _row: i+2}));
    state.allGear      = gearData.map((g,i)   => ({...g, _row: i+2}));
    state.edgesRef         = edgesRefData;
    state.hindrancesRef    = hindrancesData;
    state.spPowers         = spData;
    state.weaponsRef       = state.allWeapons; // share same objects with row numbers
    state.armorRef         = state.allArmor;

    // Read flat character config from State tab (pace, size)
    if (charStateData && charStateData.length) {
      const stateRow = (key) => charStateData.find(r => (r.key||'').toLowerCase().trim() === key);
      const paceRow = stateRow('pace');
      const sizeRow = stateRow('size');
      if (paceRow && paceRow.value) state.pace = parseInt(paceRow.value) || 6;
      if (sizeRow && sizeRow.value) state.size = parseInt(sizeRow.value) || 0;
      // show_unskilled is managed locally, not stored in sheet
    }

    // Restore session state — prefer whichever is newer (local vs cloud)
    if (isConnected) {
      const localRaw = localStorage.getItem(SAVE_KEY);
      const localTs  = localRaw ? (JSON.parse(localRaw)._ts || 0) : 0;
      const cloudRaw = await fetchCloudRaw();
      const cloudTs  = cloudRaw ? (JSON.parse(cloudRaw)._ts || 0) : 0;
      if (cloudRaw && cloudTs >= localTs) {
        // Cloud is same age or newer — use it and sync localStorage
        applyPayload(JSON.parse(cloudRaw));
        localStorage.setItem(SAVE_KEY, cloudRaw);
      } else {
        // Local is newer (unsync'd changes) — use local, push to cloud
        loadState();
        if (cloudTs < localTs) scheduleSheetsSync();
      }
    } else {
      loadState();
    }
    state.loaded = true;

    // Show all content sections
    document.getElementById('sheet-loading').style.display='none';
    document.getElementById('sheet-content').style.display='block';
    document.getElementById('prog-loading').style.display='none';
    document.getElementById('prog-content').style.display='block';
    document.getElementById('powers-loading').style.display='none';
    document.getElementById('powers-content').style.display='block';
    document.getElementById('ref-loading').style.display='none';
    document.getElementById('ref-content').style.display='block';

    // Render everything
    renderAttrs();
    renderSkills();
    renderHindrances();
    renderEdges();
    renderArmor();
    renderGear();
    renderBennies();
    renderStarting();
    renderProgressions();
    renderPowerTiers();
    renderDiceButtons();
    updateFatigueDisplay();
    updateConditionalVisibility();
    updateStatusBar();
    renderEdgesRef();
    renderHindrancesRef();
    renderSPRef();
    renderWeaponsRef();
    renderArmorRef();
    renderGearRef();

    // Update URL bar to reflect current sheet (makes URL always shareable/bookmarkable)
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get('sheet') !== SHEET_ID) {
      const newUrl = `${window.location.pathname}?sheet=${SHEET_ID}`;
      window.history.replaceState({}, '', newUrl);
    }

    // Update nav character name from sheet State tab 'name' key
    if (charStateData && charStateData.length) {
      const stateRow = (key) => charStateData.find(r => (r.key||'').toLowerCase().trim() === key);
      const nameRow = stateRow('name');
      const charName = nameRow ? nameRow.value : '';
      if (charName) {
        document.getElementById('nav-char-name').textContent = charName;
        document.getElementById('nav-char-sub').style.display = '';
      }
    }

    // Update status bar
    if (isConnected) {
      setSyncStatus('connected');
    } else {
      indicator.textContent = 'Auto-saves locally';
      indicator.style.color = 'var(--text-dim)';
    }

    // ── HOOK 3: after sheet loads, check ownership for banner ──
    if (typeof checkSheetOwnership === 'function') checkSheetOwnership();

  } catch(err) {
    console.error('Sheet load error:', err);
    indicator.textContent='⚠ Sheet load failed';
    indicator.style.color='var(--red)';
    ['sheet-loading','prog-loading','powers-loading','ref-loading'].forEach(id=>{
      const el=document.getElementById(id);
      el.innerHTML=`<div class="error-msg">⚠ Failed to load from Google Sheets: ${err.message}<br><br>Make sure the sheet is published (File → Share → Publish to web) and the Sheet ID is correct.</div>`;
    });
  }
}

// Boot — try silent OAuth restore, then load sheet data
// ── Boot sequence ────────────────────────────────────────────
async function boot() {
  if (!SHEET_ID) {
    showSetupScreen();
    return;
  }
  silentRefresh().then(() => {
    if (isConnected) setSyncStatus('connected');
  });
  loadAllSheets();
}

boot();

// ============================================================
// SETUP SCREEN + CHANGE SHEET
// ============================================================
function showSetupScreen() {
  document.getElementById('setup-overlay').style.display = 'flex';
  // Pre-fill if there's already a stored ID
  const stored = localStorage.getItem('swade_sheet_id');
  if (stored) document.getElementById('setup-sheet-id').value = stored;
}

function hideSetupScreen() {
  document.getElementById('setup-overlay').style.display = 'none';
}

function validateSheetId(id) {
  // Google Sheet IDs are 44-char alphanumeric + hyphens/underscores
  return id && id.trim().length > 20 && /^[A-Za-z0-9_-]+$/.test(id.trim());
}

function setupLoadSheet() {
  const raw = document.getElementById('setup-sheet-id').value;
  const id = raw.trim();
  const errEl = document.getElementById('setup-error');
  const inputEl = document.getElementById('setup-sheet-id');

  // Also accept full URLs — extract ID from them
  const urlMatch = id.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const cleanId = urlMatch ? urlMatch[1] : id;

  if (!validateSheetId(cleanId)) {
    errEl.style.display = 'block';
    inputEl.classList.add('error');
    return;
  }
  errEl.style.display = 'none';
  inputEl.classList.remove('error');

  localStorage.setItem('swade_sheet_id', cleanId);
  SHEET_ID = cleanId;

  // Update URL bar so the sheet link is shareable immediately
  window.history.replaceState({}, '', `${window.location.pathname}?sheet=${cleanId}`);

  hideSetupScreen();
  silentRefresh().then(() => { if (isConnected) setSyncStatus('connected'); });
  loadAllSheets();
}

// Allow Enter key to submit
document.getElementById('setup-sheet-id').addEventListener('keydown', e => {
  if (e.key === 'Enter') setupLoadSheet();
});

// ── Change Sheet modal ──────────────────────────────────────
function openChangeSheet() {
  const modal = document.getElementById('change-sheet-modal');
  document.getElementById('change-sheet-id').value = SHEET_ID;
  document.getElementById('change-sheet-error').style.display = 'none';
  modal.classList.add('open');
  setTimeout(() => document.getElementById('change-sheet-id').focus(), 50);
}

function closeChangeSheet() {
  document.getElementById('change-sheet-modal').classList.remove('open');
}

function confirmChangeSheet() {
  const raw = document.getElementById('change-sheet-id').value;
  const id = raw.trim();
  const errEl = document.getElementById('change-sheet-error');
  const inputEl = document.getElementById('change-sheet-id');

  const urlMatch = id.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const cleanId = urlMatch ? urlMatch[1] : id;

  if (!validateSheetId(cleanId)) {
    errEl.style.display = 'block';
    inputEl.classList.add('error');
    return;
  }
  errEl.style.display = 'none';
  inputEl.classList.remove('error');

  localStorage.setItem('swade_sheet_id', cleanId);
  SHEET_ID = cleanId;

  // Update URL bar so new sheet is bookmarkable immediately
  window.history.replaceState({}, '', `${window.location.pathname}?sheet=${cleanId}`);

  closeChangeSheet();

  // Disconnect OAuth since the sheet changed
  if (isConnected) { gAuthToken = null; gTokenExpiry = 0; isConnected = false; setSyncStatus('disconnected'); }

  // Show loading spinners again
  ['sheet-loading','prog-loading','powers-loading','ref-loading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = ''; el.innerHTML = '<span class=\"loading-spinner\"></span>Loading...'; }
  });
  ['sheet-content','prog-content','powers-content','ref-content'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  loadAllSheets();
}

document.getElementById('change-sheet-id').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmChangeSheet();
  if (e.key === 'Escape') closeChangeSheet();
});

// ── Copy shareable link ────────────────────────────────────
function copySheetLink() {
  const url = `${window.location.origin}${window.location.pathname}?sheet=${SHEET_ID}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copy-link-btn');
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

// Close modal on backdrop click
document.getElementById('change-sheet-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('change-sheet-modal')) closeChangeSheet();
});
