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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import {
  Edit3,
  Plus,
  Power,
  PowerOff,
  Save,
  X,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableColumnHeader, DataTablePage } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  createDefaultCategories,
  createDefaultChannels,
  createEmptyChannel,
  FALLBACK_MODEL_OPTIONS,
  WORKSPACE_MANAGER_CONFIGS,
} from './config'
import {
  createWorkspaceChatCategory,
  createWorkspaceChatChannel,
  createWorkspaceImageCategory,
  createWorkspaceImageChannel,
  createWorkspaceVideoCategory,
  createWorkspaceVideoChannel,
  deleteWorkspaceChatCategory,
  deleteWorkspaceChatChannel,
  deleteWorkspaceImageCategory,
  deleteWorkspaceImageChannel,
  deleteWorkspaceVideoCategory,
  deleteWorkspaceVideoChannel,
  getWorkspaceChatAvailableModels,
  getWorkspaceChatCategories,
  getWorkspaceChatChannels,
  getWorkspaceImageAvailableModels,
  getWorkspaceImageCategories,
  getWorkspaceImageChannels,
  getWorkspaceVideoAvailableModels,
  getWorkspaceVideoCategories,
  getWorkspaceVideoChannels,
  updateWorkspaceChatCategory,
  updateWorkspaceChatChannel,
  updateWorkspaceImageCategory,
  updateWorkspaceImageChannel,
  updateWorkspaceVideoCategory,
  updateWorkspaceVideoChannel,
  type WorkspaceChatCategoryDto,
  type WorkspaceChatChannelDto,
  type WorkspaceImageCategoryDto,
  type WorkspaceImageChannelDto,
  type WorkspaceImageFeatureControlsDto,
  type WorkspaceImagePresetDto,
  type WorkspaceVideoCategoryDto,
  type WorkspaceVideoChannelDto,
  type WorkspaceVideoFeatureControlsDto,
  type WorkspaceVideoPresetDto,
} from './api'
import type {
  WorkspaceCapabilityConfig,
  WorkspaceCapabilityKey,
  WorkspaceChannel,
  WorkspaceChannelCategory,
  WorkspaceChannelKind,
  WorkspaceMappedPreset,
  WorkspaceManagerConfig,
} from './types'

type WorkspaceChannelManagerProps = {
  kind: WorkspaceChannelKind
}

type DeleteTarget =
  | { type: 'channel'; id: string | number; label: string }
  | { type: 'category'; id: string | number; label: string }
  | null

function sortByWeight<T extends { weight: number }>(items: T[]) {
  return [...items].sort((a, b) => b.weight - a.weight)
}

function isZhLanguage(language?: string) {
  return Boolean(language?.toLowerCase().startsWith('zh'))
}

function formatMappedPreset(
  preset: WorkspaceMappedPreset,
  zhLanguage: boolean
) {
  return zhLanguage && preset.zh ? preset.zh : preset.value
}

function normalizeModelOptions(data?: string[]) {
  const models = (data || []).map((item) => String(item).trim()).filter(Boolean)
  return Array.from(new Set(models))
}

function fromChatCategoryDto(
  category: WorkspaceChatCategoryDto
): WorkspaceChannelCategory {
  return {
    id: category.id,
    weight: category.weight,
    name: category.name,
    alias: category.alias,
    remark: category.remark,
    disabled: category.disabled,
  }
}

function fromChatChannelDto(channel: WorkspaceChatChannelDto): WorkspaceChannel {
  return {
    id: channel.id,
    weight: channel.weight,
    model: channel.model,
    modelAlias: channel.model_alias,
    category: channel.category_id,
    capabilities: {
      vision: channel.vision_enabled,
      fileUpload: channel.file_upload_enabled,
      webSearch: channel.web_search_enabled,
    } as WorkspaceChannel['capabilities'],
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

function parseMaybeJson<T>(value: string | T, fallback: T): T {
  if (typeof value !== 'string') return value
  if (!value.trim()) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function fromImagePresetDto(preset: WorkspaceImagePresetDto): WorkspaceMappedPreset {
  return {
    value: preset.value,
    zh: preset.label_zh || '',
  }
}

function toImagePresetDto(preset: WorkspaceMappedPreset): WorkspaceImagePresetDto {
  return {
    value: preset.value,
    label_zh: preset.zh || '',
    label_en: preset.value,
    disabled: false,
  }
}

function stringPresetToDto(value: string): WorkspaceImagePresetDto {
  return {
    value,
    label_zh: '',
    label_en: value,
    disabled: false,
  }
}

function fromImageCategoryDto(
  category: WorkspaceImageCategoryDto
): WorkspaceChannelCategory {
  return fromChatCategoryDto(category)
}

function fromImageChannelDto(channel: WorkspaceImageChannelDto): WorkspaceChannel {
  const defaultControls: WorkspaceImageFeatureControlsDto = {
    reference_image_upload: true,
    size_control: true,
    ratio_control: true,
    style_control: true,
    quality_control: true,
    negative_prompt: true,
    seed_control: true,
    batch_control: true,
  }
  const controls = {
    ...defaultControls,
    ...parseMaybeJson<WorkspaceImageFeatureControlsDto>(
      channel.feature_controls,
      defaultControls
    ),
  }
  const sizePresets = parseMaybeJson<WorkspaceImagePresetDto[]>(
    channel.size_presets,
    []
  )
  const ratioPresets = parseMaybeJson<WorkspaceImagePresetDto[]>(
    channel.ratio_presets,
    []
  )
  const stylePresets = parseMaybeJson<WorkspaceImagePresetDto[]>(
    channel.style_presets,
    []
  )
  const qualityPresets = parseMaybeJson<WorkspaceImagePresetDto[]>(
    channel.quality_presets,
    []
  )
  return {
    id: channel.id,
    weight: channel.weight,
    model: channel.model,
    modelAlias: channel.model_alias,
    category: channel.category_id,
    sizePresets: sizePresets.map((item) => item.value).filter(Boolean),
    ratioPresets: ratioPresets.map((item) => item.value).filter(Boolean),
    stylePresets: stylePresets.map(fromImagePresetDto),
    qualityPresets: qualityPresets.map(fromImagePresetDto),
    maxBatchSize: channel.max_batch_size || 4,
    capabilities: {
      referenceImage: controls.reference_image_upload,
      sizeControl: controls.size_control,
      ratioControl: controls.ratio_control,
      styleControl: controls.style_control,
      qualityControl: controls.quality_control,
      negativePrompt: controls.negative_prompt,
      seedControl: controls.seed_control,
      batchControl: controls.batch_control,
    } as WorkspaceChannel['capabilities'],
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

function fromVideoPresetDto(preset: WorkspaceVideoPresetDto): WorkspaceMappedPreset {
  return {
    value: preset.value,
    zh: preset.label_zh || '',
  }
}

function toVideoPresetDto(preset: WorkspaceMappedPreset): WorkspaceVideoPresetDto {
  return {
    value: preset.value,
    label_zh: preset.zh || '',
    label_en: preset.value,
    disabled: false,
  }
}

function stringVideoPresetToDto(value: string): WorkspaceVideoPresetDto {
  return {
    value,
    label_zh: '',
    label_en: value,
    disabled: false,
  }
}

function fromVideoCategoryDto(
  category: WorkspaceVideoCategoryDto
): WorkspaceChannelCategory {
  return fromChatCategoryDto(category)
}

function fromVideoChannelDto(channel: WorkspaceVideoChannelDto): WorkspaceChannel {
  const defaultControls: WorkspaceVideoFeatureControlsDto = {
    first_frame_image: true,
    last_frame_image: true,
    reference_image_upload: true,
    duration_control: true,
    ratio_control: true,
    resolution_control: true,
    frame_rate_control: true,
    style_control: true,
    quality_control: true,
    negative_prompt: true,
    audio_track: true,
    camera_control: true,
    seed_control: true,
    batch_control: true,
  }
  const controls = {
    ...defaultControls,
    ...parseMaybeJson<WorkspaceVideoFeatureControlsDto>(
      channel.feature_controls,
      defaultControls
    ),
  }
  const resolutionPresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.resolution_presets,
    []
  )
  const ratioPresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.ratio_presets,
    []
  )
  const durationPresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.duration_presets,
    []
  )
  const frameRatePresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.frame_rate_presets,
    []
  )
  const stylePresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.style_presets,
    []
  )
  const qualityPresets = parseMaybeJson<WorkspaceVideoPresetDto[]>(
    channel.quality_presets,
    []
  )
  return {
    id: channel.id,
    weight: channel.weight,
    model: channel.model,
    modelAlias: channel.model_alias,
    category: channel.category_id,
    sizePresets: resolutionPresets.map((item) => item.value).filter(Boolean),
    ratioPresets: ratioPresets.map((item) => item.value).filter(Boolean),
    durationPresets: durationPresets.map((item) => item.value).filter(Boolean),
    frameRatePresets: frameRatePresets.map((item) => item.value).filter(Boolean),
    stylePresets: stylePresets.map(fromVideoPresetDto),
    qualityPresets: qualityPresets.map(fromVideoPresetDto),
    maxBatchSize: channel.max_batch_size || 1,
    capabilities: {
      firstFrame: controls.first_frame_image,
      lastFrame: controls.last_frame_image,
      referenceImage: controls.reference_image_upload,
      durationControl: controls.duration_control,
      ratioControl: controls.ratio_control,
      resolutionControl: controls.resolution_control,
      frameRateControl: controls.frame_rate_control,
      styleControl: controls.style_control,
      qualityControl: controls.quality_control,
      negativePrompt: controls.negative_prompt,
      audioTrack: controls.audio_track,
      cameraControl: controls.camera_control,
      seedControl: controls.seed_control,
      batchControl: controls.batch_control,
    } as WorkspaceChannel['capabilities'],
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

function toChatCategoryDto(category: WorkspaceChannelCategory) {
  return {
    weight: category.weight,
    name: String(category.name).trim(),
    alias: category.alias,
    remark: category.remark,
    disabled: category.disabled,
  }
}

function toImageCategoryDto(category: WorkspaceChannelCategory) {
  return toChatCategoryDto(category)
}

function toChatChannelDto(channel: WorkspaceChannel) {
  return {
    weight: channel.weight,
    model: channel.model,
    model_alias: channel.modelAlias,
    category_id: Number(channel.category),
    vision_enabled: Boolean(channel.capabilities.vision),
    file_upload_enabled: Boolean(channel.capabilities.fileUpload),
    web_search_enabled: Boolean(channel.capabilities.webSearch),
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

function toImageChannelDto(channel: WorkspaceChannel) {
  return {
    weight: channel.weight,
    model: channel.model,
    model_alias: channel.modelAlias,
    category_id: Number(channel.category),
    feature_controls: {
      reference_image_upload: Boolean(channel.capabilities.referenceImage),
      size_control: Boolean(channel.capabilities.sizeControl),
      ratio_control: Boolean(channel.capabilities.ratioControl),
      style_control: Boolean(channel.capabilities.styleControl),
      quality_control: Boolean(channel.capabilities.qualityControl),
      negative_prompt: Boolean(channel.capabilities.negativePrompt),
      seed_control: Boolean(channel.capabilities.seedControl),
      batch_control: Boolean(channel.capabilities.batchControl),
    },
    max_batch_size: Math.max(1, Number(channel.maxBatchSize || 1)),
    size_presets: (channel.sizePresets || []).map(stringPresetToDto),
    ratio_presets: (channel.ratioPresets || []).map(stringPresetToDto),
    style_presets: (channel.stylePresets || []).map(toImagePresetDto),
    quality_presets: (channel.qualityPresets || []).map(toImagePresetDto),
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

function toVideoCategoryDto(category: WorkspaceChannelCategory) {
  return toChatCategoryDto(category)
}

function toVideoChannelDto(channel: WorkspaceChannel) {
  return {
    weight: channel.weight,
    model: channel.model,
    model_alias: channel.modelAlias,
    category_id: Number(channel.category),
    feature_controls: {
      first_frame_image: Boolean(channel.capabilities.firstFrame),
      last_frame_image: Boolean(channel.capabilities.lastFrame),
      reference_image_upload: Boolean(channel.capabilities.referenceImage),
      duration_control: Boolean(channel.capabilities.durationControl),
      ratio_control: Boolean(channel.capabilities.ratioControl),
      resolution_control: Boolean(channel.capabilities.resolutionControl),
      frame_rate_control: Boolean(channel.capabilities.frameRateControl),
      style_control: Boolean(channel.capabilities.styleControl),
      quality_control: Boolean(channel.capabilities.qualityControl),
      negative_prompt: Boolean(channel.capabilities.negativePrompt),
      audio_track: Boolean(channel.capabilities.audioTrack),
      camera_control: Boolean(channel.capabilities.cameraControl),
      seed_control: Boolean(channel.capabilities.seedControl),
      batch_control: Boolean(channel.capabilities.batchControl),
    },
    max_batch_size: Math.max(1, Number(channel.maxBatchSize || 1)),
    resolution_presets: (channel.sizePresets || []).map(stringVideoPresetToDto),
    ratio_presets: (channel.ratioPresets || []).map(stringVideoPresetToDto),
    duration_presets: (channel.durationPresets || []).map(stringVideoPresetToDto),
    frame_rate_presets: (channel.frameRatePresets || []).map(
      stringVideoPresetToDto
    ),
    style_presets: (channel.stylePresets || []).map(toVideoPresetDto),
    quality_presets: (channel.qualityPresets || []).map(toVideoPresetDto),
    disabled: channel.disabled,
    remark: channel.remark,
  }
}

export function WorkspaceChannelManager({
  kind,
}: WorkspaceChannelManagerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const config = WORKSPACE_MANAGER_CONFIGS[kind]
  const isChat = kind === 'chat'
  const isImage = kind === 'image'
  const isVideo = kind === 'video'
  const isPersisted = isChat || isImage || isVideo
  const [activeTab, setActiveTab] = useState('channels')
  const [channels, setChannels] = useState<WorkspaceChannel[]>(() =>
    createDefaultChannels(kind)
  )
  const [categories, setCategories] = useState<WorkspaceChannelCategory[]>(() =>
    createDefaultCategories(kind)
  )
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] =
    useState<WorkspaceChannel | null>(null)
  const [editingCategory, setEditingCategory] =
    useState<WorkspaceChannelCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)

  const { data: modelsData } = useQuery({
    queryKey: [`workspace-${kind}-available-models`],
    queryFn: async () =>
      isImage
        ? (await getWorkspaceImageAvailableModels()).data || []
        : isVideo
          ? (await getWorkspaceVideoAvailableModels()).data || []
          : (await getWorkspaceChatAvailableModels()).data || [],
    staleTime: 60_000,
  })

  const { data: chatCategoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['workspace-chat-categories'],
    queryFn: async () => (await getWorkspaceChatCategories()).data || [],
    enabled: isChat,
  })

  const { data: chatChannelsData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ['workspace-chat-channels'],
    queryFn: async () => (await getWorkspaceChatChannels()).data || [],
    enabled: isChat,
  })

  const { data: imageCategoriesData, isLoading: isLoadingImageCategories } =
    useQuery({
      queryKey: ['workspace-image-categories'],
      queryFn: async () => (await getWorkspaceImageCategories()).data || [],
      enabled: isImage,
    })

  const { data: imageChannelsData, isLoading: isLoadingImageChannels } =
    useQuery({
      queryKey: ['workspace-image-channels'],
      queryFn: async () => (await getWorkspaceImageChannels()).data || [],
      enabled: isImage,
    })

  const { data: videoCategoriesData, isLoading: isLoadingVideoCategories } =
    useQuery({
      queryKey: ['workspace-video-categories'],
      queryFn: async () => (await getWorkspaceVideoCategories()).data || [],
      enabled: isVideo,
    })

  const { data: videoChannelsData, isLoading: isLoadingVideoChannels } =
    useQuery({
      queryKey: ['workspace-video-channels'],
      queryFn: async () => (await getWorkspaceVideoChannels()).data || [],
      enabled: isVideo,
    })

  const modelOptions = useMemo(
    () =>
      normalizeModelOptions(modelsData).length > 0
        ? normalizeModelOptions(modelsData)
        : Array.from(new Set(FALLBACK_MODEL_OPTIONS)),
    [modelsData]
  )
  const resolvedCategories = isChat
    ? (chatCategoriesData || []).map(fromChatCategoryDto)
    : isImage
      ? (imageCategoriesData || []).map(fromImageCategoryDto)
      : isVideo
        ? (videoCategoriesData || []).map(fromVideoCategoryDto)
        : categories
  const resolvedChannels = isChat
    ? (chatChannelsData || []).map(fromChatChannelDto)
    : isImage
      ? (imageChannelsData || []).map(fromImageChannelDto)
      : isVideo
        ? (videoChannelsData || []).map(fromVideoChannelDto)
        : channels
  const enabledCategories = resolvedCategories.filter((item) => !item.disabled)

  const invalidateChatQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace-chat-categories'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-chat-channels'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-chat-models'] })
  }

  const invalidateImageQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace-image-categories'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-image-channels'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-image-models'] })
  }

  const invalidateVideoQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace-video-categories'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-video-channels'] })
    queryClient.invalidateQueries({ queryKey: ['workspace-video-models'] })
  }

  const saveChatCategoryMutation = useMutation({
    mutationFn: async (category: WorkspaceChannelCategory) => {
      const payload = toChatCategoryDto(category)
      if (typeof category.id === 'number' && category.id > 0) {
        return updateWorkspaceChatCategory(category.id, payload)
      }
      return createWorkspaceChatCategory(payload)
    },
    onSuccess: () => {
      toast.success(t('Category configuration saved'))
      setCategoryDialogOpen(false)
      invalidateChatQueries()
    },
  })

  const saveChatChannelMutation = useMutation({
    mutationFn: async (channel: WorkspaceChannel) => {
      const payload = toChatChannelDto(channel)
      if (typeof channel.id === 'number' && channel.id > 0) {
        return updateWorkspaceChatChannel(channel.id, payload)
      }
      return createWorkspaceChatChannel(payload)
    },
    onSuccess: () => {
      toast.success(t('Channel configuration saved'))
      setChannelDialogOpen(false)
      invalidateChatQueries()
    },
  })

  const deleteChatCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceChatCategory(id),
    onSuccess: () => {
      toast.success(t('Category deleted'))
      invalidateChatQueries()
    },
  })

  const deleteChatChannelMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceChatChannel(id),
    onSuccess: () => {
      toast.success(t('Channel deleted'))
      invalidateChatQueries()
    },
  })

  const saveImageCategoryMutation = useMutation({
    mutationFn: async (category: WorkspaceChannelCategory) => {
      const payload = toImageCategoryDto(category)
      if (typeof category.id === 'number' && category.id > 0) {
        return updateWorkspaceImageCategory(category.id, payload)
      }
      return createWorkspaceImageCategory(payload)
    },
    onSuccess: () => {
      toast.success(t('Category configuration saved'))
      setCategoryDialogOpen(false)
      invalidateImageQueries()
    },
  })

  const saveImageChannelMutation = useMutation({
    mutationFn: async (channel: WorkspaceChannel) => {
      const payload = toImageChannelDto(channel)
      if (typeof channel.id === 'number' && channel.id > 0) {
        return updateWorkspaceImageChannel(channel.id, payload)
      }
      return createWorkspaceImageChannel(payload)
    },
    onSuccess: () => {
      toast.success(t('Channel configuration saved'))
      setChannelDialogOpen(false)
      invalidateImageQueries()
    },
  })

  const deleteImageCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceImageCategory(id),
    onSuccess: () => {
      toast.success(t('Category deleted'))
      invalidateImageQueries()
    },
  })

  const deleteImageChannelMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceImageChannel(id),
    onSuccess: () => {
      toast.success(t('Channel deleted'))
      invalidateImageQueries()
    },
  })

  const saveVideoCategoryMutation = useMutation({
    mutationFn: async (category: WorkspaceChannelCategory) => {
      const payload = toVideoCategoryDto(category)
      if (typeof category.id === 'number' && category.id > 0) {
        return updateWorkspaceVideoCategory(category.id, payload)
      }
      return createWorkspaceVideoCategory(payload)
    },
    onSuccess: () => {
      toast.success(t('Category configuration saved'))
      setCategoryDialogOpen(false)
      invalidateVideoQueries()
    },
  })

  const saveVideoChannelMutation = useMutation({
    mutationFn: async (channel: WorkspaceChannel) => {
      const payload = toVideoChannelDto(channel)
      if (typeof channel.id === 'number' && channel.id > 0) {
        return updateWorkspaceVideoChannel(channel.id, payload)
      }
      return createWorkspaceVideoChannel(payload)
    },
    onSuccess: () => {
      toast.success(t('Channel configuration saved'))
      setChannelDialogOpen(false)
      invalidateVideoQueries()
    },
  })

  const deleteVideoCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceVideoCategory(id),
    onSuccess: () => {
      toast.success(t('Category deleted'))
      invalidateVideoQueries()
    },
  })

  const deleteVideoChannelMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceVideoChannel(id),
    onSuccess: () => {
      toast.success(t('Channel deleted'))
      invalidateVideoQueries()
    },
  })

  const openNewChannelDialog = () => {
    setEditingChannel(
      createEmptyChannel(
        kind,
        modelOptions[0] || FALLBACK_MODEL_OPTIONS[0],
        enabledCategories[0]?.id || resolvedCategories[0]?.id || 'general'
      )
    )
    setChannelDialogOpen(true)
  }

  const openNewCategoryDialog = () => {
    setEditingCategory({
      id: `${kind}-category-${Date.now()}`,
      weight: 0,
      name: '',
      alias: '',
      remark: '',
      disabled: false,
    })
    setCategoryDialogOpen(true)
  }

  const upsertChannel = (channel: WorkspaceChannel) => {
    if (isChat) {
      saveChatChannelMutation.mutate(channel)
      return
    }
    if (isImage) {
      saveImageChannelMutation.mutate(channel)
      return
    }
    if (isVideo) {
      saveVideoChannelMutation.mutate(channel)
      return
    }
    setChannels((current) => {
      const exists = current.some((item) => item.id === channel.id)
      const next = exists
        ? current.map((item) => (item.id === channel.id ? channel : item))
        : [...current, channel]
      return sortByWeight(next)
    })
    toast.success(t('Channel configuration saved'))
    setChannelDialogOpen(false)
  }

  const upsertCategory = (category: WorkspaceChannelCategory) => {
    if (!category.name.trim()) {
      toast.error(t('Category is required'))
      return
    }
    if (isChat) {
      saveChatCategoryMutation.mutate(category)
      return
    }
    if (isImage) {
      saveImageCategoryMutation.mutate(category)
      return
    }
    if (isVideo) {
      saveVideoCategoryMutation.mutate(category)
      return
    }
    setCategories((current) => {
      const exists = current.some((item) => item.id === category.id)
      const next = exists
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category]
      return sortByWeight(next)
    })
    toast.success(t('Category configuration saved'))
    setCategoryDialogOpen(false)
  }

  const updateChannel = (
    id: string | number,
    patch: Partial<WorkspaceChannel>
  ) => {
    if (isChat) {
      const target = resolvedChannels.find((item) => item.id === id)
      if (target) {
        saveChatChannelMutation.mutate({ ...target, ...patch })
      }
      return
    }
    if (isImage) {
      const target = resolvedChannels.find((item) => item.id === id)
      if (target) {
        saveImageChannelMutation.mutate({ ...target, ...patch })
      }
      return
    }
    if (isVideo) {
      const target = resolvedChannels.find((item) => item.id === id)
      if (target) {
        saveVideoChannelMutation.mutate({ ...target, ...patch })
      }
      return
    }
    setChannels((current) =>
      sortByWeight(
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      )
    )
  }

  const updateCategory = (
    id: string | number,
    patch: Partial<WorkspaceChannelCategory>
  ) => {
    if (isChat) {
      const target = resolvedCategories.find((item) => item.id === id)
      if (target) {
        saveChatCategoryMutation.mutate({ ...target, ...patch })
      }
      return
    }
    if (isImage) {
      const target = resolvedCategories.find((item) => item.id === id)
      if (target) {
        saveImageCategoryMutation.mutate({ ...target, ...patch })
      }
      return
    }
    if (isVideo) {
      const target = resolvedCategories.find((item) => item.id === id)
      if (target) {
        saveVideoCategoryMutation.mutate({ ...target, ...patch })
      }
      return
    }
    setCategories((current) =>
      sortByWeight(
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      )
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'channel') {
      if (isChat && typeof deleteTarget.id === 'number') {
        deleteChatChannelMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      if (isImage && typeof deleteTarget.id === 'number') {
        deleteImageChannelMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      if (isVideo && typeof deleteTarget.id === 'number') {
        deleteVideoChannelMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      setChannels((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      )
      toast.success(t('Channel deleted'))
    } else {
      if (isChat && typeof deleteTarget.id === 'number') {
        deleteChatCategoryMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      if (isImage && typeof deleteTarget.id === 'number') {
        deleteImageCategoryMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      if (isVideo && typeof deleteTarget.id === 'number') {
        deleteVideoCategoryMutation.mutate(deleteTarget.id)
        setDeleteTarget(null)
        return
      }
      setCategories((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      )
      toast.success(t('Category deleted'))
    }
    setDeleteTarget(null)
  }

  return (
    <div className='space-y-4'>
      <div className='text-muted-foreground text-sm'>
        {isPersisted
          ? t('Workspace channel configuration is stored on the server.')
          : t(
              'Frontend-only workspace channel configuration preview. Backend persistence will be connected later.'
            )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <TabsList>
            <TabsTrigger value='channels'>{t('Channel Management')}</TabsTrigger>
            <TabsTrigger value='categories'>
              {t('Category Management')}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'channels' ? (
            <Button onClick={openNewChannelDialog}>
              <Plus />
              {t('Add channel')}
            </Button>
          ) : (
            <Button onClick={openNewCategoryDialog}>
              <Plus />
              {t('Add category')}
            </Button>
          )}
        </div>

        <TabsContent value='channels'>
          <WorkspaceChannelsTable
            config={config}
            kind={kind}
            channels={resolvedChannels}
            categories={resolvedCategories}
            isLoading={
              isChat
                ? isLoadingChannels
                : isImage
                  ? isLoadingImageChannels
                  : isVideo
                    ? isLoadingVideoChannels
                    : false
            }
            updateChannel={updateChannel}
            onEdit={(channel) => {
              setEditingChannel(channel)
              setChannelDialogOpen(true)
            }}
            onDelete={(channel) =>
              setDeleteTarget({
                type: 'channel',
                id: channel.id,
                label: channel.modelAlias || channel.model,
              })
            }
          />
        </TabsContent>

        <TabsContent value='categories'>
          <WorkspaceCategoriesTable
            config={config}
            categories={resolvedCategories}
            isLoading={
              isChat
                ? isLoadingCategories
                : isImage
                  ? isLoadingImageCategories
                  : isVideo
                    ? isLoadingVideoCategories
                    : false
            }
            updateCategory={updateCategory}
            onEdit={(category) => {
              setEditingCategory(category)
              setCategoryDialogOpen(true)
            }}
            onDelete={(category) =>
              setDeleteTarget({
                type: 'category',
                id: category.id,
                label: category.alias || category.name,
              })
            }
          />
        </TabsContent>
      </Tabs>

      <ChannelDialog
        config={config}
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        value={editingChannel}
        modelOptions={modelOptions}
        categories={resolvedCategories}
        onSave={upsertChannel}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        value={editingCategory}
        onSave={upsertCategory}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete configuration')}
        desc={t('This frontend configuration will be removed from the list.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={handleDelete}
      >
        <div className='bg-muted rounded-lg px-3 py-2 text-sm'>
          {deleteTarget?.label}
        </div>
      </ConfirmDialog>
    </div>
  )
}

function WorkspaceChannelsTable(props: {
  config: WorkspaceManagerConfig
  kind: WorkspaceChannelKind
  channels: WorkspaceChannel[]
  categories: WorkspaceChannelCategory[]
  isLoading?: boolean
  updateChannel: (id: string | number, patch: Partial<WorkspaceChannel>) => void
  onEdit: (channel: WorkspaceChannel) => void
  onDelete: (channel: WorkspaceChannel) => void
}) {
  const { t, i18n } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'weight', desc: true },
  ])
  const zhLanguage = isZhLanguage(i18n.language)

  const categoryMap = useMemo(
    () =>
      new Map(
        props.categories.map((category) => [
          category.id,
          category.alias || category.name,
        ])
      ),
    [props.categories]
  )

  const presetColumns = useMemo<ColumnDef<WorkspaceChannel>[]>(
    () =>
      props.kind === 'chat'
        ? []
        : [
            {
              id: 'sizePresets',
              header: () =>
                props.kind === 'video'
                  ? t('Resolution presets')
                  : t('Size presets'),
              cell: ({ row }) => (
                <PresetBadges values={row.original.sizePresets || []} />
              ),
              size: 180,
            },
            {
              id: 'ratioPresets',
              header: () => t('Ratio presets'),
              cell: ({ row }) => (
                <PresetBadges values={row.original.ratioPresets || []} />
              ),
              size: 160,
            },
            ...(props.kind === 'image'
              ? [
                  {
                    id: 'stylePresets',
                    header: () => t('Style presets'),
                    cell: ({ row }) => (
                      <PresetBadges
                        values={(row.original.stylePresets || []).map((item) =>
                          formatMappedPreset(item, zhLanguage)
                        )}
                      />
                    ),
                    size: 170,
                  } satisfies ColumnDef<WorkspaceChannel>,
                ]
              : [
                  {
                    id: 'durationPresets',
                    header: () => t('Duration presets'),
                    cell: ({ row }) => (
                      <PresetBadges
                        values={row.original.durationPresets || []}
                      />
                    ),
                    size: 150,
                  } satisfies ColumnDef<WorkspaceChannel>,
                  {
                    id: 'frameRatePresets',
                    header: () => t('Frame rate presets'),
                    cell: ({ row }) => (
                      <PresetBadges
                        values={row.original.frameRatePresets || []}
                      />
                    ),
                    size: 150,
                  } satisfies ColumnDef<WorkspaceChannel>,
                ]),
            {
              id: 'qualityPresets',
              header: () => t('Quality presets'),
              cell: ({ row }) => (
                <PresetBadges
                  values={(row.original.qualityPresets || []).map((item) =>
                    formatMappedPreset(item, zhLanguage)
                  )}
                />
              ),
              size: 170,
            },
          ],
    [props.kind, t, zhLanguage]
  )

  const columns = useMemo<ColumnDef<WorkspaceChannel>[]>(
    () => [
      {
        accessorKey: 'weight',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Sort weight')} />
        ),
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>{row.original.weight}</span>
        ),
        size: 90,
      },
      {
        accessorKey: 'model',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Model')} />
        ),
        cell: ({ row }) => <span className='font-mono'>{row.original.model}</span>,
        size: 180,
      },
      {
        accessorKey: 'modelAlias',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Model alias')} />
        ),
        cell: ({ row }) => row.original.modelAlias,
        size: 150,
      },
      {
        accessorKey: 'category',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Model category')} />
        ),
        cell: ({ row }) =>
          categoryMap.get(row.original.category) || row.original.category,
        size: 140,
      },
      ...presetColumns,
      ...(props.kind === 'image' || props.kind === 'video'
        ? [
            {
              accessorKey: 'maxBatchSize',
              header: ({ column }) => (
                <DataTableColumnHeader
                  column={column}
                  title={t('Max generation count')}
                />
              ),
              cell: ({ row }) => (
                <span className='font-medium tabular-nums'>
                  {row.original.maxBatchSize || 1}
                </span>
              ),
              size: 120,
            } satisfies ColumnDef<WorkspaceChannel>,
          ]
        : []),
      {
        id: 'capabilities',
        header: () => t('Feature controls'),
        cell: ({ row }) => (
          <CapabilityButtons
            config={props.config}
            channel={row.original}
            onToggle={(key) =>
              props.updateChannel(row.original.id, {
                capabilities: {
                  ...row.original.capabilities,
                  [key]: !row.original.capabilities[key],
                },
              })
            }
          />
        ),
        size: 170,
      },
      {
        accessorKey: 'disabled',
        header: () => t('Disabled'),
        cell: ({ row }) => (
          <Switch
            checked={row.original.disabled}
            onCheckedChange={(checked) =>
              props.updateChannel(row.original.id, { disabled: checked })
            }
            aria-label={t('Toggle disabled state')}
          />
        ),
        size: 90,
      },
      {
        accessorKey: 'remark',
        header: () => t('Remark'),
        cell: ({ row }) => (
          <RemarkEditor
            value={row.original.remark}
            onSave={(remark) => props.updateChannel(row.original.id, { remark })}
          />
        ),
        size: 220,
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Edit')}
              onClick={() => props.onEdit(row.original)}
            >
              <Edit3 />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Delete')}
              onClick={() => props.onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [categoryMap, presetColumns, props, t]
  )

  const table = useReactTable({
    data: props.channels,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={props.isLoading}
      emptyTitle={t(props.config.emptyChannelTitleKey)}
      emptyDescription={t('Create a channel configuration to preview the management workflow.')}
      applyHeaderSize
      hideMobile
      paginationInFooter={false}
      showPagination={props.channels.length > 10}
      getRowClassName={(row) =>
        row.original.disabled ? 'opacity-55 bg-muted/30' : undefined
      }
    />
  )
}

function WorkspaceCategoriesTable(props: {
  config: WorkspaceManagerConfig
  categories: WorkspaceChannelCategory[]
  isLoading?: boolean
  updateCategory: (
    id: string | number,
    patch: Partial<WorkspaceChannelCategory>
  ) => void
  onEdit: (category: WorkspaceChannelCategory) => void
  onDelete: (category: WorkspaceChannelCategory) => void
}) {
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'weight', desc: true },
  ])

  const columns = useMemo<ColumnDef<WorkspaceChannelCategory>[]>(
    () => [
      {
        accessorKey: 'weight',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Weight')} />
        ),
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>{row.original.weight}</span>
        ),
        size: 90,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Category')} />
        ),
        cell: ({ row }) => <span className='font-mono'>{row.original.name}</span>,
        size: 160,
      },
      {
        accessorKey: 'alias',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Category alias')} />
        ),
        cell: ({ row }) => row.original.alias,
        size: 180,
      },
      {
        accessorKey: 'remark',
        header: () => t('Remark'),
        cell: ({ row }) => (
          <RemarkEditor
            value={row.original.remark}
            onSave={(remark) =>
              props.updateCategory(row.original.id, { remark })
            }
          />
        ),
        size: 260,
      },
      {
        accessorKey: 'disabled',
        header: () => t('Disabled'),
        cell: ({ row }) => (
          <Switch
            checked={row.original.disabled}
            onCheckedChange={(checked) =>
              props.updateCategory(row.original.id, { disabled: checked })
            }
            aria-label={t('Toggle disabled state')}
          />
        ),
        size: 90,
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Edit')}
              onClick={() => props.onEdit(row.original)}
            >
              <Edit3 />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={t('Delete')}
              onClick={() => props.onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [props, t]
  )

  const table = useReactTable({
    data: props.categories,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={props.isLoading}
      emptyTitle={t(props.config.emptyCategoryTitleKey)}
      emptyDescription={t('Create a category before assigning channel models.')}
      applyHeaderSize
      hideMobile
      paginationInFooter={false}
      showPagination={props.categories.length > 10}
      getRowClassName={(row) =>
        row.original.disabled ? 'opacity-55 bg-muted/30' : undefined
      }
    />
  )
}

function CapabilityButtons(props: {
  config: WorkspaceManagerConfig
  channel: WorkspaceChannel
  onToggle: (key: WorkspaceCapabilityKey) => void
}) {
  const { t } = useTranslation()

  return (
    <TooltipProvider delay={100}>
      <div className='flex flex-wrap items-center gap-1'>
        {props.config.capabilities.map((capability) => {
          const enabled = props.channel.capabilities[capability.key]
          const Icon = capability.icon
          return (
            <Tooltip key={capability.key}>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant={enabled ? 'secondary' : 'outline'}
                    size='icon-sm'
                    aria-label={t(capability.labelKey)}
                    className={cn(
                      enabled
                        ? 'text-foreground'
                        : 'text-muted-foreground opacity-70'
                    )}
                    onClick={() => props.onToggle(capability.key)}
                  />
                }
              >
                <Icon />
              </TooltipTrigger>
              <TooltipContent>
                <span>
                  {t(capability.labelKey)} -{' '}
                  {enabled ? t('Enabled') : t('Disabled')}
                </span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function PresetBadges(props: { values: string[] }) {
  const visible = props.values.filter(Boolean).slice(0, 4)
  const rest = props.values.filter(Boolean).length - visible.length

  if (visible.length === 0) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  return (
    <div className='flex max-w-[220px] flex-wrap gap-1'>
      {visible.map((value) => (
        <span
          key={value}
          className='bg-muted text-foreground rounded-md px-1.5 py-0.5 text-xs'
        >
          {value}
        </span>
      ))}
      {rest > 0 && (
        <span className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs'>
          +{rest}
        </span>
      )}
    </div>
  )
}

function RemarkEditor(props: {
  value: string
  onSave: (value: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(props.value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            className='h-auto min-h-7 w-full max-w-[260px] justify-start px-2 text-left font-normal whitespace-normal'
          />
        }
      >
        <span className='truncate'>
          {props.value || t('Click to add remark')}
        </span>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80'>
        <Label>{t('Remark')}</Label>
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} />
        <div className='flex justify-end gap-2'>
          <Button variant='outline' size='sm' onClick={() => setOpen(false)}>
            {t('Cancel')}
          </Button>
          <Button
            size='sm'
            onClick={() => {
              props.onSave(draft)
              setOpen(false)
            }}
          >
            <Save />
            {t('Save')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ChannelDialog(props: {
  config: WorkspaceManagerConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  value: WorkspaceChannel | null
  modelOptions: string[]
  categories: WorkspaceChannelCategory[]
  onSave: (channel: WorkspaceChannel) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<WorkspaceChannel | null>(props.value)
  const kind = props.config.kind

  useEffect(() => {
    if (props.open) {
      setDraft(props.value)
    }
  }, [props.open, props.value])

  if (!draft) return null

  const updateCapability = (
    capability: WorkspaceCapabilityConfig,
    checked: boolean
  ) => {
    setDraft({
      ...draft,
      capabilities: {
        ...draft.capabilities,
        [capability.key]: checked,
      },
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={kind === 'video' ? 'sm:max-w-4xl' : 'sm:max-w-3xl'}>
        <DialogHeader>
          <DialogTitle>{t('Edit channel configuration')}</DialogTitle>
          <DialogDescription>
            {t('Select an existing model and configure workspace display behavior.')}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-6 py-1'>
          <div className='grid gap-5 sm:grid-cols-2'>
            <Field label={t('Sort weight')}>
              <Input
                type='number'
                value={draft.weight}
                onChange={(event) =>
                  setDraft({ ...draft, weight: Number(event.target.value) })
                }
              />
            </Field>
            <Field label={t('Model')}>
              <Select
                value={draft.model}
                onValueChange={(model) => {
                  if (!model || model === '__empty__') return
                  setDraft({
                    ...draft,
                    model,
                    modelAlias: draft.modelAlias || model,
                  })
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.modelOptions.length > 0 ? (
                    props.modelOptions.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value='__empty__' disabled>
                      {t('Model not found')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('Model alias')}>
              <Input
                value={draft.modelAlias}
                onChange={(event) =>
                  setDraft({ ...draft, modelAlias: event.target.value })
                }
              />
            </Field>
            <Field label={t('Model category')}>
              <Select
                value={String(draft.category)}
                onValueChange={(category) => {
                  if (!category) return
                  const numericCategory = Number(category)
                  setDraft({
                    ...draft,
                    category: Number.isNaN(numericCategory)
                      ? category
                      : numericCategory,
                  })
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={String(category.id)}
                      disabled={category.disabled}
                    >
                      {category.alias || category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {(kind === 'image' || kind === 'video') && (
              <Field label={t('Max generation count')}>
                <Input
                  type='number'
                  min={1}
                  max={100}
                  value={draft.maxBatchSize || 1}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      maxBatchSize: Math.max(1, Number(event.target.value)),
                    })
                  }
                />
              </Field>
            )}
          </div>
          <div className='space-y-3'>
            <Label>{t('Feature controls')}</Label>
            <div
              className={cn(
                'grid gap-2',
                kind === 'video'
                  ? 'grid-cols-3'
                  : 'sm:grid-cols-3'
              )}
            >
              {props.config.capabilities.map((capability) => {
                const Icon = capability.icon
                return (
                  <label
                    key={capability.key}
                    className={cn(
                      'bg-muted/30 flex items-start rounded-lg border',
                      kind === 'video' ? 'gap-1.5 p-2' : 'gap-2 p-3'
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 shrink-0',
                        kind === 'video' ? 'size-3.5' : 'size-4'
                      )}
                    />
                    <span className='min-w-0 flex-1'>
                      <span
                        className={cn(
                          'block font-medium',
                          kind === 'video' ? 'text-xs' : 'text-sm'
                        )}
                      >
                        {t(capability.labelKey)}
                      </span>
                      <span
                        className={cn(
                          'text-muted-foreground block',
                          kind === 'video' ? 'text-[10px]' : 'text-xs'
                        )}
                      >
                        {t(capability.descriptionKey)}
                      </span>
                    </span>
                    <Switch
                      checked={Boolean(draft.capabilities[capability.key])}
                      onCheckedChange={(checked) =>
                        updateCapability(capability, checked)
                      }
                    />
                  </label>
                )
              })}
            </div>
          </div>
          {kind === 'image' && (
            <div className='grid gap-5 sm:grid-cols-2'>
              <StringPresetEditor
                label={t('Size presets')}
                values={draft.sizePresets || []}
                onChange={(sizePresets) =>
                  setDraft({ ...draft, sizePresets })
                }
              />
              <StringPresetEditor
                label={t('Ratio presets')}
                values={draft.ratioPresets || []}
                onChange={(ratioPresets) =>
                  setDraft({ ...draft, ratioPresets })
                }
              />
              <MappedPresetEditor
                label={t('Style presets')}
                presets={draft.stylePresets || []}
                onChange={(stylePresets) =>
                  setDraft({ ...draft, stylePresets })
                }
              />
              <MappedPresetEditor
                label={t('Quality presets')}
                presets={draft.qualityPresets || []}
                onChange={(qualityPresets) =>
                  setDraft({ ...draft, qualityPresets })
                }
              />
            </div>
          )}
          {kind === 'video' && (
            <div className='grid gap-5 sm:grid-cols-2'>
              <StringPresetEditor
                label={t('Resolution presets')}
                values={draft.sizePresets || []}
                onChange={(sizePresets) =>
                  setDraft({ ...draft, sizePresets })
                }
              />
              <StringPresetEditor
                label={t('Ratio presets')}
                values={draft.ratioPresets || []}
                onChange={(ratioPresets) =>
                  setDraft({ ...draft, ratioPresets })
                }
              />
              <StringPresetEditor
                label={t('Duration presets')}
                values={draft.durationPresets || []}
                onChange={(durationPresets) =>
                  setDraft({ ...draft, durationPresets })
                }
              />
              <StringPresetEditor
                label={t('Frame rate presets')}
                values={draft.frameRatePresets || []}
                onChange={(frameRatePresets) =>
                  setDraft({ ...draft, frameRatePresets })
                }
              />
              <MappedPresetEditor
                label={t('Quality presets')}
                presets={draft.qualityPresets || []}
                onChange={(qualityPresets) =>
                  setDraft({ ...draft, qualityPresets })
                }
              />
            </div>
          )}
          <Field label={t('Remark')}>
            <Input
              value={draft.remark}
              onChange={(event) =>
                setDraft({ ...draft, remark: event.target.value })
              }
            />
          </Field>
          <label className='flex items-center gap-2'>
            <Switch
              checked={draft.disabled}
              onCheckedChange={(disabled) => setDraft({ ...draft, disabled })}
            />
            <span className='flex items-center gap-1 text-sm'>
              {draft.disabled ? <PowerOff /> : <Power />}
              {t('Disabled')}
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => props.onSave(draft)}>
            <Save />
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: WorkspaceChannelCategory | null
  onSave: (category: WorkspaceChannelCategory) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<WorkspaceChannelCategory | null>(
    props.value
  )

  useEffect(() => {
    if (props.open) {
      setDraft(props.value)
    }
  }, [props.open, props.value])

  if (!draft) return null

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Edit category configuration')}</DialogTitle>
          <DialogDescription>
            {t('Categories are used by channel configurations on this page.')}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <Field label={t('Weight')}>
            <Input
              type='number'
              value={draft.weight}
              onChange={(event) =>
                setDraft({ ...draft, weight: Number(event.target.value) })
              }
            />
          </Field>
          <Field label={t('Category')}>
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </Field>
          <Field label={t('Category alias')}>
            <Input
              value={draft.alias}
              onChange={(event) =>
                setDraft({ ...draft, alias: event.target.value })
              }
            />
          </Field>
          <Field label={t('Remark')}>
            <Input
              value={draft.remark}
              onChange={(event) =>
                setDraft({ ...draft, remark: event.target.value })
              }
            />
          </Field>
          <label className='flex items-center gap-2'>
            <Switch
              checked={draft.disabled}
              onCheckedChange={(disabled) => setDraft({ ...draft, disabled })}
            />
            <span className='text-sm'>{t('Disabled')}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => props.onSave(draft)}>
            <Save />
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StringPresetEditor(props: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  const addValue = () => {
    const value = draft.trim()
    if (!value) return
    props.onChange(Array.from(new Set([...props.values, value])))
    setDraft('')
  }

  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      <div className='flex flex-wrap gap-1.5 rounded-md border p-2'>
        {props.values.map((value) => (
          <span
            key={value}
            className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'
          >
            {value}
            <button
              type='button'
              aria-label={t('Delete')}
              onClick={() =>
                props.onChange(props.values.filter((item) => item !== value))
              }
            >
              <X className='size-3' />
            </button>
          </span>
        ))}
        <div className='flex min-w-40 flex-1 gap-1'>
          <Input
            className='h-8'
            value={draft}
            placeholder={t('Add preset')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addValue()
              }
            }}
          />
          <Button type='button' size='sm' variant='outline' onClick={addValue}>
            <Plus />
          </Button>
        </div>
      </div>
    </div>
  )
}

function MappedPresetEditor(props: {
  label: string
  presets: WorkspaceMappedPreset[]
  onChange: (presets: WorkspaceMappedPreset[]) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [zh, setZh] = useState('')

  const addPreset = () => {
    const nextValue = value.trim()
    if (!nextValue) return
    const nextZh = zh.trim()
    const next = [
      ...props.presets.filter((item) => item.value !== nextValue),
      { value: nextValue, zh: nextZh },
    ]
    props.onChange(next)
    setValue('')
    setZh('')
  }

  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      <div className='space-y-2 rounded-md border p-2'>
        <div className='flex flex-wrap gap-1.5'>
          {props.presets.map((preset) => (
            <span
              key={preset.value}
              className='bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs'
            >
              {preset.value}
              {preset.zh ? ` / ${preset.zh}` : ''}
              <button
                type='button'
                aria-label={t('Delete')}
                onClick={() =>
                  props.onChange(
                    props.presets.filter((item) => item.value !== preset.value)
                  )
                }
              >
                <X className='size-3' />
              </button>
            </span>
          ))}
        </div>
        <div className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]'>
          <Input
            className='h-8'
            value={value}
            placeholder={t('Parameter value')}
            onChange={(event) => setValue(event.target.value)}
          />
          <Input
            className='h-8'
            value={zh}
            placeholder={t('Chinese display name')}
            onChange={(event) => setZh(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addPreset()
              }
            }}
          />
          <Button type='button' size='sm' variant='outline' onClick={addPreset}>
            <Plus />
            {t('Add')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field(props: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', props.className)}>
      <Label>{props.label}</Label>
      {props.children}
    </div>
  )
}
