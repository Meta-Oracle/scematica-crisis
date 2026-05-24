import * as THREE from 'three'
import { InputManager } from './InputManager'
import { Arena } from './Arena'
import { Player } from './Player'
import { Camera } from './Camera'
import { EnemyManager } from './EnemyManager'
import { Combo } from './Combo'
import { HUD } from './HUD'
import { RagdollSystem } from './Ragdoll'
import { BloodSystem } from './Blood'

const MELEE_RANGE = 4.0
const MELEE_DMG = [30, 45, 80] as const   // light, medium, finisher
const MELEE_NAMES = ['SLASH', 'STRIKE', '⚡ FINISHER'] as const
const SNIPER_DMG = 120
const RELOAD_TIME = 1.6
const WAVE_COUNTDOWN = 4.0

const SCREEN_CSS = `
  .sc { position:fixed;top:0;left:0;width:100%;height:100%;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,16,.93);font-family:'Courier New',monospace;color:#00ffff;z-index:200; }
  .sc.vis { display:flex; }
  .sc h1 { font-size:54px;letter-spacing:10px;text-shadow:0 0 30px #00ffff;margin-bottom:6px; }
  .sc .sub { font-size:13px;letter-spacing:5px;color:#8800ff;margin-bottom:48px; }
  .sc .ctrl { font-size:12px;color:#336666;letter-spacing:2px;line-height:2.2;margin-bottom:40px;text-align:center; }
  .sc .cta { font-size:19px;letter-spacing:7px;color:#fff;animation:blink 1.4s ease-in-out infinite; }
  .sc .hint { font-size:11px;letter-spacing:3px;color:#004455;margin-top:14px; }
  .sc .stat { font-size:30px;letter-spacing:4px;margin:14px 0; }
  .sc .sub2 { font-size:14px;letter-spacing:4px;color:#8800ff;margin-bottom:36px; }
  @keyframes blink { 0%,100%{opacity:.4} 50%{opacity:1} }
`

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private clock: THREE.Clock
  private input: InputManager
  private arena: Arena
  private player: Player
  private camera: Camera
  private enemies: EnemyManager
  private combo: Combo
  private hud: HUD
  private ragdolls: RagdollSystem
  private blood: BloodSystem

  private hp = 100
  private score = 0
  private wave = 1
  private ammo = 8
  private readonly maxAmmo = 8

  private sniper = false
  private reloading = false
  private reloadTimer = 0
  private sniperCd = 0
  private meleeCd = 0
  private waveActive = false
  private waveCd = 0
  private gameOver = false
  private running = false

  private menuEl!: HTMLElement
  private goEl!: HTMLElement
  private raycaster = new THREE.Raycaster()

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.getElementById('app')!.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.clock = new THREE.Clock()
    this.input = new InputManager(this.renderer.domElement)
    this.arena = new Arena(this.scene)
    this.player = new Player(this.scene)
    this.camera = new Camera(this.renderer)
    this.enemies = new EnemyManager(this.scene)
    this.combo = new Combo()
    this.hud = new HUD()
    this.hud.hide()
    this.ragdolls = new RagdollSystem(this.scene)
    this.blood = new BloodSystem(this.scene)

    this.buildScreens()
    this.showMenu()

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        if (!this.running && !this.gameOver) this.startGame()
      } else {
        // Pointer released mid-game — keep running, just show a resume hint
      }
    })

    this.renderer.setAnimationLoop(() => this.loop())
  }

  private loop() {
    const rawDt = Math.min(this.clock.getDelta(), 0.05)
    if (!this.running) {
      this.renderer.render(this.scene, this.camera.cam)
      return
    }
    const dt = this.sniper ? rawDt * 0.28 : rawDt
    this.update(dt, rawDt)
    this.renderer.render(this.scene, this.camera.cam)
    this.input.endFrame()
  }

  private update(dt: number, rawDt: number) {
    // ── Input timers (use raw time so they feel snappy) ──
    this.sniperCd  = Math.max(0, this.sniperCd  - rawDt)
    this.meleeCd   = Math.max(0, this.meleeCd   - rawDt)

    // ── Reload ──
    if (this.reloading) {
      this.reloadTimer = Math.max(0, this.reloadTimer - rawDt)
      if (this.reloadTimer === 0) {
        this.reloading = false
        this.ammo = this.maxAmmo
        this.hud.flash('READY', 0.7)
      }
    } else if (this.input.wasKeyPressed('KeyR') && this.ammo < this.maxAmmo) {
      this.reloading = true
      this.reloadTimer = RELOAD_TIME
      this.hud.flash('RELOADING...', RELOAD_TIME)
    }

    // ── Sniper mode ──
    this.sniper = this.input.isMouse(2) && !this.reloading
    this.player.setVisible(!this.sniper)

    // ── Player movement ──
    this.player.update(dt, this.input, 0)

    // ── Arena floor follows player ──
    this.arena.update(this.player.position)

    // ── Camera ──
    this.camera.update(rawDt, this.player, this.sniper)

    // ── Shoot / Melee ──
    if (this.input.wasMousePressed(0)) {
      if (this.sniper) this.doSnipe()
      else             this.doMelee()
    }

    // ── Enemies ──
    const dmg = this.enemies.update(dt, this.player.position)
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg)
      this.player.flash()
      if (this.hp === 0) { this.endGame(); return }
    }

    // ── Ragdolls & blood ──
    this.ragdolls.update(rawDt)
    this.blood.update(rawDt)

    // ── Combo decay ──
    this.combo.update(dt)

    // ── Wave management ──
    if (this.waveActive) {
      if (this.enemies.count === 0) {
        this.waveActive = false
        this.wave++
        this.waveCd = WAVE_COUNTDOWN
        this.hud.flash(`WAVE ${this.wave} INCOMING`, WAVE_COUNTDOWN - 0.5)
        this.ammo = this.maxAmmo
        this.hp = Math.min(100, this.hp + 20)
        this.reloading = false
      }
    } else {
      this.waveCd = Math.max(0, this.waveCd - rawDt)
      if (this.waveCd === 0) this.launchWave()
    }

    // ── HUD ──
    const meleeLbl = this.meleeCd > 0 ? MELEE_NAMES[this.combo.meleePos === 0 ? 2 : this.combo.meleePos - 1] : ''
    this.hud.update(
      this.hp, 100, this.ammo, this.maxAmmo,
      this.score, this.wave,
      this.combo.streak, this.combo.timerFrac,
      this.sniper,
      this.reloading, 1 - this.reloadTimer / RELOAD_TIME,
      meleeLbl,
      rawDt
    )
  }

  private doSnipe() {
    if (this.reloading || this.sniperCd > 0) return
    if (this.ammo <= 0) { this.hud.flash('RELOAD! [R]', 1.2); return }

    this.sniperCd = 0.7
    this.ammo--

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera.cam)

    let hit = false
    for (const e of this.enemies.all) {
      if (e.isDead) continue
      const box = new THREE.Box3().setFromObject(e.mesh)
      if (this.raycaster.ray.intersectsBox(box)) {
        const headPos = e.headWorldPos()
        const headDist = this.raycaster.ray.distanceToPoint(headPos)
        const hs = headDist < 0.35
        const killed = e.takeDamage(SNIPER_DMG, hs)
        hit = true

        if (hs) {
          this.hud.flash('HEADSHOT!', 1)
          // Explosive headshot blood burst
          this.blood.splat(headPos, 60, 2.5)
          this.blood.splat(headPos, 30, 1.5)
        } else {
          this.blood.splat(e.position.clone().setY(e.position.y + 1.0), 18, 1.0)
        }

        if (killed) {
          this.combo.hit()
          this.score += Math.floor(e.reward * (hs ? 2 : 1) * this.combo.multiplier)
          this.ragdolls.spawnRagdoll(e.position.clone(), e.color, e.scale)
          if (!hs) this.blood.splat(e.position.clone().setY(e.position.y + 0.8), 35, 1.8)
        }

        this.spawnTracer(this.camera.cam.position, headPos)
        break
      }
    }

    if (!hit) this.spawnTracer(this.camera.cam.position,
      this.camera.cam.position.clone().add(
        new THREE.Vector3(0, 0, -80).applyQuaternion(this.camera.cam.quaternion)
      ))

    if (this.ammo === 0 && !this.reloading) {
      this.reloading = true
      this.reloadTimer = RELOAD_TIME
      this.hud.flash('AUTO-RELOAD...', RELOAD_TIME)
    }
  }

  private doMelee() {
    if (this.meleeCd > 0) return
    const pos = this.combo.meleeTap()
    const dmg = MELEE_DMG[pos]
    const aoe = pos === 2 // finisher is AoE
    const range = aoe ? 5.5 : MELEE_RANGE
    this.meleeCd = 0.32

    let hitAny = false
    for (const e of this.enemies.all) {
      if (e.isDead) continue
      const dist = e.position.distanceTo(this.player.position)
      if (dist > range) continue

      if (!aoe) {
        // arc check: enemy must be roughly in front
        const toEnemy = new THREE.Vector3().subVectors(e.position, this.player.position).normalize()
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw)
        )
        if (toEnemy.dot(forward) < 0.15) continue // behind
      }

      const killed = e.takeDamage(dmg)
      hitAny = true
      const hitPos = e.position.clone().setY(e.position.y + 1.0)
      if (killed) {
        this.combo.hit()
        this.score += Math.floor(e.reward * 1.6 * this.combo.multiplier)
        this.ragdolls.spawnRagdoll(e.position.clone(), e.color, e.scale)
        this.blood.splat(hitPos, 40, aoe ? 2.2 : 1.6)
      } else {
        this.blood.splat(hitPos, 12, 0.8)
      }
    }

    if (hitAny) {
      this.hud.flash(MELEE_NAMES[pos], 0.6)
      this.hud.showMeleeHit(pos as 0 | 1 | 2)
      this.player.triggerMeleeAnim(pos as 0 | 1 | 2)
      const shakeAmts = [0.12, 0.22, 0.48] as const
      this.camera.shake(shakeAmts[pos])
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const pts = [from.clone(), to.clone()]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color: 0xffff44, transparent: true, opacity: 0.85 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    setTimeout(() => this.scene.remove(line), 80)
  }

  private launchWave() {
    this.waveActive = true
    this.enemies.spawnWave(this.wave, this.player.position)
  }

  private startGame() {
    this.running = true
    this.gameOver = false
    this.hp = 100
    this.score = 0
    this.wave = 1
    this.ammo = this.maxAmmo
    this.reloading = false
    this.waveActive = false
    this.waveCd = 2.5
    this.combo.reset()
    this.enemies.clear()
    this.ragdolls.clear()
    this.blood.clear()
    this.player.position.set(0, 0, 0)
    this.menuEl.classList.remove('vis')
    this.goEl.classList.remove('vis')
    this.hud.show()
    this.hud.flash('WAVE 1 INCOMING', 2.2)
    this.clock.start()
  }

  private endGame() {
    this.running = false
    this.gameOver = true
    this.enemies.clear()
    this.ragdolls.clear()
    this.blood.clear()
    this.hud.hide()
    document.exitPointerLock()
    this.goEl.querySelector('#go-score')!.textContent = this.score.toLocaleString()
    this.goEl.querySelector('#go-wave')!.textContent = `REACHED WAVE ${this.wave}`
    this.goEl.classList.add('vis')
  }

  private showMenu() {
    this.menuEl.classList.add('vis')
  }

  private buildScreens() {
    const styleEl = document.createElement('style')
    styleEl.textContent = SCREEN_CSS
    document.head.appendChild(styleEl)

    // Menu
    this.menuEl = document.createElement('div')
    this.menuEl.className = 'sc'
    this.menuEl.innerHTML = `
      <h1>SCEMATICA</h1>
      <div class="sub">— CRISIS —</div>
      <div class="ctrl">
        WASD — MOVE &nbsp;|&nbsp; MOUSE — AIM<br>
        <b style="color:#00ffff">RMB HOLD</b> — SNIPER MODE &amp; TIME SLOW<br>
        <b style="color:#00ffff">LMB</b> — SHOOT / MELEE COMBO<br>
        R — RELOAD &nbsp;|&nbsp; ESC — UNLOCK CURSOR
      </div>
      <div class="cta">CLICK TO INFILTRATE</div>
      <div class="hint">SURVIVE THE WAVES &bull; BUILD THE COMBO &bull; FIND THE RHYTHM</div>
    `
    this.menuEl.addEventListener('click', () => {
      if (!this.input.isLocked) this.input.requestLock()
    })
    document.body.appendChild(this.menuEl)

    // Game Over
    this.goEl = document.createElement('div')
    this.goEl.className = 'sc'
    this.goEl.innerHTML = `
      <h1>ELIMINATED</h1>
      <div class="sub">— CRISIS UNCONTAINED —</div>
      <div class="stat" id="go-score">0</div>
      <div class="sub2" id="go-wave">WAVE 1</div>
      <div class="cta" id="go-retry" style="pointer-events:auto;cursor:pointer">CLICK TO RETRY</div>
    `
    this.goEl.querySelector('#go-retry')!.addEventListener('click', () => {
      this.goEl.classList.remove('vis')
      this.showMenu()
      this.gameOver = false
    })
    document.body.appendChild(this.goEl)
  }
}
