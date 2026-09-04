async function requireStudent(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  if (u.isStaff) return res.redirect("/admin-dashboard/");
  return next();
}

module.exports = { requireStudent };
