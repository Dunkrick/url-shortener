import { env } from '../config/env'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new Error(
      'Unable to reach the server. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError(
        'Too many requests. Please wait a minute before trying again.',
        429,
      )
    }

    if (response.status >= 500) {
      throw new ApiError(
        'Our server is having trouble. Please try again shortly.',
        response.status,
      )
    }

    throw new ApiError(
      response.status === 400
        ? 'Please enter a valid URL.'
        : `Request failed (${response.status}). Please try again.`,
      response.status,
    )
  }

  return response.json() as Promise<T>
}