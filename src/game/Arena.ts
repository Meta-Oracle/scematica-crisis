import * as THREE from 'three'

export const ARENA_HALF = 19

export class Arena {
  readonly group = new THREE.Group()
  readonly size = ARENA_HALF * 2

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x050510, 0.025)
    scene.background = new THREE.Color(0x050510)

    this.buildFloor()
    this.buildWalls()
    this.buildObstacles()
    this.addLights(scene)
    scene.add(this.group)
  }

  private buildFloor() {
    const geo = new THREE.PlaneGeometry(this.size, this.size)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x060614,
      roughness: 0.9,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.group.add(floor)

    const grid = new THREE.GridHelper(this.size, 24, 0x00ffff, 0x002233)
    const mats = Array.isArray(grid.material) ? grid.material : [grid.material]
    for (const m of mats) {
      m.transparent = true
      m.opacity = 0.35
    }
    this.group.add(grid)
  }

  private buildWalls() {
    const h = ARENA_HALF
    const wallH = 10
    const wallDefs = [
      { pos: [0, wallH / 2, -h] as const, ry: 0 },
      { pos: [0, wallH / 2, h] as const, ry: Math.PI },
      { pos: [-h, wallH / 2, 0] as const, ry: Math.PI / 2 },
      { pos: [h, wallH / 2, 0] as const, ry: -Math.PI / 2 },
    ]
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0a1e,
      emissive: 0x110033,
      emissiveIntensity: 0.5,
      roughness: 0.7,
      metalness: 0.3,
    })
    for (const w of wallDefs) {
      const geo = new THREE.BoxGeometry(h * 2, wallH, 0.4)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(w.pos[0], w.pos[1], w.pos[2])
      mesh.rotation.y = w.ry
      mesh.receiveShadow = true
      mesh.castShadow = true
      this.group.add(mesh)
    }
  }

  private buildObstacles() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0f0f22,
      emissive: 0x440066,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.5,
    })
    const positions: [number, number][] = [
      [-9, -9], [9, -9], [-9, 9], [9, 9],
      [-14, 0], [14, 0], [0, -14], [0, 14],
      [-5, -14], [5, 14], [-14, -5], [14, 5],
    ]
    for (const [x, z] of positions) {
      const w = 1.5 + Math.random() * 1.5
      const h = 2 + Math.random() * 3
      const d = 1.5 + Math.random() * 1.5
      const geo = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, mat.clone())
      mesh.position.set(x, h / 2, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
    }
  }

  private addLights(scene: THREE.Scene) {
    scene.add(new THREE.AmbientLight(0x111133, 0.6))

    const sun = new THREE.DirectionalLight(0x6644bb, 1.2)
    sun.position.set(10, 20, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    scene.add(sun)

    const cyan = new THREE.PointLight(0x00ffff, 3, 30)
    cyan.position.set(0, 6, 0)
    scene.add(cyan)

    const purple = new THREE.PointLight(0x8800ff, 2, 35)
    purple.position.set(0, 4, 0)
    scene.add(purple)
  }
}
