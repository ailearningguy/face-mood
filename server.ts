import type { PluginInput } from "@opencode-ai/plugin"
import type { Hooks } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { writeFileSync, mkdirSync, unlinkSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const MOOD_DIR = join(tmpdir(), "opencode-mood")
const MOODS = ["happy", "sad", "excited", "focused", "celebrating", "done", "angry"] as const
type Mood = (typeof MOODS)[number]

function writeMood(sessionID: string, data: { mood: Mood; message?: string; time: number }) {
  mkdirSync(MOOD_DIR, { recursive: true })
  writeFileSync(join(MOOD_DIR, `${sessionID}.json`), JSON.stringify(data))
}

const setMoodTool = tool({
  description: "Express your current emotion before responding. Call this to set the face in the TUI.",
  args: {
    mood: tool.schema.enum(MOODS).describe("Your emotion: happy, sad, excited, focused, celebrating, done, angry"),
    message: tool.schema.string().optional().describe("Short message displayed under the face (max 30 chars)"),
  },
  async execute(args, context) {
    writeMood(context.sessionID, { mood: args.mood as Mood, message: args.message?.slice(0, 30), time: Date.now() })
    return `Mood set to ${args.mood}`
  },
})

const clearMoodTool = tool({
  description: "Clear custom mood, revert to system-detected face.",
  args: {},
  async execute(_args, context) {
    try { unlinkSync(join(MOOD_DIR, `${context.sessionID}.json`)) } catch {}
    return "Mood cleared"
  },
})

export default {
  id: "face-mood",
  server: async (_input: PluginInput, _options?: Record<string, unknown>): Promise<Hooks> => {
    return {
      tool: {
        set_mood: setMoodTool,
        clear_mood: clearMoodTool,
      },
    }
  },
}