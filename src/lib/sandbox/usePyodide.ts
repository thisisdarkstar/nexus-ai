import { useState, useEffect, useRef, useCallback } from 'react';
import type { SandboxExecutionResult } from '../../types';

export interface SecurityScriptPreset {
  id: string;
  name: string;
  category: 'analysis' | 'crypto' | 'forensics' | 'deobfuscate';
  description: string;
  code: string;
}

export const SECURITY_SCRIPT_PRESETS: SecurityScriptPreset[] = [
  {
    id: 'entropy_analyzer',
    name: 'Shannon Entropy & Byte Scanner',
    category: 'analysis',
    description: 'Calculate Shannon entropy to determine if a payload or string is packed/encrypted (>7.0).',
    code: `import math
from collections import Counter

def calculate_entropy(data: str):
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
    return entropy

sample_payload = """TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA4fug4AtAnNIbgBTM0hVGhpcyBwcm9ncmFtIGNhbm5vdCBiZSBydW4gaW4gRE9TIG1vZGUuDQ0KJAAAAAAAAABQRQAATAEDAAAAAAAAAAAA"""
entropy = calculate_entropy(sample_payload)

print("=" * 45)
print(f"[*] Analyzing Payload Length: {len(sample_payload)} bytes")
print(f"[+] Shannon Entropy: {entropy:.4f} bits/byte")
if entropy > 7.0:
    print("[!] Assessment: HIGH ENTROPY -> Likely encrypted, compressed, or packed shellcode.")
elif entropy > 5.5:
    print("[*] Assessment: MODERATE ENTROPY -> Code or formatted data.")
else:
    print("[*] Assessment: LOW ENTROPY -> Standard plaintext or repetitive structure.")
print("=" * 45)
`,
  },
  {
    id: 'xor_decoder',
    name: 'Single/Multi-Byte XOR Decryptor',
    category: 'deobfuscate',
    description: 'Brute-force single-byte XOR keys and check for human-readable ASCII or PE signatures.',
    code: `def xor_decrypt(ciphertext: bytes, key: int) -> bytes:
    return bytes([b ^ key for b in ciphertext])

# Example hex-encoded obfuscated string
hex_data = "1c17170a405f5f130b0a1d0d5f1d0b0a"
raw_bytes = bytes.fromhex(hex_data)

print(f"[*] Brute-forcing 1-byte XOR keys on: {hex_data}")
print("-" * 50)

for key in range(256):
    decrypted = xor_decrypt(raw_bytes, key)
    # Check if printable ASCII
    if all(32 <= b <= 126 for b in decrypted):
        decoded_text = decrypted.decode('ascii', errors='ignore')
        print(f"[+] Key 0x{key:02X} ({key:3d}): '{decoded_text}'")
`,
  },
  {
    id: 'ioc_extractor',
    name: 'Log & IoC Regex Extractor',
    category: 'forensics',
    description: 'Extract IP addresses, URLs, domains, and SHA-256 hashes from raw log text.',
    code: `import re

log_sample = """
2026-08-20T10:15:32Z Connection established to 198.51.100.42:443
HTTP GET http://malicious-c2-server.com/stage2.bin
Hash: 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
Fallback beacon to 203.0.113.195 and backup domain http://exfil.threat-actor.org/upload
"""

ip_pattern = r'\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b'
url_pattern = r'https?://[a-zA-Z0-9.-]+(?:/[^\\s]*)?'
hash_pattern = r'\\b[a-fA-F0-9]{64}\\b'

ips = set(re.findall(ip_pattern, log_sample))
urls = set(re.findall(url_pattern, log_sample))
hashes = set(re.findall(hash_pattern, log_sample))

print("[*] Indicators of Compromise (IoCs) Extracted:")
print(f"  [+] IP Addresses ({len(ips)}): {list(ips)}")
print(f"  [+] URLs ({len(urls)}): {list(urls)}")
print(f"  [+] SHA-256 Hashes ({len(hashes)}): {list(hashes)}")
`,
  },
  {
    id: 'jwt_bruteforce',
    name: 'JWT HS256 Secret Verifier',
    category: 'crypto',
    description: 'Verify HMAC-SHA256 JWT signature using Python standard hmac and hashlib.',
    code: `import hmac
import hashlib
import base64
import json

sample_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o"

def verify_jwt(token: str, secret: str) -> bool:
    parts = token.split('.')
    if len(parts) != 3:
        return False
    header_b64, payload_b64, sig_b64 = parts
    
    # Base64Url decode helper
    def b64url_decode(s):
        s += '=' * (-len(s) % 4)
        return base64.urlsafe_b64decode(s)
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    computed_sig = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
    computed_sig_b64 = base64.urlsafe_b64encode(computed_sig).decode('utf-8').rstrip('=')
    
    return hmac.compare_digest(computed_sig_b64, sig_b64.rstrip('='))

# Test dictionary words
test_secret = "secret"
is_valid = verify_jwt(sample_jwt, test_secret)
print(f"[*] Testing secret '{test_secret}' on sample token...")
print(f"[+] Signature Valid: {is_valid}")
`,
  },
];

export function usePyodide() {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<SandboxExecutionResult>({
    status: 'idle',
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  });
  const [logs, setLogs] = useState<
    Array<{ id: string; timestamp: number; code: string; result: SandboxExecutionResult }>
  >([]);

  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<
    Map<string, { resolve: (res: SandboxExecutionResult) => void; reject: (err: Error) => void }>
  >(new Map());

  useEffect(() => {
    try {
      const worker = new Worker(new URL('./pyodideWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const { id, type, stdout, stderr, result, error, executionTimeMs } = e.data;

        if (type === 'INIT_SUCCESS') {
          setIsReady(true);
          setIsInitializing(false);
        } else if (type === 'INIT_ERROR') {
          setIsReady(false);
          setIsInitializing(false);
          console.error('Pyodide Worker init error:', error);
          setLastResult((prev) => ({
            ...prev,
            status: 'error',
            stderr: `[Initialization Notice]: Pyodide runtime loading from CDN. ${error || ''}`,
          }));
        } else if (type === 'RUN_SUCCESS') {
          const res: SandboxExecutionResult = {
            status: 'success',
            stdout: stdout || '',
            stderr: stderr || '',
            result: result || '',
            executionTimeMs: executionTimeMs || 0,
          };
          setLastResult(res);
          setIsExecuting(false);
          const req = pendingRequests.current.get(id);
          if (req) {
            req.resolve(res);
            pendingRequests.current.delete(id);
          }
        } else if (type === 'RUN_ERROR') {
          const res: SandboxExecutionResult = {
            status: 'error',
            stdout: stdout || '',
            stderr: error || 'Execution failed',
            executionTimeMs: executionTimeMs || 0,
          };
          setLastResult(res);
          setIsExecuting(false);
          const req = pendingRequests.current.get(id);
          if (req) {
            req.resolve(res);
            pendingRequests.current.delete(id);
          }
        }
      };

      setIsInitializing(true);
      worker.postMessage({ id: 'init', type: 'INIT' });

      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.error('Failed to create Pyodide worker:', err);
      setIsInitializing(false);
      setIsReady(false);
    }
  }, []);

  const executeCode = useCallback(
    async (code: string, timeoutMs = 15000): Promise<SandboxExecutionResult> => {
      if (!workerRef.current) {
        const errorResult: SandboxExecutionResult = {
          status: 'error',
          stdout: '',
          stderr: 'Sandbox worker could not be initialized in this browser environment.',
          executionTimeMs: 0,
        };
        setLastResult(errorResult);
        return errorResult;
      }

      setIsExecuting(true);
      setLastResult({
        status: 'running',
        stdout: isReady ? '[*] Running in Pyodide WebAssembly sandbox...' : '[*] Initializing Pyodide Python 3.12 runtime from CDN... please wait...',
        stderr: '',
        executionTimeMs: 0,
      });

      const reqId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      return new Promise<SandboxExecutionResult>((resolve, reject) => {
        pendingRequests.current.set(reqId, { resolve, reject });
        workerRef.current?.postMessage({
          id: reqId,
          type: 'RUN',
          code,
          timeoutMs,
        });
      }).then((res) => {
        setIsReady(true);
        setLogs((prev) => [
          {
            id: reqId,
            timestamp: Date.now(),
            code,
            result: res,
          },
          ...prev.slice(0, 20),
        ]);
        return res;
      });
    },
    [isReady]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    setLastResult({
      status: 'idle',
      stdout: '',
      stderr: '',
      executionTimeMs: 0,
    });
  }, []);

  return {
    isReady,
    isInitializing,
    isExecuting,
    lastResult,
    logs,
    executeCode,
    clearLogs,
    presets: SECURITY_SCRIPT_PRESETS,
  };
}
