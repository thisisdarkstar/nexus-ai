import { describe, it, expect } from 'vitest';
import { OpenApiParser } from '../domain/api/OpenApiParser';

describe('OpenApiParser', () => {
  const sampleOpenApi3Json = JSON.stringify({
    openapi: '3.0.1',
    info: {
      title: 'Vulnerable Bank API',
      version: '2.1.0',
    },
    servers: [{ url: 'https://api.bank.corp/v1' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/accounts/{accountId}': {
        get: {
          summary: 'Get account details',
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/admin/system/flush-cache': {
        post: {
          summary: 'Flush system caches',
          security: [], // Explicitly unauthenticated admin endpoint!
          responses: { '200': { description: 'Flushed' } },
        },
      },
      '/public/health': {
        get: {
          summary: 'Health check',
          security: [],
          responses: { '200': { description: 'Healthy' } },
        },
      },
      '/transfers': {
        post: {
          summary: 'Initiate transfer',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
    },
  });

  const sampleSwaggerYaml = `
swagger: "2.0"
info:
  title: "Legacy Internal Service"
  version: "1.0.0"
basePath: "/internal/v1"
paths:
  /users/{userId}/roles:
    put:
      summary: "Update user roles"
      parameters:
        - name: "userId"
          in: "path"
          required: true
          type: "string"
      responses:
        200:
          description: "Updated"
`;

  it('correctly parses OpenAPI 3.0 and extracts security schemes and endpoints', () => {
    const result = OpenApiParser.parse(sampleOpenApi3Json);

    expect(result.title).toBe('Vulnerable Bank API');
    expect(result.version).toBe('2.1.0');
    expect(result.securitySchemes.length).toBe(1);
    expect(result.securitySchemes[0].id).toBe('BearerAuth');
    expect(result.endpoints.length).toBe(4);
  });

  it('detects unauthenticated administrative endpoint as Critical risk', () => {
    const result = OpenApiParser.parse(sampleOpenApi3Json);
    const adminEndpoint = result.endpoints.find((e) => e.path === '/admin/system/flush-cache');

    expect(adminEndpoint).toBeDefined();
    expect(adminEndpoint?.isUnauthenticated).toBe(true);
    expect(adminEndpoint?.riskLevel).toBe('critical');
    expect(adminEndpoint?.riskReasons.some((r) => r.includes('Administrative'))).toBe(true);
  });

  it('detects BOLA parameters and flags OWASP API1:2023', () => {
    const result = OpenApiParser.parse(sampleOpenApi3Json);
    const accountEndpoint = result.endpoints.find((e) => e.path === '/accounts/{accountId}');

    expect(accountEndpoint).toBeDefined();
    expect(accountEndpoint?.owaspCategories.some((c) => c.includes('API1:2023'))).toBe(true);
    expect(result.gapMatrix.bolaRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('parses Swagger 2.0 YAML and identifies mutating unauthenticated endpoints', () => {
    const result = OpenApiParser.parse(sampleSwaggerYaml);

    expect(result.title).toBe('Legacy Internal Service');
    expect(result.endpoints.length).toBe(1);
    const putEndpoint = result.endpoints[0];
    expect(putEndpoint.method).toBe('PUT');
    expect(putEndpoint.isUnauthenticated).toBe(true);
    expect(putEndpoint.riskLevel).toBe('high');
    expect(result.gapMatrix.mutatingUnprotectedCount).toBe(1);
  });

  it('throws descriptive error on malformed content', () => {
    expect(() => OpenApiParser.parse('NOT_A_VALID_SPEC: [')).toThrow();
  });
});
