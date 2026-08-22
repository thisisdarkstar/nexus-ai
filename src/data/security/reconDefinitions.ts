export interface ReconPipelineItem {
  id: string;
  name: string;
  tool: string;
  category: string;
  badgeColor: string;
  command: string;
}

export interface ReconDorkItem {
  id: string;
  name: string;
  category: string;
  badgeColor: string;
  query: string;
  url?: string;
}

export interface CloudBucketItem {
  id: string;
  name: string;
  provider: string;
  badgeColor: string;
  url: string;
}

export const getReconPipelines = (cleanDomain: string, orgName: string): ReconPipelineItem[] => [
  {
    id: 'subdomain_passive',
    name: '1. Fast Passive Subdomain Enumeration',
    tool: 'Subfinder + Assetfinder',
    category: 'Subdomains',
    badgeColor: '#38bdf8',
    command: `subfinder -d ${cleanDomain} -all -silent | assetfinder --subs-only | sort -u > subdomains_${cleanDomain}.txt`,
  },
  {
    id: 'dns_bruteforce',
    name: '2. Active DNS Brute-Forcing & Resolution',
    tool: 'PureDNS + DNSx',
    category: 'DNS Resolution',
    badgeColor: '#60a5fa',
    command: `puredns bruteforce /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt ${cleanDomain} -r resolvers.txt | dnsx -silent -o dns_resolved_${cleanDomain}.txt`,
  },
  {
    id: 'port_scan',
    name: '3. Fast Port Scanning & Service Discovery',
    tool: 'Naabu + Nmap',
    category: 'Port Scanning',
    badgeColor: '#a78bfa',
    command: `naabu -host ${cleanDomain} -p - -rate 1000 -c 50 -nmap-cli "nmap -sV -sC" -o open_ports_${cleanDomain}.txt`,
  },
  {
    id: 'host_probe',
    name: '4. Live HTTP Probing & Tech Fingerprinting',
    tool: 'Httpx',
    category: 'HTTP Probing',
    badgeColor: '#34d399',
    command: `httpx -l subdomains_${cleanDomain}.txt -title -tech-detect -status-code -follow-redirects -silent -o live_${cleanDomain}.txt`,
  },
  {
    id: 'crawl_endpoints',
    name: '5. Deep Web Crawler & Archive URL Extraction',
    tool: 'Katana + GAU',
    category: 'Crawling',
    badgeColor: '#fbbf24',
    command: `katana -u live_${cleanDomain}.txt -jc -kf -d 3 -silent -o katana_${cleanDomain}.txt && gau ${cleanDomain} | sort -u >> endpoints_${cleanDomain}.txt`,
  },
  {
    id: 'param_mining',
    name: '6. Hidden Parameter Discovery & Mining',
    tool: 'Arjun',
    category: 'Parameters',
    badgeColor: '#f97316',
    command: `arjun -u https://${cleanDomain} -m GET,POST --passive-only -oT params_${cleanDomain}.txt`,
  },
  {
    id: 'js_secrets',
    name: '7. JavaScript Secret & Token Scraping',
    tool: 'Httpx + Nuclei',
    category: 'JS Analysis',
    badgeColor: '#ec4899',
    command: `cat endpoints_${cleanDomain}.txt | grep -E '\\.js(\\?.*)?$' | httpx -silent | nuclei -t http/exposures/tokens/ -silent -o js_secrets_${cleanDomain}.txt`,
  },
  {
    id: 'visual_recon',
    name: '8. Visual Reconnaissance & Bulk Screenshots',
    tool: 'Gowitness',
    category: 'Visual Recon',
    badgeColor: '#818cf8',
    command: `gowitness scan file -f live_${cleanDomain}.txt --screenshot-path ./screenshots_${cleanDomain} --threads 8`,
  },
  {
    id: 'dir_fuzzing',
    name: '9. High-Speed Directory & Content Fuzzing',
    tool: 'FFUF',
    category: 'Directory Fuzzing',
    badgeColor: '#f59e0b',
    command: `ffuf -w /usr/share/wordlists/dirsearch.txt -u https://${cleanDomain}/FUZZ -mc 200,301,302,401,403 -c -v -o ffuf_${cleanDomain}.json`,
  },
  {
    id: 'nuclei_scan',
    name: '10. Targeted Nuclei Vulnerability Scan',
    tool: 'Nuclei v3',
    category: 'Vulnerability Scan',
    badgeColor: '#ef4444',
    command: `nuclei -l live_${cleanDomain}.txt -t cves/,vulnerabilities/,exposures/,misconfiguration/ -severity critical,high,medium -stats -o nuclei_${cleanDomain}.txt`,
  },
  {
    id: 'subdomain_takeover',
    name: '11. Subdomain Takeover Detection',
    tool: 'Subzy',
    category: 'Takeover Checks',
    badgeColor: '#14b8a6',
    command: `subzy run --targets subdomains_${cleanDomain}.txt --concurrency 50 --hide_fails`,
  },
  {
    id: 'git_secrets',
    name: '12. Git Organization Secret Extraction',
    tool: 'TruffleHog',
    category: 'Secret Mining',
    badgeColor: '#c084fc',
    command: `trufflehog github --org=${orgName} --json > trufflehog_${cleanDomain}.json`,
  },
];

export const getGoogleDorks = (cleanDomain: string): ReconDorkItem[] => [
  {
    id: 'dork_env',
    name: 'Exposed .env & Configuration Files',
    category: 'Credentials',
    badgeColor: '#ef4444',
    query: `site:${cleanDomain} (ext:env OR ext:yml OR ext:yaml OR ext:config OR ext:json) "DB_PASSWORD" OR "API_KEY" OR "SECRET"`,
  },
  {
    id: 'dork_index',
    name: 'Open Directory Indexes & File Listings',
    category: 'Information Leak',
    badgeColor: '#f97316',
    query: `site:${cleanDomain} intitle:"Index of /" OR intitle:"Index of /uploads" OR intitle:"parent directory"`,
  },
  {
    id: 'dork_admin',
    name: 'Admin Portals & Single Sign-On Portals',
    category: 'Auth Portals',
    badgeColor: '#eab308',
    query: `site:${cleanDomain} inurl:admin OR inurl:login OR inurl:dashboard OR inurl:cpanel OR inurl:portal OR inurl:sso`,
  },
  {
    id: 'dork_api',
    name: 'Swagger UI, OpenAPI & GraphQL Endpoints',
    category: 'API Docs',
    badgeColor: '#3b82f6',
    query: `site:${cleanDomain} inurl:swagger OR inurl:api-docs OR inurl:"/v1/api-docs" OR inurl:graphql OR inurl:graphiql`,
  },
  {
    id: 'dork_sql',
    name: 'Database Dumps & Backup Archives',
    category: 'Database Dumps',
    badgeColor: '#dc2626',
    query: `site:${cleanDomain} (ext:sql OR ext:db OR ext:bak OR ext:tar OR ext:zip OR ext:7z OR ext:dump) intext:"dump" OR intext:"password"`,
  },
  {
    id: 'dork_logs',
    name: 'Server Error Logs & Stack Traces',
    category: 'Log Exposure',
    badgeColor: '#ec4899',
    query: `site:${cleanDomain} (ext:log OR ext:txt OR ext:out) intext:"error" OR intext:"exception" OR intext:"stack trace"`,
  },
  {
    id: 'dork_phpinfo',
    name: 'Server Diagnostics & PHPInfo Pages',
    category: 'Diagnostics',
    badgeColor: '#8b5cf6',
    query: `site:${cleanDomain} ext:php "PHP Version" OR "Configuration File (php.ini) Path"`,
  },
  {
    id: 'dork_git',
    name: 'Exposed .git Directories & Source Repos',
    category: 'VCS Exposure',
    badgeColor: '#ef4444',
    query: `site:${cleanDomain} inurl:".git" OR inurl:".gitignore" OR inurl:"/.git/config"`,
  },
  {
    id: 'dork_s3_google',
    name: 'Public Cloud Storage References',
    category: 'Cloud Storage',
    badgeColor: '#10b981',
    query: `site:s3.amazonaws.com "${cleanDomain}" OR site:storage.googleapis.com "${cleanDomain}" OR site:blob.core.windows.net "${cleanDomain}"`,
  },
];

export const getGithubDorks = (cleanDomain: string): ReconDorkItem[] => [
  {
    id: 'gh_pw',
    name: 'Target Passwords & API Keys in Public Repos',
    category: 'Credentials',
    badgeColor: '#ef4444',
    query: `"${cleanDomain}" password OR secret OR api_key OR token`,
  },
  {
    id: 'gh_aws',
    name: 'AWS Access Keys & Secret Pairs',
    category: 'Cloud Secrets',
    badgeColor: '#f97316',
    query: `"${cleanDomain}" AKIA[0-9A-Z]{16} OR aws_secret_access_key`,
  },
  {
    id: 'gh_private_keys',
    name: 'Private RSA / OpenSSH Cryptographic Keys',
    category: 'Crypto Keys',
    badgeColor: '#dc2626',
    query: `"${cleanDomain}" "-----BEGIN RSA PRIVATE KEY-----" OR "-----BEGIN OPENSSH PRIVATE KEY-----"`,
  },
  {
    id: 'gh_db_uri',
    name: 'Database Connection URIs & Passwords',
    category: 'Database Connection',
    badgeColor: '#eab308',
    query: `"${cleanDomain}" "mongodb://" OR "postgres://" OR "mysql://" OR "redis://"`,
  },
  {
    id: 'gh_subdomains',
    name: 'Internal Hostnames & Dev/Staging Subdomains',
    category: 'Infrastructure',
    badgeColor: '#3b82f6',
    query: `"${cleanDomain}" "staging" OR "dev" OR "internal" OR "vpn" OR "corp"`,
  },
  {
    id: 'gh_jwt_oauth',
    name: 'JWT Secrets & OAuth Client Secrets',
    category: 'Auth Tokens',
    badgeColor: '#8b5cf6',
    query: `"${cleanDomain}" "JWT_SECRET" OR "client_secret" OR "oauth_token"`,
  },
  {
    id: 'gh_docker_k8s',
    name: 'Docker Compose & Kubernetes Secrets',
    category: 'DevOps Secrets',
    badgeColor: '#10b981',
    query: `"${cleanDomain}" "docker-compose" password OR "kubeconfig" OR "secretKeyRef"`,
  },
  {
    id: 'gh_s3',
    name: 'Cloud Storage Mentions & Bucket Names',
    category: 'Cloud Buckets',
    badgeColor: '#06b6d4',
    query: `"${cleanDomain}" s3.amazonaws.com OR blob.core.windows.net OR storage.googleapis.com`,
  },
];

export const getShodanDorks = (cleanDomain: string, orgName: string): ReconDorkItem[] => [
  {
    id: 'shodan_ssl_cn',
    name: 'SSL Certificate Common Name (CN)',
    category: 'Certificates',
    badgeColor: '#38bdf8',
    query: `ssl.cert.subject.CN:"${cleanDomain}"`,
    url: `https://www.shodan.io/search?query=${encodeURIComponent(`ssl.cert.subject.CN:"${cleanDomain}"`)}`,
  },
  {
    id: 'shodan_wildcard_ssl',
    name: 'Wildcard SSL Subdomain Discovery',
    category: 'Wildcard Certs',
    badgeColor: '#60a5fa',
    query: `ssl.cert.subject.CN:"*.${cleanDomain}" "200 OK"`,
    url: `https://www.shodan.io/search?query=${encodeURIComponent(`ssl.cert.subject.CN:"*.${cleanDomain}" "200 OK"`)}`,
  },
  {
    id: 'shodan_hostname',
    name: 'Hostname Association & Exposed Services',
    category: 'Hostnames',
    badgeColor: '#a78bfa',
    query: `hostname:"${cleanDomain}"`,
    url: `https://www.shodan.io/search?query=${encodeURIComponent(`hostname:"${cleanDomain}"`)}`,
  },
  {
    id: 'shodan_http_title',
    name: 'HTTP HTML Title & Brand Discovery',
    category: 'Web Titles',
    badgeColor: '#fbbf24',
    query: `http.title:"${orgName}"`,
    url: `https://www.shodan.io/search?query=${encodeURIComponent(`http.title:"${orgName}"`)}`,
  },
  {
    id: 'shodan_org_search',
    name: 'Organization Autonomous System (ASN)',
    category: 'Organization ASN',
    badgeColor: '#f97316',
    query: `org:"${orgName}"`,
    url: `https://www.shodan.io/search?query=${encodeURIComponent(`org:"${orgName}"`)}`,
  },
  {
    id: 'censys_search',
    name: 'Censys Global Service & Host Inspection',
    category: 'Censys Engine',
    badgeColor: '#34d399',
    query: `services.tls.certificates.leaf_data.subject.common_name: ${cleanDomain}`,
    url: `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(`services.tls.certificates.leaf_data.subject.common_name: ${cleanDomain}`)}`,
  },
];

export const getCloudBuckets = (cleanDomain: string, orgName: string): CloudBucketItem[] => [
  {
    id: 's3_std',
    name: 'AWS S3 Standard Hyphenated URL',
    provider: 'AWS S3',
    badgeColor: '#f97316',
    url: `https://${cleanDomain.replace(/\./g, '-')}.s3.amazonaws.com`,
  },
  {
    id: 's3_dot',
    name: 'AWS S3 Path-Style Dot URL',
    provider: 'AWS S3',
    badgeColor: '#f97316',
    url: `https://s3.amazonaws.com/${cleanDomain}`,
  },
  {
    id: 's3_org',
    name: 'AWS S3 Org Name Bucket URL',
    provider: 'AWS S3',
    badgeColor: '#f97316',
    url: `https://${orgName}.s3.amazonaws.com`,
  },
  {
    id: 'gcs_std',
    name: 'Google Cloud Storage (GCS) URL',
    provider: 'GCP Storage',
    badgeColor: '#4285f4',
    url: `https://storage.googleapis.com/${cleanDomain}`,
  },
  {
    id: 'azure_blob',
    name: 'Azure Blob Storage Container URL',
    provider: 'Azure Blob',
    badgeColor: '#0078d4',
    url: `https://${cleanDomain.replace(/[^a-z0-9]/gi, '')}.blob.core.windows.net/`,
  },
  {
    id: 'do_spaces',
    name: 'DigitalOcean Spaces Endpoint',
    provider: 'DigitalOcean',
    badgeColor: '#0080ff',
    url: `https://${cleanDomain}.nyc3.digitaloceanspaces.com`,
  },
  {
    id: 'firebase_db',
    name: 'Firebase Realtime Database JSON Endpoint',
    provider: 'Firebase',
    badgeColor: '#ffca28',
    url: `https://${orgName}.firebaseio.com/.json`,
  },
];
