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
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/dialog'
import { getPaymentIcon } from '../../lib'
import type { XunhuPayPaymentData } from '../../types'

type XunhuPayQRDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentData: XunhuPayPaymentData | null
}

export function XunhuPayQRDialog({
  open,
  onOpenChange,
  paymentData,
}: XunhuPayQRDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Scan to Pay')}
      description={t('Use WeChat or Alipay to scan the QR code.')}
      contentClassName='sm:max-w-sm'
      footer={
        <Button type='button' onClick={() => onOpenChange(false)}>
          {t('Done')}
        </Button>
      }
    >
      <div className='space-y-4 text-center'>
        {paymentData?.qrcode_url ? (
          <div className='bg-background relative mx-auto flex size-60 items-center justify-center rounded-lg border p-3'>
            <img
              src={paymentData.qrcode_url}
              alt={t('Payment QR code')}
              className='max-h-full max-w-full object-contain'
            />
            {paymentData.payment_type ? (
              <div className='bg-background absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border shadow-sm'>
                {getPaymentIcon(paymentData.payment_type, 'size-8')}
              </div>
            ) : null}
          </div>
        ) : null}
        {!paymentData?.qrcode_url && paymentData?.payment_url ? (
          <a
            href={paymentData.payment_url}
            target='_blank'
            rel='noopener noreferrer'
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium'
          >
            {t('Open payment page')}
          </a>
        ) : null}
        {paymentData?.amount ? (
          <div className='text-sm'>
            <span className='text-muted-foreground'>{t('Amount to pay:')}</span>{' '}
            <span className='font-semibold'>{paymentData.amount}</span>
          </div>
        ) : null}
        {paymentData?.trade_no ? (
          <div className='text-muted-foreground break-all text-xs'>
            {paymentData.trade_no}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
