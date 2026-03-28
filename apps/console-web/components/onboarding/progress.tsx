"use client"

import { Check } from "lucide-react"

interface ProgressProps {
  steps: string[]
  currentStep: number
}

export function OnboardingProgress({ steps, currentStep }: ProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0 px-4">
      {steps.map((label, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep

        return (
          <div key={label} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors ${
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                }`}
              >
                {isCompleted ? (
                  <Check className="size-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] max-w-[60px] text-center leading-tight ${
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-8 transition-colors ${
                  index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
