import * as THREE from 'three'
import { InputManager } from './InputManager'
import { Arena } from './Arena'
import { Player, type SwordMove } from './Player'
import { Camera } from './Camera'
import { EnemyManager } from './EnemyManager'
import { Combo } from './Combo'
import { HUD } from './HUD'
import { RagdollSystem } from './Ragdoll'
import { BloodSystem } from './Blood'
import { MobileControls } from './MobileControls'
import { AudioSystem } from './AudioSystem'
import { DeathParticles } from './DeathParticles'
import { NeuralViz } from './NeuralViz'
import { SkillTree, defaultStats, type PlayerStats, type Skill } from './SkillTree'
import type { Enemy } from './Enemy'

const MELEE_RANGE = 4.2
const MELEE_RANGES: Record<SwordMove, number> = {
  slash:     MELEE_RANGE,
  heavy:     5.0,
  flurry:    MELEE_RANGE,
  whirlwind: 6.5,
  devastate: 7.0,
}
const MELEE_DMG: Record<SwordMove, number> = {
  slash:     32,
  heavy:     65,
  flurry:    28,
  whirlwind: 55,
  devastate: 140,
}

const SNIPER_BASE_DMG  = 120
const SNIPER_CD_BASE   = 0.55
const RELOAD_TIME      = 1.4
const WAVE_COUNTDOWN   = 3.5
const HS_STREAK_MAX    = 10
const HS_STREAK_DECAY  = 3.5
const PARRY_RANGE      = 3.5
const EXEC_RANGE       = 3.0

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
  private scene:    THREE.Scene
  private clock:    THREE.Clock
  private input:    InputManager
  private mobile:   MobileControls
  private arena:    Arena
  private player:   Player
  private camera:   Camera
  private enemies:  EnemyManager
  private combo:    Combo
  private hud:      HUD
  private ragdolls: RagdollSystem
  private blood:    BloodSystem
  private audio:    AudioSystem
  private deathFX:  DeathParticles
  private neuralViz: NeuralViz
  private skillTree: SkillTree

  private stats: PlayerStats = defaultStats()

  private tracers: { lines: THREE.Line[]; age: number; linger: number; lifetime: number }[] = []

  private hp = 100
  private score = 0
  private wave = 1
  private ammo = 8
  private readonly maxAmmo = 8

  private sniper = false
  private reloading = false
  private reloadTimer = 0
  private sniperCd = 0
  private waveActive = false
  private waveCd = 0
  private gameOver = false
  private running = false
  private skillTreeOpen = false

  private hsStreak = 0
  private hsTimer  = 0

  private lastSwordClickT = -1
  private swordSeq: ('S' | 'D')[] = []
  private seqDecay = 0

  private executionActive = false
  private executionTarget: Enemy | null = null
  private executionT = 0

  private menuEl!: HTMLElement
  private goEl!: HTMLElement
  private raycaster = new THREE.Raycaster()

  get maxHp() { return 100 + this.stats.maxHpBonus }

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    document.getElementById('app')!.appendChild(this.renderer.domElement)

    this.scene    = new THREE.Scene()
    this.clock    = new THREE.Clock()
    this.input    = new InputManager(this.renderer.domElement)
    this.mobile   = new MobileControls(this.input)
    this.arena    = new Arena(this.scene)
    this.player   = new Player(this.scene)
    this.camera   = new Camera(this.renderer)
    this.enemies  = new EnemyManager(this.scene)
    this.combo    = new Combo()
    this.hud      = new HUD()
    this.hud.hide()
    this.ragdolls  = new RagdollSystem(this.scene)
    this.blood     = new BloodSystem(this.scene)
    this.audio     = new AudioSystem()
    this.deathFX   = new DeathParticles(this.scene)
    this.neuralViz = new NeuralViz()
    this.skillTree = new SkillTree()

    this.buildScreens()
    this.showMenu()

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        if (!this.running && !this.gameOver) this.startGame()
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
    const dtMult = this.executionActive ? 0.08 : (this.sniper ? 0.25 : 1.0)
    const dt = rawDt * dtMult
    this.update(dt, rawDt)
    this.renderer.render(this.scene, this.camera.cam)
    this.input.endFrame()
  }

  private update(dt: number, rawDt: number) {
    this.sniperCd = Math.max(0, this.sniperCd - rawDt)
    this.mobile.update()

    if (this.hsStreak > 0) {
      this.hsTimer -= rawDt
      if (this.hsTimer <= 0) this.hsStreak = 0
    }

    if (this.seqDecay > 0) {
      this.seqDecay -= rawDt
      if (this.seqDecay <= 0) this.swordSeq = []
    }

    if (this.input.wasKeyPressed('Tab')) this.neuralViz.toggle()

    // ── Reload ──
    const reloadTime = Math.max(0.35, RELOAD_TIME - this.stats.reloadBonus)
    if (this.reloading) {
      this.reloadTimer = Math.max(0, this.reloadTimer - rawDt)
      if (this.reloadTimer === 0) {
        this.reloading = false
        this.ammo = this.maxAmmo
        this.hud.flash('READY', 0.7)
      }
    } else if (this.input.wasKeyPressed('KeyR') && this.ammo < this.maxAmmo && !this.executionActive) {
      this.reloading = true
      this.reloadTimer = reloadTime
      this.hud.flash('RELOADING...', reloadTime)
    }

    // ── Sniper mode ──
    this.sniper = this.input.isMouse(2) && !this.reloading && !this.executionActive
    this.player.setVisible(!this.sniper)

    // ── E key: parry or execution ──
    if (this.input.wasKeyPressed('KeyE') && !this.executionActive) {
      this.tryExecuteOrParry()
    }

    // ── Execution finisher ──
    if (this.executionActive && this.executionTarget) {
      this.executionT += rawDt
      const eTarget = this.executionTarget
      const toTarget = new THREE.Vector3().subVectors(eTarget.position, this.player.position)
      toTarget.y = 0
      if (toTarget.length() > 1.3) {
        this.player.position.addScaledVector(toTarget.normalize(), Math.min(toTarget.length(), 24 * dt))
      }
      if (this.executionT >= 0.5 && !eTarget.isDead) {
        eTarget.takeDamage(9999)
        this.player.triggerMeleeAnim('devastate')
        this.hud.showMeleeHit('devastate')
        const kPos = eTarget.position.clone()
        this.handleKill(eTarget, kPos.clone().setY(1.0), 3.0)
        this.audio.execution()
        this.camera.shake(0.55)
        this.camera.triggerKillCam(kPos, 1.5)
        this.hud.flash('✦ EXECUTION ✦', 1.6)
        this.triggerChromaFlash()
      }
      if (this.executionT >= 1.0) {
        this.executionActive = false
        this.executionTarget = null
        this.executionT = 0
      }
    }

    // ── Player movement ──
    if (!this.executionActive) {
      const { dashed } = this.player.update(dt, this.input, 0, {
        speedMult: this.stats.speedMult,
        dashCdBonus: this.stats.dashCdBonus,
      })
      if (dashed) this.camera.shake(0.18)
    }

    // ── Arena floor + weather ──
    this.arena.update(this.player.position, rawDt)

    // ── Camera ──
    this.camera.update(rawDt, this.player, this.sniper)

    // ── Shoot / Sword ──
    if (!this.executionActive && this.input.wasMousePressed(0)) {
      if (this.sniper) {
        this.doSnipe()
      } else {
        this.doSword()
      }
    }

    // ── Adaptive music ──
    this.audio.setCombo(this.combo.streak)

    // ── Enemies ──
    const enemyDmg = this.enemies.update(dt, this.player.position)
    if (enemyDmg > 0) {
      this.hp = Math.max(0, this.hp - enemyDmg)
      this.player.flash()
      this.hud.addDamage(enemyDmg)
      this.audio.playerHit()
      if (this.hp === 0) { this.endGame(); return }
    }

    // ── Ragdolls, blood, particles ──
    this.ragdolls.update(rawDt)
    this.blood.update(rawDt)
    this.deathFX.update(rawDt)

    // ── Tracer fade ──
    this.tracers = this.tracers.filter(tr => {
      tr.age += rawDt
      if (tr.age >= tr.linger + tr.lifetime) {
        for (const l of tr.lines) this.scene.remove(l)
        return false
      }
      const opacity = tr.age < tr.linger
        ? 0.9
        : 0.9 * (1 - (tr.age - tr.linger) / tr.lifetime)
      for (const l of tr.lines) {
        const m = l.material as THREE.LineBasicMaterial
        m.opacity = opacity
        m.needsUpdate = true
      }
      return true
    })

    // ── Combo decay ──
    this.combo.update(dt / this.stats.comboMult)

    // ── Boss bar ──
    const boss = this.enemies.getBoss()
    if (boss) {
      this.hud.showBossBar(boss.bossHealthFrac, boss.currentBossPhase)
    } else {
      this.hud.hideBossBar()
    }

    // ── Action prompts ──
    if (!this.executionActive) {
      const ep = this.findExecTarget()
      const pp = !ep ? this.findParryTarget() : null
      this.hud.setActionPrompt(ep ? 'exec' : pp ? 'parry' : null)
    } else {
      this.hud.setActionPrompt(null)
    }

    // ── Neural viz ──
    if (this.neuralViz.visible) {
      const cl = this.enemies.closest(this.player.position)
      if (cl) {
        const e = cl.enemy
        const d = e.position.distanceTo(this.player.position)
        const dir = new THREE.Vector3().subVectors(this.player.position, e.position).normalize()
        const inputs = [
          Math.min(d, 40) / 40,
          (Math.atan2(dir.x, dir.z) / Math.PI + 1) * 0.5,
          Math.min(this.wave, 10) / 10,
          e.hp / e.maxHp,
          0,
        ]
        const outputs = e.brain.forward(inputs)
        this.neuralViz.update(e.brain, inputs, outputs)
      } else {
        this.neuralViz.update(null, [0, 0, 0, 0, 0], [0, 0, 0, 0])
      }
    }

    // ── Wave management ──
    if (this.waveActive) {
      if (this.enemies.count === 0) {
        this.waveActive = false
        this.enemies.evolvePool()
        this.wave++
        this.ammo = this.maxAmmo
        this.hp = Math.min(this.maxHp, this.hp + 25)
        this.reloading = false
        this.skillTreeOpen = true
        this.skillTree.show(this.wave, (skill) => this.onSkillPicked(skill))
      }
    } else if (!this.skillTreeOpen) {
      this.waveCd = Math.max(0, this.waveCd - rawDt)
      if (this.waveCd === 0) this.launchWave()
    }

    // ── HUD ──
    this.hud.update(
      this.hp, this.maxHp, this.ammo, this.maxAmmo,
      this.score, this.wave,
      this.combo.streak, this.combo.timerFrac,
      this.sniper,
      this.reloading, this.reloadTimer > 0 ? 1 - this.reloadTimer / reloadTime : 0,
      '',
      this.player.dashReady,
      this.hsStreak,
      rawDt
    )
  }

  // ── Parry / Execution ──

  private findParryTarget(): Enemy | null {
    for (const e of this.enemies.all) {
      if (e.isDead || !e.inTelegraph) continue
      if (e.position.distanceTo(this.player.position) <= PARRY_RANGE) return e
    }
    return null
  }

  private findExecTarget(): Enemy | null {
    for (const e of this.enemies.all) {
      if (!e.isExecutable) continue
      if (e.position.distanceTo(this.player.position) <= EXEC_RANGE) return e
    }
    return null
  }

  private tryExecuteOrParry() {
    const execTarget = this.findExecTarget()
    if (execTarget) {
      this.executionActive = true
      this.executionTarget = execTarget
      this.executionT = 0
      return
    }
    const parryTarget = this.findParryTarget()
    if (parryTarget) {
      parryTarget.stagger(2.2)
      this.audio.parry()
      this.camera.shake(0.22)
      this.hud.flash('⬡  PARRY!  ⬡', 0.8)
      this.combo.hit()
    }
  }

  private triggerChromaFlash() {
    const canvas = this.renderer.domElement
    canvas.classList.remove('chroma')
    void canvas.offsetWidth
    canvas.classList.add('chroma')
    setTimeout(() => canvas.classList.remove('chroma'), 260)
  }

  // ── Sniper shot ──

  private doSnipe() {
    if (this.reloading || this.sniperCd > 0) return
    if (this.ammo <= 0) { this.hud.flash('RELOAD! [R]', 1.2); return }

    const powerFrac = this.hsStreak / HS_STREAK_MAX
    this.sniperCd = SNIPER_CD_BASE * (1 - powerFrac * 0.35)
    this.ammo--

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera.cam)

    let tracerEnd = this.camera.cam.position.clone().add(
      new THREE.Vector3(0, 0, -80).applyQuaternion(this.camera.cam.quaternion)
    )

    for (const e of this.enemies.all) {
      if (e.isDead) continue
      const box = new THREE.Box3().setFromObject(e.mesh)
      if (!this.raycaster.ray.intersectsBox(box)) continue

      const headPos = e.headWorldPos()
      const hs = this.raycaster.ray.distanceToPoint(headPos) < 0.38
      const dmg = Math.round(
        SNIPER_BASE_DMG
          * (1 + powerFrac * 2.5)
          * (hs ? 1 + this.stats.headshotMult : 1)
          * (1 + this.stats.enemyDmgMult)
      )
      const killed = e.takeDamage(dmg, hs)
      tracerEnd = hs ? headPos.clone() : e.position.clone().setY(e.position.y + 1.0)

      if (hs) {
        this.hsStreak = Math.min(this.hsStreak + 1, HS_STREAK_MAX)
        this.hsTimer  = HS_STREAK_DECAY
        this.audio.headshot(this.hsStreak)
        const label = this.hsStreak >= 8
          ? `⚡ ULTRA ×${dmg}`
          : this.hsStreak >= 5 ? `HEADSHOT ×${dmg}` : 'HEADSHOT!'
        this.hud.flash(label, 0.9)
        this.blood.splat(headPos, 70 + this.hsStreak * 8, 2.5 + powerFrac * 1.5)
        this.blood.splat(headPos, 35, 1.5)
      } else {
        this.hsStreak = 0
        this.blood.splat(e.position.clone().setY(e.position.y + 1.0), 20, 1.0)
      }

      if (killed) {
        const bonus = hs ? 2.0 * (1 + powerFrac) : 1.0
        this.handleKill(e, tracerEnd.clone(), bonus)
      }
      break
    }

    this.spawnLightningTracer(this.camera.cam.position, tracerEnd, this.hsStreak)

    if (this.ammo === 0 && !this.reloading) {
      const rt = Math.max(0.35, RELOAD_TIME - this.stats.reloadBonus)
      this.reloading = true
      this.reloadTimer = rt
      this.hud.flash('AUTO-RELOAD...', rt)
    }
  }

  // ── Sword attack ──

  private doSword() {
    const now = performance.now() / 1000
    const dtSinceLast = now - this.lastSwordClickT
    const isDouble = this.lastSwordClickT >= 0 && dtSinceLast < 0.22
    this.lastSwordClickT = now

    if (isDouble) {
      if (this.swordSeq.length > 0 && this.swordSeq[this.swordSeq.length - 1] === 'S') {
        this.swordSeq.pop()
      }
      this.swordSeq.push('D')
    } else {
      this.swordSeq.push('S')
    }
    if (this.swordSeq.length > 3) this.swordSeq.shift()
    this.seqDecay = 1.2

    this.executeSword(this.classifySwordSeq())
  }

  private classifySwordSeq(): SwordMove {
    const s = this.swordSeq.join('')
    if (s.endsWith('SSD')) return 'devastate'
    if (s.endsWith('DD'))  return 'whirlwind'
    if (s.endsWith('SS'))  return 'flurry'
    if (s.endsWith('D'))   return 'heavy'
    return 'slash'
  }

  private executeSword(move: SwordMove) {
    const range   = MELEE_RANGES[move] * this.stats.swordRange
    const dmgMult = 1 + this.stats.enemyDmgMult
    const is360   = move === 'whirlwind'

    let hitAny = false
    this.audio.swordSwing(move)

    for (const e of this.enemies.all) {
      if (e.isDead) continue
      if (e.position.distanceTo(this.player.position) > range) continue

      if (!is360 && move !== 'devastate') {
        const toEnemy = new THREE.Vector3().subVectors(e.position, this.player.position).normalize()
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw)
        )
        if (toEnemy.dot(fwd) < 0.1) continue
      }

      const hitDmg = move === 'flurry'
        ? Math.round(MELEE_DMG[move] * (0.8 + Math.random() * 0.4) * dmgMult)
        : Math.round(MELEE_DMG[move] * dmgMult)

      if (move === 'devastate' || move === 'whirlwind') {
        const dir = new THREE.Vector3().subVectors(e.position, this.player.position).normalize()
        e.knockback(dir, move === 'devastate' ? 14 : 10)
      }

      const killed = e.takeDamage(hitDmg)
      hitAny = true
      const hitPos = e.position.clone().setY(e.position.y + 1.0)

      if (killed) {
        const bonus = move === 'devastate' ? 2.2 : move === 'whirlwind' ? 1.9 : 1.6
        this.handleKill(e, hitPos, bonus)
      } else {
        this.blood.splat(hitPos, 14, 0.9)
        this.deathFX.splat(hitPos, 10, e.color, 2.0)
      }
    }

    // Debris from nearby structures on AoE
    if ((move === 'devastate' || move === 'whirlwind') && hitAny) {
      for (const sp of this.arena.getStructurePositions()) {
        if (sp.distanceTo(this.player.position) < range * 1.2) {
          this.deathFX.splat(sp, 12, 0x00ffcc, 3.2)
          break
        }
      }
    }

    this.player.triggerMeleeAnim(move)
    this.hud.showSwordMove(move)
    if (hitAny) {
      this.hud.showMeleeHit(move)
      this.audio.swordImpact(move)
      if (move === 'heavy' || move === 'devastate' || move === 'whirlwind') {
        this.triggerChromaFlash()
      }
      const shakeAmts: Record<SwordMove, number> = {
        slash: 0.10, heavy: 0.28, flurry: 0.18, whirlwind: 0.38, devastate: 0.60,
      }
      this.camera.shake(shakeAmts[move])
    }
  }

  // ── Kill handler ──

  private handleKill(e: Enemy, hitPos: THREE.Vector3, scoreBonus: number) {
    this.combo.hit()
    this.score += Math.floor(e.reward * scoreBonus * this.combo.multiplier)
    this.enemies.recordKill(e)
    this.ragdolls.spawnRagdoll(e.position.clone(), e.color, e.scale)
    this.deathFX.splat(e.position.clone().setY(1.0), 65, e.color, 5.0)
    this.blood.splat(hitPos, 40, 2.0)
    this.audio.enemyDeath(e.color)

    if (this.stats.vampHeal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.stats.vampHeal)
    }

    if (e.isBoss) {
      this.audio.bossDeath()
      this.camera.triggerKillCam(e.position.clone(), 2.2)
    } else if (this.combo.streak >= 5 && Math.random() < 0.35) {
      this.camera.triggerKillCam(hitPos, 1.1)
    }
  }

  // ── Lightning tracer ──

  private spawnLightningTracer(from: THREE.Vector3, to: THREE.Vector3, streak: number) {
    const powerFrac = streak / HS_STREAK_MAX
    const colorA = lerpHex(0x001166, 0x330055, powerFrac)
    const colorB = lerpHex(0x00aaff, 0xcc00ff, powerFrac)
    const segments    = Math.max(2, Math.round(2 + powerFrac * 10))
    const jitter      = powerFrac * 3.2
    const branchCount = 1 + Math.floor(powerFrac * 2.5)
    const linger      = 0.18 + powerFrac * 0.22
    const lifetime    = 0.55 + powerFrac * 0.85
    const lines: THREE.Line[] = []

    for (let b = 0; b < branchCount; b++) {
      const pts: THREE.Vector3[] = []
      const cols: number[] = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const p = from.clone().lerp(to, t)
        if (i > 0 && i < segments) {
          const perp = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize()
          p.addScaledVector(perp, jitter * (Math.random() - 0.5))
          p.y += jitter * 0.5 * (Math.random() - 0.5)
        }
        pts.push(p)
        const [r, g, bl] = hexToRGB(lerpHex(colorA, colorB, t))
        cols.push(r, g, bl)
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: b === 0 ? 0.9 : 0.55,
      })
      const line = new THREE.Line(geo, mat)
      this.scene.add(line)
      lines.push(line)
    }

    this.tracers.push({ lines, age: 0, linger, lifetime })

    if (powerFrac > 0.4) {
      const fl = this.buildBolt(from, to, colorA, colorB, segments, jitter * 0.65)
      this.scene.add(fl)
      this.tracers.push({ lines: [fl], age: -0.12, linger: 0.05, lifetime: 0.25 })
    }
  }

  private buildBolt(
    from: THREE.Vector3, to: THREE.Vector3,
    colorA: number, colorB: number,
    segments: number, jitter: number
  ): THREE.Line {
    const pts: THREE.Vector3[] = []
    const cols: number[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const p = from.clone().lerp(to, t)
      if (i > 0 && i < segments) {
        const perp = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize()
        p.addScaledVector(perp, jitter * (Math.random() - 0.5))
        p.y += jitter * 0.5 * (Math.random() - 0.5)
      }
      pts.push(p)
      const [r, g, b] = hexToRGB(lerpHex(colorA, colorB, t))
      cols.push(r, g, b)
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 }))
  }

  // ── Skill tree ──

  private onSkillPicked(skill: Skill) {
    this.stats = this.skillTree.applySkill(this.stats, skill)
    if (skill.stat === 'maxHpBonus') {
      this.hp = Math.min(this.maxHp, this.hp + skill.delta)
    }
    this.skillTreeOpen = false
    this.audio.powerUp()
    this.hud.flash(`ENHANCED: ${skill.name}`, 1.8)
    this.waveCd = WAVE_COUNTDOWN
  }

  // ── Wave launch ──

  private launchWave() {
    this.waveActive = true
    const isBoss = this.enemies.spawnWave(this.wave, this.player.position)
    this.arena.setWeatherTheme(this.wave)
    if (isBoss) {
      this.audio.bossAppear()
      this.hud.flash('⬡  CRISIS ENTITY INCOMING  ⬡', 2.8)
    } else {
      this.hud.flash(`WAVE ${this.wave}`, 1.2)
    }
  }

  // ── Game lifecycle ──

  private startGame() {
    this.running = true
    this.gameOver = false
    this.stats = defaultStats()
    this.hp = this.maxHp
    this.score = 0
    this.wave = 1
    this.ammo = this.maxAmmo
    this.reloading = false
    this.waveActive = false
    this.waveCd = 2.0
    this.hsStreak = 0
    this.hsTimer  = 0
    this.swordSeq = []
    this.seqDecay = 0
    this.skillTreeOpen = false
    this.executionActive = false
    this.executionTarget = null
    this.executionT = 0
    this.combo.reset()
    this.enemies.clear()
    this.ragdolls.clear()
    this.blood.clear()
    this.deathFX.clear()
    for (const tr of this.tracers) for (const l of tr.lines) this.scene.remove(l)
    this.tracers = []
    this.player.position.set(0, 0, 0)
    this.menuEl.classList.remove('vis')
    this.goEl.classList.remove('vis')
    this.hud.show()
    this.hud.hideBossBar()
    this.hud.flash('WAVE 1 INCOMING', 2.0)
    this.arena.setWeatherTheme(1)
    this.audio.resume()
    this.clock.start()
  }

  private endGame() {
    this.running = false
    this.gameOver = true
    this.enemies.clear()
    this.ragdolls.clear()
    this.blood.clear()
    this.deathFX.clear()
    this.hud.hide()
    this.hud.hideBossBar()
    document.exitPointerLock()
    this.goEl.querySelector('#go-score')!.textContent = this.score.toLocaleString()
    this.goEl.querySelector('#go-wave')!.textContent = `REACHED WAVE ${this.wave}`
    this.goEl.classList.add('vis')
  }

  private showMenu() { this.menuEl.classList.add('vis') }

  private buildScreens() {
    const styleEl = document.createElement('style')
    styleEl.textContent = SCREEN_CSS
    document.head.appendChild(styleEl)

    this.menuEl = document.createElement('div')
    this.menuEl.className = 'sc'
    this.menuEl.innerHTML = `
      <h1>SCEMATICA</h1>
      <div class="sub">— CRISIS —</div>
      <div class="ctrl">
        WASD — MOVE &nbsp;|&nbsp; SPACE — DASH<br>
        <b style="color:#00ffff">RMB HOLD</b> — SNIPER MODE &amp; TIME SLOW<br>
        <b style="color:#00ffff">LMB</b> — SWORD &nbsp;|&nbsp; DOUBLE-CLICK — HEAVY<br>
        <b style="color:#aa00ff">COMBOS:</b> SS=FLURRY &nbsp;|&nbsp; DD=WHIRLWIND &nbsp;|&nbsp; SSD=DEVASTATE<br>
        <b style="color:#ff4400">E</b> — PARRY / EXECUTE &nbsp;|&nbsp; TAB — NEURAL VIZ<br>
        HEADSHOTS CHARGE GUN POWER &nbsp;|&nbsp; R — RELOAD
      </div>
      <div class="cta">CLICK TO INFILTRATE</div>
      <div class="hint">SURVIVE THE WAVES &bull; BUILD THE COMBO &bull; MASTER THE BLADE</div>
    `
    this.menuEl.addEventListener('click', () => {
      if (!this.input.isLocked) this.input.requestLock()
    })
    document.body.appendChild(this.menuEl)

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

function lerpHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t)
}

function hexToRGB(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}
