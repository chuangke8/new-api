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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FileUIPart } from 'ai'
import { Menu, MessageSquarePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  archiveWorkspaceChatSession,
  createWorkspaceChatMessage,
  createWorkspaceChatSession,
  deleteWorkspaceChatSession,
  getUserGroups,
  getWorkspaceChatMessages,
  getWorkspaceChatModels,
  getWorkspaceChatSessions,
  unarchiveWorkspaceChatSession,
  updateWorkspaceChatSession,
} from './api'
import { ChatSessionSidebar } from './components/chat-session-sidebar'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundInput } from './components/playground-input'
import { usePlaygroundState, useChatHandler } from './hooks'
import {
  createLoadingAssistantMessage,
  createMessageVersion,
  createUserMessage,
} from './lib'
import type {
  Message as MessageType,
  WorkspaceChatMessage,
  WorkspaceChatMessageMetadata,
  WorkspaceChatSession,
} from './types'

function parseMetadata(raw: string): WorkspaceChatMessageMetadata {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as WorkspaceChatMessageMetadata
  } catch {
    return {}
  }
}

function mapServerMessage(message: WorkspaceChatMessage): MessageType {
  const metadata = parseMetadata(message.metadata)
  return {
    key: metadata.key || `server-${message.id}`,
    from: message.role,
    versions: [createMessageVersion(message.content || '')],
    imageUrls: metadata.imageUrls,
    fileNames: metadata.fileNames,
    fileAttachments: metadata.fileAttachments,
    sources: metadata.sources,
    reasoning: metadata.reasoning,
    status: metadata.status || 'complete',
    errorCode: metadata.errorCode ?? null,
    isReasoningStreaming: false,
    isReasoningComplete: true,
    isContentComplete: true,
  }
}

function getMessageContent(message: MessageType) {
  return message.versions[0]?.content || ''
}

function isPersistableMessage(message: MessageType) {
  if (message.from === 'user') return true
  if (message.from !== 'assistant') return false
  return (
    message.status === 'complete' ||
    message.status === 'error' ||
    Boolean(getMessageContent(message).trim())
  )
}

export function Playground() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const {
    config,
    parameterEnabled,
    messages,
    models,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  // Edit dialog state
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [showArchivedSessions, setShowArchivedSessions] = useState(false)
  const [modelCategory, setModelCategory] = useState('')
  const [sessionsCollapsed, setSessionsCollapsed] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 768
  )
  const persistedMessageKeysRef = useRef(new Set<string>())
  const loadingSessionRef = useRef(false)
  const appliedMobileDefaultRef = useRef(false)

  // Load models
  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['workspace-chat-models'],
    queryFn: async () => {
      try {
        return await getWorkspaceChatModels()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground models')
        )
        return []
      }
    },
  })

  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['workspace-chat-sessions', showArchivedSessions],
    queryFn: async () =>
      (await getWorkspaceChatSessions(showArchivedSessions)).data || [],
  })

  const sessions = sessionsData || []

  const invalidateSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workspace-chat-sessions'] })
  }, [queryClient])

  const createSessionMutation = useMutation({
    mutationFn: (data: { title?: string; model?: string }) =>
      createWorkspaceChatSession(data),
    onSuccess: (res) => {
      invalidateSessions()
      if (res.data?.id) {
        persistedMessageKeysRef.current.clear()
        setActiveSessionId(res.data.id)
      }
    },
  })

  const renameSessionMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      updateWorkspaceChatSession(id, { title }),
    onSuccess: invalidateSessions,
  })

  const archiveSessionMutation = useMutation({
    mutationFn: (id: number) => archiveWorkspaceChatSession(id),
    onSuccess: invalidateSessions,
  })

  const unarchiveSessionMutation = useMutation({
    mutationFn: (id: number) => unarchiveWorkspaceChatSession(id),
    onSuccess: invalidateSessions,
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (id: number) => deleteWorkspaceChatSession(id),
    onSuccess: (_, id) => {
      if (activeSessionId === id) {
        setActiveSessionId(null)
        persistedMessageKeysRef.current.clear()
        updateMessages([])
      }
      invalidateSessions()
      toast.success(t('Conversation deleted'))
    },
  })

  const startNewSession = useCallback(() => {
    persistedMessageKeysRef.current.clear()
    setActiveSessionId(null)
    updateMessages([])
    createSessionMutation.mutate({
      title: t('New chat'),
      model: config.model,
    })
  }, [config.model, createSessionMutation, t, updateMessages])

  // Load groups
  const { data: groupsData } = useQuery({
    queryKey: ['playground-groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground groups')
        )
        return []
      }
    },
  })

  // Update models when data changes
  useEffect(() => {
    if (!modelsData) return

    setModels(modelsData)

    // Set default model if current model is not available
    const isCurrentModelValid = modelsData.some((m) => m.value === config.model)
    if (modelsData.length > 0 && !isCurrentModelValid) {
      updateConfig('model', modelsData[0].value)
    } else if (modelsData.length === 0 && config.model) {
      updateConfig('model', '')
    }
  }, [modelsData, config.model, setModels, updateConfig])

  const selectedModel = useMemo(
    () => models.find((model) => model.value === config.model),
    [config.model, models]
  )
  const modelCategoryOptions = useMemo(() => {
    const seen = new Set<string>()
    return models
      .map((model) => model.category || t('Other'))
      .filter((category) => {
        if (!category || seen.has(category)) return false
        seen.add(category)
        return true
      })
      .map((category) => ({
        label: category,
        value: category,
        ratio: 1,
      }))
  }, [models, t])
  const visibleModels = useMemo(
    () =>
      modelCategory
        ? models.filter((model) => (model.category || t('Other')) === modelCategory)
        : models,
    [modelCategory, models, t]
  )

  useEffect(() => {
    if (modelCategoryOptions.length === 0) {
      setModelCategory('')
      return
    }
    if (
      !modelCategory ||
      !modelCategoryOptions.some((item) => item.value === modelCategory)
    ) {
      setModelCategory(modelCategoryOptions[0].value)
    }
  }, [modelCategory, modelCategoryOptions])

  useEffect(() => {
    if (visibleModels.length === 0) return
    if (!visibleModels.some((item) => item.value === config.model)) {
      updateConfig('model', visibleModels[0].value)
    }
  }, [config.model, updateConfig, visibleModels])

  const loadSessionMessages = useCallback(
    async (session: WorkspaceChatSession) => {
      loadingSessionRef.current = true
      setActiveSessionId(session.id)
      if (isMobile) setSessionsCollapsed(true)
      updateConfig('model', session.model || config.model)
      try {
        const res = await getWorkspaceChatMessages(session.id)
        const serverMessages = (res.data || []).map(mapServerMessage)
        persistedMessageKeysRef.current = new Set(
          serverMessages.map((message) => message.key)
        )
        updateMessages(serverMessages)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load conversation')
        )
      } finally {
        loadingSessionRef.current = false
      }
    },
    [config.model, isMobile, t, updateConfig, updateMessages]
  )

  const ensureActiveSession = useCallback(async () => {
    if (activeSessionId) return activeSessionId
    const res = await createWorkspaceChatSession({
      title: t('New chat'),
      model: config.model,
    })
    const nextId = res.data.id
    setActiveSessionId(nextId)
    invalidateSessions()
    return nextId
  }, [activeSessionId, config.model, invalidateSessions, t])

  useEffect(() => {
    if (!activeSessionId || loadingSessionRef.current) return
    const pending = messages.filter(
      (message) =>
        !persistedMessageKeysRef.current.has(message.key) &&
        isPersistableMessage(message)
    )
    if (pending.length === 0) return

    pending.forEach((message) => {
      persistedMessageKeysRef.current.add(message.key)
      createWorkspaceChatMessage(activeSessionId, {
        role: message.from,
        content: getMessageContent(message),
        model: config.model,
        metadata: {
          key: message.key,
          imageUrls: message.imageUrls,
          fileNames: message.fileNames,
          fileAttachments: message.fileAttachments,
          status: message.status,
          errorCode: message.errorCode,
          reasoning: message.reasoning,
          sources: message.sources,
        },
      })
        .then(() => invalidateSessions())
        .catch(() => persistedMessageKeysRef.current.delete(message.key))
    })
  }, [activeSessionId, config.model, invalidateSessions, messages])

  // Update groups when data changes
  useEffect(() => {
    if (!groupsData) return

    setGroups(groupsData)

    const hasCurrentGroup = groupsData.some((g) => g.value === config.group)
    if (!hasCurrentGroup && groupsData.length > 0) {
      const fallback =
        groupsData.find((g) => g.value === 'default')?.value ??
        groupsData[0].value
      updateConfig('group', fallback)
    }
  }, [groupsData, setGroups, config.group, updateConfig])

  useEffect(() => {
    if (!isMobile || appliedMobileDefaultRef.current) return
    setSessionsCollapsed(true)
    appliedMobileDefaultRef.current = true
  }, [isMobile])

  const handleSendMessage = async (text: string, files: FileUIPart[] = []) => {
    const sessionId = await ensureActiveSession()
    const imageUrls = files
      .filter((file) => file.mediaType?.startsWith('image/') && file.url)
      .map((file) => file.url!)
    const fileNames = files
      .filter((file) => !file.mediaType?.startsWith('image/'))
      .map((file) => file.filename || t('Attachment'))
    const fileAttachments = files
      .filter((file) => !file.mediaType?.startsWith('image/') && file.url)
      .map((file) => ({
        filename: file.filename || t('Attachment'),
        fileData: file.url!,
        mediaType: file.mediaType,
      }))

    const userMessage = createUserMessage(
      text,
      imageUrls,
      fileNames,
      fileAttachments
    )
    const assistantMessage = createLoadingAssistantMessage()

    const newMessages = [...messages, userMessage, assistantMessage]
    persistedMessageKeysRef.current.add(userMessage.key)
    createWorkspaceChatMessage(sessionId, {
      role: userMessage.from,
      content: getMessageContent(userMessage),
      model: config.model,
      metadata: {
        key: userMessage.key,
        imageUrls: userMessage.imageUrls,
        fileNames: userMessage.fileNames,
        fileAttachments: userMessage.fileAttachments,
      },
    })
      .then(() => invalidateSessions())
      .catch(() => persistedMessageKeysRef.current.delete(userMessage.key))
    updateMessages(newMessages)

    // Send chat request
    sendChat(newMessages)
  }

  const handleCopyMessage = (message: MessageType) => {
    // Copy is handled in MessageActions component
    // eslint-disable-next-line no-console
    console.log('Message copied:', message.key)
  }

  const handleRegenerateMessage = (message: MessageType) => {
    // Find the message index and regenerate from there
    const messageIndex = messages.findIndex((m) => m.key === message.key)
    if (messageIndex === -1) return

    // Remove messages after this one and regenerate
    const messagesUpToHere = messages.slice(0, messageIndex)
    const loadingMessage = createLoadingAssistantMessage()
    const newMessages = [...messagesUpToHere, loadingMessage]

    updateMessages(newMessages)
    sendChat(newMessages)
  }

  const handleEditMessage = useCallback((message: MessageType) => {
    setEditingMessageKey(message.key)
  }, [])

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingMessageKey(null)
  }, [])

  // Apply edit and optionally re-submit from the edited user message
  const applyEdit = useCallback(
    (newContent: string, submit: boolean) => {
      if (!editingMessageKey) return
      const index = messages.findIndex((m) => m.key === editingMessageKey)
      if (index === -1) return

      const updated = messages.map((m) =>
        m.key === editingMessageKey
          ? { ...m, versions: [{ ...m.versions[0], content: newContent }] }
          : m
      )

      setEditingMessageKey(null)

      if (!submit || updated[index].from !== 'user') {
        updateMessages(updated)
        return
      }

      const toSubmit = [
        ...updated.slice(0, index + 1),
        createLoadingAssistantMessage(),
      ]
      updateMessages(toSubmit)
      sendChat(toSubmit)
    },
    [editingMessageKey, messages, updateMessages, sendChat]
  )

  const handleDeleteMessage = (message: MessageType) => {
    const newMessages = messages.filter((m) => m.key !== message.key)
    updateMessages(newMessages)
  }

  return (
    <div className='relative flex size-full overflow-hidden'>
      {!sessionsCollapsed && (
        <button
          type='button'
          aria-label={t('Collapse sessions')}
          className='fixed inset-0 z-20 bg-background/60 backdrop-blur-sm md:hidden'
          onClick={() => setSessionsCollapsed(true)}
        />
      )}
      <ChatSessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        archived={showArchivedSessions}
        collapsed={sessionsCollapsed}
        isLoading={isLoadingSessions}
        onArchivedChange={setShowArchivedSessions}
        onCollapsedChange={setSessionsCollapsed}
        onNewSession={startNewSession}
        onSelectSession={loadSessionMessages}
        onRenameSession={(session, title) =>
          renameSessionMutation.mutate({ id: session.id, title })
        }
        onArchiveSession={(session) =>
          archiveSessionMutation.mutate(session.id)
        }
        onUnarchiveSession={(session) =>
          unarchiveSessionMutation.mutate(session.id)
        }
        onDeleteSession={(session) => deleteSessionMutation.mutate(session.id)}
      />
      <div className='relative flex min-w-0 flex-1 flex-col overflow-hidden'>
        <div className='bg-background/95 border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 md:hidden'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('Expand sessions')}
            onClick={() => setSessionsCollapsed(false)}
          >
            <Menu />
          </Button>
          <div className='min-w-0 flex-1 truncate text-center text-sm font-medium'>
            {sessions.find((session) => session.id === activeSessionId)
              ?.title || t('New chat')}
          </div>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('New chat')}
            onClick={startNewSession}
          >
            <MessageSquarePlus />
          </Button>
        </div>
        {/* Full-width scroll container: scrolling works even over side whitespace */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          <PlaygroundChat
            messages={messages}
            onCopyMessage={handleCopyMessage}
            onRegenerateMessage={handleRegenerateMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            isGenerating={isGenerating}
            editingKey={editingMessageKey}
            onCancelEdit={handleEditOpenChange}
            onSaveEdit={(newContent) => applyEdit(newContent, false)}
            onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
          />
        </div>

        {/* Input area: center content and constrain to the same container width */}
        <div className='mx-auto w-full max-w-4xl px-2 pb-2 md:px-0 md:pb-0'>
          <PlaygroundInput
            disabled={isGenerating}
            isGenerating={isGenerating}
            isModelLoading={isLoadingModels}
            modelValue={config.model}
            models={visibleModels}
            modelCategories={modelCategoryOptions}
            modelCategoryValue={modelCategory}
            onModelCategoryChange={setModelCategory}
            onModelChange={(value) => updateConfig('model', value)}
            onStop={stopGeneration}
            onSubmit={handleSendMessage}
            capabilities={
              selectedModel
                ? {
                    visionEnabled: selectedModel.visionEnabled,
                    fileUploadEnabled: selectedModel.fileUploadEnabled,
                    webSearchEnabled: selectedModel.webSearchEnabled,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}
