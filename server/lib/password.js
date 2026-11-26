import bcrypt from 'bcryptjs';

export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

// Hash ficticio para igualar tiempos cuando el usuario no existe (evita enumerar emails).
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-valid', 12);

export function passwordProblems(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 10) problems.push('min_length');
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) problems.push('mixed_case');
  if (!/[0-9]/.test(pw)) problems.push('number');
  if (pw && pw.length > 200) problems.push('max_length');
  return problems;
}
