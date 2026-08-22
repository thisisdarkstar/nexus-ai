import React from 'react';
import {
  Code2,
  List,
  Sliders,
  FileCode,
  Plus,
  Trash2,
  AlignLeft,
} from 'lucide-react';
import styles from '../HttpStudio.module.css';

interface RequestEditorTabsProps {
  leftTab: 'raw' | 'headers' | 'params' | 'body' | 'cookies';
  onChangeLeftTab: (tab: 'raw' | 'headers' | 'params' | 'body' | 'cookies') => void;
  rawText: string;
  onChangeRawText: (text: string) => void;
  headers: Array<{ key: string; value: string }>;
  queryParams: Array<{ key: string; value: string }>;
  body: string;
  cookies: Array<{ key: string; value: string }>;
  onUpdateHeaders: (headers: Array<{ key: string; value: string }>) => void;
  onUpdateQueryParams: (params: Array<{ key: string; value: string }>) => void;
  onUpdateBody: (body: string) => void;
  onFormatJson: () => void;
}

export default function RequestEditorTabs({
  leftTab,
  onChangeLeftTab,
  rawText,
  onChangeRawText,
  headers,
  queryParams,
  body,
  cookies,
  onUpdateHeaders,
  onUpdateQueryParams,
  onUpdateBody,
  onFormatJson,
}: RequestEditorTabsProps) {
  return (
    <div className={styles.paneCard}>
      {/* Tab Navigation */}
      <div className={styles.paneTabs}>
        <button
          className={`${styles.tabBtn} ${leftTab === 'raw' ? styles.tabBtnActive : ''}`}
          onClick={() => onChangeLeftTab('raw')}
        >
          <Code2 size={12} /> Raw Request
        </button>
        <button
          className={`${styles.tabBtn} ${leftTab === 'headers' ? styles.tabBtnActive : ''}`}
          onClick={() => onChangeLeftTab('headers')}
        >
          <List size={12} /> Headers ({headers.length})
        </button>
        <button
          className={`${styles.tabBtn} ${leftTab === 'params' ? styles.tabBtnActive : ''}`}
          onClick={() => onChangeLeftTab('params')}
        >
          <Sliders size={12} /> Params ({queryParams.length})
        </button>
        <button
          className={`${styles.tabBtn} ${leftTab === 'body' ? styles.tabBtnActive : ''}`}
          onClick={() => onChangeLeftTab('body')}
        >
          <FileCode size={12} /> Body
        </button>
      </div>

      {/* Raw Tab */}
      {leftTab === 'raw' && (
        <div className={styles.editorWrapper}>
          <textarea
            className={styles.rawTextarea}
            value={rawText}
            onChange={(e) => onChangeRawText(e.target.value)}
            spellCheck={false}
            placeholder="POST /api/v1/resource HTTP/1.1&#10;Host: target.com&#10;Content-Type: application/json&#10;&#10;{&#10;  &quot;key&quot;: &quot;value&quot;&#10;}"
          />
        </div>
      )}

      {/* Headers Tab */}
      {leftTab === 'headers' && (
        <div className={styles.kvTableWrapper}>
          <div className={styles.kvTableHeader}>
            <span>Header Name</span>
            <span>Value</span>
            <span style={{ width: '40px' }}></span>
          </div>
          <div className={styles.kvTableBody}>
            {headers.map((h, i) => (
              <div key={i} className={styles.kvRow}>
                <input
                  type="text"
                  className={styles.kvInput}
                  value={h.key}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i].key = e.target.value;
                    onUpdateHeaders(next);
                  }}
                  placeholder="e.g. Authorization"
                />
                <input
                  type="text"
                  className={styles.kvInput}
                  value={h.value}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i].value = e.target.value;
                    onUpdateHeaders(next);
                  }}
                  placeholder="Bearer eyJhbGciOi..."
                />
                <button
                  className={styles.kvDeleteBtn}
                  onClick={() => {
                    const next = headers.filter((_, idx) => idx !== i);
                    onUpdateHeaders(next);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            className={styles.addKvBtn}
            onClick={() => onUpdateHeaders([...headers, { key: '', value: '' }])}
          >
            <Plus size={12} /> Add Header
          </button>
        </div>
      )}

      {/* Params Tab */}
      {leftTab === 'params' && (
        <div className={styles.kvTableWrapper}>
          <div className={styles.kvTableHeader}>
            <span>Parameter</span>
            <span>Value</span>
            <span style={{ width: '40px' }}></span>
          </div>
          <div className={styles.kvTableBody}>
            {queryParams.map((p, i) => (
              <div key={i} className={styles.kvRow}>
                <input
                  type="text"
                  className={styles.kvInput}
                  value={p.key}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[i].key = e.target.value;
                    onUpdateQueryParams(next);
                  }}
                  placeholder="e.g. user_id"
                />
                <input
                  type="text"
                  className={styles.kvInput}
                  value={p.value}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[i].value = e.target.value;
                    onUpdateQueryParams(next);
                  }}
                  placeholder="1002"
                />
                <button
                  className={styles.kvDeleteBtn}
                  onClick={() => {
                    const next = queryParams.filter((_, idx) => idx !== i);
                    onUpdateQueryParams(next);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            className={styles.addKvBtn}
            onClick={() => onUpdateQueryParams([...queryParams, { key: '', value: '' }])}
          >
            <Plus size={12} /> Add Query Parameter
          </button>
        </div>
      )}

      {/* Body Tab */}
      {leftTab === 'body' && (
        <div className={styles.bodyTabWrapper}>
          <div className={styles.bodyToolbar}>
            <button className={styles.bodyToolBtn} onClick={onFormatJson} title="Prettify JSON syntax">
              <AlignLeft size={12} /> Format JSON
            </button>
          </div>
          <textarea
            className={styles.rawTextarea}
            value={body}
            onChange={(e) => onUpdateBody(e.target.value)}
            placeholder='{&#10;  "username": "admin",&#10;  "password": "secret"&#10;}'
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
