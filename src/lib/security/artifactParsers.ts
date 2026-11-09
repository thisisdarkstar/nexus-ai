import type { VulnerabilityFinding, ScopeItem, ReconAsset } from '../../types';

export interface ParsedArtifactResult {
  sourceType:
    | 'burp'
    | 'nmap'
    | 'nuclei'
    | 'sarif'
    | 'openapi'
    | 'httpx'
    | 'subdomains'
    | 'endpoints'
    | 'reconftw'
    | 'unknown';
  summary: string;
  findings: VulnerabilityFinding[];
  scopeItems: ScopeItem[];
  reconAssets?: ReconAsset[];
  rawRequests: string[];
}

/**
 * Universal Security Artifact Ingestion Parser
 * Parses Burp Suite XML, Nmap XML, Nuclei JSONL, SARIF 2.1, OpenAPI/Swagger,
 * Httpx JSON/Text, Subdomains lists, and Katana/GAU Endpoints.
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
  if (
    (trimmed.includes('"$schema"') && trimmed.includes('sarif')) ||
    trimmed.includes('"version": "2.1.0"')
  ) {
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
  if (
    trimmed.includes('"openapi"') ||
    trimmed.includes('"swagger"') ||
    trimmed.includes('openapi:') ||
    trimmed.includes('swagger:')
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.paths && typeof parsed.paths === 'object') {
        return parseOpenApi(parsed, fileName);
      }
    } catch {
      // might be YAML or custom
    }
  }

  // 6. Check for Httpx JSON Lines
  if (isHttpxJson(trimmed)) {
    return parseHttpxJson(trimmed, fileName);
  }

  // 7. Check for Httpx CLI probe output lines (e.g. "https://domain.com [200] [Title] [tech]")
  if (isHttpxText(trimmed)) {
    return parseHttpxText(trimmed, fileName);
  }

  // 8. Check for URLs / Endpoints dump (Katana / GAU / Waybackurls / Paramspider)
  if (isEndpointsList(trimmed)) {
    return parseEndpointsList(trimmed, fileName);
  }

  // 9. Check for Subdomains / Hosts list (Subfinder / Assetfinder / Amass)
  if (isSubdomainsList(trimmed)) {
    return parseSubdomainsList(trimmed, fileName);
  }

  return {
    sourceType: 'unknown',
    summary: `Unrecognized file format for ${fileName}. Expected Burp XML, Nmap XML, Nuclei JSON, SARIF, OpenAPI, Httpx, Subdomains, or Endpoints list.`,
    findings: [],
    scopeItems: [],
    reconAssets: [],
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// BURP SUITE XML PARSER
// -------------------------------------------------------------
function parseBurpXmlRegex(xmlText: string): ParsedArtifactResult {
  const scopeMap = new Map<string, ScopeItem>();
  const rawRequests: string[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    const host = (/<host[^>]*>([^<]+)<\/host>/i.exec(itemContent)?.[1] || '').trim();
    const port = (/<port[^>]*>([^<]+)<\/port>/i.exec(itemContent)?.[1] || '443').trim();
    const protocol = (/<protocol[^>]*>([^<]+)<\/protocol>/i.exec(itemContent)?.[1] || 'https').trim();
    const requestBase64 = /<request[^>]*base64="true"[^>]*>([^<]+)<\/request>/i.exec(itemContent)?.[1];
    const requestRaw = /<request[^>]*>([^<]+)<\/request>/i.exec(itemContent)?.[1];

    if (host && !scopeMap.has(host)) {
      scopeMap.set(host, {
        id: `scope-burp-${idx}-${Date.now()}`,
        target: `${protocol}://${host}${port !== '80' && port !== '443' ? `:${port}` : ''}`,
        type: 'domain',
        inScope: true,
        techStack: ['Burp Suite Ingested'],
        notes: `Extracted from Burp XML`,
        status: 'untested',
      });
    }

    if (rawRequests.length < 50) {
      if (requestBase64) {
        try {
          rawRequests.push(atob(requestBase64));
        } catch {
          // ignore
        }
      } else if (requestRaw) {
        rawRequests.push(requestRaw);
      }
    }
    idx++;
  }

  const scopeItems = Array.from(scopeMap.values());
  return {
    sourceType: 'burp',
    summary: `Burp Suite XML: Ingested ${idx} requests across ${scopeItems.length} unique hosts.`,
    findings: [],
    scopeItems,
    rawRequests,
  };
}

function parseBurpXml(xmlText: string, fileName: string): ParsedArtifactResult {
  if (typeof DOMParser === 'undefined') {
    return parseBurpXmlRegex(xmlText);
  }
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
function parseNmapXmlRegex(xmlText: string): ParsedArtifactResult {
  const scopeItems: ScopeItem[] = [];
  const hostRegex = /<host[\s\S]*?<\/host>/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = hostRegex.exec(xmlText)) !== null) {
    const hostContent = match[1];
    const addr = /<address[^>]*addr="([^"]+)"/i.exec(hostContent)?.[1] || '';
    const hostName = /<hostname[^>]*name="([^"]+)"/i.exec(hostContent)?.[1] || addr;
    const target = hostName || addr;
    if (!target) continue;

    const ports: string[] = [];
    const portRegex = /<port[^>]*portid="([^"]+)"[\s\S]*?<state[^>]*state="open"[\s\S]*?<\/port>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = portRegex.exec(hostContent)) !== null) {
      ports.push(pMatch[1]);
    }

    scopeItems.push({
      id: `scope-nmap-${idx}-${Date.now()}`,
      target,
      type: target.match(/^\d+\.\d+\.\d+\.\d+$/) ? 'ip_range' : 'domain',
      inScope: true,
      techStack: ports.length > 0 ? [`Ports: ${ports.join(', ')}`] : ['Host Up'],
      notes: `Discovered by Nmap`,
      status: 'untested',
    });
    idx++;
  }

  return {
    sourceType: 'nmap',
    summary: `Nmap XML: Discovered ${scopeItems.length} active network hosts.`,
    findings: [],
    scopeItems,
    rawRequests: [],
  };
}

function parseNmapXml(xmlText: string, fileName: string): ParsedArtifactResult {
  if (typeof DOMParser === 'undefined') {
    return parseNmapXmlRegex(xmlText);
  }
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

// -------------------------------------------------------------
// RECON INTELLIGENCE & ASSET RISK SCORING
// -------------------------------------------------------------
const SSRF_PARAMS = new Set(['url', 'dest', 'redirect', 'uri', 'path', 'webhook', 'callback', 'target', 'feed', 'host', 'port', 'to', 'out', 'domain']);
const IDOR_PARAMS = new Set(['id', 'user_id', 'uid', 'account', 'account_id', 'doc_id', 'order_id', 'transaction_id', 'uuid', 'profile_id', 'customer_id']);
const LFI_SSTI_PARAMS = new Set(['file', 'filename', 'filepath', 'template', 'view', 'page', 'include', 'layout', 'doc', 'theme']);

export function scoreReconAsset(
  urlStr: string,
  title?: string,
  webserver?: string,
  technologies: string[] = [],
  statusCode?: number
): { riskScore: ReconAsset['riskScore']; flags: string[] } {
  const flags: string[] = [];
  const lowerUrl = urlStr.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();
  const lowerTech = technologies.map((t) => t.toLowerCase()).join(' ');

  let currentLevel = 0; // 0=info, 1=low, 2=medium, 3=high, 4=critical
  const elevate = (level: number) => {
    if (level > currentLevel) currentLevel = level;
  };

  // 1. Critical Exposure Patterns
  if (lowerUrl.includes('/actuator') || lowerUrl.includes('/heapdump') || lowerUrl.includes('/env') || lowerUrl.includes('/prometheus')) {
    flags.push('Spring Actuator Exposure');
    elevate(4);
  } else if (lowerUrl.includes('/.env') || lowerUrl.includes('/.git') || lowerUrl.includes('/.aws') || lowerUrl.includes('/web.config') || lowerUrl.includes('/phpinfo')) {
    flags.push('Exposed Config / Source File');
    elevate(4);
  }

  // 2. High Value Bounty Targets
  if (lowerUrl.includes('swagger') || lowerUrl.includes('api-docs') || lowerUrl.includes('openapi.json') || lowerTitle.includes('swagger')) {
    flags.push('Exposed Swagger / API Docs');
    elevate(3);
  }

  if (lowerUrl.includes('graphql') || lowerUrl.includes('graphiql') || lowerUrl.includes('altair') || lowerTitle.includes('graphql')) {
    flags.push('GraphQL Endpoint');
    elevate(3);
  }

  if (
    lowerUrl.includes('admin') ||
    lowerUrl.includes('/dashboard') ||
    lowerUrl.includes('/portal') ||
    lowerUrl.includes('/login') ||
    lowerTitle.includes('admin') ||
    lowerTitle.includes('login')
  ) {
    flags.push('Admin / Auth Portal');
    elevate(3);
  }

  if (
    lowerUrl.includes('dev.') ||
    lowerUrl.includes('stage.') ||
    lowerUrl.includes('staging.') ||
    lowerUrl.includes('test.') ||
    lowerUrl.includes('uat.') ||
    lowerUrl.includes('internal.') ||
    lowerUrl.includes('vpn.')
  ) {
    flags.push('Pre-Production / Dev Subdomain');
    elevate(3);
  }

  if (lowerUrl.includes('s3.amazonaws.com') || lowerUrl.includes('storage.googleapis.com') || lowerUrl.includes('blob.core.windows.net')) {
    flags.push('Direct Cloud Storage Bucket');
    elevate(3);
  }

  // 3. Parameter Anomaly Analysis (SSRF / IDOR / LFI)
  try {
    const parsedUrl = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    const paramNames = Array.from(parsedUrl.searchParams.keys()).map((p) => p.toLowerCase());

    const hasSsrf = paramNames.some((p) => SSRF_PARAMS.has(p));
    if (hasSsrf) {
      flags.push('SSRF Candidate Param');
      elevate(3);
    }

    const hasLfi = paramNames.some((p) => LFI_SSTI_PARAMS.has(p));
    if (hasLfi) {
      flags.push('LFI / SSTI Param');
      elevate(3);
    }

    const hasIdor = paramNames.some((p) => IDOR_PARAMS.has(p));
    if (hasIdor) {
      flags.push('IDOR / BOLA Param');
      elevate(2);
    }
  } catch {
    // ignore URL parse errors on bare strings
  }

  // 4. Status Code context
  if (statusCode === 403 || statusCode === 401) {
    flags.push(`${statusCode} Auth Protected (Bypass Candidate)`);
    elevate(1);
  } else if (statusCode === 500) {
    flags.push('500 Server Error (Unhandled Exception)');
    elevate(2);
  }

  const scoreNames: Array<NonNullable<ReconAsset['riskScore']>> = ['info', 'low', 'medium', 'high', 'critical'];
  const finalScore = scoreNames[currentLevel] || 'info';

  return { riskScore: finalScore, flags };
}

// -------------------------------------------------------------
// HTTPX JSONL PARSER (reconFTW / magicRecon / httpx -json)
// -------------------------------------------------------------
function isHttpxJson(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const sample = lines.slice(0, 5);
  return sample.every((l) => {
    try {
      const parsed = JSON.parse(l);
      return typeof parsed === 'object' && (parsed.url || parsed.input) && (parsed.status_code !== undefined || parsed['status-code'] !== undefined || parsed.webserver || parsed.title);
    } catch {
      return false;
    }
  });
}

function parseHttpxJson(text: string, fileName: string): ParsedArtifactResult {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const reconAssets: ReconAsset[] = [];
  const scopeItems: ScopeItem[] = [];
  const rawRequests: string[] = [];

  lines.forEach((line, idx) => {
    try {
      const obj = JSON.parse(line);
      const url = obj.url || (obj.input ? (obj.input.startsWith('http') ? obj.input : `https://${obj.input}`) : '');
      if (!url) return;

      const statusCode = obj.status_code || obj['status-code'] || 200;
      const title = obj.title || '';
      const webserver = obj.webserver || '';
      const technologies: string[] = Array.isArray(obj.tech) ? obj.tech : (obj.tech ? [obj.tech] : []);
      const contentLength = obj.content_length || obj['content-length'] || 0;
      const contentType = obj.content_type || obj['content-type'] || '';

      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const port = urlObj.port ? parseInt(urlObj.port, 10) : urlObj.protocol === 'https:' ? 443 : 80;

      const { riskScore, flags } = scoreReconAsset(url, title, webserver, technologies, statusCode);

      const asset: ReconAsset = {
        id: `httpx-${idx}-${Date.now()}`,
        url,
        host,
        port,
        protocol: urlObj.protocol.replace(':', '') as 'http' | 'https',
        statusCode,
        title,
        webserver,
        technologies,
        contentLength,
        contentType,
        highInterestFlags: flags,
        riskScore,
        source: 'httpx',
        createdAt: Date.now(),
      };

      reconAssets.push(asset);

      // Create scope item
      scopeItems.push({
        id: `scope-httpx-${idx}`,
        target: url,
        type: 'domain',
        inScope: true,
        techStack: technologies.length > 0 ? technologies : [webserver || 'Web'],
        notes: `Imported from ${fileName}: [${statusCode}] ${title}`,
        status: 'untested',
      });

      // Sample request for HTTP studio
      if (idx < 5) {
        rawRequests.push(`GET ${urlObj.pathname || '/'}${urlObj.search || ''} HTTP/1.1\nHost: ${host}\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\nAccept: */*\n\n`);
      }
    } catch {
      // skip invalid line
    }
  });

  return {
    sourceType: 'httpx',
    summary: `Httpx Recon Report: Ingested ${reconAssets.length} probed web endpoints with status codes, page titles, and tech fingerprints.`,
    findings: [],
    scopeItems,
    reconAssets,
    rawRequests,
  };
}

// -------------------------------------------------------------
// HTTPX CLI PROBE TEXT PARSER (e.g. "https://domain.com [200] [Title] [tech]")
// -------------------------------------------------------------
function isHttpxText(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0).slice(0, 5);
  if (lines.length === 0) return false;
  return lines.every((l) => /^https?:\/\/\S+\s+\[\d{3}\]/i.test(l.trim()));
}

function parseHttpxText(text: string, fileName: string): ParsedArtifactResult {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const reconAssets: ReconAsset[] = [];
  const scopeItems: ScopeItem[] = [];

  lines.forEach((line, idx) => {
    // Regex matches: https://target.com [200] [Title] [tech]
    const match = line.match(/^(https?:\/\/\S+)\s+\[(\d{3})\](?:\s+\[([^\]]*)\])?(?:\s+\[([^\]]*)\])?/);
    if (!match) return;

    const url = match[1];
    const statusCode = parseInt(match[2], 10);
    const title = match[3] || '';
    const extra = match[4] || '';

    const technologies = extra ? extra.split(',').map((t) => t.trim()) : [];
    const webserver = extra && !extra.includes(',') ? extra : '';

    try {
      const urlObj = new URL(url);
      const { riskScore, flags } = scoreReconAsset(url, title, webserver, technologies, statusCode);

      reconAssets.push({
        id: `httpx-txt-${idx}-${Date.now()}`,
        url,
        host: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port, 10) : urlObj.protocol === 'https:' ? 443 : 80,
        protocol: urlObj.protocol.replace(':', '') as 'http' | 'https',
        statusCode,
        title,
        webserver,
        technologies,
        highInterestFlags: flags,
        riskScore,
        source: 'httpx',
        createdAt: Date.now(),
      });

      scopeItems.push({
        id: `scope-httpx-txt-${idx}`,
        target: url,
        type: 'domain',
        inScope: true,
        techStack: technologies.length > 0 ? technologies : ['Web'],
        notes: `Httpx Probe: [${statusCode}] ${title}`,
        status: 'untested',
      });
    } catch {
      // skip
    }
  });

  return {
    sourceType: 'httpx',
    summary: `Httpx CLI Output: Ingested ${reconAssets.length} live host probes from ${fileName}.`,
    findings: [],
    scopeItems,
    reconAssets,
    rawRequests: [],
  };
}

// -------------------------------------------------------------
// ENDPOINTS / URLS LIST PARSER (Katana / GAU / Waybackurls / Paramspider)
// -------------------------------------------------------------
function isEndpointsList(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0).slice(0, 10);
  if (lines.length === 0) return false;
  const urlCount = lines.filter((l) => /^https?:\/\//i.test(l.trim())).length;
  return urlCount >= Math.min(3, lines.length) && lines.some((l) => l.includes('/') || l.includes('?'));
}

function parseEndpointsList(text: string, fileName: string): ParsedArtifactResult {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const reconAssets: ReconAsset[] = [];
  const scopeItems: ScopeItem[] = [];
  const rawRequests: string[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('http')) return;

    try {
      const urlObj = new URL(trimmed);
      const { riskScore, flags } = scoreReconAsset(trimmed);

      reconAssets.push({
        id: `ep-${idx}-${Date.now()}`,
        url: trimmed,
        host: urlObj.hostname,
        protocol: urlObj.protocol.replace(':', '') as 'http' | 'https',
        port: urlObj.port ? parseInt(urlObj.port, 10) : urlObj.protocol === 'https:' ? 443 : 80,
        highInterestFlags: flags,
        riskScore,
        source: 'endpoints',
        createdAt: Date.now(),
      });

      if (idx < 50) {
        scopeItems.push({
          id: `scope-ep-${idx}`,
          target: trimmed,
          type: 'api',
          inScope: true,
          techStack: ['Endpoint'],
          notes: `Endpoint from ${fileName}`,
          status: 'untested',
        });
      }

      if (idx < 3) {
        rawRequests.push(`GET ${urlObj.pathname || '/'}${urlObj.search || ''} HTTP/1.1\nHost: ${urlObj.hostname}\nUser-Agent: Mozilla/5.0\nAccept: */*\n\n`);
      }
    } catch {
      // ignore
    }
  });

  return {
    sourceType: 'endpoints',
    summary: `Endpoints / Crawl List: Ingested ${reconAssets.length} URLs with parameter analysis from ${fileName}.`,
    findings: [],
    scopeItems,
    reconAssets,
    rawRequests,
  };
}

// -------------------------------------------------------------
// SUBDOMAINS LIST PARSER (Subfinder / Assetfinder / Amass / subdomains.txt)
// -------------------------------------------------------------
function isSubdomainsList(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0).slice(0, 10);
  if (lines.length === 0) return false;
  // Domain pattern: domain.com, sub.domain.com, etc.
  return lines.every((l) => /^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(?::\d+)?$/.test(l.trim()));
}

function parseSubdomainsList(text: string, fileName: string): ParsedArtifactResult {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const reconAssets: ReconAsset[] = [];
  const scopeItems: ScopeItem[] = [];

  lines.forEach((line, idx) => {
    const host = line.trim();
    if (!host) return;

    const url = `https://${host}`;
    const { riskScore, flags } = scoreReconAsset(url);

    reconAssets.push({
      id: `sub-${idx}-${Date.now()}`,
      url,
      host,
      protocol: 'https',
      port: 443,
      highInterestFlags: flags,
      riskScore,
      source: 'subdomains',
      createdAt: Date.now(),
    });

    scopeItems.push({
      id: `scope-sub-${idx}`,
      target: host,
      type: 'domain',
      inScope: true,
      notes: `Subdomain discovered in ${fileName}`,
      status: 'untested',
    });
  });

  return {
    sourceType: 'subdomains',
    summary: `Subdomain Enumeration List: Ingested ${reconAssets.length} subdomains from ${fileName}.`,
    findings: [],
    scopeItems,
    reconAssets,
    rawRequests: [],
  };
}

