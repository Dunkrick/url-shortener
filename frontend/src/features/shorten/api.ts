import { apiRequest } from '../../lib/api-client'
import type { ShortenUrlRequest, ShortenUrlResponse } from './types'

export function shortenUrl(
  request: ShortenUrlRequest,
): Promise<ShortenUrlResponse> {
  return apiRequest<ShortenUrlResponse>('/api/v1/urls', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}