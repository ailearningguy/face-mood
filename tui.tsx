import type { TuiPluginModule, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { tmpdir } from "os"
import {
  createAnimState, animTick, render, generateParticles,
  mergeMoods, mergeStatus,
  DEFAULT_SETTINGS, DEFAULT_STATUS, DEFAULT_MOODS, STATUS_MOOD_MAP,
  type AnimState, type MoodDef, type ThemeFile, type ThemeSettings, type StatusDef
} from "./engine"

type SystemStatus = "idle" | "streaming" | "thinking" | "tool-running" | "tool-error" | "permission-wait" | "busy" | "retry"

const MOOD_DIR = join(tmpdir(), "opencode-mood")
const MOOD_SET = new Set(["happy", "sad", "excited", "focused", "celebrating", "done", "angry"])

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

    const th = () => api.theme.current

    api.slots.register({
      order: 0,
      slots: {
        sidebar_content(_ctx, props: { session_id: string }) {
          const sessionID = props.session_id
          const [poll, setPoll] = createSignal(0)
          const pollTimer = setInterval(() => setPoll(t => t + 1), settings.poll_ms ?? 500)
          onCleanup(() => clearInterval(pollTimer))

          const mood = createMemo((): { mood: string; message?: string; time: number } | undefined => {
            poll()
            try {
              const file = join(MOOD_DIR, `${sessionID}.json`)
              if (!existsSync(file)) return
              const data = JSON.parse(readFileSync(file, "utf-8"))
              const ttl = settings.mood_ttl_ms ?? 120_000
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

          const faceOutput = createMemo(() => render(animState(), moodDefs[effectiveMood()] ?? moodDefs.idle))

          const particleLines = createMemo(() => {
            const p = faceOutput().particles
            if (!p.length) return [] as string[]
            const tick = Math.floor(animState().time / 250)
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