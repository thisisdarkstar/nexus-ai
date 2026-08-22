import React from 'react';
import { Binary, ArrowRight } from 'lucide-react';
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
  rot13,
} from '../../../lib/security/transformers';
import styles from '../DecoderHub.module.css';

interface QuickTransformGridProps {
  onTransform: (name: string, fn: (text: string) => string) => void;
}

export default function QuickTransformGrid({ onTransform }: QuickTransformGridProps) {
  return (
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
            <button className={styles.btn} onClick={() => onTransform('Base64 Encode', encodeBase64)}>
              Encode Base64 <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('Base64 Decode', decodeBase64)}>
              <ArrowRight size={11} /> Decode Base64
            </button>
          </div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('Base64URL Encode', encodeBase64URL)}>
              Encode B64URL <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('Base64URL Decode', decodeBase64URL)}>
              <ArrowRight size={11} /> Decode B64URL
            </button>
          </div>
        </div>

        {/* Hex & Binary (8-bit) */}
        <div className={styles.transformGroup}>
          <div className={styles.groupLabel}>Hex &amp; Binary</div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('Hex Encode', encodeHex)}>
              Encode Hex <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('Hex Decode', decodeHex)}>
              <ArrowRight size={11} /> Decode Hex
            </button>
          </div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('Binary Encode', encodeBinary)}>
              Encode Binary <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('Binary Decode', decodeBinary)}>
              <ArrowRight size={11} /> Decode Binary
            </button>
          </div>
        </div>

        {/* URL & HTML Entities */}
        <div className={styles.transformGroup}>
          <div className={styles.groupLabel}>URL &amp; HTML Entities</div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('URL Encode', encodeURL)}>
              Encode URL <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('URL Decode', decodeURL)}>
              <ArrowRight size={11} /> Decode URL
            </button>
          </div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('HTML Encode', encodeHTML)}>
              Encode HTML <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('HTML Decode', decodeHTML)}>
              <ArrowRight size={11} /> Decode HTML
            </button>
          </div>
        </div>

        {/* Unicode & ASCII Decimal */}
        <div className={styles.transformGroup}>
          <div className={styles.groupLabel}>Unicode, ASCII &amp; Ciphers</div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('Unicode Encode', encodeUnicode)}>
              Encode Unicode <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('Unicode Decode', decodeUnicode)}>
              <ArrowRight size={11} /> Decode Unicode
            </button>
          </div>
          <div className={styles.btnPair}>
            <button className={styles.btn} onClick={() => onTransform('Decimal ASCII', encodeDecimalASCII)}>
              Encode ASCII <ArrowRight size={11} />
            </button>
            <button className={styles.btn} onClick={() => onTransform('ROT13 Cipher', rot13)}>
              ⚡ ROT13 Cipher
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
