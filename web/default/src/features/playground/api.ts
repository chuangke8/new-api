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
import { API_ENDPOINTS } from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  MessageRole,
  WorkspaceChatMessage,
  WorkspaceChatMessageMetadata,
  WorkspaceChatSession,
} from './types'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type WorkspaceChatModelDto = {
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

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS)
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

export async function getWorkspaceChatModels(): Promise<ModelOption[]> {
  const res = await api.get<ApiResponse<WorkspaceChatModelDto[]>>(
    '/api/workspace/chat/models'
  )
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model) => ({
    label: model.display_name || model.model_alias || model.model,
    value: model.model,
    category:
      model.category_display ||
      model.category_alias ||
      model.category_name ||
      'Chat',
    categoryName: model.category_name,
    categoryAlias: model.category_alias,
    categoryDisplay: model.category_display,
    visionEnabled: model.vision_enabled,
    fileUploadEnabled: model.file_upload_enabled,
    webSearchEnabled: model.web_search_enabled,
  }))
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

export async function getWorkspaceChatSessions(archived = false) {
  const res = await api.get<ApiResponse<WorkspaceChatSession[]>>(
    '/api/workspace/chat/sessions',
    { params: { archived } }
  )
  return res.data
}

export async function createWorkspaceChatSession(data: {
  title?: string
  model?: string
  archived?: boolean
}) {
  const res = await api.post<ApiResponse<WorkspaceChatSession>>(
    '/api/workspace/chat/sessions',
    data
  )
  return res.data
}

export async function updateWorkspaceChatSession(
  id: number,
  data: Partial<Pick<WorkspaceChatSession, 'title' | 'model' | 'archived'>>
) {
  const res = await api.put<ApiResponse<WorkspaceChatSession>>(
    `/api/workspace/chat/sessions/${id}`,
    data
  )
  return res.data
}

export async function deleteWorkspaceChatSession(id: number) {
  const res = await api.delete<ApiResponse<null>>(
    `/api/workspace/chat/sessions/${id}`
  )
  return res.data
}

export async function archiveWorkspaceChatSession(id: number) {
  const res = await api.post<ApiResponse<WorkspaceChatSession>>(
    `/api/workspace/chat/sessions/${id}/archive`
  )
  return res.data
}

export async function unarchiveWorkspaceChatSession(id: number) {
  const res = await api.post<ApiResponse<WorkspaceChatSession>>(
    `/api/workspace/chat/sessions/${id}/unarchive`
  )
  return res.data
}

export async function getWorkspaceChatMessages(sessionId: number) {
  const res = await api.get<ApiResponse<WorkspaceChatMessage[]>>(
    `/api/workspace/chat/sessions/${sessionId}/messages`
  )
  return res.data
}

export async function createWorkspaceChatMessage(
  sessionId: number,
  data: {
    role: MessageRole
    content: string
    model?: string
    metadata?: WorkspaceChatMessageMetadata
  }
) {
  const res = await api.post<ApiResponse<WorkspaceChatMessage>>(
    `/api/workspace/chat/sessions/${sessionId}/messages`,
    data
  )
  return res.data
}
