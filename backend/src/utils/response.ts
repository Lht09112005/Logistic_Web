import { Response } from 'express'

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  meta?: {
    total?: number
    page?: number
    limit?: number
    totalPages?: number
  }
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Thành công',
  statusCode = 200,
  meta?: ApiResponse['meta']
): Response => {
  const response: ApiResponse<T> = { success: true, message, data }
  if (meta) response.meta = meta
  return res.status(statusCode).json(response)
}

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown
): Response => {
  const response: ApiResponse = { success: false, message }
  if (errors) (response as any).errors = errors
  return res.status(statusCode).json(response)
}
