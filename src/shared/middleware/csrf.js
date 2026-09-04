const crypto = require("crypto");

function getRequestToken(req) {
  return (
    req.body?._csrf ||
    req.body?.csrfmiddlewaretoken ||
    req.headers["csrf-token"] ||
    req.headers["x-csrf-token"] ||
    req.query?._csrf
  );
}

function sendCsrfFailure(res) {
  return res.status(403).render(
    "tracker/error.html",
    {
      status: 403,
      error_title: "CSRF Validation Failed",
      error_message:
        "Your session token is invalid or expired. Please refresh the page and try again.",
    },
    (err, html) => {
      if (err) {
        return res.status(403).send("403 Forbidden: Invalid or missing CSRF token.");
      }
      return res.status(403).send(html);
    }
  );
}

function csrfMiddleware(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  const token = req.session.csrfToken;
  res.locals.csrfToken = token;
  res.locals.csrf_token = token;
  res.locals.csrf_input = `<input type="hidden" name="_csrf" value="${token}">`;

  const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!mutatingMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  // Multipart bodies are parsed by multer in route handlers; validate there instead.
  if (contentType.includes("multipart/form-data")) {
    return next();
  }

  const requestToken = getRequestToken(req);
  if (!requestToken || requestToken !== token) {
    return sendCsrfFailure(res);
  }

  return next();
}

function verifyCsrf(req, res, next) {
  if (!req.session?.csrfToken) {
    return sendCsrfFailure(res);
  }

  const requestToken = getRequestToken(req);
  if (!requestToken || requestToken !== req.session.csrfToken) {
    return sendCsrfFailure(res);
  }

  return next();
}

module.exports = { csrfMiddleware, verifyCsrf };
