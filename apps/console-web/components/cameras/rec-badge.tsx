"use client"

interface RecBadgeProps {
  className?: string
}

export function RecBadge({ className }: RecBadgeProps) {
  return (
    <div className={`flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white ${className ?? ""}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      REC
    </div>
  )
}
