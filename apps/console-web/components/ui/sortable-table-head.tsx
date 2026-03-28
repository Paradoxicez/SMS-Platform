"use client"

import { useState, useCallback } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc" | null

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: string) => void
  children: React.ReactNode
}

export function SortableTableHead({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey

  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded",
          isActive && "text-foreground",
        )}
      >
        {children}
        {isActive && currentDirection === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : isActive && currentDirection === "desc" ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  )
}

/** Hook for managing sort state */
export function useTableSort(defaultKey?: string, defaultDir: SortDirection = null) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey ?? null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDir)

  const handleSort = useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDir) => {
          if (prevDir === "asc") return "desc"
          if (prevDir === "desc") { setTimeout(() => setSortKey(null), 0); return null }
          return "asc"
        })
        return key
      }
      setSortDirection("asc")
      return key
    })
  }, [])

  const sortData = useCallback(
    <T,>(data: T[], accessor: (item: T, key: string) => unknown): T[] => {
      if (!sortKey || !sortDirection) return data
      return [...data].sort((a, b) => {
        const aVal = accessor(a, sortKey)
        const bVal = accessor(b, sortKey)
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }
        const aStr = String(aVal)
        const bStr = String(bVal)
        return sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr)
      })
    },
    [sortKey, sortDirection],
  )

  return { sortKey, sortDirection, handleSort, sortData }
}
