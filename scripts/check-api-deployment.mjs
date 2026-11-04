const baseUrl = process.argv[2];
if (!baseUrl) throw new Error('Informe a URL base da API implantada.');
const url = new URL('/guest/config', baseUrl);
if (url.protocol !== 'https:') throw new Error('A URL deve usar HTTPS.');
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`/guest/config retornou HTTP ${response.status}`);
const config = await response.json();
if (
  typeof config.enabled !== 'boolean' ||
  typeof config.siteKey !== 'string' ||
  typeof config.termsVersion !== 'string' ||
  typeof config.privacyVersion !== 'string' ||
  (config.enabled && !config.siteKey)
) {
  throw new Error('Contrato inválido em /guest/config.');
}
console.log('/guest/config respondeu com contrato válido.');
