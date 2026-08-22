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
 * Binary (8-bit) Encoding & Decoding
 */
export function encodeBinary(input: string): string {
  try {
    return Array.from(input)
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ');
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeBinary(input: string): string {
  try {
    const cleaned = input.trim().replace(/[^01]/g, ' ');
    const bytes = cleaned.split(/\s+/).filter(Boolean);
    return bytes.map((b) => String.fromCharCode(parseInt(b, 2))).join('');
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * Unicode Escape (\uXXXX) Encoding & Decoding
 */
export function encodeUnicode(input: string): string {
  try {
    return Array.from(input)
      .map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
      .join('');
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeUnicode(input: string): string {
  try {
    return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * Base64URL Encoding & Decoding (JWT safe format)
 */
export function encodeBase64URL(input: string): string {
  try {
    const b64 = encodeBase64(input);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeBase64URL(input: string): string {
  try {
    let base64 = input.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeBase64(base64);
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * Decimal / ASCII Codes (e.g. 65, 66, 67)
 */
export function encodeDecimalASCII(input: string): string {
  try {
    return Array.from(input)
      .map((c) => c.charCodeAt(0))
      .join(', ');
  } catch (err) {
    return `[Encoding Error: ${(err as Error).message}]`;
  }
}

export function decodeDecimalASCII(input: string): string {
  try {
    const numbers = input.split(/[,;\s]+/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
    return numbers.map((n) => String.fromCharCode(n)).join('');
  } catch (err) {
    return `[Decoding Error: ${(err as Error).message}]`;
  }
}

/**
 * Custom Caesar Shift (+N / -N)
 */
export function caesarShift(input: string, shift: number): string {
  const normShift = ((shift % 26) + 26) % 26;
  return input.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + normShift) % 26) + base);
  });
}

/**
 * String Reversal
 */
export function reverseString(input: string): string {
  return Array.from(input).reverse().join('');
}

/**
 * Rot13 / Caesar Cipher
 */
export function rot13(input: string): string {
  return caesarShift(input, 13);
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

/**
 * Hash Identification & Analyzer
 * Automatically inspects mystery/unknown hashes and predicts algorithm, Hashcat modes, and John formats.
 */
export interface IdentifiedHash {
  name: string;
  hashcatMode: string;
  johnFormat: string;
  bitLength: number;
  description: string;
  category: 'Modern' | 'Legacy/Weak' | 'Password KDF' | 'Unix Crypt' | 'Windows/NTLM';
}

export function identifyHashTypes(hashInput: string): IdentifiedHash[] {
  const trimmed = hashInput.trim();
  if (!trimmed) return [];

  const results: IdentifiedHash[] = [];
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
  const len = trimmed.length;

  // Prefix checks
  if (trimmed.startsWith('$2a$') || trimmed.startsWith('$2b$') || trimmed.startsWith('$2y$')) {
    results.push({
      name: 'Bcrypt (Blowfish)',
      hashcatMode: '-m 3200',
      johnFormat: 'bcrypt',
      bitLength: 192,
      description: 'Standard modern password hashing algorithm with configurable cost factor.',
      category: 'Password KDF',
    });
  }

  if (trimmed.startsWith('$6$')) {
    results.push({
      name: 'SHA-512 Unix Crypt',
      hashcatMode: '-m 1800',
      johnFormat: 'sha512crypt',
      bitLength: 512,
      description: 'Standard Linux /etc/shadow password hash format using SHA-512 rounds.',
      category: 'Unix Crypt',
    });
  }

  if (trimmed.startsWith('$5$')) {
    results.push({
      name: 'SHA-256 Unix Crypt',
      hashcatMode: '-m 7400',
      johnFormat: 'sha256crypt',
      bitLength: 256,
      description: 'Linux /etc/shadow password hash format using SHA-256 rounds.',
      category: 'Unix Crypt',
    });
  }

  if (trimmed.startsWith('$1$')) {
    results.push({
      name: 'MD5 Unix Crypt',
      hashcatMode: '-m 500',
      johnFormat: 'md5crypt',
      bitLength: 128,
      description: 'Legacy Apache htpasswd and old Linux shadow password hash.',
      category: 'Unix Crypt',
    });
  }

  if (trimmed.startsWith('$argon2id$') || trimmed.startsWith('$argon2i$')) {
    results.push({
      name: 'Argon2 (PHC Winner)',
      hashcatMode: '-m 13400',
      johnFormat: 'argon2',
      bitLength: 256,
      description: 'Memory-hard, state-of-the-art password hashing function.',
      category: 'Password KDF',
    });
  }

  if (trimmed.startsWith('$pbkdf2-sha256$') || trimmed.startsWith('$pbkdf2$')) {
    results.push({
      name: 'PBKDF2-HMAC-SHA256',
      hashcatMode: '-m 10900',
      johnFormat: 'pbkdf2-hmac-sha256',
      bitLength: 256,
      description: 'NIST standard key derivation function with SHA-256 iterations.',
      category: 'Password KDF',
    });
  }

  // Hex Length checks
  if (isHex) {
    if (len === 32) {
      results.push(
        {
          name: 'MD5',
          hashcatMode: '-m 0',
          johnFormat: 'raw-md5',
          bitLength: 128,
          description: '128-bit hash. Extremely fast, collision-vulnerable, standard web hash.',
          category: 'Legacy/Weak',
        },
        {
          name: 'NTLM (Windows)',
          hashcatMode: '-m 1000',
          johnFormat: 'nt',
          bitLength: 128,
          description: 'Windows Active Directory and SAM database password hash (MD4(UTF-16LE)).',
          category: 'Windows/NTLM',
        },
        {
          name: 'MD4',
          hashcatMode: '-m 900',
          johnFormat: 'raw-md4',
          bitLength: 128,
          description: '128-bit predecessor to MD5. Cryptographically broken.',
          category: 'Legacy/Weak',
        }
      );
    } else if (len === 40) {
      results.push(
        {
          name: 'SHA-1',
          hashcatMode: '-m 100',
          johnFormat: 'raw-sha1',
          bitLength: 160,
          description: '160-bit hash. Deprecated for digital signatures due to SHAttered collisions.',
          category: 'Legacy/Weak',
        },
        {
          name: 'MySQL 4.1+ (double SHA-1)',
          hashcatMode: '-m 300',
          johnFormat: 'mysql-sha1',
          bitLength: 160,
          description: 'MySQL password hash format (*HASH).',
          category: 'Legacy/Weak',
        }
      );
    } else if (len === 56) {
      results.push({
        name: 'SHA-224',
        hashcatMode: '-m 1300',
        johnFormat: 'raw-sha224',
        bitLength: 224,
        description: '224-bit truncated version of SHA-256.',
        category: 'Modern',
      });
    } else if (len === 64) {
      results.push(
        {
          name: 'SHA-256',
          hashcatMode: '-m 1400',
          johnFormat: 'raw-sha256',
          bitLength: 256,
          description: 'Standard 256-bit cryptographic digest from the SHA-2 family.',
          category: 'Modern',
        },
        {
          name: 'Keccak-256 (Ethereum)',
          hashcatMode: '-m 17800',
          johnFormat: 'keccak-256',
          bitLength: 256,
          description: 'Ethereum blockchain and smart contract hash function.',
          category: 'Modern',
        },
        {
          name: 'BLAKE2s-256',
          hashcatMode: '-m 17700',
          johnFormat: 'blake2s-256',
          bitLength: 256,
          description: 'High-speed cryptographic hash optimized for 32-bit platforms.',
          category: 'Modern',
        }
      );
    } else if (len === 96) {
      results.push({
        name: 'SHA-384',
        hashcatMode: '-m 10800',
        johnFormat: 'raw-sha384',
        bitLength: 384,
        description: '384-bit cryptographic digest from the SHA-2 family.',
        category: 'Modern',
      });
    } else if (len === 128) {
      results.push(
        {
          name: 'SHA-512',
          hashcatMode: '-m 1700',
          johnFormat: 'raw-sha512',
          bitLength: 512,
          description: '512-bit high-security digest from the SHA-2 family.',
          category: 'Modern',
        },
        {
          name: 'Whirlpool',
          hashcatMode: '-m 6100',
          johnFormat: 'whirlpool',
          bitLength: 512,
          description: '512-bit hash function recommended by NESSIE.',
          category: 'Modern',
        },
        {
          name: 'BLAKE2b-512',
          hashcatMode: '-m 600',
          johnFormat: 'blake2b-512',
          bitLength: 512,
          description: 'Fast 512-bit cryptographic hash optimized for 64-bit platforms.',
          category: 'Modern',
        }
      );
    } else if (len === 16) {
      results.push({
        name: 'MySQL 3.23 / Old Password',
        hashcatMode: '-m 200',
        johnFormat: 'mysql',
        bitLength: 64,
        description: 'Very weak legacy 16-character MySQL password hash.',
        category: 'Legacy/Weak',
      });
    }
  }

  return results;
}
