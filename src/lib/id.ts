import { nanoid } from "nanoid"

export function uid(prefix = ""): string {
  return prefix ? `${prefix}_${nanoid(10)}` : nanoid(12)
}
