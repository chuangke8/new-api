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
import {
  AudioLines,
  Clock3,
  Film,
  FileText,
  Gauge,
  ImageIcon,
  Images,
  Palette,
  Ratio,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Search,
  Video,
} from 'lucide-react'
import type {
  WorkspaceCapabilityConfig,
  WorkspaceChannel,
  WorkspaceChannelCategory,
  WorkspaceChannelKind,
  WorkspaceManagerConfig,
} from './types'

const enabledCapabilities = (
  keys: WorkspaceCapabilityConfig['key'][]
): WorkspaceChannel['capabilities'] =>
  keys.reduce(
    (acc, key) => ({
      ...acc,
      [key]: true,
    }),
    {} as WorkspaceChannel['capabilities']
  )

export const WORKSPACE_MANAGER_CONFIGS: Record<
  WorkspaceChannelKind,
  WorkspaceManagerConfig
> = {
  chat: {
    kind: 'chat',
    titleKey: 'Chat Channel Management',
    channelNameKey: 'chat channel',
    categoryNameKey: 'chat category',
    emptyChannelTitleKey: 'No chat channels configured',
    emptyCategoryTitleKey: 'No chat categories configured',
    capabilities: [
      {
        key: 'vision',
        labelKey: 'Image upload / vision',
        descriptionKey: 'Allow users to upload images for vision models.',
        icon: ImageIcon,
      },
      {
        key: 'webSearch',
        labelKey: 'Web search',
        descriptionKey: 'Allow users to enable online search.',
        icon: Search,
      },
      {
        key: 'fileUpload',
        labelKey: 'File upload',
        descriptionKey: 'Allow users to upload files for parsing.',
        icon: FileText,
      },
    ],
  },
  image: {
    kind: 'image',
    titleKey: 'Image Channel Management',
    channelNameKey: 'image channel',
    categoryNameKey: 'image category',
    emptyChannelTitleKey: 'No image channels configured',
    emptyCategoryTitleKey: 'No image categories configured',
    capabilities: [
      {
        key: 'referenceImage',
        labelKey: 'Reference image',
        descriptionKey: 'Allow users to upload reference images.',
        icon: Images,
      },
      {
        key: 'sizeControl',
        labelKey: 'Size control',
        descriptionKey: 'Allow users to choose image size presets.',
        icon: SlidersHorizontal,
      },
      {
        key: 'ratioControl',
        labelKey: 'Ratio control',
        descriptionKey: 'Allow users to choose aspect ratio presets.',
        icon: Ratio,
      },
      {
        key: 'styleControl',
        labelKey: 'Style control',
        descriptionKey: 'Allow users to choose style presets.',
        icon: Palette,
      },
      {
        key: 'qualityControl',
        labelKey: 'Quality control',
        descriptionKey: 'Allow users to choose quality presets.',
        icon: Sparkles,
      },
    ],
  },
  video: {
    kind: 'video',
    titleKey: 'Video Channel Management',
    channelNameKey: 'video channel',
    categoryNameKey: 'video category',
    emptyChannelTitleKey: 'No video channels configured',
    emptyCategoryTitleKey: 'No video categories configured',
    capabilities: [
      {
        key: 'firstFrame',
        labelKey: 'First frame image',
        descriptionKey: 'Allow users to provide the first frame image.',
        icon: ImageIcon,
      },
      {
        key: 'lastFrame',
        labelKey: 'Last frame image',
        descriptionKey: 'Allow users to provide the last frame image.',
        icon: Video,
      },
      {
        key: 'referenceImage',
        labelKey: 'Reference image',
        descriptionKey: 'Allow users to upload reference images.',
        icon: Images,
      },
      {
        key: 'durationControl',
        labelKey: 'Duration control',
        descriptionKey: 'Allow users to choose video duration presets.',
        icon: Clock3,
      },
      {
        key: 'ratioControl',
        labelKey: 'Ratio control',
        descriptionKey: 'Allow users to choose aspect ratio presets.',
        icon: Ratio,
      },
      {
        key: 'resolutionControl',
        labelKey: 'Resolution control',
        descriptionKey: 'Allow users to choose video resolution presets.',
        icon: Settings2,
      },
      {
        key: 'frameRateControl',
        labelKey: 'Frame rate control',
        descriptionKey: 'Allow users to choose video frame rate presets.',
        icon: Film,
      },
      {
        key: 'audioTrack',
        labelKey: 'Audio track',
        descriptionKey: 'Allow users to attach or generate audio tracks.',
        icon: AudioLines,
      },
      {
        key: 'cameraControl',
        labelKey: 'Camera control',
        descriptionKey: 'Allow users to choose camera movement options.',
        icon: Wand2,
      },
      {
        key: 'seedControl',
        labelKey: 'Seed control',
        descriptionKey: 'Allow users to set deterministic seed values.',
        icon: Gauge,
      },
    ],
  },
}

export const FALLBACK_MODEL_OPTIONS = [
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'gemini-1.5-pro',
  'deepseek-chat',
]

export const IMAGE_SIZE_PRESETS = [
  'auto',
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
  '2048x1152',
  '3840x2160',
  '2160x3840',
]

export const IMAGE_RATIO_PRESETS = [
  'auto',
  '1:1',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
  '21:9',
  '2:3',
  '3:2',
]

export const IMAGE_STYLE_PRESETS = [
  { value: 'vivid', zh: '鲜艳' },
  { value: 'natural', zh: '自然' },
  { value: 'photorealistic', zh: '写实' },
  { value: 'anime', zh: '动漫' },
]

export const IMAGE_QUALITY_PRESETS = [
  { value: 'auto', zh: '自动' },
  { value: 'standard', zh: '标准' },
  { value: 'hd', zh: '高清' },
  { value: 'low', zh: '低' },
  { value: 'medium', zh: '中' },
  { value: 'high', zh: '高' },
]

export const VIDEO_RESOLUTION_PRESETS = [
  'auto',
  '720p',
  '1080p',
  '2K',
  '4K',
  '1280x720',
  '1920x1080',
  '1080x1920',
  '3840x2160',
]

export const VIDEO_RATIO_PRESETS = [
  'auto',
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
]

export const VIDEO_DURATION_PRESETS = [
  'auto',
  '3s',
  '5s',
  '8s',
  '10s',
  '15s',
  '30s',
]

export const VIDEO_FRAME_RATE_PRESETS = [
  'auto',
  '24fps',
  '25fps',
  '30fps',
  '60fps',
]

export const VIDEO_QUALITY_PRESETS = [
  { value: 'standard', zh: '标准' },
  { value: 'high', zh: '高质量' },
  { value: 'pro', zh: '专业' },
  { value: 'fast', zh: '快速' },
]

export const createDefaultCategories = (
  kind: WorkspaceChannelKind
): WorkspaceChannelCategory[] => {
  if (kind === 'image') {
    return [
      {
        id: 'image-general',
        weight: 100,
        name: 'general',
        alias: 'General image',
        remark: 'Default image generation models.',
        disabled: false,
      },
      {
        id: 'image-edit',
        weight: 80,
        name: 'edit',
        alias: 'Image editing',
        remark: 'Models that support reference or mask editing.',
        disabled: false,
      },
    ]
  }

  if (kind === 'video') {
    return [
      {
        id: 'video-general',
        weight: 100,
        name: 'general',
        alias: 'General video',
        remark: 'Default text-to-video models.',
        disabled: false,
      },
      {
        id: 'video-frame',
        weight: 80,
        name: 'frame-control',
        alias: 'Frame control',
        remark: 'Models with first or last frame controls.',
        disabled: false,
      },
    ]
  }

  return [
    {
      id: 'chat-general',
      weight: 100,
      name: 'general',
      alias: 'General chat',
      remark: 'Default chat models.',
      disabled: false,
    },
    {
      id: 'chat-reasoning',
      weight: 80,
      name: 'reasoning',
      alias: 'Reasoning',
      remark: 'Models suitable for complex reasoning.',
      disabled: false,
    },
  ]
}

export const createDefaultChannels = (
  kind: WorkspaceChannelKind
): WorkspaceChannel[] => {
  const config = WORKSPACE_MANAGER_CONFIGS[kind]
  const capabilityKeys = config.capabilities.map((item) => item.key)

  if (kind === 'image') {
    return [
      {
        id: 'image-channel-1',
        weight: 100,
        model: 'gpt-image-1',
        modelAlias: 'GPT Image',
        category: 'general',
        sizePresets: IMAGE_SIZE_PRESETS,
        ratioPresets: IMAGE_RATIO_PRESETS,
        stylePresets: IMAGE_STYLE_PRESETS,
        qualityPresets: IMAGE_QUALITY_PRESETS,
        capabilities: enabledCapabilities(capabilityKeys),
        disabled: false,
        remark: 'Mock frontend configuration; backend persistence pending.',
      },
    ]
  }

  if (kind === 'video') {
    return [
      {
        id: 'video-channel-1',
        weight: 100,
        model: 'sora',
        modelAlias: 'Sora',
        category: 'general',
        sizePresets: VIDEO_RESOLUTION_PRESETS,
        ratioPresets: VIDEO_RATIO_PRESETS,
        durationPresets: VIDEO_DURATION_PRESETS,
        frameRatePresets: VIDEO_FRAME_RATE_PRESETS,
        qualityPresets: VIDEO_QUALITY_PRESETS,
        capabilities: enabledCapabilities(capabilityKeys),
        disabled: false,
        remark: 'Mock frontend configuration; backend persistence pending.',
      },
    ]
  }

  return [
    {
      id: 'chat-channel-1',
      weight: 100,
      model: 'gpt-4o-mini',
      modelAlias: 'GPT-4o mini',
      category: 'general',
      capabilities: enabledCapabilities(capabilityKeys),
      disabled: false,
      remark: 'Small model example with all chat controls enabled.',
    },
    {
      id: 'chat-channel-2',
      weight: 80,
      model: 'deepseek-chat',
      modelAlias: 'DeepSeek Chat',
      category: 'reasoning',
      capabilities: {
        ...enabledCapabilities(capabilityKeys),
        vision: false,
      },
      disabled: false,
      remark: 'Vision disabled to avoid unsupported uploads.',
    },
  ]
}

export const createEmptyChannel = (
  kind: WorkspaceChannelKind,
  model: string,
  category: string | number
): WorkspaceChannel => {
  const config = WORKSPACE_MANAGER_CONFIGS[kind]
  return {
    id: `${kind}-channel-${Date.now()}`,
    weight: 0,
    model,
    modelAlias: model,
    category,
    sizePresets:
      kind === 'image'
        ? IMAGE_SIZE_PRESETS
        : kind === 'video'
          ? VIDEO_RESOLUTION_PRESETS
          : undefined,
    ratioPresets:
      kind === 'image'
        ? IMAGE_RATIO_PRESETS
        : kind === 'video'
          ? VIDEO_RATIO_PRESETS
          : undefined,
    stylePresets: kind === 'image' ? IMAGE_STYLE_PRESETS : undefined,
    qualityPresets:
      kind === 'image'
        ? IMAGE_QUALITY_PRESETS
        : kind === 'video'
          ? VIDEO_QUALITY_PRESETS
          : undefined,
    durationPresets: kind === 'video' ? VIDEO_DURATION_PRESETS : undefined,
    frameRatePresets: kind === 'video' ? VIDEO_FRAME_RATE_PRESETS : undefined,
    capabilities: enabledCapabilities(config.capabilities.map((item) => item.key)),
    disabled: false,
    remark: '',
  }
}
