import type { Element } from "./types"

/** Expand a hit list so selecting any member selects its whole group. */
export function expandToGroups(elements: Element[], ids: string[]): string[] {
  const wanted = new Set<string>()
  const byId = new Map(elements.map((el) => [el.id, el]))
  for (const id of ids) {
    const el = byId.get(id)
    if (!el) continue
    if (el.groupId) {
      for (const member of elements) {
        if (member.groupId === el.groupId) wanted.add(member.id)
      }
    } else {
      wanted.add(id)
    }
  }
  return elements.filter((el) => wanted.has(el.id)).map((el) => el.id)
}

/** Give copied elements fresh group ids so a duplicate is its own group. */
export function remapGroupIds<T extends { groupId?: string }>(
  items: T[],
  newId: () => string,
): T[] {
  const map = new Map<string, string>()
  return items.map((item) => {
    if (!item.groupId) return item
    let next = map.get(item.groupId)
    if (!next) {
      next = newId()
      map.set(item.groupId, next)
    }
    return { ...item, groupId: next }
  })
}

/** A group of one is just an object. Drop the grouping fields. */
export function dissolveSingletonGroups(elements: Element[]): Element[] {
  const counts = new Map<string, number>()
  for (const el of elements) {
    if (el.groupId) counts.set(el.groupId, (counts.get(el.groupId) ?? 0) + 1)
  }
  return elements.map((el) => {
    if (!el.groupId || (counts.get(el.groupId) ?? 0) >= 2) return el
    const next = { ...el }
    delete next.groupId
    delete next.groupName
    return next
  })
}
