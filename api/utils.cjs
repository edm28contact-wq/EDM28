function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload || {});
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(body);
}

function sendOptions(res) {
  return sendJson(res, 200, { success: true });
}

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = await readRawBody(req);
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const preview = raw.slice(0, 180);
    const err = new Error(`Corps JSON invalide: ${preview}`);
    err.statusCode = 400;
    throw err;
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { text, json };
}

function previewText(text, max = 260) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

module.exports = {
  sendJson,
  sendOptions,
  readJsonBody,
  readJsonResponse,
  previewText
};
