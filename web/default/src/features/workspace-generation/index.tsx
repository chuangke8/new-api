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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  generateWorkspaceImage,
  generateWorkspaceVideo,
  getWorkspaceImageModels,
  getWorkspaceVideoTask,
  getWorkspaceVideoModels,
  type WorkspaceImageFeatureControlsDto,
  type WorkspaceImagePresetDto,
  type WorkspaceVideoFeatureControlsDto,
} from '@/features/system-settings/workspace/api'
import {
  IMAGE_QUALITY_PRESETS,
  IMAGE_RATIO_PRESETS,
  IMAGE_SIZE_PRESETS,
  IMAGE_STYLE_PRESETS,
  VIDEO_DURATION_PRESETS,
  VIDEO_FRAME_RATE_PRESETS,
  VIDEO_QUALITY_PRESETS,
  VIDEO_RATIO_PRESETS,
  VIDEO_RESOLUTION_PRESETS,
} from '@/features/system-settings/workspace/config'
import type { WorkspaceMappedPreset } from '@/features/system-settings/workspace/types'
import { listTaskCenter } from '@/features/task-center/api'
import type { TaskCenterRecord } from '@/features/task-center/types'
import { formatUnixTime, parseDetail } from '@/features/task-center/utils'

type GenerationKind = 'image' | 'video'

type GeneratedItem = {
  id: string
  kind: GenerationKind
  prompt: string
  revisedPrompt?: string
  model: string
  status: 'ready' | 'generating' | 'queued' | 'processing' | 'failed'
  taskId?: string
  imageUrl?: string
  videoUrl?: string
  b64Json?: string
  size?: string
  ratio?: string
  quality?: string
  duration?: string
  frameRate?: string
}

type GenerationMappedPreset = WorkspaceMappedPreset & {
  en?: string
}

type UploadedImage = {
  name: string
  dataUrl: string
}

const localizedPresetLabels: Record<string, string> = {
  anime: 'Anime',
  auto: 'Auto',
  fast: 'Fast',
  hd: 'HD',
  high: 'High',
  low: 'Low',
  medium: 'Medium',
  natural: 'Natural',
  photorealistic: 'Photorealistic',
  pro: 'Professional',
  standard: 'Standard',
  vivid: 'Vivid',
}

function isZhLanguage(language?: string) {
  return Boolean(language?.toLowerCase().startsWith('zh'))
}

function presetLabel(
  preset: string | GenerationMappedPreset,
  zhLanguage: boolean,
  t: (key: string) => string
) {
  if (typeof preset === 'string') return preset
  if (zhLanguage && preset.zh) return preset.zh
  if (preset.en) return preset.en
  return t(localizedPresetLabels[preset.value] || preset.value)
}

function imagePresetToMappedPreset(
  preset: WorkspaceImagePresetDto
): GenerationMappedPreset {
  return {
    value: preset.value,
    zh: preset.label_zh || '',
    en: preset.label_en || preset.value,
  }
}

function enabledImagePresets(presets: WorkspaceImagePresetDto[]) {
  return presets.filter((item) => item.value && !item.disabled)
}

function firstOrCurrent<T extends string | GenerationMappedPreset>(
  values: T[],
  current: string,
  fallback: string
) {
  const nextValues = values.map((item) =>
    typeof item === 'string' ? item : item.value
  )
  if (current && nextValues.includes(current)) return current
  return nextValues[0] || fallback
}

function normalizeImageSource(item: GeneratedItem) {
  if (item.imageUrl) return item.imageUrl
  if (item.b64Json) return `data:image/png;base64,${item.b64Json}`
  return ''
}

function readImageFileAsDataUrl(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('Failed to read image'))
        return
      }
      resolve({
        name: file.name,
        dataUrl: result,
      })
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

function videoPresetToMappedPreset(
  preset: WorkspaceImagePresetDto
): GenerationMappedPreset {
  return imagePresetToMappedPreset(preset)
}

function enabledVideoPresets(presets: WorkspaceImagePresetDto[]) {
  return enabledImagePresets(presets)
}

function defaultVideoFeatureControls(): WorkspaceVideoFeatureControlsDto {
  return {
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
  }
}

function generationStatusLabel(t: (key: string) => string, status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Cancelled',
    failed: 'Failed',
    pending: 'Pending',
    processing: 'Processing',
    queued: 'Queued',
    ready: 'Ready',
    running: 'Running',
    succeeded: 'Succeeded',
  }
  return t(labels[status] || status || '-')
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response
    const data = response?.data
    if (typeof data === 'object' && data) {
      const message = (data as { message?: string }).message
      if (message) return message
      const openAIError = (data as { error?: { message?: string } }).error
      if (openAIError?.message) return openAIError.message
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function downloadGeneratedImage(item: GeneratedItem) {
  const source = normalizeImageSource(item)
  if (!source) return false
  const fileName = `${item.kind}-${item.id}.png`
  if (item.b64Json) {
    const link = document.createElement('a')
    link.href = source
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  }
  const response = await fetch(source)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
  return true
}

export function WorkspaceImageGeneration() {
  return <WorkspaceGeneration kind='image' />
}

export function WorkspaceVideoGeneration() {
  return <WorkspaceGeneration kind='video' />
}

function WorkspaceGeneration({ kind }: { kind: GenerationKind }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const zhLanguage = isZhLanguage(i18n.language)
  const isImage = kind === 'image'
  const { data: imageModelsData } = useQuery({
    queryKey: ['workspace-image-models'],
    queryFn: async () => (await getWorkspaceImageModels()).data || [],
    staleTime: 60_000,
    enabled: isImage,
  })
  const { data: videoModelsData } = useQuery({
    queryKey: ['workspace-video-models'],
    queryFn: async () => (await getWorkspaceVideoModels()).data || [],
    staleTime: 60_000,
    enabled: !isImage,
  })
  const imageModels = useMemo(
    () => (imageModelsData || []).filter((item) => item.model),
    [imageModelsData]
  )
  const videoModels = useMemo(
    () => (videoModelsData || []).filter((item) => item.model),
    [videoModelsData]
  )
  const imageModelGroups = useMemo(() => {
    const groups = new Map<string, string>()
    for (const item of imageModels) {
      const key = String(item.category_id || item.category_name || 'default')
      if (!groups.has(key)) {
        groups.set(
          key,
          item.category_display ||
            item.category_alias ||
            item.category_name ||
            t('Default')
        )
      }
    }
    return Array.from(groups.entries()).map(([value, label]) => ({
      value,
      label,
    }))
  }, [imageModels, t])
  const [imageCategoryId, setImageCategoryId] = useState('')
  const filteredImageModels = useMemo(
    () =>
      imageCategoryId
        ? imageModels.filter(
            (item) =>
              String(item.category_id || item.category_name || 'default') ===
              imageCategoryId
          )
        : imageModels,
    [imageCategoryId, imageModels]
  )
  const modelOptions = useMemo(
    () =>
      isImage
        ? filteredImageModels.map((item) => ({
            value: item.model,
            label: item.display_name || item.model_alias || item.model,
            category: item.category_display,
            channelId: item.id,
          }))
        : videoModels.map((item) => ({
            value: item.model,
            label: item.display_name || item.model_alias || item.model,
            category: item.category_display,
          })),
    [filteredImageModels, isImage, videoModels]
  )
  const fallbackModel = modelOptions[0]?.value || ''
  const [model, setModel] = useState(fallbackModel)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [size, setSize] = useState(
    kind === 'image' ? IMAGE_SIZE_PRESETS[0] : VIDEO_RESOLUTION_PRESETS[0]
  )
  const [ratio, setRatio] = useState(
    kind === 'image' ? IMAGE_RATIO_PRESETS[0] : VIDEO_RATIO_PRESETS[0]
  )
  const [style, setStyle] = useState(IMAGE_STYLE_PRESETS[0]?.value || '')
  const [quality, setQuality] = useState(
    kind === 'image'
      ? IMAGE_QUALITY_PRESETS[0]?.value || ''
      : VIDEO_QUALITY_PRESETS[0]?.value || ''
  )
  const [duration, setDuration] = useState(VIDEO_DURATION_PRESETS[0])
  const [frameRate, setFrameRate] = useState(VIDEO_FRAME_RATE_PRESETS[0])
  const [count, setCount] = useState(1)
  const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null)
  const [firstFrameImage, setFirstFrameImage] = useState<UploadedImage | null>(null)
  const [lastFrameImage, setLastFrameImage] = useState<UploadedImage | null>(null)
  const [seedEnabled, setSeedEnabled] = useState(false)
  const [seed, setSeed] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [items, setItems] = useState<GeneratedItem[]>([])
  const effectiveModel = model || fallbackModel
  const selectedImageModel = useMemo(
    () => imageModels.find((item) => item.model === effectiveModel),
    [effectiveModel, imageModels]
  )
  const selectedVideoModel = useMemo(
    () => videoModels.find((item) => item.model === effectiveModel),
    [effectiveModel, videoModels]
  )
  const imageFeatureControls: WorkspaceImageFeatureControlsDto = useMemo(
    () =>
      selectedImageModel?.feature_controls || {
        reference_image_upload: true,
        size_control: true,
        ratio_control: true,
        style_control: true,
        quality_control: true,
        negative_prompt: true,
        seed_control: true,
        batch_control: true,
      },
    [selectedImageModel?.feature_controls]
  )
  const imageMaxBatchSize = Math.max(1, selectedImageModel?.max_batch_size || 4)
  const imageSizePresets = useMemo(
    () =>
      selectedImageModel
        ? enabledImagePresets(selectedImageModel.size_presets).map(
            (item) => item.value
          )
        : IMAGE_SIZE_PRESETS,
    [selectedImageModel]
  )
  const imageRatioPresets = useMemo(
    () =>
      selectedImageModel
        ? enabledImagePresets(selectedImageModel.ratio_presets).map(
            (item) => item.value
          )
        : IMAGE_RATIO_PRESETS,
    [selectedImageModel]
  )
  const imageStylePresets = useMemo(
    () =>
      selectedImageModel
        ? enabledImagePresets(selectedImageModel.style_presets).map(
            imagePresetToMappedPreset
          )
        : IMAGE_STYLE_PRESETS,
    [selectedImageModel]
  )
  const imageQualityPresets = useMemo(
    () =>
      selectedImageModel
        ? enabledImagePresets(selectedImageModel.quality_presets).map(
            imagePresetToMappedPreset
          )
        : IMAGE_QUALITY_PRESETS,
    [selectedImageModel]
  )
  const videoFeatureControls: WorkspaceVideoFeatureControlsDto = useMemo(
    () => selectedVideoModel?.feature_controls || defaultVideoFeatureControls(),
    [selectedVideoModel?.feature_controls]
  )
  const videoResolutionPresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.resolution_presets).map(
            (item) => item.value
          )
        : VIDEO_RESOLUTION_PRESETS,
    [selectedVideoModel]
  )
  const videoRatioPresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.ratio_presets).map(
            (item) => item.value
          )
        : VIDEO_RATIO_PRESETS,
    [selectedVideoModel]
  )
  const videoDurationPresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.duration_presets).map(
            (item) => item.value
          )
        : VIDEO_DURATION_PRESETS,
    [selectedVideoModel]
  )
  const videoFrameRatePresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.frame_rate_presets).map(
            (item) => item.value
          )
        : VIDEO_FRAME_RATE_PRESETS,
    [selectedVideoModel]
  )
  const videoStylePresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.style_presets).map(
            videoPresetToMappedPreset
          )
        : IMAGE_STYLE_PRESETS,
    [selectedVideoModel]
  )
  const videoQualityPresets = useMemo(
    () =>
      selectedVideoModel
        ? enabledVideoPresets(selectedVideoModel.quality_presets).map(
            videoPresetToMappedPreset
          )
        : VIDEO_QUALITY_PRESETS,
    [selectedVideoModel]
  )
  const imageHistoryQuery = useQuery({
    queryKey: ['workspace-image-generation-history'],
    queryFn: async () => {
      const response = await listTaskCenter({
        p: 1,
        page_size: 12,
        task_type: 'image',
        submit_source: 'workspace',
      })
      if (!response.success) throw new Error(response.message)
      return response.data.items || []
    },
    enabled: isImage,
    refetchInterval: isImage && isGenerating ? 5000 : false,
  })

  useEffect(() => {
    if (!isImage) return
    if (imageModelGroups.length === 0) {
      setImageCategoryId('')
      return
    }
    if (!imageCategoryId || !imageModelGroups.some((item) => item.value === imageCategoryId)) {
      setImageCategoryId(imageModelGroups[0].value)
    }
  }, [imageCategoryId, imageModelGroups, isImage])

  useEffect(() => {
    if (!fallbackModel) return
    if (!model || !modelOptions.some((item) => item.value === model)) {
      setModel(fallbackModel)
    }
  }, [fallbackModel, model, modelOptions])

  useEffect(() => {
    if (!isImage) return
    setSize((current) => firstOrCurrent(imageSizePresets, current, IMAGE_SIZE_PRESETS[0]))
    setRatio((current) =>
      firstOrCurrent(imageRatioPresets, current, IMAGE_RATIO_PRESETS[0])
    )
    setStyle((current) =>
      firstOrCurrent(
        imageStylePresets,
        current,
        IMAGE_STYLE_PRESETS[0]?.value || ''
      )
    )
    setQuality((current) =>
      firstOrCurrent(
        imageQualityPresets,
        current,
        IMAGE_QUALITY_PRESETS[0]?.value || ''
      )
    )
  }, [
    imageQualityPresets,
    imageRatioPresets,
    imageSizePresets,
    imageStylePresets,
    isImage,
    selectedImageModel?.id,
  ])

  useEffect(() => {
    if (!isImage) return
    if (!imageFeatureControls.negative_prompt) {
      setNegativePrompt('')
    }
    if (!imageFeatureControls.seed_control) {
      setSeedEnabled(false)
      setSeed('')
    }
    if (!imageFeatureControls.batch_control) {
      setCount(1)
      return
    }
    setCount((current) => Math.max(1, Math.min(imageMaxBatchSize, current)))
  }, [
    imageFeatureControls.batch_control,
    imageFeatureControls.negative_prompt,
    imageFeatureControls.seed_control,
    imageMaxBatchSize,
    isImage,
  ])

  useEffect(() => {
    if (isImage) return
    setSize((current) =>
      firstOrCurrent(videoResolutionPresets, current, VIDEO_RESOLUTION_PRESETS[0])
    )
    setRatio((current) =>
      firstOrCurrent(videoRatioPresets, current, VIDEO_RATIO_PRESETS[0])
    )
    setDuration((current) =>
      firstOrCurrent(videoDurationPresets, current, VIDEO_DURATION_PRESETS[0])
    )
    setFrameRate((current) =>
      firstOrCurrent(videoFrameRatePresets, current, VIDEO_FRAME_RATE_PRESETS[0])
    )
    setStyle((current) =>
      firstOrCurrent(videoStylePresets, current, IMAGE_STYLE_PRESETS[0]?.value || '')
    )
    setQuality((current) =>
      firstOrCurrent(
        videoQualityPresets,
        current,
        VIDEO_QUALITY_PRESETS[0]?.value || ''
      )
    )
  }, [
    isImage,
    selectedVideoModel?.id,
    videoDurationPresets,
    videoFrameRatePresets,
    videoQualityPresets,
    videoRatioPresets,
    videoResolutionPresets,
    videoStylePresets,
  ])

  useEffect(() => {
    if (isImage) {
      setFirstFrameImage(null)
      setLastFrameImage(null)
      if (!imageFeatureControls.reference_image_upload) {
        setReferenceImage(null)
      }
      return
    }
    if (!videoFeatureControls.reference_image_upload) {
      setReferenceImage(null)
    }
    if (!videoFeatureControls.first_frame_image) {
      setFirstFrameImage(null)
    }
    if (!videoFeatureControls.last_frame_image) {
      setLastFrameImage(null)
    }
  }, [
    imageFeatureControls.reference_image_upload,
    isImage,
    videoFeatureControls.first_frame_image,
    videoFeatureControls.last_frame_image,
    videoFeatureControls.reference_image_upload,
  ])

  useEffect(() => {
    if (isImage) return
    const pending = items.filter(
      (item) =>
        item.kind === 'video' &&
        item.taskId &&
        !item.videoUrl &&
        item.status !== 'failed' &&
        item.status !== 'ready'
    )
    if (pending.length === 0) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      for (const item of pending) {
        if (!item.taskId || cancelled) continue
        try {
          const response = await getWorkspaceVideoTask(item.taskId)
          const data = response.data
          const status = String(data?.status || '').toLowerCase()
          const videoUrl =
            data?.url ||
            data?.result_url ||
            (typeof data?.data === 'object' && data.data
              ? String(
                  (data.data as { url?: string; result_url?: string }).url ||
                    (data.data as { result_url?: string }).result_url ||
                    ''
                )
              : '')
          setItems((current) =>
            current.map((currentItem) => {
              if (currentItem.id !== item.id) return currentItem
              if (status === 'success' || status === 'succeeded' || videoUrl) {
                return {
                  ...currentItem,
                  status: 'ready',
                  videoUrl: videoUrl || currentItem.videoUrl,
                }
              }
              if (status === 'failure' || status === 'failed') {
                return { ...currentItem, status: 'failed' }
              }
              return {
                ...currentItem,
                status:
                  status === 'queued' || status === 'submitted'
                    ? 'queued'
                    : 'processing',
              }
            })
          )
        } catch {
          // Keep polling; transient fetch failures are common while tasks run.
        }
      }
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isImage, items])

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error(t('Prompt is required'))
      return
    }
    if (!effectiveModel) {
      toast.error(t('Model not found'))
      return
    }
    setIsGenerating(true)
    try {
      if (kind === 'image') {
        if (
          imageFeatureControls.batch_control &&
          count > imageMaxBatchSize
        ) {
          toast.error(
            t('Generation count cannot exceed {{count}}', {
              count: imageMaxBatchSize,
            })
          )
          return
        }
        const payload = {
          model: effectiveModel,
          prompt: prompt.trim(),
          negative_prompt:
            imageFeatureControls.negative_prompt && negativePrompt.trim()
              ? negativePrompt.trim()
              : undefined,
          image:
            imageFeatureControls.reference_image_upload && referenceImage
              ? referenceImage.dataUrl
              : undefined,
          n: imageFeatureControls.batch_control ? count : undefined,
          size: imageFeatureControls.size_control ? size : undefined,
          quality: imageFeatureControls.quality_control ? quality : undefined,
          style: imageFeatureControls.style_control ? style : undefined,
          seed:
            imageFeatureControls.seed_control && seedEnabled && seed.trim()
              ? seed.trim()
              : undefined,
          response_format: 'url' as const,
        }
        const response = await generateWorkspaceImage(payload)
        const resultData = Array.isArray(response.data) ? response.data : []
        if (resultData.length === 0) {
          toast.error(t('No generation results returned'))
          return
        }
        const modelLabel =
          modelOptions.find((item) => item.value === effectiveModel)?.label ||
          effectiveModel
        const nextItems = resultData.map((item, index) => ({
          id: `${kind}-${Date.now()}-${index}`,
          kind,
          prompt,
          revisedPrompt: item.revised_prompt,
          model: modelLabel,
          status: 'ready' as const,
          imageUrl: item.url,
          b64Json: item.b64_json,
          size,
          ratio,
          quality,
        }))
        setItems((current) => [...nextItems, ...current])
        await queryClient.invalidateQueries({
          queryKey: ['workspace-image-generation-history'],
        })
        toast.success(t('Image generated'))
        return
      }

      const durationNumber = Number.parseInt(duration, 10)
      const metadata: Record<string, unknown> = {
        source: 'workspace_video',
      }
      if (videoFeatureControls.ratio_control) metadata.ratio = ratio
      if (videoFeatureControls.frame_rate_control) metadata.frame_rate = frameRate
      if (videoFeatureControls.style_control) metadata.style = style
      if (videoFeatureControls.quality_control) metadata.quality = quality
      if (videoFeatureControls.negative_prompt && negativePrompt.trim()) {
        metadata.negative_prompt = negativePrompt.trim()
      }
      if (videoFeatureControls.audio_track) metadata.audio = audioEnabled
      if (videoFeatureControls.seed_control && seedEnabled && seed.trim()) {
        metadata.seed = seed.trim()
      }
      if (videoFeatureControls.reference_image_upload && referenceImage) {
        metadata.reference_image = referenceImage.dataUrl
        metadata.reference_images = [referenceImage.dataUrl]
      }
      if (videoFeatureControls.last_frame_image && lastFrameImage) {
        metadata.last_frame_image = lastFrameImage.dataUrl
      }
      const response = await generateWorkspaceVideo({
        model: effectiveModel,
        prompt: prompt.trim(),
        image:
          videoFeatureControls.first_frame_image && firstFrameImage
            ? firstFrameImage.dataUrl
            : videoFeatureControls.reference_image_upload && referenceImage
              ? referenceImage.dataUrl
              : undefined,
        size: videoFeatureControls.resolution_control ? size : undefined,
        duration:
          videoFeatureControls.duration_control && Number.isFinite(durationNumber)
            ? durationNumber
            : undefined,
        metadata,
      })
      const taskId =
        response.task_id ||
        response.id ||
        (typeof response.data === 'object' && response.data
          ? String(
              (response.data as { task_id?: string; id?: string }).task_id ||
                (response.data as { id?: string }).id ||
                ''
            )
          : '')
      if (!taskId) {
        toast.error(response.message || t('No generation results returned'))
        return
      }
      const modelLabel =
        modelOptions.find((item) => item.value === effectiveModel)?.label ||
        effectiveModel
      setItems((current) => [
        {
          id: `${kind}-${Date.now()}-0`,
          taskId,
          kind,
          prompt,
          model: modelLabel,
          status: 'queued' as const,
          size,
          ratio,
          quality,
          duration,
          frameRate,
        },
        ...current,
      ])
      toast.success(t('Video task submitted'))
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          kind === 'image' ? t('Image generation failed') : t('Video generation failed')
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Main className='h-full overflow-hidden'>
      <div className='flex h-[calc(100vh-5rem)] min-h-0 flex-col gap-4 lg:flex-row'>
        <div className='min-h-0 overflow-y-auto lg:w-[360px] xl:w-[400px]'>
          <Card className='rounded-lg'>
            <CardHeader>
              <CardTitle>
                {kind === 'image' ? t('Image generation') : t('Video generation')}
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {isImage && (
                <Field label={t('Model group')}>
                  <Select
                    value={imageCategoryId || '__empty__'}
                    onValueChange={(value) =>
                      value && value !== '__empty__' && setImageCategoryId(value)
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Model not found')} />
                    </SelectTrigger>
                    <SelectContent>
                      {imageModelGroups.length > 0 ? (
                        imageModelGroups.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
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
              )}

              <Field label={isImage ? t('Model channel') : t('Model')}>
                <Select
                  value={effectiveModel || '__empty__'}
                  onValueChange={(value) =>
                    value && value !== '__empty__' && setModel(value)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Model not found')} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.length > 0 ? (
                      modelOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <span className='flex flex-col'>
                            <span>{item.label}</span>
                            {item.category ? (
                              <span className='text-muted-foreground text-xs'>
                                {item.category}
                              </span>
                            ) : null}
                          </span>
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

              <Field label={t('Prompt')}>
                <Textarea
                  className='min-h-28 resize-none'
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    kind === 'image'
                      ? t('Describe the image you want to create')
                      : t('Describe the video you want to create')
                  }
                />
              </Field>

              {(isImage
                ? imageFeatureControls.negative_prompt
                : videoFeatureControls.negative_prompt) && (
                <Field label={t('Negative prompt')}>
                  <Textarea
                    className='min-h-16 resize-none'
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                    placeholder={t('Elements to avoid')}
                  />
                </Field>
              )}

              {kind === 'image' ? (
                <ImageControls
                  zhLanguage={zhLanguage}
                  size={size}
                  ratio={ratio}
                  style={style}
                  quality={quality}
                  count={count}
                  seedEnabled={seedEnabled}
                  seed={seed}
                  referenceImage={referenceImage}
                  onSizeChange={setSize}
                  onRatioChange={setRatio}
                  onStyleChange={setStyle}
                  onQualityChange={setQuality}
                  onCountChange={setCount}
                  onSeedEnabledChange={setSeedEnabled}
                  onSeedChange={setSeed}
                  onReferenceImageChange={setReferenceImage}
                  featureControls={imageFeatureControls}
                  sizePresets={imageSizePresets}
                  ratioPresets={imageRatioPresets}
                  stylePresets={imageStylePresets}
                  qualityPresets={imageQualityPresets}
                  maxBatchSize={imageMaxBatchSize}
                />
              ) : (
                <VideoControls
                  zhLanguage={zhLanguage}
                  size={size}
                  ratio={ratio}
                  style={style}
                  duration={duration}
                  frameRate={frameRate}
                  quality={quality}
                  seedEnabled={seedEnabled}
                  seed={seed}
                  audioEnabled={audioEnabled}
                  referenceImage={referenceImage}
                  firstFrameImage={firstFrameImage}
                  lastFrameImage={lastFrameImage}
                  featureControls={videoFeatureControls}
                  resolutionPresets={videoResolutionPresets}
                  ratioPresets={videoRatioPresets}
                  durationPresets={videoDurationPresets}
                  frameRatePresets={videoFrameRatePresets}
                  stylePresets={videoStylePresets}
                  qualityPresets={videoQualityPresets}
                  onSizeChange={setSize}
                  onRatioChange={setRatio}
                  onStyleChange={setStyle}
                  onDurationChange={setDuration}
                  onFrameRateChange={setFrameRate}
                  onQualityChange={setQuality}
                  onSeedEnabledChange={setSeedEnabled}
                  onSeedChange={setSeed}
                  onAudioEnabledChange={setAudioEnabled}
                  onReferenceImageChange={setReferenceImage}
                  onFirstFrameImageChange={setFirstFrameImage}
                  onLastFrameImageChange={setLastFrameImage}
                />
              )}

              <Button
                className='w-full'
                disabled={isGenerating || !effectiveModel}
                onClick={generate}
              >
                {isGenerating ? (
                  <Loader2 className='animate-spin' />
                ) : kind === 'image' ? (
                  <ImagePlus />
                ) : (
                  <Video />
                )}
                {kind === 'image' ? t('Generate image') : t('Generate video')}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          <GenerationResults
            kind={kind}
            items={items}
            isGenerating={isGenerating}
            onDelete={(id) =>
              setItems((current) => current.filter((item) => item.id !== id))
            }
            onRegenerate={(item) => {
              setPrompt(item.prompt)
              toast.info(t('Parameters restored for regeneration'))
            }}
          />
        </div>
        {isImage && (
          <div className='min-h-0 overflow-y-auto lg:w-[320px] xl:w-[360px]'>
            <ImageGenerationHistory
              records={imageHistoryQuery.data || []}
              loading={imageHistoryQuery.isLoading}
              onRestore={(record) => {
                const detail = parseDetail(record.detail)
                if (detail.prompt || detail.input_text) {
                  setPrompt(detail.prompt || detail.input_text || '')
                }
                if (detail.negative_prompt) {
                  setNegativePrompt(detail.negative_prompt)
                }
                if (record.model) {
                  const matched = imageModels.find(
                    (item) =>
                      item.model === record.model ||
                      item.model_alias === record.model ||
                      item.display_name === record.model
                  )
                  if (matched) {
                    setImageCategoryId(
                      String(
                        matched.category_id || matched.category_name || 'default'
                      )
                    )
                    setModel(matched.model)
                  }
                }
                toast.info(t('Parameters restored for regeneration'))
              }}
            />
          </div>
        )}
      </div>
    </Main>
  )
}

function ImageControls(props: {
  zhLanguage: boolean
  featureControls: WorkspaceImageFeatureControlsDto
  sizePresets: string[]
  ratioPresets: string[]
  stylePresets: GenerationMappedPreset[]
  qualityPresets: GenerationMappedPreset[]
  size: string
  ratio: string
  style: string
  quality: string
  count: number
  maxBatchSize: number
  seedEnabled: boolean
  seed: string
  referenceImage: UploadedImage | null
  onSizeChange: (value: string) => void
  onRatioChange: (value: string) => void
  onStyleChange: (value: string) => void
  onQualityChange: (value: string) => void
  onCountChange: (value: number) => void
  onSeedEnabledChange: (value: boolean) => void
  onSeedChange: (value: string) => void
  onReferenceImageChange: (value: UploadedImage | null) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {props.featureControls.reference_image_upload && (
        <UploadField
          label={t('Reference image')}
          value={props.referenceImage}
          onChange={props.onReferenceImageChange}
        />
      )}
      {(props.featureControls.size_control ||
        props.featureControls.ratio_control ||
        props.featureControls.style_control ||
        props.featureControls.quality_control) && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
          {props.featureControls.size_control && (
            <PresetSelect
              label={t('Size presets')}
              value={props.size}
              values={props.sizePresets}
              onChange={props.onSizeChange}
            />
          )}
          {props.featureControls.ratio_control && (
            <PresetSelect
              label={t('Ratio presets')}
              value={props.ratio}
              values={props.ratioPresets}
              onChange={props.onRatioChange}
            />
          )}
          {props.featureControls.style_control && (
            <MappedPresetSelect
              label={t('Style presets')}
              value={props.style}
              values={props.stylePresets}
              zhLanguage={props.zhLanguage}
              onChange={props.onStyleChange}
            />
          )}
          {props.featureControls.quality_control && (
            <MappedPresetSelect
              label={t('Quality presets')}
              value={props.quality}
              values={props.qualityPresets}
              zhLanguage={props.zhLanguage}
              onChange={props.onQualityChange}
            />
          )}
        </div>
      )}
      {props.featureControls.batch_control && (
        <Field label={t('Generation count')}>
          <Input
            type='number'
            min={1}
            max={props.maxBatchSize}
            value={props.count}
            onChange={(event) =>
              props.onCountChange(
                Math.max(
                  1,
                  Math.min(props.maxBatchSize, Number(event.target.value))
                )
              )
            }
          />
        </Field>
      )}
      {props.featureControls.seed_control && <SeedField {...props} />}
    </>
  )
}

function ImageGenerationHistory(props: {
  records: TaskCenterRecord[]
  loading: boolean
  onRestore: (record: TaskCenterRecord) => void
}) {
  const { t } = useTranslation()
  return (
    <Card className='rounded-lg'>
      <CardHeader>
        <CardTitle className='text-base'>{t('Generation history')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {props.loading ? (
          <div className='text-muted-foreground flex h-32 items-center justify-center gap-2 text-sm'>
            <Loader2 className='size-4 animate-spin' />
            {t('Loading...')}
          </div>
        ) : props.records.length === 0 ? (
          <div className='text-muted-foreground flex h-32 items-center justify-center text-center text-sm'>
            {t('No image generation history')}
          </div>
        ) : (
          props.records.map((record) => (
            <ImageHistoryCard
              key={record.id}
              record={record}
              onRestore={() => props.onRestore(record)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ImageHistoryCard(props: {
  record: TaskCenterRecord
  onRestore: () => void
}) {
  const { t } = useTranslation()
  const detail = parseDetail(props.record.detail)
  const imageUrl = detail.images?.[0] || ''
  const prompt = detail.prompt || detail.input_text || ''
  return (
    <div className='border-border overflow-hidden rounded-lg border'>
      <div className='bg-muted/30 flex aspect-video items-center justify-center overflow-hidden'>
        {imageUrl ? (
          <img src={imageUrl} alt={prompt} className='size-full object-cover' />
        ) : (
          <ImagePlus className='text-muted-foreground size-8' />
        )}
      </div>
      <div className='space-y-2 p-3'>
        <div className='line-clamp-2 text-sm font-medium'>{prompt || '-'}</div>
        <div className='text-muted-foreground space-y-1 text-xs'>
          <div>{props.record.model || '-'}</div>
          <div>
            {t('Status')}: {generationStatusLabel(t, props.record.status)}
          </div>
          <div>{formatUnixTime(props.record.submitted_at)}</div>
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='flex-1'
            onClick={props.onRestore}
          >
            <RefreshCw className='size-4' />
            {t('Regenerate')}
          </Button>
          {prompt && (
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              onClick={() => {
                navigator.clipboard?.writeText(prompt)
                toast.success(t('Prompt copied'))
              }}
            >
              <Copy className='size-4' />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function VideoControls(props: {
  zhLanguage: boolean
  featureControls: WorkspaceVideoFeatureControlsDto
  resolutionPresets: string[]
  ratioPresets: string[]
  durationPresets: string[]
  frameRatePresets: string[]
  stylePresets: GenerationMappedPreset[]
  qualityPresets: GenerationMappedPreset[]
  size: string
  ratio: string
  style: string
  duration: string
  frameRate: string
  quality: string
  seedEnabled: boolean
  seed: string
  audioEnabled: boolean
  referenceImage: UploadedImage | null
  firstFrameImage: UploadedImage | null
  lastFrameImage: UploadedImage | null
  onSizeChange: (value: string) => void
  onRatioChange: (value: string) => void
  onStyleChange: (value: string) => void
  onDurationChange: (value: string) => void
  onFrameRateChange: (value: string) => void
  onQualityChange: (value: string) => void
  onSeedEnabledChange: (value: boolean) => void
  onSeedChange: (value: string) => void
  onAudioEnabledChange: (value: boolean) => void
  onReferenceImageChange: (value: UploadedImage | null) => void
  onFirstFrameImageChange: (value: UploadedImage | null) => void
  onLastFrameImageChange: (value: UploadedImage | null) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {(props.featureControls.first_frame_image ||
        props.featureControls.last_frame_image ||
        props.featureControls.reference_image_upload) && (
        <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3'>
          {props.featureControls.first_frame_image && (
            <UploadField
              label={t('First frame image')}
              value={props.firstFrameImage}
              onChange={props.onFirstFrameImageChange}
              compact
            />
          )}
          {props.featureControls.last_frame_image && (
            <UploadField
              label={t('Last frame image')}
              value={props.lastFrameImage}
              onChange={props.onLastFrameImageChange}
              compact
            />
          )}
          {props.featureControls.reference_image_upload && (
            <UploadField
              label={t('Reference image')}
              value={props.referenceImage}
              onChange={props.onReferenceImageChange}
              compact
            />
          )}
        </div>
      )}
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
        {props.featureControls.resolution_control && (
          <PresetSelect
            label={t('Resolution presets')}
            value={props.size}
            values={props.resolutionPresets}
            onChange={props.onSizeChange}
          />
        )}
        {props.featureControls.ratio_control && (
          <PresetSelect
            label={t('Ratio presets')}
            value={props.ratio}
            values={props.ratioPresets}
            onChange={props.onRatioChange}
          />
        )}
        {props.featureControls.duration_control && (
          <PresetSelect
            label={t('Duration presets')}
            value={props.duration}
            values={props.durationPresets}
            onChange={props.onDurationChange}
          />
        )}
        {props.featureControls.frame_rate_control && (
          <PresetSelect
            label={t('Frame rate presets')}
            value={props.frameRate}
            values={props.frameRatePresets}
            onChange={props.onFrameRateChange}
          />
        )}
        {props.featureControls.style_control && (
          <MappedPresetSelect
            label={t('Style presets')}
            value={props.style}
            values={props.stylePresets}
            zhLanguage={props.zhLanguage}
            onChange={props.onStyleChange}
          />
        )}
        {props.featureControls.quality_control && (
          <MappedPresetSelect
            label={t('Quality presets')}
            value={props.quality}
            values={props.qualityPresets}
            zhLanguage={props.zhLanguage}
            onChange={props.onQualityChange}
          />
        )}
      </div>
      {props.featureControls.audio_track && (
        <ToggleRow
          label={t('Audio track')}
          checked={props.audioEnabled}
          onCheckedChange={props.onAudioEnabledChange}
        />
      )}
      {props.featureControls.camera_control && (
        <Field label={t('Camera movement')}>
          <Input placeholder={t('Static, push in, pan left...')} />
        </Field>
      )}
      {props.featureControls.seed_control && <SeedField {...props} />}
    </>
  )
}

function GenerationResults(props: {
  kind: GenerationKind
  items: GeneratedItem[]
  isGenerating: boolean
  onDelete: (id: string) => void
  onRegenerate: (item: GeneratedItem) => void
}) {
  const { t } = useTranslation()
  const empty = props.items.length === 0 && !props.isGenerating

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>
            {props.kind === 'image' ? t('Generated images') : t('Generated videos')}
          </h2>
        </div>
      </div>

      {empty ? (
        <div className='border-border bg-muted/20 flex min-h-96 items-center justify-center rounded-lg border'>
          <div className='text-muted-foreground text-center text-sm'>
            <Sparkles className='mx-auto mb-3 size-8' />
            {t('No generation results yet')}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            props.kind === 'image'
              ? 'sm:grid-cols-2 xl:grid-cols-3'
              : 'xl:grid-cols-2'
          )}
        >
          {props.isGenerating && <GeneratingCard kind={props.kind} />}
          {props.items.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              onDelete={() => props.onDelete(item.id)}
              onRegenerate={() => props.onRegenerate(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GeneratingCard({ kind }: { kind: GenerationKind }) {
  const { t } = useTranslation()
  return (
    <Card className='rounded-lg'>
      <div
        className={cn(
          'bg-muted/40 flex items-center justify-center',
          kind === 'image' ? 'aspect-square' : 'aspect-video'
        )}
      >
        <Loader2 className='text-muted-foreground size-8 animate-spin' />
      </div>
      <CardContent className='text-muted-foreground text-sm'>
        {t('Generating...')}
      </CardContent>
    </Card>
  )
}

function ResultCard(props: {
  item: GeneratedItem
  onDelete: () => void
  onRegenerate: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className='rounded-lg'>
      <div
        className={cn(
          'bg-muted/30 flex items-center justify-center overflow-hidden',
          props.item.kind === 'image' ? 'aspect-square' : 'aspect-video'
        )}
      >
        {props.item.kind === 'image' && normalizeImageSource(props.item) ? (
          <img
            src={normalizeImageSource(props.item)}
            alt={props.item.revisedPrompt || props.item.prompt}
            className='size-full object-cover'
          />
        ) : props.item.kind === 'video' && props.item.videoUrl ? (
          <video
            src={props.item.videoUrl}
            controls
            className='size-full object-cover'
          />
        ) : props.item.kind === 'image' ? (
          <ImagePlus className='text-muted-foreground size-10' />
        ) : (
          <Video className='text-muted-foreground size-10' />
        )}
      </div>
      <CardContent className='space-y-3'>
        <div className='space-y-1'>
          <div className='line-clamp-2 text-sm font-medium'>
            {props.item.revisedPrompt || props.item.prompt}
          </div>
          <div className='text-muted-foreground text-xs'>
            {props.item.model} / {props.item.size} / {props.item.ratio}
            {props.item.kind === 'video'
              ? ` / ${props.item.duration} / ${props.item.frameRate}`
              : ''}
          </div>
          {props.item.taskId && (
            <div className='text-muted-foreground text-xs'>
              {t('Task ID')}: {props.item.taskId} / {t('Status')}:{' '}
              {generationStatusLabel(t, props.item.status)}
            </div>
          )}
        </div>
        <Separator />
        <div className='flex flex-wrap gap-1.5'>
          <Button
            size='sm'
            variant='outline'
            onClick={async () => {
              try {
                const ok = await downloadGeneratedImage(props.item)
                if (!ok) {
                  toast.error(t('No downloadable image found'))
                }
              } catch (error) {
                toast.error(getErrorMessage(error, t('Download failed')))
              }
            }}
          >
            <Download />
            {t('Download')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              navigator.clipboard?.writeText(props.item.prompt)
              toast.success(t('Prompt copied'))
            }}
          >
            <Copy />
            {t('Copy prompt')}
          </Button>
          <Button size='icon-sm' variant='ghost' onClick={props.onRegenerate}>
            <RefreshCw />
          </Button>
          <Button size='icon-sm' variant='ghost' onClick={props.onDelete}>
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PresetSelect(props: {
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={props.label}>
      <Select
        value={props.value}
        onValueChange={(value) => value && props.onChange(value)}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function MappedPresetSelect(props: {
  label: string
  value: string
  values: GenerationMappedPreset[]
  zhLanguage: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Field label={props.label}>
      <Select
        value={props.value}
        onValueChange={(value) => value && props.onChange(value)}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.values.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {presetLabel(item, props.zhLanguage, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function UploadField(props: {
  label: string
  compact?: boolean
  value: UploadedImage | null
  onChange: (value: UploadedImage | null) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isReading, setIsReading] = useState(false)
  const fileName = props.value?.name || ''
  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          setIsReading(true)
          try {
            props.onChange(await readImageFileAsDataUrl(file))
          } catch (error) {
            toast.error(getErrorMessage(error, t('Upload failed')))
          } finally {
            setIsReading(false)
          }
        }}
      />
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          className={cn('min-w-0 flex-1 justify-start', props.compact && 'px-2 text-xs')}
          disabled={isReading}
          onClick={() => inputRef.current?.click()}
        >
          {isReading ? <Loader2 className='animate-spin' /> : <Upload />}
          <span className='truncate'>
            {fileName || (isReading ? t('Uploading...') : t('Upload image'))}
          </span>
        </Button>
        {props.value && (
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={() => props.onChange(null)}
            aria-label={t('Remove')}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  )
}

function ToggleRow(props: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className='flex items-center justify-between rounded-lg border px-3 py-2'>
      <span className='text-sm'>{props.label}</span>
      <Switch
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    </label>
  )
}

function SeedField(props: {
  seedEnabled: boolean
  seed: string
  onSeedEnabledChange: (value: boolean) => void
  onSeedChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-2'>
      <ToggleRow
        label={t('Seed control')}
        checked={props.seedEnabled}
        onCheckedChange={props.onSeedEnabledChange}
      />
      {props.seedEnabled && (
        <Input
          value={props.seed}
          onChange={(event) => props.onSeedChange(event.target.value)}
          placeholder={t('Random seed')}
        />
      )}
    </div>
  )
}

function Field(props: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      {props.children}
    </div>
  )
}
