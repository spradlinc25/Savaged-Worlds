// RENDER: ATTRS & SKILLS
// ============================================================
function renderDieDots(lvl) {
  // Cap at 5 (d12) for dot display; d12+1/+2 still light up the d12 dot
  const dotLvl = Math.min(lvl, 5);
  const bonus = lvl > 5 ? `<span style="font-size:9px;color:var(--accent2);font-weight:700;margin-left:2px">+${lvl-5}</span>` : '';
  let h='<div class="die-cells" style="display:flex;align-items:center">';
  for(let i=1;i<=5;i++) h+=`<div class="die-dot${i===dotLvl?' filled':''}">${DIE_NAMES[i-1].replace('d','')}</div>`;
  h += bonus;
  return h+'</div>';
}

function renderAttrs() {
  const tb=document.getElementById('attr-body'); tb.innerHTML='';
  state.attrs.forEach(a=>{
    const lvl=computeAttrLevel(a.name);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="aname">${a.name}</td><td colspan="5">${renderDieDots(lvl)}</td><td class="die-val" style="text-align:right">${dieFor(lvl)}</td>`;
    tb.appendChild(tr);
  });
}

function renderSkills() {
  const tb=document.getElementById('skill-body'); tb.innerHTML='';
  const mods = computeSkillMods();
  state.skills.forEach(s=>{
    const base = parseInt(s.base)||0;
    const lvl = computeSkillLevel(s.name);
    const trained = base > 0 || lvl > 0;
    if (!state.showUnskilled && !trained) return;
    const dispLvl = trained ? Math.max(lvl, base) : 1;

    // Modifier annotation — clickable toggle showing sources
    const skillMods = mods[s.name.toLowerCase()]||[];
    const totalBonus = skillMods.reduce((acc,m)=>acc+m.val, 0);
    const unskLabel = !trained ? '<span style="font-size:9px;color:var(--muted);margin-left:4px">(d4-2)</span>' : '';

    let modLabel = '';
    if (skillMods.length > 0) {
      const bonusColor = totalBonus > 0 ? 'var(--green)' : totalBonus < 0 ? 'var(--red)' : 'var(--accent2)';
      const bonusText = totalBonus !== 0
        ? `${totalBonus > 0 ? '+' : ''}${totalBonus}`
        : '✦';
      const toggleId = 'skm-' + s.name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
      const srcLines = skillMods.map(m =>
        `<div style="font-size:10px;color:var(--text-dim);padding:1px 0 1px 8px">↳ ${m.label}</div>`
      ).join('');
      modLabel = `<span onclick="event.stopPropagation();var el=document.getElementById('${toggleId}');el.style.display=el.style.display==='none'?'block':'none'"
        style="font-size:10px;font-family:'Share Tech Mono',monospace;color:${bonusColor};margin-left:5px;cursor:pointer;border-bottom:1px dotted ${bonusColor}"
        title="Click to see sources">(${bonusText})</span>
        <div id="${toggleId}" style="display:none;margin-top:2px">${srcLines}</div>`;
    }

    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="aname" style="vertical-align:top">${s.name}${unskLabel}${modLabel}</td><td colspan="5" style="vertical-align:top;padding-top:2px">${renderDieDots(dispLvl)}</td><td class="die-val" style="text-align:right;font-size:18px;vertical-align:top;${!trained?'color:var(--muted)':''}">${trained?dieFor(dispLvl):'d4-2'}</td>`;
    tb.appendChild(tr);
  });
  const btn = document.getElementById('unskilled-toggle-btn');
  if (btn) btn.textContent = state.showUnskilled ? 'Hide Unskilled' : 'Show All';
}

function toggleUnskilled() {
  state.showUnskilled = !state.showUnskilled;
  renderSkills();
  saveState();
}

// ============================================================
// RENDER: HINDRANCES & EDGES
// ============================================================
function renderHindrances() {
  const el=document.getElementById('hindrances-list');
  { const hdr=el.previousElementSibling; if(hdr){hdr.classList.remove('card-toggle');hdr.removeAttribute('onclick');const a=hdr.querySelector('.card-arrow');if(a)a.remove();} el.classList.remove('card-collapsed'); }

  // Collect hindrances two ways:
  // 1. bolohad=TRUE in the Hindrances reference tab (legacy)
  // 2. type='hindrance' in the Starting tab (new system)
  const byBolohad = state.hindrances.filter(h=>isTrue(f(h,'acquired','bolohad','bolo_had','bolo')));

  // Starting tab hindrances — match by name against Hindrances library for severity/effect
  const byStarting = state.starting
    .filter(s => s.on && ['hindrance','hindrance-major','hindrance-minor','minor','major'].includes((f(s,'type')||'').toLowerCase().trim()))
    .map(s => {
      const nm = f(s,'name')||'';
      // Look up severity/effect from library
      const lib = state.hindrances.find(h=>(h.name||'').toLowerCase().trim()===nm.toLowerCase().trim());
      const tp = (f(s,'type')||'').trim();
      const inferredSeverity = tp.includes('major') ? 'Major' : tp.includes('minor') ? 'Minor' : '';
      return {
        name: nm,
        severity: lib ? (lib.severity||inferredSeverity) : inferredSeverity,
        effect: lib ? (lib.effect||'') : (f(s,'effect')||''),
      };
    });

  // Merge, deduplicate by name
  const seen = new Set();
  const allH = [];
  [...byBolohad, ...byStarting].forEach(h => {
    const nm = (h.name||'').toLowerCase().trim();
    if (nm && !seen.has(nm)) { seen.add(nm); allH.push(h); }
  });

  if(!allH.length){el.innerHTML='<div style="color:var(--text-dim);font-style:italic;font-size:13px">No hindrances. Add to Starting tab (type=hindrance) or set acquired=TRUE in Hindrances tab.</div>';return;}

  const items = allH.map(h=>{
    const nm=h.name||'', sev=h.severity||'', eff=h.effect||'';
    const minor = sev.toLowerCase().includes('minor') && !sev.toLowerCase().includes('major');
    const cls = classifyHindrance(nm);
    return {cls, html:`<div class="hindrance-item${minor?' minor':''} ${cls==='passive'?'passive-item':''}"><strong>${nm}</strong>${sev?` (${sev})`:''} — ${eff}</div>`};
  });
  el.innerHTML = edgeGroup(items);
}

// ── Classify helpers: read sheet 'active' column first, fallback to defaults ──

function classifyEdge(name) {
  const n = (name||'').toLowerCase().trim();
  const VALID = new Set(['tracker','activate','active','passive']);
  const ref = state.edgesRef.find(e => (e.name||'').toLowerCase().trim() === n);
  if (ref && ref.active) {
    const v = ref.active.toLowerCase().trim();
    if (VALID.has(v)) return v;
  }
  const st = state.starting.find(s => (f(s,'name')||'').toLowerCase().trim() === n);
  if (st && st.active) {
    const v = st.active.toLowerCase().trim();
    if (VALID.has(v)) return v;
  }
  const passiveSet = new Set([
    'brawler','martial artist','bruiser','martial warrior','brawny',
    'block','improved block','tough as nails','tougher than nails',
    'nerves of steel','improved nerves of steel','hard to kill',
    'improved hard to kill','weapon master','master of arms',
    'professional','expert','master','trademark weapon',
    'alertness','attractive','very attractive','arcane background',
    'ambidextrous','elan','fast healer','fleet-footed',
    'quick','rich','filthy rich','scholar','healer',
  ]);
  if (passiveSet.has(n)) return 'passive';
  if (n === 'luck' || n === 'great luck') return 'tracker';
  return 'activate';
}

function classifyHindrance(name) {
  const n = (name||'').toLowerCase().trim();
  // Check Hindrances library for sheet-defined classification
  const ref = state.hindrances.find(h => (h.name||'').toLowerCase().trim() === n);
  if (ref && ref.active) return ref.active.toLowerCase() === 'passive' ? 'passive' : 'active';
  // Fallback
  const passiveSet = new Set([
    'wanted','alien form','enemy','poverty','vow','loyal',
    'greedy','mean','stubborn','ugly','young','small',
    'elderly','illiterate','mild mannered','heroic',
  ]);
  return passiveSet.has(n) ? 'passive' : 'active';
}

function classifyPower(name) {
  const n = (name||'').toLowerCase().trim();
  // Check SPCPowers library for sheet-defined classification
  const ref = state.spPowers.find(p => (p.name||'').toLowerCase().trim() === n);
  if (ref && ref.active) return ref.active.toLowerCase() === 'passive' ? 'passive' : 'active';
  // For character powers, check by partial match against spc library
  const refPartial = state.spPowers.find(p => n.includes((p.name||'').toLowerCase().trim()) || (p.name||'').toLowerCase().trim().includes(n));
  if (refPartial && refPartial.active) return refPartial.active.toLowerCase() === 'passive' ? 'passive' : 'active';
  // Fallback: hardcoded
  const passivePowers = new Set([
    'armor','toughness','super attribute','super skill',"doesn't breathe",
    "doesn't eat","doesn't sleep",'ageless','hardy','fearless',
    'construct','environmental resistance','immune to poison',
    'immune to poison/disease','altered form','absorption',
  ]);
  for (const pp of passivePowers) { if (n.includes(pp)) return 'passive'; }
  return 'active';
}

function edgeGroup(items) {
  const trackers  = items.filter(i=>i.cls==='tracker');
  const activates = items.filter(i=>i.cls==='activate');
  const always    = items.filter(i=>i.cls==='active');
  const passive   = items.filter(i=>i.cls==='passive');
  let html = '';
  if (trackers.length) {
    html += subgroupHdr('⬡ Tracker (limited uses)', 'var(--accent2)');
    html += '<div class="subgroup-body">';
    trackers.forEach(i => { html += i.html; });
    html += '</div>';
  }
  if (activates.length) {
    html += subgroupHdr('▶ Activate / Trigger', 'var(--accent2)');
    html += '<div class="subgroup-body">';
    activates.forEach(i => { html += i.html; });
    html += '</div>';
  }
  if (always.length) {
    html += subgroupHdr('● Always Active', 'var(--green)');
    html += '<div class="subgroup-body">';
    always.forEach(i => { html += i.html; });
    html += '</div>';
  }
  if (passive.length) {
    html += subgroupHdr('◼ Passive (reflected in stats)', 'var(--text-dim)');
    html += '<div class="subgroup-body">';
    passive.forEach(i => { html += i.html; });
    html += '</div>';
  }
  return html;
}

function renderEdges() {
  const el = document.getElementById('edges-list');
  if (!el) return;
  { const hdr=el.previousElementSibling; if(hdr){hdr.classList.remove('card-toggle');hdr.removeAttribute('onclick');const a=hdr.querySelector('.card-arrow');if(a)a.remove();} el.classList.remove('card-collapsed'); }

  const edges = getActiveEdges();   // from engine.js — { name, effect, type }
  if (!edges.length) {
    el.innerHTML = '<div style="color:var(--text-dim);font-style:italic;font-size:13px">No edges. Add via Starting tab (type=Edge) or check advances.</div>';
    return;
  }

  const passive   = edges.filter(e => e.type === 'passive');
  const active    = edges.filter(e => e.type === 'active');
  const trackers  = edges.filter(e => e.type === 'tracker');
  const activates = edges.filter(e => e.type === 'activate');

  let html = '';

  // ── ACTIVE edges ────────────────────────────────────────────
  if (active.length) {
    html += subgroupHdr('● Always Active', 'var(--green)');
    html += '<div class="subgroup-body">';
    active.forEach(e => {
      html += `
        <div class="edge-item edge-active edge-on">
          <div class="edge-row">
            <div class="edge-info">
              <strong>${titleCase(e.name)}</strong>
              <div class="edge-effect-text">${e.effect}</div>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  // ── TRACKER edges ────────────────────────────────────────────
  if (trackers.length) {
    html += subgroupHdr('◈ Trackers (Session Resources)', 'var(--accent2)');
    html += '<div class="subgroup-body">';
    trackers.forEach(e => {
      const used     = !!state.edgeTrackers[e.name];
      const fallback = EDGE_FALLBACK_MAP[e.name] || {};
      const note     = fallback.trackerNote || e.effect;

      html += `
        <div class="edge-item edge-tracker ${used ? 'tracker-used' : ''}">
          <div class="edge-row">
            <div class="edge-info">
              <strong style="${used ? 'text-decoration:line-through;opacity:0.5' : ''}">${titleCase(e.name)}</strong>
              <div class="edge-effect-text" style="${used ? 'opacity:0.4' : ''}">${note}</div>
            </div>
            <button class="edge-toggle-btn ${used ? 'toggle-used' : 'toggle-available'}"
                    onclick="toggleEdgeTracker('${e.name.replace(/'/g, "\\'")}')">
              ${used ? '✓ Used' : 'Available'}
            </button>
          </div>
        </div>`;
    });

    html += `<div style="text-align:right;margin-top:8px">
      <button class="btn-secondary" onclick="resetEdgeTrackers()">↺ Reset All Trackers</button>
    </div>`;
    html += '</div>';
  }

  // ── ACTIVATE edges ───────────────────────────────────────────
  if (activates.length) {
    html += subgroupHdr('▶ Activate / Trigger', 'var(--accent)');
    html += '<div class="subgroup-body">';
    activates.forEach(e => {
      const isOn = !!state.activeEdgeToggles[e.name];
      html += `
        <div class="edge-item edge-active ${isOn ? 'edge-on' : 'edge-off'}">
          <div class="edge-row">
            <div class="edge-info">
              <strong>${titleCase(e.name)}</strong>
              <div class="edge-effect-text">${e.effect}</div>
            </div>
            <button class="edge-toggle-btn ${isOn ? 'toggle-on' : 'toggle-off'}"
                    onclick="toggleEdgeActive('${e.name.replace(/'/g, "\\'")}')">
              ${isOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  // ── PASSIVE edges ────────────────────────────────────────────
  if (passive.length) {
    html += subgroupHdr('◼ Passive (reflected in stats)', 'var(--text-dim)');
    html += '<div class="subgroup-body">';
    passive.forEach(e => {
      const fallback = EDGE_FALLBACK_MAP[e.name] || {};
      const note     = fallback.passiveNote || '';
      const mods     = note ? [] : parseEdgeEffects(e.name, e.effect);
      const modList  = mods.filter(m => m.value !== 0).map(m => m.label).join(' · ');

      html += `
        <div class="edge-item passive-item">
          <strong>${titleCase(e.name)}</strong>
          ${modList ? `<span style="font-size:11px;color:var(--text-dim);margin-left:6px">${modList}</span>` : ''}
          ${note     ? `<span style="font-size:11px;color:var(--text-dim);margin-left:6px;font-style:italic">${note}</span>` : ''}
          ${e.effect ? `<div class="edge-effect-text">${e.effect}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// Renders a section header divider for the edge groups
function sectionHeader(label, color) {
  return `<div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                      color:${color};margin:10px 0 4px;font-weight:700">${label}</div>`;
}
// Renders a collapsible sub-group header (used in Hindrances + Edges)
function subgroupHdr(label, color) {
  return `<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${color};margin:8px 0 3px;font-weight:700;cursor:pointer;user-select:none" onclick="var b=this.nextElementSibling;b.classList.toggle('collapsed');this.querySelector('.sg-arr').textContent=b.classList.contains('collapsed')?'▶':'▼'">${label} <span class="sg-arr">▼</span></div>`;
}

// Converts "berserk" → "Berserk", "improved first strike" → "Improved First Strike"
function titleCase(str) {
  return (str || '').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================
// RENDER: SUPER POWERS SUMMARY
// ============================================================
function renderSPSummary() {
  const container=document.getElementById('sp-summary');
  { const hdr=container.previousElementSibling; if(hdr){hdr.classList.remove('card-toggle');hdr.removeAttribute('onclick');const a=hdr.querySelector('.card-arrow');if(a)a.remove();} container.classList.remove('card-collapsed'); }
  const active = state.powers.filter(p=>p.active);
  if(!active.length){
    container.innerHTML='<div style="color:var(--text-dim);font-style:italic;font-size:13px">No super powers active. Toggle tiers/powers in the Power Tiers tab.</div>';
    return;
  }
  const byTier={};
  active.forEach(p=>{
    const tier=state.powerTiers.find(t=>t.tier===p.tier)||{title:`Tier ${p.tier}`};
    const key=tier.title;
    if(!byTier[key]){byTier[key]={title:key,powers:[]};}
    byTier[key].powers.push(p);
  });
  let html='';
  Object.values(byTier).forEach(group=>{
    html+=`<div class="sp-section"><div class="sp-section-header"><span class="sp-section-title">${group.title}</span><span style="font-size:11px;color:var(--text-dim)">Click power to toggle →</span></div>`;
    const activePow = group.powers.filter(p=>classifyPower(p.name)==='active');
    const passivePow = group.powers.filter(p=>classifyPower(p.name)==='passive');
    if (activePow.length) {
      html+=`<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--accent2);margin:4px 0 3px;font-weight:700">▶ Active</div>`;
      activePow.forEach(p=>{
        const idx=state.powers.indexOf(p);
        html+=`<div class="sp-row sp-on" onclick="togglePowerByIdx(${idx});renderSPSummary()"><div class="sp-check">✓</div><div><div class="sp-name">${p.name}</div><div class="sp-detail">${p.effect}</div></div><div class="sp-spp">${p.spp} SPP</div></div>`;
      });
    }
    if (passivePow.length) {
      html+=`<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin:8px 0 3px;font-weight:700">◼ Passive (reflected in stats)</div>`;
      passivePow.forEach(p=>{
        const idx=state.powers.indexOf(p);
        html+=`<div class="sp-row sp-on" onclick="togglePowerByIdx(${idx});renderSPSummary()"><div class="sp-check">✓</div><div><div class="sp-name">${p.name}</div><div class="sp-detail">${p.effect}</div></div><div class="sp-spp">${p.spp} SPP</div></div>`;
      });
    }
    html+='</div>';
  });
  container.innerHTML=html;
}

// ============================================================
// RENDER: WEAPONS
// ============================================================
function computeWeapons() {
  const strDie=dieFor(computeAttrLevel('Strength'));
  const fDie=dieFor(computeSkillLevel('Fighting'));
  const hasBrawler=hasStart('Brawler (Racial)') || hasEdge('Brawler');
  const hasMA=hasStart('Martial Artist') || hasEdge('Martial Artist');
  const hasBruiser=hasEdge('Bruiser');
  const hasMW=hasEdge('Martial Warrior');
  // Compute unarmed skill modifier for display in weapon skill label
  // MW supersedes MA — use highest only
  const unarmedMod = hasMW ? 2 : hasMA ? 1 : 0;
  const fightingLabel = unarmedMod > 0
    ? `Fighting ${fDie} <span style="font-size:10px;color:var(--green)">(+${unarmedMod} unarmed)</span>`
    : `Fighting ${fDie}`;
  let fistBonus=null;
  if(hasBrawler) fistBonus='d4';
  if(hasMA)      fistBonus='d6';
  if(hasBruiser&&fistBonus==='d6') fistBonus='d8';
  if(hasMW&&fistBonus==='d8')      fistBonus='d10';

  // Build fist damage breakdown note
  const fistBreakdown = [];
  fistBreakdown.push(`${strDie} Strength`);
  if(hasBrawler) fistBreakdown.push(`+d4 Brawler`);
  if(hasMA)      fistBreakdown.push(`→d6 Martial Artist`);
  if(hasBruiser) fistBreakdown.push(`→d8 Bruiser`);
  if(hasMW)      fistBreakdown.push(`→d10 Martial Warrior`);
  const fistNote = `AP 0. Breakdown: ${fistBreakdown.join(', ')}.`;

  const computed=[];
  computed.push({name:'Fists',damage:fistBonus?`${strDie}+${fistBonus}`:strDie,skillLabel:fightingLabel,tags:hasMA?['Natural Weapon']:[],notes:fistNote,upgraded:fistBonus&&fistBonus!=='d4',source:'Racial/Edges'});

  const mp=getActivePower('Melee Attack');
  if(mp && (!Object.prototype.hasOwnProperty.call(state,'enhancedFistsOn') || state.enhancedFistsOn)){
    const extraDice=Math.floor((parseInt(mp.base)||0)/2);
    const pd=extraDice > 1 ? `${extraDice}d6` : 'd6';
    // Build enhanced fist breakdown note
    const enhBreakdown = [...fistBreakdown];
    enhBreakdown.push(`+${pd} Melee Attack (Tier ${mp.tier||'?'}, Heavy Weapon)`);
    const enhNote = `Heavy Weapon — bypasses Heavy Armor. Breakdown: ${enhBreakdown.join(', ')}.`;
    computed.push({name:'Enhanced Fists',damage:fistBonus?`${strDie}+${fistBonus}+${pd}`:`${strDie}+${pd}`,skillLabel:fightingLabel,tags:['Natural Weapon','Heavy Weapon'],notes:enhNote,upgraded:true,source:'Melee Attack Power'});
  }
  // Add acquired non-dynamic weapons from sheet
  state.allWeapons.filter(w=>!isTrue(w.dynamic)&&isAcquired(w)).forEach(w=>{
    computed.push({name:w.name,damage:w.damage,skillLabel:`${w.skill} ${dieFor(computeSkillLevel(w.skill))}`,tags:(w.tags||'').split(',').filter(Boolean),notes:w.notes,upgraded:false,source:w.source});
  });
  return computed;
}

function renderWeapons() {
  const wMods = computeSkillMods();

  function weaponRow(w, showEquipBtn) {
    const tags = w.tags.map(t=>`<span class="wtag ${t==='Heavy Weapon'?'heavy':t==='Natural Weapon'?'natural':''}">${t}</span>`).join('');
    let skillDisplay = w.skillLabel;
    if (w.skill && !w.skillLabel.includes('(+') && !w.skillLabel.includes('(-')) {
      const sm = wMods[(w.skill||'').toLowerCase()]||[];
      const sb = sm.reduce((a,m)=>a+m.val,0);
      if (sb !== 0) skillDisplay += ` <span style="font-size:10px;color:${sb>0?'var(--green)':'var(--red)'}">(${sb>0?'+':''}${sb})</span>`;
    }
    const removeBtn = w.source && w.source !== 'Racial/Edges' && w.source !== 'Melee Attack Power'
      ? `<button class="btn-acquire acquired" onclick="toggleAcquired('${w.name.replace(/'/g,"\\'")}')">Remove</button>`
      : '';
    const equipBtn = showEquipBtn && removeBtn
      ? `<button class="btn-equip ${w.equipped?'equipped':''}" onclick="toggleEquipped('${w.name.replace(/'/g,"\\'")}')">
          ${w.equipped?'Unequip':'Equip'}</button>`
      : '';
    return `<tr><td><div class="wname">${w.name}</div><span class="wsource">${w.source}</span>${removeBtn}${equipBtn}</td><td><div class="wdmg${w.upgraded?' up':''}">${w.damage}</div></td><td><div style="font-size:13px;color:var(--text-dim)">${skillDisplay}</div></td><td><div>${tags}</div><div style="font-size:12px;color:var(--text-dim);margin-top:3px">${w.notes||''}</div></td></tr>`;
  }

  // Compute weapons — attach equipped status
  const raw = computeWeapons();
  raw.forEach(w => {
    const sheet = state.allWeapons.find(sw => (sw.name||'').trim() === w.name);
    w.equipped = sheet ? isEquipped(sheet) : false;
  });

  const equipped = raw.filter(w => w.equipped || w.source === 'Racial/Edges' || w.source === 'Melee Attack Power');
  const acquiredOnly = raw.filter(w => !w.equipped && w.source !== 'Racial/Edges' && w.source !== 'Melee Attack Power');

  // Enhanced Fists toggle button (only shown when Melee Attack power is active)
  const mpActive = !!getActivePower('Melee Attack');
  const efOn = !Object.prototype.hasOwnProperty.call(state,'enhancedFistsOn') || state.enhancedFistsOn;
  const efToggle = mpActive
    ? `<div style="margin-bottom:8px"><button class="btn-acquire${efOn?' acquired':''}" onclick="state.enhancedFistsOn=!state.enhancedFistsOn;renderWeapons();saveState()" title="Toggle Enhanced Fists on/off">${efOn?'▶ Enhanced Fists: ON':'▶ Enhanced Fists: OFF'}</button></div>`
    : '';

  let html = `${efToggle}<table class="weapon-table"><thead><tr><th>Weapon</th><th>Damage</th><th>Skill</th><th>Tags / Notes</th></tr></thead><tbody>`;
  if (equipped.length) {
    html += `<tr><td colspan="4"><div class="gear-section-label" style="color:var(--accent2);margin-top:0;">Equipped Weapons</div></td></tr>`;
    equipped.forEach(w => { html += weaponRow(w, true); });
  }
  if (acquiredOnly.length) {
    html += `<tr><td colspan="4"><div class="gear-divider"></div><div class="gear-section-label">Inventory (Unequipped)</div></td></tr>`;
    acquiredOnly.forEach(w => { html += weaponRow(w, true); });
  }
  html += '</tbody></table>';
  document.getElementById('weapons-table').innerHTML = html;
}

// ============================================================
// RENDER: ARMOR
// ============================================================
function renderArmor() {
  const tb = document.getElementById('armor-body');
  const equippedItems = getEquippedArmor();
  const slots = computeArmorBySlot();

  // Build slot → items map
  const slotMap = {};
  ARMOR_SLOTS.forEach(s => slotMap[s] = []);
  equippedItems.forEach(a => {
    parseArmorLocations(a.location||'').forEach(loc => slotMap[loc].push(a));
  });

  // 1. Equipped armor by slot (Summary)
  let htmlRows = `<tr><td colspan="4"><div class="gear-section-label" style="color:var(--text-dim);margin-top:0;">Slot Summary</div></td></tr>`;
  htmlRows += ARMOR_SLOTS.map(slot => {
    const items = slotMap[slot];
    const val = slots[slot] || 0;
    if (!items.length) {
      return `<tr><td class="aname">${slot}</td><td style="font-family:'Share Tech Mono',monospace;color:var(--text-dim)">0</td><td style="font-size:12px;color:var(--text-dim)" colspan="2">Unarmored</td></tr>`;
    }
    const itemNames = items.map((a,i) => {
      const v = parseInt(a.armorvalue)||0;
      const effective = i === 0 ? v : Math.floor(v/2);
      return `${a.name}${i>0?` (×½=${effective})`:''}`;
    }).join(', ');
    return `<tr><td class="aname">${slot}</td><td style="font-family:'Share Tech Mono',monospace;color:var(--green);font-weight:bold">+${val}</td><td style="font-size:12px;color:var(--text-dim)" colspan="2">${itemNames}</td></tr>`;
  }).join('');

  // 2. Equipped Items List
  if (equippedItems.length) {
    htmlRows += `<tr><td colspan="4"><div class="gear-divider"></div><div class="gear-section-label" style="color:var(--accent)">Equipped Armor</div></td></tr>`;
    equippedItems.forEach(a => {
      const nm = (a.name||'').replace(/'/g,"\\'");
      const val = parseInt(a.armorvalue)||0;
      htmlRows += `<tr>
        <td class="aname">${a.name}</td>
        <td style="font-family:'Share Tech Mono',monospace;color:var(--text-dim)">+${val}</td>
        <td style="font-size:12px;color:var(--text-dim)">Loc: ${a.location||'—'} | ${a.notes||''}</td>
        <td>
          <button class="btn-acquire acquired" onclick="toggleAcquired('${nm}')">Remove</button>
          <button class="btn-equip equipped" onclick="toggleEquipped('${nm}')">Unequip</button>
        </td></tr>`;
    });
  }

  // 3. Acquired but not equipped
  const ownedNotEquipped = state.allArmor.filter(a => {
    const nm = String(a.name||'').trim();
    return isAcquired(a) && !isEquipped(a) && nm && !ARMOR_SLOTS.includes(nm);
  });

  if (ownedNotEquipped.length) {
    htmlRows += `<tr><td colspan="4"><div class="gear-divider"></div><div class="gear-section-label">Inventory (Unequipped)</div></td></tr>`;
    ownedNotEquipped.forEach(a => {
      const nm = (a.name||'').replace(/'/g,"\\'");
      const val = parseInt(a.armorvalue)||0;
      htmlRows += `<tr>
        <td class="aname" style="opacity:0.7">${a.name}</td>
        <td style="font-family:'Share Tech Mono',monospace;color:var(--text-dim);opacity:0.7">+${val}</td>
        <td style="font-size:12px;color:var(--text-dim);opacity:0.7">Loc: ${a.location||'—'} | ${a.notes||''}</td>
        <td>
          <button class="btn-acquire acquired" onclick="toggleAcquired('${nm}')">Remove</button>
          <button class="btn-equip" onclick="toggleEquipped('${nm}')">Equip</button>
        </td></tr>`;
    });
  }

  tb.innerHTML = htmlRows;
}

// ============================================================
// RENDER: GEAR
// ============================================================
function renderGear() {
  const el = document.getElementById('gear-section');
  const acquired = state.allGear.filter(g => isAcquired(g));
  if(!acquired.length){
    el.innerHTML='<div style="color:var(--text-dim);font-style:italic;font-size:13px">No gear acquired. Use Acquire buttons in the Reference tab or mark acquired in the Google Sheet.</div>';
    return;
  }
  let html=`<table class="gear-table"><thead><tr><th>Item</th><th>Wt</th><th>Cost</th><th>Notes</th><th></th></tr></thead><tbody>`;
  acquired.forEach(g=>{
    const nm = (g.name||'').replace(/'/g,"\'");
    html+=`<tr><td style="font-weight:700">${g.name}</td><td style="font-family:'Share Tech Mono',monospace">${g.weight||'—'}</td><td style="font-family:'Share Tech Mono',monospace">${g.cost||'—'}</td><td style="font-size:12px;color:var(--text-dim)">${g.notes||''}</td><td><button class="btn-acquire acquired" onclick="toggleAcquired('${nm}')">Remove</button></td></tr>`;
  });
  html+='</tbody></table>';
  el.innerHTML=html;
}

// ============================================================
// CONDITIONAL VISIBILITY
// ============================================================
function updateConditionalVisibility() {
  const hasPowers = state.powerTiers.length > 0;
  const hasFF = state.powers.some(p => (f(p,'name','power')||'').toLowerCase().includes('force field'));

  // Power Tiers nav button
  const powersBtn = document.getElementById('nav-powers-btn');
  if (powersBtn) powersBtn.style.display = hasPowers ? '' : 'none';

  // Active Super Powers card on Character tab
  const spCard = document.getElementById('sp-summary-card');
  if (spCard) spCard.style.display = hasPowers ? '' : 'none';

  // Force Field pill in status bar — only when FF power is active in current tier
  const ffPill = document.getElementById('ff-pill');
  if (ffPill) ffPill.style.display = getActivePower('Force Field') ? '' : 'none';

  // Force Field status block in Combat Notes
  const ffNotes = document.getElementById('ff-combat-notes');
  if (ffNotes) ffNotes.style.display = hasFF ? '' : 'none';
}

// ============================================================
// WOUND / FATIGUE DISPLAY — now in status bar
// ============================================================
function renderWoundTrack() {
  const {nosIgnore, maxWounds} = getWoundEdgeInfo();
  const container = document.getElementById('sb-wound-boxes');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < maxWounds; i++) {
    const ignored = i < nosIgnore;
    const box = document.createElement('div');
    box.className = `sb-box${state.wounds[i] ? ' wound-on' : ''}${ignored ? ' nos-box' : ''}`;
    box.title = ignored ? `Wound ${i+1} (NOS ignores penalty)` : `Wound ${i+1}`;
    box.onclick = () => toggleWound(i);
    box.textContent = `-${i+1}`;
    container.appendChild(box);
  }
}

function updateWoundDisplay() {
  renderWoundTrack();
  const {nosIgnore, maxWounds} = getWoundEdgeInfo();
  const wc = state.wounds.slice(0, maxWounds).filter(Boolean).length;
  const ep = Math.max(0, wc - nosIgnore);
  const pen = ep > 0 ? `-${ep}` : '0';

  // Status bar wound penalty
  const sbPen = document.getElementById('sb-wound-pen');
  if (sbPen) { sbPen.textContent = pen; sbPen.style.color = wc >= maxWounds ? 'var(--red)' : ep > 0 ? 'var(--accent2)' : 'var(--text-dim)'; }

  // Character tab penalty display
  const wpd = document.getElementById('wound-pen-display');
  if (wpd) { wpd.textContent = pen; wpd.className = 'pval ' + (wc >= maxWounds ? 'danger' : ep > 0 ? 'warning' : 'ok'); }

  // Incap box
  const incapBox = document.getElementById('sb-wound-incap');
  if (incapBox) incapBox.classList.toggle('incap-on', state.woundIncap);

  // Incap warning banner
  const warn = document.getElementById('incap-warning');
  if (warn) warn.style.display = (state.woundIncap || state.fatigueIncap) ? 'block' : 'none';

  // NOS indicator
  const ni = document.getElementById('nos-indicator');
  if (ni) {
    if (nosIgnore > 0) {
      ni.style.display = 'block';
      ni.textContent = nosIgnore === 2 ? '★ Imp. NOS: ignores first 2 penalties' : '★ NOS: ignores first penalty';
    } else {
      ni.style.display = 'none';
    }
  }

  // NOS card in combat notes
  const nosCard = document.getElementById('nos-card');
  const nosText = document.getElementById('nos-detail-text');
  if (nosCard && nosText) {
    nosCard.style.display = nosIgnore > 0 ? 'block' : 'none';
    nosText.textContent = nosIgnore === 2
      ? 'Imp. Nerves of Steel active — first 2 Wound penalties ignored.'
      : 'Nerves of Steel active — first Wound penalty ignored.';
  }

  // Auto-trigger Shaken if incapacitated
  if (state.woundIncap && !state.shaken) {
    state.shaken = true;
    updateShakenDisplay();
  }
}

function updateFatigueDisplay() {
  const fc = state.fatigue.filter(Boolean).length;
  const f0 = document.getElementById('sb-fat-0');
  const f1 = document.getElementById('sb-fat-1');
  const fi = document.getElementById('sb-fat-incap');
  if (f0) f0.classList.toggle('fatigue-on', state.fatigue[0]);
  if (f1) f1.classList.toggle('fatigue-on', state.fatigue[1]);
  if (fi) fi.classList.toggle('incap-on', state.fatigueIncap);

  const pen = fc > 0 ? `-${fc}` : '0';
  const sbFp = document.getElementById('sb-fat-pen');
  if (sbFp) { sbFp.textContent = pen; sbFp.style.color = fc >= 2 ? 'var(--red)' : fc > 0 ? 'var(--accent2)' : 'var(--text-dim)'; }

  const fpd = document.getElementById('fatigue-pen-display');
  if (fpd) { fpd.textContent = pen; fpd.className = 'pval ' + (fc >= 2 ? 'danger' : fc > 0 ? 'warning' : 'ok'); }

  const warn = document.getElementById('incap-warning');
  if (warn) warn.style.display = (state.woundIncap || state.fatigueIncap) ? 'block' : 'none';
}

// ============================================================
// SHAKEN + FORCE FIELD TOGGLES
// ============================================================
function toggleShaken() {
  state.shaken = !state.shaken;
  if (state.shaken && state.forceField) {
    // FF powers down when Shaken
    state._ffBeforeShaken = true; // remember it was on
  }
  if (!state.shaken && state._ffBeforeShaken) {
    // Restore FF when un-Shaken (player can manually toggle off if destroyed)
    state._ffBeforeShaken = false;
  }
  updateShakenDisplay();
  updateFFDisplay();
  document.getElementById('sb-toughness').textContent = buildToughnessDisplay();
  saveState();
}

function updateShakenDisplay() {
  const btn = document.getElementById('shaken-btn');
  if (!btn) return;
  if (state.shaken) {
    btn.textContent = 'SHAKEN';
    btn.className = 'tog-btn shaken-on';
  } else {
    btn.textContent = 'No';
    btn.className = 'tog-btn';
  }
}

function toggleFF() {
  state.forceField = !state.forceField;
  state._ffBeforeShaken = false; // manual toggle clears auto-restore
  updateFFDisplay();
  document.getElementById('sb-toughness').textContent = buildToughnessDisplay();
  saveState();
}

function toggleEdgeActive(edgeName) {
  const n = edgeName.toLowerCase().trim();
  state.activeEdgeToggles[n] = !state.activeEdgeToggles[n];
  fullRefresh();   // stats change, so full re-render needed
  saveState();
}

function toggleEdgeTracker(edgeName) {
  const n = edgeName.toLowerCase().trim();
  state.edgeTrackers[n] = !state.edgeTrackers[n];
  renderEdges();   // only the edges tab needs updating — no stat change
  saveState();
}

function resetEdgeTrackers() {
  state.edgeTrackers = {};
  renderEdges();
  saveState();
}

function updateFFDisplay() {
  const btn = document.getElementById('ff-btn');
  const detail = document.getElementById('ff-status-detail');
  const drPill = document.getElementById('ff-dr-pill');
  const drValue = document.getElementById('ff-dr-value');
  const ffp = getActivePower('Force Field');
  const ffPowerActive = !!ffp;
  const dr = ffp ? (parseInt(ffp.base)||1) : 0;
  const ffOn = state.forceField && ffPowerActive && !state.shaken;
  const ffPoweredDown = state.forceField && ffPowerActive && state.shaken;

  // Toggle button
  if (btn) {
    if (!ffPowerActive) {
      btn.textContent = 'No Power'; btn.className = 'tog-btn'; btn.disabled = true;
    } else if (ffPoweredDown) {
      btn.textContent = 'POWERED DOWN'; btn.className = 'tog-btn ff-down'; btn.disabled = false;
    } else if (ffOn) {
      btn.textContent = 'Active'; btn.className = 'tog-btn ff-on'; btn.disabled = false;
    } else {
      btn.textContent = 'Off'; btn.className = 'tog-btn'; btn.disabled = false;
    }
  }

  // DR pill in status bar — only visible when FF is actively on
  if (drPill && drValue) {
    drPill.style.display = ffOn ? '' : 'none';
    drValue.textContent = `DR ${dr}`;
  }

  // Combat notes detail
  if (detail) {
    if (!ffPowerActive) {
      detail.textContent = 'Force Field power not active in current tier.';
      detail.style.color = 'var(--text-dim)';
    } else if (ffPoweredDown) {
      detail.innerHTML = `<span style="color:var(--red)">⚠ POWERED DOWN</span> — Shaken. DR ${dr} lost until recovered.`;
    } else if (ffOn) {
      detail.innerHTML = `<span style="color:var(--blue)">● Active</span> — Reducing all incoming damage by ${dr}. Not Toughness — applied after hit lands.`;
    } else {
      detail.textContent = `Force Field off (DR ${dr} when active). Toggle to activate.`;
      detail.style.color = 'var(--text-dim)';
    }
  }
}
function updateStatusBar() {
  const rank=computeRank();
  const rankEl=document.getElementById('nav-rank-display');
  document.getElementById('sb-rank').textContent=rank;
  if(rankEl){ rankEl.textContent=rank; rankEl.style.color=rankColor(rank); }
  document.getElementById('sb-parry').textContent=computeParry();
  document.getElementById('sb-toughness').textContent=buildToughnessDisplay();
  document.getElementById('sb-pace').textContent=state.pace||6;
  document.getElementById('sb-carry').textContent=`${computeCarryLimit()} lbs`;
  updateWoundDisplay();
  updateFatigueDisplay();
  updateFFDisplay();
  renderWeapons();
  renderSPSummary();
  saveState();
}

// ============================================================
// RENDER: BENNIES
// ============================================================
function renderBennies() {
  const track=document.getElementById('bennies-track'); track.innerHTML='';
  for(let i=0;i<state.maxBennies;i++){
    const b=document.createElement('div');
    const active = i < state.bennies;
    b.className='benny'+(active?'':' spent');
    b.title=active?'Click to spend':'Click to restore';
    b.onclick=()=>{
      if(i < state.bennies) {
        // Spend: clicking an active benny
        state.bennies--;
      } else if(i === state.bennies) {
        // Restore: clicking the first spent benny restores one
        state.bennies++;
      }
      renderBennies();
      saveState();
    };
    track.appendChild(b);
  }
}
function addBenny(){state.maxBennies++;state.bennies++;renderBennies();saveState();}

// ============================================================
// RENDER: PROGRESSIONS
// ============================================================
function renderStarting() {
  const container=document.getElementById('starting-list'); container.innerHTML='';
  // attribute/skill/money are budget-math only — no toggle needed, effect is in the sheet tabs
  const BUDGET_ONLY = new Set(['attribute','skill','money']);
  state.starting.forEach((s,i)=>{
    const tp = (s.type||'').toLowerCase().trim();
    if (BUDGET_ONLY.has(tp)) return;
    const row=document.createElement('div');
    row.className='starting-row'+(s.on?' checked':'');
    // Show a readable type label
    const typeLabel = tp.replace('hindrance-','').replace('-',' ');
    row.innerHTML=`<div class="prog-chk">${s.on?'✓':''}</div><div><div class="prog-sel">${s.name}</div><div class="prog-pre">${typeLabel}</div></div><div class="prog-eff">${s.effect||''}</div>`;
    row.onclick=()=>{state.starting[i].on=!state.starting[i].on;fullRefresh();};
    container.appendChild(row);
  });
}

function renderProgressions() {
  const container=document.getElementById('prog-list'); container.innerHTML='';

  // Update advance counter
  const total = state.progressions.reduce((max, p) => Math.max(max, parseInt(p.adv)||0), 0);
  const checked = state.progressions.filter(p=>p.checked).length;
  const rank = computeRank();
  const advCount = document.getElementById('adv-count');
  const advTotal = document.getElementById('adv-total');
  const advRank  = document.getElementById('adv-rank');
  // Use manual override if set, otherwise fall back to computed checked count
  const displayCount = (state.advancesCount !== undefined && state.advancesCount !== null)
    ? state.advancesCount : checked;
  if (advCount && document.activeElement !== advCount) advCount.textContent = displayCount;
  if (advTotal) advTotal.textContent = total;
  if (advRank)  { advRank.textContent = rank; advRank.style.color = rankColor(rank); }

  const ranks=['Novice','Seasoned','Veteran','Heroic','Legendary'];
  ranks.forEach(rank=>{
    const items=state.progressions.filter(p=>p.rank===rank);
    if(!items.length) return;
    const tier=document.createElement('div'); tier.className='prog-tier';
    tier.innerHTML=`<div class="tier-badge ${rank.toLowerCase()}">${rank}</div>`;
    items.forEach(p=>{
      const gi=state.progressions.indexOf(p);
      const tc=p.type==='Attribute'?'attribute':p.type.startsWith('Skill')?'skill':p.type==='Edge'?'edge':'open';

      // Look up edge details from reference library
      let desc = p.effect || '';
      let source = '';
      if(p.type==='Edge') {
        const edgeRef = state.edgesRef.find(e=>e.name && e.name.toLowerCase()===p.selection.toLowerCase());
        if(edgeRef) {
          desc = edgeRef.effect || desc;
          source = edgeRef.book || edgeRef.source || '';
        }
      }
      const bookCls = source.toUpperCase()==='SPC'?'spc':'swade';
      const sourceBadge = source ? `<span class="book-tag ${bookCls}" style="margin-left:6px">${source}</span>` : '';

      const row=document.createElement('div');
      row.className='prog-row'+(p.checked?' checked':'');
      // Desktop: 4 columns — check | name+prereq+badge | type badge | description
      // Mobile: collapses to 2 columns via CSS, all info stacks in col 2
      row.innerHTML=`
        <div class="prog-chk">${p.checked?'✓':''}</div>
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="prog-sel">${p.selection}</span>${sourceBadge}
          </div>
          <div class="prog-pre">${p.prereq}</div>
          <div class="prog-eff prog-eff-mobile">${desc}</div>
        </div>
        <div class="prog-tbadge ${tc} prog-col-desktop">${p.type}</div>
        <div class="prog-eff prog-col-desktop">${desc}</div>`;
      row.onclick=()=>{state.progressions[gi].checked=!state.progressions[gi].checked;fullRefresh();};
      tier.appendChild(row);
    });
    container.appendChild(tier);
  });
}

// ============================================================
// RENDER: POWER TIERS
// ============================================================
function renderPowerTiers() {
  const container=document.getElementById('power-list-container'); container.innerHTML='';

  state.powerTiers.forEach(tier=>{
    // Use parseInt for comparison — handles "1", " 1", 1, "1.0" etc.
    const tierNum = parseInt(tier.tier||0);
    // CRITICAL FIX: Filter out completely empty rows (blank names)
    const tierPowers = state.powers.filter(p => parseInt(p.tier||0) === tierNum && p.name && p.name.trim() !== '');
    const totalSPP = tierPowers.reduce((s,p)=>s+(parseInt(p.spp)||0),0);
    const tierActive = tierPowers.length && tierPowers.every(p=>p.active);
    const div=document.createElement('div'); div.className='power-tier';
    div.innerHTML=`
      <div class="pt-header${tierActive?' tier-on':''}" onclick="toggleTierActive(${tierNum})">
        <div><div class="pt-title">${tier.title||'Tier '+tierNum}</div><div style="font-size:12px;color:var(--text-dim);margin-top:2px">${tier.spplabel||''}</div></div>
        <div style="display:flex;align-items:center;gap:14px"><span style="font-family:'Share Tech Mono',monospace;font-size:13px;color:var(--accent2)">Total: ${totalSPP} SPP</span><span style="font-size:20px;color:var(--text-dim)">${tierActive?'●':'○'}</span></div>
      </div>
      <div class="pt-list">
        <div class="pt-colhdr"><div></div><div class="col-h" style="text-align:left">Power / Trapping</div><div class="col-h">Modifier</div><div class="col-h">Base</div><div class="col-h">Adj</div><div class="col-h">SPP</div></div>
        ${tierPowers.length ? tierPowers.map((p)=>{
          const idx=state.powers.indexOf(p);
          return `<div class="pt-row${p.active?' pt-on':''}" onclick="togglePowerByIdx(${idx})">
            <div class="pt-check">${p.active?'✓':''}</div>
            <div><div class="pt-pname">${p.name||''}</div><div style="font-size:11px;color:var(--text-dim)">${p.effect||''}</div></div>
            <div class="pt-mod">${p.mod||''}</div>
            <div class="col-c">${p.base||''}</div>
            <div class="col-c" style="color:${parseInt(p.adj)>0?'var(--green)':parseInt(p.adj)<0?'var(--red)':'var(--text-dim)'}">${parseInt(p.adj)>0?'+':''}${p.adj||0}</div>
            <div class="col-spp">${p.spp||''}</div>
          </div>`;
        }).join('') : '<div style="padding:12px;color:var(--text-dim);font-size:13px;font-style:italic;">No active powers mapped to this tier.</div>'}
      </div>`;
    container.appendChild(div);
  });
}

function toggleTierActive(tierNum) {
  const tierPowers = state.powers.filter(p => parseInt(p.tier||0) === parseInt(tierNum||0));
  const allOn = tierPowers.every(p=>p.active);
  tierPowers.forEach(p=>p.active=!allOn);
  renderPowerTiers(); fullRefresh();
}
function togglePowerByIdx(idx) {
  state.powers[idx].active=!state.powers[idx].active;
  renderPowerTiers(); fullRefresh();
}

// ============================================================
// RENDER: REFERENCE TABLES
// ============================================================
// ── Accordion builder ─────────────────────────────────────────
function buildAccItem(name, badgeHtml, rows) {
  // rows = [{label, value}]
  const item = document.createElement('div');
  item.className = 'acc-item';
  item.dataset.search = name.toLowerCase() + ' ' + rows.map(r=>r.value).join(' ').toLowerCase();
  item.innerHTML = `
    <div class="acc-header" onclick="this.parentElement.classList.toggle('open')">
      <span class="acc-name">${name}</span>
      <span class="acc-meta">${badgeHtml}</span>
      <span class="acc-arrow">▼</span>
    </div>
    <div class="acc-body">
      ${rows.filter(r=>r.value).map(r=>`
        <div class="acc-row">
          <span class="acc-lbl">${r.label}</span>
          <span class="acc-val">${r.value}</span>
        </div>`).join('')}
    </div>`;
  return item;
}

function bookBadge(book) {
  const cls = (book||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
  return `<span class="book-tag ${cls}">${book||'SWADE'}</span>`;
}

function renderEdgesRef() {
  const tb=document.getElementById('edges-ref-body'); tb.innerHTML='';
  const acc=document.getElementById('edges-acc'); acc.innerHTML='';
  acc.style.cssText='display:block;max-height:420px;overflow-y:auto;overflow-x:hidden;border-radius:4px;margin-bottom:12px;';
  // Sticky column header row (not an acc-item, ignored by filterRef)
  const hdr=document.createElement('div');
  hdr.className='edges-acc-header-row';
  hdr.innerHTML='<span>Edge</span><span>Category</span><span>Effect</span><span>Book</span><span></span>';
  acc.appendChild(hdr);
  state.edgesRef.forEach(e=>{
    const bookCls=(e.book||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${e.name||''}</td><td>${e.category||''}</td><td style="color:var(--text-dim)">${e.prereq||''}</td><td>${e.effect||''}</td><td><span class="book-tag ${bookCls}">${e.book||'SWADE'}</span></td>`;
    tb.appendChild(tr);
    const edgeBadge = (e.category ? `<span class="edge-cat">${e.category}</span>` : '')
      + (e.effect ? `<span class="edge-eff">${e.effect}</span>` : '')
      + bookBadge(e.book);
    acc.appendChild(buildAccItem(e.name||'', edgeBadge, [
      {label:'Category',    value:e.category||''},
      {label:'Prereq',      value:e.prereq||''},
      {label:'Description', value:e.description||''}
    ]));
  });
}

function renderHindrancesRef() {
  const tb=document.getElementById('hindrances-ref-body'); tb.innerHTML='';
  const acc=document.getElementById('hindrances-acc'); acc.innerHTML='';
  state.hindrancesRef.forEach(h=>{
    const nm=f(h,'name','hindrance','hindrance_name','title')||'';
    const bookCls=(h.book||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${nm}</td><td>${h.severity||''}</td><td>${h.effect||''}</td><td><span class="book-tag ${bookCls}">${h.book||'SWADE'}</span></td>`;
    tb.appendChild(tr);
    acc.appendChild(buildAccItem(nm, bookBadge(h.book), [
      {label:'Severity', value:h.severity||''},
      {label:'Effect',   value:h.effect||''}
    ]));
  });
}

function renderSPRef() {
  const tb=document.getElementById('sp-ref-body'); tb.innerHTML='';
  const acc=document.getElementById('sp-acc'); acc.innerHTML='';
  state.spPowers.forEach(p=>{
    const nm    = f(p,'name','power','power_name');
    const cost  = f(p,'basecost','base_cost','cost');
    const ctype = f(p,'costtype','cost_type','type');
    const sum   = f(p,'summary','description','effect');
    const notes = f(p,'notes','note');
    const src   = f(p,'source','page','src');
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${nm}</td><td style="font-family:'Share Tech Mono',monospace">${cost}</td><td>${ctype}</td><td>${sum}</td><td class="sp-notes-col" style="color:var(--text-dim)">${notes}</td><td style="color:var(--text-dim)">${src}</td>`;
    tb.appendChild(tr);
    acc.appendChild(buildAccItem(nm, `<span style="font-family:'Share Tech Mono',monospace;color:var(--accent2);font-size:12px">${cost} SPP</span>`, [
      {label:'Type',    value:ctype},
      {label:'Summary', value:sum},
      {label:'Notes',   value:notes},
      {label:'Source',  value:src}
    ]));
  });
}

function renderArmorRef() {
  const tb=document.getElementById('armor-ref-body'); tb.innerHTML='';
  const acc=document.getElementById('armor-acc'); acc.innerHTML='';
  state.armorRef.forEach(a=>{
    const nm = String(f(a,'name','location','armor')||'').trim();
    if(!nm || isTrue(nm) || nm.toLowerCase()==='false') return;
    if(ARMOR_SLOTS.includes(nm)) return; // skip slot placeholder rows
    const bookCls=(f(a,'book')||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
    const val   = f(a,'armorvalue','armor_value','value');
    const wt    = f(a,'weight','wt');
    const notes = f(a,'notes','note','description');
    const book  = f(a,'book')||'SWADE';
    const acq = isAcquired(a);
    const eq  = isEquipped(a);
    const nmEsc = nm.replace(/'/g,"\\'");
    const acqBtn = `<button class="btn-acquire${acq?' acquired':''}" onclick="toggleAcquired('${nmEsc}')">${acq?'Remove':'Acquire'}</button>`;
    const eqBtn  = acq ? `<button class="btn-equip${eq?' equipped':''}" onclick="toggleEquipped('${nmEsc}')">${eq?'Equipped':'Equip'}</button>` : '';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${nm}</td><td style="font-family:'Share Tech Mono',monospace" class="ref-col-hide-mobile">+${val}</td><td class="ref-col-hide-mobile">${wt||'—'}</td><td style="color:var(--text-dim);font-size:12px" class="ref-col-hide-mobile">${notes}</td><td>${acqBtn}${eqBtn}</td>`;
    tb.appendChild(tr);
    acc.appendChild(buildAccItem(nm, `${bookBadge(book)}${acqBtn}${eqBtn}`, [
      {label:'Armor',  value:`+${val}`},
      {label:'Weight', value:wt ? `${wt} lbs` : ''},
      {label:'Notes',  value:notes}
    ]));
  });
}

function renderGearRef() {
  const tb = document.getElementById('gear-ref-body');
  const acc = document.getElementById('gear-acc');
  if (!tb) return;
  tb.innerHTML=''; if(acc) acc.innerHTML='';
  state.allGear.forEach(g => {
    const nm = String(g.name||'').trim();
    if (!nm) return;
    const acq = isAcquired(g);
    const nmEsc = nm.replace(/'/g,"\\'");
    const acqBtn = `<button class="btn-acquire${acq?' acquired':''}" onclick="toggleAcquired('${nmEsc}')">${acq?'Remove':'Acquire'}</button>`;
    const bookCls = (g.book||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-weight:700">${nm}</td><td style="font-family:'Share Tech Mono',monospace" class="ref-col-hide-mobile">${g.weight||'—'}</td><td style="font-family:'Share Tech Mono',monospace" class="ref-col-hide-mobile">${g.cost||'—'}</td><td style="color:var(--text-dim);font-size:12px" class="ref-col-hide-mobile">${g.notes||''}</td><td>${acqBtn}</td>`;
    tb.appendChild(tr);
    if(acc) acc.appendChild(buildAccItem(nm, acqBtn, [
      {label:'Weight', value: g.weight ? `${g.weight} lbs` : ''},
      {label:'Cost',   value: g.cost ? `$${g.cost}` : ''},
      {label:'Notes',  value: g.notes||''}
    ]));
  });
}

function renderWeaponsRef() {
  const tb=document.getElementById('weapons-ref-body'); tb.innerHTML='';
  const acc=document.getElementById('weapons-acc'); acc.innerHTML='';

  // ── Prepend computed weapons (Fists, Enhanced Fists) ──────
  const cw = computeWeapons().filter(w => w.source === 'Racial/Edges' || w.source === 'Melee Attack Power');
  cw.forEach(w => {
    const isEF = w.source === 'Melee Attack Power';
    const efOn = !Object.prototype.hasOwnProperty.call(state,'enhancedFistsOn') || state.enhancedFistsOn;
    const toggleBtn = isEF
      ? `<button class="btn-equip${efOn?' equipped':''}" onclick="state.enhancedFistsOn=!state.enhancedFistsOn;renderWeapons();renderWeaponsRef();saveState()">${efOn?'Active':'Inactive'}</button>`
      : '';
    const badge = `<span class="wsource" style="margin-left:4px">Racial/Edge</span>`;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${w.name}${badge}</td><td style="font-family:'Share Tech Mono',monospace" class="ref-col-hide-mobile">${w.damage}</td><td class="ref-col-hide-mobile">${w.skillLabel.replace(/<[^>]+>/g,'')}</td><td style="color:var(--text-dim);font-size:12px" class="ref-col-hide-mobile">${w.notes||''}</td><td>${toggleBtn}</td>`;
    tb.appendChild(tr);
    acc.appendChild(buildAccItem(w.name, badge+toggleBtn, [
      {label:'Damage', value:w.damage},
      {label:'Skill',  value:w.skillLabel.replace(/<[^>]+>/g,'')},
      {label:'Notes',  value:w.notes||''}
    ]));
  });

  state.weaponsRef.forEach(w=>{
    const nm = String(w.name||'').trim();
    if(!nm || nm==='TRUE' || nm==='FALSE' || nm==='true' || nm==='false') return;
    if(isTrue(w.dynamic)) return; // skip computed weapons
    const bookCls=(w.book||'SWADE').toUpperCase()==='SPC'?'spc':'swade';
    const acq = isAcquired(w);
    const eq  = isEquipped(w);
    const nmEsc = nm.replace(/'/g,"\\'");
    const acqBtn = `<button class="btn-acquire${acq?' acquired':''}" onclick="toggleAcquired('${nmEsc}')">${acq?'Remove':'Acquire'}</button>`;
    const eqBtn  = acq ? `<button class="btn-equip${eq?' equipped':''}" onclick="toggleEquipped('${nmEsc}')">${eq?'Equipped':'Equip'}</button>` : '';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="font-weight:700">${nm}</td><td style="font-family:'Share Tech Mono',monospace" class="ref-col-hide-mobile">${w.damage||''}</td><td class="ref-col-hide-mobile">${w.skill||''}</td><td style="color:var(--text-dim);font-size:12px" class="ref-col-hide-mobile">${w.notes||''}</td><td>${acqBtn}${eqBtn}</td>`;
    tb.appendChild(tr);
    acc.appendChild(buildAccItem(nm, `${bookBadge(w.book)}${acqBtn}${eqBtn}`, [
      {label:'Damage', value:w.damage||''},
      {label:'Skill',  value:w.skill||''},
      {label:'Notes',  value:w.notes||''}
    ]));
  });
}

// ── Unified filter — drives both table rows AND accordion items ──
function filterRef(inputId, tableId, accId) {
  const q = document.getElementById(inputId).value.toLowerCase().trim();
  // Filter table rows
  document.getElementById(tableId).querySelectorAll('tbody tr').forEach(tr=>{
    tr.style.display = (!q || tr.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
  // Filter accordion items
  if (accId) {
    document.getElementById(accId).querySelectorAll('.acc-item').forEach(item=>{
      item.style.display = (!q || item.dataset.search.includes(q)) ? '' : 'none';
    });
  }
}

// Keep old filterTable as alias for any other uses
function filterTable(inputId, tableId) { filterRef(inputId, tableId, null); }

// ============================================================
// RENDER: DICE ROLLER
// ============================================================
function renderDiceButtons() {
  const row=document.getElementById('dice-row'); row.innerHTML='';
  [4,6,8,10,12,20].forEach(d=>{
    const btn=document.createElement('button');
    btn.className='die-btn'; btn.textContent=`d${d}`;
    btn.onclick=()=>rollDie(d); row.appendChild(btn);
  });
  const w=document.createElement('button');
  w.className='die-btn wild-die'; w.textContent='Wild d6';
  w.onclick=()=>rollDie(6,true); row.appendChild(w);
}

function rollDie(sides, forceWild=false, diePlusMod=0) {
  const mod = parseInt(document.getElementById('roll-modifier').value)||0;
  const useWild = forceWild || document.getElementById('wild-toggle').checked;

  function roll(s) {
    const rolls = [];
    let r = Math.floor(Math.random()*s)+1;
    rolls.push(r);
    let x = 0;
    while (r === s && x < 10) {
      r = Math.floor(Math.random()*s)+1;
      rolls.push(r);
      x++;
    }
    const total = rolls.reduce((a,b)=>a+b,0);
    return { total, rolls, aced: x > 0, aceCount: x };
  }

  const main = roll(sides);
  const fm = main.total + mod + diePlusMod;

  // Build roll breakdown string e.g. "6+6+3=15"
  function breakdown(r, s) {
    if (r.rolls.length === 1) return `${r.rolls[0]}`;
    return `${r.rolls.join('+')} = ${r.total}`;
  }

  const aceLabel = main.aceCount >= 2 ? ` (${main.aceCount}× Ace!)` : main.aceCount === 1 ? ' (Ace!)' : '';
  const dieLabel = diePlusMod > 0 ? `d${sides}+${diePlusMod}` : `d${sides}`;
  let detailParts = [`${dieLabel}: ${breakdown(main)}${aceLabel}${diePlusMod>0?" + "+diePlusMod+" (die bonus)":""}`];
  if (mod !== 0) detailParts.push(`mod ${mod >= 0 ? '+' : ''}${mod}`);

  let fr = fm;
  let wildInfo = '';

  if (useWild && !forceWild) {
    const w = roll(6);
    const fw = w.total + mod;
    const wAceLabel = w.aceCount >= 2 ? ` (${w.aceCount}× Ace!)` : w.aceCount === 1 ? ' (Ace!)' : '';
    const wBreak = breakdown(w, 6);
    if (fw > fm) {
      fr = fw;
      wildInfo = `Wild d6: ${wBreak}${wAceLabel} ← used`;
      detailParts[0] += ' (not used)';
    } else {
      wildInfo = `Wild d6: ${wBreak}${wAceLabel}`;
    }
  }

  if (mod !== 0) {
    const usedTotal = useWild && !forceWild ? (fr - mod) : main.total;
    detailParts = detailParts.filter(p => !p.startsWith('mod'));
    // show final calc
  }

  const finalDetail = detailParts.join(' · ') + (wildInfo ? ` · ${wildInfo}` : '') + (mod !== 0 ? ` · total with mod: ${fr}` : '');

  let st = 'Failure', sc = 'fail';
  if (fr >= 4) {
    const raises = Math.floor((fr - 4) / 4);
    st = raises > 0 ? `Success with ${raises} Raise${raises > 1 ? 's' : ''}!` : 'Success!';
    sc = raises > 0 ? 'raise' : 'success';
  }

  const re = document.getElementById('roll-result');
  re.style.display = 'flex';
  re.innerHTML = `<div class="roll-num">${fr}</div><div><div class="roll-suc ${sc}">${st}</div><div class="roll-det">${finalDetail}</div></div>`;
}

function renderSkillQuickRef() {
  const mods = computeSkillMods();
  const all=[...state.attrs.map(a=>({name:a.name,isAttr:true})),...state.skills.map(s=>({name:s.name,isAttr:false}))];
  let html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:7px;margin-top:10px">';
  all.forEach(item=>{
    const lvl=item.isAttr?computeAttrLevel(item.name):computeSkillLevel(item.name);
    if (!item.isAttr && lvl === 0) return; // hide unskilled from quick ref
    const die=dieFor(lvl);
    const sides=dieVal(lvl);
    const dm=dieMod(lvl);
    const col=item.isAttr?'var(--blue)':'var(--accent2)';
    const skillMods = mods[item.name.toLowerCase()]||[];
    const totalBonus = skillMods.reduce((s,m)=>s+m.val,0);
    const bonusStr = totalBonus!==0 ? `<span style="font-size:11px;font-family:'Share Tech Mono',monospace;color:${totalBonus>0?'var(--green)':'var(--red)'}"> (${totalBonus>0?'+':''}${totalBonus})</span>` : '';
    const modLines = skillMods.map(m=>`<div style="font-size:10px;color:var(--text-dim);padding-left:4px">↳ ${m.label}</div>`).join('');
    const hasToggle = skillMods.length > 0;
    const toggleId = `skmod-${item.name.replace(/[^a-z]/gi,'').toLowerCase()}`;
    html+=`<div style="background:var(--surface2);border:1px solid ${hasToggle?'var(--accent2)':'var(--border)'};border-radius:4px;padding:7px 11px;">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="rollDie(${sides},false,${dm})">
        <span style="font-weight:600">${item.name}${bonusStr}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:19px;color:${col}">${die}</span>
      </div>
      ${hasToggle?`<div id="${toggleId}" style="display:none;margin-top:4px;border-top:1px solid var(--border);padding-top:4px">${modLines}</div>
      <div onclick="document.getElementById('${toggleId}').style.display=document.getElementById('${toggleId}').style.display==='none'?'block':'none'" style="text-align:center;font-size:9px;color:var(--text-dim);cursor:pointer;margin-top:4px;letter-spacing:1px;text-transform:uppercase">▾ modifiers</div>`:''}
    </div>`;
  });
  html+='</div>';
  document.getElementById('skill-quick-ref').innerHTML=html;
}

// ============================================================
// WOUND / FATIGUE TOGGLES
// ============================================================
function toggleWound(i){
  const {maxWounds}=getWoundEdgeInfo();
  state.wounds[i]=!state.wounds[i];
  if(!state.wounds[i]){for(let j=i+1;j<maxWounds;j++)state.wounds[j]=false;state.woundIncap=false;}
  updateWoundDisplay();
  document.getElementById('sb-toughness').textContent=buildToughnessDisplay();
  saveState();
}
function toggleIncap(){
  const {maxWounds}=getWoundEdgeInfo();
  state.woundIncap=!state.woundIncap;
  if(state.woundIncap)state.wounds=Array(maxWounds).fill(true);
  updateWoundDisplay();
  saveState();
}
function toggleFatigue(i){
  state.fatigue[i]=!state.fatigue[i];
  if(!state.fatigue[i]){for(let j=i+1;j<2;j++)state.fatigue[j]=false;state.fatigueIncap=false;}
  updateFatigueDisplay();
  saveState();
}
function toggleFatigueIncap(){
  state.fatigueIncap=!state.fatigueIncap;
  if(state.fatigueIncap)state.fatigue=[true,true];
  updateFatigueDisplay();
  saveState();
}

// ============================================================
// NAV
// ============================================================
function showTab(name,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(btn) btn.classList.add('active');
  if(name==='roller'&&state.loaded) renderSkillQuickRef();
  localStorage.setItem('swade_active_tab', name);
}

// ============================================================
// ADVANCES COUNT — manual editable override
// ============================================================
function setAdvancesCount(val) {
  const total = state.progressions.length;
  const raw = parseInt(val, 10);
  const n = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, total));
  state.advancesCount = n;

  // Auto-check first n advances in rank order, uncheck the rest
  const RANK_ORDER = ['Novice','Seasoned','Veteran','Heroic','Legendary'];
  const ordered = [];
  RANK_ORDER.forEach(rank => {
    state.progressions.forEach((p, i) => {
      if ((p.rank || 'Novice') === rank) ordered.push(i);
    });
  });
  ordered.forEach((idx, pos) => { state.progressions[idx].checked = pos < n; });

  renderProgressions();
  fullRefresh();
  saveState();
}

function toggleCard(bodyId) {
  const body = document.getElementById(bodyId);
  const header = body.previousElementSibling;
  if (!body || !header) return;
  const collapsed = body.classList.toggle('card-collapsed');
  const arrow = header.querySelector('.card-arrow');
  if (arrow) arrow.style.transform = collapsed ? 'rotate(-90deg)' : '';
}

function toggleLibSection(bodyId) {
  const body = document.getElementById(bodyId);
  const header = body ? body.previousElementSibling : null;
  if (!body || !header) return;
  const collapsed = body.classList.toggle('lib-collapsed');
  const arrow = header.querySelector('.lib-arrow');
  if (arrow) arrow.style.transform = collapsed ? 'rotate(-90deg)' : '';
}

function toggleStatBar(){
  const inner=document.getElementById('stat-bar-inner');
  const btn=document.getElementById('stat-bar-toggle-btn');
  if(!inner||!btn)return;
  const collapsed=inner.classList.toggle('sb-collapsed');
  btn.textContent=(collapsed?'▶':'▼')+' Stats & Tracking';
}

// ============================================================
// FULL REFRESH
// ============================================================
function fullRefresh() {
  invalidateProgState();
  renderStarting();
  renderProgressions();
  renderAttrs();
  renderSkills();
  renderHindrances();
  renderEdges();
  renderArmor();
  renderGear();
  updateConditionalVisibility();
  updateShakenDisplay();
  updateFFDisplay();
  updateStatusBar(); // calls renderWeapons, renderSPSummary, saveState
}

// ============================================================