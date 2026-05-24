import type { NeuralBrain } from './NeuralBrain'

const VIZ_CSS = `
#nviz {
  position:fixed;bottom:140px;right:24px;
  background:rgba(2,3,14,0.88);
  border:1px solid rgba(0,255,200,0.2);
  padding:10px 12px;
  font-family:'Courier New',monospace;
  font-size:9px;letter-spacing:2px;color:#336655;
  pointer-events:none;z-index:180;
  display:none;
}
#nviz.on { display:block; }
#nviz h4 { margin:0 0 6px 0;color:#00ffcc;letter-spacing:3px;font-size:8px; }
.nv-row { display:flex;align-items:center;gap:5px;margin-bottom:2px; }
.nv-lbl { width:52px;text-align:right;color:#004433; }
.nv-bar-track { width:80px;height:5px;background:#030a08; }
.nv-bar-fill { height:100%;background:#00cc88;transition:width .06s; }
.nv-val { width:28px;color:#005533; }
`

const INPUT_LABELS  = ['DIST','ANGLE','WAVE','HP','NEAR']
const OUTPUT_LABELS = ['AGGR','CIRCLE','ZIGZAG','RUSH']

export class NeuralViz {
  private el: HTMLElement
  private iBars: HTMLElement[] = []
  private hBars: HTMLElement[] = []
  private oBars: HTMLElement[] = []
  private iVals: HTMLElement[] = []
  private oVals: HTMLElement[] = []
  visible = false

  constructor() {
    const style = document.createElement('style')
    style.textContent = VIZ_CSS
    document.head.appendChild(style)

    this.el = document.createElement('div')
    this.el.id = 'nviz'

    let html = '<h4>NEURAL VIZ [TAB]</h4>'
    html += '<div style="margin-bottom:5px;color:#004433;font-size:8px">INPUTS</div>'
    for (const lbl of INPUT_LABELS) {
      html += `<div class="nv-row"><span class="nv-lbl">${lbl}</span><div class="nv-bar-track"><div class="nv-bar-fill" style="width:0%"></div></div><span class="nv-val">0.00</span></div>`
    }
    html += '<div style="margin:5px 0 3px;color:#004433;font-size:8px">HIDDEN (avg)</div>'
    html += '<div class="nv-row"><span class="nv-lbl"></span><div class="nv-bar-track" style="width:120px"><div class="nv-bar-fill" style="width:0%"></div></div></div>'
    html += '<div style="margin:5px 0 3px;color:#004433;font-size:8px">OUTPUTS</div>'
    for (const lbl of OUTPUT_LABELS) {
      html += `<div class="nv-row"><span class="nv-lbl">${lbl}</span><div class="nv-bar-track"><div class="nv-bar-fill" style="width:0%"></div></div><span class="nv-val">0.00</span></div>`
    }

    this.el.innerHTML = html
    document.body.appendChild(this.el)

    const rows = this.el.querySelectorAll('.nv-row')
    for (let i = 0; i < 5; i++) {
      this.iBars.push(rows[i].querySelector('.nv-bar-fill') as HTMLElement)
      this.iVals.push(rows[i].querySelector('.nv-val') as HTMLElement)
    }
    this.hBars.push(rows[5].querySelector('.nv-bar-fill') as HTMLElement)
    for (let i = 0; i < 4; i++) {
      this.oBars.push(rows[6 + i].querySelector('.nv-bar-fill') as HTMLElement)
      this.oVals.push(rows[6 + i].querySelector('.nv-val') as HTMLElement)
    }
  }

  toggle() {
    this.visible = !this.visible
    this.el.classList.toggle('on', this.visible)
  }

  update(brain: NeuralBrain | null, inputs: number[], outputs: [number,number,number,number]) {
    if (!this.visible || !brain) return

    for (let i = 0; i < 5; i++) {
      this.iBars[i].style.width = `${inputs[i] * 100}%`
      this.iVals[i].textContent = inputs[i].toFixed(2)
      const v = inputs[i]
      this.iBars[i].style.background = v > 0.7 ? '#00ffaa' : v > 0.4 ? '#00cc66' : '#005533'
    }

    // Hidden avg
    let hidAvg = 0
    const h = new Float32Array(10)
    for (let j = 0; j < 10; j++) {
      let s = brain.b1[j]
      for (let ii = 0; ii < 5; ii++) s += inputs[ii] * brain.w1[ii * 10 + j]
      h[j] = 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, s))))
      hidAvg += h[j]
    }
    hidAvg /= 10
    this.hBars[0].style.width = `${hidAvg * 100}%`
    this.hBars[0].style.background = hidAvg > 0.6 ? '#ffaa00' : '#005533'

    for (let i = 0; i < 4; i++) {
      this.oBars[i].style.width = `${outputs[i] * 100}%`
      this.oVals[i].textContent = outputs[i].toFixed(2)
      const v = outputs[i]
      this.oBars[i].style.background = v > 0.7 ? '#ff4400' : v > 0.4 ? '#ff8800' : '#333300'
    }
  }
}
