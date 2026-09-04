// Standard JSON response helpers.
function ok(res, data = {}, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

function fail(res, message = "Bad Request", status = 400, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

module.exports = { ok, fail };
