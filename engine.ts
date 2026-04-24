export type FaceParts = { leftEye: string; rightEye: string; mouth: string }

export type MoodDef = {
  template: string
  parts: FaceParts
  label: string
  color: string
  particles?: string[]
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
}

export type RenderOutput = {
  lines: string[]
  label: string
  color: string
  particles: string[]
}

export type ThemeSettings = {
  poll_ms?: number
  mood_ttl_ms?: number
  engine_hz?: number
  box_width?: number
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
  mood_ttl_ms: 120_000,
  engine_hz: 20,
  box_width: 18,
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

export function createAnimState(): AnimState {
  return {
    time: 0, blinkPhase: 0, blinkTimer: rand(3000, 5000),
    breathPhase: 0, jitterTimer: rand(2000, 4000), jitterActive: false,
    glitchTimer: rand(30000, 60000), glitchActive: false, glitchFrames: 0, glitchSeed: 0,
    shiftTimer: rand(8000, 15000), shiftOffset: 0,
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

export function render(anim: AnimState, mood: MoodDef): RenderOutput {
  const p = { ...mood.parts }

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

  let face = mood.template.replace("{eL}", p.leftEye).replace("{eR}", p.rightEye).replace("{m}", p.mouth)

  if (anim.shiftOffset > 0) face = " " + face
  if (anim.shiftOffset < 0 && face.length > 1) face = face.slice(1)

  return { lines: [face], label: mood.label, color: mood.color, particles: mood.particles ?? [] }
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