import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const SEEN_KEY = "purecanvas-mobile-welcome-seen"

function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1"
  } catch {
    // Storage blocked (private mode): show it, it just won't persist.
    return false
  }
}

/**
 * One-time overlay shown the first time a visitor lands on a mobile/touch
 * viewport. Recommends the desktop app and records the dismissal in
 * localStorage so it only appears once. Not a gate — it can be closed at any
 * time and never blocks the app.
 */
export function MobileWelcomeDialog() {
  const [open, setOpen] = useState(() => !hasSeenWelcome())

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1")
    } catch {
      /* storage unavailable */
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent aria-label="Welcome to PureCanvas">
        <DialogHeader>
          <DialogTitle>Welcome to PureCanvas</DialogTitle>
          <DialogDescription>
            You're on a small screen. PureCanvas was designed for desktop and
            works best with a mouse and keyboard — for the full experience,
            consider opening it on a computer.
          </DialogDescription>
        </DialogHeader>
        <DialogDescription>
          On mobile you can draw with the tools at the bottom, pan with one
          finger, pinch to zoom, tap to select, and press and hold to draw a
          selection box.
        </DialogDescription>
        <DialogFooter>
          <Button onClick={dismiss}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
