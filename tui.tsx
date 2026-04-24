import type { TuiPluginModule, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { tmpdir } from "os"
import {
  createAnimState, animTick, render, generateParticles, generateRainParticles,
  mergeMoods, mergeStatus,
  statusToMood, resolveMoodDef, resolveIdleMood,
  createTransitionState, updateTransition, triggerShake,
  DEFAULT_SETTINGS, DEFAULT_STATUS, DEFAULT_MOODS,
  type AnimState, type MoodDef, type ThemeFile, type ThemeSettings, type StatusDef, type TransitionState
} from "./engine"

type SystemStatus = "idle" | "streaming" | "thinking" | "tool-running" | "tool-error" | "permission-wait" | "busy" | "retry"

const MOOD_DIR = join(tmpdir(), "opencode-mood")
const MOOD_SET = new Set([
  "happy", "sad", "excited", "focused", "celebrating", "done", "angry",
  "confused", "nervous", "smug", "sleepy",
])

const MODEL_MAP: Record<string, string> = {
  claude: "Claude ᵔᴥᵔ", gpt: "GPT •̀ᴗ•́", gemini: "Gemini ✧(≖◡≖)",
  qwen: "Qwen ᵔᴥᵔ", glm: "GLM ●—●", minimax: "MiniMax (ˆ▽ˆ)/",
  deepseek: "DeepSeek ◠◡◠", ollama: "Ollama 🐑",
}

const SPINNER_FRAMES = ["━▶░░", "━▸░░", "━━▶░", "━━━▶"]

function loadTheme(base: string): { settings: ThemeSettings; status: Record<string, StatusDef>; moods: Record<string, MoodDef> } {
  try {
    const file = join(base, "face-theme.json")
    if (!existsSync(file)) return { settings: DEFAULT_SETTINGS, status: DEFAULT_STATUS, moods: DEFAULT_MOODS }
    const raw = JSON.parse(readFileSync(file, "utf-8")) as ThemeFile
    return {
      settings: { ...DEFAULT_SETTINGS, ...raw.settings },
      status: mergeStatus(DEFAULT_STATUS, raw.status),
      moods: mergeMoods(DEFAULT_MOODS, raw.moods),
    }
  } catch {
    return { settings: DEFAULT_SETTINGS, status: DEFAULT_STATUS, moods: DEFAULT_MOODS }
  }
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
    const base = dirname(fileURLToPath(import.meta.url))
    const theme = loadTheme(base)
    const { settings, status: statusDefs, moods: moodDefs } = theme

    const [animState, setAnimState] = createSignal<AnimState>(createAnimState())
    const hz = settings.engine_hz ?? 20
    const dt = 1000 / hz
    const engineTimer = setInterval(() => setAnimState(prev => animTick(prev, dt)), dt)
    onCleanup(() => clearInterval(engineTimer))

    const [pulse, setPulse] = createSignal(true)
    const pulseTimer = setInterval(() => setPulse(p => !p), 1500)
    onCleanup(() => clearInterval(pulseTimer))

    const [transition, setTransition] = createSignal<TransitionState | undefined>()
    const prevMoodName = { current: "idle" }

    const th = () => api.theme.current

    api.slots.register({
      order: 0,
      slots: {
        sidebar_content(_ctx, props: { session_id: string }) {
          const sessionID = props.session_id
          const [poll, setPoll] = createSignal(0)
          const pollTimer = setInterval(() => setPoll(t => t + 1), settings.poll_ms ?? 500)
          onCleanup(() => clearInterval(pollTimer))

          const [lastActivity, setLastActivity] = createSignal(Date.now())

          const mood = createMemo((): { mood: string; message?: string; intensity?: number; time: number } | undefined => {
            poll()
            try {
              const file = join(MOOD_DIR, `${sessionID}.json`)
              if (!existsSync(file)) return
              const data = JSON.parse(readFileSync(file, "utf-8"))
              const ttl = settings.mood_ttl_ms ?? 20_000
              if (data.time && Date.now() - data.time > ttl) return
              return data
            } catch { return }
          })

          const sysInfo = createMemo(() => {
            poll()
            return deriveStatus(api, sessionID)
          })

          const idleDurationMs = createMemo((): number => {
            const info = sysInfo()
            if (info.status !== "idle") {
              setLastActivity(Date.now())
              return 0
            }
            return Date.now() - lastActivity()
          })

          const effectiveMood = createMemo((): string => {
            const customMood = mood()?.mood
            if (customMood && MOOD_SET.has(customMood as any)) return customMood
            const info = sysInfo()
            if (info.status === "idle") return resolveIdleMood(idleDurationMs(), settings)
            return statusToMood(info.status, info.toolName)
          })

          const currentMoodDef = createMemo((): MoodDef => {
            const name = effectiveMood()
            return resolveMoodDef(name, moodDefs)
          })

          const currentTransition = createMemo((): TransitionState | undefined => {
            const name = effectiveMood()
            if (name !== prevMoodName.current) {
              const prev = resolveMoodDef(prevMoodName.current, moodDefs)
              const next = resolveMoodDef(name, moodDefs)
              prevMoodName.current = name
              if (prev.label !== next.label) {
                setTransition(createTransitionState(prev, next, Date.now()))
                setAnimState(prev => triggerShake(prev))
              }
            }
            const t = transition()
            const updated = updateTransition(t, Date.now(), settings.transition_ms ?? 400)
            if (!updated && t) setTransition(undefined)
            return updated
          })

          const faceOutput = createMemo(() => {
            const moodDef = currentMoodDef()
            const intensity = mood()?.intensity
            const def = intensity != null ? { ...moodDef, intensity: Math.min(1, Math.max(0, intensity)) } : moodDef
            return render(animState(), def, currentTransition())
          })

          const particleLines = createMemo(() => {
            const p = faceOutput().particles
            if (!p.length) return [] as string[]
            const tick = Math.floor(animState().time / 250)
            const mode = currentMoodDef().particleMode
            if (mode === "rain") return generateRainParticles(p, settings.box_width ?? 22, tick)
            return generateParticles(p, settings.box_width ?? 22, tick)
          })

          const statusText = createMemo((): string => {
            const info = sysInfo()
            if (info.status === "idle") return " "
            const def = statusDefs[info.status]
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
            const def = statusDefs[info.status]
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
