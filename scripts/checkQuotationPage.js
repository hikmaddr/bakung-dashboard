const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => {
    console.log('browser-console:', msg.type(), msg.text());
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/quotations')) {
      console.log('response:', response.status(), url);
    }
  });
  try {
    await page.goto('http://localhost:3001/penjualan/quotation', { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err) {
    console.error('goto-error:', err.message || err);
  }
  await page.waitForTimeout(5000);
  const rowCount = await page.$$eval('tbody tr', (rows) => rows.length).catch(() => -1);
  const stillLoading = await page.isVisible('text=Loading...').catch(() => false);
  console.log('row-count:', rowCount);
  console.log('loading-visible:', stillLoading);
  await browser.close();
})();
