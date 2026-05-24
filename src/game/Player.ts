import * as THREE from 'three'
import type { InputManager } from './InputManager'

export const EYE_HEIGHT = 1.75
const MOVE_SPEED = 12
const LOOK_SENS  = 0.0022
const PITCH_MAX  = Math.PI / 2.2

const DASH_SPEED    = 38
const DASH_DUR      = 0.16
const DASH_COOLDOWN = 0.9

export type SwordMove = 'slash' | 'heavy' | 'flurry' | 'whirlwind' | 'devastate'

const MOVE_DUR: Record<SwordMove, number> = {
  slash:     0.30,
  heavy:     0.46,
  flurry:    0.40,
  whirlwind: 0.58,
  devastate: 0.68,
}

function makeMat(color: number, emissive: number, ei: number, metalness = 0.7, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, metalness, roughness })
}

export class Player {
  readonly position = new THREE.Vector3(0, 0, 0)
  yaw   = 0
  pitch = 0

  private mesh:        THREE.Group
  private bodyGroup:   THREE.Group

  private bodyMat: THREE.MeshStandardMaterial

  // Arm pivots
  private rShoulder: THREE.Group
  private lShoulder: THREE.Group
  private rElbow:    THREE.Group
  private lElbow:    THREE.Group

  // Leg pivots
  private rHip:   THREE.Group
  private lHip:   THREE.Group
  private rKnee:  THREE.Group
  private lKnee:  THREE.Group

  // Walk / idle state
  private walkT      = 0
  private walkBlend  = 0
  private breathT    = 0
  private leanTarget = 0  // stored so animation can read it cleanly

  // Sword animation state
  private moveT    = 0
  private moveDur  = 0
  private moveType: SwordMove = 'slash'
  private spinOffset = 0

  // Dash state
  private dashT   = 0
  private dashDir = new THREE.Vector3()
  private dashCd  = 0
  private baseDashCd = DASH_COOLDOWN

  constructor(scene: THREE.Scene) {
    this.mesh      = new THREE.Group()
    this.bodyGroup = new THREE.Group()
    this.mesh.add(this.bodyGroup)

    this.bodyMat = makeMat(0x0d1a2e, 0x00aaff, 0.5)

    const visorMat = makeMat(0x00ffff, 0x00ffff, 2.6, 0.9, 0.05)
    const swordMat = makeMat(0x88ccff, 0x00ccff, 2.2, 0.95, 0.05)
    const darkMat  = makeMat(0x050515, 0x002244, 0.3, 0.8, 0.6)

    // ── Torso ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.18, 0.52), this.bodyMat)
    torso.position.y = 0.79
    torso.castShadow = true
    this.bodyGroup.add(torso)

    // Chest glow strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.07, 0.54),
      makeMat(0x00ffff, 0x00ffff, 4.2, 0.6, 0.1)
    )
    strip.position.set(0, 1.02, 0)
    this.bodyGroup.add(strip)

    // Shoulder armor plates
    for (const sx of [-0.55, 0.55]) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, 0.38),
        makeMat(0x0a1828, 0x0044aa, 0.6, 0.85, 0.25)
      )
      pad.position.set(sx, 1.38, 0)
      this.bodyGroup.add(pad)
    }

    // Waist detail
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.54), darkMat)
    belt.position.y = 0.26
    this.bodyGroup.add(belt)

    // ── Head ──
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      makeMat(0x0a1525, 0x00bbff, 0.35, 0.8, 0.2)
    )
    head.position.y = EYE_HEIGHT
    head.castShadow = true
    this.bodyGroup.add(head)

    // Visor slit
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.10, 0.12), visorMat)
    visor.position.set(0, EYE_HEIGHT - 0.04, 0.24)
    this.bodyGroup.add(visor)

    // ── Right arm (sword arm) ──
    this.rShoulder = new THREE.Group()
    this.rShoulder.position.set(0.53, 1.28, 0)
    this.bodyGroup.add(this.rShoulder)

    const rUA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.22), this.bodyMat.clone())
    rUA.position.y = -0.24; rUA.castShadow = true
    this.rShoulder.add(rUA)

    this.rElbow = new THREE.Group()
    this.rElbow.position.y = -0.48
    this.rShoulder.add(this.rElbow)

    const rFA = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.44, 0.19), this.bodyMat.clone())
    rFA.position.y = -0.22; rFA.castShadow = true
    this.rElbow.add(rFA)

    const sGrip = new THREE.Group()
    sGrip.position.y = -0.45
    this.rElbow.add(sGrip)

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.24, 0.065), darkMat.clone())
    handle.position.y = -0.12
    sGrip.add(handle)

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.055, 0.09), swordMat.clone())
    guard.position.y = -0.02
    sGrip.add(guard)

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.056, 1.05, 0.040), swordMat)
    blade.position.y = -0.55
    sGrip.add(blade)

    const bladeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.05, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 2.2, transparent: true, opacity: 0.38 })
    )
    bladeGlow.position.y = -0.55
    sGrip.add(bladeGlow)

    const swordLight = new THREE.PointLight(0x00aaff, 2.2, 6)
    swordLight.position.y = -0.7
    sGrip.add(swordLight)

    // ── Left arm ──
    this.lShoulder = new THREE.Group()
    this.lShoulder.position.set(-0.53, 1.28, 0)
    this.bodyGroup.add(this.lShoulder)

    const lUA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.22), this.bodyMat.clone())
    lUA.position.y = -0.24; lUA.castShadow = true
    this.lShoulder.add(lUA)

    this.lElbow = new THREE.Group()
    this.lElbow.position.y = -0.48
    this.lShoulder.add(this.lElbow)

    const lFA = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.44, 0.19), this.bodyMat.clone())
    lFA.position.y = -0.22; lFA.castShadow = true
    this.lElbow.add(lFA)

    // ── Right leg ──
    this.rHip = new THREE.Group()
    this.rHip.position.set(0.22, 0.2, 0)
    this.bodyGroup.add(this.rHip)

    const rTh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.64, 0.27), this.bodyMat.clone())
    rTh.position.y = -0.32; rTh.castShadow = true
    this.rHip.add(rTh)

    this.rKnee = new THREE.Group()
    this.rKnee.position.y = -0.64
    this.rHip.add(this.rKnee)

    const rSh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.60, 0.23), this.bodyMat.clone())
    rSh.position.y = -0.30; rSh.castShadow = true
    this.rKnee.add(rSh)

    const rShine = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.42, 0.25),
      makeMat(0x0055ff, 0x0066ff, 2.4, 0.5, 0.1)
    )
    rShine.position.set(0.12, -0.15, 0)
    this.rKnee.add(rShine)

    // ── Left leg ──
    this.lHip = new THREE.Group()
    this.lHip.position.set(-0.22, 0.2, 0)
    this.bodyGroup.add(this.lHip)

    const lTh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.64, 0.27), this.bodyMat.clone())
    lTh.position.y = -0.32; lTh.castShadow = true
    this.lHip.add(lTh)

    this.lKnee = new THREE.Group()
    this.lKnee.position.y = -0.64
    this.lHip.add(this.lKnee)

    const lSh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.60, 0.23), this.bodyMat.clone())
    lSh.position.y = -0.30; lSh.castShadow = true
    this.lKnee.add(lSh)

    const lShine = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.42, 0.25),
      makeMat(0x0055ff, 0x0066ff, 2.4, 0.5, 0.1)
    )
    lShine.position.set(-0.12, -0.15, 0)
    this.lKnee.add(lShine)

    scene.add(this.mesh)
  }

  update(dt: number, input: InputManager, _arenaHalf: number, opts?: { speedMult?: number; dashCdBonus?: number }): { dashed: boolean } {
    const { dx, dy } = input.consumeDelta()
    this.yaw   -= dx * LOOK_SENS
    this.pitch  = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch - dy * LOOK_SENS))

    this.dashCd = Math.max(0, this.dashCd - dt)

    const dir = new THREE.Vector3()
    if (input.isKey('KeyW')) dir.z -= 1
    if (input.isKey('KeyS')) dir.z += 1
    if (input.isKey('KeyA')) dir.x -= 1
    if (input.isKey('KeyD')) dir.x += 1

    const speedMult   = opts?.speedMult  ?? 1.0
    const dashCdBonus = opts?.dashCdBonus ?? 0
    const effectiveDashCd = Math.max(0.25, DASH_COOLDOWN - dashCdBonus)

    // ── Dash ──
    let dashed = false
    if (input.wasKeyPressed('Space') && this.dashCd <= 0) {
      const dashDir = dir.lengthSq() > 0 ? dir.clone().normalize() : new THREE.Vector3(0, 0, -1)
      dashDir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw))
      this.dashDir.copy(dashDir)
      this.dashT  = DASH_DUR
      this.dashCd = effectiveDashCd
      dashed = true
    }

    const moving = dir.lengthSq() > 0
    if (this.dashT > 0) {
      this.dashT = Math.max(0, this.dashT - dt)
      const dashFrac = this.dashT / DASH_DUR
      this.position.addScaledVector(this.dashDir, DASH_SPEED * dashFrac * dt)
    } else if (moving) {
      const fd = dir.clone().normalize().applyQuaternion(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
      )
      this.position.addScaledVector(fd, MOVE_SPEED * speedMult * dt)
    }

    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.yaw

    // Walk timers
    this.walkBlend += ((moving ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 12)
    if (moving) this.walkT += dt * 10
    this.breathT += dt * 1.7

    // Body bob — extra strong during dash
    const dashBob = this.dashT > 0 ? 0.18 : 0
    const breathBob = Math.sin(this.breathT) * 0.012
    const stepBob   = Math.abs(Math.sin(this.walkT)) * 0.085 * this.walkBlend
    this.bodyGroup.position.y = breathBob + stepBob + dashBob

    // Forward lean — store so animation code can read a stable value
    this.leanTarget = (moving || this.dashT > 0) ? 0.14 : 0
    this.bodyGroup.rotation.x += (this.leanTarget - this.bodyGroup.rotation.x) * Math.min(1, dt * 10)

    // ── Leg animation ──
    const legSwing = Math.sin(this.walkT) * 0.88 * this.walkBlend
    this.rHip.rotation.x = -legSwing
    this.lHip.rotation.x =  legSwing
    this.rKnee.rotation.x = Math.max(0, -legSwing) * 0.85
    this.lKnee.rotation.x = Math.max(0,  legSwing) * 0.85

    // ── Arm + Sword animation ──
    this.updateSwordAnim(dt)

    // Idle sway
    const sway = Math.sin(this.breathT * 0.5) * 0.05
    if (this.moveT <= 0) {
      this.rShoulder.rotation.z = -0.07 - sway
      this.lShoulder.rotation.z =  0.07 + sway
    }

    return { dashed }
  }

  private updateSwordAnim(dt: number) {
    const armSwing = Math.sin(this.walkT) * 0.62 * this.walkBlend
    const armBase  = 0.20
    const lt = this.leanTarget  // stable value set before this call

    if (this.moveT > 0) {
      this.moveT = Math.max(0, this.moveT - dt)
      const phase = 1 - this.moveT / this.moveDur  // 0→1 as move plays
      const arc   = Math.sin(phase * Math.PI)       // 0→1→0 envelope

      switch (this.moveType) {
        case 'slash': {
          this.rShoulder.rotation.x = armBase + arc * (-3.4)
          this.rElbow.rotation.x    = arc * 1.7
          this.rShoulder.rotation.z = -0.15 - arc * 0.50
          this.lShoulder.rotation.x = armBase - arc * 0.75
          this.lElbow.rotation.x    = arc * 0.42
          this.bodyGroup.rotation.z = arc * 0.22
          break
        }

        case 'heavy': {
          const wind    = Math.min(1, phase / 0.35)
          const slamT   = phase < 0.35 ? 0 : (phase - 0.35) / 0.65
          const slamArc = Math.sin(slamT * Math.PI)
          this.rShoulder.rotation.x = armBase + 1.5 * wind - 4.0 * slamArc
          this.lShoulder.rotation.x = armBase + 1.3 * wind - 3.4 * slamArc
          this.rElbow.rotation.x    = 1.2 * wind + slamArc * 2.4
          this.lElbow.rotation.x    = 1.0 * wind + slamArc * 2.0
          this.bodyGroup.rotation.x = lt + slamArc * 0.48 - wind * 0.24
          this.bodyGroup.rotation.z = arc * 0.10
          break
        }

        case 'flurry': {
          const t2       = (phase * 2) % 1
          const fArc     = Math.sin(t2 * Math.PI)
          const side     = Math.floor(phase * 2) % 2 === 0 ? 1 : -1
          this.rShoulder.rotation.x = armBase + side * fArc * (-3.0)
          this.rElbow.rotation.x    = fArc * 1.5
          this.lShoulder.rotation.x = armBase - side * fArc * 1.7
          this.lElbow.rotation.x    = fArc * 0.85
          this.rShoulder.rotation.z = -0.07 - side * fArc * 0.38
          break
        }

        case 'whirlwind': {
          this.spinOffset       = phase * Math.PI * 2
          this.mesh.rotation.y  = this.yaw + this.spinOffset
          this.rShoulder.rotation.x = -0.32
          this.lShoulder.rotation.x = -0.32
          this.rShoulder.rotation.z = -(Math.PI / 2) - 0.22
          this.lShoulder.rotation.z =  (Math.PI / 2) + 0.22
          this.rElbow.rotation.x    = -0.1
          this.lElbow.rotation.x    = -0.1
          this.bodyGroup.position.y += Math.sin(phase * Math.PI) * 0.24
          break
        }

        case 'devastate': {
          // Three distinct phases: windup → strike → recovery
          const W = 0.35, S = 0.72  // phase boundaries
          if (phase <= W) {
            // Windup: arms pull back and up, body leans back
            const t = phase / W
            this.rShoulder.rotation.x = armBase + t * 2.8
            this.lShoulder.rotation.x = armBase + t * 2.5
            this.rElbow.rotation.x    = t * (-0.95)
            this.lElbow.rotation.x    = t * (-0.80)
            this.bodyGroup.rotation.x = lt - t * 0.42
            this.bodyGroup.position.z = 0
          } else if (phase <= S) {
            // Strike: massive forward slam
            const t    = (phase - W) / (S - W)  // 0→1
            const sArc = Math.sin(t * Math.PI)   // rises and falls
            this.rShoulder.rotation.x = armBase + 2.8 - t * 7.4
            this.lShoulder.rotation.x = armBase + 2.5 - t * 6.8
            this.rElbow.rotation.x    = -0.95 + t * 3.6
            this.lElbow.rotation.x    = -0.80 + t * 3.2
            this.bodyGroup.rotation.x = lt - 0.42 + sArc * 0.82
            this.bodyGroup.position.z = -sArc * 0.62  // lunge forward
            this.rShoulder.rotation.z = -0.07 - sArc * 0.35
          } else {
            // Recovery: ease back to idle
            const t    = (phase - S) / (1 - S)
            const ease = 1 - (1 - t) * (1 - t)
            // At end of strike (t=1 in strike phase): rShoulder = armBase + 2.8 - 7.4 = armBase - 4.6
            const rSPeak = armBase - 4.6
            const lSPeak = armBase - 4.3
            this.rShoulder.rotation.x = rSPeak + ease * (armBase - rSPeak)
            this.lShoulder.rotation.x = lSPeak + ease * (armBase - lSPeak)
            this.rElbow.rotation.x    = 2.65 * (1 - ease)
            this.lElbow.rotation.x    = 2.40 * (1 - ease)
            this.bodyGroup.rotation.x = lt + (0.40) * (1 - ease)
            this.bodyGroup.position.z = 0
            this.rShoulder.rotation.z = -0.07
          }
          break
        }
      }
    } else {
      this.spinOffset = 0
      this.rShoulder.rotation.x = armBase + armSwing
      this.rElbow.rotation.x    = 0.22 + this.walkBlend * 0.18
      this.lShoulder.rotation.x = armBase - armSwing
      this.lElbow.rotation.x    = 0.22 + this.walkBlend * 0.18
      this.bodyGroup.position.z = 0
      this.bodyGroup.rotation.z = 0
      this.mesh.rotation.y      = this.yaw
    }
  }

  triggerMeleeAnim(move: SwordMove) {
    this.moveType = move
    this.moveDur  = MOVE_DUR[move]
    this.moveT    = this.moveDur
    this.spinOffset = 0
  }

  setVisible(v: boolean) { this.mesh.visible = v }

  eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, EYE_HEIGHT, this.position.z)
  }

  flash() {
    this.bodyMat.emissiveIntensity = 3.2
    setTimeout(() => { this.bodyMat.emissiveIntensity = 0.5 }, 90)
  }

  get isDashing()  { return this.dashT > 0 }
  get dashReady()  { return this.dashCd <= 0 }
}

