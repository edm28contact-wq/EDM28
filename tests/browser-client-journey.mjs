import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = 4180;
const loaderScripts = [
  '/integration.js?v=5',
  '/final-system.js?v=2',
  '/request-history.js?v=1',
  '/service-details.js?v=1',
  '/ui-final.js?v=6',
  '/theme-light.js?v=4',
  '/home-premium.js?v=3',
  '/contact-footer.js?v=1',
  '/accessibility-mobile.js?v=1',
  '/reliability.js?v=1',
  '/white-background.js?v=2',
  '/light-palette