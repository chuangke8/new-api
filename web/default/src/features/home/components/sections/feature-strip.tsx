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
  CalendarCheck,
  ChartColumn,
  KeyRound,
  PlugZap,
  WalletCards,
  ReceiptText,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

type FileRoute =
  | '/profile'
  | '/dashboard'
  | '/keys'
  | '/console/topup'
  | '/usage-logs'

interface FeatureCardBase {
  id: string
  icon: LucideIcon
  tone: string
  title: string
  desc: string
}

type FeatureCard =
  | (FeatureCardBase & { to: FileRoute; href?: never })
  | (FeatureCardBase & { href: string; to?: never })

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
  purple: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
  indigo: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
  mint: 'bg-teal-500/10 text-teal-500 dark:text-teal-400',
  violet: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
  red: 'bg-rose-500/10 text-rose-500 dark:text-rose-400',
}

const CARD_CLASSES =
  'group border-border/60 bg-background hover:border-blue-500/40 flex h-full min-h-[148px] flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-md'

export function FeatureStrip() {
  const { t } = useTranslation()

  const cards: FeatureCard[] = [
    {
      id: 'checkin',
      icon: CalendarCheck,
      tone: 'blue',
      title: t('Daily Check-in'),
      desc: t('Claim daily rewards, with lottery events updated regularly'),
      to: '/profile',
    },
    {
      id: 'data',
      icon: ChartColumn,
      tone: 'green',
      title: t('Data'),
      desc: t('View quota, usage trends and your account dashboard'),
      to: '/dashboard',
    },
    {
      id: 'tokens',
      icon: KeyRound,
      tone: 'purple',
      title: t('Token Management'),
      desc: t('Create API tokens and connect your tools'),
      to: '/keys',
    },
    {
      id: 'ccswitch',
      icon: PlugZap,
      tone: 'indigo',
      title: t('Import to CC Switch'),
      desc: t(
        'Generate configs for Claude Code, OpenCode and more in one click'
      ),
      href: 'https://ccswitch.io',
    },
    {
      id: 'wallet',
      icon: WalletCards,
      tone: 'mint',
      title: t('Wallet Top-up'),
      desc: t('Pay as you go, no need to hoard tokens'),
      to: '/console/topup',
    },
    {
      id: 'logs',
      icon: ReceiptText,
      tone: 'violet',
      title: t('View Logs'),
      desc: t('Inspect token usage logs and image generation logs'),
      to: '/usage-logs',
    },
    {
      id: 'referral',
      icon: Megaphone,
      tone: 'red',
      title: t('Referral Rewards'),
      desc: t('Invite sign-ups for top-up rebates and lower rate multipliers'),
      to: '/profile',
    },
  ]

  return (
    <section className='relative z-10 px-6 pb-6'>
      <div className='mx-auto grid max-w-6xl auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-7'>
        {cards.map((card, i) => {
          const Icon = card.icon
          const inner = (
            <>
              <span
                className={`mb-1 inline-flex size-11 items-center justify-center rounded-xl ${TONE_CLASSES[card.tone]}`}
              >
                <Icon className='size-6' aria-hidden='true' />
              </span>
              <strong className='text-[14.5px] font-semibold'>
                {card.title}
              </strong>
              <span className='text-muted-foreground text-xs leading-relaxed'>
                {card.desc}
              </span>
            </>
          )

          return (
            <AnimateInView
              key={card.id}
              className='h-full'
              delay={i * 60}
              animation='fade-up'
            >
              {card.href !== undefined ? (
                <a
                  href={card.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={CARD_CLASSES}
                >
                  {inner}
                </a>
              ) : (
                <Link to={card.to} className={CARD_CLASSES}>
                  {inner}
                </Link>
              )}
            </AnimateInView>
          )
        })}
      </div>
    </section>
  )
}
