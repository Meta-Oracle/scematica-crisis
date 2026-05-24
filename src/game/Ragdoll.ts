import * as THREE from 'three'

interface RagPart {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  angVel: THREE.Vector3
  age: number
  mat: THREE.MeshStandardMaterial
}

const GRAVITY = -22
const MAX_AGE = 3.8
const FADE_START = 2.6

export class RagdollSystem {
  private parts: RagPart[] = []

  constructor(private scene: THREE.Scene) {}

  spawnRagdoll(pos: THREE.Vector3, color: number, scale: number) {
    const s = scale
    const defs: { geo: THREE.BufferGeometry; off: THREE.Vector3 }[] = [
      { geo: new THREE.SphereGeometry(0.27 * s, 6, 6),              off: new THREE.Vector3(0,            1.7  * s, 0) },
      { geo: new THREE.BoxGeometry(0.75 * s, 1.0 * s, 0.5 * s),    off: new THREE.Vector3(0,            0.9  * s, 0) },
      { geo: new THREE.BoxGeometry(0.2  * s, 0.6 * s, 0.2 * s),    off: new THREE.Vector3(-0.52 * s,    1.05 * s, 0) },
      { geo: new THREE.BoxGeometry(0.2  * s, 0.6 * s, 0.2 * s),    off: new THREE.Vector3( 0.52 * s,    1.05 * s, 0) },
      { geo: new THREE.BoxGeometry(0.25 * s, 0.65 * s, 0.25 * s),  off: new THREE.Vector3(-0.2  * s,    0.32 * s, 0) },
      { geo: new THREE.BoxGeometry(0.25 * s, 0.65 * s, 0.25 * s),  off: new THREE.Vector3( 0.2  * s,    0.32 * s, 0) },
    ]

    for (const def of defs) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.55,
        metalness: 0.3,
      })
      const mesh = new THREE.Mesh(def.geo, mat)
      mesh.position.copy(pos).add(def.off)
      mesh.castShadow = true

      const outward = def.off.clone().normalize()
      const vel = new THREE.Vector3(
        outward.x * (2 + Math.random() * 5) + (Math.random() - 0.5) * 6,
        2.5 + Math.random() * 8,
        outward.z * (2 + Math.random() * 5) + (Math.random() - 0.5) * 6,
      )
      const angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      )

      this.scene.add(mesh)
      this.parts.push({ mesh, vel, angVel, age: 0, mat })
    }
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.age += dt

      if (p.age > MAX_AGE) {
        this.scene.remove(p.mesh)
        this.parts.splice(i, 1)
        continue
      }

      p.vel.y += GRAVITY * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.rotation.x += p.angVel.x * dt
      p.mesh.rotation.y += p.angVel.y * dt
      p.mesh.rotation.z += p.angVel.z * dt

      if (p.mesh.position.y < 0.06) {
        p.mesh.position.y = 0.06
        p.vel.y = Math.abs(p.vel.y) * 0.22
        p.vel.x *= 0.68
        p.vel.z *= 0.68
        p.angVel.multiplyScalar(0.5)
      }

      if (p.age > FADE_START) {
        p.mat.opacity = 1 - (p.age - FADE_START) / (MAX_AGE - FADE_START)
        p.mat.transparent = true
      }
    }
  }

  clear() {
    for (const p of this.parts) this.scene.remove(p.mesh)
    this.parts = []
  }
}
