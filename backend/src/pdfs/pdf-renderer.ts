import puppeteer, { Browser } from 'puppeteer';

const PDF_RENDER_TIMEOUT_MS = 60_000;

// Las renderizaciones se encadenan: nunca hay dos Chromium abiertos a la vez dentro
// del mismo proceso (worker de PDFs + informe mensual). Importante en instancias de 2 GB.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Convierte HTML autocontenido (imágenes como data URLs) en un PDF A4.
 * Chromium corre sin JavaScript y con toda petición de red bloqueada, para que
 * contenido ingresado por usuarios no pueda alcanzar servicios internos.
 */
export function renderHtmlToPdf(html: string): Promise<Buffer> {
  const run = queue.then(() => render(html));
  queue = run.catch(() => undefined);
  return run;
}

async function render(html: string): Promise<Buffer> {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, { waitUntil: 'load', timeout: PDF_RENDER_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      timeout: PDF_RENDER_TIMEOUT_MS,
    });
    return Buffer.from(pdf);
  } finally {
    // Siempre cerrar Chromium, incluso si falla: evita procesos huérfanos consumiendo RAM
    await browser?.close().catch(() => undefined);
  }
}
