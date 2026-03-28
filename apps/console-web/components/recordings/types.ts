export interface Recording {
  id: string
  cameraId: string
  cameraName?: string
  startTime: string
  endTime: string | null
  fileFormat: string
  sizeBytes: number
  retentionDays: number
  storageType: string
  hlsUrl?: string
}
