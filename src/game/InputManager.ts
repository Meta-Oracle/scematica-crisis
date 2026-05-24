export class InputManager {
  private keys            = new Set<string>()
  private prevKeys        = new Set<string>()
  private mouseButtons    = new Set<number>()
  private prevMouseButtons= new Set<number>()
  private _mdx = 0
  private _mdy = 0
  private _locked = false

  // Mobile-injected state
  private _mobMoveX = 0
  private _mobMoveZ = 0
  private _mobLookDx = 0
  private _mobLookDy = 0
  private _mobAttack = false
  private _mobSniper = false

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', e => { this.keys.add(e.code); e.preventDefault() })
    window.addEventListener('keyup',   e => this.keys.delete(e.code))
    window.addEventListener('mousedown', e => this.mouseButtons.add(e.button))
    window.addEventListener('mouseup',   e => this.mouseButtons.delete(e.button))
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement === this.canvas) {
        this._mdx += e.movementX
        this._mdy += e.movementY
      }
    })
    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === this.canvas
    })
  }

  requestLock() { if (!this._locked) this.canvas.requestPointerLock() }
  get isLocked() { return this._locked }

  isKey(code: string): boolean {
    if (code === 'KeyW' && this._mobMoveZ < -0.15) return true
    if (code === 'KeyS' && this._mobMoveZ >  0.15) return true
    if (code === 'KeyA' && this._mobMoveX < -0.15) return true
    if (code === 'KeyD' && this._mobMoveX >  0.15) return true
    return this.keys.has(code)
  }

  wasKeyPressed(code: string) { return this.keys.has(code) && !this.prevKeys.has(code) }

  isMouse(btn: number): boolean {
    if (btn === 2 && this._mobSniper) return true
    return this.mouseButtons.has(btn)
  }

  wasMousePressed(btn: number): boolean {
    if (btn === 0 && this._mobAttack) { this._mobAttack = false; return true }
    return this.mouseButtons.has(btn) && !this.prevMouseButtons.has(btn)
  }

  consumeDelta(): { dx: number; dy: number } {
    const r = { dx: this._mdx + this._mobLookDx, dy: this._mdy + this._mobLookDy }
    this._mdx = 0; this._mdy = 0
    this._mobLookDx = 0; this._mobLookDy = 0
    return r
  }

  // Mobile injection API
  setMobileMove(x: number, z: number)    { this._mobMoveX = x; this._mobMoveZ = z }
  addMobileLook(dx: number, dy: number)  { this._mobLookDx += dx; this._mobLookDy += dy }
  triggerMobileAttack()                  { this._mobAttack = true }
  setMobileSniperHeld(v: boolean)        { this._mobSniper = v }

  // Expose raw mobile analogue for smooth movement
  getMobileAxis(): { x: number; z: number } { return { x: this._mobMoveX, z: this._mobMoveZ } }

  endFrame() {
    this.prevKeys         = new Set(this.keys)
    this.prevMouseButtons = new Set(this.mouseButtons)
  }
}
