const DECAY = 3.5
const MAX_STREAK = 20

export class Combo {
  streak = 0
  private timer = 0
  // melee chain: 0=light, 1=medium, 2=finisher
  meleePos = 0
  private meleeTimer = 0
  private readonly meleeWindow = 1.1

  hit() {
    this.streak = Math.min(this.streak + 1, MAX_STREAK)
    this.timer = DECAY
  }

  meleeTap(): 0 | 1 | 2 {
    const pos = this.meleePos as 0 | 1 | 2
    this.meleePos = (this.meleePos + 1) % 3
    this.meleeTimer = this.meleeWindow
    return pos
  }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt
      if (this.timer <= 0) this.streak = 0
    }
    if (this.meleeTimer > 0) {
      this.meleeTimer -= dt
      if (this.meleeTimer <= 0) this.meleePos = 0
    }
  }

  get multiplier() { return 1 + this.streak * 0.18 }
  get timerFrac() { return this.streak > 0 ? Math.max(0, this.timer / DECAY) : 0 }
  reset() { this.streak = 0; this.timer = 0; this.meleePos = 0; this.meleeTimer = 0 }
}
