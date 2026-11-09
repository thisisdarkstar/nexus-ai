import { ADVISORY_CATALOG, type SecurityAdvisory } from './AdvisoryCatalog';
import type { ReconAsset } from '../../types';

export interface CorrelatedObservation {
  assetId: string;
  url: string;
  advisory: SecurityAdvisory;
  confidence: 'confirmed' | 'high_confidence' | 'tentative' | 'unverified';
  evidenceText: string;
  suggestedCheck: string;
  remediation: string;
}

export class CorrelationService {
  private static instance: CorrelationService;

  private constructor() {}

  public static getInstance(): CorrelationService {
    if (!CorrelationService.instance) {
      CorrelationService.instance = new CorrelationService();
    }
    return CorrelationService.instance;
  }

  /**
   * Correlates an asset against the local offline advisory catalog
   */
  public correlateAsset(asset: ReconAsset): CorrelatedObservation[] {
    const results: CorrelatedObservation[] = [];
    const urlLower = asset.url.toLowerCase();
    const flags = asset.highInterestFlags || [];
    const techs = asset.technologies || [];
    const techSet = new Set(techs.map((t) => t.toLowerCase()));

    // 1. Spring Boot Actuator
    if (flags.some((f) => f.includes('Spring')) || urlLower.includes('/actuator')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-SPRING-ACTUATOR');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: asset.statusCode === 200 ? 'high_confidence' : 'tentative',
          evidenceText: `Endpoint path matches /actuator. HTTP Status: ${asset.statusCode || 'N/A'}. Server: ${asset.webserver || 'Spring/Tomcat'}.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 2. SSRF Candidates
    if (flags.some((f) => f.includes('SSRF')) || urlLower.includes('url=') || urlLower.includes('dest=')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-SSRF-PARAM');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: 'tentative', // Heuristic observation requires validation
          evidenceText: `Detected destination URL parameter in query string.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 3. IDOR / BOLA Candidates
    if (flags.some((f) => f.includes('IDOR')) || urlLower.includes('user_id=') || urlLower.includes('account_id=')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-IDOR-BOLA');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: 'tentative',
          evidenceText: `Detected object identifier parameter susceptible to authorization bypass.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 4. GraphQL Introspection
    if (flags.some((f) => f.includes('GraphQL')) || urlLower.includes('graphql') || urlLower.includes('graphiql')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-GRAPHQL-INTROSPECTION');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: asset.statusCode === 200 ? 'high_confidence' : 'tentative',
          evidenceText: `GraphQL endpoint discovered at ${asset.url}. Status: ${asset.statusCode}.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 5. Exposed Config / Source
    if (flags.some((f) => f.includes('Config')) || urlLower.includes('.env') || urlLower.includes('.git')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-EXPOSED-CONFIG');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: asset.statusCode === 200 ? 'confirmed' : 'tentative',
          evidenceText: `Discovered path pointing to sensitive repository or environment config file.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 6. Swagger Docs Exposure
    if (flags.some((f) => f.includes('Swagger')) || urlLower.includes('swagger-ui') || urlLower.includes('api-docs')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-SWAGGER-DOCS');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: asset.statusCode === 200 ? 'confirmed' : 'tentative',
          evidenceText: `Public Swagger UI / OpenAPI documentation interface accessible.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    // 7. Cloud Storage Bucket
    if (flags.some((f) => f.includes('Bucket')) || urlLower.includes('.s3.amazonaws.com') || urlLower.includes('storage.googleapis.com')) {
      const adv = ADVISORY_CATALOG.find((a) => a.id === 'ADV-CLOUD-BUCKET-EXPOSURE');
      if (adv) {
        results.push({
          assetId: asset.id,
          url: asset.url,
          advisory: adv,
          confidence: asset.statusCode === 403 || asset.statusCode === 200 ? 'high_confidence' : 'tentative',
          evidenceText: `Direct cloud object storage target detected. Status code: ${asset.statusCode}.`,
          suggestedCheck: adv.defensiveCheck,
          remediation: adv.remediationPattern,
        });
      }
    }

    return results;
  }
}

export const correlationService = CorrelationService.getInstance();
