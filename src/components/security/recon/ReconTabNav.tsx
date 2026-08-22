import React from 'react';
import {
  Terminal,
  Search,
  Key,
  Radio,
  Cloud,
} from 'lucide-react';
import styles from '../ReconHub.module.css';

export type ReconTab = 'pipelines' | 'google_dorks' | 'github_secrets' | 'shodan_osint' | 'cloud_s3';

interface ReconTabNavProps {
  activeTab: ReconTab;
  onSelectTab: (tab: ReconTab) => void;
}

export default function ReconTabNav({ activeTab, onSelectTab }: ReconTabNavProps) {
  return (
    <div className={styles.tabNav}>
      <button
        className={`${styles.tabBtn} ${activeTab === 'pipelines' ? styles.tabBtnActive : ''}`}
        onClick={() => onSelectTab('pipelines')}
      >
        <Terminal size={14} /> CLI Pipelines (12)
      </button>
      <button
        className={`${styles.tabBtn} ${activeTab === 'google_dorks' ? styles.tabBtnActive : ''}`}
        onClick={() => onSelectTab('google_dorks')}
      >
        <Search size={14} /> Google Dorks (9)
      </button>
      <button
        className={`${styles.tabBtn} ${activeTab === 'github_secrets' ? styles.tabBtnActive : ''}`}
        onClick={() => onSelectTab('github_secrets')}
      >
        <Key size={14} /> GitHub Secrets (8)
      </button>
      <button
        className={`${styles.tabBtn} ${activeTab === 'shodan_osint' ? styles.tabBtnActive : ''}`}
        onClick={() => onSelectTab('shodan_osint')}
      >
        <Radio size={14} /> Shodan &amp; OSINT (6)
      </button>
      <button
        className={`${styles.tabBtn} ${activeTab === 'cloud_s3' ? styles.tabBtnActive : ''}`}
        onClick={() => onSelectTab('cloud_s3')}
      >
        <Cloud size={14} /> Cloud S3 &amp; Buckets (7)
      </button>
    </div>
  );
}
