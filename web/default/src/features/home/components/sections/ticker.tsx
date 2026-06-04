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
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { getNotice } from '@/lib/api'

// Strip markdown/HTML so the announcement scrolls as a single clean line.
function toPlainText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function Ticker() {
  const { data } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const text = data?.success && data.data ? toPlainText(data.data) : ''
  if (!text) return null

  return (
    <div className='border-border/40 bg-muted/30 relative z-10 mt-16 border-b'>
      <div className='mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-6 py-2.5'>
        <Megaphone className='size-4 shrink-0 text-blue-500 dark:text-blue-400' />
        <span className='text-muted-foreground truncate text-center text-xs sm:text-[13px]'>
          {text}
        </span>
      </div>
    </div>
  )
}
