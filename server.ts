import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { writeFileSync, mkdirSync, unlinkSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const MOOD_DIR = join(tmpdir(), "opencode-mood")
const MOODS = ["happy", "sad", "excited", "focused", "celebrating", "done", "angry"] as const
type Mood = (typeof MOODS)[number]

const KEYWORDS: Record<string, string[]> = {
  happy: ["cảm ơn", "thanks", "thank you", "tuyệt", "hay quá", "good", "great", "awesome", "nice", "perfect"],
  excited: ["feature", "new", "mới", "thêm", "tạo mới", "build", "implement"],
  focused: ["refactor", "cleanup", "tối ưu", "optimize", "perf", "sửa lỗi", "fix bug"],
  celebrating: ["merge", "deploy", "release", "hoàn thành", "xong"],
  angry: ["lại", "again", "vẫn", "still", "failed", "thất bại"],
}

const MOOD_STATES = new Set(MOODS)

function detectMood(text: string): string | undefined {
  const lower = text.toLowerCase()
  let best: string | undefined
  let bestCount = 0
  for (const [mood, words] of Object.entries(KEYWORDS)) {
    let count = 0
    for (const w of words) if (lower.includes(w)) count++
    if (count > bestCount) { bestCount = count; best = mood }
  }
  return bestCount > 0 ? best : undefined
}

function writeMood(sessionID: string, data: { mood: Mood; message?: string; time: number }) {
  mkdirSync(MOOD_DIR, { recursive: true })
  writeFileSync(join(MOOD_DIR, `${sessionID}.json`), JSON.stringify(data))
}

const plugin: Plugin = {
  async server() {
    return {
      tool: {
        set_mood: tool({
          description: "Express your current emotion before responding. Call this to set the face in the TUI.",
          args: {
            mood: tool.schema.enum(MOODS).describe("Your emotion: happy, sad, excited, focused, celebrating, done, angry"),
            message: tool.schema.string().optional().describe("Short message displayed under the face (max 30 chars)"),
          },
          async execute(args, context) {
            writeMood(context.sessionID, { mood: args.mood as Mood, message: args.message?.slice(0, 30), time: Date.now() })
            return `Mood set to ${args.mood}`
          },
        }),
        clear_mood: tool({
          description: "Clear custom mood, revert to system-detected face.",
          args: {},
          async execute(_args, context) {
            try { unlinkSync(join(MOOD_DIR, `${context.sessionID}.json`)) } catch {}
            return "Mood cleared"
          },
        }),
      },
      "chat.message": async (input, output) => {
        if (input.agent !== "opencode") return

        try {
          const files = readdirSync(MOOD_DIR)
          for (const file of files) {
            if (!file.endsWith(".json")) continue
            unlinkSync(join(MOOD_DIR, file))
          }
        } catch {}

        const text = (output.parts ?? [])
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map(p => p.text)
          .join(" ")
        if (!text) return
        const mood = detectMood(text)
        if (!mood || !MOOD_STATES.has(mood)) return
        writeMood(input.sessionID, { mood: mood as Mood, message: mood, time: Date.now() })
      },
    }
  },
}

export default plugin