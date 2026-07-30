import { chromium } from 'playwright';

const originalLaunch = chromium.launch.bind(chromium);

chromium.launch = async (...args) => {
  const browser = await originalLaunch(...args);
  const originalNewPage = browser.newPage.bind(browser);

  browser.newPage = async (...pageArgs) => {
    const page = await originalNewPage(...pageArgs);

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const location = message.location();
      console.error(`[messaging diagnostic][console] ${message.text()} @ ${location.url || 'unknown'}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`);
    });

    page.on('requestfailed', (request) => {
      console.error(`[messaging diagnostic][requestfailed] ${request.url()} :: ${request.failure()?.errorText || 'unknown error'}`);
    });

    return page;
  };

  return browser;
};

await import('./messaging-loop.mjs');
