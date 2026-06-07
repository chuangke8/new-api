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
// Message types
export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'loading' | 'streaming' | 'complete' | 'error'

export interface MessageVersion {
  id: string
  content: string
}

export interface Message {
  key: string
  from: MessageRole
  versions: MessageVersion[]
  imageUrls?: string[]
  fileNames?: string[]
  fileAttachments?: FileAttachment[]
  sources?: { href: string; title: string }[]
  reasoning?: {
    content: string
    duration: number
  }
  isReasoningStreaming?: boolean
  isReasoningComplete?: boolean
  isContentComplete?: boolean
  status?: MessageStatus
  errorCode?: string | null
}

// API payload types
export interface ChatCompletionMessage {
  role: MessageRole
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url' | 'file'
  text?: string
  image_url?: {
    url: string
  }
  file?: {
    filename: string
    file_data: string
  }
}

export interface FileAttachment {
  filename: string
  fileData: string
  mediaType?: string
}

export interface ChatCompletionRequest {
  model: string
  group?: string
  messages: ChatCompletionMessage[]
  stream: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: MessageRole
      content?: string
      reasoning_content?: string
    }
    finish_reason: string | null
  }>
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: MessageRole
      content: string
      reasoning_content?: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Configuration types
export interface PlaygroundConfig {
  model: string
  group: string
  temperature: number
  top_p: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number | null
  stream: boolean
}

export interface ParameterEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
  frequency_penalty: boolean
  presence_penalty: boolean
  seed: boolean
}

// Model and group options
export interface ModelOption {
  label: string
  value: string
  category?: string
  categoryName?: string
  categoryAlias?: string
  categoryDisplay?: string
  description?: string
  visionEnabled?: boolean
  fileUploadEnabled?: boolean
  webSearchEnabled?: boolean
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

export interface WorkspaceChatSession {
  id: number
  user_id: number
  title: string
  model: string
  archived: boolean
  created_time: number
  updated_time: number
}

export interface WorkspaceChatMessage {
  id: number
  session_id: number
  user_id: number
  role: MessageRole
  content: string
  model: string
  metadata: string
  created_time: number
  updated_time: number
}

export interface WorkspaceChatMessageMetadata {
  key?: string
  imageUrls?: string[]
  fileNames?: string[]
  fileAttachments?: FileAttachment[]
  status?: MessageStatus
  errorCode?: string | null
  reasoning?: Message['reasoning']
  sources?: Message['sources']
}
