import fs from 'fs'
import path from 'path'

export default function InlineStyles() {
  const file = path.join(process.cwd(), 'src', 'app', 'uxdsl.css')
  let css = ''
  try {
    css = fs.readFileSync(file, 'utf8')
  } catch (e) {
    // In dev, ensure prebuild ran. Fallback to empty to avoid crashing.
    css = ''
  }
  return <style id="uxdsl-bundle" data-uxdsl dangerouslySetInnerHTML={{ __html: css }} />
}

