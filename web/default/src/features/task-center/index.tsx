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
  Eye,
  FileAudio,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SectionPageLayout } from '@/components/layout'
import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import { useIsAdmin } from '@/hooks/use-admin'
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
  SelectValue,
} from '@/components/ui/select'
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

type Filters = {
  keyword: string
  task_type: string
  status: string
  model: string
  user: string
  tag: string
}

const defaultFilters: Filters = {
  keyword: '',
  task_type: ALL_VALUE,
  status: ALL_VALUE,
  model: '',
  user: '',
  tag: '',
}

const statusOptions = ['pending', 'running', 'succeeded', 'failed', 'cancelled']
const typeOptions = ['image', 'video', 'audio', 'other']

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

function DetailBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  if (!children) return null
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-medium'>{title}</h3>
      {children}
    </section>
  )
}

function UrlGrid({ urls, type }: { urls?: string[]; type: 'image' | 'video' | 'file' }) {
  const cleanUrls = (urls ?? []).filter(Boolean)
  if (cleanUrls.length === 0) return null
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {cleanUrls.map((url) => (
        <a
          key={url}
          href={url}
          target='_blank'
          rel='noreferrer'
          className='border-border bg-muted/30 block overflow-hidden rounded-lg border'
        >
          {type === 'image' ? (
            <img src={url} alt='' className='aspect-video w-full object-cover' />
          ) : type === 'video' ? (
            <video src={url} controls className='aspect-video w-full' />
          ) : (
            <div className='text-muted-foreground flex min-h-24 items-center justify-center break-all p-3 text-sm'>
              {url}
            </div>
          )}
        </a>
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
                <InfoItem label={t('Cost')} value={String(detailRecord?.cost ?? 0)} />
                <InfoItem label={t('Remark')} value={detailRecord?.remark || '-'} />
              </div>

              <DetailBlock title={t('Prompt')}>
                <pre className='bg-muted/50 whitespace-pre-wrap rounded-lg p-3 text-sm'>
                  {detail.prompt || detail.input_text || '-'}
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
                  <UrlGrid urls={detail.images} type='image' />
                  <UrlGrid urls={detail.videos} type='video' />
                  <UrlGrid urls={[...(detail.audios ?? []), ...(detail.files ?? [])]} type='file' />
                </div>
              </DetailBlock>
              <DetailBlock title={t('Reference Images')}>
                <UrlGrid urls={detail.reference_images} type='image' />
              </DetailBlock>
              {detailRecord?.error_message && (
                <DetailBlock title={t('Error Message')}>
                  <pre className='bg-destructive/10 text-destructive whitespace-pre-wrap rounded-lg p-3 text-sm'>
                    {detailRecord.error_message}
                  </pre>
                </DetailBlock>
              )}
              {metadata && (
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
                <SelectValue placeholder={t('All Types')} />
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
                <SelectValue placeholder={t('All Statuses')} />
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
            <div className='flex gap-2 md:col-span-3 xl:col-span-2'>
              <Button onClick={submitFilters} className='flex-1'>
                {t('Filter')}
              </Button>
              <Button variant='outline' onClick={resetFilters}>
                {t('Reset')}
              </Button>
            </div>
          </div>

          <div className='overflow-hidden rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Task ID')}</TableHead>
                  <TableHead>{t('Submitted Time')}</TableHead>
                  <TableHead>{t('Completed Time')}</TableHead>
                  {isAdmin && <TableHead>{t('User')}</TableHead>}
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Cost')}</TableHead>
                  <TableHead>{t('Remark')}</TableHead>
                  <TableHead className='text-right'>{t('View Details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className='h-40 text-center'>
                      <div className='text-muted-foreground inline-flex items-center gap-2'>
                        <Loader2 className='size-4 animate-spin' />
                        {t('Loading...')}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className='text-muted-foreground h-40 text-center'>
                      {t('No tasks found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => {
                    const Icon = taskTypeIcon(record.task_type)
                    const tags = parseTags(record.tags)
                    return (
                      <TableRow key={record.id}>
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
                        <TableCell>{formatUnixTime(record.submitted_at)}</TableCell>
                        <TableCell>{formatUnixTime(record.completed_at)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            {record.username_snapshot || record.user_id || '-'}
                          </TableCell>
                        )}
                        <TableCell className='max-w-48 truncate'>
                          {record.model || '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={translatedStatus(t, record.status)}
                            variant={taskStatusVariant(record.status)}
                            copyable={false}
                          />
                        </TableCell>
                        <TableCell>{record.cost}</TableCell>
                        <TableCell>
                          <RemarkEditor
                            record={record}
                            saving={remarkMutation.isPending}
                            onSave={(item, remark) =>
                              remarkMutation.mutate({ id: item.id, remark })
                            }
                          />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setDetailRecord(record)}
                          >
                            <Eye className='size-4' />
                            {t('View Details')}
                          </Button>
                        </TableCell>
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
