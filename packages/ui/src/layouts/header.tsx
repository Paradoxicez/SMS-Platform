import * as React from "react"

import { cn } from "../lib/utils"

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  tenantName: string
}

export function Header({ tenantName, className, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b bg-background px-6",
        className
      )}
      {...props}
    >
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        {/* Breadcrumbs placeholder */}
        <span>Home</span>
        <span>/</span>
        <span className="text-foreground">Page</span>
      </nav>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">{tenantName}</span>
      </div>
    </header>
  )
}
