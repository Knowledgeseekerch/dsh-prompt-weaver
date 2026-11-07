import { isPlainObject } from './utils.js'

export class PromptWeaverError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'PromptWeaverError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

export function failure(code, message, details) {
  return Object.freeze({
    ok: false,
    reason: code,
    message,
    ...(details === undefined ? {} : { details }),
  })
}

export function success(value) {
  return Object.freeze({ ok: true, value })
}

export function normalizeError(error) {
  if (error instanceof PromptWeaverError) {
    return failure(error.code, error.message, error.details)
  }
  if (error?.name === 'AbortError') {
    return failure('aborted', 'The request was cancelled.')
  }
  if (isPlainObject(error) && typeof error.code === 'string' && typeof error.message === 'string') {
    return failure(error.code, error.message)
  }
  return failure('internal-error', error?.message ?? 'Unexpected internal error.')
}
