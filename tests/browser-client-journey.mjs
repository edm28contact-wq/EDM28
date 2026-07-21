import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import appHandler from '../api/app.js';

const root = process.cwd();
const port = 4180;
let previewHtml = '';
appHandler({ method: 'GET' }, {
  setHeader() {},
  status() { return this; },
  send(body) { previewHtml = body; return this; },
  end() { return this; }
});
if (!previewHtml.includes('client-account-safe.js?v=12')) throw new Error('Preview