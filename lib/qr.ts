import { customAlphabet } from 'nanoid';

// URL-safe alphabet (no ambiguous chars like 0/O, 1/l/I).
// 10 chars from a 58-symbol alphabet ≈ 58 bits of entropy.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const generateId = customAlphabet(ALPHABET, 10);

export function generateQrCodeId(): string {
  return generateId();
}

export function getQrCodeUrl(qrCodeId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/c/${qrCodeId}`;
}
