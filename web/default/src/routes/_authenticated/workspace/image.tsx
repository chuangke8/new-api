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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { Main } from '@/components/layout'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/_authenticated/workspace/image')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'workspace_image')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: WorkspaceImagePage,
})

function WorkspaceImagePage() {
  const { t } = useTranslation()

  return (
    <Main>
      <Empty className='min-h-[calc(100vh-8rem)]'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <ImageIcon />
          </EmptyMedia>
          <EmptyTitle>{t('Image generation')}</EmptyTitle>
          <EmptyDescription>
            {t('Image generation workspace is being prepared.')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {t('Navigation and permissions are ready; generation controls will be connected later.')}
        </EmptyContent>
      </Empty>
    </Main>
  )
}
