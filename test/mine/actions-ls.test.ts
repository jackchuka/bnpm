import { expect, test } from 'vitest'
import { buildArgv } from '../../src/mine/actions.ts'

test('dist-tag ls builds the listing command', () => {
  expect(buildArgv({ kind: 'dist-tag-ls', pkg: '@s/a' })).toEqual(['dist-tag', 'ls', '@s/a'])
})
