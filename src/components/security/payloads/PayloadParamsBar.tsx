import React from 'react';
import type { PayloadCategory, PayloadParams } from '../../../data/security/payloadCatalog';
import styles from '../PayloadCrafter.module.css';

interface PayloadParamsBarProps {
  params: PayloadParams;
  onChangeParams: (key: keyof PayloadParams, value: string) => void;
  activeCategory: PayloadCategory;
}

export default function PayloadParamsBar({
  params,
  onChangeParams,
  activeCategory,
}: PayloadParamsBarProps) {
  const isTargetHostRelevant = ['ssrf', 'sqli'].includes(activeCategory);
  const isTargetFileRelevant = ['lfi', 'webshells'].includes(activeCategory);
  const isNetRelevant = !isTargetFileRelevant;

  return (
    <div className={styles.configBar}>
      {isNetRelevant && (
        <>
          <div className={styles.configField}>
            <label className={styles.configLabel}>LHOST / Attacker IP</label>
            <input
              type="text"
              value={params.lhost}
              onChange={(e) => onChangeParams('lhost', e.target.value)}
              placeholder="e.g. 10.10.14.x or eth0"
              className={styles.configInput}
            />
          </div>

          <div className={styles.configField} style={{ maxWidth: 140 }}>
            <label className={styles.configLabel}>LPORT / Port</label>
            <input
              type="text"
              value={params.lport}
              onChange={(e) => onChangeParams('lport', e.target.value)}
              placeholder="4444"
              className={styles.configInput}
            />
          </div>
        </>
      )}

      {isTargetHostRelevant && (
        <div className={styles.configField}>
          <label className={styles.configLabel}>Target Host</label>
          <input
            type="text"
            value={params.targetHost}
            onChange={(e) => onChangeParams('targetHost', e.target.value)}
            placeholder="target.com"
            className={styles.configInput}
          />
        </div>
      )}

      {isTargetFileRelevant && (
        <div className={styles.configField} style={{ flex: 1 }}>
          <label className={styles.configLabel}>Target File / Traversal Destination</label>
          <input
            type="text"
            value={params.targetFile}
            onChange={(e) => onChangeParams('targetFile', e.target.value)}
            placeholder="/etc/passwd or C:\\boot.ini"
            className={styles.configInput}
          />
        </div>
      )}
    </div>
  );
}
