const { spawn } = require('child_process');
const { once } = require('events');
const { chromium } = require('playwright');

(async () => {
  const command = process.platform === 'win32'
    ? ['cmd.exe', ['/c', 'npx next dev --hostname 127.0.0.1 --port 3005']]
    : ['npx', ['next', 'dev', '--hostname', '127.0.0.1', '--port', '3005']];
  const server = spawn(command[0], command[1], {
    cwd: 'c:/tailadmin-dashboard',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  server.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write('[svr] ' + text);
    if (text.includes('Ready')) {
      ready = true;
    }
  });
  server.stderr.on('data', (data) => {
    process.stderr.write('[svr-err] ' + data.toString());
  });

  while (!ready) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('response', (response) => {
    if (response.url().includes('/api/quotations') && response.status() >= 400) {
      console.log('[resp]', response.status(), response.url());
    }
  });
  await page.goto('http://127.0.0.1:3005/penjualan/quotation', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('tbody tr');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('tbody tr').first().locator('button[title="Unduh PDF"]').click();
  const download = await downloadPromise;
  console.log('download file name', await download.suggestedFilename());
  await download.cancel();
  await browser.close();

  server.kill('SIGTERM');
  await once(server, 'close');
})();
