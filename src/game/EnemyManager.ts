import * as THREE from 'three'
import { Enemy, type EnemyType } from './Enemy'
import { ARENA_HALF } from './Arena'

const SPAWN_PAD = 1.5

export class EnemyManager {
  private list: Enemy[] = []

  constructor(private scene: THREE.Scene) {}

  spawnWave(wave: number) {
    const base = 4 + wave * 2
    const heavyChance = Math.min(0.05 * (wave - 2), 0.3)
    const rusherChance = 0.3 + Math.min(wave * 0.04, 0.25)

    for (let i = 0; i < base; i++) {
      const r = Math.random()
      let type: EnemyType
      if (wave >= 3 && r < heavyChance) type = 'heavy'
      else if (r < rusherChance) type = 'rusher'
      else type = 'grunt'
      this.list.push(new Enemy(this.scene, this.randomEdgePos(), type))
    }
  }

  private randomEdgePos(): THREE.Vector3 {
    const side = Math.floor(Math.random() * 4)
    const d = ARENA_HALF - SPAWN_PAD
    const spread = (Math.random() * 2 - 1) * (ARENA_HALF - SPAWN_PAD)
    const positions: THREE.Vector3[] = [
      new THREE.Vector3(spread, 0, -d),
      new THREE.Vector3(spread, 0,  d),
      new THREE.Vector3(-d, 0, spread),
      new THREE.Vector3( d, 0, spread),
    ]
    return positions[side]
  }

  update(dt: number, targetPos: THREE.Vector3): number {
    let dmg = 0
    const dead: Enemy[] = []

    for (const e of this.list) {
      if (e.isDead) { dead.push(e); continue }
      dmg += e.update(dt, targetPos)
    }

    for (const e of dead) {
      e.remove(this.scene)
      this.list = this.list.filter(x => x !== e)
    }

    return dmg
  }

  get all() { return this.list }

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
