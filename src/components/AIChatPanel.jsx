import { useEffect, useRef, useState } from 'react';

const quickReplies = [
  'Give me a hint',
  'Help me debug',
  'Explain this step',
  'What should I try next?',
];

function TutorAvatar() {
  return (
    <div className="relative h-14 w-14 rounded-2xl border-b-4 border-[#49a300] bg-[#58cc02] shadow-[0_4px_0_rgba(73,163,0,0.45)]">
      <div className="absolute left-3 top-4 h-4 w-4 rounded-full bg-white"><div className="ml-1 mt-1 h-2 w-2 rounded-full bg-slate-700" /></div>
      <div className="absolute right-3 top-4 h-4 w-4 rounded-full bg-white"><div className="ml-1 mt-1 h-2 w-2 rounded-full bg-slate-700" /></div>
      <div className="absolute bottom-3 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#58cc02] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/**
 * AIChatPanel — Chat sidebar for Questy AI tutor.
 *
 * Props:
 *   messages    — array of { role: 'you' | 'ai' | 'system', text: string }
 *   onSend      — (text: string) => void
 *   isStreaming — boolean  true while AI is generating
 *   onAbort     — () => void  cancels the in-flight stream
 */
export default function AIChatPanel({
  messages,
  onSend,
  isStreaming = false,
  onAbort,
  providerOptions = [],
  selectedProvider = '',
  onProviderChange,
  modelOptions = [],
  selectedModel = '',
  onModelChange,
  isLoadingModels = false,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <aside className="quest-card flex h-full flex-col rounded-[30px] border border-[#d9dde3] bg-[#f8fafc] p-4 shadow-[0_6px_0_rgba(148,163,184,0.12)]">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3 border-b border-[#d9dde3] pb-3">
        <TutorAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI Tutor</p>
          <h3 className="font-display text-3xl leading-none text-[#58cc02]">Questy Chat</h3>
          <p className="text-sm text-slate-500">Ask questions as you build.</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Provider</span>
          <select
            value={selectedProvider}
            onChange={(e) => onProviderChange?.(e.target.value)}
            disabled={isStreaming}
            className="w-full rounded-2xl border border-[#d4d9df] bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:border-[#25a8ef] focus:outline-none focus:ring-2 focus:ring-[#25a8ef]/20 disabled:bg-[#f1f5f9] disabled:text-slate-400"
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Model</span>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange?.(e.target.value)}
            disabled={isStreaming || !modelOptions.length}
            className="w-full rounded-2xl border border-[#d4d9df] bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:border-[#25a8ef] focus:outline-none focus:ring-2 focus:ring-[#25a8ef]/20 disabled:bg-[#f1f5f9] disabled:text-slate-400"
          >
            {modelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="mb-3 text-[11px] font-semibold text-slate-400">
        {isLoadingModels ? 'Loading models from Ollama…' : `Using ${selectedProvider || 'provider'} / ${selectedModel || 'model'}`}
      </p>

      {/* Message list */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-3xl border border-[#d8dde5] bg-white p-3">
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const showStreamingIndicator = isStreaming && isLast && msg.role === 'ai';

          // System notifications — muted centered label
          if (msg.role === 'system') {
            return (
              <div
                key={`system-${i}`}
                className="mx-auto max-w-[92%] rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-center text-[11px] font-semibold text-slate-400"
              >
                {msg.text}
              </div>
            );
          }

          return (
            <div
              key={`${msg.role}-${i}`}
              className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm shadow-[inset_0_-2px_0_rgba(15,23,42,0.04)] ${
                msg.role === 'you'
                  ? 'ml-auto border border-[#8fd0f8] bg-[#dff3ff] text-[#166b9a]'
                  : 'border border-[#bce3a0] bg-[#eefadb] text-slate-800'
              }`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                {msg.role === 'you' ? 'You' : 'Questy'}
              </p>
              <p className="font-semibold leading-snug">
                {msg.text || (showStreamingIndicator ? <TypingDots /> : null)}
                {showStreamingIndicator && msg.text && (
                  <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[#58cc02] align-middle" />
                )}
              </p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick reply buttons */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {quickReplies.map((label) => (
          <button
            key={label}
            onClick={() => !isStreaming && onSend(label)}
            disabled={isStreaming}
            className="rounded-2xl border border-[#d4d9df] bg-white px-3 py-2.5 text-left text-xs font-extrabold text-slate-700 shadow-[inset_0_-2px_0_rgba(148,163,184,0.2)] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Questy is thinking…' : 'Ask Questy anything'}
          className="w-full rounded-full border border-[#d4d9df] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 focus:border-[#25a8ef] focus:outline-none focus:ring-2 focus:ring-[#25a8ef]/20 disabled:bg-[#f1f5f9] disabled:text-slate-400"
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-extrabold text-white shadow-[0_4px_0_rgba(185,28,28,0.45)] hover:bg-rose-600 active:translate-y-px active:shadow-none"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!input.trim()}
            className="duo-btn-blue rounded-full px-6 py-2 text-sm font-extrabold shadow-[0_4px_0_rgba(12,129,191,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </aside>
  );
}
