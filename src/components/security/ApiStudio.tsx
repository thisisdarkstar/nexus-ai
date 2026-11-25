import { useState, useMemo, useEffect } from 'react';
import {
  FileCode,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Upload,
  Sparkles,
  ExternalLink,
  PlusCircle,
  Search,
  Filter,
  CheckSquare,
} from 'lucide-react';
import { OpenApiParser, type ApiAuditResult, type ApiEndpoint, type HttpMethod, type ApiRiskLevel } from '../../domain/api/OpenApiParser';
import { projectLocalStorage } from '../../core/storage/projectStorage';
import { eventBus } from '../../core/bus/EventBus';
import { useToast } from '../../lib/toast';
import CustomSelect from '../common/CustomSelect';
import styles from './ApiStudio.module.css';

interface ApiStudioProps {
  onSendToAI?: (prompt: string) => void;
}

const METHOD_OPTIONS = [
  { value: 'ALL', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const RISK_OPTIONS = [
  { value: 'ALL', label: 'All Risks' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SAMPLE_VULNERABLE_BANK_SPEC = JSON.stringify(
  {
    openapi: '3.0.3',
    info: {
      title: 'Apex Global Financial Services API',
      version: '3.2.0-beta',
      description: 'Core banking transaction, accounts, and internal administrative service API.',
    },
    servers: [{ url: 'https://api.apexbank.corp/v3' }],
    components: {
      securitySchemes: {
        OAuth2Bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Standard client access token for customers.',
        },
      },
    },
    security: [{ OAuth2Bearer: [] }],
    paths: {
      '/accounts/{accountId}/balance': {
        get: {
          summary: 'Retrieve account ledger and balances',
          operationId: 'getAccountBalance',
          tags: ['Accounts'],
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Target customer account UUID.',
            },
          ],
          responses: { '200': { description: 'Balance details returned' } },
        },
      },
      '/accounts/{accountId}/transfer': {
        post: {
          summary: 'Initiate funds transfer between accounts',
          operationId: 'transferFunds',
          tags: ['Transfers'],
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    destinationAccount: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Transfer executed' } },
        },
      },
      '/admin/system/emergency-maintenance': {
        post: {
          summary: 'Emergency system maintenance switch',
          operationId: 'triggerMaintenance',
          tags: ['Admin'],
          security: [], // VULNERABILITY: Explicitly disabled auth!
          responses: { '200': { description: 'Maintenance enabled' } },
        },
      },
      '/admin/users/{userId}/impersonate': {
        get: {
          summary: 'Generate temporary impersonation session token',
          operationId: 'impersonateUser',
          tags: ['Admin'],
          security: [], // VULNERABILITY: Unauthenticated administrative impersonation!
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'Impersonation token returned' } },
        },
      },
      '/users/{userId}/profile': {
        put: {
          summary: 'Update customer profile metadata',
          operationId: 'updateProfile',
          tags: ['Users'],
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fullName: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string', description: 'Mass assignment vector!' },
                    kycVerified: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Profile updated' } },
        },
      },
      '/public/health': {
        get: {
          summary: 'Liveness and telemetry check',
          operationId: 'getHealth',
          tags: ['Public'],
          security: [],
          responses: { '200': { description: 'System healthy' } },
        },
      },
      '/debug/actuator/env': {
        get: {
          summary: 'Spring Actuator Environment configuration exposure',
          operationId: 'getActuatorEnv',
          tags: ['Debug'],
          security: [],
          responses: { '200': { description: 'Environment variables' } },
        },
      },
    },
  },
  null,
  2
);

const API_STUDIO_STORAGE_KEY = 'nexus_security_api_studio_v1';

interface SavedApiStudioState {
  specInput?: string;
  filterMethod?: string;
  filterRisk?: string;
  filterAuth?: string;
  searchQuery?: string;
  selectedEndpointId?: string | null;
}

function loadSavedApiStudioState(): SavedApiStudioState {
  try {
    const raw = projectLocalStorage.getItem(API_STUDIO_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedApiStudioState;
  } catch {
    // ignore storage parse failure
  }
  return {};
}

export default function ApiStudio({ onSendToAI }: ApiStudioProps) {
  const { toast } = useToast();
  const [savedState] = useState<SavedApiStudioState>(() => loadSavedApiStudioState());
  const [specInput, setSpecInput] = useState<string>(
    savedState.specInput || SAMPLE_VULNERABLE_BANK_SPEC
  );
  const [showSpecEditor, setShowSpecEditor] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [auditResult, setAuditResult] = useState<ApiAuditResult>(() => {
    try {
      return OpenApiParser.parse(savedState.specInput || SAMPLE_VULNERABLE_BANK_SPEC);
    } catch {
      return OpenApiParser.parse('{"openapi":"3.0.0","info":{"title":"Fallback","version":"1.0"},"paths":{}}');
    }
  });

  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    savedState.selectedEndpointId || auditResult.endpoints[0]?.id || null
  );

  const [filterMethod, setFilterMethod] = useState<string>(savedState.filterMethod || 'ALL');
  const [filterRisk, setFilterRisk] = useState<string>(savedState.filterRisk || 'ALL');
  const [filterAuth, setFilterAuth] = useState<string>(savedState.filterAuth || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>(savedState.searchQuery || '');

  useEffect(() => {
    try {
      projectLocalStorage.setItem(
        API_STUDIO_STORAGE_KEY,
        JSON.stringify({
          specInput,
          filterMethod,
          filterRisk,
          filterAuth,
          searchQuery,
          selectedEndpointId,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [specInput, filterMethod, filterRisk, filterAuth, searchQuery, selectedEndpointId]);

  const handleParseSpec = (content: string) => {
    try {
      setParseError(null);
      const parsed = OpenApiParser.parse(content);
      setAuditResult(parsed);
      setSelectedEndpointId(parsed.endpoints[0]?.id || null);
      setShowSpecEditor(false);
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse specification');
    }
  };

  const filteredEndpoints = useMemo(() => {
    return auditResult.endpoints.filter((ep) => {
      if (filterMethod !== 'ALL' && ep.method !== filterMethod) return false;
      if (filterRisk !== 'ALL' && ep.riskLevel !== filterRisk) return false;
      if (filterAuth === 'unauthenticated' && !ep.isUnauthenticated) return false;
      if (filterAuth === 'authenticated' && ep.isUnauthenticated) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPath = ep.path.toLowerCase().includes(q);
        const matchesSummary = (ep.summary || '').toLowerCase().includes(q);
        if (!matchesPath && !matchesSummary) return false;
      }
      return true;
    });
  }, [auditResult.endpoints, filterMethod, filterRisk, filterAuth, searchQuery]);

  const selectedEndpoint = useMemo(() => {
    return auditResult.endpoints.find((e) => e.id === selectedEndpointId) || filteredEndpoints[0] || null;
  }, [auditResult.endpoints, selectedEndpointId, filteredEndpoints]);

  const handleSendToReportStudio = (endpoint: ApiEndpoint) => {
    eventBus.publish('finding:added', {
      finding: {
        id: `API-FIND-${Date.now()}`,
        title: `API Security Gap: [${endpoint.method}] ${endpoint.path} (${endpoint.riskLevel.toUpperCase()})`,
        severity: endpoint.riskLevel as any,
        cweId: endpoint.owaspCategories[0]?.split(' ')[0] || 'CWE-285',
        owaspCategory: endpoint.owaspCategories[0] || 'API Security',
        targetEndpoint: `${auditResult.basePath.replace(/\/$/, '')}${endpoint.path}`,
        description: `OpenAPI contract review detected security anomalies on ${endpoint.method} ${endpoint.path}.\n\nObserved Gaps:\n${endpoint.riskReasons.map((r) => `- ${r}`).join('\n')}`,
        remediation: `Enforce strict role-based access control (RBAC), require authentication schemes, and validate user ownership on direct object identifiers.`,
        status: 'open',
      },
    });
    toast('success', `Filed vulnerability finding for ${endpoint.method} ${endpoint.path} into Report Studio!`);
  };

  const handleSendToAIForEndpoint = (endpoint: ApiEndpoint) => {
    if (!onSendToAI) return;
    const prompt = `As a Senior API Security Researcher, review this endpoint from OpenAPI contract '${auditResult.title}':

Route: [${endpoint.method}] ${auditResult.basePath.replace(/\/$/, '')}${endpoint.path}
Summary: ${endpoint.summary || 'N/A'}
Auth Status: ${endpoint.isUnauthenticated ? 'UNAUTHENTICATED (No security scheme required)' : `Requires: ${endpoint.securityRequirements.join(', ')}`}
Risk Level: ${endpoint.riskLevel.toUpperCase()}
Risk Reasons:
${endpoint.riskReasons.map((r) => `- ${r}`).join('\n')}

OWASP Categories: ${endpoint.owaspCategories.join(', ')}
Parameters:
${endpoint.parameters.map((p) => `- ${p.name} (${p.in}, required: ${p.required}, type: ${p.type})`).join('\n') || 'None'}

Please provide:
1. Defensive impact analysis.
2. Step-by-step authorization validation procedure (BOLA / BFLA).
3. Secure code remediation pattern for the development team.`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <FileCode size={28} className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>API Security Contract Studio</h2>
            <p className={styles.subtitle}>
              OpenAPI 3.0 & Swagger 2.0 schema auditor, authentication gap matrix & OWASP API Top 10 validator
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setShowSpecEditor(!showSpecEditor)}
          >
            <Upload size={14} /> {showSpecEditor ? 'Hide Schema' : 'Load Custom Spec'}
          </button>
          {onSendToAI && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                onSendToAI(
                  `Perform a comprehensive API Security Architecture Review for '${auditResult.title}' v${auditResult.version}.\n\nAudit Findings:\n- Total Routes: ${auditResult.gapMatrix.totalEndpoints}\n- Unauthenticated Routes: ${auditResult.gapMatrix.unauthenticatedCount}\n- Critical Security Gaps: ${auditResult.gapMatrix.criticalGapsCount}\n- Mutating Unprotected: ${auditResult.gapMatrix.mutatingUnprotectedCount}\n- BOLA / IDOR Candidates: ${auditResult.gapMatrix.bolaRiskCount}\n\nPlease generate an executive summary and defensive remediation roadmap.`
                );
              }}
            >
              <Sparkles size={14} color="#38bdf8" /> AI Threat Review
            </button>
          )}
        </div>
      </div>

      {/* Specification Editor Dropdown */}
      {showSpecEditor && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(15,23,42,0.8)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
              Paste OpenAPI 3.0 / Swagger JSON or YAML:
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setSpecInput(SAMPLE_VULNERABLE_BANK_SPEC);
                  handleParseSpec(SAMPLE_VULNERABLE_BANK_SPEC);
                }}
              >
                Reset to Sample Bank API
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={() => handleParseSpec(specInput)}
              >
                Parse & Audit Specification
              </button>
            </div>
          </div>
          <textarea
            className={styles.specEditor}
            value={specInput}
            onChange={(e) => setSpecInput(e.target.value)}
            placeholder="Paste OpenAPI JSON or YAML..."
          />
          {parseError && (
            <div style={{ color: '#ef4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={14} /> {parseError}
            </div>
          )}
        </div>
      )}

      {/* Contract Metadata Header */}
      <div className={styles.metaBar}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>API Service</span>
          <span className={styles.metaValue}>{auditResult.title} (v{auditResult.version})</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Base Path / Server</span>
          <span className={styles.metaValue}>{auditResult.basePath}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Spec Standard</span>
          <span className={styles.metaValue}>OpenAPI {auditResult.openApiVersion}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Global Security</span>
          <span className={styles.metaValue}>
            {auditResult.hasGlobalSecurity ? (
              <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Lock size={12} /> {auditResult.globalSecuritySchemes.join(', ')}
              </span>
            ) : (
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Unlock size={12} /> None Configured
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Auth Gap Matrix Cards */}
      <div className={styles.matrixGrid}>
        <div className={styles.matrixCard}>
          <span className={styles.matrixNumber}>{auditResult.gapMatrix.totalEndpoints}</span>
          <span className={styles.matrixLabel}>Total Endpoints Audited</span>
        </div>

        <div className={`${styles.matrixCard} ${auditResult.gapMatrix.unauthenticatedCount > 0 ? styles.matrixCardHigh : styles.matrixCardSuccess}`}>
          <span className={styles.matrixNumber} style={{ color: auditResult.gapMatrix.unauthenticatedCount > 0 ? '#f97316' : '#10b981' }}>
            {auditResult.gapMatrix.unauthenticatedCount}
          </span>
          <span className={styles.matrixLabel}>Unauthenticated Routes</span>
        </div>

        <div className={`${styles.matrixCard} ${auditResult.gapMatrix.criticalGapsCount > 0 ? styles.matrixCardCritical : ''}`}>
          <span className={styles.matrixNumber} style={{ color: auditResult.gapMatrix.criticalGapsCount > 0 ? '#ef4444' : '#94a3b8' }}>
            {auditResult.gapMatrix.criticalGapsCount}
          </span>
          <span className={styles.matrixLabel}>Critical Auth Gaps</span>
        </div>

        <div className={`${styles.matrixCard} ${auditResult.gapMatrix.mutatingUnprotectedCount > 0 ? styles.matrixCardHigh : ''}`}>
          <span className={styles.matrixNumber} style={{ color: auditResult.gapMatrix.mutatingUnprotectedCount > 0 ? '#f97316' : '#94a3b8' }}>
            {auditResult.gapMatrix.mutatingUnprotectedCount}
          </span>
          <span className={styles.matrixLabel}>Mutating Unprotected (POST/PUT/DEL)</span>
        </div>

        <div className={`${styles.matrixCard} ${auditResult.gapMatrix.bolaRiskCount > 0 ? styles.matrixCardMedium : ''}`}>
          <span className={styles.matrixNumber} style={{ color: auditResult.gapMatrix.bolaRiskCount > 0 ? '#eab308' : '#94a3b8' }}>
            {auditResult.gapMatrix.bolaRiskCount}
          </span>
          <span className={styles.matrixLabel}>BOLA / IDOR Candidates</span>
        </div>
      </div>

      {/* Split Explorer Layout */}
      <div className={styles.explorerLayout}>
        {/* Left: Endpoint List & Filters */}
        <div className={styles.endpointListPanel}>
          <div className={styles.filterRow}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className={styles.searchBox}
                placeholder="Search endpoints by path or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CustomSelect
              value={filterMethod}
              onChange={(val) => setFilterMethod(val)}
              options={METHOD_OPTIONS}
              style={{ minWidth: '130px' }}
            />
            <CustomSelect
              value={filterRisk}
              onChange={(val) => setFilterRisk(val)}
              options={RISK_OPTIONS}
              style={{ minWidth: '120px' }}
            />
          </div>

          <div className={styles.endpointList}>
            {filteredEndpoints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                No endpoints match active filters.
              </div>
            ) : (
              filteredEndpoints.map((ep) => {
                const isActive = selectedEndpoint?.id === ep.id;
                const methodClass =
                  ep.method === 'GET'
                    ? styles.methodGet
                    : ep.method === 'POST'
                      ? styles.methodPost
                      : ep.method === 'PUT'
                        ? styles.methodPut
                        : ep.method === 'DELETE'
                          ? styles.methodDelete
                          : styles.methodPatch;

                const riskClass =
                  ep.riskLevel === 'critical'
                    ? styles.riskCritical
                    : ep.riskLevel === 'high'
                      ? styles.riskHigh
                      : ep.riskLevel === 'medium'
                        ? styles.riskMedium
                        : ep.riskLevel === 'low'
                          ? styles.riskLow
                          : styles.riskInfo;

                return (
                  <div
                    key={ep.id}
                    className={`${styles.endpointCard} ${isActive ? styles.endpointCardActive : ''}`}
                    onClick={() => setSelectedEndpointId(ep.id)}
                  >
                    <span className={`${styles.methodBadge} ${methodClass}`}>{ep.method}</span>
                    <span className={styles.endpointPath} title={ep.path}>
                      {ep.path}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {ep.isUnauthenticated ? (
                        <span title="Unauthenticated route">
                          <Unlock size={13} color="#f97316" />
                        </span>
                      ) : (
                        <span title="Security schemes required">
                          <Lock size={13} color="#10b981" />
                        </span>
                      )}
                      <span className={`${styles.riskBadge} ${riskClass}`}>{ep.riskLevel}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Endpoint Detail Panel */}
        {selectedEndpoint ? (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailRoute}>
                  <span
                    className={`${styles.methodBadge} ${
                      selectedEndpoint.method === 'GET'
                        ? styles.methodGet
                        : selectedEndpoint.method === 'POST'
                          ? styles.methodPost
                          : selectedEndpoint.method === 'PUT'
                            ? styles.methodPut
                            : selectedEndpoint.method === 'DELETE'
                              ? styles.methodDelete
                              : styles.methodPatch
                    }`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <span className={styles.detailPath}>{selectedEndpoint.path}</span>
                </div>
                <p className={styles.detailDesc}>
                  {selectedEndpoint.summary || selectedEndpoint.description || 'No description provided in specification.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => handleSendToReportStudio(selectedEndpoint)}
                  title="File this route into Report Studio finding"
                >
                  <PlusCircle size={13} /> File Finding
                </button>
                {onSendToAI && (
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => handleSendToAIForEndpoint(selectedEndpoint)}
                    title="Send schema to AI for exploitability and verification analysis"
                  >
                    <Sparkles size={13} color="#38bdf8" /> AI Analyze
                  </button>
                )}
              </div>
            </div>

            {/* Risk Assessment & Reasons */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Security Risk Analysis</span>
              {selectedEndpoint.riskReasons.length > 0 ? (
                <div className={styles.reasonBox}>
                  {selectedEndpoint.riskReasons.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ShieldCheck size={14} /> Standard protected route with no anomalous exposure detected.
                </div>
              )}
            </div>

            {/* OWASP API Top 10 Categories */}
            {selectedEndpoint.owaspCategories.length > 0 && (
              <div className={styles.section}>
                <span className={styles.sectionTitle}>OWASP API Security Top 10 Mapping</span>
                <div>
                  {selectedEndpoint.owaspCategories.map((c, i) => (
                    <span key={i} className={styles.owaspTag}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Security Schemes */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Authentication & Authorization Requirements</span>
              <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                {selectedEndpoint.isUnauthenticated ? (
                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Unlock size={14} /> Route is explicitly unauthenticated or omits security definitions.
                  </span>
                ) : (
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Lock size={14} /> Requires valid authentication credentials: <code>{selectedEndpoint.securityRequirements.join(', ')}</code>
                  </span>
                )}
              </div>
            </div>

            {/* Parameters Table */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Endpoint Parameters</span>
              {selectedEndpoint.parameters.length === 0 ? (
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>No request parameters defined.</div>
              ) : (
                <table className={styles.paramTable}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEndpoint.parameters.map((p, idx) => (
                      <tr key={idx}>
                        <td><code>{p.name}</code></td>
                        <td><span style={{ textTransform: 'uppercase', fontSize: '0.68rem', color: '#94a3b8' }}>{p.in}</span></td>
                        <td>{p.type}</td>
                        <td>{p.required ? <span style={{ color: '#ef4444', fontWeight: 600 }}>Yes</span> : 'No'}</td>
                        <td style={{ color: '#94a3b8' }}>{p.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            Select an endpoint from the inventory to inspect contract security.
          </div>
        )}
      </div>
    </div>
  );
}
