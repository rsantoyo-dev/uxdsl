// MIG-B7-17 (FEAT-009), phase C: real `uxdsl` output.
//
// Nothing here is typed by hand. scripts/capture-capabilities.js runs the CLI against
// capability-fixtures/cli-project and writes src/generated/cli-captures.json; `npm test`
// re-runs it with --check, so when the CLI starts printing something else these panels
// fail the build of the test suite instead of going stale.

import captures from '@/generated/cli-captures.json'

type Run = {
  id: string
  title: string
  argv: string[]
  exit: number
  stdout?: string
  stderr?: string
  files?: Record<string, string>
  facts?: Record<string, unknown>
  excerpt?: string
}

const runs = captures.runs as Run[]
const byId = (id: string) => runs.find((r) => r.id === id)

function Exit({ code }: { code: number }) {
  return <span className={code === 0 ? 'cap-exit cap-exit--ok' : 'cap-exit cap-exit--fail'}>exit {code}</span>
}

export function CliRun({ id }: { id: string }) {
  const run = byId(id)
  if (!run) throw new Error(`no captured CLI run "${id}" — re-run scripts/capture-capabilities.js`)
  const out = (run.stdout || '').trimEnd()
  const err = (run.stderr || '').trimEnd()
  return (
    <figure className="cap-run" data-cli-run={run.id}>
      <figcaption className="cap-run__title">{run.title} <Exit code={run.exit} /></figcaption>
      <pre className="cap-terminal"><code><span className="cap-terminal__prompt">$ uxdsl {run.argv.join(' ')}</span>{out ? `\n${out}` : ''}{err ? <span className="cap-terminal__err">{`\n${err}`}</span> : null}</code></pre>
      {run.excerpt && (<>
        <p className="cap-note">stdout is a JSON document{run.facts?.bytes ? ` of ${String(run.facts.bytes)} bytes` : ''}; an excerpt:</p>
        <pre className="cap-terminal"><code>{run.excerpt}</code></pre>
      </>)}
      {run.files && Object.entries(run.files).map(([file, text]) => (
        <div key={file}><p className="cap-note">It wrote <code>{file}</code>:</p><pre className="cap-terminal"><code>{text.trimEnd()}</code></pre></div>
      ))}
      {run.facts && !run.excerpt && Object.keys(run.facts).length > 0 && (
        <dl className="cap-facts">{Object.entries(run.facts).map(([k, v]) => <div key={k} className="cap-facts__row"><dt>{k}</dt><dd><code>{typeof v === 'string' ? v : JSON.stringify(v)}</code></dd></div>)}</dl>
      )}
    </figure>
  )
}

export function CliFacts({ id }: { id: string }) {
  const run = byId(id)
  if (!run?.facts) return null
  return <dl className="cap-facts">{Object.entries(run.facts).map(([k, v]) => <div key={k} className="cap-facts__row"><dt>{k}</dt><dd><code>{typeof v === 'string' ? v : JSON.stringify(v)}</code></dd></div>)}</dl>
}

export function CliProjectFiles() {
  return (
    <div className="cap-grid">
      {Object.entries(captures.project as Record<string, string>).map(([file, text]) => (
        <figure key={file} className="cap-run">
          <figcaption className="cap-run__title"><code>{file}</code></figcaption>
          <pre className="cap-terminal"><code>{text.trimEnd()}</code></pre>
        </figure>
      ))}
    </div>
  )
}

export function WatchTranscript() {
  const { watch } = captures as unknown as { watch: { steps: { action: string; output: string[] }[] } }
  return (
    <ol className="cap-transcript" data-cli-run="watch">
      {watch.steps.map((step) => (
        <li key={step.action}>
          <p className="cap-run__title">{step.action}</p>
          <pre className="cap-terminal"><code>{step.output.map((line, i) => line.startsWith('! ')
            ? <span key={i} className="cap-terminal__err">{`${line.slice(2)}\n`}</span>
            : `${line}\n`)}</code></pre>
        </li>
      ))}
    </ol>
  )
}
