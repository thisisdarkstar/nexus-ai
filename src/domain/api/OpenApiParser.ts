import { load as loadYaml } from 'js-yaml';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type ApiRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ApiSecurityScheme {
  id: string;
  type: string; // 'http' | 'apiKey' | 'oauth2' | 'openIdConnect' | 'basic'
  scheme?: string; // 'bearer' | 'basic'
  in?: string; // 'header' | 'query' | 'cookie'
  name?: string;
  description?: string;
}

export interface ApiEndpointParam {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  type?: string;
  description?: string;
}

export interface ApiEndpoint {
  id: string;
  path: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  securityRequirements: string[]; // List of security scheme names required, empty if unauthenticated
  isUnauthenticated: boolean;
  parameters: ApiEndpointParam[];
  requestBodyContentType?: string;
  riskLevel: ApiRiskLevel;
  riskReasons: string[];
  owaspCategories: string[];
}

export interface ApiAuthGapMatrix {
  totalEndpoints: number;
  authenticatedCount: number;
  unauthenticatedCount: number;
  criticalGapsCount: number;
  highGapsCount: number;
  mutatingUnprotectedCount: number;
  bolaRiskCount: number;
}

export interface ApiAuditResult {
  title: string;
  version: string;
  openApiVersion: string;
  basePath: string;
  securitySchemes: ApiSecurityScheme[];
  hasGlobalSecurity: boolean;
  globalSecuritySchemes: string[];
  endpoints: ApiEndpoint[];
  gapMatrix: ApiAuthGapMatrix;
  suggestedChecklist: Array<{
    code: string;
    title: string;
    category: string;
    details: string;
  }>;
}

export class OpenApiParser {
  /**
   * Parses raw JSON or YAML string into structured API audit result.
   */
  public static parse(content: string): ApiAuditResult {
    let parsed: any;
    try {
      // Try JSON first
      parsed = JSON.parse(content);
    } catch {
      // Fallback to YAML
      try {
        parsed = loadYaml(content);
      } catch (err: any) {
        throw new Error(`Failed to parse OpenAPI/Swagger content: ${err.message || 'Invalid syntax'}`);
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed document is not a valid JSON or YAML object');
    }

    const isOpenApi3 = Boolean(parsed.openapi && String(parsed.openapi).startsWith('3.'));
    const isSwagger2 = Boolean(parsed.swagger && String(parsed.swagger).startsWith('2.'));

    if (!isOpenApi3 && !isSwagger2) {
      throw new Error('Unsupported schema format. Document must declare "openapi: 3.x" or "swagger: 2.0"');
    }

    const title = parsed.info?.title || 'Untitled API Service';
    const version = parsed.info?.version || '1.0.0';
    const openApiVersion = parsed.openapi || parsed.swagger || 'Unknown';

    // Base Path
    let basePath = '/';
    if (isOpenApi3 && Array.isArray(parsed.servers) && parsed.servers.length > 0) {
      basePath = parsed.servers[0].url || '/';
    } else if (isSwagger2) {
      basePath = parsed.basePath || '/';
    }

    // Security Schemes
    const securitySchemes: ApiSecurityScheme[] = [];
    if (isOpenApi3 && parsed.components?.securitySchemes) {
      for (const [id, scheme] of Object.entries<any>(parsed.components.securitySchemes)) {
        securitySchemes.push({
          id,
          type: scheme.type || 'unknown',
          scheme: scheme.scheme,
          in: scheme.in,
          name: scheme.name,
          description: scheme.description,
        });
      }
    } else if (isSwagger2 && parsed.securityDefinitions) {
      for (const [id, scheme] of Object.entries<any>(parsed.securityDefinitions)) {
        securitySchemes.push({
          id,
          type: scheme.type || 'unknown',
          name: scheme.name,
          in: scheme.in,
          description: scheme.description,
        });
      }
    }

    // Global security
    const globalSecuritySchemes: string[] = [];
    if (Array.isArray(parsed.security)) {
      for (const secObj of parsed.security) {
        if (typeof secObj === 'object' && secObj !== null) {
          globalSecuritySchemes.push(...Object.keys(secObj));
        }
      }
    }
    const hasGlobalSecurity = globalSecuritySchemes.length > 0;

    // Parse Endpoints
    const endpoints: ApiEndpoint[] = [];
    const paths = parsed.paths || {};

    const SENSITIVE_KEYWORDS = ['admin', 'internal', 'debug', 'manage', 'config', 'root', 'user/role', 'actuator', 'metrics'];
    const BOLA_PARAM_PATTERNS = [/id$/i, /uuid$/i, /account/i, /user/i, /org/i, /tenant/i, /order/i];
    const SAFE_PUBLIC_PATHS = ['/health', '/ping', '/status', '/version', '/docs', '/favicon.ico', '/swagger', '/openapi'];

    for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
      for (const method of methods) {
        const operation = pathItem[method.toLowerCase()];
        if (!operation || typeof operation !== 'object') continue;

        // Determine security requirements
        let secReqs: string[] = [];
        let isUnauthenticated = false;

        if (Array.isArray(operation.security)) {
          if (operation.security.length === 0) {
            // Explicitly disabled auth! (e.g. security: [])
            isUnauthenticated = true;
          } else {
            for (const secObj of operation.security) {
              if (secObj && typeof secObj === 'object') {
                secReqs.push(...Object.keys(secObj));
              }
            }
          }
        } else if (hasGlobalSecurity) {
          secReqs = [...globalSecuritySchemes];
        } else {
          isUnauthenticated = true;
        }

        // Parameters
        const combinedParams = [...pathLevelParams, ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
        const parameters: ApiEndpointParam[] = combinedParams.map((p: any) => ({
          name: p.name || 'param',
          in: p.in || 'query',
          required: Boolean(p.required),
          type: p.schema?.type || p.type || 'string',
          description: p.description,
        }));

        // Request body content type
        let requestBodyContentType: string | undefined;
        if (operation.requestBody?.content) {
          requestBodyContentType = Object.keys(operation.requestBody.content)[0];
        }

        // Security & Risk Assessment
        const riskReasons: string[] = [];
        const owaspCategories: string[] = [];
        let riskLevel: ApiRiskLevel = 'info';

        const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
        const lowerPath = pathStr.toLowerCase();
        const isSensitivePath = SENSITIVE_KEYWORDS.some((kw) => lowerPath.includes(kw));
        const isSafePublic = SAFE_PUBLIC_PATHS.some((sp) => lowerPath.startsWith(sp));

        // Check BOLA / IDOR Candidates
        const hasBolaParam = parameters.some(
          (p) => p.in === 'path' && BOLA_PARAM_PATTERNS.some((pat) => pat.test(p.name))
        );

        if (hasBolaParam) {
          owaspCategories.push('API1:2023 - Broken Object Level Authorization (BOLA)');
          riskReasons.push(`Path contains direct object identifier ({${parameters.find((p) => p.in === 'path')?.name}}). Verify object-level ownership checks.`);
        }

        if (isUnauthenticated) {
          if (!isSafePublic) {
            owaspCategories.push('API2:2023 - Broken Authentication');
          }

          if (isSensitivePath) {
            riskLevel = 'critical';
            riskReasons.push(`Administrative/Internal path '${pathStr}' is accessible without authentication.`);
            owaspCategories.push('API5:2023 - Broken Function Level Authorization');
          } else if (isMutating && !isSafePublic) {
            riskLevel = 'high';
            riskReasons.push(`State-changing ${method} operation has no authentication requirements.`);
          } else if (hasBolaParam && !isSafePublic) {
            riskLevel = 'high';
            riskReasons.push(`Unauthenticated access to object-identifying endpoint.`);
          } else if (!isSafePublic) {
            riskLevel = 'medium';
            riskReasons.push(`Endpoint does not declare any security schemes.`);
          }
        } else {
          // Authenticated endpoint checks
          if (isSensitivePath) {
            riskLevel = 'medium';
            riskReasons.push(`Sensitive administrative operation requires verification of Role-Based Access Controls (BFLA).`);
            owaspCategories.push('API5:2023 - Broken Function Level Authorization');
          } else if (hasBolaParam) {
            riskLevel = 'low';
          }
        }

        // Check for Mass Assignment / Schema Exposure (API3:2023)
        if (isMutating && requestBodyContentType === 'application/json') {
          owaspCategories.push('API3:2023 - Broken Object Property Level Authorization');
        }

        endpoints.push({
          id: `${method}-${pathStr}`,
          path: pathStr,
          method,
          summary: operation.summary,
          description: operation.description,
          operationId: operation.operationId,
          tags: operation.tags || [],
          securityRequirements: secReqs,
          isUnauthenticated,
          parameters,
          requestBodyContentType,
          riskLevel,
          riskReasons,
          owaspCategories: Array.from(new Set(owaspCategories)),
        });
      }
    }

    // Build Gap Matrix
    const totalEndpoints = endpoints.length;
    const unauthenticatedCount = endpoints.filter((e) => e.isUnauthenticated).length;
    const authenticatedCount = totalEndpoints - unauthenticatedCount;
    const criticalGapsCount = endpoints.filter((e) => e.riskLevel === 'critical').length;
    const highGapsCount = endpoints.filter((e) => e.riskLevel === 'high').length;
    const mutatingUnprotectedCount = endpoints.filter(
      (e) => e.isUnauthenticated && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(e.method)
    ).length;
    const bolaRiskCount = endpoints.filter((e) =>
      e.owaspCategories.some((c) => c.includes('API1:2023'))
    ).length;

    // Build Suggested Checklist
    const suggestedChecklist: Array<{ code: string; title: string; category: string; details: string }> = [];

    if (bolaRiskCount > 0) {
      suggestedChecklist.push({
        code: 'API1:2023-CHECK',
        title: 'Verify Object-Level Ownership on ID Parameters',
        category: 'API Security',
        details: `${bolaRiskCount} routes accept direct object identifiers in path variables. Ensure server verifies requesting user has explicit tenant ownership.`,
      });
    }

    if (unauthenticatedCount > 0) {
      suggestedChecklist.push({
        code: 'API2:2023-CHECK',
        title: 'Review Authentication Bypass on Unprotected Routes',
        category: 'Authentication',
        details: `${unauthenticatedCount} routes lack security schemes or explicitly override with empty security requirements.`,
      });
    }

    if (criticalGapsCount > 0 || highGapsCount > 0) {
      suggestedChecklist.push({
        code: 'API5:2023-CHECK',
        title: 'Audit Role-Based Function-Level Access (BFLA)',
        category: 'Authorization',
        details: `${criticalGapsCount + highGapsCount} high-risk routes involve administrative keywords or state-changing operations.`,
      });
    }

    if (endpoints.some((e) => ['POST', 'PUT'].includes(e.method) && e.requestBodyContentType === 'application/json')) {
      suggestedChecklist.push({
        code: 'API3:2023-CHECK',
        title: 'Test Mass Assignment on Object Updates',
        category: 'Data Validation',
        details: 'JSON mutating payloads detected. Verify fields like role, isAdmin, accountBalance, or status cannot be overwritten by client payloads.',
      });
    }

    return {
      title,
      version,
      openApiVersion,
      basePath,
      securitySchemes,
      hasGlobalSecurity,
      globalSecuritySchemes,
      endpoints,
      gapMatrix: {
        totalEndpoints,
        authenticatedCount,
        unauthenticatedCount,
        criticalGapsCount,
        highGapsCount,
        mutatingUnprotectedCount,
        bolaRiskCount,
      },
      suggestedChecklist,
    };
  }
}
