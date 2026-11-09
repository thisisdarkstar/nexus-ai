import { useState, useEffect, useRef } from 'react';
import {
  Workflow,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PipelineRunner,
  PRESET_PIPELINES,
  type PipelineDefinition,
  type PipelineStep,
  type PipelineExecutionContext,
} from '../../domain/workflow/PipelineRunner';
import { storageManager } from '../../core/storage/StorageManager';
import type { ReconAsset, ScopeItem } from '../../types';
import styles from './WorkflowStudio.module.css';

interface WorkflowStudioProps {
  onSendToAI?: (prompt: string) => void;
}

export default function WorkflowStudio({ onSendToAI }: WorkflowStudioProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_PIPELINES[0].id);
  const [currentDefinition, setCurrentDefinition] = useState<PipelineDefinition>(PRESET_PIPELINES[0]);
  const [runner, setRunner] = useState<PipelineRunner | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState<boolean>(false);
  const [allLogs, setAllLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(true);

  const [contextMetrics, setContextMetrics] = useState<{
    inScopeCount: number;
    advisoryCount: number;
    findingsCount: number;
    graphNodesCount?: number;
    prioritizedCount?: number;
    regressionCount?: number;
  }>({
    inScopeCount: 0,
    advisoryCount: 0,
    findingsCount: 0,
  });

  const runnerRef = useRef<PipelineRunner | null>(null);

  // Initialize runner when preset changes
  useEffect(() => {
    const preset = PRESET_PIPELINES.find((p) => p.id === selectedPresetId) || PRESET_PIPELINES[0];
    setCurrentDefinition(preset);

    const initRunner = async () => {
      let assets: ReconAsset[] = [];
      let scopeRules: ScopeItem[] = [];

      try {
        const storedAssets = await storageManager.getAssets('default');
        if (storedAssets && storedAssets.length > 0) {
          assets = storedAssets.map((a) => ({
            id: a.id,
            url: a.url,
            host: a.host,
            technologies: a.technologies,
            highInterestFlags: a.highInterestFlags,
            statusCode: a.statusCode,
            riskScore: a.riskScore,
          }));
        } else {
          // Provide mock sample assets if storage is empty
          assets = [
            {
              id: 'ast-demo-1',
              url: 'https://api.acme.corp/actuator/env',
              host: 'api.acme.corp',
              technologies: ['Spring Boot Actuator', 'Java'],
              riskScore: 'high',
              statusCode: 200,
            },
            {
              id: 'ast-demo-2',
              url: 'https://staging.acme.corp/.env',
              host: 'staging.acme.corp',
              technologies: ['Nginx'],
              riskScore: 'critical',
              statusCode: 200,
            },
            {
              id: 'ast-demo-3',
              url: 'https://thirdparty-cdn.external.net/lib.js',
              host: 'thirdparty-cdn.external.net',
              technologies: ['React'],
              riskScore: 'low',
              statusCode: 200,
            },
          ];
        }

        const storedScope = await storageManager.getScope('default');
        if (storedScope && storedScope.length > 0) {
          scopeRules = storedScope;
        } else {
          scopeRules = [
            {
              id: 'scp-1',
              target: '*.acme.corp',
              type: 'domain',
              inScope: true,
              status: 'in_progress',
            },
            {
              id: 'scp-2',
              target: 'thirdparty-cdn.external.net',
              type: 'domain',
              inScope: false,
              status: 'verified_clean',
            },
          ];
        }
      } catch {
        // Fallback
      }

      const newRunner = new PipelineRunner(
        preset,
        {
          projectId: 'default',
          assets,
          scopeRules,
        },
        (step) => {
          setCurrentDefinition((prev) => ({
            ...prev,
            steps: prev.steps.map((s) => (s.id === step.id ? { ...step } : s)),
          }));
          if (step.logs.length > 0) {
            setAllLogs((prev) => [...prev, ...step.logs]);
          }
        }
      );

      runnerRef.current = newRunner;
      setRunner(newRunner);
      setAllLogs([]);
      setIsWaitingApproval(false);
      setIsRunning(false);
    };

    initRunner();
  }, [selectedPresetId]);

  const handleRunPipeline = async () => {
    if (!runnerRef.current) return;
    setIsRunning(true);
    setAllLogs((prev) => [...prev, `[PIPELINE] Execution initiated for '${currentDefinition.name}'...`]);

    try {
      const ctx = await runnerRef.current.execute();
      setIsWaitingApproval(runnerRef.current.isWaitingForApproval());
      setContextMetrics({
        inScopeCount: ctx.inScopeAssets.length,
        advisoryCount: ctx.flaggedAdvisories.length,
        findingsCount: ctx.draftFindings.length,
        graphNodesCount: ctx.assetGraph ? ctx.assetGraph.getStats().nodeCount : undefined,
        prioritizedCount: ctx.prioritizedItems ? ctx.prioritizedItems.length : undefined,
        regressionCount: ctx.regressionSuites ? ctx.regressionSuites.length : undefined,
      });
      if (!runnerRef.current.isWaitingForApproval()) {
        setAllLogs((prev) => [...prev, `[PIPELINE] Execution completed successfully.`]);
      }
    } catch (err: any) {
      setAllLogs((prev) => [...prev, `[PIPELINE ERROR] Execution aborted: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApproveCheckpoint = async () => {
    if (!runnerRef.current) return;
    setIsRunning(true);
    setAllLogs((prev) => [...prev, '[APPROVAL] Tester confirmed boundary requirements. Resuming pipeline...']);

    try {
      const ctx = await runnerRef.current.approveAndContinue();
      setIsWaitingApproval(runnerRef.current.isWaitingForApproval());
      setContextMetrics({
        inScopeCount: ctx.inScopeAssets.length,
        advisoryCount: ctx.flaggedAdvisories.length,
        findingsCount: ctx.draftFindings.length,
        graphNodesCount: ctx.assetGraph ? ctx.assetGraph.getStats().nodeCount : undefined,
        prioritizedCount: ctx.prioritizedItems ? ctx.prioritizedItems.length : undefined,
        regressionCount: ctx.regressionSuites ? ctx.regressionSuites.length : undefined,
      });
      if (!runnerRef.current.isWaitingForApproval()) {
        setAllLogs((prev) => [...prev, '[PIPELINE] All stages finished. Findings drafted.']);
      }
    } catch (err: any) {
      setAllLogs((prev) => [...prev, `[PIPELINE ERROR] Execution aborted: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    if (runnerRef.current) {
      runnerRef.current.reset();
      setCurrentDefinition({ ...runnerRef.current.getDefinition() });
      setIsWaitingApproval(false);
      setIsRunning(false);
      setAllLogs([]);
      setContextMetrics({ inScopeCount: 0, advisoryCount: 0, findingsCount: 0 });
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Workflow size={28} className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>Assessment Workflow & Pipeline Studio</h2>
            <p className={styles.subtitle}>
              Automated multi-stage assessment orchestration with interactive manual approval checkpoints
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleReset}
            disabled={isRunning}
            title="Reset all pipeline steps"
          >
            <RotateCcw size={14} /> Reset
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleRunPipeline}
            disabled={isRunning || isWaitingApproval}
          >
            <Play size={14} /> {isRunning ? 'Running Stages...' : 'Execute Pipeline'}
          </button>

          {onSendToAI && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                const stepSummaries = currentDefinition.steps
                  .map((s) => `- ${s.name} [${s.status.toUpperCase()}]: ${s.outputSummary || 'N/A'}`)
                  .join('\n');
                onSendToAI(
                  `Review the execution results of workflow '${currentDefinition.name}':\n\nPipeline Stages:\n${stepSummaries}\n\nMetrics:\n- In-Scope Retained: ${contextMetrics.inScopeCount}\n- Advisories Flagged: ${contextMetrics.advisoryCount}\n- Draft Findings: ${contextMetrics.findingsCount}\n\nPlease generate an assessment debriefing summary.`
                );
              }}
            >
              <Sparkles size={14} color="#a855f7" /> AI Debrief
            </button>
          )}
        </div>
      </div>

      {/* Preset Selector */}
      <div className={styles.presetBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Workflow Template:</span>
          <select
            className={styles.presetSelect}
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            disabled={isRunning}
          >
            {PRESET_PIPELINES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          {currentDefinition.description}
        </div>
      </div>

      {/* Checkpoint Alert Banner (Waiting for Approval) */}
      {isWaitingApproval && (
        <div className={styles.checkpointBanner}>
          <div className={styles.checkpointContent}>
            <ShieldCheck size={26} color="#fbbf24" />
            <div>
              <h4 className={styles.checkpointTitle}>Manual Verification Checkpoint Reached</h4>
              <p className={styles.checkpointText}>
                The pipeline has paused execution before proceeding to finding generation. Confirm that scope boundaries and correlated advisories are authorized.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnSuccess}`}
            onClick={handleApproveCheckpoint}
          >
            <CheckCircle size={14} /> Approve Checkpoint & Proceed
          </button>
        </div>
      )}

      {/* Step Flow List */}
      <div className={styles.stepsFlow}>
        {currentDefinition.steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isRunningStep = step.status === 'running';
          const isWaitingStep = step.status === 'waiting_approval';
          const isFailedStep = step.status === 'failed';

          let cardClass = styles.stepCard;
          if (isRunningStep) cardClass += ` ${styles.stepCardRunning}`;
          if (isWaitingStep) cardClass += ` ${styles.stepCardWaiting}`;
          if (isCompleted) cardClass += ` ${styles.stepCardCompleted}`;
          if (isFailedStep) cardClass += ` ${styles.stepCardFailed}`;

          return (
            <div key={step.id} className={cardClass}>
              <div className={styles.stepLeft}>
                <div className={`${styles.stepNumber} ${isCompleted ? styles.stepNumberCompleted : ''}`}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <div className={styles.stepInfo}>
                  <span className={styles.stepTitle}>{step.name}</span>
                  <span className={styles.stepDesc}>{step.description}</span>
                  {step.outputSummary && (
                    <span className={styles.stepSummary}>→ {step.outputSummary}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {step.executionTimeMs !== undefined && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Clock size={11} /> {step.executionTimeMs}ms
                  </span>
                )}

                <span
                  className={`${styles.statusBadge} ${
                    isCompleted
                      ? styles.statusCompleted
                      : isRunningStep
                        ? styles.statusRunning
                        : isWaitingStep
                          ? styles.statusWaiting
                          : isFailedStep
                            ? styles.statusFailed
                            : styles.statusIdle
                  }`}
                >
                  {isCompleted && <CheckCircle size={11} />}
                  {isFailedStep && <AlertCircle size={11} />}
                  {step.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Execution Logs Drawer */}
      <div className={styles.logConsole}>
        <div className={styles.logHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Terminal size={14} /> Pipeline Execution Console
          </span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showLogs && (
          <div className={styles.logLines}>
            {allLogs.length === 0 ? (
              <span style={{ color: '#64748b' }}>Pipeline engine ready. Click "Execute Pipeline" to start.</span>
            ) : (
              allLogs.map((log, i) => (
                <div key={i} className={styles.logLine}>
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

