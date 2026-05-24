import type { InputManager } from './InputManager'

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

interface JoyState {
  touchId: number
  baseX: number
  baseY: number
}

export class MobileControls {
  private readonly enabled: boolean

  // DOM
  private joyZone!: HTMLElement
  private joyBase!: HTMLElement
  private joyKnob!: HTMLElement
  private rightZone!: HTMLElement
  private scopeBtn!: HTMLElement

  // Joystick
  private joy: JoyState | null = null

  // Right zone look
  private lookId: number | null = null
  private lookPrevX = 0
  private lookPrevY = 0

  // Tap detection
  private lastTapTime = 0
  private tapStartX = 0
  private tapStartY = 0
  private tapStartTime = 0

  // State
  private sniperOn = false

  constructor(private input: InputManager) {
    this.enabled = isTouchDevice()
    if (!this.enabled) return
    this.buildUI()
    this.bindEvents()
  }

  private buildUI() {
    const style = document.createElement('style')
    style.textContent = `
      #mob-joy-zone {
        position:fixed;bottom:0;left:0;width:50%;height:55%;
        z-index:150;touch-action:none;
      }
      #mob-joy-base {
        position:absolute;bottom:80px;left:80px;
        width:90px;height:90px;border-radius:50%;
        border:2px solid rgba(0,255,200,0.5);
        background:rgba(0,255,200,0.06);
        display:none;pointer-events:none;
      }
      #mob-joy-knob {
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:38px;height:38px;border-radius:50%;
        background:radial-gradient(circle,rgba(0,255,200,0.9),rgba(0,150,120,0.4));
        box-shadow:0 0 12px rgba(0,255,200,0.7);
        pointer-events:none;
      }
      #mob-right-zone {
        position:fixed;bottom:0;right:0;width:50%;height:100%;
        z-index:150;touch-action:none;
      }
      #mob-scope-btn {
        position:absolute;top:24px;right:24px;
        width:72px;height:36px;border-radius:20px;
        border:2px solid rgba(0,180,255,0.7);
        background:rgba(0,50,100,0.5);
        color:#00aaff;font-size:11px;letter-spacing:3px;
        font-family:'Courier New',monospace;
        display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(4px);
      }
      #mob-scope-btn.active {
        background:rgba(0,120,255,0.4);
        border-color:#00ffff;color:#00ffff;
        box-shadow:0 0 14px rgba(0,200,255,0.6);
      }
      #mob-attack-hint {
        position:absolute;bottom:60px;right:50px;
        width:64px;height:64px;border-radius:50%;
        border:2px solid rgba(255,100,0,0.6);
        background:rgba(255,80,0,0.08);
        color:rgba(255,120,0,0.8);font-size:10px;letter-spacing:2px;
        font-family:'Courier New',monospace;
        display:flex;align-items:center;justify-content:center;
        pointer-events:none;
      }
      #mob-dbl-hint {
        position:fixed;top:50%;right:12px;transform:translateY(-50%);
        font-size:9px;letter-spacing:2px;color:rgba(0,200,255,0.4);
        font-family:'Courier New',monospace;writing-mode:vertical-rl;
        pointer-events:none;z-index:150;
      }
    `
    document.head.appendChild(style)

    this.joyZone = document.createElement('div')
    this.joyZone.id = 'mob-joy-zone'

    this.joyBase = document.createElement('div')
    this.joyBase.id = 'mob-joy-base'
    this.joyKnob = document.createElement('div')
    this.joyKnob.id = 'mob-joy-knob'
    this.joyBase.appendChild(this.joyKnob)
    this.joyZone.appendChild(this.joyBase)

    this.rightZone = document.createElement('div')
    this.rightZone.id = 'mob-right-zone'
    this.rightZone.innerHTML = `
      <div id="mob-scope-btn">SCOPE</div>
      <div id="mob-attack-hint">ATTACK</div>
    `

    const hint = document.createElement('div')
    hint.id = 'mob-dbl-hint'
    hint.textContent = 'DBL-TAP = SCOPE'

    document.body.appendChild(this.joyZone)
    document.body.appendChild(this.rightZone)
    document.body.appendChild(hint)

    this.scopeBtn = document.getElementById('mob-scope-btn')!
  }

  private bindEvents() {
    // Joystick — left half
    this.joyZone.addEventListener('touchstart', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (this.joy === null) {
          this.joy = { touchId: t.identifier, baseX: t.clientX, baseY: t.clientY }
          this.joyBase.style.left  = `${t.clientX - 45}px`
          this.joyBase.style.top   = `${t.clientY - 45}px`
          this.joyBase.style.display = 'block'
        }
      }
    }, { passive: false })

    this.joyZone.addEventListener('touchmove', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (this.joy && t.identifier === this.joy.touchId) {
          const dx = t.clientX - this.joy.baseX
          const dy = t.clientY - this.joy.baseY
          const r  = Math.hypot(dx, dy)
          const maxR = 38
          const cx = r > maxR ? dx / r * maxR : dx
          const cy = r > maxR ? dy / r * maxR : dy
          this.joyKnob.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`
          this.input.setMobileMove(cx / maxR, cy / maxR)
        }
      }
    }, { passive: false })

    const joyEnd = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (this.joy && t.identifier === this.joy.touchId) {
          this.joy = null
          this.joyBase.style.display = 'none'
          this.joyKnob.style.transform = 'translate(-50%,-50%)'
          this.input.setMobileMove(0, 0)
        }
      }
    }
    this.joyZone.addEventListener('touchend',    joyEnd, { passive: false })
    this.joyZone.addEventListener('touchcancel', joyEnd, { passive: false })

    // Right zone — look + tap attack + double-tap scope
    this.rightZone.addEventListener('touchstart', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (this.lookId === null) {
          this.lookId    = t.identifier
          this.lookPrevX = t.clientX
          this.lookPrevY = t.clientY
          this.tapStartX = t.clientX
          this.tapStartY = t.clientY
          this.tapStartTime = Date.now()
        }
      }
    }, { passive: false })

    this.rightZone.addEventListener('touchmove', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.lookId) {
          const dx = (t.clientX - this.lookPrevX) * 0.45
          const dy = (t.clientY - this.lookPrevY) * 0.45
          this.input.addMobileLook(dx, dy)
          this.lookPrevX = t.clientX
          this.lookPrevY = t.clientY
        }
      }
    }, { passive: false })

    this.rightZone.addEventListener('touchend', e => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.lookId) {
          this.lookId = null

          const elapsed = Date.now() - this.tapStartTime
          const moved   = Math.hypot(t.clientX - this.tapStartX, t.clientY - this.tapStartY)

          // Tap (short, little movement)
          if (elapsed < 180 && moved < 20) {
            const now = Date.now()
            if (now - this.lastTapTime < 300) {
              // Double-tap → toggle sniper
              this.sniperOn = !this.sniperOn
              this.input.setMobileSniperHeld(this.sniperOn)
              this.scopeBtn.classList.toggle('active', this.sniperOn)
            } else {
              // Single tap → attack
              this.input.triggerMobileAttack()
            }
            this.lastTapTime = now
          }
        }
      }
    }, { passive: false })

    // Scope button tap
    this.scopeBtn.addEventListener('touchstart', e => {
      e.stopPropagation()
      e.preventDefault()
      this.sniperOn = !this.sniperOn
      this.input.setMobileSniperHeld(this.sniperOn)
      this.scopeBtn.classList.toggle('active', this.sniperOn)
    }, { passive: false })
  }

  /** Call each frame so sniper state stays injected */
  update() {
    if (!this.enabled) return
    // sniperHeld is set imperatively in the tap handler; nothing to poll here
  }

  get active() { return this.enabled }
}
