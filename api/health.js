module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    success: true,
    app: "EDM AUTO",
    api: "health",
    time: new Date().toISOString()
  });
};
