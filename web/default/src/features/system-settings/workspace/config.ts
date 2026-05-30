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
  FileText,
  ImageIcon,
  Images,
  Layers3,
  MousePointer2,
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
        key: 'maskEdit',
        labelKey: 'Mask editing',
        descriptionKey: 'Allow image inpainting and partial redraw workflows.',
        icon: MousePointer2,
      },
      {
        key: 'batchGenerate',
        labelKey: 'Batch generation',
        descriptionKey: 'Allow generating multiple images in one request.',
        icon: Layers3,
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
        key: 'audioTrack',
        labelKey: 'Audio track',
        descriptionKey: 'Allow users to attach or generate audio tracks.',
        icon: AudioLines,
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
    capabilities: enabledCapabilities(config.capabilities.map((item) => item.key)),
    disabled: false,
    remark: '',
  }
}
