import { NPM_URL } from '@/lib/docs'

// The version these pages are built from (next.config.js inlines it from
// packages/uxdsl/package.json), stated plainly instead of a warning banner.
const VERSION = process.env.UXDSL_VERSION || ''

export default function VersionLine() {
  const prerelease = VERSION.includes('-')
  return (
    <p className="version-line">
      These pages document <a href={`${NPM_URL}/v/${VERSION}`} target="_blank" rel="noopener noreferrer"><code>uxdsl@{VERSION}</code></a>.
      {prerelease
        ? ' It is a pre-release: an API can still change before 1.0.0, and every change is in the package CHANGELOG.'
        : ' It follows semantic versioning; uxdsl/engine is the one entry exempt from it.'}
    </p>
  )
}
