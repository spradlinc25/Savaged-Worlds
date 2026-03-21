// ============================================================
// roster.js — Character Roster Integration
// Depends on: engine.js (SHEET_ID, state), sync.js (gAuthToken, isConnected)
// Load order: 4th, after sync.js
// ============================================================

const ROSTER_SHEET_ID   = '1HntAxiEwIJiqjcKq7UePjAQj8zqF8HEaQOa0hxIMu00';
const APPS_SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbwNsCvJ85Uq1Ji_K50TCDDZKr-t2n1z6dVk6ryDEe2FdwLF_X3KqWBNMPx7AL2bKOSd/exec';
const ROSTER_SHEET_URL  = `https://docs.google.com/spreadsheets/d/${ROSTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;

// ── Not-Linked Banner ─────────────────────────────────────────────────────────

function showNotLinkedBanner(reason) {
  const banner = document.getElementById('not-linked-banner');
  if (!banner) return;
  const msg = banner.querySelector('#not-linked-msg');
  if (msg) {
    if (reason === 'foreign') {
      msg.textContent = 'This sheet belongs to a different Google account — changes will save locally only.';
    } else {
      msg.textContent = 'Character sheet not linked to a Google account — changes will save locally only.';
    }
  }
  banner.style.display = 'flex';
}

function hideNotLinkedBanner() {
  const banner = document.getElementById('not-linked-banner');
  if (banner) banner.style.display = 'none';
}

// Called from sync.js after OAuth connects successfully
function onAccountConnected(email) {
  hideNotLinkedBanner();
  tryAutoRegister(email);
  checkSheetOwnership(email);
}

// Called from sync.js when user has no OAuth token after sheet loads
function onNoAccountConnected() {
  showNotLinkedBanner('unlinked');
}

// Called from sync.js when a Sheets write returns 403
function onForeignSheet() {
  showNotLinkedBanner('foreign');
}

// ── Ownership Check ───────────────────────────────────────────────────────────

// Checks if the connected Google account matches the registered owner of this sheet.
// If roster has this sheet_id under a different email → show foreign banner.
async function checkSheetOwnership(connectedEmail) {
  if (!SHEET_ID || !connectedEmail) return;
  try {
    const resp = await fetch(ROSTER_SHEET_URL);
    const text = await resp.text();
    // Google's gviz response wraps JSON in a callback — strip it
    const json = JSON.parse(text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, ''));
    const rows = json.table?.rows || [];
    for (const row of rows) {
      const cols = row.c || [];
      const sheetId = cols[1]?.v || '';
      const email   = cols[2]?.v || '';
      if (sheetId === SHEET_ID && email && email !== connectedEmail) {
        showNotLinkedBanner('foreign');
        return;
      }
    }
    // Either not registered yet (fine) or matches (fine)
    hideNotLinkedBanner();
  } catch(e) {
    // Roster fetch failing shouldn't disrupt the character sheet
    console.warn('Roster ownership check failed:', e);
  }
}

// ── Auto-Register ─────────────────────────────────────────────────────────────

// Called after OAuth connects. Posts sheet_id, email, and character name
// to the Apps Script Web App which appends/updates a row in the roster sheet.
async function tryAutoRegister(email) {
  if (!SHEET_ID || !email) return;

  // Get character name from state (loaded from the State tab)
  const charName = getCharacterName();
  if (!charName) {
    // State may not be loaded yet — retry once after a short delay
    setTimeout(() => tryAutoRegister(email), 3000);
    return;
  }

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // Apps Script Web Apps require no-cors for cross-origin POST from browser
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: SHEET_ID,
        name: charName,
        email: email
      })
    });
    // no-cors means we can't read the response — that's fine, fire-and-forget
    console.log('Roster: auto-register sent for', charName);
  } catch(e) {
    // Non-critical — don't surface this to the user
    console.warn('Roster auto-register failed:', e);
  }
}

// Safely read character name from state (populated by loadAllSheets in sync.js)
function getCharacterName() {
  try {
    if (state.charStateData && state.charStateData.length) {
      const row = state.charStateData.find(r =>
        (r.key || '').toLowerCase().trim() === 'name'
      );
      return row?.value?.trim() || '';
    }
    // Fallback: check nav display
    const navName = document.getElementById('nav-char-name');
    return navName?.textContent?.trim() || '';
  } catch(e) {
    return '';
  }
}

// ── Roster Page Helpers (used by roster.html) ─────────────────────────────────

// Fetches all rows from the roster sheet and returns an array of character objects.
// No auth required — sheet is published for public read.
async function fetchRoster() {
  const resp = await fetch(ROSTER_SHEET_URL);
  const text = await resp.text();
  const json = JSON.parse(text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, ''));
  const rows = json.table?.rows || [];
  return rows
    .map(row => {
      const cols = row.c || [];
      return {
        name:     cols[0]?.v || 'Unknown',
        sheet_id: cols[1]?.v || '',
        email:    cols[2]?.v || '',
        added:    cols[3]?.v || ''
      };
    })
    .filter(r => r.sheet_id); // skip blank rows
}
