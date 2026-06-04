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
import { api } from '@/lib/api'
import type {
  ConfirmPaymentComplianceResponse,
  ContactAssetUploadResponse,
  DataMaintenanceCleanupRequest,
  DataMaintenanceCleanupResponse,
  DataMaintenanceLogsResponse,
  DataMaintenanceSettings,
  DataMaintenanceSettingsResponse,
  DeleteLogsResponse,
  FetchUpstreamRatiosRequest,
  SystemOptionsResponse,
  UpdateOptionRequest,
  UpdateOptionResponse,
  UpstreamChannelsResponse,
  UpstreamRatiosResponse,
} from './types'

export async function getSystemOptions() {
  const res = await api.get<SystemOptionsResponse>('/api/option/')
  return res.data
}

export async function updateSystemOption(request: UpdateOptionRequest) {
  const res = await api.put<UpdateOptionResponse>('/api/option/', request)
  return res.data
}

export async function uploadContactAsset(field: string, file: File) {
  const formData = new FormData()
  formData.append('field', field)
  formData.append('file', file)
  const res = await api.post<ContactAssetUploadResponse>(
    '/api/option/contact-assets',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return res.data
}

export async function confirmPaymentCompliance() {
  const res = await api.post<ConfirmPaymentComplianceResponse>(
    '/api/option/payment_compliance',
    { confirmed: true }
  )
  return res.data
}

export async function deleteLogsBefore(targetTimestamp: number) {
  const res = await api.delete<DeleteLogsResponse>('/api/log/', {
    params: { target_timestamp: targetTimestamp },
  })
  return res.data
}

export async function getDataMaintenanceSettings() {
  const res = await api.get<DataMaintenanceSettingsResponse>(
    '/api/data-maintenance/settings'
  )
  return res.data
}

export async function updateDataMaintenanceSettings(
  settings: DataMaintenanceSettings
) {
  const res = await api.put<DataMaintenanceSettingsResponse>(
    '/api/data-maintenance/settings',
    settings
  )
  return res.data
}

export async function runDataMaintenanceCleanup(
  request: DataMaintenanceCleanupRequest
) {
  const res = await api.post<DataMaintenanceCleanupResponse>(
    '/api/data-maintenance/cleanup',
    request
  )
  return res.data
}

export async function getDataMaintenanceLogs(limit = 20) {
  const res = await api.get<DataMaintenanceLogsResponse>(
    '/api/data-maintenance/logs',
    { params: { limit } }
  )
  return res.data
}

export async function resetModelRatios() {
  const res = await api.post<UpdateOptionResponse>(
    '/api/option/rest_model_ratio'
  )
  return res.data
}

export async function getUpstreamChannels() {
  const res = await api.get<UpstreamChannelsResponse>(
    '/api/ratio_sync/channels'
  )
  return res.data
}

export async function fetchUpstreamRatios(request: FetchUpstreamRatiosRequest) {
  const res = await api.post<UpstreamRatiosResponse>(
    '/api/ratio_sync/fetch',
    request
  )
  return res.data
}
