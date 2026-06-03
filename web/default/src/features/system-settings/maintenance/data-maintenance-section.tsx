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
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getDataMaintenanceLogs,
  getDataMaintenanceSettings,
  runDataMaintenanceCleanup,
  updateDataMaintenanceSettings,
} from '../api'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import type {
  DataMaintenanceCleanupType,
  DataMaintenanceSettings,
} from '../types'
import { SettingsControlGroup } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'

const cleanupTypes: Array<{
  value: DataMaintenanceCleanupType
  label: string
  description: string
}> = [
  {
    value: 'video',
    label: 'Generated videos',
    description: 'Delete localized video files saved on the server.',
  },
  {
    value: 'image',
    label: 'Generated images',
    description: 'Delete localized image files saved on the server.',
  },
  {
    value: 'reference_image',
    label: 'Reference images',
    description: 'Delete reference images saved for generated tasks.',
  },
  {
    value: 'chat_messages',
    label: 'Chat message content',
    description: 'Clear expired chat message content while keeping sessions.',
  },
  {
    value: 'chat_files',
    label: 'Chat files',
    description: 'Clear expired chat attachment metadata while keeping sessions.',
  },
]

const defaultSettings: DataMaintenanceSettings = {
  auto_cleanup_enabled: false,
  cleanup_interval_hours: 24,
  image_retention_days: 0,
  video_retention_days: 0,
  reference_image_retention_days: 0,
  chat_message_retention_days: 0,
  chat_file_retention_days: 0,
  last_cleanup_time: 0,
  last_cleanup_summary: '',
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function toUnixSeconds(date?: Date) {
  if (!date) return 0
  return Math.floor(date.getTime() / 1000)
}

function formatUnix(value?: number) {
  if (!value) return '-'
  return new Date(value * 1000).toLocaleString()
}

function formatCleanupRange(startTime?: number, endTime?: number, beforeTime?: number) {
  if (startTime || endTime) {
    return `${formatUnix(startTime)} ~ ${formatUnix(endTime)}`
  }
  if (beforeTime) return `- ~ ${formatUnix(beforeTime)}`
  return '-'
}

function normalizeSettings(settings: DataMaintenanceSettings) {
  return {
    ...settings,
    cleanup_interval_hours: Math.max(1, Number(settings.cleanup_interval_hours) || 24),
    image_retention_days: Math.max(0, Number(settings.image_retention_days) || 0),
    video_retention_days: Math.max(0, Number(settings.video_retention_days) || 0),
    reference_image_retention_days: Math.max(0, Number(settings.reference_image_retention_days) || 0),
    chat_message_retention_days: Math.max(0, Number(settings.chat_message_retention_days) || 0),
    chat_file_retention_days: Math.max(0, Number(settings.chat_file_retention_days) || 0),
  }
}

export function DataMaintenanceSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [settings, setSettings] =
    useState<DataMaintenanceSettings>(defaultSettings)
  const [cleanupStartDate, setCleanupStartDate] = useState<Date | undefined>(
    () => daysAgo(30)
  )
  const [cleanupEndDate, setCleanupEndDate] = useState<Date | undefined>(
    () => new Date()
  )
  const [selectedTypes, setSelectedTypes] = useState<DataMaintenanceCleanupType[]>([
    'video',
    'image',
    'reference_image',
  ])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['data-maintenance-settings'],
    queryFn: async () => {
      const response = await getDataMaintenanceSettings()
      if (!response.success) throw new Error(response.message)
      return response.data
    },
  })

  const logsQuery = useQuery({
    queryKey: ['data-maintenance-logs'],
    queryFn: async () => {
      const response = await getDataMaintenanceLogs(20)
      if (!response.success) throw new Error(response.message)
      return response.data || []
    },
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings({ ...defaultSettings, ...settingsQuery.data })
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await updateDataMaintenanceSettings(
        normalizeSettings(settings)
      )
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: (data) => {
      setSettings({ ...defaultSettings, ...data })
      queryClient.invalidateQueries({ queryKey: ['data-maintenance-settings'] })
      toast.success(t('Data maintenance settings saved'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Failed to save data maintenance settings')
      )
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await runDataMaintenanceCleanup({
        types: selectedTypes,
        start_time: toUnixSeconds(cleanupStartDate),
        end_time: toUnixSeconds(cleanupEndDate),
      })
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: (result) => {
      toast.success(
        t(
          'Cleanup completed. Deleted {{files}} files and cleared {{records}} records.',
          {
            files: result.deleted_files,
            records: result.deleted_records,
          }
        )
      )
      queryClient.invalidateQueries({ queryKey: ['data-maintenance-logs'] })
      queryClient.invalidateQueries({ queryKey: ['data-maintenance-settings'] })
      setConfirmOpen(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Data cleanup failed')
      )
    },
  })

  const startTime = useMemo(
    () => toUnixSeconds(cleanupStartDate),
    [cleanupStartDate]
  )
  const endTime = useMemo(
    () => toUnixSeconds(cleanupEndDate),
    [cleanupEndDate]
  )
  const selectedTypeLabels = selectedTypes
    .map((type) => cleanupTypes.find((item) => item.value === type)?.label)
    .filter(Boolean)
    .map((label) => t(label as string))
    .join(', ')

  const updateNumber = (key: keyof DataMaintenanceSettings, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: Math.max(0, Number(value) || 0),
    }))
  }

  const toggleType = (type: DataMaintenanceCleanupType, checked: boolean) => {
    setSelectedTypes((current) => {
      if (checked) return Array.from(new Set([...current, type]))
      return current.filter((item) => item !== type)
    })
  }

  const requestCleanup = () => {
    if (selectedTypes.length === 0) {
      toast.error(t('Select at least one cleanup type.'))
      return
    }
    if (!startTime || !endTime) {
      toast.error(t('Select a cleanup time range.'))
      return
    }
    if (startTime > endTime) {
      toast.error(t('Start time cannot be later than end time.'))
      return
    }
    setConfirmOpen(true)
  }

  return (
    <SettingsSection title={t('Data Maintenance')}>
      <div className='space-y-4'>
        <SettingsControlGroup className='space-y-4'>
          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>{t('Automatic cleanup')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t('Automatically clean expired generated assets and chat data.')}
              </p>
            </div>
            <Switch
              checked={settings.auto_cleanup_enabled}
              onCheckedChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  auto_cleanup_enabled: checked,
                }))
              }
            />
          </div>

          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            <NumberField
              label={t('Cleanup interval (hours)')}
              value={settings.cleanup_interval_hours}
              min={1}
              onChange={(value) =>
                updateNumber('cleanup_interval_hours', value)
              }
            />
            <NumberField
              label={t('Generated image retention (days)')}
              value={settings.image_retention_days}
              onChange={(value) => updateNumber('image_retention_days', value)}
            />
            <NumberField
              label={t('Generated video retention (days)')}
              value={settings.video_retention_days}
              onChange={(value) => updateNumber('video_retention_days', value)}
            />
            <NumberField
              label={t('Reference image retention (days)')}
              value={settings.reference_image_retention_days}
              onChange={(value) =>
                updateNumber('reference_image_retention_days', value)
              }
            />
            <NumberField
              label={t('Chat content retention (days)')}
              value={settings.chat_message_retention_days}
              onChange={(value) =>
                updateNumber('chat_message_retention_days', value)
              }
            />
            <NumberField
              label={t('Chat file retention (days)')}
              value={settings.chat_file_retention_days}
              onChange={(value) =>
                updateNumber('chat_file_retention_days', value)
              }
            />
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('Set retention days to 0 to keep that data permanently.')}
          </p>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='text-muted-foreground text-sm'>
              {t('Last cleanup')}: {formatUnix(settings.last_cleanup_time)}
            </div>
            <Button
              type='button'
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || settingsQuery.isLoading}
            >
              {saveMutation.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Save />
              )}
              {t('Save settings')}
            </Button>
          </div>
        </SettingsControlGroup>

        <SettingsControlGroup className='space-y-4'>
          <div className='space-y-1'>
            <h4 className='text-sm font-medium'>{t('Manual cleanup')}</h4>
            <p className='text-muted-foreground text-sm'>
              {t('Choose a time range and clean matching data immediately.')}
            </p>
          </div>
          <CompactDateTimeRangePicker
            start={cleanupStartDate}
            end={cleanupEndDate}
            onChange={({ start, end }) => {
              setCleanupStartDate(start)
              setCleanupEndDate(end)
            }}
          />
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {cleanupTypes.map((item) => (
              <label
                key={item.value}
                className='bg-background flex items-start gap-3 rounded-lg border p-3'
              >
                <Checkbox
                  checked={selectedTypes.includes(item.value)}
                  onCheckedChange={(checked) =>
                    toggleType(item.value, Boolean(checked))
                  }
                />
                <span className='space-y-1'>
                  <span className='block text-sm font-medium'>
                    {t(item.label)}
                  </span>
                  <span className='text-muted-foreground block text-xs'>
                    {t(item.description)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className='flex flex-wrap gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ['data-maintenance-logs'],
                })
                queryClient.invalidateQueries({
                  queryKey: ['data-maintenance-settings'],
                })
              }}
            >
              <RefreshCw />
              {t('Refresh')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={requestCleanup}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Trash2 />
              )}
              {t('Clean selected data')}
            </Button>
          </div>
        </SettingsControlGroup>

        <SettingsControlGroup className='space-y-3'>
          <div className='flex items-center justify-between gap-3'>
            <h4 className='text-sm font-medium'>{t('Cleanup logs')}</h4>
            {logsQuery.isLoading ? (
              <Loader2 className='text-muted-foreground size-4 animate-spin' />
            ) : null}
          </div>
          <div className='overflow-x-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Cleanup time')}</TableHead>
                  <TableHead>{t('Type')}</TableHead>
                  <TableHead>{t('Cleanup range')}</TableHead>
                  <TableHead>{t('Operator')}</TableHead>
                  <TableHead>{t('Deleted files')}</TableHead>
                  <TableHead>{t('Cleared records')}</TableHead>
                  <TableHead>{t('Failed')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logsQuery.data || []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='text-muted-foreground h-24 text-center'
                    >
                      {t('No cleanup logs')}
                    </TableCell>
                  </TableRow>
                ) : (
                  (logsQuery.data || []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatUnix(log.finished_at)}</TableCell>
                      <TableCell className='min-w-40'>
                        {log.cleanup_types
                          .split(',')
                          .filter(Boolean)
                          .map((type) => cleanupTypeLabel(t, type))
                          .join(', ')}
                      </TableCell>
                      <TableCell>
                        {formatCleanupRange(
                          log.start_time,
                          log.end_time,
                          log.before_time
                        )}
                      </TableCell>
                      <TableCell>{log.operator_name || '-'}</TableCell>
                      <TableCell>{log.deleted_files}</TableCell>
                      <TableCell>{log.deleted_records}</TableCell>
                      <TableCell>{log.failed_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SettingsControlGroup>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm data cleanup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'This will clean {{types}} from {{start}} to {{end}}. Task records and chat sessions will be kept, but expired assets and message content cannot be restored.',
                {
                  types: selectedTypeLabels || '-',
                  start: formatUnix(startTime),
                  end: formatUnix(endTime),
                }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupMutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? t('Cleaning...') : t('Confirm cleanup')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}

function NumberField(props: {
  label: string
  value: number
  min?: number
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label>{props.label}</Label>
      <Input
        type='number'
        min={props.min ?? 0}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  )
}

function cleanupTypeLabel(t: (key: string) => string, type: string) {
  const labels: Record<string, string> = {
    chat_files: 'Chat files',
    chat_messages: 'Chat message content',
    image: 'Generated images',
    reference_image: 'Reference images',
    video: 'Generated videos',
  }
  return t(labels[type] || type)
}
