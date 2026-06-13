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
import * as z from 'zod'
import type { Resolver, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { uploadContactAsset } from '../api'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const contactInfoSchema = z.object({
  contact: z.object({
    wechat_qr_image: z.string().optional(),
    support_qr_image: z.string().optional(),
    wechat_id: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
})

type ContactInfoFormValues = z.infer<typeof contactInfoSchema>

type ContactInfoSectionProps = {
  defaultValues: ContactInfoFormValues
}

type QRImageUploadFieldProps = {
  form: UseFormReturn<ContactInfoFormValues>
  name: 'contact.wechat_qr_image' | 'contact.support_qr_image'
  fieldKey: 'wechat_qr_image' | 'support_qr_image'
  label: string
  description: string
}

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

function QRImageUploadField(props: QRImageUploadFieldProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (
    file: File | undefined,
    onChange: (value: string) => void
  ) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('Only image files are allowed'))
      return
    }
    setUploading(true)
    try {
      const response = await uploadContactAsset(props.fieldKey, file)
      const url = response.data?.url
      if (!response.success || !url) {
        throw new Error(response.message || t('Upload failed'))
      }
      onChange(url)
      props.form.setValue(props.name, url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      toast.success(t('Image uploaded successfully'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Upload failed'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => {
        const value = normalizeValue(field.value)
        return (
          <FormItem>
            <FormLabel>{props.label}</FormLabel>
            <FormControl>
              <div className='space-y-3'>
                <input
                  ref={inputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0], field.onChange)
                  }
                />
                <div className='border-border bg-muted/20 flex aspect-square max-w-64 items-center justify-center overflow-hidden rounded-lg border'>
                  {value ? (
                    <img
                      src={value}
                      alt={props.label}
                      className='h-full w-full object-contain'
                    />
                  ) : (
                    <div className='text-muted-foreground flex flex-col items-center gap-2 text-sm'>
                      <ImageIcon className='size-8' />
                      <span>{t('No image uploaded')}</span>
                    </div>
                  )}
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <Upload />
                    )}
                    {uploading ? t('Uploading...') : t('Upload image')}
                  </Button>
                  {value ? (
                    <Button
                      type='button'
                      variant='ghost'
                      onClick={() => {
                        field.onChange('')
                        props.form.setValue(props.name, '', {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }}
                      disabled={uploading}
                    >
                      <Trash2 />
                      {t('Remove')}
                    </Button>
                  ) : null}
                </div>
                <Input
                  placeholder={t('Image URL will be filled after upload')}
                  value={value}
                  onChange={field.onChange}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </div>
            </FormControl>
            <FormDescription>{props.description}</FormDescription>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export function ContactInfoSection({ defaultValues }: ContactInfoSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const normalizedDefaults: ContactInfoFormValues = {
    contact: {
      wechat_qr_image: normalizeValue(defaultValues.contact?.wechat_qr_image),
      support_qr_image: normalizeValue(defaultValues.contact?.support_qr_image),
      wechat_id: normalizeValue(defaultValues.contact?.wechat_id),
      email: normalizeValue(defaultValues.contact?.email),
    },
  }

  const schemaWithI18n = z.object({
    contact: z.object({
      wechat_qr_image: z.string().optional(),
      support_qr_image: z.string().optional(),
      wechat_id: z.string().optional(),
      email: z
        .string()
        .email({ error: () => t('Please enter a valid email address') })
        .optional()
        .or(z.literal('')),
    }),
  })

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<ContactInfoFormValues>({
      resolver: zodResolver(schemaWithI18n) as Resolver<
        ContactInfoFormValues,
        unknown,
        ContactInfoFormValues
      >,
      defaultValues: normalizedDefaults,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: normalizeValue(value),
          })
        }
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('Contact Information')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting || updateOption.isPending}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            <SettingsFormGrid>
              <QRImageUploadField
                form={form}
                name='contact.wechat_qr_image'
                fieldKey='wechat_qr_image'
                label={t('Business QR Code')}
                description={t(
                  'Upload the business QR code image saved on the server.'
                )}
              />
              <QRImageUploadField
                form={form}
                name='contact.support_qr_image'
                fieldKey='support_qr_image'
                label={t('Customer Service QR Code')}
                description={t(
                  'Upload the customer service QR code image saved on the server.'
                )}
              />
              <SettingsFormGridItem>
                <FormField
                  control={form.control}
                  name='contact.wechat_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Business Contact ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Enter business contact ID')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Business contact information saved for frontend display.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SettingsFormGridItem>
              <SettingsFormGridItem>
                <FormField
                  control={form.control}
                  name='contact.email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Contact Email')}</FormLabel>
                      <FormControl>
                        <Input
                          type='email'
                          placeholder={t('support@example.com')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Customer service information saved for frontend display.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SettingsFormGridItem>
            </SettingsFormGrid>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
