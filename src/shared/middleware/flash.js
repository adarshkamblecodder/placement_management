// Lightweight flash messages backed by session.
// Exposes `res.locals.messages` to templates with both legacy keys:
//   - `tags`: original (Django-like) attribute used by some templates
//   - `type`: shorter alias used by newer templates (Bootstrap class)
function flashMiddleware(req, _res, next) {
  if (!req.session) {
    return next();
  }

  const current = req.session.__messages || [];
  _res.locals = _res.locals || {};
  _res.locals.messages = current.map((m) => ({
    tags: m.tags,
    type: m.tags,
    text: m.text,
  }));

  req.session.__messages = [];
  next();
}

function addMessage(req, { type = "info", text = "" } = {}) {
  if (!req.session) return;
  if (!req.session.__messages) req.session.__messages = [];
  req.session.__messages.push({ tags: type, text });
}

module.exports = { flashMiddleware, addMessage };
