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
import {
  WalletCards,
  Lock,
  ShieldCheck,
  ChartColumn,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { AnimateInView } from '@/components/animate-in-view'

const TONE_ICON: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
  purple: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
  green: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
}

const TONE_CHIP: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
}

const BARS = [32, 48, 40, 64, 56, 80, 68]

interface AdvCard {
  id: string
  icon: LucideIcon
  tone: string
  title: string
  desc: string
  savings?: { name: string; value: string }[]
  chips?: string[]
  chart?: boolean
}

export function Advantages() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  const cards: AdvCard[] = [
    {
      id: 'value',
      icon: WalletCards,
      tone: 'blue',
      title: t('Unbeatable Value'),
      desc: t(
        'Through bulk procurement and optimized routing, we offer prices far below direct access. Transparent billing, no hidden fees.'
      ),
      savings: [
        { name: 'GPT-5.5', value: t('Save 60%') },
        { name: 'Claude 4.8 Sonnet', value: t('Save 45%') },
      ],
    },
    {
      id: 'security',
      icon: Lock,
      tone: 'purple',
      title: t('Security & Privacy'),
      desc: t(
        'Enterprise-grade encrypted key storage. We never log raw conversations, and every request travels over a fully encrypted link.'
      ),
      chips: ['TLS 1.3', 'AES-256', t('No-log Policy')],
    },
    {
      id: 'coverage',
      icon: ShieldCheck,
      tone: 'green',
      title: t('Broad Model Coverage'),
      desc: t(
        'Aggregating OpenAI, Google, Claude, Meta and other leading models — switch freely with a single API key.'
      ),
      chips: ['GPT-5.5', 'Claude-4.8', 'Gemini-3.5', 'DeepSeek-V4'],
    },
    {
      id: 'billing',
      icon: ChartColumn,
      tone: 'blue',
      title: t('Detailed Billing Analytics'),
      desc: t(
        'Multi-dimensional views of token usage, RPS fluctuations and model usage ratios. Export detailed reports in real time for clear cost control.'
      ),
      chart: true,
    },
  ]

  return (
    <section className='relative z-10 px-6 py-16 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 text-center md:mb-16'>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Why Choose {{name}}?', { name: systemName })}
          </h2>
          <p className='text-muted-foreground mt-3 text-sm md:text-base'>
            {t('Everything you need to build AI-powered apps')}
          </p>
        </AnimateInView>

        <div className='grid gap-5 md:grid-cols-2'>
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <AnimateInView
                key={card.id}
                delay={i * 100}
                animation='scale-in'
                className='border-border/60 bg-background flex gap-5 rounded-2xl border p-6 transition-shadow duration-200 hover:shadow-md md:p-7'
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON[card.tone]}`}
                >
                  <Icon className='size-7' strokeWidth={1.5} />
                </span>
                <div className='min-w-0'>
                  <h3 className='text-lg font-semibold'>{card.title}</h3>
                  <p className='text-muted-foreground mt-1.5 mb-4 text-sm leading-relaxed'>
                    {card.desc}
                  </p>

                  {card.savings && (
                    <div className='flex flex-col gap-2'>
                      {card.savings.map((s) => (
                        <div
                          key={s.name}
                          className='bg-muted/50 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px]'
                        >
                          <strong className='font-medium'>{s.name}</strong>
                          <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                            {s.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {card.chips && (
                    <div className='flex flex-wrap gap-2'>
                      {card.chips.map((c) => (
                        <span
                          key={c}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE_CHIP[card.tone]}`}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {card.chart && (
                    <div
                      className='flex h-[72px] items-end gap-2'
                      aria-hidden='true'
                    >
                      {BARS.map((h, idx) => (
                        <span
                          key={idx}
                          style={{ height: `${h}%` }}
                          className='flex-1 rounded-t-md bg-gradient-to-t from-blue-400 to-violet-500 opacity-85'
                        />
                      ))}
                    </div>
                  )}
                </div>
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
