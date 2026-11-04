import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PRESENTATION_REFERENCES } from '../test/reference-resumes';
import { seedReview } from './helpers/seed-review';
import { expectCookieAtViewportCorner } from './helpers/viewport-evidence';

const evidence = resolve(__dirname, '../../../docs/backend/evidence/23');
for (const reference of PRESENTATION_REFERENCES) {
  test(`referência esperada de apresentação — ${reference.id} (não é geração IA)`, async ({
    page,
    context,
  }, testInfo) => {
    await context.addCookies([
      {
        name: 'analytics_consent',
        value: 'denied',
        url: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`,
      },
    ]);
    await mkdir(evidence, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedReview(
      page,
      reference.input.archetype,
      3,
      reference.input.profile.name,
      reference.input,
    );
    await expect(page.getByRole('button', { name: 'Aprovar currículo', exact: true })).toBeEnabled({
      timeout: 15000,
    });
    await expect(
      page.getByRole('heading', { name: 'Experiência e projetos', exact: true }),
    ).toBeVisible();
    await expectCookieAtViewportCorner(page);
    await page.screenshot({
      path: resolve(evidence, `${reference.id}-review-viewport.png`),
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Aprovar currículo', exact: true }).click();
    await page.waitForURL(/meus-curriculos\/[^/]+$/);
    await expect(page.locator('.pdf-pages canvas[data-rendered=true]')).toHaveCount(
      reference.expectedPages,
    );
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Baixar PDF' }).click();
    const data = await readFile((await (await download).path())!);
    await writeFile(resolve(evidence, `${reference.id}-expected.pdf`), data);
    await testInfo.attach('PDF de referência esperado; conteúdo manual anonimizado', {
      body: data,
      contentType: 'application/pdf',
    });
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = getDocument({ data: new Uint8Array(data) });
    const pdf = await loading.promise;
    expect(pdf.numPages).toBe(reference.expectedPages);
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        return (await page.getTextContent()).items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
      }),
    );
    const text = pages.join(' ').replace(/\s+/g, ' ').trim();
    for (const value of [
      reference.input.profile.name,
      reference.input.profile.email,
      reference.input.profile.phone,
      reference.input.profile.location!,
      reference.input.profile.linkedin!,
      reference.input.profile.github!,
      reference.input.profile.portfolio!,
      'Experiência e projetos',
    ])
      expect(text.toLocaleLowerCase('pt-BR')).toContain(value.toLocaleLowerCase('pt-BR'));
    for (const section of reference.input.document.sections) {
      expect(text.toLocaleLowerCase('pt-BR')).toContain(section.title.toLocaleLowerCase('pt-BR'));
      const headingPage = pages
        .map((value) => value.replace(/\s+/g, ' ').trim())
        .find((value) =>
          value.toLocaleLowerCase('pt-BR').includes(section.title.toLocaleLowerCase('pt-BR')),
        );
      expect(headingPage).toContain(section.units[0].text);
      for (const unit of section.units) expect(text).toContain(unit.text);
    }
    await loading.destroy();
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const suffix = viewport.width === 390 ? 'mobile' : 'desktop';
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await expectCookieAtViewportCorner(page);
      const capture = await page.screenshot({
        path: resolve(evidence, `${reference.id}-${suffix}-viewport.png`),
        fullPage: false,
      });
      expect(capture.readUInt32BE(16)).toBe(viewport.width);
      expect(capture.readUInt32BE(20)).toBe(viewport.height);
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      );
      await expectCookieAtViewportCorner(page);
      await page.screenshot({
        path: resolve(evidence, `${reference.id}-${suffix}-scrolled.png`),
        fullPage: false,
      });
    }
  });
}
