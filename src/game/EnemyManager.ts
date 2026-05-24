import * as THREE from 'three'
import { Enemy, type EnemyType } from './Enemy'
import { BrainPool } from './NeuralBrain'

interface Projectile {
  pos: THREE.Vector3
  vel: THREE.Vector3
  mesh: THREE.Mesh
  age: number
  damage: number
}

export class EnemyManager {
  private list: Enemy[] = []
  private pool = new BrainPool(20)
  private currentWave = 1
  private projectiles: Projectile[] = []

  constructor(private scene: THREE.Scene) {}

  spawnWave(wave: number, playerPos: THREE.Vector3): boolean {
    this.currentWave = wave

    // Boss every 5 waves
    if (wave % 5 === 0) {
      const boss = new Enemy(this.scene, this.randomSpawnPos(playerPos, 28, 34), 'boss', this.pool.next())
      this.list.push(boss)
      return true  // is boss wave
    }

    const base         = 5 + wave * 2
    const heavyChance  = Math.min(0.05 * (wave - 2), 0.30)
    const rusherChance = 0.35 + Math.min(wave * 0.05, 0.25)
    const sniperChance = wave >= 2 ? Math.min(wave * 0.03, 0.15) : 0
    const shielderChance = wave >= 3 ? Math.min((wave - 2) * 0.04, 0.12) : 0
    const summonerChance = wave >= 4 ? Math.min((wave - 3) * 0.03, 0.08) : 0

    for (let i = 0; i < base; i++) {
      const r = Math.random()
      let type: EnemyType
      if (r < summonerChance)                             type = 'summoner'
      else if (r < summonerChance + shielderChance)       type = 'shielder'
      else if (r < summonerChance + shielderChance + sniperChance) type = 'sniper'
      else if (wave >= 3 && r < heavyChance + 0.1)        type = 'heavy'
      else if (r < rusherChance + 0.2)                    type = 'rusher'
      else                                                 type = 'grunt'

      this.list.push(new Enemy(this.scene, this.randomSpawnPos(playerPos), type, this.pool.next()))
    }
    return false
  }

  private randomSpawnPos(playerPos: THREE.Vector3, minR = 22, maxR = 34): THREE.Vector3 {
    const angle  = Math.random() * Math.PI * 2
    const radius = minR + Math.random() * (maxR - minR)
    return new THREE.Vector3(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius,
    )
  }

  update(dt: number, targetPos: THREE.Vector3): number {
    let dmg = 0
    const dead: Enemy[] = []
    const alive = this.list.filter(e => !e.isDead)
    const lodThreshold = 20  // skip full animation for enemies beyond this count

    // Summoner buff map
    const buffMap = new Map<Enemy, number>()
    for (const e of alive) {
      if (e.isSummoner) {
        for (const other of alive) {
          if (other !== e && other.position.distanceTo(e.position) < 12) {
            buffMap.set(other, (buffMap.get(other) ?? 1.0) * 1.35)
          }
        }
      }
    }

    // Nearby count per enemy
    const nearbyMap = new Map<Enemy, number>()
    for (const e of alive) {
      let cnt = 0
      for (const o of alive) { if (o !== e && e.position.distanceTo(o.position) < 12) cnt++ }
      nearbyMap.set(e, cnt)
    }

    // Rusher flocking: if 3+ rushers near player, spread them out
    const rushersNearPlayer = alive.filter(e => e.type === 'rusher' && e.position.distanceTo(targetPos) < 16)
    if (rushersNearPlayer.length >= 3) {
      rushersNearPlayer.forEach((r, idx) => {
        const angle = (idx / rushersNearPlayer.length) * Math.PI * 2
        const flockPerp = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
        r.position.addScaledVector(flockPerp, 2.2 * dt)
      })
    }

    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i]
      if (e.isDead) { dead.push(e); continue }
      const skipAnim = alive.length > lodThreshold && i > 12
      dmg += e.update(dt, targetPos, this.currentWave, nearbyMap.get(e) ?? 0, buffMap.get(e) ?? 1.0, skipAnim)

      // Collect pending ranged shots
      if (e.pendingShot) {
        this.spawnProjectile(e.pendingShot.from, targetPos, e.pendingShot.damage)
        e.pendingShot = null
      }
    }

    for (const e of dead) {
      this.pool.recordFitness(e.brain, e.aliveTime, false)
      e.remove(this.scene)
      this.list = this.list.filter(x => x !== e)
    }

    // Update projectiles
    const hitDmg = this.updateProjectiles(dt, targetPos)
    dmg += hitDmg

    return dmg
  }

  private spawnProjectile(from: THREE.Vector3, to: THREE.Vector3, damage: number) {
    const vel = new THREE.Vector3().subVectors(to, from).normalize().multiplyScalar(20)
    const geo = new THREE.SphereGeometry(0.12, 6, 6)
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 3 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(from)
    this.scene.add(mesh)
    this.projectiles.push({ pos: from.clone(), vel, mesh, age: 0, damage })
  }

  private updateProjectiles(dt: number, playerPos: THREE.Vector3): number {
    let dmg = 0
    this.projectiles = this.projectiles.filter(p => {
      p.age += dt
      p.pos.addScaledVector(p.vel, dt)
      p.mesh.position.copy(p.pos)

      if (p.age > 5 || p.pos.y < -2) {
        this.scene.remove(p.mesh)
        return false
      }
      if (p.pos.distanceTo(playerPos.clone().setY(1.0)) < 0.9) {
        dmg += p.damage
        this.scene.remove(p.mesh)
        return false
      }
      return true
    })
    return dmg
  }

  recordKill(enemy: Enemy) {
    this.pool.recordFitness(enemy.brain, enemy.aliveTime, true)
  }

  evolvePool() {
    for (const e of this.list) {
      if (!e.isDead) this.pool.recordFitness(e.brain, e.aliveTime, false)
    }
    this.pool.evolve()
  }

  getBoss(): Enemy | null {
    return this.list.find(e => e.isBoss && !e.isDead) ?? null
  }

  getSummoners(): Enemy[] {
    return this.list.filter(e => e.isSummoner && !e.isDead)
  }

  get all()   { return this.list }
  get count() { return this.list.filter(e => !e.isDead).length }

  closest(pos: THREE.Vector3): { enemy: Enemy; dist: number } | null {
    let best: Enemy | null = null; let bd = Infinity
    for (const e of this.list) {
      if (e.isDead) continue
      const d = e.position.distanceTo(pos)
      if (d < bd) { bd = d; best = e }
    }
    return best ? { enemy: best, dist: bd } : null
  }

  clear() {
    for (const e of this.list) e.remove(this.scene)
    this.list = []
    for (const p of this.projectiles) this.scene.remove(p.mesh)
    this.projectiles = []
  }
}
