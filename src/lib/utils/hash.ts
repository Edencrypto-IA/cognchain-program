import crypto from 'crypto';

/** SHA-256 of any string input, returns hex digest */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
