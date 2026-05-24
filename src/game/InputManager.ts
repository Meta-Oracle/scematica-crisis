export class InputManager {
  private keys = new Set<string>()
  private prevKeys = new Set<string>()
  private mouseButtons = new Set<number>()
  private prevMouseButtons = new Set<number>()
  private _mdx = 0
  private _mdy = 0
  private _locked = false

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code)
      e.preventDefault()
    })
    window.addEventListener('keyup', e => this.keys.delete(e.code))
    window.addEventListener('mousedown', e => this.mouseButtons.add(e.button))
    window.addEventListener('mouseup', e => this.mouseButtons.delete(e.button))
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

  requestLock() {
    if (!this._locked) this.canvas.requestPointerLock()
  }

  get isLocked() { return this._locked }

  isKey(code: string) { return this.keys.has(code) }
  wasKeyPressed(code: string) { return this.keys.has(code) && !this.prevKeys.has(code) }

  isMouse(btn: number) { return this.mouseButtons.has(btn) }
  wasMousePressed(btn: number) {
    return this.mouseButtons.has(btn) && !this.prevMouseButtons.has(btn)
  }

  consumeDelta(): { dx: number; dy: number } {
    const r = { dx: this._mdx, dy: this._mdy }
    this._mdx = 0
    this._mdy = 0
    return r
  }

  endFrame() {
    this.prevKeys = new Set(this.keys)
    this.prevMouseButtons = new Set(this.mouseButtons)
  }
}
