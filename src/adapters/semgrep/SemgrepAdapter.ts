import type { ScannerAdapter, ScanParseContext, ParsedScanOutput } from '../ScannerAdapter';
import type { GraphNode, GraphEdge } from '../../domain/graph/types';
import type { VulnerabilityFinding } from '../../types';

export class SemgrepAdapter implements ScannerAdapter {
  public id = 'semgrep-adapter';
  public name = 'Semgrep SAST Engine (SARIF 2.1)';
  public format = 'semgrep_sarif' as const;

  public canParse(content: string, filename?: string): boolean {
    if (filename && (filename.endsWith('.sarif') || filename.toLowerCase().includes('semgrep'))) return true;
    return content.includes('"version": "2.1.0"') || content.includes('"$schema":') || content.includes('"runs"');
  }

  public async parse(content: string, context: ScanParseContext): Promise<ParsedScanOutput> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const findings: VulnerabilityFinding[] = [];
    const now = Date.now();

    let sarif: any;
    try {
      sarif = JSON.parse(content);
    } catch (e: any) {
      throw new Error(`Invalid SARIF JSON syntax: ${e.message}`);
    }

    const runs = sarif.runs || [];
    for (const run of runs) {
      // Map rule definitions
      const ruleMap = new Map<string, any>();
      const rules = run.tool?.driver?.rules || [];
      for (const r of rules) {
        ruleMap.set(r.id, r);
      }

      const results = run.results || [];
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const ruleId = res.ruleId || `semgrep-rule-${i + 1}`;
        const ruleDef = ruleMap.get(ruleId) || {};
        const title = ruleDef.shortDescription?.text || ruleDef.name || ruleId;
        const description = res.message?.text || ruleDef.help?.text || 'Semgrep identified potential vulnerability.';

        // Severity mapping
        let severity: VulnerabilityFinding['severity'] = 'medium';
        const level = (res.level || 'warning').toLowerCase();
        if (level === 'error') severity = 'high';
        else if (level === 'note') severity = 'low';

        // Extract CWE
        let cweId = 'CWE-200';
        const tags = ruleDef.properties?.tags || [];
        for (const tag of tags) {
          if (typeof tag === 'string' && tag.toUpperCase().includes('CWE-')) {
            const m = tag.match(/CWE-\d+/i);
            if (m) cweId = m[0].toUpperCase();
          }
        }

        // Location
        const loc = res.locations?.[0]?.physicalLocation;
        const filePath = loc?.artifactLocation?.uri || 'unknown-file';
        const lineStart = loc?.region?.startLine || 1;
        const lineEnd = loc?.region?.endLine || lineStart;

        // 1. Source File Graph Node
        const fileNodeId = `file:${filePath}`;
        nodes.push({
          id: fileNodeId,
          projectId: context.projectId,
          type: 'source_file',
          label: filePath,
          inScope: true,
          riskScore: severity === 'high' ? 75 : 40,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: { lineStart, lineEnd },
          evidenceIds: [],
        });

        // 2. Finding Record
        const findingId = `SEMGREP-${ruleId}-${i + 1}`;
        const finding: VulnerabilityFinding = {
          id: findingId,
          title: `[SAST] ${title}`,
          severity,
          cweId,
          owaspCategory: 'Static Code Analysis',
          file: filePath,
          lineStart,
          lineEnd,
          description: `${description}\n\nFile Location: \`${filePath}:${lineStart}\``,
          remediation: ruleDef.help?.markdown || 'Apply defensive coding practices and parameterize inputs.',
          status: 'open',
        };
        findings.push(finding);

        // 3. Finding Graph Node
        const findingNodeId = `find:${findingId}`;
        nodes.push({
          id: findingNodeId,
          projectId: context.projectId,
          type: 'finding',
          label: title,
          inScope: true,
          riskScore: severity === 'high' ? 85 : 45,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: { ruleId, cweId, filePath, lineStart },
          evidenceIds: [],
        });

        // 4. Connect File -> Finding
        edges.push({
          id: `${fileNodeId}->${findingNodeId}:defined_in`,
          projectId: context.projectId,
          sourceId: fileNodeId,
          targetId: findingNodeId,
          relationship: 'defined_in',
        });
      }
    }

    return { nodes, edges, findings };
  }
}
