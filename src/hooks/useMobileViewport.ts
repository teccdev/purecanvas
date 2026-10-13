import { useEffect } from "react"
import { MOBILE_MEDIA_QUERY, useUI } from "@/store/useUI"

/**
 * Keeps `useUI().isMobile` in sync with the viewport width and pointer type so
 * components can branch on a single flag without re-routing the whole store.
 */
export function useMobileViewport(): void {
  const setIsMobile = useUI((s) => s.setIsMobile)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const sync = () => setIsMobile(mql.matches)
    sync()
    mql.addEventListener("change", sync)
    return () => mql.removeEventListener("change", sync)
  }, [setIsMobile])
}
