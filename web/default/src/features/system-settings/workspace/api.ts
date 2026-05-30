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

