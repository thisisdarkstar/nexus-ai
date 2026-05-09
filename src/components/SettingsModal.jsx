import { useState, useEffect, useRef } from 'react';
import { X, Download, Upload, Monitor } from 'lucide-react';
import { db } from '../lib/db';

export default function SettingsModal({ settings, onSave, onClose, onClearChats, reloadChats }) {
  const [provider, setProvider] = useState(settings.provider || 'chrome');
  const [theme, setTheme] = useState(settings.theme || 'dark');
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(settings.openaiBaseUrl || 'http://localhost:11434/v1');
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey || 'sk-local');
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel || '');
  const [availableModels, setAvailableModels] = useState([]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (provider === 'openai') {
      const fetchModels = async () => {
        try {
          const res = await fetch(`${openaiBaseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${openaiApiKey}` }
          });
          if (res.ok) {
             const data = await res.json();
             const models = data.data || [];
             setAvailableModels(models);
             if (models.length > 0 && !models.find(m => m.id === openaiModel)) {
                 setOpenaiModel(models[0].id);
             }
          }
        } catch(e) {
          console.error("Failed to fetch models", e);
        }
      }
      fetchModels();
    }
  }, [provider, openaiBaseUrl, openaiApiKey]);

  const handleSave = () => {
    onSave({ provider, theme, systemPrompt, openaiBaseUrl, openaiApiKey, openaiModel });
    onClose();
  };

  const handleExport = async () => {
    const data = await db.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await db.importData(event.target.result);
        alert('Import successful!');
        if (reloadChats) reloadChats();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--sidebar-glass)', backdropFilter: 'blur(24px)', width: '550px', borderRadius: '24px', border: '1px solid var(--sidebar-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={20} color="var(--accent-color)" />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>System Configuration</h2>
          </div>
          <button onClick={onClose} style={{ background: 'var(--card-glass)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e=>e.currentTarget.style.color='var(--text-primary)'} onMouseOut={e=>e.currentTarget.style.color='var(--text-secondary)'}><X size={16}/></button>
        </div>
        
        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Provider</label>
              <select 
                value={provider} 
                onChange={e => setProvider(e.target.value)}
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }}
              >
                <option value="chrome">Chrome Gemini Nano</option>
                <option value="openai">OpenAI Compatible API</option>
              </select>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Theme</label>
              <select 
                value={theme} 
                onChange={e => setTheme(e.target.value)}
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }}
              >
                <option value="dark">Deep Nebula (Dark)</option>
                <option value="light">Clear Sky (Light)</option>
              </select>
            </div>
          </div>

          {provider === 'openai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--card-glass)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
               <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OpenAI API Settings</h4>
               <div style={{ display: 'flex', gap: '15px' }}>
                 <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Base URL</label>
                    <input value={openaiBaseUrl} onChange={e => setOpenaiBaseUrl(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                 </div>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>API Key</label>
                    <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                 </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Model</label>
                  <select value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                     {availableModels.length === 0 ? <option value="">No models found or server unreachable</option> : availableModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                  </select>
               </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Global System Prompt</label>
            <textarea 
              value={systemPrompt} 
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are an expert coding assistant..."
              style={{ padding: '16px', borderRadius: '16px', border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', minHeight: '100px', fontSize: '1rem', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Data Management</h3>
             <div style={{ display: 'flex', gap: '12px' }}>
                 <button onClick={handleExport} style={{ flex: 1, padding: '12px', background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e=>e.currentTarget.style.background='var(--card-glass)'}>
                     <Download size={16} /> Export Data
                 </button>
                 <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
                 <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '12px', background: 'var(--card-glass)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={e=>e.currentTarget.style.background='var(--card-glass)'}>
                     <Upload size={16} /> Import Data
                 </button>
             </div>
             <button 
                onClick={onClearChats}
                style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', cursor: 'pointer', fontWeight: 500, marginTop: '8px' }}
                onMouseOver={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.2)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'}
             >
                Wipe All Conversations
             </button>
          </div>

        </div>
        <div style={{ padding: '24px 30px', borderTop: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 24px 24px' }}>
            <button 
                onClick={handleSave}
                style={{ padding: '12px 28px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 500, boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
                onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}
            >
                Save & Apply
            </button>
        </div>
      </div>
    </div>
  );
}
