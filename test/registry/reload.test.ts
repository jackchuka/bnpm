import { afterEach, describe, expect, test } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFlatOptions } from '../../src/registry/client.ts'

const KEY = '//registry.npmjs.org/:_authToken'
const dirs: string[] = []
const before = process.env.npm_config_userconfig

afterEach(() => {
  if (before === undefined) delete process.env.npm_config_userconfig
  else process.env.npm_config_userconfig = before
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function npmrcWith(token: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'bnpm-npmrc-'))
  dirs.push(dir)
  const file = join(dir, '.npmrc')
  writeFileSync(file, `${KEY}=${token}\n`)
  return file
}

describe('loadFlatOptions', () => {
  /**
   * `mine` rebuilds the registry after a login. That only helps if the config is read again
   * rather than memoised, so a token written after the first call has to win.
   */
  test('reads the npmrc again rather than reusing the first token', async () => {
    process.env.npm_config_userconfig = npmrcWith('stale-token')
    expect((await loadFlatOptions())[KEY]).toBe('stale-token')

    process.env.npm_config_userconfig = npmrcWith('fresh-token')
    expect((await loadFlatOptions())[KEY]).toBe('fresh-token')
  })
})
