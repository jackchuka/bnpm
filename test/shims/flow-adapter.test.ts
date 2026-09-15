import { describe, expect, test } from 'vitest'
import { driveFlow, type FlowPrompts } from '../../src/shims/flow-adapter.ts'
import { flow } from '../../src/mine/flows.ts'
import type { MineRow } from '../../src/mine/rows.ts'

const row: MineRow = {
  name: '@s/a',
  access: 'write',
  status: 'loaded',
  summary: {
    name: '@s/a',
    latest: '1.0.0',
    distTags: { latest: '1.0.0' },
    versions: [
      { version: '1.0.0', time: '2026-01-01T00:00:00Z', tags: ['latest'], deprecated: undefined },
    ],
    created: '2026-01-01T00:00:00Z',
    lastPublished: '2026-01-01T00:00:00Z',
    deprecatedCount: 0,
    latestDeprecated: false,
    maintainers: ['me'],
    description: undefined,
  },
}

function scripted(answers: string[]): FlowPrompts & { asked: string[] } {
  const asked: string[] = []
  const next = (kind: string, title: string) => {
    asked.push(`${kind}:${title}`)
    const a = answers.shift()
    if (a === undefined) throw new Error('no more answers')
    return Promise.resolve(a)
  }
  return {
    asked,
    pick: (title, choices) => next('pick', `${title}[${choices.map((c) => c.value).join(',')}]`),
    text: (title) => next('text', title),
    typed: (title, expected) => next('typed', `${title}=${expected}`),
  }
}

describe('driveFlow', () => {
  test('feeds prompt answers into the generator and returns the request', async () => {
    const prompts = scripted(['1.0.0', 'gone'])
    const result = await driveFlow(flow('deprecate', row, 'me'), prompts)
    expect(prompts.asked).toEqual(['pick:version[*,1.0.0]', 'text:message'])
    expect(result).toEqual({ kind: 'deprecate', pkg: '@s/a', version: '1.0.0', message: 'gone' })
  })

  test('typed confirmation is routed to the typed prompt', async () => {
    const prompts = scripted(['*', '@s/a'])
    const result = await driveFlow(flow('unpublish', row, 'me'), prompts)
    expect(prompts.asked[1]).toBe('typed:type @s/a to confirm=@s/a')
    expect(result).toEqual({ kind: 'unpublish', pkg: '@s/a', version: '*' })
  })
})

describe('driveFlow custom entry', () => {
  test('passes allowCustom through to the pick prompt', async () => {
    const seen: (string | undefined)[] = []
    const prompts: FlowPrompts = {
      pick: (_t, _c, allowCustom) => {
        seen.push(allowCustom)
        return Promise.resolve(seen.length === 1 ? '<1.0.0' : '')
      },
      text: () => Promise.resolve('msg'),
      typed: () => Promise.resolve(''),
    }
    await driveFlow(flow('deprecate', row, 'me'), prompts)
    expect(seen).toEqual(['range'])
  })
})
