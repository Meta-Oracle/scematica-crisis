import * as THREE from 'three'
import type { InputManager } from './InputManager'

export const EYE_HEIGHT = 1.75
const MOVE_SPEED = 9
const LOOK_SENS = 0.0022
const PITCH_MAX = Math.PI / 2.2

export class Player {
  readonly position = new THREE.Vector3(0, 0, 0)
  yaw = 0
  pitch = 0

  private mesh: THREE.Group
  private bodyMat: THREE.MeshStandardMaterial

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group()

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x00aaff,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.6,
    })

    const bodyGeo = new THREE.BoxGeometry(0.8, 1.4, 0.5)
    const body = new THREE.Mesh(bodyGeo, this.bodyMat)
    body.position.y = 0.9
    body.castShadow = true
    this.mesh.add(body)

    const headGeo = new THREE.SphereGeometry(0.28, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x22223e,
      emissive: 0x00bbff,
      emissiveIntensity: 0.3,
    })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = EYE_HEIGHT
    head.castShadow = true
    this.mesh.add(head)

    // Sword hint
    const swordGeo = new THREE.BoxGeometry(0.08, 1.0, 0.04)
    const swordMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x00aaff,
      emissiveIntensity: 0.8,
      metalness: 0.9,
    })
    const sword = new THREE.Mesh(swordGeo, swordMat)
    sword.position.set(0.55, 0.9, 0.1)
    sword.rotation.z = -0.3
    this.mesh.add(sword)

    scene.add(this.mesh)
  }

  update(dt: number, input: InputManager, arenaHalf: number) {
    const { dx, dy } = input.consumeDelta()
    this.yaw -= dx * LOOK_SENS
    this.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch - dy * LOOK_SENS))

    const dir = new THREE.Vector3()
    if (input.isKey('KeyW')) dir.z -= 1
    if (input.isKey('KeyS')) dir.z += 1
    if (input.isKey('KeyA')) dir.x -= 1
    if (input.isKey('KeyD')) dir.x += 1

    if (dir.lengthSq() > 0) {
      dir.normalize()
      dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), this.yaw
      ))
      this.position.addScaledVector(dir, MOVE_SPEED * dt)
    }

    const lim = arenaHalf - 1.2
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x))
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z))

    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = this.yaw
  }

  setVisible(v: boolean) {
    this.mesh.visible = v
  }

  eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, EYE_HEIGHT, this.position.z)
  }

  flash() {
    this.bodyMat.emissiveIntensity = 2
    setTimeout(() => { this.bodyMat.emissiveIntensity = 0.4 }, 80)
  }
}
