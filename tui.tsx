import type { TuiPluginModule, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

type AnimState = {
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

type MoodDef = {
  template: string
  parts: { leftEye: string; rightEye: string; mouth: string }
  label: string
  color: string
  particles?: string[]
}

type RenderOutput = {
  lines: string[]
  label: string
  color: string
  particles: string[]
}

type SystemStatus = "idle" | "streaming" | "thinking" | "tool-running" | "tool-error" | "permission-wait" | "busy" | "retry"

const MOOD_DIR = join(tmpdir(), "opencode-mood")
const MOOD_SET = new Set(["happy", "sad", "excited", "focused", "celebrating", "done", "angry"])

const MODEL_MAP: Record<string, string> = {
  claude: "Claude ᵔᴥᵔ", gpt: "GPT •̀ᴗ•́", gemini: "Gemini ✧(≖◡≖)",
  qwen: "Qwen ᵔᴥᵔ", glm: "GLM ●—●", minimax: "MiniMax (ˆ▽ˆ)/",
  deepseek: "DeepSeek ◠◡◠", ollama: "Ollama 🐑",
}

const DEFAULT_STATUS: Record<string, { icon: string; text: string; color: string }> = {
  streaming:        { icon: "✏",  text: "responding...",   color: "accent" },
  thinking:         { icon: "💭", text: "thinking...",     color: "textMuted" },
  "tool-running":   { icon: "⚙",  text: "",               color: "warning" },
  "tool-error":     { icon: "⚠",  text: "failed",         color: "error" },
  "permission-wait": { icon: "🔒", text: "needs approval", color: "warning" },
  retry:            { icon: "↻",  text: "retrying ({n})", color: "error" },
  busy:             { icon: "⏳", text: "working...",     color: "warning" },
}

const STATUS_MOOD_MAP: Record<SystemStatus, string> = {
  idle: "idle",
  streaming: "excited",
  thinking: "focused",
  "tool-running": "focused",
  "tool-error": "angry",
  "permission-wait": "sad",
  busy: "focused",
  retry: "angry",
}

const SPINNER_FRAMES = ["━▶░░", "━▸░░", "━━▶░", "━━━▶"]

const BLINK_MAP: Record<string, [string, string]> = {
  "◕": ["˚", "·"], "◯": ["◌", "·"], "◉": ["◌", "·"], "O": ["◌", "·"],
  "▷": ["˃", "·"], "◁": ["˂", "·"], "△": ["˄", "·"], "▽": ["˅", "·"],
  "◔": ["˚", "·"], "◕": ["˚", "·"], "★": ["☆", "·"], "☆": ["·", "·"],
  "^": ["˜", "·"], "˜": ["·", "·"], "•": ["·", "·"], "◦": ["·", "·"],
  "ಠ": ["·", "·"], "ಡ": ["·", "·"],
}

const MOUTH_BLINK: Record<string, string> = {
  "‿": "_", "◡": "_", "ω": "_", "−": "–",
}

const EYE_WIDE: Record<string, string> = {
  "◕": "◯", "◔": "◕", "▷": "△", "◁": "▽", "★": "☆", "^": "˜",
  "•": "◦", "ಠ": "ಡ",
}

const GLITCH_CHARS = "!@#$%^&*~░▒▓▄▀■□◈◇"

const MOODS: Record<string, MoodDef> = {
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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createAnimState(): AnimState {
  return {
    time: 0, blinkPhase: 0, blinkTimer: rand(3000, 5000),
    breathPhase: 0, jitterTimer: rand(2000, 4000), jitterActive: false,
    glitchTimer: rand(30000, 60000), glitchActive: false, glitchFrames: 0, glitchSeed: 0,
    shiftTimer: rand(8000, 15000), shiftOffset: 0,
  }
}

function animTick(state: AnimState, dt: number): AnimState {
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

function glitchChar(seed: number): string {
  return GLITCH_CHARS[Math.abs(Math.floor(Math.sin(seed) * 10000)) % GLITCH_CHARS.length]
}

function render(anim: AnimState, mood: MoodDef): RenderOutput {
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

function generateParticles(chars: string[], width: number, tick: number): string[] {
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

function deriveStatus(api: TuiPluginApi, sessionID: string): { status: SystemStatus; toolName?: string; attempt?: number; message?: string } {
  try {
    const st = api.state.session.status(sessionID)
    if (st?.type === "retry") return { status: "retry", attempt: st.attempt, message: st.message }
    const perms = api.state.session.permission(sessionID)
    if (perms && perms.length > 0) return { status: "permission-wait" }
    if (st?.type !== "busy") return { status: "idle" }
    const messages = api.state.session.messages(sessionID)
    if (!messages?.length) return { status: "busy" }
    const last = messages[messages.length - 1]
    if (last.role !== "assistant") return { status: "busy" }
    const parts = api.state.part(last.id)
    if (!parts?.length) return { status: "busy" }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.type === "tool") {
        if ("status" in p.state && (p.state as any).status === "running") return { status: "tool-running", toolName: p.tool }
        if ("status" in p.state && (p.state as any).status === "error") return { status: "tool-error", toolName: p.tool }
      }
      if (p.type === "reasoning" && p.time && !(p.time as any).end) return { status: "thinking" }
      if (p.type === "text" && p.time && !(p.time as any).end) return { status: "streaming" }
    }
  } catch {}
  return { status: "idle" }
}

const plugin: TuiPluginModule = {
  id: "face-mood",
  async tui(api) {
    const [animState, setAnimState] = createSignal<AnimState>(createAnimState())
    const hz = 20
    const dt = 1000 / hz
    const engineTimer = setInterval(() => setAnimState(prev => animTick(prev, dt)), dt)
    onCleanup(() => clearInterval(engineTimer))

    const [pulse, setPulse] = createSignal(true)
    const pulseTimer = setInterval(() => setPulse(p => !p), 1500)
    onCleanup(() => clearInterval(pulseTimer))

    const th = () => api.theme.current

    api.slots.register({
      order: 0,
      slots: {
        sidebar_content(_ctx, props: { session_id: string }) {
          const sessionID = props.session_id
          const [poll, setPoll] = createSignal(0)
          const pollTimer = setInterval(() => setPoll(t => t + 1), 500)
          onCleanup(() => clearInterval(pollTimer))

          const mood = createMemo((): { mood: string; message?: string; time: number } | undefined => {
            poll()
            try {
              const file = join(MOOD_DIR, `${sessionID}.json`)
              if (!existsSync(file)) return
              const data = JSON.parse(readFileSync(file, "utf-8"))
              const ttl = 120_000
              if (data.time && Date.now() - data.time > ttl) return
              return data
            } catch { return }
          })

          const sysInfo = createMemo(() => {
            poll()
            return deriveStatus(api, sessionID)
          })

          const effectiveMood = createMemo((): string => {
            const customMood = mood()?.mood
            if (customMood && MOOD_SET.has(customMood as any)) return customMood
            const statusMood = STATUS_MOOD_MAP[sysInfo().status]
            return statusMood ?? "idle"
          })

          const faceOutput = createMemo(() => render(animState(), MOODS[effectiveMood()] ?? MOODS.idle))

          const particleLines = createMemo(() => {
            const p = faceOutput().particles
            if (!p.length) return [] as string[]
            const tick = Math.floor(animState().time / 250)
            return generateParticles(p, 22, tick)
          })

          const statusText = createMemo((): string => {
            const info = sysInfo()
            if (info.status === "idle") return " "
            const def = DEFAULT_STATUS[info.status]
            if (!def) return " "
            const tick = Math.floor(animState().time / 300) % SPINNER_FRAMES.length
            const spinner = info.status === "tool-running" ? " " + SPINNER_FRAMES[tick] : ""
            const toolStr = info.toolName ? " " + info.toolName : ""
            let text = def?.text?.replace("{n}", String(info.attempt ?? "?"))?.replace("{tool}", info.toolName ?? "") ?? ""
            return `${def?.icon ?? "●"} ${text}${toolStr}${spinner}`.trim()
          })

          const statusColor = createMemo((): string => {
            const info = sysInfo()
            if (info.status === "idle") return "textMuted"
            const def = DEFAULT_STATUS[info.status]
            return def?.color ?? "textMuted"
          })

          const retryLine = createMemo(() => {
            const info = sysInfo()
            if (info.status !== "retry") return ""
            return `↻ attempt ${info.attempt ?? "?"}${info.message ? " · " + info.message : ""}`
          })

          const modelBadge = createMemo(() => {
            try {
              const providers = api.state.provider
              if (!providers?.length) return
              const messages = api.state.session.messages(sessionID)
              if (!messages?.length) return
              const last = messages[messages.length - 1]
              if (last.role !== "assistant") return
              for (const p of providers) {
                if (p.id === last.providerID) {
                  const model = p.models?.[last.modelID]
                  if (model?.name) {
                    const lower = model.name.toLowerCase()
                    for (const [k, v] of Object.entries(MODEL_MAP)) if (lower.includes(k)) return v
                    return model.name
                  }
                }
              }
            } catch {}
            return
          })

          const moodLabel = createMemo(() => mood()?.message)

          return (
            <box flexDirection="column" paddingTop={1} paddingBottom={1}>
              <box flexDirection="row">
                <text fg={th().textMuted}>{modelBadge()}</text>
                <box flexGrow={1}></box>
                <text fg={th().textMuted}>{pulse() ? "♡" : "♥"}</text>
              </box>
              <box flexDirection="column" alignItems="center">
                <For each={faceOutput().lines}>
                  {(line) => <text fg={th()[faceOutput().color as keyof ReturnType<typeof th>] ?? th().text}>{line}</text>}
                </For>
                <text fg={th().textMuted}>{moodLabel() || faceOutput().label}</text>
              </box>
              <box height={2} flexDirection="column" alignItems="center">
                <For each={particleLines()}>
                  {(line) => <text fg={th().accent}>{line}</text>}
                </For>
              </box>
              <box paddingLeft={1} flexDirection="column">
                <text fg={th()[statusColor() as keyof ReturnType<typeof th>] ?? th().textMuted}>{statusText()}</text>
                <Show when={retryLine()}>
                  {(line) => <text fg={th().error}>{line()}</text>}
                </Show>
              </box>
            </box>
          )
        },
      },
    })
  },
}

export default plugin