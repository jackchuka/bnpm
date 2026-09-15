import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: false,
  fixedExtension: false,
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  publint: 'ci-only',
})
