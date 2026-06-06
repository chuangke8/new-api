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
  ApiResponse,
  TaskCenterBatchStopResult,
  TaskCenterListParams,
  TaskCenterPage,
  TaskCenterRecord,
  TaskCenterStopResult,
} from './types'

export async function listTaskCenter(
  params: TaskCenterListParams
): Promise<ApiResponse<TaskCenterPage>> {
  const res = await api.get('/api/task-center/', {
    params,
    disableDuplicate: true,
  })
  return res.data
}

export async function getTaskCenterDetail(
  id: number
): Promise<ApiResponse<TaskCenterRecord>> {
  const res = await api.get(`/api/task-center/${id}`, {
    disableDuplicate: true,
  })
  return res.data
}

export async function updateTaskCenterRemark(
  id: number,
  remark: string
): Promise<ApiResponse<null>> {
  const res = await api.patch(`/api/task-center/${id}/remark`, { remark })
  return res.data
}

export async function stopTaskCenter(
  id: number
): Promise<ApiResponse<TaskCenterStopResult>> {
  const res = await api.post(`/api/task-center/${id}/stop`)
  return res.data
}

export async function batchStopTaskCenter(
  ids: number[]
): Promise<ApiResponse<TaskCenterBatchStopResult>> {
  const res = await api.post('/api/task-center/batch/stop', { ids })
  return res.data
}
