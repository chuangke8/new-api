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
import { api } from '@/lib/api'

export type WorkspaceChatCategoryDto = {
  id: number
  weight: number
  name: string
  alias: string
  remark: string
  disabled: boolean
  created_time?: number
  updated_time?: number
}

export type WorkspaceChatChannelDto = {
  id: number
  weight: number
  model: string
  model_alias: string
  category_id: number
  vision_enabled: boolean
  file_upload_enabled: boolean
  web_search_enabled: boolean
  disabled: boolean
  remark: string
  category?: WorkspaceChatCategoryDto
  created_time?: number
  updated_time?: number
}

export type WorkspaceChatModelDto = {
  id: number
  model: string
  model_alias: string
  display_name: string
  category_id: number
  category_name: string
  category_alias: string
  category_display: string
  vision_enabled: boolean
  file_upload_enabled: boolean
  web_search_enabled: boolean
}

export type WorkspaceImagePresetDto = {
  value: string
  label_zh: string
  label_en: string
  disabled?: boolean
}

export type WorkspaceImageFeatureControlsDto = {
  reference_image_upload: boolean
  size_control: boolean
  ratio_control: boolean
  style_control: boolean
  quality_control: boolean
  negative_prompt: boolean
  seed_control: boolean
  batch_control: boolean
}

export type WorkspaceImageCategoryDto = WorkspaceChatCategoryDto

export type WorkspaceImageChannelDto = {
  id: number
  weight: number
  model: string
  model_alias: string
  category_id: number
  feature_controls: string | WorkspaceImageFeatureControlsDto
  max_batch_size: number
  size_presets: string | WorkspaceImagePresetDto[]
  ratio_presets: string | WorkspaceImagePresetDto[]
  style_presets: string | WorkspaceImagePresetDto[]
  quality_presets: string | WorkspaceImagePresetDto[]
  disabled: boolean
  remark: string
  category?: WorkspaceImageCategoryDto
  created_time?: number
  updated_time?: number
}

export type WorkspaceImageModelDto = {
  id: number
  model: string
  model_alias: string
  display_name: string
  category_id: number
  category_name: string
  category_alias: string
  category_display: string
  feature_controls: WorkspaceImageFeatureControlsDto
  max_batch_size: number
  size_presets: WorkspaceImagePresetDto[]
  ratio_presets: WorkspaceImagePresetDto[]
  style_presets: WorkspaceImagePresetDto[]
  quality_presets: WorkspaceImagePresetDto[]
}

export type WorkspaceVideoPresetDto = WorkspaceImagePresetDto

export type WorkspaceVideoFeatureControlsDto = {
  first_frame_image: boolean
  last_frame_image: boolean
  reference_image_upload: boolean
  duration_control: boolean
  ratio_control: boolean
  resolution_control: boolean
  frame_rate_control: boolean
  style_control: boolean
  quality_control: boolean
  negative_prompt: boolean
  audio_track: boolean
  camera_control: boolean
  seed_control: boolean
  batch_control: boolean
}

export type WorkspaceVideoCategoryDto = WorkspaceChatCategoryDto

export type WorkspaceVideoChannelDto = {
  id: number
  weight: number
  model: string
  model_alias: string
  category_id: number
  feature_controls: string | WorkspaceVideoFeatureControlsDto
  max_batch_size: number
  resolution_presets: string | WorkspaceVideoPresetDto[]
  ratio_presets: string | WorkspaceVideoPresetDto[]
  duration_presets: string | WorkspaceVideoPresetDto[]
  frame_rate_presets: string | WorkspaceVideoPresetDto[]
  style_presets: string | WorkspaceVideoPresetDto[]
  quality_presets: string | WorkspaceVideoPresetDto[]
  disabled: boolean
  remark: string
  category?: WorkspaceVideoCategoryDto
  created_time?: number
  updated_time?: number
}

export type WorkspaceVideoModelDto = {
  id: number
  model: string
  model_alias: string
  display_name: string
  category_id: number
  category_name: string
  category_alias: string
  category_display: string
  feature_controls: WorkspaceVideoFeatureControlsDto
  max_batch_size: number
  resolution_presets: WorkspaceVideoPresetDto[]
  ratio_presets: WorkspaceVideoPresetDto[]
  duration_presets: WorkspaceVideoPresetDto[]
  frame_rate_presets: WorkspaceVideoPresetDto[]
  style_presets: WorkspaceVideoPresetDto[]
  quality_presets: WorkspaceVideoPresetDto[]
}

export type WorkspaceImageGenerationRequest = {
  model: string
  prompt: string
  negative_prompt?: string
  image?: string
  images?: string[]
  n?: number
  size?: string
  quality?: string
  response_format?: 'url' | 'b64_json'
  style?: string
  seed?: string | number
}

export type WorkspaceImageGenerationData = {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export type WorkspaceImageGenerationResponse = {
  created?: number
  data?: WorkspaceImageGenerationData[]
  metadata?: unknown
}

export type WorkspaceVideoGenerationRequest = {
  model: string
  prompt: string
  image?: string
  images?: string[]
  size?: string
  duration?: number
  seconds?: string
  input_reference?: string
  metadata?: Record<string, unknown>
}

export type WorkspaceVideoGenerationResponse = {
  id?: string
  task_id?: string
  status?: string
  code?: string
  message?: string
  data?: unknown
}

export type WorkspaceVideoTaskData = {
  task_id?: string
  status?: string
  url?: string
  result_url?: string
  progress?: string
  error?: { message?: string; code?: string | number } | null
  data?: unknown
}

export type WorkspaceVideoTaskResponse = {
  code?: string
  message?: string
  data?: WorkspaceVideoTaskData
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function getWorkspaceChatCategories() {
  const res = await api.get<ApiResponse<WorkspaceChatCategoryDto[]>>(
    '/api/workspace/chat/admin/categories'
  )
  return res.data
}

export async function createWorkspaceChatCategory(
  data: Partial<WorkspaceChatCategoryDto>
) {
  const res = await api.post<ApiResponse<WorkspaceChatCategoryDto>>(
    '/api/workspace/chat/admin/categories',
    data
  )
  return res.data
}

export async function updateWorkspaceChatCategory(
  id: number,
  data: Partial<WorkspaceChatCategoryDto>
) {
  const res = await api.put<ApiResponse<WorkspaceChatCategoryDto>>(
    `/api/workspace/chat/admin/categories/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceChatCategory(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/chat/admin/categories/${id}`
  )
  return res.data
}

export async function getWorkspaceChatChannels() {
  const res = await api.get<ApiResponse<WorkspaceChatChannelDto[]>>(
    '/api/workspace/chat/admin/channels'
  )
  return res.data
}

export async function createWorkspaceChatChannel(
  data: Partial<WorkspaceChatChannelDto>
) {
  const res = await api.post<ApiResponse<WorkspaceChatChannelDto>>(
    '/api/workspace/chat/admin/channels',
    data
  )
  return res.data
}

export async function updateWorkspaceChatChannel(
  id: number,
  data: Partial<WorkspaceChatChannelDto>
) {
  const res = await api.put<ApiResponse<WorkspaceChatChannelDto>>(
    `/api/workspace/chat/admin/channels/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceChatChannel(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/chat/admin/channels/${id}`
  )
  return res.data
}

export async function getWorkspaceChatAvailableModels() {
  const res = await api.get<ApiResponse<string[]>>(
    '/api/workspace/chat/admin/available-models'
  )
  return res.data
}

export async function getWorkspaceChatModels() {
  const res = await api.get<ApiResponse<WorkspaceChatModelDto[]>>(
    '/api/workspace/chat/models'
  )
  return res.data
}

export async function getWorkspaceImageCategories() {
  const res = await api.get<ApiResponse<WorkspaceImageCategoryDto[]>>(
    '/api/workspace/image/admin/categories'
  )
  return res.data
}

export async function createWorkspaceImageCategory(
  data: Partial<WorkspaceImageCategoryDto>
) {
  const res = await api.post<ApiResponse<WorkspaceImageCategoryDto>>(
    '/api/workspace/image/admin/categories',
    data
  )
  return res.data
}

export async function updateWorkspaceImageCategory(
  id: number,
  data: Partial<WorkspaceImageCategoryDto>
) {
  const res = await api.put<ApiResponse<WorkspaceImageCategoryDto>>(
    `/api/workspace/image/admin/categories/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceImageCategory(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/image/admin/categories/${id}`
  )
  return res.data
}

export async function getWorkspaceImageChannels() {
  const res = await api.get<ApiResponse<WorkspaceImageChannelDto[]>>(
    '/api/workspace/image/admin/channels'
  )
  return res.data
}

export async function createWorkspaceImageChannel(
  data: Partial<WorkspaceImageChannelDto>
) {
  const res = await api.post<ApiResponse<WorkspaceImageChannelDto>>(
    '/api/workspace/image/admin/channels',
    data
  )
  return res.data
}

export async function updateWorkspaceImageChannel(
  id: number,
  data: Partial<WorkspaceImageChannelDto>
) {
  const res = await api.put<ApiResponse<WorkspaceImageChannelDto>>(
    `/api/workspace/image/admin/channels/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceImageChannel(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/image/admin/channels/${id}`
  )
  return res.data
}

export async function getWorkspaceImageAvailableModels() {
  const res = await api.get<ApiResponse<string[]>>(
    '/api/workspace/image/admin/available-models'
  )
  return res.data
}

export async function getWorkspaceImageModels() {
  const res = await api.get<ApiResponse<WorkspaceImageModelDto[]>>(
    '/api/workspace/image/models'
  )
  return res.data
}

export async function generateWorkspaceImage(
  data: WorkspaceImageGenerationRequest
) {
  const res = await api.post<WorkspaceImageGenerationResponse>(
    '/api/workspace/image/generations',
    data,
    { skipErrorHandler: true }
  )
  return res.data
}

export async function getWorkspaceVideoCategories() {
  const res = await api.get<ApiResponse<WorkspaceVideoCategoryDto[]>>(
    '/api/workspace/video/admin/categories'
  )
  return res.data
}

export async function createWorkspaceVideoCategory(
  data: Partial<WorkspaceVideoCategoryDto>
) {
  const res = await api.post<ApiResponse<WorkspaceVideoCategoryDto>>(
    '/api/workspace/video/admin/categories',
    data
  )
  return res.data
}

export async function updateWorkspaceVideoCategory(
  id: number,
  data: Partial<WorkspaceVideoCategoryDto>
) {
  const res = await api.put<ApiResponse<WorkspaceVideoCategoryDto>>(
    `/api/workspace/video/admin/categories/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceVideoCategory(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/video/admin/categories/${id}`
  )
  return res.data
}

export async function getWorkspaceVideoChannels() {
  const res = await api.get<ApiResponse<WorkspaceVideoChannelDto[]>>(
    '/api/workspace/video/admin/channels'
  )
  return res.data
}

export async function createWorkspaceVideoChannel(
  data: Partial<WorkspaceVideoChannelDto>
) {
  const res = await api.post<ApiResponse<WorkspaceVideoChannelDto>>(
    '/api/workspace/video/admin/channels',
    data
  )
  return res.data
}

export async function updateWorkspaceVideoChannel(
  id: number,
  data: Partial<WorkspaceVideoChannelDto>
) {
  const res = await api.put<ApiResponse<WorkspaceVideoChannelDto>>(
    `/api/workspace/video/admin/channels/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceVideoChannel(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/video/admin/channels/${id}`
  )
  return res.data
}

export async function getWorkspaceVideoAvailableModels() {
  const res = await api.get<ApiResponse<string[]>>(
    '/api/workspace/video/admin/available-models'
  )
  return res.data
}

export async function getWorkspaceVideoModels() {
  const res = await api.get<ApiResponse<WorkspaceVideoModelDto[]>>(
    '/api/workspace/video/models'
  )
  return res.data
}

export async function generateWorkspaceVideo(
  data: WorkspaceVideoGenerationRequest
) {
  const res = await api.post<WorkspaceVideoGenerationResponse>(
    '/api/workspace/video/generations',
    data,
    { skipErrorHandler: true }
  )
  return res.data
}

export async function getWorkspaceVideoTask(taskId: string) {
  const res = await api.get<WorkspaceVideoTaskResponse>(
    `/api/workspace/video/generations/${taskId}`,
    { skipErrorHandler: true }
  )
  return res.data
}
