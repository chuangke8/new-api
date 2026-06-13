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
import { Link } from '@tanstack/react-router'
import {
  BriefcaseBusiness,
  Headset,
  Mail,
  MessageCircle,
  QrCode,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AnimateInView } from '@/components/animate-in-view'

type ContactCardProps = {
  title: string
  image?: string
  fallback: string
}

interface ContactCTAProps {
  isAuthenticated?: boolean
}

function ContactCard(props: ContactCardProps) {
  return (
    <div className='bg-muted/40 flex min-w-0 flex-col gap-3 rounded-lg border p-3'>
      <div className='text-sm font-medium'>{props.title}</div>
      <div className='bg-background flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border'>
        {props.image ? (
          <img
            src={props.image}
            alt={props.title}
            className='h-full w-full object-contain'
          />
        ) : (
          <div className='text-muted-foreground flex flex-col items-center gap-2 text-center text-xs'>
            <QrCode className='size-8' />
            <span>{props.fallback}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ContactCTA(props: ContactCTAProps) {
  const { t } = useTranslation()
  const { contact } = useSystemConfig()
  const hasContact =
    Boolean(contact?.wechatQrImage) ||
    Boolean(contact?.supportQrImage) ||
    Boolean(contact?.wechatId) ||
    Boolean(contact?.email)

  return (
    <section className='relative z-10 px-6 pt-4 pb-12 md:pb-16'>
      <AnimateInView
        className='relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-8 py-12 text-center text-white shadow-2xl shadow-slate-950/10 md:py-14'
        animation='scale-in'
      >
        <div
          aria-hidden
          className='absolute inset-0 -z-20 bg-[linear-gradient(115deg,#172447_0%,#18233f_42%,#0e332f_100%)]'
        />
        <div
          aria-hidden
          className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(91,141,255,0.18),transparent_32%),radial-gradient(circle_at_70%_70%,rgba(34,197,94,0.16),transparent_34%)]'
        />

        <h2 className='mx-auto max-w-3xl text-2xl leading-tight font-bold tracking-normal md:text-3xl'>
          {t('Ready to accelerate your AI applications?')}
        </h2>
        <p className='mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/76 md:text-[15px]'>
          {t(
            'Register now, join the contact group for free test credits, and start stable, efficient API proxy service without a credit card.'
          )}
        </p>
        <div className='mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center'>
          <Button
            size='lg'
            className='h-11 rounded-lg bg-white px-6 text-slate-950 hover:bg-white/90'
            render={
              <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
            }
          >
            {props.isAuthenticated
              ? t('Go to Dashboard')
              : t('Create Free Account')}
          </Button>
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  type='button'
                  size='lg'
                  variant='outline'
                  className='h-11 rounded-lg border-white/70 bg-white/5 px-6 text-white hover:border-white hover:bg-white/10 hover:text-white'
                />
              }
            >
              {t('Contact Business Cooperation')}
            </DialogTrigger>
            <DialogContent className='sm:max-w-xl'>
              <DialogHeader>
                <DialogTitle>{t('Contact Business Cooperation')}</DialogTitle>
                <DialogDescription>
                  {hasContact
                    ? t('Scan a QR code or use the contact information below.')
                    : t('Contact information has not been configured yet.')}
                </DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 sm:grid-cols-2'>
                <ContactCard
                  title={t('Business QR Code')}
                  image={contact?.wechatQrImage}
                  fallback={t('Business QR code not configured')}
                />
                <ContactCard
                  title={t('Customer Service QR Code')}
                  image={contact?.supportQrImage}
                  fallback={t('Customer service QR code not configured')}
                />
              </div>
              <div className='grid gap-3 text-sm sm:grid-cols-2'>
                <div className='bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg border p-3'>
                  <MessageCircle className='text-muted-foreground size-4 shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Business Contact ID')}
                    </div>
                    <div className='truncate font-medium'>
                      {contact?.wechatId || t('Not configured')}
                    </div>
                  </div>
                </div>
                <div className='bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg border p-3'>
                  <Mail className='text-muted-foreground size-4 shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Contact Email')}
                    </div>
                    <div className='truncate font-medium'>
                      {contact?.email || t('Not configured')}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AnimateInView>
    </section>
  )
}

function FloatingContactDialog(props: {
  title: string
  image?: string
  fallback: string
  icon: ReactNode
  buttonClassName?: string
}) {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type='button'
            className={props.buttonClassName}
            aria-label={props.title}
          />
        }
      >
        <span className='flex items-center gap-2'>
          {props.icon}
          <span>{props.title}</span>
        </span>
      </DialogTrigger>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>
            {t('Scan the QR code to contact {{name}}.', {
              name: props.title,
            })}
          </DialogDescription>
        </DialogHeader>
        <ContactCard
          title={props.title}
          image={props.image}
          fallback={props.fallback}
        />
      </DialogContent>
    </Dialog>
  )
}

export function HomeContactFloatingActions() {
  const { t } = useTranslation()
  const { contact } = useSystemConfig()
  const hasSupport = Boolean(contact?.supportQrImage)
  const hasBusiness = Boolean(contact?.wechatQrImage)

  if (!hasSupport && !hasBusiness) return null

  return (
    <div className='fixed top-1/2 right-4 z-50 flex max-w-[calc(100vw-2rem)] -translate-y-1/2 flex-col items-end gap-2 sm:right-6'>
      {hasSupport ? (
        <FloatingContactDialog
          title={t('Online customer service')}
          image={contact?.supportQrImage}
          fallback={t('Customer service QR code not configured')}
          icon={<Headset className='size-4' />}
          buttonClassName='h-10 rounded-lg px-4 shadow-lg'
        />
      ) : null}
      {hasBusiness ? (
        <FloatingContactDialog
          title={t('Business cooperation')}
          image={contact?.wechatQrImage}
          fallback={t('Business QR code not configured')}
          icon={<BriefcaseBusiness className='size-4' />}
          buttonClassName='h-10 rounded-lg bg-emerald-600 px-4 text-white shadow-lg hover:bg-emerald-700'
        />
      ) : null}
    </div>
  )
}
