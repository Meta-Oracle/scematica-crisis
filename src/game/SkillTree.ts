export interface Skill {
  id: string; name: string; icon: string; desc: string
  stat: keyof PlayerStats; delta: number
}

export interface PlayerStats {
  speedMult:    number   // multiplier  (base 1.0)
  swordRange:   number   // multiplier  (base 1.0)
  headshotMult: number   // additive bonus on damage  (base 0)
  dashCdBonus:  number   // subtractive seconds  (base 0)
  maxHpBonus:   number   // flat HP  (base 0)
  vampHeal:     number   // HP per kill  (base 0)
  comboMult:    number   // combo speed multiplier  (base 1.0)
  enemyDmgMult: number   // extra % enemy damage taken  (base 0)
  reloadBonus:  number   // seconds subtracted from reload  (base 0)
}

export function defaultStats(): PlayerStats {
  return { speedMult: 1, swordRange: 1, headshotMult: 0, dashCdBonus: 0, maxHpBonus: 0, vampHeal: 0, comboMult: 1, enemyDmgMult: 0, reloadBonus: 0 }
}

const POOL: Skill[] = [
  { id: 'velocity',    name: 'VELOCITY',     icon: '▶▶', desc: '+22% movement speed',          stat: 'speedMult',    delta:  0.22 },
  { id: 'blade',       name: 'BLADE EXT.',   icon: '⚔',  desc: '+40% sword range',              stat: 'swordRange',   delta:  0.40 },
  { id: 'marksman',    name: 'MARKSMAN',     icon: '◎',  desc: '+35% headshot damage bonus',    stat: 'headshotMult', delta:  0.35 },
  { id: 'dash_boost',  name: 'DASH BOOST',   icon: '⚡',  desc: '-0.35s dash cooldown',          stat: 'dashCdBonus',  delta:  0.35 },
  { id: 'surge',       name: 'SURGE',        icon: '❤',  desc: '+35 max HP',                    stat: 'maxHpBonus',   delta:  35   },
  { id: 'vampire',     name: 'VAMPIRIC',     icon: '↑',  desc: 'Each kill restores 6 HP',       stat: 'vampHeal',     delta:  6    },
  { id: 'berserker',   name: 'BERSERKER',    icon: '✦',  desc: 'Combo decays 35% slower',       stat: 'comboMult',    delta:  0.35 },
  { id: 'neural_shock',name: 'NEURAL SHOCK', icon: '⟁',  desc: 'Enemies take 18% more damage',  stat: 'enemyDmgMult', delta:  0.18 },
  { id: 'quick_load',  name: 'QUICK LOAD',   icon: '↻',  desc: '-0.45s reload time',            stat: 'reloadBonus',  delta:  0.45 },
]

const CSS = `
#skill-tree {
  position:fixed;inset:0;z-index:300;
  background:rgba(2,3,16,0.92);
  display:none;flex-direction:column;align-items:center;justify-content:center;
  font-family:'Courier New',monospace;
}
#skill-tree.vis { display:flex; }
#skill-tree h2 { font-size:18px;letter-spacing:8px;color:#00ffcc;margin:0 0 6px 0;text-shadow:0 0 24px #00ffcc; }
#skill-tree .sub { font-size:10px;letter-spacing:4px;color:#004455;margin-bottom:36px; }
.skill-cards { display:flex;gap:16px; }
.skill-card {
  width:150px;padding:18px 14px;
  border:1px solid rgba(0,200,150,0.25);
  background:rgba(0,10,18,0.9);
  cursor:pointer;text-align:center;
  transition:border-color .15s,background .15s,transform .12s;
}
.skill-card:hover, .skill-card:focus {
  border-color:rgba(0,255,200,0.7);
  background:rgba(0,30,25,0.95);
  transform:translateY(-4px);
  outline:none;
}
.skill-card .sk-key { font-size:11px;letter-spacing:3px;color:#004455;margin-bottom:8px; }
.skill-card .sk-icon { font-size:28px;margin:4px 0 10px; }
.skill-card .sk-name { font-size:11px;letter-spacing:4px;color:#00ffcc;margin-bottom:8px; }
.skill-card .sk-desc { font-size:9px;letter-spacing:1px;color:#336655;line-height:1.6; }
#skill-tree .hint { font-size:9px;letter-spacing:3px;color:#003322;margin-top:28px; }
`

export class SkillTree {
  private el: HTMLElement
  private cards: HTMLElement[] = []
  private offered: Skill[] = []
  private cb: ((s: Skill) => void) | null = null

  constructor() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    this.el = document.createElement('div')
    this.el.id = 'skill-tree'
    this.el.innerHTML = `
      <h2>UPGRADE</h2>
      <div class="sub">— SELECT ONE ENHANCEMENT —</div>
      <div class="skill-cards" id="sk-cards"></div>
      <div class="hint">KEYS 1–4 OR CLICK</div>
    `
    document.body.appendChild(this.el)

    document.addEventListener('keydown', e => {
      if (!this.cb) return
      const n = parseInt(e.key)
      if (n >= 1 && n <= 4 && this.offered[n-1]) this.pick(n - 1)
    })
  }

  show(wave: number, onPick: (s: Skill) => void) {
    this.cb = onPick
    this.offered = this.randomFour()

    const container = document.getElementById('sk-cards')!
    container.innerHTML = ''
    this.cards = []

    for (let i = 0; i < 4; i++) {
      const sk = this.offered[i]
      const card = document.createElement('div')
      card.className = 'skill-card'
      card.tabIndex = 0
      card.innerHTML = `
        <div class="sk-key">[${i+1}]</div>
        <div class="sk-icon">${sk.icon}</div>
        <div class="sk-name">${sk.name}</div>
        <div class="sk-desc">${sk.desc}</div>
      `
      card.addEventListener('click', () => this.pick(i))
      container.appendChild(card)
      this.cards.push(card)
    }

    this.el.classList.add('vis')
    this.cards[0]?.focus()
  }

  private pick(i: number) {
    if (!this.cb) return
    const sk = this.offered[i]
    this.cb(sk)
    this.cb = null
    this.el.classList.remove('vis')
  }

  private randomFour(): Skill[] {
    const shuffled = [...POOL].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 4)
  }

  applySkill(stats: PlayerStats, skill: Skill): PlayerStats {
    const s = { ...stats }
    if (skill.stat === 'speedMult' || skill.stat === 'swordRange' || skill.stat === 'comboMult') {
      (s[skill.stat] as number) += skill.delta
    } else {
      (s[skill.stat] as number) += skill.delta
    }
    return s
  }
}
