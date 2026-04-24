export type FaceParts = {
  leftEye: string
  rightEye: string
  mouth: string
  browL?: string
  browR?: string
  blush?: string
  sweat?: string
  accessory?: string
}

export type MoodDef = {
  template: string
  parts: FaceParts
  label: string
  color: string
  particles?: string[]
  intensity?: number
  particleMode?: "scatter" | "rain"
}

export type AnimState = {
  time: number
  blinkPhase: number
  blinkTimer: number
  breathPhase: number
  jitterTimer: number
  jitterActive: boolean
  glitchTimer: number
  glitchActive: boolean
  glitchFrames: number
  glitchSeed: number
  shiftTimer: number
  shiftOffset: number
  bouncePhase: number
  shakePhase: number
  shakeIntensity: number
  wavePhase: number
}

export type TransitionState = {
  from: MoodDef
  to: MoodDef
  progress: number
  startTime: number
}

export type RenderOutput = {
  lines: string[]
  label: string
  color: string
  particles: string[]
  offsetY: number
}

export type ThemeSettings = {
  poll_ms?: number
  mood_ttl_ms?: number
  engine_hz?: number
  box_width?: number
  transition_ms?: number
  idle_relaxed_ms?: number
  idle_waiting_ms?: number
  idle_sleepy_ms?: number
}

export type StatusDef = { icon: string; text: string; color: string }

export type ThemeFile = {
  settings?: ThemeSettings
  status?: Partial<Record<string, Partial<StatusDef>>>
  moods?: Partial<Record<string, Partial<MoodDef>>>
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export const BLINK_MAP: Record<string, [string, string]> = {
  "◕": ["˚", "·"], "◯": ["◌", "·"], "◉": ["◌", "·"], "O": ["◌", "·"],
  "▷": ["˃", "·"], "◁": ["˂", "·"], "△": ["˄", "·"], "▽": ["˅", "·"],
  "◔": ["˚", "·"], "◕": ["˚", "·"], "★": ["☆", "·"], "☆": ["·", "·"],
  "^": ["˜", "·"], "˜": ["·", "·"], "•": ["·", "·"], "◦": ["·", "·"],
  "ಠ": ["·", "·"], "ಡ": ["·", "·"],
}

export const MOUTH_BLINK: Record<string, string> = {
  "‿": "_", "◡": "_", "ω": "_", "−": "–",
}

export const EYE_WIDE: Record<string, string> = {
  "◕": "◯", "◔": "◕", "▷": "△", "◁": "▽", "★": "☆", "^": "˜",
  "•": "◦", "ಠ": "ಡ",
}

const GLITCH_CHARS = "!@#$%^&*~░▒▓▄▀■□◈◇"

function glitchChar(seed: number): string {
  return GLITCH_CHARS[Math.abs(Math.floor(Math.sin(seed) * 10000)) % GLITCH_CHARS.length]
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  poll_ms: 500,
  mood_ttl_ms: 20_000,
  engine_hz: 20,
  box_width: 18,
  transition_ms: 400,
  idle_relaxed_ms: 60_000,
  idle_waiting_ms: 180_000,
  idle_sleepy_ms: 300_000,
}

export const DEFAULT_STATUS: Record<string, StatusDef> = {
  streaming:        { icon: "✏",  text: "responding...",   color: "accent" },
  thinking:         { icon: "💭", text: "thinking...",     color: "textMuted" },
  "tool-running":   { icon: "⚙",  text: "",               color: "warning" },
  "tool-error":     { icon: "⚠",  text: "failed",         color: "error" },
  "permission-wait": { icon: "🔒", text: "needs approval", color: "warning" },
  retry:            { icon: "↻",  text: "retrying ({n})", color: "error" },
  busy:             { icon: "⏳", text: "working...",     color: "warning" },
}

export const DEFAULT_MOODS: Record<string, MoodDef> = {
  idle: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "◕", rightEye: "◕", mouth: "‿" },
    label: "chilling", color: "success",
  },
  happy: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "▷", rightEye: "◁", mouth: "◡" },
    label: "happy", color: "success",
    particles: ["✨", "·", "✨", "·", "✨"],
  },
  sad: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "◔", rightEye: "◔", mouth: "◜" },
    label: "sad", color: "textMuted",
    particles: ["·", "·", "·"],
  },
  excited: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "★", rightEye: "★", mouth: "◡" },
    label: "excited!", color: "accent",
    particles: ["!", "✧", "!", "✧"],
  },
  focused: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "ಠ", rightEye: "ಠ", mouth: "−" },
    label: "focused", color: "accent",
  },
  celebrating: {
    template: "ヽ({eL}{m}{eR})ノ",
    parts: { leftEye: "^", rightEye: "^", mouth: "o" },
    label: "celebrating!", color: "success",
    particles: ["✨", "★", "☆", "✧", "✦", "★"],
  },
  done: {
    template: "({eL}{m}{eR})و ̑̑",
    parts: { leftEye: "•", rightEye: "•", mouth: "ᴗ" },
    label: "done!", color: "success",
    particles: ["✓", "·", "✓"],
  },
  angry: {
    template: "({eL}{m}{eR})",
    parts: { leftEye: "ಠ", rightEye: "ಠ", mouth: "益" },
    label: "angry", color: "error",
    particles: ["!", "!", "!"],
  },
}

export const STATUS_MOOD_MAP: Record<string, string> = {
  idle: "idle",
  streaming: "excited",
  thinking: "focused",
  "tool-running": "focused",
  "tool-error": "angry",
  "permission-wait": "sad",
  busy: "focused",
  retry: "angry",
}

export const EYE_SMALL: Record<string, string> = {
  "◯": "◕", "◕": "◔", "△": "▷", "▽": "◁", "☆": "★",
  "˜": "^", "◦": "•", "ಡ": "ಠ",
}

function eyeForIntensity(eye: string, intensity: number): string {
  if (intensity >= 0.7) return eye
  if (intensity < 0.3) return EYE_SMALL[eye] ?? "·"
  return eye
}

const MOUTH_INTENSITY: Record<string, string> = {
  "益": "ω", "◡": "‿", "◜": "◡",
}

function mouthForIntensity(mouth: string, intensity: number): string {
  if (intensity >= 0.7) return mouth
  if (intensity < 0.3) return MOUTH_INTENSITY[mouth] ?? mouth
  return mouth
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function interpolateParts(from: FaceParts, to: FaceParts, t: number): FaceParts {
  return {
    leftEye: t < 0.5 ? from.leftEye : to.leftEye,
    rightEye: t < 0.5 ? from.rightEye : to.rightEye,
    mouth: t < 0.5 ? from.mouth : to.mouth,
    browL: t < 0.5 ? from.browL : to.browL,
    browR: t < 0.5 ? from.browR : to.browR,
    blush: t < 0.5 ? from.blush : to.blush,
    sweat: t < 0.5 ? from.sweat : to.sweat,
    accessory: t < 0.5 ? from.accessory : to.accessory,
  }
}

export function createTransitionState(from: MoodDef, to: MoodDef, now: number): TransitionState {
  return { from, to, progress: 0, startTime: now }
}

export function updateTransition(state: TransitionState | undefined, now: number, duration: number): TransitionState | undefined {
  if (!state) return undefined
  const elapsed = now - state.startTime
  const progress = Math.min(elapsed / duration, 1)
  return progress >= 1 ? undefined : { ...state, progress: easeInOutCubic(progress) }
}

export function createAnimState(): AnimState {
  return {
    time: 0, blinkPhase: 0, blinkTimer: rand(3000, 5000),
    breathPhase: 0, jitterTimer: rand(2000, 4000), jitterActive: false,
    glitchTimer: rand(30000, 60000), glitchActive: false, glitchFrames: 0, glitchSeed: 0,
    shiftTimer: rand(8000, 15000), shiftOffset: 0,
    bouncePhase: 0, shakePhase: 0, shakeIntensity: 0, wavePhase: 0,
  }
}

export function animTick(state: AnimState, dt: number): AnimState {
  const s = { ...state }
  s.time += dt

  if (s.blinkPhase > 0) {
    s.blinkPhase += dt / 80
    if (s.blinkPhase >= 3) { s.blinkPhase = 0; s.blinkTimer = rand(3000, 5000) }
  } else {
    s.blinkTimer -= dt
    if (s.blinkTimer <= 0) s.blinkPhase = 0.01
  }

  s.breathPhase = (s.breathPhase + dt / 2500 * Math.PI * 2) % (Math.PI * 2)

  if (s.jitterActive) {
    s.jitterActive = false
    s.jitterTimer = rand(2000, 4000)
  } else {
    s.jitterTimer -= dt
    if (s.jitterTimer <= 0) s.jitterActive = true
  }

  if (s.glitchActive) {
    s.glitchFrames--
    if (s.glitchFrames <= 0) { s.glitchActive = false; s.glitchTimer = rand(30000, 60000) }
  } else {
    s.glitchTimer -= dt
    if (s.glitchTimer <= 0) {
      s.glitchActive = true; s.glitchFrames = 1 + Math.floor(Math.random() * 2); s.glitchSeed = Math.random() * 10000
    }
  }

  s.shiftTimer -= dt
  if (s.shiftTimer <= 0) { s.shiftOffset = Math.floor(Math.random() * 3) - 1; s.shiftTimer = rand(8000, 15000) }

  s.bouncePhase += dt / 300 * Math.PI * 2
  s.shakePhase += dt / 1000 * Math.PI * 2
  if (s.shakeIntensity > 0) s.shakeIntensity = Math.max(0, s.shakeIntensity - dt / 500)
  s.wavePhase += dt / 2000 * Math.PI * 2

  return s
}

function blinkEye(eye: string, phase: number): string {
  if (phase <= 0) return eye
  const map = BLINK_MAP[eye]
  if (!map) return phase > 2 ? "·" : eye
  if (phase > 2) return map[1]
  if (phase > 1) return map[0]
  return eye
}

export function render(anim: AnimState, mood: MoodDef, transition?: TransitionState): RenderOutput {
  const t = transition?.progress ?? 1
  const baseParts = transition
    ? interpolateParts(transition.from.parts, transition.to.parts, t)
    : { ...mood.parts }

  const intensity = mood.intensity ?? 1
  const p: FaceParts = {
    leftEye: eyeForIntensity(baseParts.leftEye, intensity),
    rightEye: eyeForIntensity(baseParts.rightEye, intensity),
    mouth: mouthForIntensity(baseParts.mouth, intensity),
  }

  const breathVal = Math.sin(anim.breathPhase)
  if (breathVal > 0.8) {
    p.leftEye = EYE_WIDE[p.leftEye] ?? p.leftEye
    if (!anim.jitterActive) p.rightEye = EYE_WIDE[p.rightEye] ?? p.rightEye
  }

  if (anim.jitterActive) {
    const side = anim.time % 2 > 1 ? "leftEye" as const : "rightEye" as const
    p[side] = EYE_WIDE[p[side]] ?? p[side]
  }

  if (anim.blinkPhase > 0) {
    p.leftEye = blinkEye(p.leftEye, anim.blinkPhase + 0.3)
    p.rightEye = blinkEye(p.rightEye, anim.blinkPhase)
    if (anim.blinkPhase > 1) p.mouth = MOUTH_BLINK[p.mouth] ?? p.mouth
  }

  if (anim.glitchActive) {
    const keys = ["leftEye", "rightEye", "mouth"] as const
    const idx = Math.abs(Math.floor(Math.sin(anim.glitchSeed * 3.7) * 10000)) % keys.length
    p[keys[idx]] = glitchChar(anim.glitchSeed + idx * 7)
  }

  let face = mood.template
    .replace("{eL}", p.leftEye)
    .replace("{eR}", p.rightEye)
    .replace("{m}", p.mouth)
    .replace("{bL}", mood.parts.browL ?? "")
    .replace("{bR}", mood.parts.browR ?? "")
    .replace("{bl}", mood.parts.blush ?? "")
    .replace("{sw}", mood.parts.sweat ?? "")
    .replace("{ac}", mood.parts.accessory ?? "")

  const lines = face.split("\n").map(line => {
    let l = line
    if (anim.shiftOffset > 0) l = " " + l
    if (anim.shiftOffset < 0 && l.length > 1) l = l.slice(1)
    const shakeX = anim.shakeIntensity > 0 ? (Math.sin(anim.shakePhase * 30) > 0 ? " " : "") : ""
    const shakeTrim = anim.shakeIntensity > 0 && Math.sin(anim.shakePhase * 30) < 0 ? 1 : 0
    l = shakeX + l
    if (shakeTrim && l.length > 2) l = l.slice(1)
    return l
  })

  const label = transition && t < 0.5 ? transition.from.label : mood.label
  const color = transition && t < 0.5 ? transition.from.color : mood.color
  const particles = mood.particles ?? []

  let offsetY = 0
  if (mood.particleMode === "rain") offsetY = 0
  const bounceAmt = Math.abs(Math.sin(anim.bouncePhase)) * 0
  offsetY += bounceAmt

  return { lines, label, color, particles, offsetY }
}

export function generateParticles(chars: string[], width: number, tick: number): string[] {
  if (!chars.length) return []
  const totalW = width
  const lines: string[] = []
  const lineCount = 1 + (tick % 2)
  for (let i = 0; i < lineCount; i++) {
    const arr: string[] = Array(totalW).fill(" ")
    const pCount = 1 + (i + tick) % 2
    for (let j = 0; j < pCount; j++) {
      const seed = tick * 7 + i * 13 + j * 5
      const pos = Math.abs(((Math.sin(seed * 9.8) * 10000) % 1) * (totalW - 2) | 0)
      const char = chars[Math.abs(seed) % chars.length]
      arr[Math.min(pos + 1, totalW - 2)] = char
    }
    lines.push(arr.join(""))
  }
  return lines
}

export function generateRainParticles(chars: string[], width: number, tick: number): string[] {
  if (!chars.length) return []
  const lines: string[] = []
  const lineCount = 2
  for (let i = 0; i < lineCount; i++) {
    const arr: string[] = Array(width).fill(" ")
    const dropCount = 1 + (tick + i) % 2
    for (let j = 0; j < dropCount; j++) {
      const seed = tick * 3 + i * 17 + j * 11
      const pos = Math.abs(((Math.sin(seed * 4.3) * 10000) % 1) * (width - 2) | 0)
      const char = chars[Math.abs(seed) % chars.length]
      arr[Math.min(pos + 1, width - 2)] = char
    }
    lines.push(arr.join(""))
  }
  return lines
}

export function triggerShake(state: AnimState): AnimState {
  return { ...state, shakeIntensity: 1, shakePhase: 0 }
}

export function mergeMoods(base: Record<string, MoodDef>, overrides?: Partial<Record<string, Partial<MoodDef>>>): Record<string, MoodDef> {
  if (!overrides) return base
  const result = { ...base }
  for (const [key, override] of Object.entries(overrides)) {
    if (!override) continue
    result[key] = {
      ...result[key],
      ...override,
      parts: { ...result[key].parts, ...override.parts },
    }
  }
  return result
}

export function mergeStatus(base: Record<string, StatusDef>, overrides?: Partial<Record<string, Partial<StatusDef>>>): Record<string, StatusDef> {
  if (!overrides) return base
  const result = { ...base }
  for (const [key, override] of Object.entries(overrides)) {
    if (!override) continue
    const def = base[key]
    result[key] = {
      icon: override.icon ?? def?.icon ?? "●",
      text: override.text ?? def?.text ?? key,
      color: override.color ?? def?.color ?? "text",
    }
  }
  return result
}