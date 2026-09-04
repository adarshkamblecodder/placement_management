const { generateAdvisoryResponse } = require("../services/aiAdvisory.service");

async function apiChat(req, res) {
  try {
    const { query, history } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: "Query cannot be empty." });
    }

    const response = await generateAdvisoryResponse(query, history || []);
    return res.json({ success: true, ...response });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { apiChat };
