import * as THREE from 'three'

const MAX = 1200
const GRAVITY = -14
const MAX_AGE = 1.4

export class DeathParticles {
  private geo: THREE.BufferGeometry
  private pos: Float32Array
  private vel: Float32Array
  private col: Float32Array
  private age: Float32Array
  private maxAge: Float32Array
  private cnt = 0

  constructor(private scene: THREE.Scene) {
    this.pos    = new Float32Array(MAX * 3)
    this.vel    = new Float32Array(MAX * 3)
    this.col    = new Float32Array(MAX * 3)
    this.age    = new Float32Array(MAX)
    this.maxAge = new Float32Array(MAX)

    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col, 3))
    this.geo.setDrawRange(0, 0)

    const mat = new THREE.PointsMaterial({
      vertexColors: true, size: 0.22, sizeAttenuation: true,
      transparent: true, depthWrite: false,
    })
    scene.add(new THREE.Points(this.geo, mat))
  }

  splat(pos: THREE.Vector3, count: number, color: number, speed: number) {
    const r = ((color >> 16) & 0xff) / 255
    const g = ((color >> 8)  & 0xff) / 255
    const b = (color         & 0xff) / 255

    for (let i = 0; i < count && this.cnt < MAX; i++) {
      const idx = this.cnt++
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const spd   = speed * (0.5 + Math.random() * 0.9)

      this.pos[idx*3]   = pos.x
      this.pos[idx*3+1] = pos.y + 0.5
      this.pos[idx*3+2] = pos.z

      this.vel[idx*3]   = spd * Math.sin(phi) * Math.cos(theta)
      this.vel[idx*3+1] = Math.abs(spd * Math.cos(phi)) + speed * 0.4  // bias upward
      this.vel[idx*3+2] = spd * Math.sin(phi) * Math.sin(theta)

      this.col[idx*3]   = r
      this.col[idx*3+1] = g
      this.col[idx*3+2] = b

      this.age[idx]    = 0
      this.maxAge[idx] = MAX_AGE * (0.7 + Math.random() * 0.6)
    }
    this.geo.setDrawRange(0, this.cnt)
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
  }

  update(dt: number) {
    let alive = 0
    for (let i = 0; i < this.cnt; i++) {
      this.age[i] += dt
      if (this.age[i] >= this.maxAge[i]) continue

      this.vel[i*3+1] += GRAVITY * dt

      this.pos[i*3]   += this.vel[i*3]   * dt
      this.pos[i*3+1] += this.vel[i*3+1] * dt
      this.pos[i*3+2] += this.vel[i*3+2] * dt

      if (this.pos[i*3+1] < 0) {
        this.pos[i*3+1] = 0
        this.vel[i*3+1] *= -0.25
        this.vel[i*3]   *= 0.7
        this.vel[i*3+2] *= 0.7
      }

      const life = 1 - this.age[i] / this.maxAge[i]
      const base = Math.min(1, this.col[i*3] + this.col[i*3+1] + this.col[i*3+2])
      // Fade to black
      this.col[i*3]   = this.col[i*3]   * life
      this.col[i*3+1] = this.col[i*3+1] * life
      this.col[i*3+2] = this.col[i*3+2] * life

      if (alive !== i) {
        for (let k = 0; k < 3; k++) {
          this.pos[alive*3+k]  = this.pos[i*3+k]
          this.vel[alive*3+k]  = this.vel[i*3+k]
          this.col[alive*3+k]  = this.col[i*3+k]
        }
        this.age[alive]    = this.age[i]
        this.maxAge[alive] = this.maxAge[i]
      }
      alive++
    }
    this.cnt = alive
    this.geo.setDrawRange(0, alive)
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
  }

  clear() {
    this.cnt = 0
    this.geo.setDrawRange(0, 0)
  }
}
