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
import { useRef, useState } from 'react'
import type { FileUIPart } from 'ai'
import {
  FileIcon,
  ImageIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { ModelOption, GroupOption } from '../types'

interface PlaygroundInputProps {
  onSubmit: (text: string, files?: FileUIPart[]) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  capabilities?: {
    visionEnabled?: boolean
    fileUploadEnabled?: boolean
    webSearchEnabled?: boolean
  }
}

const suggestions = [
  { icon: BarChartIcon, textKey: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, textKey: 'Surprise me', color: '#76d0eb' },
  { icon: NotepadTextIcon, textKey: 'Summarize text', color: '#ea8444' },
  { icon: CodeSquareIcon, textKey: 'Code', color: '#6c71ff' },
  { icon: GraduationCapIcon, textKey: 'Get advice', color: '#76d0eb' },
  { icon: null, textKey: 'More' },
]

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  capabilities,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const handleSubmit = (message: PromptInputMessage) => {
    if ((!message.text?.trim() && !message.files?.length) || disabled) return
    onSubmit(message.text || '', message.files)
    setText('')
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        groupClassName='rounded-xl'
        maxFiles={8}
        multiple
        onError={(error) => toast.error(error.message)}
        onSubmit={handleSubmit}
      >
        <div className='flex flex-wrap gap-2 px-3 pt-3'>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
        </div>
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='px-5 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <WorkbenchInputTools
            disabled={disabled}
            capabilities={capabilities}
          />

          <div className='flex items-center gap-1.5 md:gap-2'>
            <ModelGroupSelector
              selectedModel={modelValue}
              models={models}
              onModelChange={onModelChange}
              selectedGroup={groupValue}
              groups={groups}
              onGroupChange={onGroupChange}
              disabled={isModelSelectDisabled || isGroupSelectDisabled}
            />

            <WorkbenchSubmitButton
              disabled={disabled}
              isGenerating={isGenerating}
              onStop={onStop}
              text={text}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>

      <Suggestions>
        {suggestions.map(({ icon: Icon, textKey, color }) => {
          const text = t(textKey)
          return (
            <Suggestion
              className={`text-xs font-normal sm:text-sm ${
                textKey === 'More' ? 'hidden sm:flex' : ''
              }`}
              key={textKey}
              onClick={() => handleSuggestionClick(text)}
              suggestion={text}
            >
              {Icon && <Icon size={16} style={{ color }} />}
              {text}
            </Suggestion>
          )
        })}
      </Suggestions>
    </div>
  )
}

function WorkbenchInputTools({
  disabled,
  capabilities,
}: {
  disabled?: boolean
  capabilities?: {
    visionEnabled?: boolean
    fileUploadEnabled?: boolean
    webSearchEnabled?: boolean
  }
}) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    attachments.add(files)
  }

  const showImage = capabilities?.visionEnabled ?? true
  const showFile = capabilities?.fileUploadEnabled ?? true
  const showSearch = capabilities?.webSearchEnabled ?? true

  return (
    <PromptInputTools>
      <input
        accept='image/*'
        className='hidden'
        multiple
        onChange={(event) => {
          addFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
        ref={imageInputRef}
        type='file'
      />
      <input
        className='hidden'
        multiple
        onChange={(event) => {
          addFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
        ref={fileInputRef}
        type='file'
      />
      {showImage && (
        <PromptInputButton
          className='border font-medium'
          disabled={disabled}
          onClick={() => imageInputRef.current?.click()}
          variant='outline'
        >
          <ImageIcon size={16} />
          <span>{t('Image')}</span>
        </PromptInputButton>
      )}
      {showFile && (
        <PromptInputButton
          className='border font-medium'
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          variant='outline'
        >
          <FileIcon size={16} />
          <span>{t('File')}</span>
        </PromptInputButton>
      )}
      {showSearch && (
        <PromptInputButton
          className='border font-medium'
          disabled={disabled}
          onClick={() => toast.info(t('Search feature in development'))}
          variant='outline'
        >
          <GlobeIcon size={16} />
          <span>{t('Search')}</span>
        </PromptInputButton>
      )}
    </PromptInputTools>
  )
}

function WorkbenchSubmitButton({
  disabled,
  isGenerating,
  onStop,
  text,
}: {
  disabled?: boolean
  isGenerating?: boolean
  onStop?: () => void
  text: string
}) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()
  const canSubmit = text.trim().length > 0 || attachments.files.length > 0

  if (isGenerating && onStop) {
    return (
      <PromptInputButton
        className='text-foreground font-medium'
        onClick={onStop}
        variant='secondary'
      >
        <SquareIcon className='fill-current' size={16} />
        <span className='hidden sm:inline'>{t('Stop')}</span>
        <span className='sr-only sm:hidden'>{t('Stop')}</span>
      </PromptInputButton>
    )
  }

  return (
    <PromptInputButton
      className='text-foreground font-medium'
      disabled={disabled || !canSubmit}
      type='submit'
      variant='secondary'
    >
      <SendIcon size={16} />
      <span className='hidden sm:inline'>{t('Send')}</span>
      <span className='sr-only sm:hidden'>{t('Send')}</span>
    </PromptInputButton>
  )
}
