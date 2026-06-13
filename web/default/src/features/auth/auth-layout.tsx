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
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='bg-background relative grid min-h-svh overflow-hidden px-4 py-8'>
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.42)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.42)_1px,transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(to_right,hsl(var(--border)/0.24)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.24)_1px,transparent_1px)]' />
      <div className='bg-primary/12 dark:bg-primary/8 pointer-events-none absolute top-[-16rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full blur-3xl' />
      <div className='pointer-events-none absolute right-[-10rem] bottom-[-12rem] h-[24rem] w-[24rem] rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/5' />

      <main className='relative z-10 mx-auto flex w-full max-w-[420px] flex-col items-center justify-center gap-5'>
        <Link
          to='/'
          className='flex flex-col items-center gap-3 text-center transition-opacity hover:opacity-85'
        >
          <div className='border-background/80 bg-card shadow-primary/10 relative h-14 w-14 rounded-2xl border p-1.5 shadow-xl'>
            {loading ? (
              <Skeleton className='absolute inset-1.5 rounded-xl' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                className='h-full w-full rounded-xl object-cover'
              />
            )}
          </div>
          <div className='space-y-1'>
            {loading ? (
              <Skeleton className='mx-auto h-7 w-36' />
            ) : (
              <h1 className='text-primary text-2xl font-semibold'>
                {systemName}
              </h1>
            )}
            <p className='text-muted-foreground text-sm'>
              {t('Secure access for AI API services')}
            </p>
          </div>
        </Link>

        <div className='bg-card/90 border-border/60 w-full rounded-2xl border p-6 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-7 dark:shadow-black/35'>
          {children}
        </div>
      </main>
    </div>
  )
}
