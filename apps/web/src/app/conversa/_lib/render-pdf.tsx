import { Document, Page, Text, View, Font, Link, pdf } from '@react-pdf/renderer';
import { pageLimit, type PdfInput, type ExportArtifact } from './pdf-contract';
import { hashValue } from './interview-session';
Font.register({
  family: 'Public Sans',
  fonts: [
    { src: '/fonts/PublicSans-Regular.ttf' },
    { src: '/fonts/PublicSans-Bold.ttf', fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
export async function renderPdf(input: PdfInput): Promise<ExportArtifact> {
  const { document, profile } = input;
  const source = Font.getFont({ fontFamily: 'Public Sans' });
  await source.load();
  const text = [
    profile.name,
    profile.professionalTitle || '',
    profile.email,
    profile.phone,
    ...document.sections.flatMap((section) => [
      section.title,
      ...section.units.map((unit) => unit.text),
    ]),
  ].join('\n');
  for (const character of text) {
    if (!/\s/u.test(character) && !source.data!.hasGlyphForCodePoint(character.codePointAt(0)!))
      throw new Error(
        'O texto contém um caractere que a fonte do PDF não consegue mostrar. Ajuste o texto antes de aprovar.',
      );
  }
  let pageCount = 0;
  const blob = await pdf(
    <Document language="pt-BR" title={profile.professionalTitle || 'Currículo'}>
      <Page
        size="A4"
        style={{
          padding: 42,
          fontFamily: 'Public Sans',
          fontSize: 10,
          lineHeight: 1.45,
          color: '#252626',
        }}
      >
        <View style={{ marginBottom: 4 }} wrap={false}>
          {profile.name && <Text style={{ fontSize: 20, fontWeight: 700 }}>{profile.name}</Text>}
          {profile.professionalTitle && (
            <Text style={{ fontSize: 12, marginTop: 4 }}>{profile.professionalTitle}</Text>
          )}
          {[profile.email, profile.phone].filter(Boolean).map((value, index) => (
            <Text key={index}>{value}</Text>
          ))}
        </View>
        {/* Presence hints need preceding siblings in the page flow, not an isolated section wrapper. */}
        {document.sections.flatMap((section) => [
          <Text
            key={`heading:${section.id}`}
            minPresenceAhead={60}
            style={{ fontWeight: 700, fontSize: 12, marginTop: 12, marginBottom: 6 }}
          >
            {section.title}
          </Text>,
          ...section.units.map((unit) => (
            <Text key={unit.id} orphans={2} widows={2} style={{ marginBottom: 5 }}>
              {unit.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <Link key={i} src={part}>
                    {part}
                  </Link>
                ) : (
                  part
                ),
              )}
            </Text>
          )),
        ])}
        <Text
          fixed
          render={({ totalPages }) => {
            pageCount = totalPages;
            return '';
          }}
        />
      </Page>
    </Document>,
  ).toBlob();
  if (pageCount > pageLimit(input.archetype))
    throw new Error(
      `O currículo ultrapassou o limite de ${pageLimit(input.archetype)} página(s). Ajuste as seções antes de aprovar; nenhum conteúdo foi cortado.`,
    );
  const bytes = await blob.arrayBuffer();
  const fileHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return {
    blob,
    mime: 'application/pdf',
    format: 'pdf',
    fileName: `curriculo-${(profile.professionalTitle || profile.name || 'hirepair')
      .replace(/[^\p{L}\p{N} -]/gu, '')
      .trim()
      .replace(/\s+/g, '-')}.pdf`,
    contentHash: await hashValue(document),
    profileHash: await hashValue({ ...profile, confirmed: true }),
    fileHash,
    rendererVersion: 'react-pdf-4.9.0',
    layoutVersion: 'single-column-v2',
    pageCount,
  };
}
