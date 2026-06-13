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
import type { LucideIcon } from 'lucide-react'

export type WorkspaceChannelKind = 'chat' | 'image' | 'video'

export type WorkspaceCapabilityKey =
  | 'vision'
  | 'webSearch'
  | 'fileUpload'
  | 'referenceImage'
  | 'sizeControl'
  | 'ratioControl'
  | 'styleControl'
  | 'qualityControl'
  | 'batchControl'
  | 'firstFrame'
  | 'lastFrame'
  | 'durationControl'
  | 'resolutionControl'
  | 'frameRateControl'
  | 'negativePrompt'
  | 'audioTrack'
  | 'cameraControl'
  | 'seedControl'
  | 'typeControl'

export type WorkspaceCapabilityConfig = {
  key: WorkspaceCapabilityKey
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
}

export type WorkspaceChannel = {
  id: string | number
  weight: number
  model: string
  modelAlias: string
  category: string | number
  sizePresets?: string[]
  ratioPresets?: string[]
  stylePresets?: WorkspaceMappedPreset[]
  qualityPresets?: WorkspaceMappedPreset[]
  cameraPresets?: WorkspaceMappedPreset[]
  maxBatchSize?: number
  imageFieldMappings?: WorkspaceImageFieldMappings
  videoFieldMappings?: WorkspaceVideoFieldMappings
  durationPresets?: string[]
  frameRatePresets?: string[]
  videoTypeValue?: string
  capabilities: Record<WorkspaceCapabilityKey, boolean>
  disabled: boolean
  remark: string
}

export type WorkspaceImageFieldMappings = {
  referenceImage: string
  size: string
  ratio: string
  style: string
  quality: string
  negativePrompt: string
  seed: string
}

export type WorkspaceVideoFieldMappings = {
  firstFrameImage: string
  referenceImage: string
  referenceImages: string
  lastFrameImage: string
  type: string
  resolution: string
  ratio: string
  duration: string
  frameRate: string
  style: string
  quality: string
  negativePrompt: string
  audio: string
  cameraMovement: string
  seed: string
}

export type WorkspaceMappedPreset = {
  value: string
  zh: string
}

export type WorkspaceChannelCategory = {
  id: string | number
  weight: number
  name: string
  alias: string
  remark: string
  disabled: boolean
}

export type WorkspaceManagerConfig = {
  kind: WorkspaceChannelKind
  titleKey: string
  channelNameKey: string
  categoryNameKey: string
  emptyChannelTitleKey: string
  emptyCategoryTitleKey: string
  capabilities: WorkspaceCapabilityConfig[]
}
