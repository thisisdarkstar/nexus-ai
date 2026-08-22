export const SAMPLE_YARA = `rule Detect_Suspicious_PowerShell_WebClient {
    meta:
        description = "Detects hidden PowerShell download cradles attempting C2 execution"
        author = "Nexus Security AI"
        date = "2026-08-20"
        severity = "High"
        reference = "MITRE ATT&CK T1059.001"

    strings:
        $s1 = "Net.WebClient" nocase
        $s2 = "DownloadString(" nocase
        $s3 = "DownloadFile(" nocase
        $s4 = "-enc" nocase
        $s5 = "-ExecutionPolicy Bypass" nocase
        $s6 = "IEX" nocase
        $hex_magic = { 4D 5A 90 00 } // MZ Header

    condition:
        ($s1 and ($s2 or $s3) and ($s4 or $s5 or $s6)) or
        (2 of ($s*) and $hex_magic)
}`;

export const SAMPLE_SIGMA = `title: Suspicious PowerShell Process with Encoded Command
id: 5a8a1b32-8492-4f9e-9d21-72fba17621c1
status: test
description: Detects execution of PowerShell with base64 encoded command parameters
references:
    - https://attack.mitre.org/techniques/T1059/001/
author: Nexus Security AI
date: 2026/08/20
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        Image|endswith:
            - '\\powershell.exe'
            - '\\pwsh.exe'
        CommandLine|contains:
            - ' -e '
            - ' -enc '
            - ' -encodedcommand '
            - ' -ec '
    condition: selection
falsepositives:
    - Legitimate administrative automation scripts
level: high
tags:
    - attack.execution
    - attack.t1059.001`;

export const STRIDE_CATEGORIES = [
  {
    threat: 'Spoofing (S)',
    description:
      'Impersonating an identity, user, service, or server (e.g. session hijacking, weak tokens, lack of mTLS).',
    mitigation: 'Strong MFA, JWT signature validation, cryptographically bound sessions, mutual TLS.',
  },
  {
    threat: 'Tampering (T)',
    description:
      'Modifying data in transit, in memory, or in storage without authorization (e.g. parameter tampering, MITM).',
    mitigation: 'HMAC/Digital signatures, TLS 1.3 encryption, database row-level hashing, input validation.',
  },
  {
    threat: 'Repudiation (R)',
    description:
      'Claiming an action was not performed due to inadequate or tamperable audit logs.',
    mitigation: 'Immutable centralized SIEM audit logs, cryptographically signed audit trails, WORM storage.',
  },
  {
    threat: 'Information Disclosure (I)',
    description:
      'Exposing confidential data to unauthorized parties (e.g. verbose errors, IDOR, SSRF, leaky APIs).',
    mitigation:
      'Defense-in-depth authorization checks, field-level encryption, generic error handling, rate limiting.',
  },
  {
    threat: 'Denial of Service (D)',
    description:
      'Exhausting resources to render a system or API unavailable (e.g. ReDoS, volumetric floods, DB connection exhaustion).',
    mitigation:
      'Adaptive rate limiting, CAPTCHAs, connection pooling limits, timeout bounds, DDoS shielding.',
  },
  {
    threat: 'Elevation of Privilege (E)',
    description: 'Gaining unauthorized administrative or horizontal/vertical permissions.',
    mitigation:
      'Principle of Least Privilege (PoLP), strict RBAC/ABAC enforcement, removing suid/admin binaries.',
  },
];
