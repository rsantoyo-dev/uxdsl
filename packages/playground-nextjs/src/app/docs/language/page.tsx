import { LANGUAGE_COMPLETIONS } from 'uxdsl/language'
import { PageTitle } from '@/components/PageTitle'

export const metadata = { title: 'Language' }

export default function LanguagePage() {
  return (
    <>
      <PageTitle title="Language" subtitle="Every value function and directive a .uxdsl file can use." />
      <div className="doc-section">
        <h2>Value functions</h2>
        <ul>{LANGUAGE_COMPLETIONS.functions.map((name) => <li key={name}><code>{name}()</code></li>)}</ul>
        <h2>Directives</h2>
        <ul>{LANGUAGE_COMPLETIONS.directives.map((name) => <li key={name}><code>@{name}()</code></li>)}</ul>
      </div>
    </>
  )
}
