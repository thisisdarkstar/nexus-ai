import { ScopeEvaluator } from '../assessment/ScopeEvaluator';
import { CorrelationService } from '../intelligence/CorrelationService';
import { OpenApiParser } from '../api/OpenApiParser';
import type { ReconAsset, ScopeItem, VulnerabilityFinding } from '../../types';

export type PipelineStepStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'skipped'
  | 'failed';

export type PipelineStepType =
  | 'ingest_recon'
  | 'scope_filter'
  | 'tech_cluster'
  | 'advisory_correlate'
  | 'api_contract_audit'
  | 'manual_checkpoint'
  | 'report_draft';

export interface PipelineStep {
  id: string;
  name: string;
  type: PipelineStepType;
  description: string;
  status: PipelineStepStatus;
  requiresApproval?: boolean;
  logs: string[];
  outputSummary?: string;
  executionTimeMs?: number;
  config?: Record<string, any>;
}

export interface PipelineExecutionContext {
  projectId: string;
  rawInput?: string;
  assets: ReconAsset[];
  scopeRules: ScopeItem[];
  inScopeAssets: ReconAsset[];
  outOfScopeAssets: ReconAsset[];
  clusteredTech: Record<string, ReconAsset[]>;
  flaggedAdvisories: Array<{
    assetUrl: string;
    tech: string;
    cweId: string;
    title: string;
    severity: string;
  }>;
  draftFindings: VulnerabilityFinding[];
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  isPreset?: boolean;
}

export class PipelineRunner {
  private definition: PipelineDefinition;
  private context: PipelineExecutionContext;
  private currentStepIndex: number = 0;
  private isHaltedForApproval: boolean = false;
  private onStepUpdate?: (step: PipelineStep, index: number) => void;

  constructor(
    definition: PipelineDefinition,
    context: Partial<PipelineExecutionContext> = {},
    onStepUpdate?: (step: PipelineStep, index: number) => void
  ) {
    this.definition = JSON.parse(JSON.stringify(definition)); // deep copy
    this.onStepUpdate = onStepUpdate;
    this.context = {
      projectId: context.projectId || 'default',
      rawInput: context.rawInput || '',
      assets: context.assets || [],
      scopeRules: context.scopeRules || [],
      inScopeAssets: context.inScopeAssets || [],
      outOfScopeAssets: context.outOfScopeAssets || [],
      clusteredTech: context.clusteredTech || {},
      flaggedAdvisories: context.flaggedAdvisories || [],
      draftFindings: context.draftFindings || [],
    };
  }

  public getDefinition(): PipelineDefinition {
    return this.definition;
  }

  public getContext(): PipelineExecutionContext {
    return this.context;
  }

  public isWaitingForApproval(): boolean {
    return this.isHaltedForApproval;
  }

  /**
   * Resets all pipeline steps to idle state.
   */
  public reset(): void {
    this.currentStepIndex = 0;
    this.isHaltedForApproval = false;
    this.definition.steps.forEach((step) => {
      step.status = 'idle';
      step.logs = [];
      step.outputSummary = undefined;
      step.executionTimeMs = undefined;
    });
  }

  /**
   * Executes the pipeline sequentially until completion or manual checkpoint.
   */
  public async execute(): Promise<PipelineExecutionContext> {
    this.isHaltedForApproval = false;

    for (let i = this.currentStepIndex; i < this.definition.steps.length; i++) {
      this.currentStepIndex = i;
      const step = this.definition.steps[i];

      step.status = 'running';
      step.logs = [];
      const startTime = performance.now();
      this.notifyStepUpdate(step, i);

      try {
        if (step.requiresApproval && step.type === 'manual_checkpoint') {
          step.status = 'waiting_approval';
          step.logs.push('[CHECKPOINT] Pipeline execution paused for human tester review.');
          this.isHaltedForApproval = true;
          this.notifyStepUpdate(step, i);
          return this.context;
        }

        await this.runStepLogic(step);

        step.status = 'completed';
        step.executionTimeMs = Math.round(performance.now() - startTime);
        this.notifyStepUpdate(step, i);
      } catch (err: any) {
        step.status = 'failed';
        step.logs.push(`[ERROR] Step failed: ${err.message || String(err)}`);
        step.executionTimeMs = Math.round(performance.now() - startTime);
        this.notifyStepUpdate(step, i);
        throw err;
      }
    }

    return this.context;
  }

  /**
   * Approves a paused manual checkpoint and continues pipeline execution.
   */
  public async approveAndContinue(): Promise<PipelineExecutionContext> {
    const currentStep = this.definition.steps[this.currentStepIndex];
    if (currentStep && currentStep.status === 'waiting_approval') {
      currentStep.status = 'completed';
      currentStep.logs.push('[APPROVAL] Tester confirmed boundary requirements. Proceeding with pipeline.');
      this.notifyStepUpdate(currentStep, this.currentStepIndex);
      this.currentStepIndex++;
      this.isHaltedForApproval = false;
      return this.execute();
    }
    return this.context;
  }

  private notifyStepUpdate(step: PipelineStep, index: number): void {
    if (this.onStepUpdate) {
      this.onStepUpdate({ ...step }, index);
    }
  }

  private async runStepLogic(step: PipelineStep): Promise<void> {
    switch (step.type) {
      case 'ingest_recon': {
        step.logs.push(`Processing input data (${this.context.assets.length} existing assets)...`);
        step.outputSummary = `Loaded ${this.context.assets.length} endpoint records ready for analysis.`;
        break;
      }

      case 'scope_filter': {
        step.logs.push(`Evaluating ${this.context.assets.length} assets against ${this.context.scopeRules.length} scope rules...`);
        const inScope: ReconAsset[] = [];
        const outScope: ReconAsset[] = [];

        for (const asset of this.context.assets) {
          const match = ScopeEvaluator.isTargetInScope(asset.url || asset.host, this.context.scopeRules);
          if (match.inScope) {
            inScope.push(asset);
          } else {
            outScope.push(asset);
          }
        }

        this.context.inScopeAssets = inScope;
        this.context.outOfScopeAssets = outScope;
        step.logs.push(`Scope assessment complete: ${inScope.length} in-scope, ${outScope.length} out-of-scope.`);
        step.outputSummary = `${inScope.length} in-scope assets retained; ${outScope.length} isolated out-of-scope.`;
        break;
      }

      case 'tech_cluster': {
        const targetAssets = this.context.inScopeAssets.length > 0 ? this.context.inScopeAssets : this.context.assets;
        step.logs.push(`Clustering technologies across ${targetAssets.length} assets...`);
        const clusters: Record<string, ReconAsset[]> = {};

        for (const asset of targetAssets) {
          const techs = asset.technologies || [];
          if (techs.length === 0) {
            clusters['Unclassified'] = clusters['Unclassified'] || [];
            clusters['Unclassified'].push(asset);
          } else {
            for (const t of techs) {
              clusters[t] = clusters[t] || [];
              clusters[t].push(asset);
            }
          }
        }

        this.context.clusteredTech = clusters;
        const techNames = Object.keys(clusters).filter((k) => k !== 'Unclassified');
        step.logs.push(`Identified ${techNames.length} distinct technology clusters: ${techNames.slice(0, 5).join(', ')}...`);
        step.outputSummary = `${techNames.length} tech stacks identified across target endpoints.`;
        break;
      }

      case 'advisory_correlate': {
        const targetAssets = this.context.inScopeAssets.length > 0 ? this.context.inScopeAssets : this.context.assets;
        step.logs.push(`Correlating offline advisory catalog against ${targetAssets.length} assets...`);
        const flagged: PipelineExecutionContext['flaggedAdvisories'] = [];

        for (const asset of targetAssets) {
          const correlations = CorrelationService.getInstance().correlateAsset(asset);
          for (const c of correlations) {
            flagged.push({
              assetUrl: asset.url,
              tech: c.advisory.affectedTechnologies[0] || 'Technology',
              cweId: c.advisory.cweId,
              title: c.advisory.title,
              severity: c.advisory.severity,
            });
            step.logs.push(`[${c.confidence.toUpperCase()}] ${asset.url} matches ${c.advisory.title} (${c.advisory.cweId})`);
          }
        }

        this.context.flaggedAdvisories = flagged;
        step.outputSummary = `${flagged.length} potential security advisories correlated for review.`;
        break;
      }

      case 'api_contract_audit': {
        if (!this.context.rawInput) {
          step.logs.push('No raw OpenAPI spec provided in context. Skipping contract audit.');
          step.outputSummary = 'No schema provided to audit.';
          return;
        }

        step.logs.push('Parsing OpenAPI contract specification...');
        const audit = OpenApiParser.parse(this.context.rawInput);
        step.logs.push(`Parsed ${audit.endpoints.length} routes from '${audit.title}' v${audit.version}.`);
        step.logs.push(`Auth Gap Matrix: ${audit.gapMatrix.unauthenticatedCount} unprotected routes, ${audit.gapMatrix.criticalGapsCount} critical.`);
        step.outputSummary = `${audit.endpoints.length} routes audited: ${audit.gapMatrix.unauthenticatedCount} missing auth schemes.`;
        break;
      }

      case 'report_draft': {
        step.logs.push('Synthesizing correlated observations into draft findings...');
        const findings: VulnerabilityFinding[] = [];

        for (let idx = 0; idx < this.context.flaggedAdvisories.length; idx++) {
          const item = this.context.flaggedAdvisories[idx];
          findings.push({
            id: `FIND-${Date.now()}-${idx + 1}`,
            title: `Potential ${item.title} on ${new URL(item.assetUrl).hostname || item.assetUrl}`,
            severity: item.severity as any,
            cweId: item.cweId,
            targetEndpoint: item.assetUrl,
            description: `Automated analysis identified technology fingerprint for ${item.tech}. Manual defensive verification is required.`,
            remediation: `Review defensive hardening guidelines for ${item.tech} and ensure principle of least privilege is applied.`,
            status: 'open',
          });
        }

        this.context.draftFindings = findings;
        step.logs.push(`Generated ${findings.length} draft findings for Report Studio.`);
        step.outputSummary = `${findings.length} findings prepared for executive reporting.`;
        break;
      }

      default:
        step.logs.push(`Step ${step.name} executed.`);
        break;
    }
  }
}

export const PRESET_PIPELINES: PipelineDefinition[] = [
  {
    id: 'pipeline-recon-triage',
    name: 'Attack Surface Recon & Scope Triage',
    description: 'Ingests crawled assets, applies CIDR/wildcard scope boundaries, clusters technologies, and correlates advisories.',
    isPreset: true,
    steps: [
      {
        id: 'step-1',
        name: 'Ingest Recon Dataset',
        type: 'ingest_recon',
        description: 'Loads all normalized endpoints and HTTP metadata.',
        status: 'idle',
        logs: [],
      },
      {
        id: 'step-2',
        name: 'Evaluate Scope Boundaries',
        type: 'scope_filter',
        description: 'Filters out-of-scope hosts and subnets.',
        status: 'idle',
        logs: [],
      },
      {
        id: 'step-3',
        name: 'Cluster Technology Stacks',
        type: 'tech_cluster',
        description: 'Categorizes assets by framework and server signatures.',
        status: 'idle',
        logs: [],
      },
      {
        id: 'step-4',
        name: 'Advisory Knowledge Correlation',
        type: 'advisory_correlate',
        description: 'Cross-references detected services against CWE and OWASP Top 10.',
        status: 'idle',
        logs: [],
      },
      {
        id: 'step-5',
        name: 'Tester Verification Gate',
        type: 'manual_checkpoint',
        description: 'Pauses for human analyst review before populating report findings.',
        status: 'idle',
        requiresApproval: true,
        logs: [],
      },
      {
        id: 'step-6',
        name: 'Synthesize Draft Findings',
        type: 'report_draft',
        description: 'Files verified observations as draft findings in Report Studio.',
        status: 'idle',
        logs: [],
      },
    ],
  },
  {
    id: 'pipeline-api-contract',
    name: 'OpenAPI Contract & Auth Audit',
    description: 'Parses OpenAPI/Swagger specs, analyzes authentication gaps, and checks for BOLA/IDOR vectors.',
    isPreset: true,
    steps: [
      {
        id: 'step-1',
        name: 'Ingest API Specification',
        type: 'api_contract_audit',
        description: 'Validates JSON/YAML contract and builds auth gap matrix.',
        status: 'idle',
        logs: [],
      },
      {
        id: 'step-2',
        name: 'Auditor Review Checkpoint',
        type: 'manual_checkpoint',
        description: 'Auditor examines mutating unprotected routes and IDOR candidates.',
        status: 'idle',
        requiresApproval: true,
        logs: [],
      },
      {
        id: 'step-3',
        name: 'Draft Findings & Checklists',
        type: 'report_draft',
        description: 'Generates API security test cases and vulnerability drafts.',
        status: 'idle',
        logs: [],
      },
    ],
  },
];
