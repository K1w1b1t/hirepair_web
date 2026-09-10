import Image from 'next/image';
import { Countdown } from './countdown';

const launchDate = '2026-10-31T00:00:00-03:00';
const whatsappUrl =
  'https://wa.me/551191365266?text=Ol%C3%A1%21%20Quero%20saber%20mais%20sobre%20o%20HirePair.';
const emailUrl = 'mailto:tech@kiwibit.com.br?subject=Quero%20conhecer%20o%20HirePair';

const benefits = [
  {
    number: '01',
    title: 'Passo a passo, sem complicação',
    description:
      'Perguntas claras ajudam a reunir experiências, competências e objetivos profissionais no seu ritmo.',
  },
  {
    number: '02',
    title: 'Feito para processos seletivos',
    description:
      'Uma estrutura simples para deixar as informações legíveis para pessoas e sistemas de seleção.',
  },
  {
    number: '03',
    title: 'Seu currículo pronto para compartilhar',
    description:
      'A proposta é facilitar a criação de um currículo que você possa enviar por WhatsApp ou e-mail com confiança.',
  },
];

const steps = [
  [
    'Conte sua trajetória',
    'Você responde perguntas simples sobre experiências, estudos e objetivos.',
  ],
  [
    'Organize o que importa',
    'O HirePair ajuda a transformar suas respostas em informações claras e relevantes.',
  ],
  [
    'Prepare-se para enviar',
    'Você revisa e gera um currículo limpo, pensado para processos seletivos.',
  ],
];

function Brand({
  compact = false,
  decorative = false,
}: {
  compact?: boolean;
  decorative?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image
        alt={decorative ? '' : 'HirePair'}
        className="h-auto shrink-0"
        height={compact ? 41 : 52}
        priority={!compact}
        src="/hirepair-logo.png"
        width={compact ? 34 : 43}
      />
      <span className="font-[family-name:var(--font-heading)] text-xl font-medium tracking-[0.01em] text-[var(--color-navy)]">
        hire<span className="font-extrabold text-[var(--color-primary)]">pair</span>
      </span>
    </span>
  );
}

function WhatsAppIcon() {
  // Official Digital_Glyph_White_RGB_2026 from Meta's WhatsApp Brand Resource Center.
  // https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="size-5 shrink-0"
      viewBox="0 0 720 720"
      fill="#fff"
    >
      <path d="M360,0C161.18,0,0,161.18,0,360c0,65.41,17.45,126.75,47.94,179.61L0,720l187.02-44.21c51.34,28.18,110.28,44.21,172.98,44.21,198.82,0,360-161.18,360-360S558.82,0,360,0ZM360,655.52c-60.17,0-116.13-17.98-162.82-48.87l-110.49,28.14,30.99-105.61c-33.53-47.93-53.2-106.26-53.2-169.19,0-163.21,132.31-295.52,295.52-295.52s295.52,132.31,295.52,295.52-132.31,295.52-295.52,295.52Z" />
      <path d="M444.35,407.52l87.1,41.06c4,1.88,6.56,5.94,6.2,10.34-.94,11.46-5.54,34.43-26.13,55.02-58.12,58.12-162.49-7.64-166.74-10.18-25.67-13.79-50.06-32.24-73.19-55.36-23.12-23.12-41.58-47.52-55.37-73.19-2.55-4.24-68.31-108.61-10.18-166.74,20.59-20.59,43.56-25.19,55.02-26.13,4.41-.36,8.46,2.2,10.34,6.2l41.07,87.1c1.94,4.12,1.09,9.02-2.13,12.24l-30.61,30.61c-6.62,6.62-8.56,16.93-4,25.11,11.17,20.03,26.19,39.32,43.59,57.07,17.75,17.4,37.04,32.43,57.07,43.59,8.18,4.56,18.48,2.62,25.11-4l30.61-30.61c3.22-3.22,8.12-4.08,12.24-2.13Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 6.75 5.4a2 2 0 0 0 2.5 0L20 7" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="relative z-20 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <a aria-label="HirePair — início" href="#inicio">
          <Brand />
        </a>
        <nav aria-label="Navegação principal" className="hidden items-center gap-7 sm:flex">
          <a className="nav-link" href="#como-funciona">
            Como funciona
          </a>
          <a className="nav-link" href="#para-quem">
            Para quem
          </a>
        </nav>
        <a className="button button-small button-outline" href="#contato">
          Fale com a gente
        </a>
      </header>

      <section className="relative" id="inicio">
        <div aria-hidden="true" className="hero-orb hero-orb-left" />
        <div aria-hidden="true" className="hero-orb hero-orb-right" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 sm:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pb-28 lg:pt-20">
          <div>
            <p className="eyebrow">
              <span className="status-dot" />
              Lançamento em 31 de outubro
            </p>
            <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.06] tracking-[-0.04em] text-[var(--color-navy)] sm:text-6xl lg:text-7xl">
              Um currículo claro para{' '}
              <span className="text-[var(--color-primary)]">abrir portas.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)] sm:text-xl">
              Organize sua história profissional com orientação simples e prepare um currículo
              legível para recrutadores e sistemas de seleção.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="button button-primary"
                href={whatsappUrl}
                rel="noreferrer"
                target="_blank"
              >
                Conversar pelo WhatsApp <WhatsAppIcon />
              </a>
              <a className="button button-secondary" href={emailUrl}>
                Enviar um e-mail <MailIcon />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden="true"
              className="absolute -inset-5 rotate-3 rounded-[2.5rem] bg-[var(--color-pink)]/35"
            />
            <div className="animate-float relative rounded-[2rem] border border-[rgba(37,38,38,0.12)] bg-white p-5 shadow-[0_30px_80px_-28px_rgba(51,51,100,0.5)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[rgba(37,38,38,0.1)] pb-5">
                <Brand compact decorative />
                <span className="rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-bold text-[var(--color-success)]">
                  Em preparação
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                  Seu currículo
                </p>
                <div className="mt-3 h-5 w-3/4 rounded-full bg-[var(--color-navy)]" />
                <div className="mt-3 h-3 w-full rounded-full bg-[var(--color-creme-deep)]" />
                <div className="mt-2 h-3 w-5/6 rounded-full bg-[var(--color-creme-deep)]" />
              </div>
              <div className="mt-7 rounded-2xl bg-[var(--color-creme)] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                    ✓
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-28 rounded-full bg-[var(--color-primary)]" />
                    <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-light)]/60" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="h-2 flex-1 rounded-full bg-[var(--color-primary)]" />
                <span className="h-2 flex-1 rounded-full bg-[var(--color-primary)]" />
                <span className="h-2 flex-1 rounded-full bg-[var(--color-light)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Diferenciais do HirePair"
        className="border-y border-[rgba(37,38,38,0.1)] bg-white/60"
      >
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-6 text-center text-sm font-semibold text-[var(--color-navy)] sm:grid-cols-3 sm:px-10">
          <p>Feito para a realidade brasileira</p>
          <p>Linguagem simples e acolhedora</p>
          <p>Estrutura pensada para seleção</p>
        </div>
      </section>

      <section className="bg-[var(--color-navy)] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-light)]">
              Marque na agenda
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-extrabold sm:text-4xl">
              A contagem para uma nova fase já começou.
            </h2>
            <p className="mt-4 leading-7 text-white/70">
              Volte em 31 de outubro de 2026 para acompanhar o lançamento do HirePair.
            </p>
          </div>
          <Countdown deadline={launchDate} initialNow={Date.now()} />
        </div>
      </section>

      <section className="section-shell" id="como-funciona">
        <p className="section-kicker">O que estamos criando</p>
        <h2 className="section-title">Menos confusão para contar bem a sua trajetória.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {benefits.map((benefit) => (
            <article className="feature-card" key={benefit.number}>
              <span className="feature-number" aria-hidden="true">
                {benefit.number}
              </span>
              <h3 className="mt-5 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-navy)]">
                {benefit.title}
              </h3>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="section-kicker">Como vai funcionar</p>
            <h2 className="section-title">Da sua história ao currículo, em três momentos.</h2>
            <p className="mt-5 leading-7 text-[var(--color-text-muted)]">
              Sem telas confusas e sem exigir que você saiba escrever como um profissional de RH.
            </p>
          </div>
          <ol className="space-y-5">
            {steps.map(([title, description], index) => (
              <li
                className="flex gap-5 rounded-3xl border border-[rgba(37,38,38,0.1)] bg-[var(--color-creme)] p-5 sm:p-6"
                key={title}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-navy)]">
                    {title}
                  </h3>
                  <p className="mt-2 leading-7 text-[var(--color-text-muted)]">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-shell" id="para-quem">
        <div className="rounded-[2rem] bg-[var(--color-creme-deep)] p-7 sm:p-10 lg:p-12">
          <p className="section-kicker">Para quem é o HirePair</p>
          <h2 className="section-title">Sua experiência merece ser entendida.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl bg-white p-6 sm:p-8">
              <p className="text-sm font-bold text-[var(--color-primary)]">
                PRIMEIRO EMPREGO E RECOLOCAÇÃO
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-navy)]">
                Para começar com segurança
              </h3>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">
                Orientação clara para reconhecer habilidades e montar um currículo mesmo quando você
                não sabe por onde começar.
              </p>
            </article>
            <article className="rounded-3xl bg-white p-6 sm:p-8">
              <p className="text-sm font-bold text-[var(--color-primary)]">TRANSIÇÃO DE CARREIRA</p>
              <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-navy)]">
                Para mostrar o que se conecta
              </h3>
              <p className="mt-3 leading-7 text-[var(--color-text-muted)]">
                Uma forma de reorganizar experiências anteriores e destacar competências que fazem
                sentido para o próximo passo.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 sm:px-10" id="contato">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[var(--color-primary)] px-6 py-12 text-center text-white shadow-[0_28px_70px_-30px_rgba(51,51,100,0.7)] sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-pink)]/30 blur-2xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/70">
              Vamos conversar?
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-extrabold sm:text-5xl">
              Quer conhecer ou contribuir com o HirePair?
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/80">
              Estamos ouvindo candidatos, profissionais em transição e recrutadores enquanto
              construímos o produto.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                className="button bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
                href={whatsappUrl}
                rel="noreferrer"
                target="_blank"
              >
                Conversar pelo WhatsApp <WhatsAppIcon />
              </a>
              <a
                className="button border border-white/35 text-white hover:bg-white/10"
                href={emailUrl}
              >
                Enviar um e-mail <MailIcon />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(37,38,38,0.1)] bg-white/45">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <Brand compact />
          <div className="text-sm text-[var(--color-text-muted)]">
            <p>Construindo caminhos mais claros para o próximo trabalho.</p>
            <p className="mt-1">
              Contato:{' '}
              <a
                className="font-semibold underline underline-offset-4"
                href="mailto:tech@kiwibit.com.br"
              >
                tech@kiwibit.com.br
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
