import * as THREE from 'three'
import { NeuralBrain } from './NeuralBrain'

export type EnemyType = 'grunt' | 'rusher' | 'heavy'

interface Cfg {
  speed: number
  hp: number
  damage: number
  scale: number
  color: number
  reward: number
  attackRate: number
}

const CFGS: Record<EnemyType, Cfg> = {
  grunt:  { speed: 4.5, hp: 2, damage: 10, scale: 1.0,  color: 0xff2222, reward: 100, attackRate: 1.1 },
  rusher: { speed: 9.0, hp: 1, damage: 7,  scale: 0.75, color: 0xff8800, reward: 150, attackRate: 0.7 },
  heavy:  { speed: 2.8, hp: 7, damage: 32, scale: 1.6,  color: 0xaa00ff, reward: 350, attackRate: 1.8 },
}

function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export class Enemy {
  readonly type: EnemyType
  readonly position = new THREE.Vector3()
  readonly mesh: THREE.Group
  hp: number
  isDead = false
  readonly brain: NeuralBrain

  private cfg: Cfg
  private atkCd    = 0
  private bob      = 0
  private spawnT   = 0
  private aliveT   = 0
  private walkBlend= 0
  private atkAnimT = 0

  private bodyMat: THREE.MeshStandardMaterial
  private headMesh: THREE.Mesh
  private leftArmPivot:  THREE.Group
  private rightArmPivot: THREE.Group
  private leftLegPivot:  THREE.Group
  private rightLegPivot: THREE.Group

  constructor(scene: THREE.Scene, spawn: THREE.Vector3, type: EnemyType, brain: NeuralBrain) {
    this.type   = type
    this.cfg    = CFGS[type]
    this.hp     = this.cfg.hp
    this.brain  = brain
    this.position.copy(spawn)

    this.mesh = new THREE.Group()
    this.mesh.scale.setScalar(0)
    const s = this.cfg.scale

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.6,
      roughness: 0.35,
      metalness: 0.45,
    })

    // Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.76 * s, 1.1 * s, 0.5 * s), this.bodyMat)
    body.position.y = 0.75 * s
    body.castShadow = true
    this.mesh.add(body)

    // Glow chest strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 * s, 0.07 * s, 0.52 * s),
      new THREE.MeshStandardMaterial({ color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: 3 })
    )
    strip.position.set(0, 1.0 * s, 0)
    this.mesh.add(strip)

    // Head
    const headMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.9,
    })
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 8, 8), headMat)
    this.headMesh.position.y = (1.35 + 0.27) * s
    this.headMesh.castShadow = true
    this.mesh.add(this.headMesh)

    // Arms
    const armGeo = new THREE.BoxGeometry(0.21 * s, 0.62 * s, 0.21 * s)
    this.leftArmPivot  = new THREE.Group(); this.leftArmPivot.position.set(-0.48 * s, 1.26 * s, 0)
    this.rightArmPivot = new THREE.Group(); this.rightArmPivot.position.set( 0.48 * s, 1.26 * s, 0)
    for (const piv of [this.leftArmPivot, this.rightArmPivot]) {
      const arm = new THREE.Mesh(armGeo.clone(), this.bodyMat); arm.position.y = -0.31 * s; arm.castShadow = true
      piv.add(arm); this.mesh.add(piv)
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25 * s, 0.65 * s, 0.25 * s)
    this.leftLegPivot  = new THREE.Group(); this.leftLegPivot.position.set(-0.2 * s, 0.3 * s, 0)
    this.rightLegPivot = new THREE.Group(); this.rightLegPivot.position.set( 0.2 * s, 0.3 * s, 0)
    for (const piv of [this.leftLegPivot, this.rightLegPivot]) {
      const leg = new THREE.Mesh(legGeo.clone(), this.bodyMat); leg.position.y = -0.325 * s; leg.castShadow = true
      piv.add(leg); this.mesh.add(piv)
    }

    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number, target: THREE.Vector3, waveNum: number, nearbyCount: number): number {
    if (this.isDead) return 0

    this.aliveT += dt
    this.atkCd = Math.max(0, this.atkCd - dt)

    // Spawn pop-in
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 5)
      this.mesh.scale.setScalar(Math.max(0, easeOutBack(this.spawnT)))
    }

    const toTarget = new THREE.Vector3().subVectors(target, this.position)
    toTarget.y = 0
    const dist = toTarget.length()
    const dirNorm = toTarget.clone().normalize()

    // Neural network decision
    const inputs = [
      Math.min(dist, 40) / 40,
      (Math.atan2(dirNorm.x, dirNorm.z) / Math.PI + 1) * 0.5,
      Math.min(waveNum, 10) / 10,
      this.hp / this.cfg.hp,
      Math.min(nearbyCount, 6) / 6,
    ]
    const [aggression, circleTend, zigzag] = this.brain.forward(inputs)

    // Effective engage distance (cautious brains hang back)
    const engageDist = 1.4 + (1 - aggression) * 8

    const moving = dist > engageDist
    if (moving) {
      this.position.addScaledVector(dirNorm, this.cfg.speed * dt)

      // Circling behaviour
      if (circleTend > 0.55 && dist < 18) {
        const perp = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x)
        const dir  = circleTend > 0.75 ? 1 : -1
        this.position.addScaledVector(perp, dir * this.cfg.speed * 0.55 * dt)
      }

      // Zigzag approach
      if (zigzag > 0.60) {
        const perp = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x)
        this.position.addScaledVector(perp, Math.sin(this.aliveT * 5.5) * this.cfg.speed * 0.35 * dt)
      }
    }

    // Bob & animation
    this.bob += dt * this.cfg.speed * 2.8
    const walkTarget = moving ? 1 : 0
    this.walkBlend += (walkTarget - this.walkBlend) * Math.min(1, dt * 9)

    const swing = Math.sin(this.bob) * 0.85 * this.walkBlend
    this.leftArmPivot.rotation.x  =  swing
    this.rightArmPivot.rotation.x = -swing
    this.leftLegPivot.rotation.x  = -swing
    this.rightLegPivot.rotation.x  =  swing

    // Attack animation (arms lunge forward)
    if (this.atkAnimT > 0) {
      this.atkAnimT = Math.max(0, this.atkAnimT - dt / 0.22)
      const arc = Math.sin(this.atkAnimT * Math.PI)
      this.leftArmPivot.rotation.x  = -arc * 1.6
      this.rightArmPivot.rotation.x = -arc * 1.6
    }

    // Telegraph: pulse emissive before attacking
    if (this.atkCd < 0.25 && this.atkCd > 0) {
      this.bodyMat.emissiveIntensity = 1.8 + Math.sin(this.aliveT * 30) * 0.8
    } else if (!this.isDead) {
      this.bodyMat.emissiveIntensity = 0.6
    }

    // Body bob
    this.mesh.position.copy(this.position)
    this.mesh.position.y = Math.abs(Math.sin(this.bob)) * 0.12 * this.walkBlend
    this.mesh.lookAt(new THREE.Vector3(target.x, this.position.y, target.z))

    if (dist < 1.4 && this.atkCd <= 0) {
      this.atkCd    = this.cfg.attackRate
      this.atkAnimT = 1.0
      return this.cfg.damage
    }
    return 0
  }

  takeDamage(amount: number, headshot = false): boolean {
    this.hp -= headshot ? amount * 2 : amount
    this.bodyMat.emissiveIntensity = 4.0
    setTimeout(() => { if (!this.isDead) this.bodyMat.emissiveIntensity = 0.6 }, 80)
    if (this.hp <= 0) {
      this.isDead = true
      this.mesh.visible = false
      return true
    }
    return false
  }

  remove(scene: THREE.Scene) { scene.remove(this.mesh) }

  headWorldPos(): THREE.Vector3 { return this.headMesh.getWorldPosition(new THREE.Vector3()) }

  get aliveTime() { return this.aliveT }
  get color()     { return this.cfg.color }
  get scale()     { return this.cfg.scale }
  get reward()    { return this.cfg.reward }
}
