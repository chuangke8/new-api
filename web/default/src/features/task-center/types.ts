/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type TaskCenterStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | string

export type TaskCenterDetailPayload = {
  prompt?: string
  negative_prompt?: string
  input_text?: string
  output_text?: string
  images?: string[]
  videos?: string[]
  audios?: string[]
  files?: string[]
  reference_images?: string[]
  size?: string
  ratio?: string
  style?: string
  quality?: string
  duration?: string
  provider?: string
  metadata?: Record<string, unknown>
}

export type TaskCenterRecord = {
  id: number
  source: string
  submit_source: string
  source_id: string
  task_id: string
  user_id: number
  username_snapshot: string
  task_type: string
  tags: string
  model: string
  status: TaskCenterStatus
  cost: number
  remark: string
  submitted_at: number
  completed_at: number
  detail?: string
  raw_request?: string
  raw_response?: string
  error_message?: string
  error_detail?: string
  created_at: number
  updated_at: number
}

export type TaskCenterListParams = {
  p?: number
  page_size?: number
  keyword?: string
  task_type?: string
  status?: string
  model?: string
  user?: string
  tag?: string
  submit_source?: string
  submitted_start?: number
  submitted_end?: number
}

export type TaskCenterPage = {
  page: number
  page_size: number
  total: number
  items: TaskCenterRecord[]
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}
