export function extractArray<T>(obj: unknown, key: string): T[] {
  if (obj && typeof obj === 'object' && key in obj) {
    const list = (obj as Record<string, unknown>)[key]
    if (Array.isArray(list)) return list as T[]
  }
  return []
}
