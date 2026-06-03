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
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Columns3,
  Eye,
  FileAudio,
  FileText,
  ImageIcon,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import { useIsAdmin } from '@/hooks/use-admin'
import { formatQuota } from '@/lib/format'
import { cn, getPageNumbers } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getTaskCenterDetail,
  listTaskCenter,
  updateTaskCenterRemark,
} from './api'
import type { TaskCenterRecord } from './types'
import {
  formatUnixTime,
  getTaskCenterTagLabel,
  normalizeTaskCenterTagFilter,
  parseDetail,
  parseTags,
  prettyJson,
  taskStatusVariant,
} from './utils'

const PAGE_SIZE = 20
const ALL_VALUE = 'all'
const COLUMN_STORAGE_KEY = 'task-center-visible-columns'

type Filters = {
  keyword: string
  task_type: string
  status: string
  model: string
  user: string
  tag: string
  submit_source: string
  submitted_start: string
  submitted_end: string
}

const defaultFilters: Filters = {
  keyword: '',
  task_type: ALL_VALUE,
  status: ALL_VALUE,
  model: '',
  user: '',
  tag: '',
  submit_source: ALL_VALUE,
  submitted_start: '',
  submitted_end: '',
}

const statusOptions = ['pending', 'running', 'succeeded', 'failed', 'cancelled']
const typeOptions = ['image', 'video', 'audio', 'other']
const sourceOptions = ['workspace', 'api', 'system']

type ColumnId =
  | 'task_id'
  | 'submitted_at'
  | 'completed_at'
  | 'user'
  | 'model'
  | 'source'
  | 'status'
  | 'cost'
  | 'remark'
  | 'actions'

type ColumnOption = {
  id: ColumnId
  label: string
  required?: boolean
}

const baseColumnOptions: ColumnOption[] = [
  { id: 'task_id', label: 'Task ID', required: true },
  { id: 'submitted_at', label: 'Submitted Time' },
  { id: 'completed_at', label: 'Completed Time' },
  { id: 'model', label: 'Model' },
  { id: 'source', label: 'Source' },
  { id: 'status', label: 'Status' },
  { id: 'cost', label: 'Cost' },
  { id: 'remark', label: 'Remark' },
  { id: 'actions', label: 'View Details', required: true },
]

const adminColumnOption: ColumnOption = { id: 'user', label: 'User' }

function loadVisibleColumns(): Partial<Record<ColumnId, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLUMN_STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function taskTypeIcon(taskType: string) {
  if (taskType === 'image') return ImageIcon
  if (taskType === 'video') return Video
  if (taskType === 'audio') return FileAudio
  return FileText
}

function translatedStatus(t: (key: string) => string, status: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return t(map[status] ?? status)
}

function translatedType(t: (key: string) => string, type: string) {
  const map: Record<string, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    other: 'Other',
  }
  return t(map[type] ?? type)
}

function translatedSource(t: (key: string) => string, source: string) {
  const map: Record<string, string> = {
    workspace: 'Workspace',
    api: 'API',
    system: 'System',
  }
  return t(map[source] ?? source)
}

function dateTimeLocalToUnix(value: string) {
  if (!value) return undefined
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return undefined
  return Math.floor(timestamp / 1000)
}

function selectedTypeLabel(t: (key: string) => string, value: string) {
  return value === ALL_VALUE ? t('All Types') : translatedType(t, value)
}

function selectedStatusLabel(t: (key: string) => string, value: string) {
  return value === ALL_VALUE ? t('All Statuses') : translatedStatus(t, value)
}

function selectedSourceLabel(t: (key: string) => string, value: string) {
  return value === ALL_VALUE ? t('All Sources') : translatedSource(t, value)
}

function DetailBlock({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  if (!children) return null
  return (
    <section className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function MediaPreview({
  url,
  type,
  expired,
}: {
  url: string
  type: 'image' | 'video' | 'file'
  expired?: boolean
}) {
  const { t } = useTranslation()
  if (expired) {
    return (
      <div className='border-border bg-muted/30 flex aspect-video items-center justify-center rounded-lg border'>
        <div className='text-muted-foreground text-center text-sm'>
          {t('Resource expired')}
        </div>
      </div>
    )
  }
  if (type === 'file') {
    return (
      <div className='border-border bg-muted/30 overflow-hidden rounded-lg border'>
        <div className='text-muted-foreground flex min-h-24 items-center justify-center break-all p-3 text-sm'>
          {url}
        </div>
        <div className='border-border bg-background/80 flex justify-end border-t px-3 py-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className='size-4' />
            {t('Fullscreen Preview')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='border-border bg-muted/30 overflow-hidden rounded-lg border'>
      {type === 'image' ? (
        <img src={url} alt='' className='aspect-video w-full object-cover' />
      ) : (
        <video src={url} controls className='aspect-video w-full' />
      )}
      <div className='border-border bg-background/80 flex justify-end border-t px-3 py-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className='size-4' />
          {t('Fullscreen Preview')}
        </Button>
      </div>
    </div>
  )
}

function isImageUrl(url: string) {
  const cleanUrl = url.split('?')[0]?.toLowerCase() ?? ''
  return (
    cleanUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|bmp|avif)$/.test(cleanUrl)
  )
}

function UrlGrid({
  urls,
  expiredUrls,
  type,
}: {
  urls?: string[]
  expiredUrls?: string[]
  type: 'image' | 'video' | 'file'
}) {
  const cleanUrls = Array.from(new Set((urls ?? []).filter(Boolean))).filter(
    (url) => type !== 'video' || !isImageUrl(url)
  )
  if (cleanUrls.length === 0) return null
  const expiredSet = new Set(expiredUrls ?? [])
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {cleanUrls.map((url) => (
        <MediaPreview
          key={url}
          url={url}
          type={type}
          expired={expiredSet.has(url)}
        />
      ))}
    </div>
  )
}

function RemarkEditor({
  record,
  onSave,
  saving,
}: {
  record: TaskCenterRecord
  onSave: (record: TaskCenterRecord, remark: string) => void
  saving: boolean
}) {
  const [value, setValue] = useState(record.remark ?? '')

  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (value !== (record.remark ?? '')) onSave(record, value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
      disabled={saving}
      className='min-w-40'
      placeholder='-'
    />
  )
}

function TaskDetailSheet({
  record,
  open,
  onOpenChange,
}: {
  record: TaskCenterRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const detailQuery = useQuery({
    queryKey: ['task-center-detail', record?.id],
    queryFn: async () => {
      const res = await getTaskCenterDetail(record!.id)
      if (!res.success) throw new Error(res.message)
      return res.data
    },
    enabled: open && Boolean(record?.id),
  })

  const detailRecord = detailQuery.data ?? record
  const detail = parseDetail(detailRecord?.detail)
  const promptText = detail.prompt || detail.input_text || ''
  const metadata = detail.metadata
    ? JSON.stringify(detail.metadata, null, 2)
    : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full sm:max-w-3xl'>
        <SheetHeader className='border-b pr-12'>
          <SheetTitle>{t('Task Details')}</SheetTitle>
          <SheetDescription className='break-all font-mono text-xs'>
            {detailRecord?.task_id ?? '-'}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
          {detailQuery.isLoading ? (
            <div className='text-muted-foreground flex h-40 items-center justify-center gap-2'>
              <Loader2 className='size-4 animate-spin' />
              {t('Loading...')}
            </div>
          ) : (
            <>
              <div className='grid gap-3 sm:grid-cols-2'>
                <InfoItem label={t('Status')} value={detailRecord?.status} />
                <InfoItem label={t('Model')} value={detailRecord?.model} />
                <InfoItem
                  label={t('Submitted Time')}
                  value={formatUnixTime(detailRecord?.submitted_at)}
                />
                <InfoItem
                  label={t('Completed Time')}
                  value={formatUnixTime(detailRecord?.completed_at)}
                />
                <InfoItem
                  label={t('Source')}
                  value={translatedSource(t, detailRecord?.submit_source ?? '')}
                />
                <InfoItem
                  label={t('Cost')}
                  value={formatQuota(detailRecord?.cost ?? 0)}
                />
                <InfoItem label={t('Remark')} value={detailRecord?.remark || '-'} />
              </div>

              <DetailBlock
                title={t('Prompt')}
                action={
                  promptText ? (
                    <CopyButton
                      value={promptText}
                      size='icon'
                      className='size-7'
                      tooltip={t('Copy prompt')}
                      successTooltip={t('Prompt copied')}
                    />
                  ) : null
                }
              >
                <pre className='bg-muted/50 whitespace-pre-wrap rounded-lg p-3 text-sm'>
                  {promptText || '-'}
                </pre>
              </DetailBlock>
              {detail.negative_prompt && (
                <DetailBlock title={t('Negative Prompt')}>
                  <pre className='bg-muted/50 whitespace-pre-wrap rounded-lg p-3 text-sm'>
                    {detail.negative_prompt}
                  </pre>
                </DetailBlock>
              )}
              <DetailBlock title={t('Generated Content')}>
                <div className='space-y-3'>
                  <UrlGrid
                    urls={detail.images}
                    expiredUrls={detail.expired_images}
                    type='image'
                  />
                  <UrlGrid
                    urls={detail.videos}
                    expiredUrls={detail.expired_videos}
                    type='video'
                  />
                  <UrlGrid
                    urls={[...(detail.audios ?? []), ...(detail.files ?? [])]}
                    expiredUrls={detail.expired_files}
                    type='file'
                  />
                </div>
              </DetailBlock>
              <DetailBlock title={t('Reference Images')}>
                <UrlGrid
                  urls={detail.reference_images}
                  expiredUrls={detail.expired_reference_images}
                  type='image'
                />
              </DetailBlock>
              {detailRecord?.error_message && (
                <DetailBlock title={t('Error Message')}>
                  <pre className='bg-destructive/10 text-destructive whitespace-pre-wrap rounded-lg p-3 text-sm'>
                    {detailRecord.error_message}
                  </pre>
                </DetailBlock>
              )}
              {isAdmin && metadata && (
                <DetailBlock title={t('Metadata')}>
                  <pre className='bg-muted/50 max-h-72 overflow-auto rounded-lg p-3 text-xs'>
                    {metadata}
                  </pre>
                </DetailBlock>
              )}
              {isAdmin && (
                <>
                  <DetailBlock title={t('Raw Request')}>
                    <pre className='bg-muted/50 max-h-72 overflow-auto rounded-lg p-3 text-xs'>
                      {prettyJson(detailRecord?.raw_request) || '-'}
                    </pre>
                  </DetailBlock>
                  <DetailBlock title={t('Raw Response')}>
                    <pre className='bg-muted/50 max-h-72 overflow-auto rounded-lg p-3 text-xs'>
                      {prettyJson(detailRecord?.raw_response) || '-'}
                    </pre>
                  </DetailBlock>
                  <DetailBlock title={t('Error Detail')}>
                    <pre className='bg-muted/50 max-h-72 overflow-auto rounded-lg p-3 text-xs'>
                      {detailRecord?.error_detail || '-'}
                    </pre>
                  </DetailBlock>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 break-all text-sm'>{value || '-'}</div>
    </div>
  )
}

export function TaskCenter() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters)
  const [detailRecord, setDetailRecord] = useState<TaskCenterRecord | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<
    Partial<Record<ColumnId, boolean>>
  >(() => loadVisibleColumns())

  const columnOptions = useMemo(
    () =>
      isAdmin
        ? [
            ...baseColumnOptions.slice(0, 3),
            adminColumnOption,
            ...baseColumnOptions.slice(3),
          ]
        : baseColumnOptions,
    [isAdmin]
  )
  const isColumnVisible = (column: ColumnId) => visibleColumns[column] !== false
  const setColumnVisible = (column: ColumnId, visible: boolean) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [column]: visible }
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }
  const visibleColumnCount = columnOptions.filter((column) =>
    isColumnVisible(column.id)
  ).length

  const queryParams = useMemo(
    () => ({
      p: page,
      page_size: PAGE_SIZE,
      keyword: filters.keyword || undefined,
      task_type:
        filters.task_type === ALL_VALUE ? undefined : filters.task_type,
      status: filters.status === ALL_VALUE ? undefined : filters.status,
      model: filters.model || undefined,
      user: isAdmin && filters.user ? filters.user : undefined,
      tag: normalizeTaskCenterTagFilter(filters.tag) || undefined,
      submit_source:
        filters.submit_source === ALL_VALUE ? undefined : filters.submit_source,
      submitted_start: dateTimeLocalToUnix(filters.submitted_start),
      submitted_end: dateTimeLocalToUnix(filters.submitted_end),
    }),
    [filters, isAdmin, page]
  )

  const listQuery = useQuery({
    queryKey: ['task-center', queryParams],
    queryFn: async () => {
      const res = await listTaskCenter(queryParams)
      if (!res.success) throw new Error(res.message)
      return res.data
    },
  })

  const remarkMutation = useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) =>
      updateTaskCenterRemark(id, remark),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to save remark'))
        return
      }
      toast.success(t('Remark saved'))
      queryClient.invalidateQueries({ queryKey: ['task-center'] })
    },
    onError: () => toast.error(t('Failed to save remark')),
  })

  const records = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const submitFilters = () => {
    setPage(1)
    setFilters(draftFilters)
  }

  const resetFilters = () => {
    setPage(1)
    setDraftFilters(defaultFilters)
    setFilters(defaultFilters)
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Task Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-3'>
          <div className='grid gap-2 rounded-lg border p-3 md:grid-cols-3 xl:grid-cols-6'>
            <div className='relative md:col-span-2 xl:col-span-2'>
              <Search className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
              <Input
                value={draftFilters.keyword}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    keyword: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitFilters()
                }}
                className='pl-8'
                placeholder={t('Search tasks')}
              />
            </div>
            {isAdmin && (
              <Input
                value={draftFilters.user}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, user: event.target.value }))
                }
                placeholder={t('User')}
              />
            )}
            <Input
              value={draftFilters.model}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, model: event.target.value }))
              }
              placeholder={t('Model')}
            />
            <Input
              value={draftFilters.tag}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, tag: event.target.value }))
              }
              placeholder={t('Tag')}
            />
            <Select
              value={draftFilters.task_type}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  task_type: value ?? ALL_VALUE,
                }))
              }
            >
              <SelectTrigger className='w-full'>
                {selectedTypeLabel(t, draftFilters.task_type)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('All Types')}</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {translatedType(t, type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draftFilters.status}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: value ?? ALL_VALUE,
                }))
              }
            >
              <SelectTrigger className='w-full'>
                {selectedStatusLabel(t, draftFilters.status)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('All Statuses')}</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {translatedStatus(t, status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draftFilters.submit_source}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  submit_source: value ?? ALL_VALUE,
                }))
              }
            >
              <SelectTrigger className='w-full'>
                {selectedSourceLabel(t, draftFilters.submit_source)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('All Sources')}</SelectItem>
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>
                    {translatedSource(t, source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type='datetime-local'
              value={draftFilters.submitted_start}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  submitted_start: event.target.value,
                }))
              }
              aria-label={t('Submitted Start')}
              title={t('Submitted Start')}
            />
            <Input
              type='datetime-local'
              value={draftFilters.submitted_end}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  submitted_end: event.target.value,
                }))
              }
              aria-label={t('Submitted End')}
              title={t('Submitted End')}
            />
            <div className='flex justify-end gap-2 md:col-span-3 xl:col-span-6'>
              <Button size='sm' onClick={submitFilters}>
                <Search className='size-4' />
                {t('Search')}
              </Button>
              <Button size='sm' variant='outline' onClick={resetFilters}>
                <RotateCcw className='size-4' />
                {t('Reset')}
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  className={cn(
                    'border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'
                  )}
                >
                  <Columns3 className='size-4' />
                  {t('View')}
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-44'>
                  <DropdownMenuLabel>{t('Toggle columns')}</DropdownMenuLabel>
                  {columnOptions.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={isColumnVisible(column.id)}
                      disabled={column.required}
                      onCheckedChange={(checked) =>
                        setColumnVisible(column.id, Boolean(checked))
                      }
                    >
                      {t(column.label)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {isColumnVisible('task_id') && <TableHead>{t('Task ID')}</TableHead>}
                  {isColumnVisible('submitted_at') && <TableHead>{t('Submitted Time')}</TableHead>}
                  {isColumnVisible('completed_at') && <TableHead>{t('Completed Time')}</TableHead>}
                  {isAdmin && isColumnVisible('user') && <TableHead>{t('User')}</TableHead>}
                  {isColumnVisible('model') && <TableHead>{t('Model')}</TableHead>}
                  {isColumnVisible('source') && <TableHead>{t('Source')}</TableHead>}
                  {isColumnVisible('status') && <TableHead>{t('Status')}</TableHead>}
                  {isColumnVisible('cost') && <TableHead>{t('Cost')}</TableHead>}
                  {isColumnVisible('remark') && <TableHead>{t('Remark')}</TableHead>}
                  {isColumnVisible('actions') && (
                    <TableHead className='text-right'>{t('View Details')}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className='h-40 text-center'>
                      <div className='text-muted-foreground inline-flex items-center gap-2'>
                        <Loader2 className='size-4 animate-spin' />
                        {t('Loading...')}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className='text-muted-foreground h-40 text-center'>
                      {t('No tasks found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => {
                    const Icon = taskTypeIcon(record.task_type)
                    const tags = parseTags(record.tags)
                    return (
                      <TableRow key={record.id}>
                        {isColumnVisible('task_id') && (
                          <TableCell>
                            <div className='flex max-w-72 items-center gap-2'>
                              <Icon className='text-muted-foreground size-4 shrink-0' />
                              <span className='truncate font-mono text-xs'>
                                {record.task_id}
                              </span>
                              <CopyButton
                                value={record.task_id}
                                size='icon'
                                className='size-7'
                                tooltip={t('Copy task ID')}
                                successTooltip={t('Task ID copied')}
                              />
                            </div>
                            <div className='mt-1 flex flex-wrap gap-1'>
                              {tags.slice(0, 3).map((tag) => (
                                <StatusBadge
                                  key={tag}
                                  label={getTaskCenterTagLabel(tag, t)}
                                  autoColor={tag}
                                  copyable={false}
                                />
                              ))}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible('submitted_at') && (
                          <TableCell>{formatUnixTime(record.submitted_at)}</TableCell>
                        )}
                        {isColumnVisible('completed_at') && (
                          <TableCell>{formatUnixTime(record.completed_at)}</TableCell>
                        )}
                        {isAdmin && isColumnVisible('user') && (
                          <TableCell>
                            {record.username_snapshot || record.user_id || '-'}
                          </TableCell>
                        )}
                        {isColumnVisible('model') && (
                          <TableCell className='max-w-48 truncate'>
                            {record.model || '-'}
                          </TableCell>
                        )}
                        {isColumnVisible('source') && (
                          <TableCell>
                            <StatusBadge
                              label={translatedSource(t, record.submit_source)}
                              autoColor={record.submit_source}
                              copyable={false}
                            />
                          </TableCell>
                        )}
                        {isColumnVisible('status') && (
                          <TableCell>
                            <StatusBadge
                              label={translatedStatus(t, record.status)}
                              variant={taskStatusVariant(record.status)}
                              copyable={false}
                            />
                          </TableCell>
                        )}
                        {isColumnVisible('cost') && <TableCell>{formatQuota(record.cost)}</TableCell>}
                        {isColumnVisible('remark') && (
                          <TableCell>
                            <RemarkEditor
                              record={record}
                              saving={remarkMutation.isPending}
                              onSave={(item, remark) =>
                                remarkMutation.mutate({ id: item.id, remark })
                              }
                            />
                          </TableCell>
                        )}
                        {isColumnVisible('actions') && (
                          <TableCell className='text-right'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setDetailRecord(record)}
                            >
                              <Eye className='size-4' />
                              {t('View')}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div className='text-muted-foreground text-sm'>
              {t('Total')}: {total}
            </div>
            <Pagination className='mx-0 w-auto justify-end'>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href='#'
                    text={t('Previous')}
                    onClick={(event) => {
                      event.preventDefault()
                      setPage((prev) => Math.max(1, prev - 1))
                    }}
                  />
                </PaginationItem>
                {getPageNumbers(page, totalPages).map((item, index) =>
                  item === '...' ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href='#'
                        isActive={item === page}
                        onClick={(event) => {
                          event.preventDefault()
                          setPage(Number(item))
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href='#'
                    text={t('Next')}
                    onClick={(event) => {
                      event.preventDefault()
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
        <TaskDetailSheet
          record={detailRecord}
          open={Boolean(detailRecord)}
          onOpenChange={(open) => {
            if (!open) setDetailRecord(null)
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
