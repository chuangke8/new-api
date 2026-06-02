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
import type { TaskCenterDetailPayload } from './types'

export const TASK_CENTER_TAG_TRANSLATION_KEYS: Record<string, string> = {
  api: 'API',
  audio: 'Audio',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  drawing: 'Drawing',
  failed: 'Failed',
  generation: 'Generation',
  image: 'Image',
  imagine: 'Imagine',
  midjourney: 'Midjourney',
  other: 'Other',
  pending: 'Pending',
  running: 'Running',
  submit: 'Submit',
  succeeded: 'Succeeded',
  success: 'Succeeded',
  task: 'Task',
  upscale: 'Upscale',
  variation: 'Variation',
  video: 'Video',
  workspace: 'Workspace',
}

export const TASK_CENTER_ZH_TAG_TO_RAW: Record<string, string> = {
  API: 'api',
  任务: 'task',
  工作台: 'workspace',
  绘图: 'drawing',
  图片: 'image',
  图像: 'image',
  视频: 'video',
  音频: 'audio',
  其他: 'other',
  等待中: 'pending',
  运行中: 'running',
  处理中: 'running',
  已成功: 'succeeded',
  成功: 'succeeded',
  已失败: 'failed',
  失败: 'failed',
  已取消: 'cancelled',
  取消: 'cancelled',
  提交: 'submit',
  生成: 'generation',
  想象: 'imagine',
  放大: 'upscale',
  变体: 'variation',
  变化: 'variation',
}
export function getTaskCenterTagLabel(
  tag: string,
  t: (key: string) => string
): string {
  const normalized = tag.trim().toLowerCase()
  const translationKey = TASK_CENTER_TAG_TRANSLATION_KEYS[normalized]
  return translationKey ? t(translationKey) : tag
}

export function normalizeTaskCenterTagFilter(tag: string): string {
  const trimmed = tag.trim()
  if (!trimmed) return ''
  return TASK_CENTER_ZH_TAG_TO_RAW[trimmed] ?? trimmed
}

export function parseJson<T>(value?: string, fallback?: T): T {
  if (!value) return fallback as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback as T
  }
}

export function parseTags(value?: string): string[] {
  const parsed = parseJson<string[]>(value, [])
  return Array.isArray(parsed) ? parsed.filter(Boolean) : []
}

export function parseDetail(value?: string): TaskCenterDetailPayload {
  const parsed = parseJson<TaskCenterDetailPayload>(value, {})
  return parsed && typeof parsed === 'object' ? parsed : {}
}

export function formatUnixTime(value?: number): string {
  if (!value) return '-'
  const timestamp = value > 10_000_000_000 ? value : value * 1000
  return new Date(timestamp).toLocaleString()
}

export function prettyJson(value?: string): string {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function taskStatusVariant(status?: string) {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'danger'
    case 'running':
      return 'info'
    case 'cancelled':
      return 'neutral'
    default:
      return 'warning'
  }
}

