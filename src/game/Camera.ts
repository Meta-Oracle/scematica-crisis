import * as THREE from 'three'
import type { Player } from './Player'
import { EYE_HEIGHT } from './Player'

const FOV_NORMAL = 75
const FOV_ZOOM = 18
const TPS_OFFSET = new THREE.Vector3(0, 5.5, 9)

export class Camera {
  readonly cam: THREE.PerspectiveCamera
  private fovCurrent = FOV_NORMAL
  private shakeMag = 0

  constructor(renderer: THREE.WebGLRenderer) {
    this.cam = new THREE.PerspectiveCamera(FOV_NORMAL, window.innerWidth / window.innerHeight, 0.05, 300)

    window.addEventListener('resize', () => {
      this.cam.aspect = window.innerWidth / window.innerHeight
      this.cam.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })
  }

  update(rawDt: number, player: Player, sniper: boolean) {
    const targetFov = sniper ? FOV_ZOOM : FOV_NORMAL
    this.fovCurrent += (targetFov - this.fovCurrent) * Math.min(1, rawDt * 12)
    this.cam.fov = this.fovCurrent
    this.cam.updateProjectionMatrix()

    if (sniper) {
      this.cam.position.copy(player.eyePos())
      const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
      const qP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch)
      this.cam.quaternion.copy(qY).multiply(qP)
    } else {
      const offset = TPS_OFFSET.clone()
      offset.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw))
      this.cam.position.copy(player.position).add(offset)
      const lookTarget = new THREE.Vector3(player.position.x, EYE_HEIGHT * 0.6, player.position.z)
      this.cam.lookAt(lookTarget)

      // Camera shake (melee impact)
      if (this.shakeMag > 0.001) {
        this.cam.position.x += (Math.random() - 0.5) * this.shakeMag
        this.cam.position.y += (Math.random() - 0.5) * this.shakeMag * 0.6
        this.shakeMag = Math.max(0, this.shakeMag - rawDt * 16)
      }
    }
  }

  shake(intensity: number) {
    this.shakeMag = Math.max(this.shakeMag, intensity)
  }
}
