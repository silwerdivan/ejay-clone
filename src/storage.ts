import { freshDemo, loopById, type Block } from './data'

const STORAGE_KEY = 'pulse-eight-arrangement-v1'

export function loadArrangement(): Block[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!Array.isArray(saved) || saved.length > 32) return freshDemo()
    const ids = new Set<string>()
    const slots = new Set<string>()
    for (const block of saved) {
      if (!block || typeof block !== 'object') return freshDemo()
      const { id, loopId, bar } = block as Record<string, unknown>
      const loop = typeof loopId === 'string' ? loopById(loopId) : undefined
      const slot = `${loop?.lane}:${bar}`
      if (
        typeof id !== 'string' || !id || ids.has(id) || !loop ||
        !Number.isInteger(bar) || (bar as number) < 0 || (bar as number) > 7 || slots.has(slot)
      ) return freshDemo()
      ids.add(id)
      slots.add(slot)
    }
    return saved as Block[]
  } catch {
    return freshDemo()
  }
}

export function saveArrangement(arrangement: Block[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arrangement))
    return true
  } catch {
    return false
  }
}
