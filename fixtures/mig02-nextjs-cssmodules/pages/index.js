import surface from '../styles/panel-surface.module.css';
import button from '../styles/panel-button.module.css';
import input from '../styles/panel-input.module.css';
import border from '../styles/panel-border.module.css';
// Built by the uxdsl CLI from styles/panel.module.uxdsl (uxdsl-cli/uxdsl.config.cjs).
import panel from '../styles/panel.generated.module.css';

// Every generated class of the five panel modules is referenced here so
// webpack/Next.js actually runs each .module.css file through css-loader
// during the build, instead of it being an unused, dead import.
export default function Home() {
  return (
    <main>
      <section className={surface.card}>
        <h1 className={surface.title}>MIG-02</h1>
        <div className={surface.notice} />
        <div className={surface.flat} />
      </section>
      <section>
        <button className={button.btn}>ok</button>
        <button className={button['btn-outline']}>ok</button>
        <button className={button['btn-flat']}>ok</button>
        <span className={button.label} />
      </section>
      <section className={input.field}>
        <div className={input['field-underline']} />
        <div className={input['field-contained']} />
        <span className={input.hint} />
      </section>
      <section className={border.box}>
        <div className={border['box-strong']} />
        <hr className={border.divider} />
        <span className={border.muted} />
      </section>
      <section id="cli-panel" className={panel.panel}>
        <h2 id="cli-panel-title" className={panel.panel__title}>CLI-built module</h2>
        <p id="cli-panel-body">Body</p>
      </section>
    </main>
  );
}
