export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  return next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (req.session.user.role !== role) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    next();
  };
}
