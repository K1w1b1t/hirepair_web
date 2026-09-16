import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacidade, cookies e termos | HirePair',
  description: 'Informações sobre privacidade, cookies e termos de uso do HirePair.',
  alternates: { canonical: '/legal' },
};

const controller = 'KIWIBIT SERVIÇOS DE TECNOLOGIA LTDA';
const email = 'tech@kiwibit.com.br';

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[var(--color-text-main)] sm:px-10">
      <Link className="text-sm font-semibold text-[var(--color-primary)] underline" href="/">
        Voltar ao HirePair
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-heading)] text-4xl font-extrabold text-[var(--color-navy)]">
        Privacidade, cookies e termos
      </h1>
      <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
        Última atualização: 16 de setembro de 2026.
      </p>

      <article className="mt-10 space-y-10 leading-7 text-[var(--color-text-muted)]">
        <section id="privacy">
          <h2 className="text-2xl font-bold text-[var(--color-navy)]">Política de Privacidade</h2>
          <p className="mt-3">
            O HirePair é operado por {controller}, CNPJ 68.004.918/0001-42, com sede na Rua
            Alagoinhas, nº 92, Jardim Vale do Sol, São José dos Campos/SP, CEP 12238-020. A Kiwibit
            é a controladora dos dados tratados no HirePair.
          </p>
          <p className="mt-3">
            Tratamos os dados que você fornece para usar o serviço, responder a contatos e gerar o
            conteúdo solicitado. Dados de currículo, respostas e informações profissionais não são
            usados para publicidade. Podemos usar provedores técnicos necessários para operar o
            serviço, sempre conforme a finalidade informada.
          </p>
          <p className="mt-3">
            Você pode pedir confirmação, acesso, correção, anonimização, bloqueio, eliminação,
            portabilidade, informação sobre compartilhamentos ou revogação de consentimento. Para
            exercer esses direitos, escreva para{' '}
            <a className="underline" href={`mailto:${email}`}>
              {email}
            </a>
            .
          </p>
        </section>

        <section id="cookies">
          <h2 className="text-2xl font-bold text-[var(--color-navy)]">Política de Cookies</h2>
          <p className="mt-3">
            Cookies são pequenos arquivos que o navegador guarda para lembrar escolhas e ajudar o
            site a funcionar. Os cookies essenciais são necessários para recursos básicos. Cookies
            opcionais ajudam a entender o uso do site e identificar problemas.
          </p>
          <p className="mt-3">
            Os cookies opcionais só são ativados após sua aceitação. A recusa não impede o uso dos
            recursos essenciais. Você pode mudar essa escolha a qualquer momento em “Preferências de
            cookies”. A decisão é guardada por até 180 dias.
          </p>
          <p className="mt-3">
            Para medir o uso e diagnosticar falhas, usamos uma ferramenta de telemetria com textos e
            campos mascarados. Não usamos cookies para publicidade comportamental nem vendemos dados
            pessoais.
          </p>
        </section>

        <section id="terms">
          <h2 className="text-2xl font-bold text-[var(--color-navy)]">Termos de Uso</h2>
          <p className="mt-3">
            O HirePair oferece ferramentas para organizar informações profissionais e preparar
            currículos. Você é responsável por revisar o conteúdo antes de compartilhar e por ter os
            direitos necessários sobre as informações que fornecer.
          </p>
          <p className="mt-3">
            Não use o serviço para conteúdo ilícito, ofensivo ou que viole direitos de terceiros.
            Podemos atualizar o serviço e estes termos; mudanças relevantes serão refletidas nesta
            página. Estes termos são regidos pelas leis brasileiras.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-[var(--color-navy)]">Contato</h2>
          <p className="mt-3">
            Dúvidas sobre estas políticas ou sobre seus dados podem ser enviadas para{' '}
            <a className="underline" href={`mailto:${email}`}>
              {email}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
