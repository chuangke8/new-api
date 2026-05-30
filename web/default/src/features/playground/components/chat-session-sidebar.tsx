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
import { useEffect, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Edit3,
  MessageSquarePlus,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { WorkspaceChatSession } from '../types'

type ChatSessionSidebarProps = {
  sessions: WorkspaceChatSession[]
  activeSessionId: number | null
  archived: boolean
  collapsed: boolean
  isLoading?: boolean
  onArchivedChange: (archived: boolean) => void
  onCollapsedChange: (collapsed: boolean) => void
  onNewSession: () => void
  onSelectSession: (session: WorkspaceChatSession) => void
  onRenameSession: (session: WorkspaceChatSession, title: string) => void
  onArchiveSession: (session: WorkspaceChatSession) => void
  onUnarchiveSession: (session: WorkspaceChatSession) => void
  onDeleteSession: (session: WorkspaceChatSession) => void
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  archived,
  collapsed,
  isLoading,
  onArchivedChange,
  onCollapsedChange,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
}: ChatSessionSidebarProps) {
  const { t } = useTranslation()
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!renamingId) return
    const session = sessions.find((item) => item.id === renamingId)
    setRenameValue(session?.title || '')
  }, [renamingId, sessions])

  const submitRename = (session: WorkspaceChatSession) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (title && title !== session.title) {
      onRenameSession(session, title)
    }
  }

  return (
    <aside
      className={cn(
        'bg-background/95 border-border flex h-full shrink-0 flex-col border-r transition-all duration-200',
        collapsed ? 'w-12' : 'w-72'
      )}
    >
      <div className='flex items-center gap-2 border-b p-2'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={collapsed ? t('Expand sessions') : t('Collapse sessions')}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
        {!collapsed && (
          <Button className='min-w-0 flex-1' size='sm' onClick={onNewSession}>
            <MessageSquarePlus />
            <span className='truncate'>{t('New chat')}</span>
          </Button>
        )}
      </div>

      {collapsed ? (
        <div className='flex flex-1 flex-col items-center gap-2 p-2'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('New chat')}
            onClick={onNewSession}
          >
            <MessageSquarePlus />
          </Button>
        </div>
      ) : (
        <>
          <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Archived')}
            </span>
            <Switch
              checked={archived}
              onCheckedChange={onArchivedChange}
              aria-label={t('Show archived conversations')}
            />
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto p-2'>
            {isLoading ? (
              <div className='text-muted-foreground px-2 py-6 text-center text-xs'>
                {t('Loading...')}
              </div>
            ) : sessions.length === 0 ? (
              <div className='text-muted-foreground px-2 py-6 text-center text-xs'>
                {t('No conversations')}
              </div>
            ) : (
              <div className='space-y-1'>
                {sessions.map((session) => {
                  const active = session.id === activeSessionId
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'group flex items-center gap-1 rounded-md px-1 py-1',
                        active ? 'bg-accent' : 'hover:bg-muted/60'
                      )}
                    >
                      {renamingId === session.id ? (
                        <Input
                          autoFocus
                          className='h-8 flex-1 text-xs'
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(event.target.value)
                          }
                          onBlur={() => submitRename(session)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') submitRename(session)
                            if (event.key === 'Escape') setRenamingId(null)
                          }}
                        />
                      ) : (
                        <button
                          type='button'
                          className='min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm'
                          onClick={() => onSelectSession(session)}
                        >
                          {session.title || t('New chat')}
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              aria-label={t('More actions')}
                              className='opacity-70 group-hover:opacity-100'
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-36'>
                          <DropdownMenuItem
                            onSelect={() => setRenamingId(session.id)}
                          >
                            <Edit3 />
                            {t('Rename')}
                          </DropdownMenuItem>
                          {session.archived ? (
                            <DropdownMenuItem
                              onSelect={() => onUnarchiveSession(session)}
                            >
                              <ArchiveRestore />
                              {t('Unarchive')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => onArchiveSession(session)}
                            >
                              <Archive />
                              {t('Archive')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant='destructive'
                            onSelect={() => onDeleteSession(session)}
                          >
                            <Trash2 />
                            {t('Delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
