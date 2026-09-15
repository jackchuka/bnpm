export interface InteractiveInput {
  stdinTTY: boolean
  stdoutTTY: boolean
  env: NodeJS.ProcessEnv
}

// CI runners sometimes attach a pseudo-TTY, so the TTY check alone is not enough.
const CI_VARS = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'BUILDKITE',
  'CIRCLECI',
  'TF_BUILD',
  'JENKINS_URL',
]

export function isInteractive({ stdinTTY, stdoutTTY, env }: InteractiveInput): boolean {
  if (!stdinTTY || !stdoutTTY) return false
  if (env.BNPM_PLAIN === '1') return false
  if (env.TERM === 'dumb') return false
  return !CI_VARS.some((v) => Boolean(env[v]))
}
