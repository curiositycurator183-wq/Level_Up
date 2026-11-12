// Email & Password Validation for real-world legitimate authentication

const DISPOSABLE_OR_FAKE_DOMAINS = new Set([
  'test.com',
  'testing.com',
  'fake.com',
  'example.com',
  'example.org',
  'example.net',
  'tempmail.com',
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'throwawaymail.com',
  'dispostable.com',
  'sharklasers.com',
  'getairmail.com',
  'localhost',
  'invalid'
]);

export function validateLegitEmail(email: string): { valid: boolean; cleanEmail: string; reason?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, cleanEmail: '', reason: 'Email address is required.' };
  }

  const clean = email.toLowerCase().trim();

  if (clean.length < 5 || clean.length > 254) {
    return { valid: false, cleanEmail: clean, reason: 'Email address must be between 5 and 254 characters.' };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { valid: false, cleanEmail: clean, reason: 'Please enter a valid email address with a single "@" sign.' };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length > 64) {
    return { valid: false, cleanEmail: clean, reason: 'Email username before "@" is invalid or too long.' };
  }

  if (!domainPart || !domainPart.includes('.')) {
    return { valid: false, cleanEmail: clean, reason: 'Email must contain a valid domain name with extension (e.g. gmail.com, outlook.com, university.edu).' };
  }

  const domainSegments = domainPart.split('.');
  const tld = domainSegments[domainSegments.length - 1];

  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, cleanEmail: clean, reason: 'Email domain extension must be a legitimate top-level domain (e.g. .com, .edu, .org, .in).' };
  }

  if (DISPOSABLE_OR_FAKE_DOMAINS.has(domainPart)) {
    return { valid: false, cleanEmail: clean, reason: 'Please use a legitimate personal, academic, or work email address (e.g. Gmail, Outlook, Yahoo, University, or corporate domain).' };
  }

  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!EMAIL_REGEX.test(clean)) {
    return { valid: false, cleanEmail: clean, reason: 'Please enter a properly formatted email address.' };
  }

  return { valid: true, cleanEmail: clean };
}

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required.' };
  }

  if (password.length < 6) {
    return { valid: false, reason: 'Password must be at least 6 characters long.' };
  }

  return { valid: true };
}
