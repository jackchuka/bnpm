import semver from 'semver'
import validateName from 'validate-npm-package-name'

export type CustomKind = 'range' | 'version' | 'tag' | 'package' | 'user'

export function validateCustom(kind: CustomKind, value: string): string | undefined {
  const v = value.trim()
  if (!v) return 'required'
  switch (kind) {
    case 'range':
      return semver.validRange(v) ? undefined : 'not a valid semver range'
    case 'version':
      return semver.valid(v) ? undefined : 'not a valid version'
    case 'tag':
      if (semver.valid(v) || semver.validRange(v) === v) return 'a tag cannot look like a version'
      return /^[\w.-]+$/.test(v) ? undefined : 'not a valid tag name'
    case 'package':
      return validateName(v).validForNewPackages || validateName(v).validForOldPackages
        ? v === v.toLowerCase()
          ? undefined
          : 'not a valid package name'
        : 'not a valid package name'
    case 'user':
      return /^[a-z0-9][a-z0-9._-]*$/i.test(v) ? undefined : 'not a valid username'
  }
}
