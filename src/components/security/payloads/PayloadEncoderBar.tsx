import React from 'react';
import { Search } from 'lucide-react';
import type { EncodingType } from '../../../data/security/payloadCatalog';
import styles from '../PayloadCrafter.module.css';

interface PayloadEncoderBarProps {
  encoding: EncodingType;
  onSelectEncoding: (enc: EncodingType) => void;
  filterQuery: string;
  onChangeFilter: (query: string) => void;
}

const ENCODINGS: { id: EncodingType; label: string }[] = [
  { id: 'raw', label: 'Raw String' },
  { id: 'url', label: 'URL Encoded' },
  { id: 'double_url', label: 'Double URL' },
  { id: 'base64', label: 'Base64 Encoded' },
  { id: 'hex', label: 'Hex (\\x00)' },
  { id: 'html', label: 'HTML Entity' },
];

export default function PayloadEncoderBar({
  encoding,
  onSelectEncoding,
  filterQuery,
  onChangeFilter,
}: PayloadEncoderBarProps) {
  return (
    <div className={styles.filterAndEncodingBar}>
      <div className={styles.searchWrapper}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => onChangeFilter(e.target.value)}
          placeholder="Filter payload titles or syntax keywords..."
          className={styles.searchInput}
        />
      </div>

      <div className={styles.encodingGroup}>
        <span className={styles.encodingLabel}>Real-time Encoding:</span>
        <div className={styles.encodingChips}>
          {ENCODINGS.map((enc) => (
            <button
              key={enc.id}
              className={`${styles.encodingChip} ${encoding === enc.id ? styles.encodingChipActive : ''}`}
              onClick={() => onSelectEncoding(enc.id)}
            >
              {enc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
