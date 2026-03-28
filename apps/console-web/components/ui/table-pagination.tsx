"use client"

import { useMemo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface TablePaginationProps {
  page: number
  totalPages: number
  totalItems?: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: TablePaginationProps) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = totalItems ? Math.min(page * pageSize, totalItems) : page * pageSize

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        {totalItems != null
          ? `Showing ${start}–${end} of ${totalItems}`
          : `Page ${page} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** Hook for client-side pagination */
export function useClientPagination<T>(data: T[], pageSize = 20) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Reset page if data shrinks
  const safePage = Math.min(page, totalPages)
  if (safePage !== page) setPage(safePage)

  const paginatedData = useMemo(
    () => data.slice((safePage - 1) * pageSize, safePage * pageSize),
    [data, safePage, pageSize],
  )

  const handlePageChange = useCallback((p: number) => {
    setPage(Math.max(1, p))
  }, [])

  return {
    page: safePage,
    totalPages,
    totalItems: data.length,
    pageSize,
    paginatedData,
    onPageChange: handlePageChange,
  }
}
