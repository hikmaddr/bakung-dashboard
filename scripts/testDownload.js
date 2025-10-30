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
  await page.goto('http://localhost:3001/penjualan/quotation', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('tbody tr');
  const rowCount = await page.locator('tbody tr').count();
  console.log('row-count:', rowCount);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('tbody tr').first().locator('button[title="Unduh PDF"]').click();
  const download = await downloadPromise;
  console.log('download-suggested-filename:', await download.suggestedFilename());
  await download.cancel();
  await browser.close();
})();
