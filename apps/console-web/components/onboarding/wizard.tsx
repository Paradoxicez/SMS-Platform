"use client"

import { useState } from "react"
import { getApiBaseUrl } from "@/lib/api-url"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OnboardingProgress } from "./progress"
import { Loader2, CheckCircle2, Rocket, FolderKanban, MapPin, Camera, Wifi } from "lucide-react"

interface WizardProps {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

const STEPS = ["Welcome", "Project", "Site", "Camera", "Verify", "Done"]

export function OnboardingWizard({ open, onComplete, onSkip }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [siteName, setSiteName] = useState("")
  const [siteLocation, setSiteLocation] = useState("")
  const [cameraName, setCameraName] = useState("")
  const [cameraRtspUrl, setCameraRtspUrl] = useState("")

  // Created resource IDs
  const [projectId, setProjectId] = useState("")
  const [siteId, setSiteId] = useState("")
  const [cameraOnline, setCameraOnline] = useState<boolean | null>(null)

  const apiBase = getApiBaseUrl()

  async function apiCall(path: string, body: Record<string, unknown>) {
    // We need to use the api-client pattern with session token
    // For simplicity, call via Next.js API proxy or direct with credentials
    const resp = await fetch(`/api/proxy${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)

    // Fallback: call apiClient directly
    if (!resp || !resp.ok) {
      const directRes = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!directRes.ok) {
        const err = await directRes.json().catch(() => null)
        throw new Error(err?.error?.message ?? "Request failed")
      }
      return directRes.json()
    }
    return resp.json()
  }

  async function handleNext() {
    setError("")
    setLoading(true)

    try {
      switch (currentStep) {
        case 0:
          // Welcome — just advance
          break

        case 1: {
          // Create Project
          if (!projectName.trim()) {
            setError("Project name is required.")
            setLoading(false)
            return
          }
          try {
            const data = await apiCall("/projects", {
              name: projectName,
              description: projectDescription,
            })
            setProjectId(data?.data?.id ?? "")
          } catch {
            // Continue anyway — project might exist
          }
          break
        }

        case 2: {
          // Create Site
          if (!siteName.trim()) {
            setError("Site name is required.")
            setLoading(false)
            return
          }
          if (projectId) {
            try {
              const data = await apiCall(`/projects/${projectId}/sites`, {
                name: siteName,
                location: siteLocation,
              })
              setSiteId(data?.data?.id ?? "")
            } catch {
              // Continue anyway
            }
          }
          break
        }

        case 3: {
          // Add Camera
          if (!cameraName.trim() || !cameraRtspUrl.trim()) {
            setError("Camera name and RTSP URL are required.")
            setLoading(false)
            return
          }
          if (siteId) {
            try {
              await apiCall(`/sites/${siteId}/cameras`, {
                name: cameraName,
                rtsp_url: cameraRtspUrl,
              })
            } catch {
              // Continue anyway
            }
          }
          break
        }

        case 4: {
          // Verify Stream — check camera health
          setCameraOnline(null)
          try {
            const res = await fetch(`${apiBase}/cameras`, {
              credentials: "include",
            })
            if (res.ok) {
              const body = await res.json()
              const cam = body?.data?.find(
                (c: { name: string }) => c.name === cameraName
              )
              setCameraOnline(cam?.health_status === "online")
            }
          } catch {
            setCameraOnline(false)
          }
          break
        }

        case 5: {
          // Done — mark onboarding complete
          try {
            await fetch(`${apiBase}/onboarding/complete`, {
              method: "POST",
              credentials: "include",
            })
          } catch {
            // non-fatal
          }
          onComplete()
          setLoading(false)
          return
        }
      }

      setCurrentStep((s) => s + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setError("")
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  async function handleSkip() {
    try {
      await fetch(`${getApiBaseUrl()}/onboarding/skip`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // non-fatal
    }
    onSkip()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Setup Wizard</DialogTitle>
          <DialogDescription className="sr-only">
            Complete the onboarding wizard to set up your CCTV platform.
          </DialogDescription>
          <div className="pt-2">
            <OnboardingProgress steps={STEPS} currentStep={currentStep} />
          </div>
        </DialogHeader>

        <div className="min-h-[200px] py-4">
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="size-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Welcome to CCTV Platform</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Let&apos;s get you set up in a few simple steps. We&apos;ll create your
                first project, add a site, and connect a camera.
              </p>
            </div>
          )}

          {/* Step 1: Create Project */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <FolderKanban className="size-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Create a Project</h3>
                  <p className="text-xs text-muted-foreground">
                    Projects group your sites and cameras together.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. Office Building"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description (optional)</Label>
                <Input
                  id="project-desc"
                  placeholder="Brief description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Create Site */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="size-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Add a Site</h3>
                  <p className="text-xs text-muted-foreground">
                    A site represents a physical location where cameras are deployed.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input
                  id="site-name"
                  placeholder="e.g. Main Office"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-location">Location (optional)</Label>
                <Input
                  id="site-location"
                  placeholder="e.g. 123 Main St"
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Add Camera */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Camera className="size-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Add a Camera</h3>
                  <p className="text-xs text-muted-foreground">
                    Connect your first RTSP camera to start streaming.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="camera-name">Camera Name</Label>
                <Input
                  id="camera-name"
                  placeholder="e.g. Lobby Entrance"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camera-rtsp">RTSP URL</Label>
                <Input
                  id="camera-rtsp"
                  placeholder="rtsp://192.168.1.100:554/stream"
                  value={cameraRtspUrl}
                  onChange={(e) => setCameraRtspUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 4: Verify Stream */}
          {currentStep === 4 && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Wifi className="size-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Verify Stream</h3>
              {cameraOnline === null && (
                <p className="text-sm text-muted-foreground">
                  We&apos;ll check if your camera is reachable and streaming. Click Next to
                  verify.
                </p>
              )}
              {cameraOnline === true && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="size-5" />
                    <span className="text-sm font-medium">Camera is online!</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your camera &quot;{cameraName}&quot; is connected and streaming.
                  </p>
                </div>
              )}
              {cameraOnline === false && (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 font-medium">
                    Camera not yet online
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The camera may take a moment to connect. You can continue and check
                    later from the dashboard.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Done */}
          {currentStep === 5 && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="size-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">You&apos;re all set!</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your platform is ready. Head to the dashboard to monitor your
                cameras and manage your infrastructure.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {currentStep > 0 && currentStep < 5 && (
              <Button variant="ghost" onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep < 5 && (
              <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                Skip setup
              </Button>
            )}
            <Button onClick={handleNext} disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {currentStep === 5
                ? "Go to Dashboard"
                : currentStep === 0
                  ? "Get Started"
                  : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
