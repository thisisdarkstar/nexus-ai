import CryptoJS from 'crypto-js';
import type { DecodedJWT } from '../../types';

/**
 * Base64 Encoding & Decoding (UTF-8 safe)
 */
export function encodeBase64(input: string): string {
  try {
    const words = CryptoJS.enc.Utf8.parse(input);
    return CryptoJS.enc.Base64.stringify(words);
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeBase64(input: string): string {
  try {
    const cleaned = input.trim().replace(/\s+/g, '');
    const words = CryptoJS.enc.Base64.parse(cleaned);
    return CryptoJS.enc.Utf8.stringify(words);
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * Hex Encoding & Decoding
 */
export function encodeHex(input: string, spaceSeparated = true): string {
  try {
    const words = CryptoJS.enc.Utf8.parse(input);
    const hex = CryptoJS.enc.Hex.stringify(words);
    if (spaceSeparated) {
      return hex.match(/.{1,2}/g)?.join(' ') || hex;
    }
    return hex;
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeHex(input: string): string {
  try {
    const cleaned = input.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) {
      return '[Error: Incomplete hex byte length (odd number of characters)]';
    }
    const words = CryptoJS.enc.Hex.parse(cleaned);
    return CryptoJS.enc.Utf8.stringify(words);
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * URL Encoding & Decoding
 */
export function encodeURL(input: string, fullComponent = true): string {
  try {
    return fullComponent ? encodeURIComponent(input) : encodeURI(input);
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeURL(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * HTML Entities Encoding & Decoding
 */
export function encodeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function decodeHTML(input: string): string {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return doc.documentElement.textContent || '';
}

/**
 * Rot13 / Caesar Cipher
 */
export function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

/**
 * XOR with Key (String or Hex)
 */
export function xorTransform(input: string, key: string): string {
  if (!key) return input;
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

/**
 * Shannon Entropy Calculator (0.0 to 8.0 bits per character)
 * Measures randomness of a string.
 * > 7.0: highly likely compressed, encrypted, or packed shellcode/payload.
 * 3.5 - 5.5: typical English text or standard source code.
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies: Record<string, number> = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(4));
}

/**
 * Cryptographic Hashes
 */
export interface HashResult {
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

export function calculateHashes(input: string): HashResult {
  return {
    md5: CryptoJS.MD5(input).toString(),
    sha1: CryptoJS.SHA1(input).toString(),
    sha256: CryptoJS.SHA256(input).toString(),
    sha512: CryptoJS.SHA512(input).toString(),
  };
}

export function calculateHMAC(input: string, key: string, algo: 'sha256' | 'sha512' | 'md5' = 'sha256'): string {
  if (algo === 'sha512') {
    return CryptoJS.HmacSHA512(input, key).toString();
  }
  if (algo === 'md5') {
    return CryptoJS.HmacMD5(input, key).toString();
  }
  return CryptoJS.HmacSHA256(input, key).toString();
}

/**
 * JWT Token Parser and Inspector
 */
export function parseJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length < 2) return null;

    const base64UrlDecode = (str: string) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const words = CryptoJS.enc.Base64.parse(base64);
      return CryptoJS.enc.Utf8.stringify(words);
    };

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const signature = parts[2] || '';

    const warnings: string[] = [];

    const alg = (header.alg || '').toLowerCase();
    if (alg === 'none') {
      warnings.push('CRITICAL: Token uses "none" algorithm (Signature verification bypassed).');
    }
    if (alg === 'hs256' && header.typ === 'JWT') {
      warnings.push('INFO: Symmetric HMAC (HS256) detected. Ensure secret key has high entropy (>256 bits).');
    }

    let isExpired = false;
    let expiresAt: string | undefined;
    let issuedAt: string | undefined;

    if (payload.exp && typeof payload.exp === 'number') {
      const expDate = new Date(payload.exp * 1000);
      expiresAt = expDate.toISOString();
      if (Date.now() > payload.exp * 1000) {
        isExpired = true;
        warnings.push(`EXPIRED: Token expired at ${expDate.toUTCString()}`);
      }
    } else {
      warnings.push('WARNING: No expiration claim ("exp") found in payload.');
    }

    if (payload.iat && typeof payload.iat === 'number') {
      issuedAt = new Date(payload.iat * 1000).toISOString();
    }

    return {
      header,
      payload,
      signature,
      isExpired,
      expiresAt,
      issuedAt,
      algorithm: header.alg || 'unknown',
      warnings,
    };
  } catch {
    return null;
  }
}

/**
 * Defanging & Refanging URLs / IPs / Domains
 * Defanging: converts dangerous links into safe non-clickable text for threat reporting
 * e.g., http://evil.com/malware.exe -> hxxp[://]evil[.]com/malware[.]exe
 */
export function defang(input: string): string {
  return input
    .replace(/http:\/\//gi, 'hxxp://')
    .replace(/https:\/\//gi, 'hxxps://')
    .replace(/:\/\//g, '[://]')
    .replace(/\./g, '[.]');
}

export function refang(input: string): string {
  return input
    .replace(/hxxps/gi, 'https')
    .replace(/hxxp/gi, 'http')
    .replace(/\[:\/\/\]/g, '://')
    .replace(/\[\.\]/g, '.')
    .replace(/\(\.\)/g, '.');
}
