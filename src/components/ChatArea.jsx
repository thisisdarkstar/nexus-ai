import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Copy, Check, Square, Sparkles, Download, Edit2, RotateCw, Paperclip, Clock, ChevronUp, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { db } from '../lib/db';
import { providerManager } from '../lib/providers/ProviderManager';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { Virtuoso } from 'react-virtuoso';

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true
});

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text));
}

const MessageItem = ({ msg, i, isGenerating, handleEditMessage, handleRegenerate, handleCopy, copiedIndex, onSpeak, isSpeaking }) => {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    const preTags = bodyRef.current.querySelectorAll('pre');
    preTags.forEach(pre => {
      if (pre.querySelector('.code-copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
      btn.onclick = () => {
        const code = pre.querySelector('code')?.innerText || '';
        navigator.clipboard.writeText(code);
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied';
        setTimeout(() => {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
        }, 2000);
      };
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }, [msg.content]);

  const plainText = msg.content ? msg.content.replace(/[#*_`\[\]\(\)]/g, '').replace(/\n/g, ' ').trim() : '';

  return (
    <div className="message-container" style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
      <div className="message-bubble" style={{ 
        maxWidth: '85%', 
        background: msg.role === 'user' ? 'var(--accent-gradient)' : 'var(--card-glass)', 
        padding: msg.role === 'user' ? '14px 20px' : '20px 24px', 
        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px', 
        color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', 
        border: msg.role === 'user' ? 'none' : '1px solid var(--card-border)',
        boxShadow: msg.role === 'user' ? '0 10px 25px rgba(139, 92, 246, 0.2)' : '0 10px 30px rgba(0,0,0,0.1)',
      }}>
        <div 
          ref={bodyRef}
          className="message-body" 
          dangerouslySetInnerHTML={{ __html: msg.role === 'ai' && msg.content ? renderMarkdown(msg.content) : (!msg.content ? '<span style="opacity:0.7; animation: pulse 2s infinite">Thinking...</span>' : msg.content.replace(/\n/g, '<br/>')) }} 
        />
      </div>
        
      {msg.content && (
        <div className="message-actions" style={{ display: 'flex', marginTop: '6px', padding: '0 8px', gap: '8px' }}>
          {msg.role === 'user' && !isGenerating && (
            <button 
              onClick={() => handleEditMessage(i)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', transition: 'color 0.2s', fontWeight: 500 }}
              title="Edit message"
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
          {msg.role === 'ai' && !isGenerating && (
            <button 
              onClick={() => handleRegenerate(i)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', transition: 'color 0.2s', fontWeight: 500 }}
              title="Regenerate response"
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <RotateCw size={14} /> Regenerate
            </button>
          )}
          <button 
            onClick={() => handleCopy(msg.content, i)} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', transition: 'color 0.2s', fontWeight: 500 }}
            title="Copy message"
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            {copiedIndex === i ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
          {msg.role === 'ai' && msg.content && onSpeak && (
            <button 
              onClick={() => onSpeak(plainText)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: isSpeaking ? 'var(--accent-color)' : 'var(--text-muted)', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '0.8rem', 
                transition: 'color 0.2s', 
                fontWeight: 500,
                animation: isSpeaking ? 'pulse 1s infinite' : 'none'
              }}
              title={isSpeaking ? "Stop speaking" : "Speak message"}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = isSpeaking ? 'var(--accent-color)' : 'var(--text-muted)'}
            >
              {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isSpeaking ? 'Stop' : 'Speak'}
            </button>
          )}
          {msg.generationTime && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }} title={`Generated in ${msg.generationTime} seconds`}>
              <Clock size={12} /> {msg.generationTime}s
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default function ChatArea({ 
  currentChatId, 
  setCurrentChatId, 
  currentProjectId, 
  providerStatus, 
  reloadChats, 
  settings, 
  onModelChange, 
  availableModels,
  voice,
  interactiveMode,
  setInteractiveMode,
  setVoiceOverlay
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('New Conversation');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const stopRef = useRef(false);
  const fileInputRef = useRef(null);
  const [isSttActive, setIsSttActive] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const fileExt = file.name.split('.').pop();
      const formattedContent = `\n\n\`\`\`${fileExt}\n// ${file.name}\n${content}\n\`\`\`\n`;
      setInput(prev => prev + formattedContent);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    async function loadChat() {
      if (currentChatId) {
        const chats = await db.getChats();
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
          setMessages(chat.messages || []);
          setTitle(chat.title);
          if (chat.provider && onModelChange) {
              onModelChange(chat.provider, chat.model);
          }
        }
      } else {
        setMessages([]);
        setTitle('New Conversation');
      }
    }
    loadChat();
  }, [currentChatId]);



  useEffect(() => {
      if (!isGenerating && messages.length > 0) {
          let cid = currentChatId || Date.now().toString();
          if (!currentChatId) setCurrentChatId(cid);
          
          db.saveChat({
              id: cid,
              projectId: currentProjectId || 'default',
              title: title,
              messages: messages,
              provider: settings.provider,
              model: settings.provider === 'openai' ? settings.openaiModel : 'Gemini Nano',
              updatedAt: Date.now()
          }).then(() => reloadChats());
      }
  }, [isGenerating]);

  const handleExportChat = () => {
    if (!messages.length) return;
    let markdown = `# ${title}\n\n`;
    for (const msg of messages) {
      markdown += `### ${msg.role === 'user' ? 'User' : 'Assistant'}\n${msg.content}\n\n`;
    }
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEditMessage = (index) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'user') return;
    setInput(msg.content);
    setMessages(messages.slice(0, index));
  };

  const handleRegenerate = async (index) => {
    if (isGenerating) return;
    const msg = messages[index];
    if (msg.role !== 'ai') return;
    
    const newMessages = messages.slice(0, index);
    
    setIsGenerating(true);
    stopRef.current = false;
    const startTime = Date.now();
    
    setMessages([...newMessages, { role: 'ai', content: '' }]);

    try {
      const provider = providerManager.getProvider();
      const stream = provider.streamPrompt(newMessages, settings.systemPrompt);
      
      let accumulated = '';
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = accumulated;
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = `**Error:** ${e.message}`;
        return updated;
      });
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
          updated[updated.length - 1].generationTime = duration;
        }
        return updated;
      });
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    setInput('');
    setIsGenerating(true);
    stopRef.current = false;
    const startTime = Date.now();

    let currentMessages = [...messages, { role: 'user', content: text }];
    setMessages(currentMessages);
    
    if (currentMessages.length === 1) {
       setTitle(text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    }

    currentMessages = [...currentMessages, { role: 'ai', content: '' }];
    setMessages(currentMessages);

    try {
      const provider = providerManager.getProvider();
      const stream = provider.streamPrompt(currentMessages.slice(0, -1), settings.systemPrompt);
      
      let accumulated = '';
      for await (const delta of stream) {
        if (stopRef.current) break;
        accumulated += delta;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = accumulated;
          return newMsgs;
        });
      }
    } catch (e) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = `**Error:** ${e.message}`;
        return newMsgs;
      });
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const lastMsg = messages[messages.length - 1];
      const finalContent = lastMsg?.content || '';
      const plainText = finalContent.replace(/[#*_`\[\]\(\)]/g, '').replace(/\n/g, ' ').trim();
      
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
          updated[updated.length - 1].generationTime = duration;
        }
        return updated;
      });
      setIsGenerating(false);
      
      if (interactiveMode && plainText.length > 10 && voice && setVoiceOverlay) {
        console.log('>>> AUTO-TTS ON FINISH');
        setVoiceOverlay({ active: true, type: 'tts', text: plainText });
        voice.speak(plainText, () => {
          if (setVoiceOverlay) {
            setVoiceOverlay({ active: false, type: null, text: '' });
          }
        });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (providerStatus.state === 'ready' && !isGenerating && input.trim()) {
           handleSend();
        }
      } else if (e.ctrlKey || e.shiftKey) {
          e.preventDefault();
          const start = e.target.selectionStart;
          const end = e.target.selectionEnd;
          setInput(input.substring(0, start) + "\n" + input.substring(end));
          setTimeout(() => {
              e.target.selectionStart = e.target.selectionEnd = start + 1;
          }, 0);
      }
    }
  };

  const handleSttToggle = useCallback(() => {
    if (!voice || !voice.isSupported) {
      console.warn('Voice not supported');
      return;
    }

    if (isSttActive) {
      voice.stopListening();
      setIsSttActive(false);
      if (setVoiceOverlay) {
        setVoiceOverlay({ active: false, type: null, text: '' });
      }
    } else {
      setIsSttActive(true);
      if (setVoiceOverlay) {
        setVoiceOverlay({ active: true, type: 'stt', text: '' });
      }
      voice.startListening((transcript) => {
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      });
    }
  }, [voice, isSttActive, setVoiceOverlay]);

  useEffect(() => {
    if (!voice) return;
    
    const syncState = setInterval(() => {
      const shouldBeActive = voice.isListening;
      if (isSttActive !== shouldBeActive) {
        setIsSttActive(shouldBeActive);
      }
    }, 200);

    return () => clearInterval(syncState);
  }, [voice, isSttActive]);

  const handleSpeakMessage = useCallback((text) => {
    if (!voice) return;
    
    if (voice.isSpeaking) {
      voice.stopSpeaking();
      if (setVoiceOverlay) {
        setVoiceOverlay({ active: false, type: null, text: '' });
      }
    } else {
      if (setVoiceOverlay) {
        setVoiceOverlay({ active: true, type: 'tts', text: text });
      }
      voice.speak(text, () => {
        if (setVoiceOverlay) {
          setVoiceOverlay({ active: false, type: null, text: '' });
        }
      });
    }
  }, [voice, setVoiceOverlay]);

  useEffect(() => {
    if (voice) {
      const checkState = setInterval(() => {
        if (voice.isListening !== isSttActive) {
          setIsSttActive(voice.isListening);
        }
      }, 200);
      return () => clearInterval(checkState);
    }
  }, [voice, isSttActive]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 10 }}>
      <header style={{ height: '70px', padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sidebar-border)', background: 'var(--sidebar-glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9 }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {messages.length > 0 && (
            <button 
              onClick={handleExportChat}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 10px', borderRadius: '12px', transition: 'background 0.2s' }}
              title="Export as Markdown"
              onMouseOver={e => { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Download size={16} /> Export
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '6px 12px', borderRadius: '20px', background: 'var(--card-glass)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <Sparkles size={14} color="var(--accent-color)" />
            <span style={{ fontWeight: 500, opacity: 0.8 }}>{settings.provider === 'openai' ? (settings.openaiModel || 'Default Model') : 'Gemini Nano'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '6px 12px', borderRadius: '20px', background: 'var(--card-glass)', border: '1px solid var(--card-border)', color: providerStatus.state === 'ready' ? '#34d399' : '#fbbf24', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: providerStatus.state === 'ready' ? '#34d399' : '#fbbf24', boxShadow: `0 0 8px ${providerStatus.state === 'ready' ? '#34d399' : '#fbbf24'}` }} />
            <span style={{ fontWeight: 500 }}>{providerStatus.state === 'ready' ? 'Ready' : providerStatus.state === 'checking' ? 'Checking...' : providerStatus.reason}</span>
          </div>
{/* Enable Voice button disabled for now
            {voice && voice.isSupported && (
              <button
                onClick={() => {
                  if (setInteractiveMode) setInteractiveMode(!interactiveMode);
                  if (setVoiceOverlay) {
                    if (!interactiveMode) {
                      setVoiceOverlay({ active: true, type: 'tts', text: '' });
                    }
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: interactiveMode ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--card-glass)',
                  border: interactiveMode ? 'none' : '1px solid var(--card-border)',
                  color: interactiveMode ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  boxShadow: interactiveMode ? '0 4px 15px rgba(139, 92, 246, 0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
                title={interactiveMode ? 'Interactive Mode On - Click to disable' : 'Enable Interactive Mode for voice'}
              >
                <Mic size={14} />
                <span>{interactiveMode ? 'Interactive' : 'Enable Voice'}</span>
              </button>
            )}
            */}
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative' }}>
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)' }}>
              <Sparkles size={40} color="white" />
            </div>
            <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-1px' }}>How can I help?</h1>
            <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Local, private, and exceptionally fast.</p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={messages}
            followOutput="smooth"
            itemContent={(i, msg) => (
              <div style={{ maxWidth: '900px', margin: '0 auto', padding: '12px 20px' }}>
                <MessageItem 
                  msg={msg} 
                  i={i} 
                  isGenerating={isGenerating}
                  handleEditMessage={handleEditMessage}
                  handleRegenerate={handleRegenerate}
                  handleCopy={handleCopy}
                  copiedIndex={copiedIndex}
                  onSpeak={handleSpeakMessage}
                  isSpeaking={voice && voice.isSpeaking && speakingMessageIndex === i}
                />
              </div>
            )}
            components={{
              Header: () => <div style={{ height: '40px' }} />,
              Footer: () => <div style={{ height: '140px' }} />
            }}
          />
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '30px', background: 'linear-gradient(to top, var(--bg-main) 50%, transparent)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {isGenerating && (
          <div style={{ pointerEvents: 'auto', marginBottom: '16px' }}>
            <button 
              onClick={() => { stopRef.current = true; setIsGenerating(false); }}
              style={{ background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--card-glass)'}
            >
              <Square size={14} fill="currentColor"/> Stop Generating
            </button>
          </div>
        )}

        <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'flex-end', background: 'var(--input-bg)', borderRadius: '24px', padding: '12px 16px', border: '1px solid var(--input-border)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'border-color 0.3s, box-shadow 0.3s' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', resize: 'none', maxHeight: '200px', padding: '8px 12px', fontSize: '1.05rem', lineHeight: 1.5 }}
            rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 8) : 1}
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                disabled={isGenerating}
                style={{ height: '44px', background: 'var(--card-glass)', border: '1px solid var(--card-border)', color: 'var(--accent-color)', borderRadius: '16px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: isGenerating ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontWeight: 600, opacity: isGenerating ? 0.5 : 1, whiteSpace: 'nowrap' }}
                onMouseOver={e => { if(!isGenerating) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)' }}
                onMouseOut={e => { if(!isGenerating) e.currentTarget.style.background = 'var(--card-glass)' }}
              >
                 <Sparkles size={16} />
                 <span>{settings.provider === 'openai' ? (settings.openaiModel || 'Select Model') : 'Gemini Nano'}</span>
                 <ChevronUp size={16} style={{ transform: isModelMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />
              </button>
              
              {isModelMenuOpen && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsModelMenuOpen(false)} />
                  <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '12px', width: '300px', background: 'rgba(23, 23, 33, 0.98)', border: '1px solid var(--sidebar-border)', borderRadius: '20px', padding: '10px', zIndex: 100, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', backdropFilter: 'blur(50px)', WebkitBackdropFilter: 'blur(50px)', maxHeight: '400px', overflowY: 'auto', borderBottom: '2px solid var(--accent-color)' }}>
                    <div style={{ padding: '10px 14px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Switch Model</span>
                      <Sparkles size={12} />
                    </div>
                    <button 
                      onClick={() => { onModelChange('chrome', 'Gemini Nano'); setIsModelMenuOpen(false); }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: settings.provider === 'chrome' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', border: 'none', borderRadius: '10px', color: settings.provider === 'chrome' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                      onMouseOver={e => { if(settings.provider !== 'chrome') { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                      onMouseOut={e => { if(settings.provider !== 'chrome') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                    >
                      <Sparkles size={14} color="var(--accent-color)" />
                      <span>Gemini Nano (Built-in)</span>
                      {settings.provider === 'chrome' && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
                    </button>
                    {availableModels.length > 0 && (
                      <div style={{ margin: '8px 0', height: '1px', background: 'var(--sidebar-border)' }} />
                    )}
                    {availableModels.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => { onModelChange('openai', m.id); setIsModelMenuOpen(false); }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: (settings.provider === 'openai' && settings.openaiModel === m.id) ? 'rgba(139, 92, 246, 0.2)' : 'transparent', border: 'none', borderRadius: '10px', color: (settings.provider === 'openai' && settings.openaiModel === m.id) ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                        onMouseOver={e => { if(settings.openaiModel !== m.id) { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                        onMouseOut={e => { if(settings.openaiModel !== m.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                      >
                        <RotateCw size={14} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</span>
                        {settings.provider === 'openai' && settings.openaiModel === m.id && <Check size={14} style={{ marginLeft: 'auto', color: '#34d399' }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".txt,.md,.js,.py,.html,.css,.json,.csv,.log" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: isGenerating ? 'not-allowed' : 'pointer', padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s', opacity: isGenerating ? 0.5 : 1 }}
              onMouseOver={e=> {if(!isGenerating) e.currentTarget.style.color='var(--text-primary)'}}
              onMouseOut={e=> {if(!isGenerating) e.currentTarget.style.color='var(--text-secondary)'}}
              title="Attach Text File"
            >
              <Paperclip size={20} />
            </button>
            {voice && voice.isSupported && (
              <button 
                onClick={handleSttToggle}
                disabled={isGenerating}
                style={{ 
                  background: isSttActive ? 'linear-gradient(135deg, #ef4444, #f87171)' : 'transparent', 
                  border: isSttActive ? 'none' : 'none', 
                  color: isSttActive ? '#fff' : (isGenerating ? 'var(--text-muted)' : 'var(--text-secondary)'), 
                  cursor: isGenerating ? 'not-allowed' : 'pointer', 
                  padding: '10px 4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  transition: 'all 0.2s',
                  opacity: isGenerating ? 0.5 : 1,
                  boxShadow: isSttActive ? '0 4px 15px rgba(239, 68, 68, 0.4)' : 'none',
                  borderRadius: isSttActive ? '12px' : '0'
                }}
                onMouseOver={e=> {if(!isGenerating) e.currentTarget.style.color='var(--text-primary)'}}
                onMouseOut={e=> {if(!isGenerating) e.currentTarget.style.color=isSttActive ? '#fff' : 'var(--text-secondary)'}}
                title={isSttActive ? "Stop listening" : "Voice input (Speech to Text)"}
              >
                {isSttActive ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isGenerating || providerStatus.state !== 'ready'}
              style={{ width: '44px', height: '44px', borderRadius: '16px', background: (!input.trim() || isGenerating || providerStatus.state !== 'ready') ? 'var(--card-glass)' : 'var(--accent-gradient)', color: (!input.trim() || isGenerating || providerStatus.state !== 'ready') ? 'var(--text-muted)' : '#fff', border: (!input.trim() || isGenerating || providerStatus.state !== 'ready') ? '1px solid var(--card-border)' : 'none', marginLeft: '12px', cursor: (!input.trim() || isGenerating || providerStatus.state !== 'ready') ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow: (!input.trim() || isGenerating || providerStatus.state !== 'ready') ? 'none' : '0 4px 15px rgba(139, 92, 246, 0.4)' }}
              onMouseOver={e => { if (!(!input.trim() || isGenerating || providerStatus.state !== 'ready')) e.currentTarget.style.transform = 'scale(1.05)' }}
              onMouseOut={e => { if (!(!input.trim() || isGenerating || providerStatus.state !== 'ready')) e.currentTarget.style.transform = 'scale(1)' }}
            >
              <Send size={20} strokeWidth={2.5} style={{ position: 'relative', left: '1px' }} />
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
