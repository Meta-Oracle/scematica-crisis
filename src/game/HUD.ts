const CSS = `
  #hud-root { position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;font-family:'Courier New',monospace;user-select:none; }
  #hud-health { position:absolute;bottom:32px;left:32px;width:220px; }
  .hud-lbl { font-size:11px;letter-spacing:3px;color:#00ffff;margin-bottom:5px; }
  .hud-track { background:#0a0a22;height:8px;border:1px solid #00ffff33; }
  #hud-hp-fill { background:linear-gradient(90deg,#00ffff,#0055ff);height:100%;transition:width .12s; }
  #hud-reload-track { background:#0a0a22;height:4px;margin-top:4px;border:1px solid #ffaa0033;display:none; }
  #hud-reload-fill { background:#ffaa00;height:100%;width:0%;transition:width .05s; }
  #hud-ammo { position:absolute;bottom:32px;right:32px;text-align:right;color:#00ffff; }
  #hud-ammo-val { font-size:28px;letter-spacing:2px; }
  #hud-ammo-lbl { font-size:10px;letter-spacing:3px;color:#004466;margin-top:2px; }
  #hud-score { position:absolute;top:20px;right:32px;color:#00ffff;text-align:right; }
  #hud-score-lbl { font-size:10px;letter-spacing:3px;color:#004466; }
  #hud-score-val { font-size:24px;letter-spacing:2px; }
  #hud-wave { position:absolute;top:20px;left:32px;font-size:13px;letter-spacing:4px;color:#8800ff;text-shadow:0 0 12px #8800ff; }
  #hud-combo { position:absolute;bottom:90px;left:32px;width:220px; }
  #hud-combo-lbl { font-size:13px;letter-spacing:3px;color:#ff8800;min-height:18px;text-shadow:0 0 10px #ff8800; }
  #hud-combo-track { background:#110a00;height:4px;border:1px solid #ff880033;margin-top:4px; }
  #hud-combo-fill { background:#ff8800;height:100%;transition:width .08s; }
  #hud-mode { position:absolute;top:60px;left:32px;font-size:11px;letter-spacing:3px;color:#ff2244;text-shadow:0 0 10px #ff2244;min-height:14px; }
  #hud-crosshair { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:22px;height:22px;pointer-events:none; }
  #hud-crosshair::before,#hud-crosshair::after { content:'';position:absolute;background:rgba(255,255,255,0.75); }
  #hud-crosshair::before { width:2px;height:22px;left:10px;top:0; }
  #hud-crosshair::after  { width:22px;height:2px;top:10px;left:0; }

  /* ── Power / headshot streak (top center, non-intrusive) ── */
  #hud-power {
    position:absolute;top:18px;left:50%;transform:translateX(-50%);
    display:flex;align-items:center;gap:6px;
    font-size:10px;letter-spacing:3px;
    transition:opacity .3s;
  }
  #hud-power.hidden { opacity:0; }
  #hud-power-label { color:#004466; }
  #hud-power-pips { display:flex;gap:3px; }
  .power-pip {
    width:8px;height:8px;border-radius:50%;
    border:1px solid #003355;background:#03050e;
    transition:background .2s,border-color .2s,box-shadow .2s;
  }
  .power-pip.lit-blue   { background:#0044cc;border-color:#0088ff;box-shadow:0 0 5px #0088ff; }
  .power-pip.lit-purple { background:#6600cc;border-color:#aa00ff;box-shadow:0 0 6px #aa00ff; }
  .power-pip.lit-max    { background:#cc00aa;border-color:#ff00cc;box-shadow:0 0 8px #ff00cc,0 0 16px #ff00cc44; }
  #hud-power-val { font-size:11px;color:#004466;min-width:20px; }

  /* ── Floating damage pop ── */
  #hud-dmg-pop {
    position:absolute;top:44%;left:50%;transform:translateX(-50%);
    font-size:18px;letter-spacing:3px;color:#ffcc00;
    text-shadow:0 0 18px #ffcc00;
    opacity:0;pointer-events:none;
    transition:none;
  }
  #hud-dmg-pop.pop {
    animation:dmg-rise 0.9s ease-out forwards;
  }
  @keyframes dmg-rise {
    0%   { opacity:1;   transform:translateX(-50%) translateY(0);    }
    60%  { opacity:0.9; transform:translateX(-50%) translateY(-18px); }
    100% { opacity:0;   transform:translateX(-50%) translateY(-30px); }
  }

  /* ── Scope overlay ── */
  #hud-scope { position:absolute;top:0;left:0;width:100%;height:100%;display:none;pointer-events:none; }
  #hud-scope.on { display:block; }
  #scope-vignette {
    position:absolute;inset:0;
    background: radial-gradient(circle at 50% 50%,
      transparent 0,
      transparent 162px,
      rgba(0,0,0,0.97) 174px
    );
  }
  #scope-lens {
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:330px;height:330px;border-radius:50%;
    background:
      radial-gradient(ellipse 115px 75px at 37% 31%, rgba(255,255,255,0.055) 0%, transparent 100%),
      radial-gradient(circle at 50% 50%, rgba(0,22,8,0.13) 0%, transparent 68%);
    pointer-events:none;
  }
  #scope-ring {
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:336px;height:336px;border-radius:50%;
    border:4px solid rgba(52,57,68,0.98);
    box-shadow:
      inset 0 0 0 2px rgba(105,115,135,0.38),
      0 0 0 2px rgba(0,0,0,0.92),
      0 0 44px rgba(0,0,0,0.65);
    pointer-events:none;
  }
  #scope-reticle {
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:330px;height:330px;
    overflow:visible;
    pointer-events:none;
  }

  #hud-msg { position:absolute;top:38%;left:50%;transform:translateX(-50%);font-size:22px;letter-spacing:5px;color:#00ffff;text-shadow:0 0 24px #00ffff;text-align:center;white-space:nowrap;opacity:0;transition:opacity .2s; }
  #hud-msg.vis { opacity:1; }

  /* ── Sword move label ── */
  #hud-sword-move {
    position:absolute;bottom:160px;left:50%;transform:translateX(-50%);
    font-size:14px;letter-spacing:5px;color:#00ccff;
    text-shadow:0 0 18px #00ccff;
    opacity:0;pointer-events:none;
  }
  #hud-sword-move.pop { animation:sword-pop 0.7s ease-out forwards; }
  @keyframes sword-pop {
    0%   { opacity:1;   transform:translateX(-50%) scale(1.3); }
    40%  { opacity:1;   transform:translateX(-50%) scale(1.0); }
    100% { opacity:0;   transform:translateX(-50%) scale(0.9); }
  }

  /* Dash indicator */
  #hud-dash {
    position:absolute;bottom:32px;left:50%;transform:translateX(-50%);
    font-size:9px;letter-spacing:4px;color:#004466;
    transition:color .15s,text-shadow .15s;
  }
  #hud-dash.ready { color:#00aaff;text-shadow:0 0 10px #00aaff; }

  /* Boss HP bar */
  #hud-boss {
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:480px;max-width:80vw;padding-top:12px;
    display:none;text-align:center;
  }
  #hud-boss.vis { display:block; }
  #hud-boss-name { font-size:11px;letter-spacing:6px;color:#ff00cc;text-shadow:0 0 16px #ff00cc;margin-bottom:5px; }
  #hud-boss-track { background:#1a0018;height:10px;border:1px solid #ff00cc44; }
  #hud-boss-fill { background:linear-gradient(90deg,#880055,#ff00cc);height:100%;transition:width .1s; }
  #hud-boss-phase { font-size:8px;letter-spacing:3px;color:#660044;margin-top:3px; }

  /* Action prompts (parry / execution) */
  #hud-action-prompt {
    position:absolute;top:56%;left:50%;transform:translateX(-50%);
    font-size:13px;letter-spacing:5px;
    pointer-events:none;opacity:0;
    transition:opacity .12s;
  }
  #hud-action-prompt.vis { opacity:1; }
  #hud-action-prompt.parry { color:#ffdd00;text-shadow:0 0 18px #ffdd00; }
  #hud-action-prompt.exec  { color:#ff4400;text-shadow:0 0 18px #ff4400; }

  /* Chromatic aberration flash */
  @keyframes chroma-flash {
    0%   { filter:hue-rotate(0deg)   saturate(1); }
    25%  { filter:hue-rotate(-18deg) saturate(2.5); }
    75%  { filter:hue-rotate(18deg)  saturate(2.2); }
    100% { filter:hue-rotate(0deg)   saturate(1); }
  }
  #app canvas.chroma { animation:chroma-flash 0.22s ease-out forwards; }

  /* ── Melee slash effects ── */
  .slash-wrap { position:absolute;top:50%;left:50%;pointer-events:none;overflow:visible; }
  .slash-inner { height:3px;border-radius:3px;transform:scaleX(0);opacity:0;transform-origin:center center; }
  .slash-wrap.go .slash-inner { animation:slash-pop 0.26s ease-out forwards; }
  @keyframes slash-pop {
    0%   { transform:scaleX(0.05); opacity:0.95; }
    22%  { transform:scaleX(1);    opacity:1; }
    100% { transform:scaleX(1.08); opacity:0; }
  }
  #slash-1 .slash-inner {
    width:270px;margin-left:-135px;margin-top:-1.5px;
    background:linear-gradient(90deg,transparent,rgba(0,255,210,0.92),transparent);
    box-shadow:0 0 8px rgba(0,255,210,0.5);
  }
  #slash-1 { transform:rotate(-32deg); }
  #slash-2 .slash-inner {
    width:320px;margin-left:-160px;margin-top:-1.5px;
    background:linear-gradient(90deg,transparent,rgba(0,200,255,0.88),transparent);
    box-shadow:0 0 10px rgba(0,200,255,0.5);
    animation-delay:0.05s !important;
  }
  #slash-2 { transform:rotate(-22deg); }
  #slash-3 .slash-inner {
    width:220px;margin-left:-110px;margin-top:-1.5px;
    background:linear-gradient(90deg,transparent,rgba(140,0,255,0.88),transparent);
    box-shadow:0 0 10px rgba(140,0,255,0.5);
    animation-delay:0.09s !important;
  }
  #slash-3 { transform:rotate(8deg); }
  #slash-fin .slash-inner {
    width:430px;margin-left:-215px;margin-top:-1.5px;
    background:linear-gradient(90deg,transparent,rgba(255,180,0,0.97),transparent);
    box-shadow:0 0 18px rgba(255,180,0,0.7);
    animation-duration:0.36s !important;
    animation-delay:0.03s !important;
  }
  #slash-fin { transform:rotate(16deg); }
  #hud-finisher-flash {
    position:absolute;inset:0;pointer-events:none;opacity:0;
    background:radial-gradient(ellipse at 50% 55%, rgba(255,170,0,0.48) 0%, transparent 65%);
  }
  #hud-finisher-flash.go { animation:fin-flash 0.38s ease-out forwards; }
  @keyframes fin-flash { 0%{opacity:1} 100%{opacity:0} }

  /* Whirlwind screen spin flash */
  #hud-whirl-flash {
    position:absolute;inset:0;pointer-events:none;opacity:0;
    background:radial-gradient(ellipse at 50% 50%, rgba(0,200,255,0.22) 0%, transparent 70%);
  }
  #hud-whirl-flash.go { animation:whirl-flash 0.55s ease-out forwards; }
  @keyframes whirl-flash { 0%{opacity:1} 100%{opacity:0} }

  /* Devastate screen crack flash */
  #hud-dev-flash {
    position:absolute;inset:0;pointer-events:none;opacity:0;
    background:radial-gradient(ellipse at 50% 45%, rgba(180,0,255,0.38) 0%, transparent 65%);
  }
  #hud-dev-flash.go { animation:dev-flash 0.45s ease-out forwards; }
  @keyframes dev-flash { 0%{opacity:1} 40%{opacity:0.6} 100%{opacity:0} }
`

export type SwordMoveDisplay = 'slash' | 'heavy' | 'flurry' | 'whirlwind' | 'devastate'

export class HUD {
  private root: HTMLElement
  private hpFill!: HTMLElement
  private reloadTrack!: HTMLElement
  private reloadFill!: HTMLElement
  private ammoVal!: HTMLElement
  private scoreVal!: HTMLElement
  private waveEl!: HTMLElement
  private comboLbl!: HTMLElement
  private comboFill!: HTMLElement
  private modeEl!: HTMLElement
  private crosshair!: HTMLElement
  private scope!: HTMLElement
  private msg!: HTMLElement
  private msgTimer = 0
  private slash1!: HTMLElement
  private slash2!: HTMLElement
  private slash3!: HTMLElement
  private slashFin!: HTMLElement
  private finFlash!: HTMLElement
  private whirlFlash!: HTMLElement
  private devFlash!: HTMLElement
  private swordMoveEl!: HTMLElement
  private dashEl!: HTMLElement
  private powerEl!: HTMLElement
  private powerPips!: HTMLElement[]
  private dmgPop!: HTMLElement
  private dmgAccum = 0
  private dmgTimer = 0

  private bossEl!: HTMLElement
  private bossFill!: HTMLElement
  private bossPhaseEl!: HTMLElement
  private actionPrompt!: HTMLElement

  constructor() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    this.root = document.createElement('div')
    this.root.id = 'hud-root'
    this.root.innerHTML = `
      <div id="hud-health">
        <div class="hud-lbl">VITALS</div>
        <div class="hud-track"><div id="hud-hp-fill" style="width:100%"></div></div>
        <div id="hud-reload-track"><div id="hud-reload-fill"></div></div>
      </div>
      <div id="hud-ammo">
        <div id="hud-ammo-val">8 / 8</div>
        <div id="hud-ammo-lbl">ROUNDS</div>
      </div>
      <div id="hud-score">
        <div id="hud-score-lbl">SCORE</div>
        <div id="hud-score-val">0</div>
      </div>
      <div id="hud-wave">WAVE 1</div>
      <div id="hud-combo">
        <div id="hud-combo-lbl"></div>
        <div id="hud-combo-track"><div id="hud-combo-fill" style="width:0%"></div></div>
      </div>
      <div id="hud-mode"></div>
      <div id="hud-power" class="hidden">
        <span id="hud-power-label">POWER</span>
        <div id="hud-power-pips">
          ${Array.from({length:10}).map((_,i) => `<div class="power-pip" id="pip-${i}"></div>`).join('')}
        </div>
      </div>
      <div id="hud-dash">DASH [SPACE]</div>
      <div id="hud-crosshair"></div>
      <div id="hud-scope">
        <div id="scope-vignette"></div>
        <div id="scope-lens"></div>
        <div id="scope-ring"></div>
        <svg id="scope-reticle" xmlns="http://www.w3.org/2000/svg" viewBox="-165 -165 330 330">
          <line x1="-160" y1="0" x2="-36" y2="0" stroke="rgba(188,198,183,0.82)" stroke-width="1.7"/>
          <line x1="36"   y1="0" x2="160" y2="0" stroke="rgba(188,198,183,0.82)" stroke-width="1.7"/>
          <line x1="0" y1="-160" x2="0" y2="-36" stroke="rgba(188,198,183,0.82)" stroke-width="1.7"/>
          <line x1="0" y1="36"   x2="0" y2="160" stroke="rgba(188,198,183,0.82)" stroke-width="2.4"/>
          <line x1="-22" y1="0" x2="22" y2="0" stroke="rgba(188,198,183,0.38)" stroke-width="0.6"/>
          <line x1="0" y1="-22" x2="0" y2="22"  stroke="rgba(188,198,183,0.38)" stroke-width="0.6"/>
          <circle cx="-80"  cy="0" r="2.3" fill="rgba(188,198,183,0.68)"/>
          <circle cx="80"   cy="0" r="2.3" fill="rgba(188,198,183,0.68)"/>
          <circle cx="-118" cy="0" r="1.6" fill="rgba(188,198,183,0.48)"/>
          <circle cx="118"  cy="0" r="1.6" fill="rgba(188,198,183,0.48)"/>
          <line x1="-13" y1="-80"  x2="13" y2="-80"  stroke="rgba(188,198,183,0.4)" stroke-width="0.8"/>
          <line x1="-9"  y1="-118" x2="9"  y2="-118" stroke="rgba(188,198,183,0.3)" stroke-width="0.8"/>
          <circle cx="0" cy="0" r="2.6" fill="rgba(255,28,0,0.93)"/>
        </svg>
      </div>
      <div id="hud-finisher-flash"></div>
      <div id="hud-whirl-flash"></div>
      <div id="hud-dev-flash"></div>
      <div class="slash-wrap" id="slash-1"><div class="slash-inner"></div></div>
      <div class="slash-wrap" id="slash-2"><div class="slash-inner"></div></div>
      <div class="slash-wrap" id="slash-3"><div class="slash-inner"></div></div>
      <div class="slash-wrap" id="slash-fin"><div class="slash-inner"></div></div>
      <div id="hud-sword-move"></div>
      <div id="hud-dmg-pop"></div>
      <div id="hud-boss">
        <div id="hud-boss-name">⬡ CRISIS ENTITY ⬡</div>
        <div id="hud-boss-track"><div id="hud-boss-fill" style="width:100%"></div></div>
        <div id="hud-boss-phase">PHASE I</div>
      </div>
      <div id="hud-action-prompt"></div>
      <div id="hud-msg"></div>
    `
    document.body.appendChild(this.root)

    this.hpFill      = document.getElementById('hud-hp-fill')!
    this.reloadTrack = document.getElementById('hud-reload-track')!
    this.reloadFill  = document.getElementById('hud-reload-fill')!
    this.ammoVal     = document.getElementById('hud-ammo-val')!
    this.scoreVal    = document.getElementById('hud-score-val')!
    this.waveEl      = document.getElementById('hud-wave')!
    this.comboLbl    = document.getElementById('hud-combo-lbl')!
    this.comboFill   = document.getElementById('hud-combo-fill')!
    this.modeEl      = document.getElementById('hud-mode')!
    this.crosshair   = document.getElementById('hud-crosshair')!
    this.scope       = document.getElementById('hud-scope')!
    this.msg         = document.getElementById('hud-msg')!
    this.slash1      = document.getElementById('slash-1')!
    this.slash2      = document.getElementById('slash-2')!
    this.slash3      = document.getElementById('slash-3')!
    this.slashFin    = document.getElementById('slash-fin')!
    this.finFlash    = document.getElementById('hud-finisher-flash')!
    this.whirlFlash  = document.getElementById('hud-whirl-flash')!
    this.devFlash    = document.getElementById('hud-dev-flash')!
    this.swordMoveEl = document.getElementById('hud-sword-move')!
    this.dashEl      = document.getElementById('hud-dash')!
    this.powerEl     = document.getElementById('hud-power')!
    this.dmgPop      = document.getElementById('hud-dmg-pop')!
    this.powerPips    = Array.from({length:10}).map((_,i) => document.getElementById(`pip-${i}`)!)
    this.bossEl       = document.getElementById('hud-boss')!
    this.bossFill     = document.getElementById('hud-boss-fill')!
    this.bossPhaseEl  = document.getElementById('hud-boss-phase')!
    this.actionPrompt = document.getElementById('hud-action-prompt')!
  }

  update(
    hp: number, maxHp: number,
    ammo: number, maxAmmo: number,
    score: number, wave: number,
    combo: number, comboFrac: number,
    sniper: boolean,
    reloading: boolean, reloadFrac: number,
    meleeName: string,
    dashReady: boolean,
    hsStreak: number,
    dt: number
  ) {
    this.hpFill.style.width = `${(hp / maxHp) * 100}%`
    this.ammoVal.textContent = `${ammo} / ${maxAmmo}`
    this.scoreVal.textContent = score.toLocaleString()
    this.waveEl.textContent = `WAVE ${wave}`

    this.comboLbl.textContent = combo > 1 ? `COMBO x${combo}  ×${(1 + combo * 0.18).toFixed(1)}` : ''
    this.comboFill.style.width = `${comboFrac * 100}%`

    this.reloadTrack.style.display = reloading ? 'block' : 'none'
    this.reloadFill.style.width = `${reloadFrac * 100}%`

    this.modeEl.textContent = meleeName

    this.dashEl.className = dashReady ? 'ready' : ''

    // Power pips (headshot streak)
    if (hsStreak > 0) {
      this.powerEl.classList.remove('hidden')
      for (let i = 0; i < 10; i++) {
        const pip = this.powerPips[i]
        if (i < hsStreak) {
          pip.className = hsStreak >= 8 ? 'power-pip lit-max' : hsStreak >= 5 ? 'power-pip lit-purple' : 'power-pip lit-blue'
        } else {
          pip.className = 'power-pip'
        }
      }
    } else {
      this.powerEl.classList.add('hidden')
    }

    if (sniper) {
      this.crosshair.style.display = 'none'
      this.scope.classList.add('on')
    } else {
      this.crosshair.style.display = 'block'
      this.scope.classList.remove('on')
    }

    if (this.msgTimer > 0) {
      this.msgTimer -= dt
      if (this.msgTimer <= 0) this.msg.classList.remove('vis')
    }

    // Damage pop decay
    if (this.dmgTimer > 0) {
      this.dmgTimer -= dt
    }
  }

  addDamage(dmg: number) {
    this.dmgAccum += dmg
    this.dmgTimer = 0.55
    this.dmgPop.textContent = `-${Math.round(this.dmgAccum)}`
    this.dmgPop.classList.remove('pop')
    void this.dmgPop.offsetWidth
    this.dmgPop.classList.add('pop')
    setTimeout(() => {
      if (this.dmgTimer <= 0) {
        this.dmgAccum = 0
        this.dmgPop.classList.remove('pop')
      }
    }, 600)
  }

  showSwordMove(move: SwordMoveDisplay) {
    const labels: Record<SwordMoveDisplay, string> = {
      slash:     'SLASH',
      heavy:     '◆ HEAVY',
      flurry:    '⚡ FLURRY',
      whirlwind: '〇 WHIRLWIND',
      devastate: '✦ DEVASTATE',
    }
    this.swordMoveEl.textContent = labels[move]
    this.swordMoveEl.classList.remove('pop')
    void this.swordMoveEl.offsetWidth
    this.swordMoveEl.classList.add('pop')
  }

  showMeleeHit(move: SwordMoveDisplay) {
    const trigger = (el: HTMLElement, dur = 300) => {
      el.classList.remove('go')
      void el.offsetWidth
      el.classList.add('go')
      setTimeout(() => el.classList.remove('go'), dur)
    }
    switch (move) {
      case 'slash':
        trigger(this.slash1)
        break
      case 'heavy':
        trigger(this.slash1)
        trigger(this.slash2, 340)
        break
      case 'flurry':
        trigger(this.slash1)
        trigger(this.slash2, 100)
        trigger(this.slash3, 200)
        break
      case 'whirlwind':
        trigger(this.slash1)
        trigger(this.slash2, 80)
        trigger(this.slash3, 160)
        trigger(this.slash1, 260)
        trigger(this.whirlFlash, 560)
        break
      case 'devastate':
        trigger(this.slash1)
        trigger(this.slash2, 80)
        trigger(this.slashFin, 160)
        trigger(this.devFlash, 180)
        break
    }
  }

  showBossBar(hpFrac: number, phase: number) {
    this.bossEl.classList.add('vis')
    this.bossFill.style.width = `${Math.max(0, hpFrac) * 100}%`
    this.bossPhaseEl.textContent = ['PHASE I', 'PHASE II', 'PHASE III'][phase - 1] ?? 'PHASE I'
  }

  hideBossBar() { this.bossEl.classList.remove('vis') }

  setActionPrompt(type: 'parry' | 'exec' | null) {
    if (!type) {
      this.actionPrompt.className = ''
    } else {
      this.actionPrompt.textContent = type === 'parry' ? '[E]  PARRY!' : '[E]  EXECUTE'
      this.actionPrompt.className = `vis ${type}`
    }
  }

  flash(text: string, dur = 1.8) {
    this.msg.textContent = text
    this.msg.classList.add('vis')
    this.msgTimer = dur
  }

  show() { this.root.style.display = 'block' }
  hide() { this.root.style.display = 'none' }
}
