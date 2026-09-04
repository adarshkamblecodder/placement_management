const rateLimit = require("express-rate-limit");
const { addMessage } = require("./flash");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, _next, options) => {
    addMessage(req, {
      type: "danger",
      text: "Too many attempts from this IP address. Please try again after 15 minutes.",
    });
    return res.status(429).redirect(req.originalUrl || req.path || "/login/");
  },
});

module.exports = { authLimiter };
