import * as THREE from 'three'
import type { InputManager } from './InputManager'

export const EYE_HEIGHT = 1.75
const MOVE_SPEED = 9
const LOOK_SENS  = 0.0022
const PITCH_MAX  = Math.PI / 2.2

const MELEE_DUR = [0.32, 0.40, 0.56] as const

function makeMat(color: number, emissive: number, ei: number, metalness = 0.7, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, metalness, roughness })
}

export class Player {
  readonly position = new THREE.Vector3(0, 0, 0)
  yaw   = 0
  pitch = 0

  private mesh:        THREE.Group
  private bodyGroup:   THREE.Group // sub-group for bob / lean

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

  // Animation state
  private walkT     = 0
  private walkBlend = 0
  private breathT   = 0
  private meleeT    = 0
  private meleeLevel = 0

  constructor(scene: THREE.Scene) {
    this.mesh      = new THREE.Group()
    this.bodyGroup = new THREE.Group()
    this.mesh.add(this.bodyGroup)

    this.bodyMat = makeMat(0x0d1a2e, 0x00aaff, 0.45)

    const visorMat = makeMat(0x00ffff, 0x00ffff, 2.2, 0.9, 0.05)
    const swordMat = makeMat(0x88ccff, 0x00ccff, 1.8, 0.95, 0.05)
    const darkMat  = makeMat(0x050515, 0x002244, 0.3, 0.8, 0.6)

    // ── Torso ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.18, 0.52), this.bodyMat)
    torso.position.y = 0.79
    torso.castShadow = true
    this.bodyGroup.add(torso)

    // Chest glow strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.07, 0.54),
      makeMat(0x00ffff, 0x00ffff, 3.5, 0.6, 0.1)
    )
    strip.position.set(0, 1.02, 0)
    this.bodyGroup.add(strip)

    // Waist detail
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.54), darkMat)
    belt.position.y = 0.26
    this.bodyGroup.add(belt)

    // ── Head ──
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      makeMat(0x0a1525, 0x00bbff, 0.3, 0.8, 0.2)
    )
    head.position.y = EYE_HEIGHT
    head.castShadow = true
    this.bodyGroup.add(head)

    // Visor slit
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.12), visorMat)
    visor.position.set(0, EYE_HEIGHT - 0.04, 0.24)
    this.bodyGroup.add(visor)

    // ── Right arm (sword arm) ──
    this.rShoulder = new THREE.Group()
    this.rShoulder.position.set(0.53, 1.28, 0)
    this.bodyGroup.add(this.rShoulder)

    const rUA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.22), this.bodyMat.clone())
    rUA.position.y = -0.23; rUA.castShadow = true
    this.rShoulder.add(rUA)

    this.rElbow = new THREE.Group()
    this.rElbow.position.y = -0.46
    this.rShoulder.add(this.rElbow)

    const rFA = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.42, 0.19), this.bodyMat.clone())
    rFA.position.y = -0.21; rFA.castShadow = true
    this.rElbow.add(rFA)

    // Sword grip group at tip of forearm
    const sGrip = new THREE.Group()
    sGrip.position.y = -0.43
    this.rElbow.add(sGrip)

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), darkMat.clone())
    handle.position.y = -0.11
    sGrip.add(handle)

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), swordMat.clone())
    guard.position.y = -0.02
    sGrip.add(guard)

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.9, 0.038), swordMat)
    blade.position.y = -0.47
    sGrip.add(blade)

    // Blade glow halo
    const bladeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.9, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 1.8, transparent: true, opacity: 0.35 })
    )
    bladeGlow.position.y = -0.47
    sGrip.add(bladeGlow)

    const swordLight = new THREE.PointLight(0x00aaff, 1.5, 5)
    swordLight.position.y = -0.6
    sGrip.add(swordLight)

    // ── Left arm ──
    this.lShoulder = new THREE.Group()
    this.lShoulder.position.set(-0.53, 1.28, 0)
    this.bodyGroup.add(this.lShoulder)

    const lUA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.22), this.bodyMat.clone())
    lUA.position.y = -0.23; lUA.castShadow = true
    this.lShoulder.add(lUA)

    this.lElbow = new THREE.Group()
    this.lElbow.position.y = -0.46
    this.lShoulder.add(this.lElbow)

    const lFA = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.42, 0.19), this.bodyMat.clone())
    lFA.position.y = -0.21; lFA.castShadow = true
    this.lElbow.add(lFA)

    // ── Right leg ──
    this.rHip = new THREE.Group()
    this.rHip.position.set(0.22, 0.2, 0)
    this.bodyGroup.add(this.rHip)

    const rTh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), this.bodyMat.clone())
    rTh.position.y = -0.31; rTh.castShadow = true
    this.rHip.add(rTh)

    this.rKnee = new THREE.Group()
    this.rKnee.position.y = -0.62
    this.rHip.add(this.rKnee)

    const rSh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.22), this.bodyMat.clone())
    rSh.position.y = -0.29; rSh.castShadow = true
    this.rKnee.add(rSh)

    // Leg glow strip on shin
    const rShineStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.24),
      makeMat(0x0066ff, 0x0066ff, 2, 0.5, 0.1)
    )
    rShineStrip.position.set(0.12, -0.15, 0)
    this.rKnee.add(rShineStrip)

    // ── Left leg ──
    this.lHip = new THREE.Group()
    this.lHip.position.set(-0.22, 0.2, 0)
    this.bodyGroup.add(this.lHip)

    const lTh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), this.bodyMat.clone())
    lTh.position.y = -0.31; lTh.castShadow = true
    this.lHip.add(lTh)

    this.lKnee = new THREE.Group()
    this.lKnee.position.y = -0.62
    this.lHip.add(this.lKnee)

    const lSh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.22), this.bodyMat.clone())
    lSh.position.y = -0.29; lSh.castShadow = true
    this.lKnee.add(lSh)

    const lShineStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.24),
      makeMat(0x0066ff, 0x0066ff, 2, 0.5, 0.1)
    )
    lShineStrip.position.set(-0.12, -0.15, 0)
    this.lKnee.add(lShineStrip)

    scene.add(this.mesh)
  }

  update(dt: number, input: InputManager, _arenaHalf: number) {
    const { dx, dy } = input.consumeDelta()
    this.yaw   -= dx * LOOK_SENS
    this.pitch  = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch - dy * LOOK_SENS))

    const dir = new THREE.Vector3()
    if (input.isKey('KeyW')) dir.z -= 1
    if (input.isKey('KeyS')) dir.z += 1
    if (input.isKey('KeyA')) dir.x -= 1
    if (input.isKey('KeyD')) dir.x += 1

    const moving = dir.lengthSq() > 0
    if (moving) {
      dir.normalize().applyQuaternion(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
      )
      this.position.addScaledVector(dir, MOVE_SPEED * dt)
    }

    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.yaw

    // Walk blend & timers
    this.walkBlend += ((moving ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 10)
    if (moving) this.walkT += dt * 8
    this.breathT += dt * 1.6

    // Body bob
    const breathBob = Math.sin(this.breathT) * 0.010
    const stepBob   = Math.abs(Math.sin(this.walkT)) * 0.07 * this.walkBlend
    this.bodyGroup.position.y = breathBob + stepBob

    // Forward lean when running
    const leanTarget = moving ? 0.10 : 0
    this.bodyGroup.rotation.x += (leanTarget - this.bodyGroup.rotation.x) * Math.min(1, dt * 9)

    // ── Leg animation ──
    const legSwing = Math.sin(this.walkT) * 0.70 * this.walkBlend
    this.rHip.rotation.x = -legSwing
    this.lHip.rotation.x =  legSwing
    // Trailing knee bends
    this.rKnee.rotation.x = Math.max(0, -legSwing) * 0.75
    this.lKnee.rotation.x = Math.max(0,  legSwing) * 0.75

    // ── Arm animation ──
    const armBase  = 0.18
    const armSwing = Math.sin(this.walkT) * 0.50 * this.walkBlend

    if (this.meleeT > 0) {
      this.meleeT = Math.max(0, this.meleeT - dt)
      const dur   = MELEE_DUR[this.meleeLevel]
      const phase = 1 - this.meleeT / dur          // 0 → 1 as animation plays
      const arc   = Math.sin(phase * Math.PI)       // sine envelope: 0→1→0
      const maxSwings  = [-1.9, -2.35, -3.0] as const
      const elbowBends = [0.65, 1.0,   1.4 ] as const
      const bodyLean   = [0,    0.08,  0.22] as const

      this.rShoulder.rotation.x = armBase + arc * maxSwings[this.meleeLevel]
      this.rElbow.rotation.x    = arc * elbowBends[this.meleeLevel]
      this.lShoulder.rotation.x = armBase - arc * 0.55
      this.lElbow.rotation.x    = arc * 0.28
      this.bodyGroup.rotation.x = leanTarget + arc * bodyLean[this.meleeLevel]
    } else {
      this.rShoulder.rotation.x = armBase + armSwing
      this.rElbow.rotation.x    = 0.18 + this.walkBlend * 0.15
      this.lShoulder.rotation.x = armBase - armSwing
      this.lElbow.rotation.x    = 0.18 + this.walkBlend * 0.15
    }

    // Idle arm sway (left/right)
    const sway = Math.sin(this.breathT * 0.5) * 0.04
    this.rShoulder.rotation.z = -0.06 - sway
    this.lShoulder.rotation.z =  0.06 + sway
  }

  triggerMeleeAnim(level: 0 | 1 | 2) {
    this.meleeT    = MELEE_DUR[level]
    this.meleeLevel = level
  }

  setVisible(v: boolean) { this.mesh.visible = v }

  eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, EYE_HEIGHT, this.position.z)
  }

  flash() {
    this.bodyMat.emissiveIntensity = 2.5
    setTimeout(() => { this.bodyMat.emissiveIntensity = 0.45 }, 90)
  }
}
