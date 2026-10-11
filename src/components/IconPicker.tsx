import { useMemo, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLucideIcon, LUCIDE_NAMES, MATERIAL_NAMES } from "@/lib/icons"
import type { IconLib } from "@/lib/types"
import { cn } from "@/lib/utils"

const LIMIT = 320

function materialUrl(name: string) {
  return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/24px.svg`
}

export function IconPicker({
  lib,
  name,
  onChange,
}: {
  lib: IconLib
  name: string
  onChange: (lib: IconLib, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<IconLib>(lib)
  const [query, setQuery] = useState("")

  const lucideResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? LUCIDE_NAMES.filter((n) => n.toLowerCase().includes(q)) : LUCIDE_NAMES
    return list.slice(0, LIMIT)
  }, [query])

  const materialResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? MATERIAL_NAMES.filter((n) => n.toLowerCase().includes(q)) : MATERIAL_NAMES
    return list.slice(0, LIMIT)
  }, [query])

  const Current = lib === "lucide" ? getLucideIcon(name) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2 truncate">
              {lib === "lucide" && Current ? (
                <Current className="size-4 text-foreground" />
              ) : (
                <img
                    src={materialUrl(name)}
                    alt=""
                    loading="lazy"
                    className="size-4 dark:invert"
                />
              )}
              <span className="truncate">{name}</span>
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent className="w-80 p-2">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as IconLib)}
          className="flex flex-col gap-2"
        >
          <TabsList className="w-full">
            <TabsTrigger value="lucide" className="flex-1">
              Lucide
            </TabsTrigger>
            <TabsTrigger value="material" className="flex-1">
              Google Symbols
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="pl-8"
          />
        </div>
        <ScrollArea className="mt-2 h-64">
          {tab === "lucide" ? (
            <div className="grid grid-cols-8 gap-0.5 pr-3">
              {lucideResults.map((n) => {
                const Icon = getLucideIcon(n)
                if (!Icon) return null
                return (
                  <button
                    key={n}
                    type="button"
                    title={n}
                    onClick={() => {
                      onChange("lucide", n)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md text-foreground hover:bg-accent",
                      lib === "lucide" && name === n && "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-0.5 pr-3">
              {materialResults.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => {
                    onChange("material", n)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md hover:bg-accent",
                    lib === "material" && name === n && "bg-secondary"
                  )}
                >
                  <img
                    src={materialUrl(n)}
                    alt={n}
                    loading="lazy"
                    className="size-5 dark:invert"
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
