import { Document, Page, Text, View, Font, Link, pdf } from '@react-pdf/renderer';
import { pageLimit, type PdfInput, type ExportArtifact } from './pdf-contract';
import { contactLine, resumeBlocks } from './resume-presentation';
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
    contactLine(profile),
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
          padding: 36,
          fontFamily: 'Public Sans',
          fontSize: 10,
          lineHeight: 1.35,
          color: '#252626',
        }}
      >
        <View
          style={{
            marginBottom: 4,
            paddingBottom: 8,
            borderBottomWidth: 1.2,
            borderBottomColor: '#193b60',
          }}
          wrap={false}
        >
          {profile.name && (
            <Text style={{ fontSize: 20, fontWeight: 700, color: '#193b60' }}>{profile.name}</Text>
          )}
          {profile.professionalTitle && (
            <Text style={{ fontSize: 12, marginTop: 4 }}>{profile.professionalTitle}</Text>
          )}
          <Text style={{ fontSize: 9, color: '#555968', marginTop: 4 }}>
            {contactLine(profile)}
          </Text>
        </View>
        {/* Presence hints need preceding siblings in the page flow, not an isolated section wrapper. */}
        {resumeBlocks(document.sections).flatMap(({ section, areaTitle, isExperience }) => [
          areaTitle && (
            <Text
              key={`area:${section.id}`}
              minPresenceAhead={90}
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: '#193b60',
                textTransform: 'uppercase',
                marginTop: 12,
                marginBottom: 5,
                paddingBottom: 3,
                borderBottomWidth: 0.5,
                borderBottomColor: '#bbc9d8',
              }}
            >
              {areaTitle}
            </Text>
          ),
          <Text
            key={`heading:${section.id}`}
            minPresenceAhead={60}
            style={
              isExperience
                ? { fontWeight: 700, fontSize: 10, marginTop: 8, marginBottom: 4 }
                : {
                    fontWeight: 700,
                    fontSize: 11,
                    color: '#193b60',
                    textTransform: 'uppercase',
                    marginTop: 12,
                    marginBottom: 5,
                    paddingBottom: 3,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#bbc9d8',
                  }
            }
          >
            {section.title}
          </Text>,
          ...section.units.map((unit) => (
            <Text
              key={unit.id}
              orphans={2}
              widows={2}
              style={{ marginBottom: 4, paddingLeft: isExperience ? 9 : 0 }}
            >
              {isExperience && '• '}
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
    layoutVersion: 'reference-column-v3',
    pageCount,
  };
}
