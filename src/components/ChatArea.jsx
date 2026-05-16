import { useState } from 'react';
import { Sparkles, Download, Terminal } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useChatEngine } from '../hooks/useChatEngine';
import MessageItem from './chat/MessageItem';
import InputBar from './chat/InputBar';
import AttachModal from './chat/AttachModal';
import SkeletonBubble from './chat/SkeletonBubble';

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
  setVoiceOverlay
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);

  const {
    messages,
    input,
    setInput,
    isGenerating,
    title,
    copiedIndex,
    isSttActive,
    speakingMessageIndex,
    isLoadingChat,
    chatSystemPrompt,
    setChatSystemPrompt,
    showConvPrompt,
    setShowConvPrompt,
    hasQueuedPrompt,
    queuedPromptDisplay,
    handleSend,
    handleStop,
    handleRegenerate,
    handleEditMessage,
    handleCopy,
    handleExportChat,
    handleSttToggle,
    handleSpeakMessage,
    cancelQueue,
  } = useChatEngine({
    currentChatId,
    setCurrentChatId,
    currentProjectId,
    settings,
    reloadChats,
    voice,
    interactiveMode,
    setVoiceOverlay,
    onModelChange,
  });

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileExt = file.name.split('.').pop();
      setInput(prev => prev + `\n\n\`\`\`${fileExt}\n// ${file.name}\n${event.target.result}\n\`\`\`\n`);
    };
    reader.readAsText(file);
  };

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 10 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(139,92,246,0.06)', border: '2px dashed rgba(139,92,246,0.45)', borderRadius: '8px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--sidebar-glass)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '16px', padding: '20px 40px', border: '1px solid rgba(139,92,246,0.3)', color: 'rgba(139,92,246,0.9)', fontSize: '1rem', fontWeight: 500 }}>
            Drop to attach file
          </div>
        </div>
      )}

      <header style={{ padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: showConvPrompt ? 'none' : '1px solid var(--sidebar-border)', background: 'var(--sidebar-glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', minHeight: '70px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.9 }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowConvPrompt(s => !s)}
            style={{ background: showConvPrompt ? 'rgba(139,92,246,0.15)' : 'transparent', border: showConvPrompt ? '1px solid rgba(139,92,246,0.4)' : 'none', color: showConvPrompt ? '#a78bfa' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 10px', borderRadius: '12px', transition: 'all 0.2s' }}
            title={chatSystemPrompt ? 'Custom system prompt active' : 'Set conversation system prompt'}
            onMouseOver={e => { if (!showConvPrompt) { e.currentTarget.style.background = 'var(--card-glass)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
            onMouseOut={e => { if (!showConvPrompt) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
          >
            <Terminal size={16} />
            <span>{chatSystemPrompt ? 'Prompt Active' : 'Set Prompt'}</span>
          </button>
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
        </div>
      </header>

      {showConvPrompt && (
        <div style={{ padding: '12px 30px', borderBottom: '1px solid var(--sidebar-border)', background: 'var(--sidebar-glass)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Conversation System Prompt <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 'normal' }}>(overrides global)</span>
          </label>
          <textarea
            value={chatSystemPrompt}
            onChange={e => setChatSystemPrompt(e.target.value)}
            placeholder="e.g. You are a helpful assistant specializing in Python..."
            rows={2}
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '12px', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.5, width: '100%' }}
          />
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        {isLoadingChat ? (
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
            <SkeletonBubble isUser width="36%" />
            <SkeletonBubble isUser={false} width="70%" />
            <SkeletonBubble isUser width="28%" />
            <SkeletonBubble isUser={false} width="78%" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 10px 30px rgba(139,92,246,0.4)' }}>
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
                  onEdit={handleEditMessage}
                  onRegenerate={handleRegenerate}
                  onCopy={handleCopy}
                  copiedIndex={copiedIndex}
                  onSpeak={handleSpeakMessage}
                  isSpeaking={voice && voice.isSpeaking && speakingMessageIndex === i}
                  availableModels={availableModels}
                  settings={settings}
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

      <InputBar
        input={input}
        onInputChange={setInput}
        isGenerating={isGenerating}
        providerStatus={providerStatus}
        isSttActive={isSttActive}
        voice={voice}
        hasQueuedPrompt={hasQueuedPrompt}
        queuedPromptDisplay={queuedPromptDisplay}
        settings={settings}
        availableModels={availableModels}
        onModelChange={onModelChange}
        onSend={handleSend}
        onStop={handleStop}
        onSttToggle={handleSttToggle}
        onAttachOpen={() => setAttachModalOpen(true)}
        onCancelQueue={cancelQueue}
      />

      {attachModalOpen && (
        <AttachModal
          onAttach={text => setInput(prev => prev + text)}
          onClose={() => setAttachModalOpen(false)}
        />
      )}

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
