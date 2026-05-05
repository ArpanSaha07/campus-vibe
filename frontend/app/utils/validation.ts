// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Name validation
export function isValidName(name: string): boolean {
  return name.trim().length >= 2;
}

// URL validation
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Generic field validators
export const validators = {
  email: (email: string) => isValidEmail(email) ? null : 'Invalid email address',
  password: (password: string) => isValidPassword(password) ? null : 'Password must be at least 8 characters',
  name: (name: string) => isValidName(name) ? null : 'Name must be at least 2 characters',
  required: (value: string) => value.trim().length > 0 ? null : 'This field is required',
};
