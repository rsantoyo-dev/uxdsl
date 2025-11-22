export default function TypographyPage() {
  return (
    <main className="main">
      <div className="container">
        <h1 className="section-title">Typography</h1>
        <div className="demo-section">
          <h1 className="ds-typo" data-typo="h1">Heading 1</h1>
          <h2 className="ds-typo" data-typo="h2">Heading 2</h2>
          <h3 className="ds-typo" data-typo="h3">Heading 3</h3>
          <h4 className="ds-typo" data-typo="h4">Heading 4</h4>
          <h5 className="ds-typo" data-typo="h5">Heading 5</h5>
          <h6 className="ds-typo" data-typo="h6">Heading 6</h6>
          <p className="ds-typo" data-typo="p">Body text paragraph showing default size and line height.</p>
          <small className="ds-typo" data-typo="small">Small caption text</small>
          <pre className="ds-typo" data-typo="pre">pre/code sample</pre>
        </div>
      </div>
    </main>
  )
}

