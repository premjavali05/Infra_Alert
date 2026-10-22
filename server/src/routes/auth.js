import { Router } from 'express';
import { query } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';

const router = Router();
const clean = (value) => String(value ?? '').trim();
const publicUser = (user) => ({
  role: user.role,
  name: user.name,
  phno: user.phno,
  eid: user.eid,
  email: user.email,
  state: user.state,
  city: user.city,
  category: user.category,
  department: user.department
});

router.get('/me', (req, res) => {
  res.json({ user: req.session?.user ?? null });
});

router.post('/register/user', async (req, res, next) => {
  try {
    const name = clean(req.body.name);
    const phno = clean(req.body.phno);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    if (!name || !/^\d{10}$/.test(phno) || !email || password.length < 4) {
      return res.status(400).json({ error: 'Enter your name, a 10-digit phone number, valid email and password (at least 4 characters).' });
    }
    const exists = await query('SELECT 1 FROM u_register WHERE phno = $1', [phno]);
    if (exists.rowCount) return res.status(409).json({ error: 'Phone Number already exists.' });
    const inserted = await query(
      'INSERT INTO u_register (name, phno, email, pass) VALUES ($1, $2, $3, $4) RETURNING name, phno, email',
      [name, phno, email, await hashPassword(password)]
    );
    res.status(201).json({ message: 'Account created. Please sign in.', user: inserted.rows[0] });
  } catch (err) { next(err); }
});

router.post('/login/user', async (req, res, next) => {
  try {
    const phno = clean(req.body.phno);
    const password = String(req.body.password ?? '');
    const result = await query('SELECT * FROM u_register WHERE phno = $1', [phno]);
    if (!result.rowCount) return res.status(401).json({ error: 'Please check your Phone Number and Password.' });
    const record = result.rows[0];
    const verified = await verifyPassword(password, record.pass);
    if (!verified.valid) return res.status(401).json({ error: 'Please check your Phone Number and Password.' });
    if (verified.upgradedHash) await query('UPDATE u_register SET pass = $1 WHERE phno = $2', [verified.upgradedHash, phno]);
    req.session.user = { role: 'citizen', name: record.name, phno: record.phno, email: record.email };
    req.session.save((err) => {
      if (err) return next(err);
      res.json({ message: 'Signed in successfully.', user: req.session.user });
    });
  } catch (err) { next(err); }
});

router.post('/register/authority', async (req, res, next) => {
  try {
    const fields = {
      eid: clean(req.body.eid), name: clean(req.body.name), phno: clean(req.body.phno),
      email: clean(req.body.email).toLowerCase(), state: clean(req.body.state), category: clean(req.body.category),
      department: clean(req.body.department), city: clean(req.body.city), password: String(req.body.password ?? '')
    };
    if (!fields.eid || !fields.name || !/^\d{10}$/.test(fields.phno) || !fields.email || !fields.state || !fields.category || !fields.department || !fields.city || fields.password.length < 4) {
      return res.status(400).json({ error: 'Complete all fields and enter a 10-digit phone number. Password must be at least 4 characters.' });
    }
    const exists = await query('SELECT 1 FROM auth_register WHERE eid = $1', [fields.eid]);
    if (exists.rowCount) return res.status(409).json({ error: 'Employee ID already exists.' });
    await query(
      'INSERT INTO auth_register (eid, name, phno, email, state, category, department, city, pass) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [fields.eid, fields.name, fields.phno, fields.email, fields.state, fields.category, fields.department, fields.city, await hashPassword(fields.password)]
    );
    res.status(201).json({ message: 'Authority account created. Please sign in.' });
  } catch (err) { next(err); }
});

router.post('/login/authority', async (req, res, next) => {
  try {
    const eid = clean(req.body.eid);
    const password = String(req.body.password ?? '');
    const result = await query('SELECT * FROM auth_register WHERE eid = $1', [eid]);
    if (!result.rowCount) return res.status(401).json({ error: 'Please check your Employee ID and Password.' });
    const record = result.rows[0];
    const verified = await verifyPassword(password, record.pass);
    if (!verified.valid) return res.status(401).json({ error: 'Please check your Employee ID and Password.' });
    if (verified.upgradedHash) await query('UPDATE auth_register SET pass = $1 WHERE eid = $2', [verified.upgradedHash, eid]);
    req.session.user = {
      role: 'authority', name: record.name, eid: record.eid, phno: record.phno,
      email: record.email, state: record.state, category: record.category,
      department: record.department, city: record.city
    };
    req.session.save((err) => {
      if (err) return next(err);
      res.json({ message: 'Signed in successfully.', user: req.session.user });
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.json({ message: 'Signed out.' });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('infra.sid');
    res.json({ message: 'Signed out.' });
  });
});

export default router;
