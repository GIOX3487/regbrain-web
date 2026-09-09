import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface MobileSheetProps {
  children: React.ReactNode
  trigger: React.ReactNode
  title?: string
  description?: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}

export function MobileSheet({
  children,
  trigger,
  title,
  description,
  className,
  side = "bottom"
}: MobileSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent 
        side={side}
        className={cn(
          "max-h-[85vh] overflow-y-auto mobile-scroll",
          side === "bottom" && "rounded-t-2xl",
          className
        )}
      >
        {(title || description) && (
          <SheetHeader className="text-left">
            {title && <SheetTitle className="text-lg sm:text-xl">{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div className="py-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
