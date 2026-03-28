export interface Recording {
  id: string
  camera_id: string
  tenant_id?: string
  camera_name?: string
  start_time: string
  end_time: string | null
  file_path?: string
  file_format: string
  size_bytes: number
  retention_days: number
  storage_type: string
  s3_bucket?: string | null
  s3_key?: string | null
  created_at?: string
}
