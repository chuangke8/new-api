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
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { getWorkspaceChatAvailableModels } from '@/features/system-settings/workspace/api'
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

type GenerationKind = 'image' | 'video'

type GeneratedItem = {
  id: string
  kind: GenerationKind
  prompt: string
  model: string
  status: 'ready' | 'generating'
  size?: string
  ratio?: string
  quality?: string
  duration?: string
  frameRate?: string
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
  preset: string | WorkspaceMappedPreset,
  zhLanguage: boolean,
  t: (key: string) => string
) {
  if (typeof preset === 'string') return preset
  if (zhLanguage && preset.zh) return preset.zh
  return t(localizedPresetLabels[preset.value] || preset.value)
}

function useAvailableModels() {
  return useQuery({
    queryKey: ['workspace-generation-models'],
    queryFn: async () => (await getWorkspaceChatAvailableModels()).data || [],
    staleTime: 60_000,
  })
}

export function WorkspaceImageGeneration() {
  return <WorkspaceGeneration kind='image' />
}

export function WorkspaceVideoGeneration() {
  return <WorkspaceGeneration kind='video' />
}

function WorkspaceGeneration({ kind }: { kind: GenerationKind }) {
  const { t, i18n } = useTranslation()
  const zhLanguage = isZhLanguage(i18n.language)
  const { data: modelsData } = useAvailableModels()
  const models = useMemo(
    () => Array.from(new Set((modelsData || []).filter(Boolean))),
    [modelsData]
  )
  const fallbackModel = models[0] || ''
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
  const [seedEnabled, setSeedEnabled] = useState(false)
  const [seed, setSeed] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [items, setItems] = useState<GeneratedItem[]>([])
  const effectiveModel = model || fallbackModel

  const generate = () => {
    if (!prompt.trim()) {
      toast.error(t('Prompt is required'))
      return
    }
    setIsGenerating(true)
    window.setTimeout(() => {
      const nextCount = kind === 'image' ? count : 1
      const nextItems = Array.from({ length: nextCount }, (_, index) => ({
        id: `${kind}-${Date.now()}-${index}`,
        kind,
        prompt,
        model: effectiveModel || t('Model not found'),
        status: 'ready' as const,
        size,
        ratio,
        quality,
        duration,
        frameRate,
      }))
      setItems((current) => [...nextItems, ...current])
      setIsGenerating(false)
      toast.success(kind === 'image' ? t('Image generated') : t('Video generated'))
    }, 900)
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
              <Field label={t('Model')}>
                <Select
                  value={effectiveModel}
                  onValueChange={(value) => value && setModel(value)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Model not found')} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length > 0 ? (
                      models.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
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

              <Field label={t('Negative prompt')}>
                <Textarea
                  className='min-h-16 resize-none'
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  placeholder={t('Elements to avoid')}
                />
              </Field>

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
                  onSizeChange={setSize}
                  onRatioChange={setRatio}
                  onStyleChange={setStyle}
                  onQualityChange={setQuality}
                  onCountChange={setCount}
                  onSeedEnabledChange={setSeedEnabled}
                  onSeedChange={setSeed}
                />
              ) : (
                <VideoControls
                  zhLanguage={zhLanguage}
                  size={size}
                  ratio={ratio}
                  duration={duration}
                  frameRate={frameRate}
                  quality={quality}
                  seedEnabled={seedEnabled}
                  seed={seed}
                  audioEnabled={audioEnabled}
                  onSizeChange={setSize}
                  onRatioChange={setRatio}
                  onDurationChange={setDuration}
                  onFrameRateChange={setFrameRate}
                  onQualityChange={setQuality}
                  onSeedEnabledChange={setSeedEnabled}
                  onSeedChange={setSeed}
                  onAudioEnabledChange={setAudioEnabled}
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
      </div>
    </Main>
  )
}

function ImageControls(props: {
  zhLanguage: boolean
  size: string
  ratio: string
  style: string
  quality: string
  count: number
  seedEnabled: boolean
  seed: string
  onSizeChange: (value: string) => void
  onRatioChange: (value: string) => void
  onStyleChange: (value: string) => void
  onQualityChange: (value: string) => void
  onCountChange: (value: number) => void
  onSeedEnabledChange: (value: boolean) => void
  onSeedChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <UploadField label={t('Reference image')} />
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
        <PresetSelect
          label={t('Size presets')}
          value={props.size}
          values={IMAGE_SIZE_PRESETS}
          onChange={props.onSizeChange}
        />
        <PresetSelect
          label={t('Ratio presets')}
          value={props.ratio}
          values={IMAGE_RATIO_PRESETS}
          onChange={props.onRatioChange}
        />
        <MappedPresetSelect
          label={t('Style presets')}
          value={props.style}
          values={IMAGE_STYLE_PRESETS}
          zhLanguage={props.zhLanguage}
          onChange={props.onStyleChange}
        />
        <MappedPresetSelect
          label={t('Quality presets')}
          value={props.quality}
          values={IMAGE_QUALITY_PRESETS}
          zhLanguage={props.zhLanguage}
          onChange={props.onQualityChange}
        />
      </div>
      <Field label={t('Generation count')}>
        <Input
          type='number'
          min={1}
          max={4}
          value={props.count}
          onChange={(event) =>
            props.onCountChange(Math.max(1, Math.min(4, Number(event.target.value))))
          }
        />
      </Field>
      <SeedField {...props} />
    </>
  )
}

function VideoControls(props: {
  zhLanguage: boolean
  size: string
  ratio: string
  duration: string
  frameRate: string
  quality: string
  seedEnabled: boolean
  seed: string
  audioEnabled: boolean
  onSizeChange: (value: string) => void
  onRatioChange: (value: string) => void
  onDurationChange: (value: string) => void
  onFrameRateChange: (value: string) => void
  onQualityChange: (value: string) => void
  onSeedEnabledChange: (value: boolean) => void
  onSeedChange: (value: string) => void
  onAudioEnabledChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3'>
        <UploadField label={t('First frame image')} compact />
        <UploadField label={t('Last frame image')} compact />
        <UploadField label={t('Reference image')} compact />
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
        <PresetSelect
          label={t('Resolution presets')}
          value={props.size}
          values={VIDEO_RESOLUTION_PRESETS}
          onChange={props.onSizeChange}
        />
        <PresetSelect
          label={t('Ratio presets')}
          value={props.ratio}
          values={VIDEO_RATIO_PRESETS}
          onChange={props.onRatioChange}
        />
        <PresetSelect
          label={t('Duration presets')}
          value={props.duration}
          values={VIDEO_DURATION_PRESETS}
          onChange={props.onDurationChange}
        />
        <PresetSelect
          label={t('Frame rate presets')}
          value={props.frameRate}
          values={VIDEO_FRAME_RATE_PRESETS}
          onChange={props.onFrameRateChange}
        />
        <MappedPresetSelect
          label={t('Quality presets')}
          value={props.quality}
          values={VIDEO_QUALITY_PRESETS}
          zhLanguage={props.zhLanguage}
          onChange={props.onQualityChange}
        />
      </div>
      <ToggleRow
        label={t('Audio track')}
        checked={props.audioEnabled}
        onCheckedChange={props.onAudioEnabledChange}
      />
      <Field label={t('Camera movement')}>
        <Input placeholder={t('Static, push in, pan left...')} />
      </Field>
      <SeedField {...props} />
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
          <p className='text-muted-foreground text-sm'>
            {t('Mock results are kept in this browser session.')}
          </p>
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
          'from-muted to-muted/40 flex items-center justify-center bg-linear-to-br',
          props.item.kind === 'image' ? 'aspect-square' : 'aspect-video'
        )}
      >
        {props.item.kind === 'image' ? (
          <ImagePlus className='text-muted-foreground size-10' />
        ) : (
          <Video className='text-muted-foreground size-10' />
        )}
      </div>
      <CardContent className='space-y-3'>
        <div className='space-y-1'>
          <div className='line-clamp-2 text-sm font-medium'>
            {props.item.prompt}
          </div>
          <div className='text-muted-foreground text-xs'>
            {props.item.model} / {props.item.size} / {props.item.ratio}
            {props.item.kind === 'video'
              ? ` / ${props.item.duration} / ${props.item.frameRate}`
              : ''}
          </div>
        </div>
        <Separator />
        <div className='flex flex-wrap gap-1.5'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => toast.info(t('Download will be connected later'))}
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
  values: WorkspaceMappedPreset[]
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

function UploadField(props: { label: string; compact?: boolean }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState('')
  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={(event) =>
          setFileName(event.currentTarget.files?.[0]?.name || '')
        }
      />
      <Button
        type='button'
        variant='outline'
        className={cn('w-full justify-start', props.compact && 'px-2 text-xs')}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        <span className='truncate'>{fileName || t('Upload image')}</span>
      </Button>
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
