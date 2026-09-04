/**
 * Global Error Handler Middleware
 */
const { error: logError } = require("../services/logger.service");

function globalErrorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  logError({
    action: "UNHANDLED_EXCEPTION",
    actorId: req.session?.user?.id || req.session?.user?.username || "anonymous",
    details: err.message,
    metadata: {
      path: req.originalUrl || req.path,
      method: req.method,
      ip: req.ip,
      stack: isProd ? undefined : err.stack,
    },
  });

  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(status).json({
      success: false,
      error: isProd && status === 500 ? "Internal server error occurred." : err.message,
    });
  }

  // Render a friendly error page if available or fallback
  return res.status(status).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error ${status} - Placement Portal</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
      </head>
      <body class="bg-light d-flex align-items-center justify-content-center" style="min-height: 100vh;">
        <div class="card p-5 shadow-sm border-0 text-center" style="max-width: 500px;">
          <h1 class="display-4 fw-bold text-danger mb-3">${status}</h1>
          <h4 class="mb-3">${status === 404 ? "Page Not Found" : "Something Went Wrong"}</h4>
          <p class="text-muted small mb-4">${isProd && status === 500 ? "An unexpected error occurred. The placement team has been notified." : err.message}</p>
          <a href="/" class="btn btn-primary px-4">Return to Home</a>
        </div>
      </body>
    </html>
  `);
}

module.exports = { globalErrorHandler };
