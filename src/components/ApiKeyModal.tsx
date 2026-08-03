import { useState } from 'react';
import { X, Key, ExternalLink, Check, Loader2 } from 'lucide-react';
import { getApiKey, setApiKey } from '@/lib/apiKey';

export function ApiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  function handleSave() {
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">API Key Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Enter your OpenRouter API key to enable real AI responses. Your key is stored locally in your browser and is never sent anywhere except directly to OpenRouter.
        </p>

        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 mb-4 transition-colors"
        >
          Get a free API key from OpenRouter <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">OpenRouter API Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 focus:border-emerald-500/50 outline-none text-sm font-mono"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save API Key'}
        </button>
      </div>
    </div>
  );
}
