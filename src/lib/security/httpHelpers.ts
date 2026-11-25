export interface HttpHeader {
  key: string;
  value: string;
}

export interface ParsedHttpRequest {
  method: string;
  path: string;
  host: string;
  protocol: string;
  fullUrl: string;
  headers: HttpHeader[];
  cookies: HttpHeader[];
  queryParams: HttpHeader[];
  body: string;
}

export interface HttpResponseState {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
}

export interface HttpCodeSnippets {
  curl: string;
  python: string;
  javascript: string;
  go: string;
  powershell: string;
}

export interface SecurityFindingHint {
  type: 'pass' | 'warn' | 'fail';
  title: string;
  desc: string;
}

export interface DiffLine {
  type: 'same' | 'add' | 'rem';
  line: string;
}

/**
 * Parses a raw HTTP/1.1 request block into structured fields.
 */
export function parseRawHttpRequest(rawText: string): ParsedHttpRequest {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const firstLine = lines[0] || 'GET / HTTP/1.1';
  const firstLineParts = firstLine.trim().split(/\s+/);

  const method = firstLineParts[0]?.toUpperCase() || 'GET';
  const path = firstLineParts[1] || '/';
  const protocol = firstLineParts[2] || 'HTTP/1.1';

  const headers: HttpHeader[] = [];
  const cookies: HttpHeader[] = [];
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

  const queryParams: HttpHeader[] = [];
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
}

/**
 * Generates runnable HTTP client snippets across cURL, Python, JS, Go, and PowerShell.
 */
export function generateHttpCodeSnippets(parsed: ParsedHttpRequest): HttpCodeSnippets {
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
  const javascript = `fetch("${parsed.fullUrl}", {
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
  const powershell = `Invoke-RestMethod -Uri "${parsed.fullUrl}" -Method ${parsed.method} -Headers @{\n${parsed.headers
    .filter((h) => h.key.toLowerCase() !== 'host')
    .map((h) => `  "${h.key}" = "${h.value.replace(/"/g, '`"')}"`)
    .join('\n')}\n}${parsed.body.trim() ? ` -Body '${parsed.body.replace(/'/g, "''")}'` : ''}`;

  return {
    curl,
    python,
    javascript,
    go,
    powershell,
  };
}

/**
 * Inspects a parsed HTTP request for transport, spoofing, token-leak, and BOLA/IDOR risks.
 */
export function analyzeHttpSecurity(parsed: ParsedHttpRequest): SecurityFindingHint[] {
  const findings: SecurityFindingHint[] = [];
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

  if (
    headerKeys.includes('x-forwarded-for') ||
    headerKeys.includes('x-real-ip') ||
    headerKeys.includes('x-originating-ip')
  ) {
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
}

/**
 * Computes a line-by-line diff between a baseline response body and current response body.
 */
export function computeResponseDiff(
  baselineBody: string | null | undefined,
  currentBody: string
): DiffLine[] {
  if (!baselineBody) return [];
  const oldLines = baselineBody.split('\n');
  const newLines = currentBody.split('\n');
  const diff: DiffLine[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) diff.push({ type: 'same', line: o });
    } else {
      if (o !== undefined) diff.push({ type: 'rem', line: o });
      if (n !== undefined) diff.push({ type: 'add', line: n });
    }
  }
  return diff;
}
