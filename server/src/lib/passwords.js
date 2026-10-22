import bcrypt from 'bcryptjs';

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(input, stored) {
  if (!stored) return { valid: false, upgradedHash: null };
  const value = String(stored);
  if (/^\$2[aby]\$/.test(value)) {
    return { valid: await bcrypt.compare(String(input), value), upgradedHash: null };
  }
  // Backward compatibility for existing records from the old PHP app, which stored plain text.
  // Successful legacy login migrates the value to bcrypt without changing the table structure.
  if (String(input) === value) {
    return { valid: true, upgradedHash: await hashPassword(input) };
  }
  return { valid: false, upgradedHash: null };
}
