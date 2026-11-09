import { useState } from 'react';
import {
  ShieldAlert,
  Target,
  Globe,
  FileCode,
  Terminal,
  Check,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { workbenchBridge } from '../../lib/security/workbenchBridge';
import type { VulnerabilityFinding, ScopeItem } from '../../types';
import styles from './ActionCard.module.css';

export interface ActionCardData {
  type: 'finding' | 'scope' | 'http' | 'code' | 'sandbox';
  title: string;
  description?: string;
  finding?: Partial<VulnerabilityFinding>;
  scope?: Partial<ScopeItem>;
  rawHttp?: string;
  code?: string;
}

interface ActionCardProps {
  data: ActionCardData;
}

export default function ActionCard({ data }: ActionCardProps) {
  const [applied, setApplied] = useState(false);

  const handleExecute = () => {
    if (data.type === 'finding' && data.finding) {
      workbenchBridge.addFinding({
        id: data.finding.id || `f-${Date.now()}`,
        title: data.finding.title || data.title,
        severity: data.finding.severity || 'high',
        cweId: data.finding.cweId || 'CWE-200',
        owaspCategory: data.finding.owaspCategory || 'OWASP Top 10',
        description: data.finding.description || data.description || '',
        remediation: data.finding.remediation || 'Remediate according to OWASP guidelines.',
        status: 'open',
      });
      setApplied(true);
    } else if (data.type === 'scope' && data.scope?.target) {
      workbenchBridge.addScopeItems([
        {
          id: `scope-${Date.now()}`,
          target: data.scope.target,
          type: data.scope.type || 'domain',
          inScope: true,
          techStack: data.scope.techStack || ['Web'],
          notes: data.description || 'Added from AI conversation',
          status: 'untested',
        },
      ]);
      setApplied(true);
    } else if (data.type === 'http' && data.rawHttp) {
      workbenchBridge.loadHttp(data.rawHttp);
      setApplied(true);
    } else if (data.type === 'code' && data.code) {
      workbenchBridge.switchTab('auditor', { code: data.code });
      setApplied(true);
    } else if (data.type === 'sandbox' && data.code) {
      workbenchBridge.switchTab('sandbox', { code: data.code });
      setApplied(true);
    }
  };

  const renderIcon = () => {
    switch (data.type) {
      case 'finding':
        return <ShieldAlert size={16} color="#f87171" />;
      case 'scope':
        return <Target size={16} color="#38bdf8" />;
      case 'http':
        return <Globe size={16} color="#34d399" />;
      case 'code':
        return <FileCode size={16} color="#facc15" />;
      case 'sandbox':
        return <Terminal size={16} color="#c084fc" />;
      default:
        return <ShieldAlert size={16} />;
    }
  };

  const getButtonLabel = () => {
    if (applied) return 'Added to Workbench';
    switch (data.type) {
      case 'finding':
        return 'Add to VAPT Report';
      case 'scope':
        return 'Add to Scope Matrix';
      case 'http':
        return 'Open in HTTP Studio';
      case 'code':
        return 'Inspect in SAST Auditor';
      case 'sandbox':
        return 'Run in Python Sandbox';
      default:
        return 'Apply Action';
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          {renderIcon()}
          <span>{data.title}</span>
        </div>
        {data.finding?.severity && (
          <div className={styles.badges}>
            {data.finding.cweId && (
              <span className={`${styles.badge} ${styles.info}`}>
                {data.finding.cweId}
              </span>
            )}
            <span className={`${styles.badge} ${styles[data.finding.severity]}`}>
              {data.finding.severity}
            </span>
          </div>
        )}
      </div>

      {data.description && <p className={styles.desc}>{data.description}</p>}

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${applied ? styles.btnDone : ''}`}
          onClick={handleExecute}
          disabled={applied}
        >
          {applied ? <Check size={13} /> : <Plus size={13} />}
          <span>{getButtonLabel()}</span>
        </button>

        {applied && data.type === 'finding' && (
          <button
            className={styles.btn}
            onClick={() => workbenchBridge.switchTab('reports')}
          >
            <span>View in Report Studio</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

