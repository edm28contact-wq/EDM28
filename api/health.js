const { sendJson, sendOptions } = require("./_utils.cjs");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  return sendJson(res, 200, {
    success: true,
    app: "EDM AUTO",
    api: "health",
    time: new Date().toISOString(),
    env: {
      plaqueTokenConfigured: Boolean(process.env.PLAQUE_API_TOKEN),
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      edmBackendConfigured: Boolean(process.env.EDM28_BACKEND_URL)
    }
  });
};
