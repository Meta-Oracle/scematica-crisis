import * as THREE from 'three'
import { Enemy, type EnemyType } from './Enemy'

export class EnemyManager {
  private list: Enemy[] = []

  constructor(private scene: THREE.Scene) {}

  spawnWave(wave: number, playerPos: THREE.Vector3) {
    const base         = 4 + wave * 2
    const heavyChance  = Math.min(0.05 * (wave - 2), 0.3)
    const rusherChance = 0.3 + Math.min(wave * 0.04, 0.25)

    for (let i = 0; i < base; i++) {
      const r = Math.random()
      let type: EnemyType
      if (wave >= 3 && r < heavyChance)        type = 'heavy'
      else if (r < rusherChance)                type = 'rusher'
      else                                      type = 'grunt'
      this.list.push(new Enemy(this.scene, this.randomSpawnPos(playerPos), type))
    }
  }

  private randomSpawnPos(playerPos: THREE.Vector3): THREE.Vector3 {
    const angle  = Math.random() * Math.PI * 2
    const radius = 24 + Math.random() * 14
    return new THREE.Vector3(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius,
    )
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
