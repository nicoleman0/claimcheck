// Model IDs and endpoints in one place.
export const models = {
  jev: "typesafe/jev-1.14",
  draft: "deepseek/deepseek-v4.1-flash",
  draftFallback: "z-ai/glm-5.3-flash",
} as const

export const endpoints = {
  decisions: "https://openrouter.ai/api/alpha/decisions",
  chat: "https://openrouter.ai/api/v1/chat/completions",
} as const

export const timeouts = { jev: 10_000, draft: 15_000, draftFallback: 25_000, check: 5_000 } as const

export function openrouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY is not set")
  return key
}
