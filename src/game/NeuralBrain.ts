// Compact 5→10→4 feedforward network used as enemy behaviour genes.
// BrainPool manages a generational population that evolves each wave.

const IN  = 5
const HID = 10
const OUT = 4

function sigmoid(x: number) { return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x)))) }

export class NeuralBrain {
  readonly w1 = new Float32Array(IN  * HID)
  readonly b1 = new Float32Array(HID)
  readonly w2 = new Float32Array(HID * OUT)
  readonly b2 = new Float32Array(OUT)

  static random(): NeuralBrain {
    const b = new NeuralBrain()
    const fill = (a: Float32Array) => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 3 }
    fill(b.w1); fill(b.b1); fill(b.w2); fill(b.b2)
    return b
  }

  static crossover(a: NeuralBrain, b: NeuralBrain, mutRate = 0.18): NeuralBrain {
    const child = new NeuralBrain()
    const blend = (ax: Float32Array, bx: Float32Array, out: Float32Array) => {
      for (let i = 0; i < ax.length; i++) {
        out[i] = Math.random() < 0.5 ? ax[i] : bx[i]
        if (Math.random() < mutRate) out[i] += (Math.random() - 0.5) * 0.8
        out[i] = Math.max(-6, Math.min(6, out[i]))
      }
    }
    blend(a.w1, b.w1, child.w1); blend(a.b1, b.b1, child.b1)
    blend(a.w2, b.w2, child.w2); blend(a.b2, b.b2, child.b2)
    return child
  }

  // inputs: [dist/40, angleNorm, waveNorm, healthRatio, nearbyNorm]
  // outputs: [aggression, circleTend, zigzagFreq, rushThreshold]
  forward(inputs: number[]): [number, number, number, number] {
    const h = new Float32Array(HID)
    for (let j = 0; j < HID; j++) {
      let s = this.b1[j]
      for (let i = 0; i < IN; i++) s += inputs[i] * this.w1[i * HID + j]
      h[j] = sigmoid(s)
    }
    const o = new Float32Array(OUT)
    for (let j = 0; j < OUT; j++) {
      let s = this.b2[j]
      for (let i = 0; i < HID; i++) s += h[i] * this.w2[i * OUT + j]
      o[j] = sigmoid(s)
    }
    return [o[0], o[1], o[2], o[3]]
  }

  toJSON() {
    return {
      w1: Array.from(this.w1), b1: Array.from(this.b1),
      w2: Array.from(this.w2), b2: Array.from(this.b2),
    }
  }

  static fromJSON(d: { w1: number[]; b1: number[]; w2: number[]; b2: number[] }): NeuralBrain {
    const b = new NeuralBrain()
    b.w1.set(d.w1); b.b1.set(d.b1); b.w2.set(d.w2); b.b2.set(d.b2)
    return b
  }
}

export class BrainPool {
  private pool:    NeuralBrain[]
  private fitness: number[]
  private index = 0
  readonly size: number

  constructor(size = 20) {
    this.size    = size
    this.pool    = Array.from({ length: size }, () => NeuralBrain.random())
    this.fitness = new Array(size).fill(0)
    this.load()
  }

  next(): NeuralBrain { return this.pool[this.index++ % this.size] }

  recordFitness(brain: NeuralBrain, timeAlive: number, gotKill: boolean) {
    const i = this.pool.indexOf(brain)
    if (i >= 0) this.fitness[i] = Math.max(this.fitness[i], timeAlive + (gotKill ? 5 : 0))
  }

  evolve() {
    const ranked = this.pool.map((b, i) => ({ b, f: this.fitness[i] })).sort((a, b) => b.f - a.f)
    const next: NeuralBrain[] = []
    for (let i = 0; i < Math.min(4, ranked.length); i++) next.push(ranked[i].b)
    while (next.length < this.size) {
      const t = () => ranked[Math.floor(Math.random() * Math.min(8, ranked.length))].b
      next.push(NeuralBrain.crossover(t(), t()))
    }
    this.pool    = next
    this.fitness = new Array(this.size).fill(0)
    this.index   = 0
    this.save()
  }

  save() {
    try {
      const top4 = [...this.pool]
        .map((b, i) => ({ b, f: this.fitness[i] }))
        .sort((a, b) => b.f - a.f)
        .slice(0, 4)
        .map(x => x.b.toJSON())
      localStorage.setItem('scematica-brains', JSON.stringify(top4))
    } catch {}
  }

  load() {
    try {
      const raw = localStorage.getItem('scematica-brains')
      if (!raw) return
      const data = JSON.parse(raw)
      for (let i = 0; i < Math.min(4, data.length, this.pool.length); i++) {
        this.pool[i] = NeuralBrain.fromJSON(data[i])
      }
    } catch {}
  }
}
