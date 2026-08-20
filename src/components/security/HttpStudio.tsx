import { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Code2,
  Bug,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Layers,
  FileCode,
  Zap,
} from 'lucide-react';
import styles from './HttpStudio.module.css';

interface HttpStudioProps {
  onSendToAI: (prompt: string) => void;
}

const PRESET_REQUESTS = {
  auth_login: `POST /api/v1/auth/login HTTP/1.1
Host: api.target-system.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Content-Type: application/json
Accept: application/json
Origin: https://app.target-system.com
Referer: https://app.target-system.com/login
X-Forwarded-For: 127.0.0.1
Cookie: session_id=sess_83921049281; auth_token=jwt_eyJh...

{
  "username": "admin@target-system.com",
  "password": "Password123!",
  "rememberMe": true,
  "redirect_url": "https://app.target-system.com/dashboard"
}`,

  idor_transaction: `GET /api/v2/transactions/98231?account_id=ACC-4091&format=json&include_receipts=true HTTP/1.1
Host: bank.acme-financial.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
X-Client-Version: 2.4.0
Cookie: user_lang=en-US`,

  ssrf_webhook: `POST /api/webhooks/test HTTP/1.1
Host: cloud.enterprise-app.io
Content-Type: application/x-www-form-urlencoded
Authorization: ApiKey key_live_9482941094

url=http://169.254.169.254/latest/meta-data/iam/security-credentials/&event_type=user.created&retry_count=3`,

  graphql_query: `POST /graphql HTTP/1.1
Host: api.shop-platform.net
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...

{
  "query": "query GetUserProfile($id: ID!) { user(id: $id) { id email role creditCards { number cvv } } }",
  "variables": {
    "id": "10029"
  }
}`,
};

interface HttpResponseState {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
}

const HTTP_REQUEST_STORAGE_KEY = 'nexus_security_http_request';

export default function HttpStudio({ onSendToAI }: HttpStudioProps) {
  const [rawText, setRawText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(HTTP_REQUEST_STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {
      console.error('Failed to load http request from localStorage:', e);
    }
    return PRESET_REQUESTS.auth_login;
  });

  useEffect(() => {
    try {
      localStorage.setItem(HTTP_REQUEST_STORAGE_KEY, rawText);
    } catch (e) {
      console.error('Failed to save http request to localStorage:', e);
    }
  }, [rawText]);

  const [leftTab, setLeftTab] = useState<'raw' | 'headers' | 'params' | 'body' | 'cookies'>('raw');
  const [rightTab, setRightTab] = useState<'response' | 'code' | 'security' | 'fuzz'>('response');
  const [codeLang, setCodeLang] = useState<'curl' | 'python' | 'javascript' | 'go' | 'powershell'>('curl');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Parse Raw HTTP Request
  const parsed = useMemo(() => {
    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    const firstLine = lines[0] || 'GET / HTTP/1.1';
    const firstLineParts = firstLine.trim().split(/\s+/);

    const method = firstLineParts[0]?.toUpperCase() || 'GET';
    const path = firstLineParts[1] || '/';
    const protocol = firstLineParts[2] || 'HTTP/1.1';

    const headers: Array<{ key: string; value: string }> = [];
    const cookies: Array<{ key: string; value: string }> = [];
    let host = 'localhost';
    let bodyIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyIndex = i + 1;
        break;
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers.push({ key, value });
        if (key.toLowerCase() === 'host') {
          host = value;
        }
        if (key.toLowerCase() === 'cookie') {
          value.split(';').forEach((c) => {
            const [ck, ...cv] = c.trim().split('=');
            if (ck) cookies.push({ key: ck, value: cv.join('=') });
          });
        }
      }
    }

    const body = bodyIndex !== -1 ? lines.slice(bodyIndex).join('\n') : '';

    // Query params
    const queryParams: Array<{ key: string; value: string }> = [];
    const qIndex = path.indexOf('?');
    if (qIndex !== -1) {
      const qs = path.substring(qIndex + 1);
      const searchParams = new URLSearchParams(qs);
      searchParams.forEach((v, k) => {
        queryParams.push({ key: k, value: v });
      });
    }

    const isHttps = !host.includes('localhost') && !host.startsWith('127.0.0.1');
    const fullUrl = `${isHttps ? 'https' : 'http'}://${host}${path}`;

    return {
      method,
      path,
      host,
      protocol,
      fullUrl,
      headers,
      cookies,
      queryParams,
      body,
    };
  }, [rawText]);

  // Live Response Simulation / Real Replayer
  const [response, setResponse] = useState<HttpResponseState>({
    status: 200,
    statusText: 'OK',
    timeMs: 42,
    sizeBytes: 1048,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      server: 'nginx/1.24.0',
      date: new Date().toUTCString(),
      'x-powered-by': 'Express',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(
      {
        success: true,
        message: 'Request processed successfully by endpoint',
        target: parsed.fullUrl,
        timestamp: Date.now(),
        authenticated: true,
        user: {
          id: 'USR-89410',
          role: 'administrator',
          email: 'admin@target-system.com',
          permissions: ['read:all', 'write:all', 'admin:system'],
        },
      },
      null,
      2
    ),
  });

  const handleSendRequest = async () => {
    setIsSending(true);
    const start = performance.now();
    try {
      // Attempt real fetch if possible, or provide high-fidelity security simulated response
      const headersObj: Record<string, string> = {};
      parsed.headers.forEach((h) => {
        if (h.key.toLowerCase() !== 'host') headersObj[h.key] = h.value;
      });

      const res = await fetch(parsed.fullUrl, {
        method: parsed.method,
        headers: headersObj,
        body: ['GET', 'HEAD'].includes(parsed.method) ? undefined : parsed.body || undefined,
        mode: 'cors',
      });

      const timeMs = Math.round(performance.now() - start);
      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        timeMs,
        sizeBytes: text.length,
        headers: resHeaders,
        body: text,
      });
    } catch {
      // CORS or simulated offline response
      const timeMs = Math.round(performance.now() - start + 25);
      setResponse({
        status: 200,
        statusText: 'OK (Mocked / Replayed)',
        timeMs,
        sizeBytes: 890,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          server: 'nginx/1.24.0 (Simulated)',
          'x-ratelimit-remaining': '99',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify(
          {
            status: 200,
            endpoint: parsed.fullUrl,
            method: parsed.method,
            parametersReceived: parsed.queryParams,
            headersReceived: parsed.headers.length,
            bodyReceived: parsed.body ? parsed.body.length : 0,
            notice: 'Direct browser CORS blocked external origin; simulated response returned.',
          },
          null,
          2
        ),
      });
    } finally {
      setIsSending(false);
      setRightTab('response');
    }
  };

  // Code Exporters
  const codeSnippets = useMemo(() => {
    // cURL
    let curl = `curl -X ${parsed.method} "${parsed.fullUrl}"`;
    parsed.headers.forEach((h) => {
      if (h.key.toLowerCase() !== 'host') {
        curl += ` \\\n  -H "${h.key}: ${h.value.replace(/"/g, '\\"')}"`;
      }
    });
    if (parsed.body.trim()) {
      curl += ` \\\n  --data-raw '${parsed.body.replace(/'/g, "'\\''")}'`;
    }

    // Python requests
    const pyHeaders = Object.fromEntries(
      parsed.headers.filter((h) => h.key.toLowerCase() !== 'host').map((h) => [h.key, h.value])
    );
    let python = `import requests\n\nurl = "${parsed.fullUrl}"\nheaders = ${JSON.stringify(pyHeaders, null, 4)}\n\n`;
    if (parsed.body.trim()) {
      try {
        const j = JSON.parse(parsed.body);
        python += `json_data = ${JSON.stringify(j, null, 4)}\n\nresponse = requests.${parsed.method.toLowerCase()}(url, headers=headers, json=json_data)\n`;
      } catch {
        python += `data = """${parsed.body}"""\n\nresponse = requests.${parsed.method.toLowerCase()}(url, headers=headers, data=data)\n`;
      }
    } else {
      python += `response = requests.${parsed.method.toLowerCase()}(url, headers=headers)\n`;
    }
    python += `print(response.status_code)\nprint(response.text)\n`;

    // JavaScript fetch
    const jsFetch = `fetch("${parsed.fullUrl}", {
  method: "${parsed.method}",
  headers: ${JSON.stringify(pyHeaders, null, 4)},
  body: ${parsed.body.trim() ? JSON.stringify(parsed.body) : 'undefined'}
})
  .then(res => res.text())
  .then(console.log)
  .catch(console.error);`;

    // Go
    const go = `package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"strings"
)

func main() {
\turl := "${parsed.fullUrl}"
\treq, _ := http.NewRequest("${parsed.method}", url, strings.NewReader(\`${parsed.body}\`))
${parsed.headers
  .filter((h) => h.key.toLowerCase() !== 'host')
  .map((h) => `\treq.Header.Set("${h.key}", "${h.value.replace(/"/g, '\\"')}")`)
  .join('\n')}

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tbody, _ := io.ReadAll(res.Body)
\tfmt.Printf("%d\\n%s\\n", res.StatusCode, string(body))
}`;

    // PowerShell
    const ps = `Invoke-RestMethod -Uri "${parsed.fullUrl}" -Method ${parsed.method} -Headers @{\n${parsed.headers
      .filter((h) => h.key.toLowerCase() !== 'host')
      .map((h) => `  "${h.key}" = "${h.value.replace(/"/g, '`"')}"`)
      .join('\n')}\n}${parsed.body.trim() ? ` -Body '${parsed.body.replace(/'/g, "''")}'` : ''}`;

    return {
      curl,
      python,
      javascript: jsFetch,
      go,
      powershell: ps,
    };
  }, [parsed]);

  // Security Analysis Checks
  const securityAnalysis = useMemo(() => {
    const findings: Array<{ type: 'pass' | 'warn' | 'fail'; title: string; desc: string }> = [];
    const headerKeys = parsed.headers.map((h) => h.key.toLowerCase());

    if (parsed.fullUrl.startsWith('http://')) {
      findings.push({
        type: 'fail',
        title: 'Insecure Cleartext Transport (HTTP)',
        desc: 'Request is transmitted over plain unencrypted HTTP, exposing credentials and session tokens to interception.',
      });
    } else {
      findings.push({
        type: 'pass',
        title: 'Encrypted HTTPS Transport',
        desc: 'Transport layer encryption (TLS) is active for this endpoint.',
      });
    }

    if (headerKeys.includes('x-forwarded-for') || headerKeys.includes('x-real-ip') || headerKeys.includes('x-originating-ip')) {
      findings.push({
        type: 'warn',
        title: 'Client-Controlled IP Spoofing Headers',
        desc: 'Request supplies `X-Forwarded-For` or `X-Real-IP`. Check if the backend trusts these headers for rate limiting or IP whitelisting.',
      });
    }

    if (parsed.path.includes('?')) {
      const hasSecrets = /token|auth|key|secret|password|api_key/i.test(parsed.path);
      if (hasSecrets) {
        findings.push({
          type: 'fail',
          title: 'Sensitive Tokens in Query String',
          desc: 'Authentication credentials or secrets are present in GET query parameters, risking browser history and proxy log leakage.',
        });
      }
    }

    if (parsed.queryParams.some((q) => /id|user_id|account_id|doc_id/i.test(q.key))) {
      findings.push({
        type: 'warn',
        title: 'Potential BOLA / IDOR Parameter Detected',
        desc: 'Found numeric/object IDs in parameters. Test with unauthorized tokens to verify horizontal access controls.',
      });
    }

    return findings;
  }, [parsed]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFormatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(parsed.body), null, 2);
      const lines = rawText.replace(/\r\n/g, '\n').split('\n');
      let bodyIndex = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') {
          bodyIndex = i + 1;
          break;
        }
      }
      if (bodyIndex !== -1) {
        const headerPart = lines.slice(0, bodyIndex).join('\n');
        setRawText(`${headerPart}\n${formatted}`);
      }
    } catch {
      // invalid json
    }
  };

  const handleAuditRequest = () => {
    const prompt = `Perform an in-depth Penetration Testing & API Security Audit on this raw HTTP request:

\`\`\`http
${rawText}
\`\`\`

Target: ${parsed.fullUrl}
Method: ${parsed.method}

Please assess:
1. **Authentication & Authorization**: Is there any BOLA/IDOR or Privilege Escalation vector in the parameters/paths?
2. **Input Validation & Injections**: Check for SQLi, SSRF, Command Injection, and NoSQLi vulnerability potential.
3. **Transport & Header Security**: Identify missing defense headers or dangerous header spoofing.
4. **Actionable Verification Steps**: Provide 3 high-yield test payloads to verify these vectors.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.httpContainer}>
      {/* Top URL / Method / Send Bar */}
      <div className={styles.urlBar}>
        <span
          className={`${styles.methodSelect} ${
            styles[`method${parsed.method}`] || styles.methodGET
          }`}
        >
          {parsed.method}
        </span>

        <input
          className={styles.urlInput}
          value={parsed.fullUrl}
          readOnly
          title="Target Endpoint URL"
        />

        <select
          className={styles.presetSelect}
          onChange={(e) => {
            const val = e.target.value as keyof typeof PRESET_REQUESTS;
            if (PRESET_REQUESTS[val]) setRawText(PRESET_REQUESTS[val]);
          }}
        >
          <option value="auth_login">Preset: JSON Login API (POST)</option>
          <option value="idor_transaction">Preset: IDOR / BOLA Endpoint (GET)</option>
          <option value="ssrf_webhook">Preset: SSRF Cloud Webhook (POST)</option>
          <option value="graphql_query">Preset: GraphQL Information Leak (POST)</option>
        </select>

        <button
          className={`${styles.btn} ${styles.btnSend}`}
          onClick={handleSendRequest}
          disabled={isSending}
        >
          <Play size={13} fill="currentColor" /> {isSending ? 'Sending...' : 'Send / Replay'}
        </button>

        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAuditRequest}>
          <Sparkles size={13} /> AI Security Audit
        </button>
      </div>

      {/* Main Dual-Pane Layout */}
      <div className={styles.editorGrid}>
        {/* Left: Request Composer */}
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <div className={styles.subTabs}>
              <button
                className={`${styles.subTabBtn} ${leftTab === 'raw' ? styles.active : ''}`}
                onClick={() => setLeftTab('raw')}
              >
                Raw HTTP
              </button>
              <button
                className={`${styles.subTabBtn} ${leftTab === 'headers' ? styles.active : ''}`}
                onClick={() => setLeftTab('headers')}
              >
                Headers ({parsed.headers.length})
              </button>
              <button
                className={`${styles.subTabBtn} ${leftTab === 'params' ? styles.active : ''}`}
                onClick={() => setLeftTab('params')}
              >
                Params ({parsed.queryParams.length})
              </button>
              <button
                className={`${styles.subTabBtn} ${leftTab === 'body' ? styles.active : ''}`}
                onClick={() => setLeftTab('body')}
              >
                Body
              </button>
              <button
                className={`${styles.subTabBtn} ${leftTab === 'cookies' ? styles.active : ''}`}
                onClick={() => setLeftTab('cookies')}
              >
                Cookies ({parsed.cookies.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {leftTab === 'body' && (
                <button className={styles.btn} onClick={handleFormatJson} title="Beautify JSON Body">
                  <FileCode size={12} /> Format
                </button>
              )}
              <button
                className={styles.btn}
                onClick={() => setRawText(PRESET_REQUESTS.auth_login)}
                title="Reset Request"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          <div className={styles.paneBody}>
            {leftTab === 'raw' && (
              <textarea
                className={styles.rawEditor}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw HTTP request (Burp / ZAP / cURL)..."
                spellCheck={false}
              />
            )}

            {leftTab === 'headers' && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Header Name</th>
                      <th>Header Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.headers.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: '#38bdf8' }}>{h.key}</td>
                        <td>{h.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {leftTab === 'params' && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Parameter Name</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.queryParams.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                          No query parameters detected in URL path
                        </td>
                      </tr>
                    ) : (
                      parsed.queryParams.map((p, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: '#10b981' }}>{p.key}</td>
                          <td>{p.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {leftTab === 'body' && (
              <textarea
                className={styles.rawEditor}
                value={parsed.body}
                onChange={(e) => {
                  const newBody = e.target.value;
                  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
                  let bodyIndex = -1;
                  for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '') {
                      bodyIndex = i + 1;
                      break;
                    }
                  }
                  if (bodyIndex !== -1) {
                    const headerPart = lines.slice(0, bodyIndex).join('\n');
                    setRawText(`${headerPart}\n${newBody}`);
                  }
                }}
                placeholder="Request body (JSON / Form data / Raw)..."
                spellCheck={false}
              />
            )}

            {leftTab === 'cookies' && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Cookie Name</th>
                      <th>Cookie Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.cookies.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                          No cookies detected in request
                        </td>
                      </tr>
                    ) : (
                      parsed.cookies.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: '#fbbf24' }}>{c.key}</td>
                          <td>{c.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Response / Code / Security / Fuzz */}
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <div className={styles.subTabs}>
              <button
                className={`${styles.subTabBtn} ${rightTab === 'response' ? styles.active : ''}`}
                onClick={() => setRightTab('response')}
              >
                <Zap size={12} /> Live Response
              </button>
              <button
                className={`${styles.subTabBtn} ${rightTab === 'code' ? styles.active : ''}`}
                onClick={() => setRightTab('code')}
              >
                <Code2 size={12} /> Code Exporters
              </button>
              <button
                className={`${styles.subTabBtn} ${rightTab === 'security' ? styles.active : ''}`}
                onClick={() => setRightTab('security')}
              >
                <ShieldAlert size={12} /> Security Checks ({securityAnalysis.length})
              </button>
              <button
                className={`${styles.subTabBtn} ${rightTab === 'fuzz' ? styles.active : ''}`}
                onClick={() => setRightTab('fuzz')}
              >
                <Bug size={12} /> Fuzz Matrix
              </button>
            </div>

            <button
              className={styles.btn}
              onClick={() => {
                const textToCopy =
                  rightTab === 'response'
                    ? response.body
                    : rightTab === 'code'
                    ? codeSnippets[codeLang]
                    : rawText;
                handleCopy(textToCopy);
              }}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className={styles.paneBody}>
            {/* Live Response Tab */}
            {rightTab === 'response' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span
                    className={`${styles.statusBadge} ${
                      response.status >= 200 && response.status < 300
                        ? styles.status2xx
                        : response.status >= 300 && response.status < 400
                        ? styles.status3xx
                        : response.status >= 400 && response.status < 500
                        ? styles.status4xx
                        : styles.status5xx
                    }`}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    ⏱️ {response.timeMs} ms
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    📦 {response.sizeBytes} B
                  </span>
                </div>

                <pre className={styles.codeBox}>{response.body}</pre>
              </div>
            )}

            {/* Code Exporter Tab */}
            {rightTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
                <div className={styles.subTabs} style={{ alignSelf: 'flex-start' }}>
                  {(['curl', 'python', 'javascript', 'go', 'powershell'] as const).map((lang) => (
                    <button
                      key={lang}
                      className={`${styles.subTabBtn} ${codeLang === lang ? styles.active : ''}`}
                      onClick={() => setCodeLang(lang)}
                    >
                      {lang === 'javascript' ? 'Fetch (JS)' : lang.toUpperCase()}
                    </button>
                  ))}
                </div>

                <pre className={styles.codeBox}>{codeSnippets[codeLang]}</pre>
              </div>
            )}

            {/* Security Analysis Tab */}
            {rightTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {securityAnalysis.map((item, i) => (
                  <div key={i} className={`${styles.securityCard} ${styles[item.type]}`}>
                    {item.type === 'pass' ? (
                      <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : item.type === 'warn' ? (
                      <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                        {item.title}
                      </div>
                      <div style={{ color: '#94a3b8', lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fuzz Matrix Tab */}
            {rightTab === 'fuzz' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className={styles.fuzzCard}>
                  <div className={styles.fuzzHeader}>
                    <span style={{ color: '#f87171' }}>🔴 SQL Injection Payloads</span>
                  </div>
                  {["' OR '1'='1' -- -", "admin' --", "1' UNION SELECT null,version(),user()--"].map((p, i) => (
                    <div key={i} className={styles.fuzzItem}>
                      <code>{p}</code>
                      <button className={styles.btn} onClick={() => handleCopy(p)}>Copy</button>
                    </div>
                  ))}
                </div>

                <div className={styles.fuzzCard}>
                  <div className={styles.fuzzHeader}>
                    <span style={{ color: '#fbbf24' }}>🟠 SSRF & Cloud Metadata</span>
                  </div>
                  {["http://169.254.169.254/latest/meta-data/", "http://2852039166/", "http://0xa9.0xfe.0xa9.0xfe/"].map((p, i) => (
                    <div key={i} className={styles.fuzzItem}>
                      <code>{p}</code>
                      <button className={styles.btn} onClick={() => handleCopy(p)}>Copy</button>
                    </div>
                  ))}
                </div>

                <div className={styles.fuzzCard}>
                  <div className={styles.fuzzHeader}>
                    <span style={{ color: '#60a5fa' }}>🟡 Cross-Site Scripting (XSS)</span>
                  </div>
                  {['"><script>alert(origin)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(document.cookie)'].map((p, i) => (
                    <div key={i} className={styles.fuzzItem}>
                      <code>{p}</code>
                      <button className={styles.btn} onClick={() => handleCopy(p)}>Copy</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
