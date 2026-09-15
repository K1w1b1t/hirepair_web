# Runbook do PostHog compartilhado

## Contrato de ingestão

O projeto PostHog Cloud US é compartilhado com o Kiwibit. Todo evento deve ter `app` (`hirepair` ou `kiwibit`), `environment` (`development`, `staging` ou `production`) e `telemetry_source` (`browser` ou `server`). O navegador só inicializa analytics, Error Tracking e Session Replay após `analytics_consent=granted`; telemetria operacional anônima do servidor independe desse consentimento.

Nunca envie nome, e-mail, currículo, prompt, respostas, corpos, headers, query strings ou tokens. O replay usa `maskAllInputs: true` e `maskTextSelector: "*"`; URLs perdem a query string antes do envio.

## Variáveis

- Frontend runtime: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` e `NEXT_PUBLIC_APP_ENV`.
- API runtime: `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST=https://us.i.posthog.com` e `POSTHOG_ENVIRONMENT`.
- Build do frontend: `POSTHOG_API_KEY` e `POSTHOG_PROJECT_ID`. A personal API key nunca é exposta ao runtime do navegador.

Sem o token correspondente, cada integração é no-op. O upload de source maps (`project=hirepair-web`) só é ativado quando os dois segredos de build existem.

## Configuração do projeto

1. Habilite exception autocapture.
2. Configure replay de 10% para todas as sessões consentidas e um trigger group adicional de 100% para sessões com `$exception`.
3. Crie um destino Discord para `$exception`, filtrado por `environment=production` e `telemetry_source=browser`.
4. Crie outro destino Discord para `ai_fallback_triggered`, filtrado por `environment=production`.
5. Crie o funil `session_started → facts_confirmed → resume_generated → whatsapp_shared`. Somente `session_started` tem hook atualmente; não simule os demais.

## Operação e diagnóstico

Após cada deploy de staging, aceite o aviso e confirme Live Events com `app=hirepair` e `environment=staging`. Confirme que nenhum evento surge após recusar/revogar, que inputs/textos estão mascarados e que URLs não têm query. Provoque uma exceção controlada, confira o stack trace simbolizado e o Discord. Provoque um fallback real e confirme que o payload contém somente provedores, modelos, status e trace ID.

Se eventos faltarem, verifique consentimento, token/host do ambiente, bloqueadores/CSP e filtros do dashboard. Para source maps, confira os segredos no build, o symbol set e o comentário `chunkId` no bundle servido. Para fallback, confira token da API e logs `TelemetryService`; falhas são fail-open.

Ao rotacionar tokens ou a personal API key, atualize os ambientes de staging/produção, faça novo deploy e repita a verificação. Revogue imediatamente a credencial anterior; nunca registre seu valor no repositório ou em logs.
