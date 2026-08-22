import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  RotateCcw,
  Zap,
  WrapText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import CustomSelect from '../../CustomSelect';
import styles from '../HttpStudio.module.css';

interface HttpResponseState {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
}

interface ResponseViewerProps {
  response: HttpResponseState | null;
  onClearResponse: () => void;
  curlCommand: string;
  pythonCode: string;
  jsCode: string;
  goCode: string;
  psCode: string;
}

export default function ResponseViewer({
  response,
  onClearResponse,
  curlCommand,
  pythonCode,
  jsCode,
  goCode,
  psCode,
}: ResponseViewerProps) {
  const [rightTab, setRightTab] = useState<'response' | 'code' | 'security'>('response');
  const [responseFormat, setResponseFormat] = useState<'pretty' | 'raw' | 'headers'>('pretty');
  const [codeLang, setCodeLang] = useState<'curl' | 'python' | 'javascript' | 'go' | 'powershell'>('curl');
  const [copied, setCopied] = useState(false);
  const [wrapText, setWrapText] = useState(true);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return '#10b981';
    if (status >= 300 && status < 400) return '#38bdf8';
    if (status >= 400 && status < 500) return '#f59e0b';
    return '#ef4444';
  };

  const getActiveCode = () => {
    switch (codeLang) {
      case 'curl':
        return curlCommand;
      case 'python':
        return pythonCode;
      case 'javascript':
        return jsCode;
      case 'go':
        return goCode;
      case 'powershell':
        return psCode;
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.paneCard}>
      {/* Tab Navigation */}
      <div className={styles.paneTabs}>
        <button
          className={`${styles.tabBtn} ${rightTab === 'response' ? styles.tabBtnActive : ''}`}
          onClick={() => setRightTab('response')}
        >
          <Zap size={12} /> Response
          {response && (
            <span
              className={styles.statusBadge}
              style={{ backgroundColor: getStatusColor(response.status) }}
            >
              {response.status}
            </span>
          )}
        </button>
        <button
          className={`${styles.tabBtn} ${rightTab === 'code' ? styles.tabBtnActive : ''}`}
          onClick={() => setRightTab('code')}
        >
          <Code2 size={12} /> Code Snippets
        </button>
      </div>

      {/* Response Tab */}
      {rightTab === 'response' && (
        <div className={styles.responseContainer}>
          {response ? (
            <>
              {/* Response Stats Bar */}
              <div className={styles.responseStatsBar}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: getStatusColor(response.status),
                      fontSize: '0.85rem',
                    }}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span className={styles.metaBadge}>{response.timeMs} ms</span>
                  <span className={styles.metaBadge}>{response.sizeBytes} B</span>
                </div>

                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <button
                    className={`${styles.formatBtn} ${responseFormat === 'pretty' ? styles.formatBtnActive : ''}`}
                    onClick={() => setResponseFormat('pretty')}
                  >
                    Pretty
                  </button>
                  <button
                    className={`${styles.formatBtn} ${responseFormat === 'raw' ? styles.formatBtnActive : ''}`}
                    onClick={() => setResponseFormat('raw')}
                  >
                    Raw
                  </button>
                  <button
                    className={`${styles.formatBtn} ${responseFormat === 'headers' ? styles.formatBtnActive : ''}`}
                    onClick={() => setResponseFormat('headers')}
                  >
                    Headers ({Object.keys(response.headers).length})
                  </button>
                  <button
                    className={styles.formatBtn}
                    onClick={() => setWrapText(!wrapText)}
                    title="Toggle Word Wrap"
                  >
                    <WrapText size={12} />
                  </button>
                  <button
                    className={styles.formatBtn}
                    onClick={() => handleCopy(response.body)}
                    title="Copy Response Body"
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                  <button
                    className={styles.formatBtn}
                    onClick={onClearResponse}
                    title="Clear Response"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>

              {/* CORS / Network Failure Warning Banner */}
              {response.status === 0 && (
                <div className={styles.corsWarningBanner}>
                  <AlertTriangle size={15} />
                  <div className={styles.corsWarningContent}>
                    <span className={styles.corsWarningTitle}>
                      Request blocked before reaching the server
                    </span>
                    <span className={styles.corsWarningText}>
                      The browser refused to send this request — this is almost always a{' '}
                      <strong>CORS restriction</strong> or unreachable host, not a server error.
                      Browsers block cross-origin responses unless the target sends permissive{' '}
                      <code>Access-Control-Allow-Origin</code> headers. Test against localhost
                      services (e.g. <code>http://localhost:11434</code>), use one of the code
                      snippets on the right from a terminal/proxy, or disable CORS only for local
                      testing.
                    </span>
                  </div>
                </div>
              )}

              {/* Response Content */}
              <div className={styles.responseBodyWrapper}>
                {responseFormat === 'headers' ? (
                  <div className={styles.headersList}>
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className={styles.headerItem}>
                        <span className={styles.headerKey}>{k}:</span>
                        <span className={styles.headerVal}>{v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre
                    className={`${styles.responsePre} ${wrapText ? styles.preWrap : ''}`}
                  >
                    <code>{response.body || '// (Empty Response Body)'}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyResponseState}>
              <span>No response received yet. Send a request to inspect output.</span>
            </div>
          )}
        </div>
      )}

      {/* Code Snippets Tab */}
      {rightTab === 'code' && (
        <div className={styles.codeSnippetContainer}>
          <div className={styles.codeSnippetToolbar}>
            <CustomSelect
              value={codeLang}
              options={[
                { value: 'curl', label: 'cURL Command' },
                { value: 'python', label: 'Python (requests)' },
                { value: 'javascript', label: 'JavaScript (fetch)' },
                { value: 'go', label: 'Go (net/http)' },
                { value: 'powershell', label: 'PowerShell (Invoke-RestMethod)' },
              ]}
              onChange={(val) => setCodeLang(val as typeof codeLang)}
              style={{ width: '220px' }}
            />

            <button
              className={styles.btn}
              onClick={() => handleCopy(getActiveCode())}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className={styles.codeSnippetPre}>
            <code>{getActiveCode()}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
