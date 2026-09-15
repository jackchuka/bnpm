import type { Shim } from '../route.ts'
import { execNpm } from '../npm/exec.ts'

export async function runShim(shim: Shim, argv: string[]): Promise<number> {
  switch (shim) {
    case 'run':
      return (await import('./run.ts')).runShim(argv)
    case 'uninstall':
      return (await import('./uninstall.ts')).uninstallShim(argv)
    case 'update':
      return (await import('./update.ts')).updateShim(argv)
    case 'deprecate':
      return (await import('./registry-shims.ts')).deprecateShim(argv)
    case 'dist-tag':
      return (await import('./registry-shims.ts')).distTagShim(argv)
    case 'owner':
      return (await import('./registry-shims.ts')).ownerShim(argv)
    case 'access':
      return (await import('./registry-shims.ts')).accessShim(argv)
    case 'view':
      return (await import('./registry-shims.ts')).viewShim(argv)
    case 'exec':
      return (await import('./exec.ts')).execShim(argv)
    case 'link':
      return (await import('./link.ts')).linkShim(argv)
    case 'unlink':
      return (await import('./link.ts')).unlinkShim(argv)
    case 'open':
      return (await import('./web.ts')).openShim(argv)
    default:
      return execNpm(argv)
  }
}
