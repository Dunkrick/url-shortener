import { apiRequest } from '../../lib/api-client'

interface StatsResponse {
  total_redirects: number
}

export function getStats(): Promise<StatsResponse> {
  return apiRequest<StatsResponse>('/api/v1/stats', {
    method: 'GET',
  })
}