import type { VulnerabilityFinding, ScopeItem } from '../../types';

export interface ParsedArtifactResult {
  sourceType: 'burp' | 'nmap' | 'nuclei' | 'sarif' | 'openapi' | 'unknown';
  summary: string;
  findings: VulnerabilityFinding[];
  scopeItems: ScopeItem[];
  rawRequests: string[];
}

/**
 * Universal Security Artifact Ingestion Parser
 * Parses Burp Suite XML, Nmap XML, Nuclei JSONL, SARIF 2.1, and OpenAPI/Swagger files.
 */
export function parseSecurityArtifact(content: string, fileName: string): ParsedArtifactResult {
  const trimmed = content.trim();

  // 1. Check for Burp Suite XML
  if (trimmed.includes('<items') && trimmed.includes('<item>') && trimmed.includes('<request')) {
    return parseBurpXml(trimmed, fileName);
  }

  // 2. Check for Nmap XML
  if (trimmed.includes('<nmaprun') || (trimmed.includes('<host>') && trimmed.includes('<ports>'))) {
    return parseNmapXml(trimmed, fileName);
  }

  // 3. Check for Nuclei JSONL
  if (isNucleiJson(trimmed)) {
    return parseNucleiJson(trimmed, fileName);
  }

  // 4. Check for SARIF
  if (trimmed.includes('"$schema"') && trimmed.includes('sarif') || trimmed.includes('"version": "2.1.0"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.runs && Array.isArray(parsed.runs)) {
        return parseSarif(parsed, fileName);
      }
    } catch {
      // ignore
    }
  }

  // 5. Check for OpenAPI / Swagger
  if (trimmed.includes('"openapi"') || trimmed.includes('"swagger"') || trimmed.includes('openapi:') || trimmed.includes('swagger:')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.paths && typeof parsed.paths === 'object') {
        return parseOpenApi(parsed, fileName);
      }
    } catch {
      // might be YAML or custom
    }
  }

  return {
    sourceType: 'unknown',
    summary: `Unrecognized file format for ${fileName}. Expected Burp XML, Nmap XML, Nuclei JSON, SARIF, or OpenAPI.`,
    findings: [],
    scopeItems: [],
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// BURP SUITE XML PARSER
// -------------------------------------------------------------
function parseBurpXml(xmlText: string, fileName: string): ParsedArtifactResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const items = doc.querySelectorAll('item');

  const scopeMap = new Map<string, ScopeItem>();
  const rawRequests: string[] = [];

  items.forEach((item, idx) => {
    const host = item.querySelector('host')?.textContent?.trim() || '';
    const path = item.querySelector('path')?.textContent?.trim() || '';
    const port = item.querySelector('port')?.textContent?.trim() || '443';
    const protocol = item.querySelector('protocol')?.textContent?.trim() || 'https';
    const method = item.querySelector('method')?.textContent?.trim() || 'GET';
    const requestEl = item.querySelector('request');

    if (host && !scopeMap.has(host)) {
      scopeMap.set(host, {
        id: `scope-burp-${idx}-${Date.now()}`,
        target: `${protocol}://${host}${port !== '80' && port !== '443' ? `:${port}` : ''}`,
        type: 'domain',
        inScope: true,
        techStack: ['Web'],
        notes: `Imported from Burp Suite item (${method} ${path})`,
        status: 'untested',
      });
    }

    if (requestEl) {
      const isBase64 = requestEl.getAttribute('base64') === 'true';
      let rawReq = requestEl.textContent || '';
      if (isBase64) {
        try {
          rawReq = atob(rawReq);
        } catch {
          // ignore
        }
      }
      if (rawReq && rawRequests.length < 5) {
        rawRequests.push(rawReq);
      }
    }
  });

  const scopeItems = Array.from(scopeMap.values());
  return {
    sourceType: 'burp',
    summary: `Burp Suite XML: Ingested ${items.length} requests across ${scopeItems.length} unique hosts.`,
    findings: [],
    scopeItems,
    rawRequests,
  };
}

// -------------------------------------------------------------
// NMAP XML PARSER
// -------------------------------------------------------------
function parseNmapXml(xmlText: string, fileName: string): ParsedArtifactResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const hosts = doc.querySelectorAll('host');

  const scopeItems: ScopeItem[] = [];

  hosts.forEach((hostEl, idx) => {
    const addr = hostEl.querySelector('address[addrtype="ipv4"], address[addrtype="ipv6"]')?.getAttribute('addr') || '';
    const hostName = hostEl.querySelector('hostnames hostname')?.getAttribute('name') || addr;
    const target = hostName || addr;
    if (!target) return;

    const ports: string[] = [];
    const techStack: string[] = ['Network'];

    hostEl.querySelectorAll('ports port').forEach((portEl) => {
      const state = portEl.querySelector('state')?.getAttribute('state');
      if (state === 'open') {
        const portId = portEl.getAttribute('portid') || '';
        const service = portEl.querySelector('service')?.getAttribute('name') || '';
        const product = portEl.querySelector('service')?.getAttribute('product') || '';
        const portDesc = service ? `${portId}/${service}` : portId;
        ports.push(portDesc);
        if (product && !techStack.includes(product)) {
          techStack.push(product);
        }
      }
    });

    scopeItems.push({
      id: `scope-nmap-${idx}-${Date.now()}`,
      target,
      type: target.match(/^\d+\.\d+\.\d+\.\d+$/) ? 'ip_range' : 'domain',
      inScope: true,
      techStack: techStack.concat(ports.slice(0, 5)),
      notes: `Nmap Scan: ${ports.length} open ports (${ports.join(', ')}).`,
      status: 'untested',
    });
  });

  return {
    sourceType: 'nmap',
    summary: `Nmap Scan: Discovered ${hosts.length} hosts with active services.`,
    findings: [],
    scopeItems,
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// NUCLEI JSON / JSONL PARSER
// -------------------------------------------------------------
function isNucleiJson(text: string): boolean {
  if (text.startsWith('{') && text.includes('"template-id"')) return true;
  const lines = text.split('\n');
  return lines.length > 0 && lines[0].includes('"template-id"');
}

function parseNucleiJson(text: string, fileName: string): ParsedArtifactResult {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const findings: VulnerabilityFinding[] = [];
  const scopeMap = new Map<string, ScopeItem>();

  lines.forEach((line, idx) => {
    try {
      const item = JSON.parse(line);
      const templateId = item['template-id'] || 'nuclei-finding';
      const info = item.info || {};
      const severityStr = (info.severity || 'medium').toLowerCase();
      const severity: VulnerabilityFinding['severity'] = ['critical', 'high', 'medium', 'low', 'info'].includes(severityStr)
        ? severityStr
        : 'medium';

      const matchedAt = item['matched-at'] || item.host || '';
      const cweId = Array.isArray(info.classification?.['cwe-id'])
        ? info.classification['cwe-id'][0]
        : info.classification?.['cwe-id'] || 'CWE-200';

      findings.push({
        id: `nuclei-${idx}-${Date.now()}`,
        title: info.name || templateId,
        severity,
        cweId,
        owaspCategory: info.classification?.['owasp-top10'] || 'A05:2021-Security Misconfiguration',
        targetEndpoint: matchedAt,
        description: info.description || `Nuclei template ${templateId} matched at ${matchedAt}.`,
        remediation: info.remediation || 'Review endpoint exposure, update software to the latest patched version, and disable unneeded services.',
        pocSteps: item['curl-command'] ? [item['curl-command']] : [`Nuclei template ID: ${templateId}`],
        references: Array.isArray(info.reference) ? info.reference : [],
        status: 'triaged',
      });

      if (matchedAt) {
        try {
          const u = new URL(matchedAt);
          if (!scopeMap.has(u.hostname)) {
            scopeMap.set(u.hostname, {
              id: `scope-nuclei-${idx}-${Date.now()}`,
              target: u.hostname,
              type: 'domain',
              inScope: true,
              techStack: ['Web'],
              notes: `Identified by Nuclei: ${info.name || templateId}`,
              status: severity === 'critical' || severity === 'high' ? 'vulnerable' : 'in_progress',
            });
          }
        } catch {
          // not a full url
        }
      }
    } catch {
      // ignore individual corrupted json lines
    }
  });

  return {
    sourceType: 'nuclei',
    summary: `Nuclei Scanner: Imported ${findings.length} findings across ${scopeMap.size} targets.`,
    findings,
    scopeItems: Array.from(scopeMap.values()),
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// SARIF 2.1 PARSER (Semgrep, Snyk, CodeQL)
// -------------------------------------------------------------
function parseSarif(sarifObj: any, fileName: string): ParsedArtifactResult {
  const findings: VulnerabilityFinding[] = [];
  const runs = sarifObj.runs || [];

  runs.forEach((run: any) => {
    const rules = run.tool?.driver?.rules || [];
    const ruleMap = new Map<string, any>();
    rules.forEach((r: any) => ruleMap.set(r.id, r));

    const results = run.results || [];
    results.forEach((res: any, idx: number) => {
      const rule = ruleMap.get(res.ruleId) || {};
      const level = res.level || 'warning';
      let severity: VulnerabilityFinding['severity'] = 'medium';
      if (level === 'error') severity = 'high';
      else if (level === 'note') severity = 'low';

      const loc = res.locations?.[0]?.physicalLocation;
      const fileUri = loc?.artifactLocation?.uri || 'unknown';
      const lineStart = loc?.region?.startLine || 1;
      const lineEnd = loc?.region?.endLine || lineStart;

      findings.push({
        id: `sarif-${idx}-${Date.now()}`,
        title: rule.name || res.ruleId || 'Static Code Finding',
        severity,
        cweId: rule.properties?.cwe?.[0] || 'CWE-699',
        file: fileUri,
        lineStart,
        lineEnd,
        description: res.message?.text || rule.shortDescription?.text || 'SARIF static security alert.',
        remediation: rule.help?.text || 'Refactor code according to safe development practices for this vulnerability class.',
        status: 'open',
      });
    });
  });

  return {
    sourceType: 'sarif',
    summary: `SARIF Static Analysis: Ingested ${findings.length} code security issues.`,
    findings,
    scopeItems: [],
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// OPENAPI / SWAGGER PARSER
// -------------------------------------------------------------
function parseOpenApi(apiObj: any, fileName: string): ParsedArtifactResult {
  const scopeItems: ScopeItem[] = [];
  const basePath = apiObj.servers?.[0]?.url || (apiObj.host ? `${apiObj.schemes?.[0] || 'https'}://${apiObj.host}${apiObj.basePath || ''}` : '');
  const paths = Object.keys(apiObj.paths || {});

  paths.slice(0, 50).forEach((pathKey, idx) => {
    const methods = Object.keys(apiObj.paths[pathKey] || {}).join(', ').toUpperCase();
    const fullTarget = basePath ? `${basePath}${pathKey}` : pathKey;
    scopeItems.push({
      id: `openapi-${idx}-${Date.now()}`,
      target: fullTarget,
      type: 'api',
      inScope: true,
      techStack: ['REST API', methods],
      notes: `OpenAPI Endpoint: ${methods}`,
      status: 'untested',
    });
  });

  return {
    sourceType: 'openapi',
    summary: `OpenAPI Schema (${apiObj.info?.title || 'API'}): Ingested ${paths.length} endpoints.`,
    findings: [],
    scopeItems,
    rawRequests: [],
  };
}

