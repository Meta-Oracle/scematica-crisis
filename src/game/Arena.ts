import * as THREE from 'three'

export const ARENA_HALF = 9999 // Effectively unbounded

const GRID_SIZE = 3000
const MINOR_DIVS = 600   // 5-unit cells
const MAJOR_DIVS = 60    // 50-unit cells

function sr(seed: number): number {
  const x = Math.sin(seed + 1.4) * 73856.0931
  return x - Math.floor(x)
}

export class Arena {
  private terrain: THREE.Group // follows player so floor looks infinite
  private structures: THREE.Group // static world objects

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x020210, 0.0095)
    scene.background = new THREE.Color(0x020210)

    this.terrain = new THREE.Group()
    this.structures = new THREE.Group()

    this.buildFloor()
    this.buildStarfield(scene)
    this.buildEnvironment()
    this.addLights(scene)

    scene.add(this.terrain)
    scene.add(this.structures)
  }

  update(pos: THREE.Vector3) {
    // Snap to minor-grid cell so grid lines always appear at fixed world coords
    this.terrain.position.set(
      Math.round(pos.x / 5) * 5,
      0,
      Math.round(pos.z / 5) * 5
    )
  }

  private buildFloor() {
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x020316,
      roughness: 0.92,
      metalness: 0.15,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.terrain.add(floor)

    // Helper: THREE.js r152+ GridHelper uses one vertex-colored mat, older used two
    const setGridOpacity = (grid: THREE.GridHelper, opacity: number) => {
      const mats = Array.isArray(grid.material) ? grid.material : [grid.material]
      mats.forEach(m => { (m as THREE.LineBasicMaterial).transparent = true; (m as THREE.LineBasicMaterial).opacity = opacity })
    }

    // Minor grid (5-unit cells, dark blue)
    const minor = new THREE.GridHelper(GRID_SIZE, MINOR_DIVS, 0x001830, 0x001830)
    setGridOpacity(minor, 0.55)
    minor.position.y = 0.008
    this.terrain.add(minor)

    // Major grid (50-unit cells, bright cyan)
    const major = new THREE.GridHelper(GRID_SIZE, MAJOR_DIVS, 0x00ffcc, 0x004466)
    setGridOpacity(major, 0.6)
    major.position.y = 0.014
    this.terrain.add(major)
  }

  private buildStarfield(scene: THREE.Scene) {
    const count = 3000
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = sr(i * 2) * Math.PI * 2
      const phi   = Math.acos(2 * sr(i * 2 + 1) - 1)
      const r = 800 + sr(i * 2 + 2) * 400
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta)
      pos[i*3+1] = Math.abs(r * Math.cos(phi)) + 40
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x88bbff, size: 1.8, transparent: true, opacity: 0.7, sizeAttenuation: false,
    }))
    scene.add(stars)
  }

  private buildEnvironment() {
    const NEON = [0x00ffcc, 0x0088ff, 0xff00aa, 0x8800ff, 0x00ff88, 0xff6600]
    const pylonMat = (c: number) => new THREE.MeshStandardMaterial({
      color: 0x080820,
      emissive: c,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.8,
    })
    const glowStripMat = (c: number) => new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 2.5, roughness: 0.1, metalness: 0.5,
    })
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x050520,
      emissive: 0x002244,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.6,
    })

    // Scatter 120 pylons across a ±500 unit area
    for (let i = 0; i < 120; i++) {
      const x = (sr(i * 5)     - 0.5) * 900
      const z = (sr(i * 5 + 1) - 0.5) * 900
      const h = 4 + sr(i * 5 + 2) * 20
      const w = 0.4 + sr(i * 5 + 3) * 0.8
      const colorIdx = Math.floor(sr(i * 5 + 4) * NEON.length)
      const col = NEON[colorIdx]

      // Skip placing near origin (player start)
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), pylonMat(col).clone())
      pylon.position.set(x, h / 2, z)
      pylon.castShadow = true
      this.structures.add(pylon)

      // Glow strip on one face
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.3, h * 0.9, w * 0.1 + 0.02),
        glowStripMat(col)
      )
      strip.position.set(x, h / 2, z + w * 0.5 + 0.01)
      this.structures.add(strip)
    }

    // 40 floating platforms
    for (let i = 0; i < 40; i++) {
      const x = (sr(i * 7)     - 0.5) * 700
      const z = (sr(i * 7 + 1) - 0.5) * 700
      const y = 3 + sr(i * 7 + 2) * 12
      const pw = 4 + sr(i * 7 + 3) * 10
      const pd = 4 + sr(i * 7 + 4) * 10
      const ph = 0.25 + sr(i * 7 + 5) * 0.5
      const col = NEON[Math.floor(sr(i * 7 + 6) * NEON.length)]

      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue

      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(pw, ph, pd),
        platformMat.clone()
      )
      plat.position.set(x, y, z)
      plat.castShadow = true
      plat.receiveShadow = true
      this.structures.add(plat)

      // Edge glow (thin strip around platform perimeter — approximate with 4 strips)
      const edgeMat = glowStripMat(col)
      const edgeH = ph + 0.05
      const edges = [
        { geo: new THREE.BoxGeometry(pw, edgeH, 0.08), pos: new THREE.Vector3(x, y, z + pd/2) },
        { geo: new THREE.BoxGeometry(pw, edgeH, 0.08), pos: new THREE.Vector3(x, y, z - pd/2) },
        { geo: new THREE.BoxGeometry(0.08, edgeH, pd), pos: new THREE.Vector3(x + pw/2, y, z) },
        { geo: new THREE.BoxGeometry(0.08, edgeH, pd), pos: new THREE.Vector3(x - pw/2, y, z) },
      ]
      for (const e of edges) {
        const em = new THREE.Mesh(e.geo, edgeMat.clone())
        em.position.copy(e.pos)
        this.structures.add(em)
      }
    }

    // 25 holographic panels (vertical flat planes facing random directions)
    for (let i = 0; i < 25; i++) {
      const x = (sr(i * 11)     - 0.5) * 600
      const z = (sr(i * 11 + 1) - 0.5) * 600
      const y = 2 + sr(i * 11 + 2) * 8
      const pw = 3 + sr(i * 11 + 3) * 6
      const ph = 2 + sr(i * 11 + 4) * 4
      const ry = sr(i * 11 + 5) * Math.PI * 2
      const col = NEON[Math.floor(sr(i * 11 + 6) * NEON.length)]

      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue

      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.6,
          transparent: true, opacity: 0.25, side: THREE.DoubleSide,
        })
      )
      panel.position.set(x, y, z)
      panel.rotation.y = ry
      this.structures.add(panel)

      // Panel frame
      const frame = new THREE.Mesh(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, ph, 0.02)),
        new THREE.LineBasicMaterial({ color: col })
      )
      frame.position.set(x, y, z)
      frame.rotation.y = ry
      this.structures.add(frame)
    }

    // 8 giant backdrop towers far away (200-450 units out)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2
      const dist = 220 + sr(i * 3) * 200
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      const h = 60 + sr(i * 3 + 1) * 100
      const w = 5 + sr(i * 3 + 2) * 10
      const col = NEON[i % NEON.length]

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        pylonMat(col).clone()
      )
      tower.position.set(x, h / 2, z)
      this.structures.add(tower)

      // Vertical glow lines on corners
      for (let c = 0; c < 4; c++) {
        const cx = c < 2 ? w/2 : -w/2
        const cz = c % 2 === 0 ? w/2 : -w/2
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, h, 0.12),
          glowStripMat(col).clone()
        )
        line.position.set(x + cx, h / 2, z + cz)
        this.structures.add(line)
      }
    }
  }

  private addLights(scene: THREE.Scene) {
    // Dim ambient (deep space blue)
    scene.add(new THREE.AmbientLight(0x0a0a30, 0.8))

    // Overhead moonlight-style directional
    const dir = new THREE.DirectionalLight(0x4466bb, 0.9)
    dir.position.set(20, 60, 30)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 200
    dir.shadow.camera.left = -80
    dir.shadow.camera.right = 80
    dir.shadow.camera.top = 80
    dir.shadow.camera.bottom = -80
    scene.add(dir)

    // Colored fill lights that orbit loosely (static at load time)
    const fills: [number, number, number, number, number][] = [
      [0x00ffcc, 4.5, 20,  5, 0  ],
      [0x8800ff, 3.5, 18, -8, 5  ],
      [0xff00aa, 2.5, 15,  0, -6 ],
      [0x0088ff, 3.0, 22,  6, -3 ],
    ]
    for (const [color, intensity, range, x, z] of fills) {
      const pl = new THREE.PointLight(color, intensity, range)
      pl.position.set(x, 5, z)
      scene.add(pl)
    }

    // Scattered environment point lights at pylon tops (every ~50 units)
    const envColors = [0x00ffcc, 0x0088ff, 0xff00aa, 0x8800ff]
    for (let i = 0; i < 24; i++) {
      const x = (sr(i * 17)     - 0.5) * 400
      const z = (sr(i * 17 + 1) - 0.5) * 400
      const col = envColors[i % envColors.length]
      const pl = new THREE.PointLight(col, 2.5, 40)
      pl.position.set(x, 12, z)
      scene.add(pl)
    }
  }
}
