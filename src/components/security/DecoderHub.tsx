import { useState, useMemo, useEffect } from 'react';
import {
  ArrowRightLeft,
  ArrowDownUp,
  Sparkles,
  Lock,
  Unlock,
  Copy,
  Check,
  RotateCcw,
  FileCode,
} from 'lucide-react';
import {
  calculateShannonEntropy,
  calculateHashes,
  identifyHashTypes,
  parseJWT,
  defang,
  refang,
  reverseString,
} from '../../lib/security/transformers';
import CustomSelect from '../CustomSelect';
import {
  DECODER_PRESET_OPTIONS,
  DECODER_PRESETS,
} from '../../data/security/decoderRecipes';
import QuickTransformGrid from './decoder/QuickTransformGrid';
import JwtInspectorPanel from './decoder/JwtInspectorPanel';
import HashCalculatorPanel from './decoder/HashCalculatorPanel';
import styles from './DecoderHub.module.css';

interface DecoderHubProps {
  initialInput?: string;
  /** Bumped per dispatch so identical input re-applies instead of being skipped */
  initialInputNonce?: number;
  onSendToSandbox?: (code: string) => void;
  onSendToAI?: (prompt: string) => void;
}

const DECODER_INPUT_STORAGE_KEY = 'nexus_security_decoder_input';
const DECODER_OUTPUT_STORAGE_KEY = 'nexus_security_decoder_output';

export default function DecoderHub({
  initialInput = '',
  initialInputNonce,
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

  // Sync when parent passes a new initialInput (e.g. "Decode" from chat code block)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
      setOutput('');
      setLastAction('');
    }
    // initialInputNonce forces re-apply even when initialInput is unchanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInput, initialInputNonce]);

  const [output, setOutput] = useState(() => {
    try {
      return localStorage.getItem(DECODER_OUTPUT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [lastAction, setLastAction] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DECODER_INPUT_STORAGE_KEY, input);
      localStorage.setItem(DECODER_OUTPUT_STORAGE_KEY, output);
    } catch (e) {
      console.error(e);
    }
  }, [input, output]);

  const entropy = useMemo(() => calculateShannonEntropy(input), [input]);
  const outputEntropy = useMemo(() => calculateShannonEntropy(output), [output]);

  const entropyAssessment = useMemo(() => {
    if (entropy === 0) return { label: 'Empty', color: 'slate' };
    if (entropy < 3.5) return { label: 'Low (Plaintext / Sparse)', color: 'blue' };
    if (entropy < 5.0) return { label: 'Medium (Code / Structured JSON)', color: 'emerald' };
    if (entropy < 7.0) return { label: 'High (Base64 / Obfuscated)', color: 'amber' };
    return { label: 'Very High (Encrypted / Compressed / Shellcode)', color: 'rose' };
  }, [entropy]);

  const hashes = useMemo(() => calculateHashes(input), [input]);
  const identifiedHashes = useMemo(() => identifyHashTypes(input.trim()), [input]);
  const activeJWT = useMemo(() => parseJWT(input) || (output ? parseJWT(output) : null), [input, output]);

  const handleTransform = (actionName: string, transformFn: (text: string) => string) => {
    try {
      const res = transformFn(input);
      setOutput(res);
      setLastAction(actionName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`// Error executing ${actionName}:\n// ${msg}`);
      setLastAction(`Error: ${actionName}`);
    }
  };

  const handleSwap = () => {
    const prevInput = input;
    setInput(output);
    setOutput(prevInput);
    setLastAction('Swapped Input ⇄ Output');
  };

  const handleUseOutputAsInput = () => {
    setInput(output);
    setOutput('');
    setLastAction('Piped Output ➔ Input');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleAIDeobfuscate = () => {
    const payloadToAnalyze = (input.trim() || output.trim() || DECODER_PRESETS.base64_payload).trim();
    const prompt = `I am analyzing an obfuscated security payload in the 2-Way Decoders Hub:

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

        {/* 2-Way Split Panes */}
        <div className={styles.panesGrid}>
          {/* Left Pane: Input */}
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

            {/* Quick Helper Tools */}
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

          {/* Center Swap Controls */}
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

          {/* Right Pane: Output */}
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
              onChange={(e) => setOutput(e.target.value)}
              placeholder="Transformed result will appear here. You can also edit this directly before chaining..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* 2-Way Transformation Grid */}
        <QuickTransformGrid onTransform={handleTransform} />
      </div>

      {/* JWT Inspector Panel */}
      <JwtInspectorPanel jwt={activeJWT} onAuditWithAI={handleAIJWTAudit} />

      {/* Hash Calculator & Hash Identifier Panel */}
      <HashCalculatorPanel
        hashes={hashes}
        identifiedHashes={identifiedHashes}
        onAuditWithAI={handleAIHashAnalysis}
      />
    </div>
  );
}
