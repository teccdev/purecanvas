import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Drawer({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

type DrawerSide = "right" | "bottom"

function DrawerContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: DrawerSide
  showCloseButton?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 isolate z-50 bg-black/40 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border-border bg-background/85 shadow-lg backdrop-blur-md outline-none",
          side === "right" &&
            "inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2"
                aria-label="Close"
              />
            }
          >
            <XIcon />
          </DrawerClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export { Drawer, DrawerClose, DrawerContent }
