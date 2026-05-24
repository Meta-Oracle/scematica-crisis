// Synthesized game audio — Web Audio API, no asset files needed

export class AudioSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private nextBeat = 0
  private bpm = 122
  private _combo = 0

  constructor() {
    const unlock = () => { this.init(); document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock) }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
  }

  private init() {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.master   = this.ctx.createGain(); this.master.gain.value   = 0.38; this.master.connect(this.ctx.destination)
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.22; this.musicBus.connect(this.master)
    this.nextBeat = this.ctx.currentTime + 0.05
    this.scheduleBeat()
  }

  private get beatSec() { return 60 / this.bpm }

  private scheduleBeat() {
    if (!this.ctx) return
    while (this.nextBeat < this.ctx.currentTime + 0.5) {
      this.playMusicBeat(this.nextBeat)
      this.nextBeat += this.beatSec
    }
    setTimeout(() => this.scheduleBeat(), 100)
  }

  private playMusicBeat(when: number) {
    this.kick(when)
    if (this._combo >= 3) this.hihat(when + this.beatSec * 0.5)
    if (this._combo >= 3) this.hihat(when + this.beatSec * 0.25)
    if (this._combo >= 6) this.bass(when, 55 + (Math.floor(when / (this.beatSec * 4)) % 4) * 7)
    if (this._combo >= 10) {
      const arp = [220, 277, 330, 415, 440]
      const idx = Math.floor(when / (this.beatSec * 0.25)) % arp.length
      this.arpNote(when, arp[idx])
    }
  }

  private kick(w: number) {
    if (!this.ctx || !this.musicBus) return
    const o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, w); o.frequency.exponentialRampToValueAtTime(28, w + 0.18)
    g.gain.setValueAtTime(0.85, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.28)
    o.connect(g); g.connect(this.musicBus); o.start(w); o.stop(w + 0.3)
  }

  private hihat(w: number) {
    if (!this.ctx || !this.musicBus) return
    const n = this.ctx.sampleRate * 0.04
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const s = this.ctx.createBufferSource(); s.buffer = buf
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.28, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.04)
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(w)
  }

  private bass(w: number, freq: number) {
    if (!this.ctx || !this.musicBus) return
    const o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = freq
    g.gain.setValueAtTime(0.28, w); g.gain.setValueAtTime(0.28, w + this.beatSec * 0.75)
    g.gain.exponentialRampToValueAtTime(0.001, w + this.beatSec * 0.92)
    o.connect(g); g.connect(this.musicBus); o.start(w); o.stop(w + this.beatSec)
  }

  private arpNote(w: number, freq: number) {
    if (!this.ctx || !this.musicBus) return
    const o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.type = 'square'; o.frequency.value = freq
    g.gain.setValueAtTime(0.12, w); g.gain.exponentialRampToValueAtTime(0.001, w + this.beatSec * 0.45)
    o.connect(g); g.connect(this.musicBus); o.start(w); o.stop(w + this.beatSec * 0.5)
  }

  // ── SFX ──
  private sfx(setup: (ctx: AudioContext, dst: GainNode) => void) {
    if (!this.ctx || !this.master) return
    setup(this.ctx, this.master)
  }

  swordSwing(move: string) {
    this.sfx((ctx, dst) => {
      const dur = ({ slash: 0.14, heavy: 0.26, flurry: 0.11, whirlwind: 0.42, devastate: 0.36 } as Record<string,number>)[move] ?? 0.18
      const n = ctx.sampleRate * (dur + 0.06)
      const buf = ctx.createBuffer(1, n, ctx.sampleRate)
      const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
      const s = ctx.createBufferSource(); s.buffer = buf
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'
      const fMap = ({ devastate: 280, whirlwind: 500, heavy: 380, flurry: 1000, slash: 850 } as Record<string,number>)[move] ?? 650
      f.frequency.setValueAtTime(fMap, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + dur); f.Q.value = 1.8
      const g = ctx.createGain()
      g.gain.setValueAtTime(({ devastate: 0.65, whirlwind: 0.55, heavy: 0.50, slash: 0.38, flurry: 0.32 } as Record<string,number>)[move] ?? 0.38, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      s.connect(f); f.connect(g); g.connect(dst); s.start(ctx.currentTime)
    })
  }

  swordImpact(move: string) {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      const freq = ({ slash: 180, heavy: 80, flurry: 200, whirlwind: 110, devastate: 55 } as Record<string,number>)[move] ?? 140
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(freq * 2.2, w); o.frequency.exponentialRampToValueAtTime(freq * 0.28, w + 0.1)
      g.gain.setValueAtTime(0.6, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.14)
      o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.18)
    })
  }

  headshot(streak: number) {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      const freq = 380 + streak * 60
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(freq * 2.1, w); o.frequency.exponentialRampToValueAtTime(freq, w + 0.06)
      g.gain.setValueAtTime(0.55, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.32 + streak * 0.04)
      o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.4)
      if (streak >= 4) {
        const o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o2.type = 'sine'; o2.frequency.value = freq * 1.5
        g2.gain.setValueAtTime(0.22, w + 0.03); g2.gain.exponentialRampToValueAtTime(0.001, w + 0.7)
        o2.connect(g2); g2.connect(dst); o2.start(w + 0.03); o2.stop(w + 0.8)
      }
    })
  }

  enemyDeath(color: number) {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      const r = ((color >> 16) & 0xff) / 255
      const freq = 90 + r * 280
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(freq, w); o.frequency.exponentialRampToValueAtTime(22, w + 0.38)
      g.gain.setValueAtTime(0.38, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.42)
      o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.5)
    })
  }

  bossAppear() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      for (const freq of [38, 55, 82]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = freq === 82 ? 'sawtooth' : 'sine'
        o.frequency.setValueAtTime(freq * 2, w); o.frequency.exponentialRampToValueAtTime(freq, w + 0.6)
        g.gain.setValueAtTime(0.42, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.9)
        o.connect(g); g.connect(dst); o.start(w); o.stop(w + 1.0)
      }
    })
  }

  bossDeath() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      for (const [i, freq] of [[0,55],[1,82],[2,110],[3,146]] as [number,number][]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, w + i * 0.04)
        o.frequency.exponentialRampToValueAtTime(freq * 0.25, w + 1.6)
        g.gain.setValueAtTime(0.32, w + i * 0.04); g.gain.exponentialRampToValueAtTime(0.001, w + 1.9)
        o.connect(g); g.connect(dst); o.start(w + i * 0.04); o.stop(w + 2.2)
      }
    })
  }

  parry() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      for (const [i, f] of [[0,440],[1,660],[2,880]] as [number,number][]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'triangle'; o.frequency.value = f
        g.gain.setValueAtTime(0.30 - i * 0.06, w + i * 0.006)
        g.gain.exponentialRampToValueAtTime(0.001, w + 0.4)
        o.connect(g); g.connect(dst); o.start(w + i * 0.006); o.stop(w + 0.5)
      }
    })
  }

  execution() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      for (const freq of [55, 110, 165]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(freq * 2.2, w); o.frequency.exponentialRampToValueAtTime(freq * 0.4, w + 0.22)
        g.gain.setValueAtTime(0.45, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.55)
        o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.65)
      }
    })
  }

  playerHit() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(220, w); o.frequency.exponentialRampToValueAtTime(38, w + 0.18)
      g.gain.setValueAtTime(0.55, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.22)
      o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.28)
    })
  }

  powerUp() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      for (const [i, f] of [[0,261],[1,329],[2,392],[3,523]] as [number,number][]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'triangle'; o.frequency.value = f
        g.gain.setValueAtTime(0.22, w + i * 0.09); g.gain.exponentialRampToValueAtTime(0.001, w + i * 0.09 + 0.28)
        o.connect(g); g.connect(dst); o.start(w + i * 0.09); o.stop(w + i * 0.09 + 0.35)
      }
    })
  }

  projectileImpact() {
    this.sfx((ctx, dst) => {
      const w = ctx.currentTime
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'square'; o.frequency.setValueAtTime(600, w); o.frequency.exponentialRampToValueAtTime(120, w + 0.12)
      g.gain.setValueAtTime(0.4, w); g.gain.exponentialRampToValueAtTime(0.001, w + 0.16)
      o.connect(g); g.connect(dst); o.start(w); o.stop(w + 0.2)
    })
  }

  setCombo(combo: number) { this._combo = combo }
  resume() { this.ctx?.resume() }
}
