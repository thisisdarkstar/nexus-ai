import type { ScannerAdapter, ScanParseContext, ParsedScanOutput } from '../ScannerAdapter';
import type { GraphNode, GraphEdge } from '../../domain/graph/types';
import type { VulnerabilityFinding } from '../../types';
import { ScopeEvaluator } from '../../domain/assessment/ScopeEvaluator';

export class NucleiAdapter implements ScannerAdapter {
  public id = 'nuclei-adapter';
  public name = 'Nuclei v3 Vulnerability Scanner (JSONL)';
  public format = 'nuclei_jsonl' as const;

  public canParse(content: string, filename?: string): boolean {
    if (filename && filename.toLowerCase().includes('nuclei')) return true;
    const firstLine = content.trim().split('\n')[0] || '';
    return firstLine.includes('"template-id"') || firstLine.includes('"templateID"') || firstLine.includes('"matcher-name"');
  }

  public async parse(content: string, context: ScanParseContext): Promise<ParsedScanOutput> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const findings: VulnerabilityFinding[] = [];
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const now = Date.now();

    for (let i = 0; i < lines.length; i++) {
      try {
        const item = JSON.parse(lines[i]);
        const templateId = item['template-id'] || item['templateID'] || `nuclei-match-${i + 1}`;
        const name = item.info?.name || templateId;
        const severity = (item.info?.severity || 'info').toLowerCase() as VulnerabilityFinding['severity'];
        const matchedUrl = item['matched-at'] || item.host || 'http://unknown-target';
        const curlCommand = item['curl-command'] || '';
        const description = item.info?.description || `Nuclei template ${templateId} matched on ${matchedUrl}.`;
        const cweList = item.info?.classification?.['cwe-id'] || [];
        const cweId = Array.isArray(cweList) && cweList.length > 0 ? (typeof cweList[0] === 'string' && cweList[0].startsWith('CWE-') ? cweList[0] : `CWE-${cweList[0]}`) : 'CWE-200';

        const inScope = context.scopeRules && context.scopeRules.length > 0
          ? ScopeEvaluator.isTargetInScope(matchedUrl, context.scopeRules).inScope
          : true;

        // 1. Endpoint Graph Node
        const epNodeId = `ep:${matchedUrl}`;
        nodes.push({
          id: epNodeId,
          projectId: context.projectId,
          type: 'http_endpoint',
          label: matchedUrl,
          inScope,
          riskScore: severity === 'critical' ? 95 : severity === 'high' ? 80 : severity === 'medium' ? 50 : 20,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: {
            templateId,
            curlCommand,
            matcherName: item['matcher-name'],
          },
          evidenceIds: [],
        });

        // 2. Finding Record
        const findingId = `NUC-${templateId}-${i + 1}`;
        const finding: VulnerabilityFinding = {
          id: findingId,
          title: `[Nuclei] ${name}`,
          severity,
          cweId,
          owaspCategory: 'Vulnerability Detection',
          targetEndpoint: matchedUrl,
          description: `${description}\n\nReproducible cURL Command:\n\`\`\`bash\n${curlCommand || `curl -i -s -k "${matchedUrl}"`}\n\`\`\``,
          remediation: 'Review endpoint configuration, apply vendor security patches, and restrict unauthorized access.',
          status: 'open',
        };
        findings.push(finding);

        // 3. Finding Graph Node
        const findingNodeId = `find:${findingId}`;
        nodes.push({
          id: findingNodeId,
          projectId: context.projectId,
          type: 'finding',
          label: name,
          inScope,
          riskScore: severity === 'critical' ? 100 : severity === 'high' ? 80 : 40,
          confidence: 'confirmed',
          firstSeenAt: now,
          lastSeenAt: now,
          attributes: { severity, cweId },
          evidenceIds: [],
        });

        // 4. Connect Endpoint -> Finding
        edges.push({
          id: `${epNodeId}->${findingNodeId}:exhibits_finding`,
          projectId: context.projectId,
          sourceId: epNodeId,
          targetId: findingNodeId,
          relationship: 'exhibits_finding',
        });
      } catch {
        // Skip malformed line
      }
    }

    return { nodes, edges, findings };
  }
}

