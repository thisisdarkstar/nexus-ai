import { useState, useMemo, useEffect } from 'react';
import {
  BLANK_REQUEST,
  PRESET_REQUESTS,
} from '../../data/security/httpDefaultPresets';
import RequestUrlBar from './http-studio/RequestUrlBar';
import RequestEditorTabs from './http-studio/RequestEditorTabs';
import ResponseViewer from './http-studio/ResponseViewer';
import styles from './HttpStudio.module.css';

interface HttpStudioProps {
  onSendToAI: (prompt: string) => void;
}

interface HttpResponseState {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
}

const HTTP_REQUEST_STORAGE_KEY = 'nexus_security_http_request';
const HTTP_RESPONSE_STORAGE_KEY = 'nexus_security_http_response';

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

  const [urlInput, setUrlInput] = useState<string>('https://api.target-system.com/api/v1/auth/login');
  const [methodSelect, setMethodSelect] = useState<string>('POST');
  const [leftTab, setLeftTab] = useState<'raw' | 'headers' | 'params' | 'body' | 'cookies'>('raw');
  const [isSending, setIsSending] = useState(false);

  // Response State (Persisted in localStorage across tab switches, cleared with Clear button)
  const [response, setResponse] = useState<HttpResponseState | null>(() => {
    try {
      const saved = localStorage.getItem(HTTP_RESPONSE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load http response from localStorage:', e);
    }
    return null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(HTTP_REQUEST_STORAGE_KEY, rawText);
    } catch (e) {
      console.error('Failed to save http request to localStorage:', e);
    }
  }, [rawText]);

  useEffect(() => {
    try {
      if (response) {
        localStorage.setItem(HTTP_RESPONSE_STORAGE_KEY, JSON.stringify(response));
      } else {
        localStorage.removeItem(HTTP_RESPONSE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save http response to localStorage:', e);
    }
  }, [response]);

  // Parse Raw HTTP Request Helper
  const parseRawHttp = (text: string) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const firstLine = lines[0] || 'GET / HTTP/1.1';
    const firstLineParts = firstLine.trim().split(/\s+/);

    let method = firstLineParts[0]?.toUpperCase() || 'GET';
    let pathOrUrl = firstLineParts[1] || '/';
    const protocol = firstLineParts[2] || 'HTTP/1.1';

    if (firstLine.startsWith('http://') || firstLine.startsWith('https://')) {
      pathOrUrl = firstLine.trim();
      method = 'GET';
    }

    const headers: Array<{ key: string; value: string }> = [];
    const cookies: Array<{ key: string; value: string }> = [];
    let hostFromHeader = '';
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
          hostFromHeader = value;
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

    let fullUrl = '';
    let host = hostFromHeader || 'localhost';
    let path = pathOrUrl;

    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      fullUrl = pathOrUrl;
      const match = pathOrUrl.match(/^(https?:\/\/)?([^/?#]+)?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
      if (match) {
        host = match[2] || host;
        path = (match[3] || '/') + (match[4] || '');
      }
    } else {
      const isHttps = !host.includes('localhost') && !host.startsWith('127.0.0.1');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      fullUrl = `${isHttps ? 'https' : 'http'}://${host}${cleanPath}`;
    }

    const queryParams: Array<{ key: string; value: string }> = [];
    const qIndex = path.indexOf('?');
    if (qIndex !== -1) {
      const qs = path.substring(qIndex + 1);
      const searchParams = new URLSearchParams(qs);
      searchParams.forEach((v, k) => {
        queryParams.push({ key: k, value: v });
      });
    }

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
  };

  const parsed = useMemo(() => parseRawHttp(rawText), [rawText]);

  // Sync to URL bar when Raw text changes
  const syncFromRawText = (text: string) => {
    const p = parseRawHttp(text);
    setUrlInput(p.fullUrl);
    setMethodSelect(p.method);
  };

  // Handle direct edits in the Top URL Bar
  const handleUrlInputChange = (newUrl: string) => {
    setUrlInput(newUrl);

    const match = newUrl.match(/^(https?:\/\/)?([^/?#]+)?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
    if (!match) return;

    const host = match[2] || '';
    const pathname = match[3] || '/';
    const search = match[4] || '';
    const fullPath = pathname + search;

    setRawText((prevRaw) => {
      const lines = prevRaw.replace(/\r\n/g, '\n').split('\n');
      lines[0] = `${methodSelect} ${fullPath} HTTP/1.1`;

      if (host) {
        let hostFound = false;
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') break;
          if (lines[i].toLowerCase().startsWith('host:')) {
            lines[i] = `Host: ${host}`;
            hostFound = true;
            break;
          }
        }
        if (!hostFound) {
          lines.splice(1, 0, `Host: ${host}`);
        }
      }
      return lines.join('\n');
    });
  };

  // Handle direct Method change
  const handleMethodChange = (newMethod: string) => {
    setMethodSelect(newMethod);
    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    const firstLine = lines[0] || 'GET / HTTP/1.1';
    const parts = firstLine.trim().split(/\s+/);
    parts[0] = newMethod;
    lines[0] = parts.join(' ');
    setRawText(lines.join('\n'));
  };

  const handleSelectPreset = (presetKey: string) => {
    if (presetKey === 'clear') {
      handleClearAll();
      return;
    }
    const preset = PRESET_REQUESTS[presetKey];
    if (preset) {
      setRawText(preset);
      syncFromRawText(preset);
    }
  };

  const handleClearAll = () => {
    setRawText(BLANK_REQUEST);
    setUrlInput('http://localhost/');
    setMethodSelect('GET');
    setResponse(null);
    try {
      localStorage.removeItem(HTTP_REQUEST_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendRequest = async () => {
    setIsSending(true);
    const start = performance.now();
    try {
      const headersObj: Record<string, string> = {};
      parsed.headers.forEach((h) => {
        if (h.key.toLowerCase() !== 'host') headersObj[h.key] = h.value;
      });

      const res = await fetch(parsed.fullUrl, {
        method: parsed.method,
        headers: headersObj,
        body: ['GET', 'HEAD'].includes(parsed.method) ? undefined : parsed.body || undefined,
      });

      const timeMs = Math.round(performance.now() - start);
      const textBody = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : 'Response'),
        timeMs,
        sizeBytes: textBody.length,
        headers: resHeaders,
        body: textBody,
      });
    } catch (error: unknown) {
      const timeMs = Math.round(performance.now() - start);
      const msg = error instanceof Error ? error.message : String(error);
      setResponse({
        status: 0,
        statusText: 'Network / CORS Error',
        timeMs,
        sizeBytes: 0,
        headers: {},
        body: `// Error executing HTTP request:\n// ${msg}\n\n// Note: Browsers block cross-origin requests unless the target server enables CORS.\n// For unauthorized endpoints, test against local services (e.g. Ollama localhost:11434) or backend proxies.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleAIInspect = () => {
    const prompt = `Perform a comprehensive AppSec vulnerability analysis of the following HTTP Request:\n\n\`\`\`http\n${rawText}\n\`\`\`\n\nIdentify:\n1. Potential attack vectors (SQLi, IDOR, SSRF, Broken Auth, Parameter Pollution)\n2. Missing security headers (CSP, HSTS, SameSite Cookies)\n3. Fuzzing injection payloads for each header and parameter.`;
    onSendToAI(prompt);
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(parsed.body);
      const formatted = JSON.stringify(obj, null, 2);
      const lines = rawText.replace(/\r\n/g, '\n').split('\n');
      let bodyIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') {
          bodyIdx = i + 1;
          break;
        }
      }
      if (bodyIdx !== -1) {
        const nextRaw = [...lines.slice(0, bodyIdx), formatted].join('\n');
        setRawText(nextRaw);
      }
    } catch {
      // invalid json, ignore
    }
  };

  // Code Snippet Generators
  const curlCommand = useMemo(() => {
    let cmd = `curl -X ${parsed.method} "${parsed.fullUrl}"`;
    parsed.headers.forEach((h) => {
      cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
    });
    if (parsed.body && !['GET', 'HEAD'].includes(parsed.method)) {
      cmd += ` \\\n  -d '${parsed.body.replace(/'/g, "\\'")}'`;
    }
    return cmd;
  }, [parsed]);

  const pythonCode = useMemo(() => {
    return `import requests

url = "${parsed.fullUrl}"
headers = {
${parsed.headers.map((h) => `    "${h.key}": "${h.value}",`).join('\n')}
}
${parsed.body && !['GET', 'HEAD'].includes(parsed.method) ? `data = '''${parsed.body}'''` : ''}

response = requests.${parsed.method.toLowerCase()}(
    url,
    headers=headers,
    ${parsed.body && !['GET', 'HEAD'].includes(parsed.method) ? 'data=data,' : ''}
    timeout=10
)
print(response.status_code)
print(response.text)
`;
  }, [parsed]);

  const jsCode = useMemo(() => {
    return `const response = await fetch("${parsed.fullUrl}", {
  method: "${parsed.method}",
  headers: {
${parsed.headers.map((h) => `    "${h.key}": "${h.value}",`).join('\n')}
  },
  ${parsed.body && !['GET', 'HEAD'].includes(parsed.method) ? `body: JSON.stringify(${parsed.body}),` : ''}
});

const data = await response.text();
console.log(response.status, data);
`;
  }, [parsed]);

  const goCode = useMemo(() => {
    return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"strings"
)

func main() {
\tclient := &http.Client{}
\tbody := strings.NewReader(\`${parsed.body}\`)
\treq, err := http.NewRequest("${parsed.method}", "${parsed.fullUrl}", body)
\tif err != nil {
\t\tpanic(err)
\t}

${parsed.headers.map((h) => `\treq.Header.Set("${h.key}", "${h.value}")`).join('\n')}

\tresp, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\tbytes, _ := io.ReadAll(resp.Body)
\tfmt.Println(resp.StatusCode, string(bytes))
}
`;
  }, [parsed]);

  const psCode = useMemo(() => {
    return `$headers = @{
${parsed.headers.map((h) => `    "${h.key}" = "${h.value}"`).join('\n')}
}

$response = Invoke-RestMethod -Uri "${parsed.fullUrl}" -Method ${parsed.method} -Headers $headers ${
      parsed.body && !['GET', 'HEAD'].includes(parsed.method) ? `-Body '${parsed.body}'` : ''
    }
$response
`;
  }, [parsed]);

  return (
    <div className={styles.studioContainer}>
      {/* Top URL Request Bar */}
      <RequestUrlBar
        method={methodSelect}
        onChangeMethod={handleMethodChange}
        url={urlInput}
        onChangeUrl={handleUrlInputChange}
        onSelectPreset={handleSelectPreset}
        onSendRequest={handleSendRequest}
        isSending={isSending}
        onClearAll={handleClearAll}
        onSendToAI={handleAIInspect}
      />

      {/* Main Split Workbench (Left: Request, Right: Response/Code) */}
      <div className={styles.workbenchGrid}>
        <RequestEditorTabs
          leftTab={leftTab}
          onChangeLeftTab={setLeftTab}
          rawText={rawText}
          onChangeRawText={(t) => {
            setRawText(t);
            syncFromRawText(t);
          }}
          headers={parsed.headers}
          queryParams={parsed.queryParams}
          body={parsed.body}
          cookies={parsed.cookies}
          onUpdateHeaders={(newHeaders) => {
            const lines = rawText.replace(/\r\n/g, '\n').split('\n');
            const firstLine = lines[0];
            let bodyIndex = -1;
            for (let i = 1; i < lines.length; i++) {
              if (lines[i].trim() === '') {
                bodyIndex = i + 1;
                break;
              }
            }
            const bodyContent = bodyIndex !== -1 ? lines.slice(bodyIndex).join('\n') : '';
            const headerLines = newHeaders.map((h) => `${h.key}: ${h.value}`);
            const nextRaw = [firstLine, ...headerLines, '', bodyContent].join('\n');
            setRawText(nextRaw);
          }}
          onUpdateQueryParams={(newParams) => {
            const search = new URLSearchParams();
            newParams.forEach((p) => {
              if (p.key) search.set(p.key, p.value);
            });
            const qs = search.toString();
            const cleanPath = parsed.path.split('?')[0];
            const newPath = qs ? `${cleanPath}?${qs}` : cleanPath;
            const lines = rawText.replace(/\r\n/g, '\n').split('\n');
            lines[0] = `${parsed.method} ${newPath} ${parsed.protocol}`;
            const nextRaw = lines.join('\n');
            setRawText(nextRaw);
            syncFromRawText(nextRaw);
          }}
          onUpdateBody={(newBody) => {
            const lines = rawText.replace(/\r\n/g, '\n').split('\n');
            let bodyIndex = -1;
            for (let i = 1; i < lines.length; i++) {
              if (lines[i].trim() === '') {
                bodyIndex = i + 1;
                break;
              }
            }
            const headerLines = bodyIndex !== -1 ? lines.slice(0, bodyIndex - 1) : lines;
            const nextRaw = [...headerLines, '', newBody].join('\n');
            setRawText(nextRaw);
          }}
          onFormatJson={handleFormatJson}
        />

        <ResponseViewer
          response={response}
          onClearResponse={() => setResponse(null)}
          curlCommand={curlCommand}
          pythonCode={pythonCode}
          jsCode={jsCode}
          goCode={goCode}
          psCode={psCode}
        />
      </div>
    </div>
  );
}
