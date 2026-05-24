import * as THREE from 'three'
import { Enemy, type EnemyType } from './Enemy'
import { BrainPool } from './NeuralBrain'

export class EnemyManager {
  private list: Enemy[] = []
  private pool = new BrainPool(20)
  private currentWave = 1

  constructor(private scene: THREE.Scene) {}

  spawnWave(wave: number, playerPos: THREE.Vector3) {
    this.currentWave = wave
    const base         = 5 + wave * 2
    const heavyChance  = Math.min(0.05 * (wave - 2), 0.35)
    const rusherChance = 0.35 + Math.min(wave * 0.05, 0.3)

    for (let i = 0; i < base; i++) {
      const r = Math.random()
      let type: EnemyType
      if (wave >= 3 && r < heavyChance)        type = 'heavy'
      else if (r < rusherChance)                type = 'rusher'
      else                                      type = 'grunt'
      const brain = this.pool.next()
      this.list.push(new Enemy(this.scene, this.randomSpawnPos(playerPos), type, brain))
    }
  }

  private randomSpawnPos(playerPos: THREE.Vector3): THREE.Vector3 {
    const angle  = Math.random() * Math.PI * 2
    const radius = 22 + Math.random() * 12
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

    // Compute nearby-ally count per enemy for neural inputs
    const nearbyMap = new Map<Enemy, number>()
    for (const e of alive) {
      let cnt = 0
      for (const o of alive) {
        if (o !== e && e.position.distanceTo(o.position) < 12) cnt++
      }
      nearbyMap.set(e, cnt)
    }

    for (const e of this.list) {
      if (e.isDead) { dead.push(e); continue }
      dmg += e.update(dt, targetPos, this.currentWave, nearbyMap.get(e) ?? 0)
    }

    for (const e of dead) {
      this.pool.recordFitness(e.brain, e.aliveTime, false)
      e.remove(this.scene)
      this.list = this.list.filter(x => x !== e)
    }

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

  get all()   { return this.list }
  get count() { return this.list.filter(e => !e.isDead).length }

  closest(pos: THREE.Vector3): { enemy: Enemy; dist: number } | null {
    let best: Enemy | null = null
    let bd = Infinity
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
  }
}
