import * as THREE from 'three'
import { NeuralBrain } from './NeuralBrain'

export type EnemyType = 'grunt' | 'rusher' | 'heavy' | 'sniper' | 'shielder' | 'summoner' | 'boss'

interface Cfg {
  speed: number; hp: number; damage: number; scale: number
  color: number; reward: number; attackRate: number
  ranged?: boolean   // sniper fires projectiles instead of melee
  summoner?: boolean // aura buff instead of direct attack
  shielder?: boolean // frontal damage reduction
  boss?: boolean
}

const CFGS: Record<EnemyType, Cfg> = {
  grunt:    { speed: 4.8,  hp: 2,   damage: 10, scale: 1.0,  color: 0xff2222, reward: 100,  attackRate: 1.1 },
  rusher:   { speed: 9.2,  hp: 1,   damage: 7,  scale: 0.75, color: 0xff8800, reward: 150,  attackRate: 0.7 },
  heavy:    { speed: 2.8,  hp: 7,   damage: 32, scale: 1.6,  color: 0xaa00ff, reward: 350,  attackRate: 1.8 },
  sniper:   { speed: 6.5,  hp: 1,   damage: 18, scale: 0.82, color: 0x00ffaa, reward: 200,  attackRate: 2.8, ranged: true },
  shielder: { speed: 2.2,  hp: 12,  damage: 28, scale: 1.45, color: 0x3366ff, reward: 300,  attackRate: 2.0, shielder: true },
  summoner: { speed: 3.2,  hp: 4,   damage: 0,  scale: 1.1,  color: 0xffaa00, reward: 450,  attackRate: 0 , summoner: true },
  boss:     { speed: 3.4,  hp: 80,  damage: 45, scale: 2.6,  color: 0xff00cc, reward: 2000, attackRate: 2.0, boss: true },
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
  readonly maxHp: number
  isDead = false
  readonly brain: NeuralBrain

  // Shot request: EnemyManager reads and clears this
  pendingShot: { from: THREE.Vector3; damage: number } | null = null

  private cfg: Cfg
  private atkCd    = 0
  private bob      = 0
  private spawnT   = 0
  private aliveT   = 0
  private walkBlend= 0
  private atkAnimT = 0

  // Stagger (parry result)
  private staggerT = 0
  // Airborne (knockback from devastate/whirlwind)
  private airborneT = 0
  private airborneVel = new THREE.Vector3()
  // Boss phase
  private bossPhase = 1

  private bodyMat: THREE.MeshStandardMaterial
  private headMesh: THREE.Mesh
  private leftArmPivot:  THREE.Group
  private rightArmPivot: THREE.Group
  private leftLegPivot:  THREE.Group
  private rightLegPivot: THREE.Group

  // Summoner aura ring
  private auraMesh?: THREE.Mesh

  constructor(scene: THREE.Scene, spawn: THREE.Vector3, type: EnemyType, brain: NeuralBrain) {
    this.type  = type
    this.cfg   = CFGS[type]
    this.hp    = this.cfg.hp
    this.maxHp = this.cfg.hp
    this.brain = brain
    this.position.copy(spawn)

    this.mesh = new THREE.Group()
    this.mesh.scale.setScalar(0)
    const s = this.cfg.scale

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color, emissive: this.cfg.color,
      emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.45,
    })

    // Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.76 * s, 1.1 * s, 0.5 * s), this.bodyMat)
    body.position.y = 0.75 * s; body.castShadow = true; this.mesh.add(body)

    // Glow strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 * s, 0.07 * s, 0.52 * s),
      new THREE.MeshStandardMaterial({ color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: 3 })
    )
    strip.position.set(0, 1.0 * s, 0); this.mesh.add(strip)

    // Shielder frontal shield plate
    if (this.cfg.shielder) {
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x2244ff, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.9 })
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.2 * s, 0.1 * s), shieldMat)
      shield.position.set(0, 0.75 * s, 0.32 * s); this.mesh.add(shield)
    }

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: this.cfg.color, emissive: this.cfg.color, emissiveIntensity: 0.9 })
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 8, 8), headMat)
    this.headMesh.position.y = (1.35 + 0.27) * s; this.headMesh.castShadow = true; this.mesh.add(this.headMesh)

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

    // Summoner aura ring
    if (this.cfg.summoner) {
      this.auraMesh = new THREE.Mesh(
        new THREE.TorusGeometry(12, 0.12, 6, 48),
        new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.5, transparent: true, opacity: 0.4 })
      )
      this.auraMesh.rotation.x = -Math.PI / 2
      this.auraMesh.position.y = 0.05
      scene.add(this.auraMesh)
    }

    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number, target: THREE.Vector3, waveNum: number, nearbyCount: number, speedBuff = 1.0, skipAnim = false): number {
    if (this.isDead) return 0

    this.aliveT += dt
    this.atkCd   = Math.max(0, this.atkCd - dt)
    this.staggerT = Math.max(0, this.staggerT - dt)

    // Spawn pop-in
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 5)
      this.mesh.scale.setScalar(Math.max(0, easeOutBack(this.spawnT)))
    }

    // Stagger: can't move or attack
    if (this.staggerT > 0) {
      this.mesh.position.copy(this.position)
      const shake = Math.sin(this.aliveT * 40) * 0.04
      this.mesh.position.x += shake
      return 0
    }

    // Airborne (knocked back)
    if (this.airborneT > 0) {
      this.airborneT = Math.max(0, this.airborneT - dt)
      this.airborneVel.y -= 22 * dt
      this.position.addScaledVector(this.airborneVel, dt)
      if (this.position.y <= 0) {
        this.position.y = 0
        this.airborneVel.set(0, 0, 0)
        this.airborneT = 0
      }
      this.mesh.position.copy(this.position)
      return 0
    }

    const toTarget = new THREE.Vector3().subVectors(target, this.position)
    toTarget.y = 0
    const dist = toTarget.length()
    const dirNorm = toTarget.clone().normalize()

    // Neural inputs
    const inputs = [
      Math.min(dist, 40) / 40,
      (Math.atan2(dirNorm.x, dirNorm.z) / Math.PI + 1) * 0.5,
      Math.min(waveNum, 10) / 10,
      this.hp / this.maxHp,
      Math.min(nearbyCount, 6) / 6,
    ]
    const [aggression, circleTend, zigzag] = this.brain.forward(inputs)

    // Boss phase transitions
    if (this.cfg.boss) {
      const hpFrac = this.hp / this.maxHp
      if (hpFrac < 0.33 && this.bossPhase < 3)      this.bossPhase = 3
      else if (hpFrac < 0.66 && this.bossPhase < 2) this.bossPhase = 2
      speedBuff *= this.bossPhase === 3 ? 2.2 : this.bossPhase === 2 ? 1.5 : 1.0
    }

    // Sniper: keeps distance, fires at range
    let moving: boolean
    if (this.cfg.ranged) {
      const idealDist = 20 + aggression * 10
      moving = dist < idealDist - 2 ? false : dist > idealDist + 3
      // Move away if too close
      if (dist < 12) {
        this.position.addScaledVector(dirNorm, -this.cfg.speed * speedBuff * dt)
        moving = false
      } else if (moving) {
        this.position.addScaledVector(dirNorm, this.cfg.speed * speedBuff * dt)
      }
      // Fire at range
      if (dist < 35 && dist > 8 && this.atkCd <= 0) {
        this.atkCd = this.cfg.attackRate
        this.pendingShot = { from: this.position.clone().setY(1.2 * this.cfg.scale), damage: this.cfg.damage }
      }
    } else {
      const engageDist = 1.4 + (1 - aggression) * 8
      moving = dist > engageDist
      if (moving) {
        this.position.addScaledVector(dirNorm, this.cfg.speed * speedBuff * dt)
        if (circleTend > 0.55 && dist < 18) {
          const perp = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x)
          this.position.addScaledVector(perp, (circleTend > 0.75 ? 1 : -1) * this.cfg.speed * speedBuff * 0.55 * dt)
        }
        if (zigzag > 0.60) {
          const perp = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x)
          this.position.addScaledVector(perp, Math.sin(this.aliveT * 5.5) * this.cfg.speed * speedBuff * 0.35 * dt)
        }
      }
    }

    // Summoner: update aura ring position
    if (this.auraMesh) {
      this.auraMesh.position.set(this.position.x, 0.05, this.position.z)
      const pulse = 1 + Math.sin(this.aliveT * 3) * 0.08
      this.auraMesh.scale.setScalar(pulse)
    }

    // Animation
    if (!skipAnim) {
      this.bob += dt * this.cfg.speed * 2.8
      const walkTarget = moving ? 1 : 0
      this.walkBlend += (walkTarget - this.walkBlend) * Math.min(1, dt * 9)
      const swing = Math.sin(this.bob) * 0.85 * this.walkBlend
      this.leftArmPivot.rotation.x  =  swing
      this.rightArmPivot.rotation.x = -swing
      this.leftLegPivot.rotation.x  = -swing
      this.rightLegPivot.rotation.x =  swing

      if (this.atkAnimT > 0) {
        this.atkAnimT = Math.max(0, this.atkAnimT - dt / 0.22)
        const arc = Math.sin(this.atkAnimT * Math.PI)
        this.leftArmPivot.rotation.x  = -arc * 1.8
        this.rightArmPivot.rotation.x = -arc * 1.8
      }

      if (this.atkCd < 0.28 && this.atkCd > 0 && !this.cfg.ranged) {
        this.bodyMat.emissiveIntensity = 2.0 + Math.sin(this.aliveT * 30) * 0.9
      } else if (this.cfg.boss) {
        this.bodyMat.emissiveIntensity = 0.8 + Math.sin(this.aliveT * 4) * 0.3 * this.bossPhase
      } else {
        this.bodyMat.emissiveIntensity = 0.6
      }
    }

    this.mesh.position.copy(this.position)
    this.mesh.position.y = Math.abs(Math.sin(this.bob)) * 0.12 * this.walkBlend + this.position.y
    this.mesh.lookAt(new THREE.Vector3(target.x, this.position.y, target.z))

    // Melee attack
    if (!this.cfg.ranged && !this.cfg.summoner && dist < 1.4 * this.cfg.scale && this.atkCd <= 0) {
      this.atkCd    = this.cfg.attackRate * (this.cfg.boss && this.bossPhase === 3 ? 0.45 : 1)
      this.atkAnimT = 1.0
      return this.cfg.damage
    }
    return 0
  }

  takeDamage(amount: number, headshot = false, fromBehind = false): boolean {
    let dmg = headshot ? amount * 2 : amount
    if (this.cfg.shielder && !fromBehind) dmg *= 0.25
    this.hp -= dmg
    this.bodyMat.emissiveIntensity = 4.5
    setTimeout(() => { if (!this.isDead) this.bodyMat.emissiveIntensity = this.cfg.boss ? 0.8 : 0.6 }, 80)
    if (this.hp <= 0) {
      this.isDead = true
      this.mesh.visible = false
      if (this.auraMesh) this.auraMesh.visible = false
      return true
    }
    return false
  }

  knockback(dir: THREE.Vector3, force: number) {
    this.airborneT = 0.7
    this.airborneVel.copy(dir).multiplyScalar(force)
    this.airborneVel.y = force * 0.5
  }

  stagger(duration: number) { this.staggerT = duration }

  remove(scene: THREE.Scene) {
    scene.remove(this.mesh)
    if (this.auraMesh) scene.remove(this.auraMesh)
  }

  headWorldPos(): THREE.Vector3 { return this.headMesh.getWorldPosition(new THREE.Vector3()) }

  get inTelegraph():  boolean { return this.atkCd > 0 && this.atkCd < 0.32 && !this.cfg.ranged }
  get isExecutable(): boolean { return !this.isDead && this.hp / this.maxHp < 0.18 && this.staggerT <= 0 }
  get isAirborne():   boolean { return this.airborneT > 0 }
  get bossHealthFrac(): number { return this.hp / this.maxHp }
  get currentBossPhase(): number { return this.bossPhase }
  get aliveTime()  { return this.aliveT }
  get color()      { return this.cfg.color }
  get scale()      { return this.cfg.scale }
  get reward()     { return this.cfg.reward }
  get isSummoner() { return !!this.cfg.summoner }
  get isBoss()     { return !!this.cfg.boss }
}
