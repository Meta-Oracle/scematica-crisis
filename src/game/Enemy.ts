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
  grunt:  { speed: 3.0, hp: 2, damage: 10, scale: 1.0, color: 0xff2222, reward: 100, attackRate: 1.2 },
  rusher: { speed: 6.5, hp: 1, damage: 6,  scale: 0.75, color: 0xff8800, reward: 150, attackRate: 0.8 },
  heavy:  { speed: 1.8, hp: 6, damage: 28, scale: 1.6, color: 0xaa00ff, reward: 350, attackRate: 2.0 },
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
  private bodyMat: THREE.MeshStandardMaterial
  private headMesh: THREE.Mesh

  constructor(scene: THREE.Scene, spawn: THREE.Vector3, type: EnemyType) {
    this.type = type
    this.cfg = CFGS[type]
    this.hp = this.cfg.hp
    this.position.copy(spawn)

    this.mesh = new THREE.Group()
    const s = this.cfg.scale

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.4,
    })

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 1.3 * s, 0.5 * s), this.bodyMat)
    body.position.y = 0.75 * s
    body.castShadow = true
    this.mesh.add(body)

    const headMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      emissive: this.cfg.color,
      emissiveIntensity: 0.7,
    })
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 8, 8), headMat)
    this.headMesh.position.y = (1.4 + 0.26) * s
    this.headMesh.castShadow = true
    this.mesh.add(this.headMesh)

    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number, target: THREE.Vector3): number {
    if (this.isDead) return 0
    this.atkCd = Math.max(0, this.atkCd - dt)

    const toTarget = new THREE.Vector3().subVectors(target, this.position)
    toTarget.y = 0
    const dist = toTarget.length()

    if (dist > 1.4) {
      toTarget.normalize()
      this.position.addScaledVector(toTarget, this.cfg.speed * dt)
    }

    this.bob += dt * this.cfg.speed * 2.5
    this.mesh.position.copy(this.position)
    this.mesh.position.y = Math.abs(Math.sin(this.bob)) * 0.12
    this.mesh.lookAt(new THREE.Vector3(target.x, this.position.y, target.z))

    if (dist < 1.4 && this.atkCd <= 0) {
      this.atkCd = this.cfg.attackRate
      return this.cfg.damage
    }
    return 0
  }

  takeDamage(amount: number, headshot = false): boolean {
    this.hp -= headshot ? amount * 2 : amount
    this.bodyMat.emissiveIntensity = 2.5
    setTimeout(() => {
      if (!this.isDead) this.bodyMat.emissiveIntensity = 0.5
    }, 90)
    if (this.hp <= 0) {
      this.isDead = true
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

  get reward() { return this.cfg.reward }
}
