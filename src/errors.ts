export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/**
 * A registry read that failed for want of credentials, rather than for any reason retrying
 * would fix. npm-registry-fetch carries the status on the error; the message is the fallback
 * for errors that reach us already flattened to a string.
 */
export function isAuthError(err: unknown): boolean {
  const status = (err as { statusCode?: number } | undefined)?.statusCode
  if (status === 401 || status === 403) return true
  const code = (err as { code?: string } | undefined)?.code
  if (code === 'E401' || code === 'E403' || code === 'ENEEDAUTH') return true
  return /\b(401|403)\b|ENEEDAUTH/.test(errorMessage(err))
}
