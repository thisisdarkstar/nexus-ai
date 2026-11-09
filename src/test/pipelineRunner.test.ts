import { describe, it, expect } from 'vitest';
import { PipelineRunner, PRESET_PIPELINES } from '../domain/workflow/PipelineRunner';
import type { ReconAsset, ScopeItem } from '../types';

describe('PipelineRunner', () => {
  const sampleAssets: ReconAsset[] = [
    {
      id: 'ast-1',
      url: 'https://app.acme.com/actuator/env',
      host: 'app.acme.com',
      technologies: ['Spring Boot Actuator'],
      riskScore: 'high',
    },
    {
      id: 'ast-2',
      url: 'https://out-of-scope.thirdparty.com/login',
      host: 'out-of-scope.thirdparty.com',
      technologies: ['React'],
      riskScore: 'low',
    },
  ];

  const sampleScope: ScopeItem[] = [
    {
      id: 'scp-1',
      target: '*.acme.com',
      type: 'domain',
      inScope: true,
      status: 'in_progress',
    },
    {
      id: 'scp-2',
      target: 'out-of-scope.thirdparty.com',
      type: 'domain',
      inScope: false,
      status: 'verified_clean',
    },
  ];

  it('halts execution at manual checkpoint step waiting for human approval', async () => {
    const preset = PRESET_PIPELINES[0];
    const runner = new PipelineRunner(preset, {
      assets: sampleAssets,
      scopeRules: sampleScope,
    });

    const ctx = await runner.execute();

    expect(runner.isWaitingForApproval()).toBe(true);
    expect(ctx.inScopeAssets.length).toBe(1);
    expect(ctx.outOfScopeAssets.length).toBe(1);
    expect(ctx.flaggedAdvisories.length).toBeGreaterThanOrEqual(1);

    const checkpointStep = runner.getDefinition().steps.find((s) => s.type === 'manual_checkpoint');
    expect(checkpointStep?.status).toBe('waiting_approval');
  });

  it('resumes and completes pipeline upon human approval', async () => {
    const preset = PRESET_PIPELINES[0];
    const runner = new PipelineRunner(preset, {
      assets: sampleAssets,
      scopeRules: sampleScope,
    });

    // Run until checkpoint
    await runner.execute();
    expect(runner.isWaitingForApproval()).toBe(true);

    // Human approves checkpoint
    const finalCtx = await runner.approveAndContinue();

    expect(runner.isWaitingForApproval()).toBe(false);
    expect(finalCtx.draftFindings.length).toBeGreaterThanOrEqual(1);

    const lastStep = runner.getDefinition().steps[runner.getDefinition().steps.length - 1];
    expect(lastStep.status).toBe('completed');
  });

  it('resets pipeline steps back to idle', async () => {
    const preset = PRESET_PIPELINES[0];
    const runner = new PipelineRunner(preset, { assets: sampleAssets });

    await runner.execute();
    runner.reset();

    expect(runner.isWaitingForApproval()).toBe(false);
    runner.getDefinition().steps.forEach((step) => {
      expect(step.status).toBe('idle');
      expect(step.logs.length).toBe(0);
    });
  });

  it('executes end-to-end defensive research and regression pipeline successfully', async () => {
    const endToEndPreset = PRESET_PIPELINES.find((p) => p.id === 'pipeline-end-to-end-defense');
    expect(endToEndPreset).toBeDefined();

    const runner = new PipelineRunner(endToEndPreset!, {
      assets: sampleAssets,
      scopeRules: sampleScope,
    });

    // Run until manual checkpoint
    const midCtx = await runner.execute();
    expect(runner.isWaitingForApproval()).toBe(true);
    expect(midCtx.assetGraph).toBeDefined();
    expect(midCtx.assetGraph?.getAllNodes().length).toBeGreaterThan(0);
    expect(midCtx.prioritizedItems).toBeDefined();
    expect(midCtx.prioritizedItems?.length).toBeGreaterThan(0);

    // Approve checkpoint and continue to findings and regression suite synthesis
    const finalCtx = await runner.approveAndContinue();
    expect(runner.isWaitingForApproval()).toBe(false);
    expect(finalCtx.draftFindings.length).toBeGreaterThanOrEqual(1);
    expect(finalCtx.regressionSuites).toBeDefined();
    expect(finalCtx.regressionSuites?.length).toBeGreaterThanOrEqual(3); // pytest + jest + curl per finding

    const suites = finalCtx.regressionSuites!;
    expect(suites.some((s) => s.framework === 'pytest')).toBe(true);
    expect(suites.some((s) => s.framework === 'jest')).toBe(true);
    expect(suites.some((s) => s.framework === 'curl')).toBe(true);
    expect(suites.every((s) => s.wasExecuted === false)).toBe(true);
  });
});
