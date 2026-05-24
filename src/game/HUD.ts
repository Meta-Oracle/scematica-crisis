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
  #hud-scope { position:absolute;top:0;left:0;width:100%;height:100%;display:none;pointer-events:none; }
  #hud-scope.on { display:block; }
  #scope-vignette { position:absolute;inset:0;background:rgba(0,0,0,0.75); }
  #scope-circle { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;border:2px solid rgba(0,255,255,0.9);border-radius:50%;box-shadow:inset 0 0 20px rgba(0,255,255,0.1); }
  #scope-h { position:absolute;top:50%;left:0;width:100%;height:1px;background:rgba(0,255,255,0.4); }
  #scope-v { position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(0,255,255,0.4); }
  #scope-dot { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:5px;height:5px;background:#ff2200;border-radius:50%; }
  #scope-clear { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:318px;height:318px;border-radius:50%;background:#050510;overflow:hidden; }
  #hud-msg { position:absolute;top:38%;left:50%;transform:translateX(-50%);font-size:22px;letter-spacing:5px;color:#00ffff;text-shadow:0 0 24px #00ffff;text-align:center;white-space:nowrap;opacity:0;transition:opacity .2s; }
  #hud-msg.vis { opacity:1; }
`

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
      <div id="hud-crosshair"></div>
      <div id="hud-scope">
        <div id="scope-vignette"></div>
        <div id="scope-clear"></div>
        <div id="scope-circle"></div>
        <div id="scope-h"></div>
        <div id="scope-v"></div>
        <div id="scope-dot"></div>
      </div>
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
  }

  update(
    hp: number, maxHp: number,
    ammo: number, maxAmmo: number,
    score: number, wave: number,
    combo: number, comboFrac: number,
    sniper: boolean,
    reloading: boolean, reloadFrac: number,
    meleeName: string,
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
  }

  flash(text: string, dur = 1.8) {
    this.msg.textContent = text
    this.msg.classList.add('vis')
    this.msgTimer = dur
  }

  show() { this.root.style.display = 'block' }
  hide() { this.root.style.display = 'none' }
}
