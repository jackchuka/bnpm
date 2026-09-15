import React from 'react'
import { openUrl } from '../open.ts'
import { render } from 'ink'
import { createRegistry, isNpmjs } from '../registry/client.ts'
import { rangeDownloads, weeklyDownloads } from '../registry/downloads.ts'
import { isAvailable, runInteractive } from '../npm/exec.ts'
import { commandLine, currentPm } from '../pm.ts'
import { App, initialUiState, type AppResult, type UiState } from './app.tsx'
import { renderPlain } from './plain.ts'
import { createStore, type MineSource, type MineStore } from './store.ts'
import { bnpmArgs } from '../route.ts'

const ALT_ON = '[?1049h[H'
const ALT_OFF = '[?1049l'

function waitForKey(prompt: string): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(`\n${prompt}`)
    const { stdin } = process
    // Ink unrefs stdin on unmount; without ref() the event loop would drain and the process exit here.
    stdin.ref()
    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.once('data', () => {
      stdin.setRawMode?.(false)
      stdin.pause()
      resolve()
    })
  })
}

/** `npm login`, aimed at the configured registry when it is not the public one. */
function loginArgv(registry: string, npmjs: boolean): string[] {
  return npmjs ? ['login'] : ['login', '--registry', registry]
}

function runApp(store: MineStore, state: UiState, npmjs: boolean): Promise<AppResult> {
  return new Promise((resolve) => {
    const instance = render(
      React.createElement(App, {
        store,
        state,
        openUrl,
        pm: currentPm(),
        npmAvailable: isAvailable('npm'),
        npmjs,
        columns: process.stdout.columns || 100,
        rows: process.stdout.rows || 30,
        onExit: (result) => {
          instance.unmount()
          resolve(result)
        },
      }),
      { exitOnCtrlC: false, patchConsole: false },
    )
  })
}

export async function mineCommand(argv: string[]): Promise<number> {
  const flags = bnpmArgs(argv)
  const json = flags.includes('--json')
  const plain = json || flags.includes('--plain') || !process.stdin.isTTY || !process.stdout.isTTY

  // Rebuilt after a login: the auth token is read once and captured by the closure below.
  let registry = await createRegistry()
  // Download counts come from api.npmjs.org, which only knows about the public registry.
  const npmjs = isNpmjs(registry.flat.registry)
  const source: MineSource = {
    whoami: () => registry.whoami(),
    userPackages: (u) => registry.userPackages(u),
    packument: (n) => registry.packument(n),
    weekly: (names) => (npmjs ? weeklyDownloads(names) : Promise.resolve(new Map())),
    range: (n) => (npmjs ? rangeDownloads(n) : Promise.resolve([])),
    visibility: (n) => registry.visibility(n),
  }
  const store = createStore(source)

  if (plain) {
    await store.load()
    process.stdout.write(
      json ? JSON.stringify(store.rows, null, 2) + '\n' : renderPlain(store.rows) + '\n',
    )
    return 0
  }

  let state = initialUiState()
  // The store publishes initial-load failures to the mounted UI.
  void store.load().catch(() => {})

  process.stdout.write(ALT_ON)
  try {
    for (;;) {
      const result = await runApp(store, state, npmjs)
      if (result.kind === 'quit') return 0
      process.stdout.write(ALT_OFF)
      // Logging in is the manager's own command, shown and handed off like every other write.
      const login = result.kind === 'login'
      const pm = login ? currentPm() : result.pm
      const next = login ? loginArgv(registry.flat.registry, npmjs) : result.argv
      const line = commandLine(next, pm)
      process.stdout.write(`$ ${line}\n`)
      const code = runInteractive(pm, next)
      if (login || result.wait || code !== 0) await waitForKey('press any key to return ')
      process.stdout.write(ALT_ON)
      state = {
        ...result.state,
        message:
          code === 0
            ? { text: line, ok: true }
            : { text: `${line} exited with ${code}`, ok: false },
      }
      if (login) {
        // login rewrote the npmrc, so the registry has to be rebuilt to pick up the new token.
        if (code === 0) registry = await createRegistry()
        // A fresh login changes who we are, so the whole list is reloaded rather than one row.
        void store.load().catch(() => {})
      } else void store.refresh(result.pkg)
    }
  } finally {
    process.stdout.write(ALT_OFF)
  }
}
