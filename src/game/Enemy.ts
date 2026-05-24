import * as THREE from 'three'

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
  grunt:  { speed: 3.0, hp: 2, damage: 10, scale: 1.0,  color: 0xff2222, reward: 100, attackRate: 1.2 },
  rusher: { speed: 6.5, hp: 1, damage: 6,  scale: 0.75, color: 0xff8800, reward: 150, attackRate: 0.8 },
  heavy:  { speed: 1.8, hp: 6, damage: 28, scale: 1.6,  color: 0xaa00ff, reward: 350, attackRate: 2.0 },
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

  private cfg: Cfg
  private atkCd = 0
  private bob = 0
  private spawnT = 0
  private walkBlend = 0

  private bodyMat: THREE.MeshStandardMaterial
  private headMesh: THREE.Mesh
  private leftArmPivot!: THREE.Group
  private rightArmPivot!: THREE.Group
  private leftLegPivot!: THREE.Group
  private rightLegPivot!: THREE.Group

  constructor(scene: THREE.Scene, spawn: THREE.Vector3, type: EnemyType) {
    this.type = type
    this.cfg = CFGS[type]
    this.hp = this.cfg.hp
    this.position.copy(spawn)

    this.mesh = new THREE.Group()
    this.mesh.scale.setScalar(0)
    const s = this.cfg.scale

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.4,
    })

    // Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 1.1 * s, 0.5 * s), this.bodyMat)
    body.position.y = 0.75 * s
    body.castShadow = true
    this.mesh.add(body)

    // Head
    const headMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.7,
    })
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 8, 8), headMat)
    this.headMesh.position.y = (1.35 + 0.26) * s
    this.headMesh.castShadow = true
    this.mesh.add(this.headMesh)

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2 * s, 0.6 * s, 0.2 * s)
    const lArmPivot = new THREE.Group()
    lArmPivot.position.set(-0.475 * s, 1.25 * s, 0)
    const lArmMesh = new THREE.Mesh(armGeo, this.bodyMat)
    lArmMesh.position.y = -0.3 * s
    lArmMesh.castShadow = true
    lArmPivot.add(lArmMesh)
    this.mesh.add(lArmPivot)
    this.leftArmPivot = lArmPivot

    const rArmPivot = new THREE.Group()
    rArmPivot.position.set(0.475 * s, 1.25 * s, 0)
    const rArmMesh = new THREE.Mesh(armGeo.clone(), this.bodyMat)
    rArmMesh.position.y = -0.3 * s
    rArmMesh.castShadow = true
    rArmPivot.add(rArmMesh)
    this.mesh.add(rArmPivot)
    this.rightArmPivot = rArmPivot

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24 * s, 0.62 * s, 0.24 * s)
    const lLegPivot = new THREE.Group()
    lLegPivot.position.set(-0.19 * s, 0.3 * s, 0)
    const lLegMesh = new THREE.Mesh(legGeo, this.bodyMat)
    lLegMesh.position.y = -0.31 * s
    lLegMesh.castShadow = true
    lLegPivot.add(lLegMesh)
    this.mesh.add(lLegPivot)
    this.leftLegPivot = lLegPivot

    const rLegPivot = new THREE.Group()
    rLegPivot.position.set(0.19 * s, 0.3 * s, 0)
    const rLegMesh = new THREE.Mesh(legGeo.clone(), this.bodyMat)
    rLegMesh.position.y = -0.31 * s
    rLegMesh.castShadow = true
    rLegPivot.add(rLegMesh)
    this.mesh.add(rLegPivot)
    this.rightLegPivot = rLegPivot

    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number, target: THREE.Vector3): number {
    if (this.isDead) return 0

    // Spawn pop-in animation
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 5)
      const sc = Math.max(0, easeOutBack(this.spawnT))
      this.mesh.scale.setScalar(sc)
    }

    this.atkCd = Math.max(0, this.atkCd - dt)

    const toTarget = new THREE.Vector3().subVectors(target, this.position)
    toTarget.y = 0
    const dist = toTarget.length()

    const moving = dist > 1.4
    if (moving) {
      toTarget.normalize()
      this.position.addScaledVector(toTarget, this.cfg.speed * dt)
    }

    // Bob / step oscillator
    this.bob += dt * this.cfg.speed * 2.8

    // Walk blend
    const targetBlend = moving ? 1 : 0
    this.walkBlend += (targetBlend - this.walkBlend) * Math.min(1, dt * 10)

    // Limb animation
    const swing = Math.sin(this.bob) * 0.6 * this.walkBlend
    this.leftArmPivot.rotation.x  =  swing
    this.rightArmPivot.rotation.x = -swing
    this.leftLegPivot.rotation.x  = -swing
    this.rightLegPivot.rotation.x  =  swing

    // Vertical bob
    this.mesh.position.copy(this.position)
    this.mesh.position.y = Math.abs(Math.sin(this.bob)) * 0.1 * this.walkBlend
    this.mesh.lookAt(new THREE.Vector3(target.x, this.position.y, target.z))

    if (dist < 1.4 && this.atkCd <= 0) {
      // Idle sway when attacking
      this.leftArmPivot.rotation.x  = Math.sin(this.bob * 0.5) * 0.2
      this.rightArmPivot.rotation.x = Math.sin(this.bob * 0.5 + Math.PI) * 0.2
      this.atkCd = this.cfg.attackRate
      return this.cfg.damage
    }
    return 0
  }

  takeDamage(amount: number, headshot = false): boolean {
    this.hp -= headshot ? amount * 2 : amount
    this.bodyMat.emissiveIntensity = 2.8
    setTimeout(() => { if (!this.isDead) this.bodyMat.emissiveIntensity = 0.5 }, 90)
    if (this.hp <= 0) {
      this.isDead = true
      this.mesh.visible = false  // hide immediately; ragdoll takes over
      return true
    }
    return false
  }

  remove(scene: THREE.Scene) {
    scene.remove(this.mesh)
  }

  headWorldPos(): THREE.Vector3 {
    return this.headMesh.getWorldPosition(new THREE.Vector3())
  }

  get color()  { return this.cfg.color }
  get scale()  { return this.cfg.scale }
  get reward() { return this.cfg.reward }
}
