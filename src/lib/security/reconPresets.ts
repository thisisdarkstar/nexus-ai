import type { ReconAsset } from '../../types';

export interface ReconPipelineStep {
  id: string;
  name: string;
  tool: string;
  command: string;
}

export interface ReconDork {
  id: string;
  name: string;
  query: string;
}

export interface CloudBucketCandidate {
  id: string;
  name: string;
  url: string;
}

export const SAMPLE_BOUNTY_ASSETS: ReconAsset[] = [
  {
    id: 'asset-1',
    url: 'https://dev-api.acmefinance.com/actuator/env',
    host: 'dev-api.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Spring Boot Whitelabel /actuator/env',
    webserver: 'Apache-Coyote/1.1',
    technologies: ['Spring Boot', 'Java 17', 'Tomcat'],
    riskScore: 'critical',
    highInterestFlags: ['Spring Actuator Exposure', 'Pre-Production / Dev Subdomain'],
    contentLength: 4892,
    source: 'httpx',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'asset-2',
    url: 'https://files.acmefinance.com/api/v2/fetch_document?url=http://127.0.0.1:8080/internal',
    host: 'files.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Document Fetcher Microservice',
    webserver: 'nginx/1.24.0',
    technologies: ['Node.js', 'Express', 'Nginx', 'Docker'],
    riskScore: 'high',
    highInterestFlags: ['SSRF Candidate Param'],
    contentLength: 1204,
    source: 'endpoints',
    createdAt: Date.now() - 3200000,
  },
  {
    id: 'asset-3',
    url: 'https://docs.acmefinance.com/swagger-ui.html',
    host: 'docs.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Acme Financial OpenAPI Documentation',
    webserver: 'Cloudflare',
    technologies: ['Swagger UI 4.15', 'React', 'Cloudflare'],
    riskScore: 'high',
    highInterestFlags: ['Exposed Swagger / API Docs'],
    contentLength: 18450,
    source: 'httpx',
    createdAt: Date.now() - 2800000,
  },
  {
    id: 'asset-4',
    url: 'https://staging-auth.acmefinance.com/oauth/authorize?client_id=102&redirect_uri=https://dev.acmefinance.com',
    host: 'staging-auth.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Acme Identity SSO - Authorization Portal',
    webserver: 'Envoy',
    technologies: ['OAuth2', 'Go', 'Envoy'],
    riskScore: 'high',
    highInterestFlags: ['Pre-Production / Dev Subdomain', 'Admin / Auth Portal', 'SSRF Candidate Param'],
    contentLength: 3201,
    source: 'httpx',
    createdAt: Date.now() - 2400000,
  },
  {
    id: 'asset-5',
    url: 'https://graphql.acmefinance.com/graphiql',
    host: 'graphql.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'GraphiQL Interactive IDE & Explorer',
    webserver: 'nginx',
    technologies: ['GraphQL', 'Apollo Server', 'Nginx'],
    riskScore: 'high',
    highInterestFlags: ['GraphQL Endpoint'],
    contentLength: 6400,
    source: 'httpx',
    createdAt: Date.now() - 2000000,
  },
  {
    id: 'asset-6',
    url: 'https://backup-db.acmefinance.com/.env',
    host: 'backup-db.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Index of /.env (DB_PASSWORD / AWS_KEY)',
    webserver: 'Apache 2.4.52',
    technologies: ['Apache', 'PHP 8.1'],
    riskScore: 'critical',
    highInterestFlags: ['Exposed Config / Source File'],
    contentLength: 420,
    source: 'endpoints',
    createdAt: Date.now() - 1600000,
  },
  {
    id: 'asset-7',
    url: 'https://admin.acmefinance.com/cpanel',
    host: 'admin.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 403,
    title: '403 Forbidden - Internal Access Only',
    webserver: 'Cloudflare',
    technologies: ['Cloudflare', 'WAF'],
    riskScore: 'high',
    highInterestFlags: ['Admin / Auth Portal', '403 Auth Protected (Bypass Candidate)'],
    contentLength: 560,
    source: 'httpx',
    createdAt: Date.now() - 1200000,
  },
  {
    id: 'asset-8',
    url: 'https://customer.acmefinance.com/api/v1/accounts?user_id=10928',
    host: 'customer.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Customer Financial Ledger API',
    webserver: 'nginx',
    technologies: ['Python', 'FastAPI', 'Nginx'],
    riskScore: 'medium',
    highInterestFlags: ['IDOR / BOLA Param'],
    contentLength: 1540,
    source: 'endpoints',
    createdAt: Date.now() - 800000,
  },
  {
    id: 'asset-9',
    url: 'https://storage.acmefinance.com.s3.amazonaws.com/',
    host: 'storage.acmefinance.com.s3.amazonaws.com',
    port: 443,
    protocol: 'https',
    statusCode: 403,
    title: 'AccessDenied - S3 Bucket Policy',
    webserver: 'AmazonS3',
    technologies: ['AWS S3'],
    riskScore: 'high',
    highInterestFlags: ['Direct Cloud Storage Bucket', '403 Auth Protected (Bypass Candidate)'],
    contentLength: 320,
    source: 'httpx',
    createdAt: Date.now() - 400000,
  },
  {
    id: 'asset-10',
    url: 'https://www.acmefinance.com/',
    host: 'www.acmefinance.com',
    port: 443,
    protocol: 'https',
    statusCode: 200,
    title: 'Acme Financial Services - Modern Banking Platform',
    webserver: 'Cloudflare',
    technologies: ['Next.js', 'React', 'Cloudflare', 'TailwindCSS'],
    riskScore: 'info',
    highInterestFlags: [],
    contentLength: 42100,
    source: 'httpx',
    createdAt: Date.now(),
  },
];

export function buildReconPipelines(cleanDomain: string): ReconPipelineStep[] {
  return [
    {
      id: 'subdomain_passive',
      name: '1. Fast Passive Subdomain Enumeration',
      tool: 'Subfinder + Assetfinder',
      command: `subfinder -d ${cleanDomain} -all -silent | assetfinder --subs-only | sort -u > subdomains_${cleanDomain}.txt`,
    },
    {
      id: 'host_probe',
      name: '2. Live HTTP Probing & Tech Stack Fingerprinting',
      tool: 'Httpx',
      command: `cat subdomains_${cleanDomain}.txt | httpx -title -tech-detect -status-code -follow-redirects -json -o httpx_${cleanDomain}.json`,
    },
    {
      id: 'crawl_endpoints',
      name: '3. Web Endpoint & Archive URL Extraction',
      tool: 'Katana + GAU',
      command: `katana -u live_${cleanDomain}.txt -jc -d 3 -silent | gau --subs | sort -u > endpoints_${cleanDomain}.txt`,
    },
    {
      id: 'nuclei_scan',
      name: '4. Targeted Nuclei Vulnerability Scan',
      tool: 'Nuclei v3',
      command: `nuclei -l live_${cleanDomain}.txt -t cves/,vulnerabilities/,exposures/ -severity critical,high,medium -stats -json -o nuclei_${cleanDomain}.json`,
    },
    {
      id: 'dir_fuzzing',
      name: '5. Fast Directory & File Discovery',
      tool: 'FFUF',
      command: `ffuf -w /usr/share/wordlists/dirb/common.txt -u https://${cleanDomain}/FUZZ -mc 200,301,302,403 -c -v`,
    },
    {
      id: 'js_secrets',
      name: '6. JavaScript Sensitive Data & Token Extraction',
      tool: 'Grep + Nuclei',
      command: `cat endpoints_${cleanDomain}.txt | grep -E '\\.js(\\?.*)?$' | nuclei -t exposures/tokens/ -silent`,
    },
  ];
}

export function buildGoogleDorks(cleanDomain: string): ReconDork[] {
  return [
    {
      id: 'dork_env',
      name: 'Exposed .env & Configuration Files',
      query: `site:${cleanDomain} (ext:env OR ext:yml OR ext:yaml OR ext:config OR ext:json) "DB_PASSWORD" OR "API_KEY" OR "SECRET"`,
    },
    {
      id: 'dork_index',
      name: 'Open Directory Indexes',
      query: `site:${cleanDomain} intitle:"Index of /" OR intitle:"Index of /uploads" OR intitle:"parent directory"`,
    },
    {
      id: 'dork_admin',
      name: 'Admin Portals & Login Interfaces',
      query: `site:${cleanDomain} inurl:admin OR inurl:login OR inurl:dashboard OR inurl:cpanel OR inurl:portal`,
    },
    {
      id: 'dork_api',
      name: 'Swagger UI & OpenAPI Specifications',
      query: `site:${cleanDomain} inurl:swagger OR inurl:api-docs OR inurl:"/v1/api-docs" OR inurl:graphql`,
    },
    {
      id: 'dork_sql',
      name: 'Database Dumps & Backup Archives',
      query: `site:${cleanDomain} (ext:sql OR ext:db OR ext:bak OR ext:tar OR ext:zip OR ext:7z) intext:"dump" OR intext:"password"`,
    },
    {
      id: 'dork_phpinfo',
      name: 'Server Diagnostics & PHPInfo',
      query: `site:${cleanDomain} ext:php "PHP Version" OR "Configuration File (php.ini) Path"`,
    },
  ];
}

export function buildGithubDorks(cleanDomain: string): ReconDork[] {
  return [
    {
      id: 'gh_pw',
      name: 'Target Passwords & API Keys in Public Repos',
      query: `"${cleanDomain}" password OR secret OR api_key OR token`,
    },
    {
      id: 'gh_aws',
      name: 'AWS Credentials Linked to Domain',
      query: `"${cleanDomain}" AKIA[0-9A-Z]{16} OR aws_secret_access_key`,
    },
    {
      id: 'gh_subdomains',
      name: 'Internal Hostnames & Dev Endpoints',
      query: `"${cleanDomain}" "staging" OR "dev" OR "internal" OR "vpn"`,
    },
    {
      id: 'gh_s3',
      name: 'S3 Buckets & Cloud Storage Mentions',
      query: `"${cleanDomain}" s3.amazonaws.com OR blob.core.windows.net`,
    },
  ];
}

export function buildCloudBuckets(cleanDomain: string): CloudBucketCandidate[] {
  return [
    {
      id: 's3_std',
      name: 'AWS S3 Standard URL',
      url: `https://${cleanDomain.replace(/\./g, '-')}.s3.amazonaws.com`,
    },
    {
      id: 's3_dot',
      name: 'AWS S3 Dot-Domain URL',
      url: `https://s3.amazonaws.com/${cleanDomain}`,
    },
    {
      id: 'gcs_std',
      name: 'Google Cloud Storage URL',
      url: `https://storage.googleapis.com/${cleanDomain}`,
    },
    {
      id: 'azure_blob',
      name: 'Azure Blob Storage URL',
      url: `https://${cleanDomain.replace(/\./g, '')}.blob.core.windows.net/`,
    },
  ];
}
