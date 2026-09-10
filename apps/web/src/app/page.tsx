export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <a
          className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight text-[var(--color-navy)]"
          href="#inicio"
        >
          Hire<span className="text-[var(--color-primary)]">Pair</span>
        </a>
        <a
          className="text-sm font-semibold text-[var(--color-navy)] underline-offset-4 hover:underline"
          href="#como-funciona"
        >
          Conheça a proposta
        </a>
      </header>

      <section
        className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28 lg:pt-20"
        id="inicio"
      >
        <div>
          <p className="mb-5 inline-flex rounded-full bg-[var(--color-success-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-success)]">
            Estamos preparando o lançamento
          </p>
          <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--color-navy)] sm:text-6xl">
            Um currículo claro para abrir portas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
            O HirePair está construindo uma forma simples de organizar suas experiências e
            transformar sua história profissional em um currículo pronto para novas oportunidades.
          </p>
          <a
            className="mt-8 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-3 font-[family-name:var(--font-heading)] text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[var(--color-primary-hover)]"
            href="#como-funciona"
          >
            Veja o que estamos criando
          </a>
        </div>

        <div
          aria-hidden="true"
          className="rounded-[2rem] border border-[rgba(37,38,38,0.12)] bg-white p-5 shadow-[0_24px_60px_-24px_rgba(51,51,100,0.35)] sm:p-7"
        >
          <div className="rounded-2xl border border-[rgba(37,38,38,0.12)] bg-[var(--color-creme)] p-6">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded-full bg-[var(--color-light)]" />
              <div className="h-8 w-8 rounded-full bg-[var(--color-pink)]" />
            </div>
            <div className="mt-8 space-y-4">
              <div className="h-4 w-3/4 rounded-full bg-[var(--color-navy)]" />
              <div className="h-3 w-full rounded-full bg-[var(--color-creme-deep)]" />
              <div className="h-3 w-5/6 rounded-full bg-[var(--color-creme-deep)]" />
            </div>
            <div className="mt-8 border-l-2 border-[var(--color-primary)] pl-4">
              <div className="h-3 w-32 rounded-full bg-[var(--color-primary)]" />
              <div className="mt-3 h-3 w-full rounded-full bg-[var(--color-creme-deep)]" />
              <div className="mt-2 h-3 w-4/5 rounded-full bg-[var(--color-creme-deep)]" />
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-y border-[rgba(37,38,38,0.12)] bg-[var(--color-creme-deep)]"
        id="como-funciona"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:py-20">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            O que estamos criando
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--color-navy)] sm:text-4xl">
            Menos confusão para contar bem a sua trajetória.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className="rounded-3xl border border-[rgba(37,38,38,0.12)] bg-white p-6">
              <p className="text-2xl" aria-hidden="true">
                01
              </p>
              <h2 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-navy)]">
                Passo a passo, sem complicação
              </h2>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">
                Perguntas claras ajudam a reunir experiências, competências e objetivos
                profissionais.
              </p>
            </article>
            <article className="rounded-3xl border border-[rgba(37,38,38,0.12)] bg-white p-6">
              <p className="text-2xl" aria-hidden="true">
                02
              </p>
              <h2 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-navy)]">
                Feito para processos seletivos
              </h2>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">
                Uma estrutura simples para deixar as informações legíveis para pessoas e sistemas de
                seleção.
              </p>
            </article>
            <article className="rounded-3xl border border-[rgba(37,38,38,0.12)] bg-white p-6">
              <p className="text-2xl" aria-hidden="true">
                03
              </p>
              <h2 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-navy)]">
                Seu currículo pronto para compartilhar
              </h2>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">
                A proposta é facilitar a criação de um currículo que você possa enviar com
                confiança.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-[var(--color-text-muted)] sm:px-10">
        <p>HirePair · Construindo caminhos mais claros para o próximo trabalho.</p>
      </footer>
    </main>
  );
}
