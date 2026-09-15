import surface from '../styles/panel-surface.module.css';
import button from '../styles/panel-button.module.css';
import input from '../styles/panel-input.module.css';
import border from '../styles/panel-border.module.css';

// Every generated class from all four panels is referenced here so
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
    </main>
  );
}
