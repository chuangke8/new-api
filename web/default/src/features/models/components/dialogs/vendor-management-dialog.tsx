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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatTimestampToDate } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { useIsMobile } from '@/hooks/use-mobile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { getVendors, searchVendors } from '../../api'
import { handleDeleteVendor } from '../../lib/vendor-actions'
import { vendorsQueryKeys } from '../../lib/query-keys'
import type { Vendor } from '../../types'
import { useModels } from '../models-provider'

type VendorManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VendorManagementDialog({
  open,
  onOpenChange,
}: VendorManagementDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const { setOpen, setCurrentVendor } = useModels()
  const [keyword, setKeyword] = useState('')
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null)
  const [deleteState, setDeleteState] = useState<{
    open: boolean
    vendor: Vendor | null
  }>({ open: false, vendor: null })
  const [isDeleting, setIsDeleting] = useState(false)

  const normalizedKeyword = keyword.trim()

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: vendorsQueryKeys.list({
      keyword: normalizedKeyword,
      page_size: 1000,
    }),
    queryFn: () =>
      normalizedKeyword
        ? searchVendors({ keyword: normalizedKeyword, page_size: 1000 })
        : getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = useMemo(() => data?.data?.items ?? [], [data?.data?.items])

  const sortedVendors = useMemo(
    () =>
      [...vendors].sort((a, b) => {
        if (a.status !== b.status) return b.status - a.status
        return a.name.localeCompare(b.name)
      }),
    [vendors]
  )

  useEffect(() => {
    if (!open) {
      setKeyword('')
      setViewVendor(null)
      setDeleteState({ open: false, vendor: null })
      setIsDeleting(false)
    }
  }, [open])

  const handleCreate = () => {
    setCurrentVendor(null)
    setOpen('create-vendor')
  }

  const handleEdit = (vendor: Vendor) => {
    setViewVendor(null)
    setCurrentVendor(vendor)
    setOpen('update-vendor')
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState.vendor) return
    setIsDeleting(true)
    try {
      await handleDeleteVendor(deleteState.vendor.id, queryClient, () => {
        setDeleteState({ open: false, vendor: null })
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const renderVendorIcon = (vendor: Vendor, size = 18) => {
    const icon = vendor.icon ? getLobeIcon(vendor.icon, size) : null
    return (
      <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
        {icon || <Building2 className='text-muted-foreground h-4 w-4' />}
      </span>
    )
  }

  const renderStatus = (vendor: Vendor) => (
    <StatusBadge
      label={vendor.status === 1 ? t('Enabled') : t('Disabled')}
      variant={vendor.status === 1 ? 'success' : 'neutral'}
      size='sm'
      copyable={false}
    />
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className='!top-4 !flex !-translate-y-0 !flex-col !gap-0 !border-none !bg-transparent !p-0 !shadow-none sm:!top-1/2 sm:!-translate-y-1/2'
          style={{ maxWidth: 'min(100vw, 68rem)' }}
        >
          <div
            className={cn(
              'border-border/70 bg-background flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden border shadow-2xl',
              isMobile ? 'rounded-none' : 'rounded-2xl'
            )}
          >
            <div
              className={cn(
                'relative flex flex-col gap-3 border-b px-4 py-4 sm:px-6 sm:py-5',
                isMobile && 'pt-[calc(env(safe-area-inset-top,0px)+1rem)]'
              )}
            >
              <DialogHeader className='max-w-3xl gap-3 pr-12 text-start sm:pr-0'>
                <DialogTitle className='flex flex-wrap items-center gap-2 text-xl'>
                  <Building2 className='text-foreground/80 h-5 w-5' />
                  {t('Vendor Management')}
                </DialogTitle>
                <DialogDescription className='text-base leading-relaxed sm:text-sm'>
                  {t(
                    'View, edit, delete, and create vendors used by model metadata.'
                  )}
                </DialogDescription>
              </DialogHeader>

              <DialogClose
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground hover:text-foreground absolute top-4 right-4 border border-transparent sm:top-5 sm:right-6'
                  />
                }
              >
                <span className='sr-only'>{t('Close dialog')}</span>
                <X className='h-4 w-4' />
              </DialogClose>
            </div>

            <div className='flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
              <div className='relative min-w-0 flex-1 sm:max-w-sm'>
                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('Search vendors...')}
                  className='pl-9'
                />
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => refetchVendors()}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <RefreshCcw className='mr-2 h-4 w-4' />
                  )}
                  {t('Refresh')}
                </Button>
                <Button size='sm' onClick={handleCreate}>
                  <Plus className='mr-2 h-4 w-4' />
                  {t('Add Vendor')}
                </Button>
              </div>
            </div>

            <div
              className={cn(
                'flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6',
                isMobile && 'pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]'
              )}
            >
              <div className='flex-1 overflow-y-auto'>
                {error && (
                  <Alert variant='destructive' className='mb-4'>
                    <AlertTitle>{t('Unable to load vendors')}</AlertTitle>
                    <AlertDescription>
                      {(error as Error).message ||
                        t('Please retry or refresh the page.')}
                    </AlertDescription>
                  </Alert>
                )}

                {isLoading ? (
                  <div className='flex flex-col items-center justify-center gap-2 py-16 text-center'>
                    <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                    <p className='text-muted-foreground text-sm'>
                      {t('Fetching vendors...')}
                    </p>
                  </div>
                ) : sortedVendors.length === 0 ? (
                  <Empty className='border border-dashed'>
                    <EmptyMedia variant='icon'>
                      <Building2 className='h-6 w-6' />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>{t('No vendors found')}</EmptyTitle>
                      <EmptyDescription>
                        {normalizedKeyword
                          ? t('Try another keyword or clear the search.')
                          : t(
                              'Create your first vendor to organize model metadata.'
                            )}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : isMobile ? (
                  <div className='space-y-3'>
                    {sortedVendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className='border-border/60 bg-card rounded-lg border p-4'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='flex min-w-0 items-start gap-3'>
                            {renderVendorIcon(vendor)}
                            <div className='min-w-0 space-y-1'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <span className='font-medium break-all'>
                                  {vendor.name}
                                </span>
                                <TableId value={vendor.id} />
                              </div>
                              {renderStatus(vendor)}
                            </div>
                          </div>
                        </div>
                        <p className='text-muted-foreground mt-3 line-clamp-3 text-sm'>
                          {vendor.description || t('No description provided')}
                        </p>
                        <div className='mt-4 flex flex-wrap justify-end gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setViewVendor(vendor)}
                          >
                            <Eye className='mr-2 h-4 w-4' />
                            {t('View')}
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleEdit(vendor)}
                          >
                            <Pencil className='mr-2 h-4 w-4' />
                            {t('Edit')}
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='text-destructive hover:text-destructive'
                            onClick={() =>
                              setDeleteState({ open: true, vendor })
                            }
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            {t('Delete')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='rounded-md border'>
                    <Table className='min-w-[760px]'>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('Vendor')}</TableHead>
                          <TableHead>{t('Description')}</TableHead>
                          <TableHead>{t('Status')}</TableHead>
                          <TableHead>{t('Updated time')}</TableHead>
                          <TableHead className='w-[150px] text-right'>
                            {t('Actions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedVendors.map((vendor) => (
                          <TableRow key={vendor.id}>
                            <TableCell className='align-top whitespace-normal'>
                              <div className='flex min-w-0 items-start gap-3'>
                                {renderVendorIcon(vendor)}
                                <div className='min-w-0 space-y-1'>
                                  <div className='flex flex-wrap items-center gap-2'>
                                    <span className='font-medium break-all'>
                                      {vendor.name}
                                    </span>
                                    <TableId value={vendor.id} />
                                  </div>
                                  {vendor.icon ? (
                                    <p className='text-muted-foreground break-all text-xs'>
                                      {vendor.icon}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className='text-muted-foreground max-w-[320px] align-top whitespace-normal'>
                              <p className='line-clamp-2'>
                                {vendor.description ||
                                  t('No description provided')}
                              </p>
                            </TableCell>
                            <TableCell className='align-top'>
                              {renderStatus(vendor)}
                            </TableCell>
                            <TableCell className='text-muted-foreground align-top text-xs'>
                              {formatTimestampToDate(vendor.updated_time)}
                            </TableCell>
                            <TableCell className='align-top'>
                              <div className='flex justify-end gap-2'>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  onClick={() => setViewVendor(vendor)}
                                  title={t('View')}
                                >
                                  <Eye className='h-4 w-4' />
                                </Button>
                                <Button
                                  size='icon'
                                  variant='outline'
                                  onClick={() => handleEdit(vendor)}
                                  title={t('Edit')}
                                >
                                  <Pencil className='h-4 w-4' />
                                </Button>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  className='text-destructive hover:text-destructive'
                                  onClick={() =>
                                    setDeleteState({ open: true, vendor })
                                  }
                                  title={t('Delete')}
                                >
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewVendor)} onOpenChange={() => setViewVendor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Vendor details')}</DialogTitle>
            <DialogDescription>
              {t('View the complete vendor record.')}
            </DialogDescription>
          </DialogHeader>
          {viewVendor && (
            <div className='space-y-4'>
              <div className='flex items-center gap-3'>
                {renderVendorIcon(viewVendor, 24)}
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium break-all'>
                      {viewVendor.name}
                    </span>
                    <TableId value={viewVendor.id} />
                  </div>
                  <div className='mt-1'>{renderStatus(viewVendor)}</div>
                </div>
              </div>
              <div className='grid gap-3 text-sm sm:grid-cols-2'>
                <DetailItem label={t('Vendor ID')} value={`#${viewVendor.id}`} />
                <DetailItem
                  label={t('Icon key')}
                  value={viewVendor.icon || '-'}
                />
                <DetailItem
                  label={t('Created time')}
                  value={formatTimestampToDate(viewVendor.created_time)}
                />
                <DetailItem
                  label={t('Updated time')}
                  value={formatTimestampToDate(viewVendor.updated_time)}
                />
              </div>
              <DetailItem
                label={t('Description')}
                value={viewVendor.description || t('No description provided')}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setViewVendor(null)}>
              {t('Close')}
            </Button>
            {viewVendor && (
              <Button onClick={() => handleEdit(viewVendor)}>
                <Pencil className='mr-2 h-4 w-4' />
                {t('Edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteState.open}
        onOpenChange={(next) => setDeleteState({ open: next, vendor: null })}
        title={t('Delete vendor')}
        desc={
          <p>
            {t('Delete vendor {{name}}?', {
              name: deleteState.vendor?.name || '',
            })}{' '}
            {t(
              'This vendor will be removed from the vendor list. Models using it may show no vendor until reassigned.'
            )}
          </p>
        }
        destructive
        confirmText={isDeleting ? t('Deleting...') : t('Delete')}
        isLoading={isDeleting}
        handleConfirm={handleDeleteConfirm}
      />
    </>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-muted-foreground text-xs font-medium'>{label}</div>
      <div className='mt-1 break-all text-sm'>{value}</div>
    </div>
  )
}
