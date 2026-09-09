import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface MobileTableProps {
  headers: string[]
  rows: React.ReactNode[][]
  className?: string
}

/**
 * Mobile-optimized table component that shows as cards on small screens
 * and as a traditional table on larger screens
 */
export function MobileTable({ headers, rows, className }: MobileTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className={cn("hidden lg:block overflow-x-auto", className)}>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {headers.map((header, i) => (
                <th key={i} className="text-left p-4 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="p-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {rows.map((row, i) => (
          <Card key={i} className="p-4 space-y-3 animate-fade-in">
            {row.map((cell, j) => (
              <div key={j} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  {headers[j]}
                </span>
                <div className="text-sm">
                  {cell}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  )
}
