import * as THREE from 'three'

interface BParticle {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number
  maxLife: number
}

const MAX = 700
const GRAVITY = -20

export class BloodSystem {
  private particles: BParticle[] = []
  private pts: THREE.Points
  private posArr: Float32Array
  private colArr: Float32Array

  constructor(scene: THREE.Scene) {
    this.posArr = new Float32Array(MAX * 3)
    this.colArr = new Float32Array(MAX * 3)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(this.colArr, 3))
    geo.setDrawRange(0, 0)

    const mat = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.pts = new THREE.Points(geo, mat)
    scene.add(this.pts)
  }

  splat(pos: THREE.Vector3, count: number, intensity = 1.0) {
    const n = Math.min(count, MAX - this.particles.length)
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2
      const spd = (1.5 + Math.random() * 3.5) * intensity
      const ml = 0.45 + Math.random() * 0.85
      this.particles.push({
        x:  pos.x + (Math.random() - 0.5) * 0.35,
        y:  pos.y + Math.random() * 0.35,
        z:  pos.z + (Math.random() - 0.5) * 0.35,
        vx: Math.cos(angle) * spd,
        vy: (1.2 + Math.random() * 4.5) * intensity,
        vz: Math.sin(angle) * spd,
        life: ml, maxLife: ml,
      })
    }
    if (this.particles.length > MAX) this.particles.splice(0, this.particles.length - MAX)
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) { this.particles.splice(i, 1); continue }
      p.vy += GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < 0.03) {
        p.y = 0.03
        p.vy *= -0.12
        p.vx *= 0.55
        p.vz *= 0.55
      }
    }

    const cnt = this.particles.length
    for (let i = 0; i < MAX; i++) {
      if (i < cnt) {
        const p = this.particles[i]
        const t = p.life / p.maxLife
        this.posArr[i * 3]     = p.x
        this.posArr[i * 3 + 1] = p.y
        this.posArr[i * 3 + 2] = p.z
        this.colArr[i * 3]     = 0.65 + 0.35 * t
        this.colArr[i * 3 + 1] = 0
        this.colArr[i * 3 + 2] = 0
      } else {
        this.posArr[i * 3 + 1] = -9999
      }
    }

    const geo = this.pts.geometry
    ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(geo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
    geo.setDrawRange(0, Math.max(cnt, 1))
  }

  clear() { this.particles = [] }
}
