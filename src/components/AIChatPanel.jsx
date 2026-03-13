import { useState } from 'react';

const starterReplies = {
  'Give me a hint': 'Try this: when your event runs, what action should happen right away?',
  'Help me debug': 'Check if your event is connected to an action block in the script area.',
  'Explain this step': 'Variables hold changing values like score, lives, or speed.',
  'What next?': 'After movement, add a condition block for a win or lose state.',
};

function TutorAvatar() {
  return (
    <div className="relative h-14 w-14 rounded-2xl border-b-4 border-[#49a300] bg-[#58cc02] shadow-[0_4px_0_rgba(73,163,0,0.45)]">
      <div className="absolute left-3 top-4 h-4 w-4 rounded-full bg-white"><div className="ml-1 mt-1 h-2 w-2 rounded-full bg-slate-700" /></div>
      <div className="absolute right-3 top-4 h-4 w-4 rounded-full bg-white"><div className="ml-1 mt-1 h-2 w-2 rounded-full bg-slate-700" /></div>
      <div className="absolute bottom-3 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
    </div>
  );
}

export default function AIChatPanel({ messages, onSend }) {
  const [input, setInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  return (
    <aside className="quest-card h-full rounded-[30px] border border-[#d9dde3] bg-[#f8fafc] p-4 shadow-[0_6px_0_rgba(148,163,184,0.12)]">
      <div className="mb-3 flex items-center gap-3 border-b border-[#d9dde3] pb-3">
        <TutorAvatar />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI Tutor</p>
          <h3 className="font-display text-3xl leading-none text-[#58cc02]">Questy Chat</h3>
          <p className="text-sm text-slate-500">Ask questions as you build.</p>
        </div>
      </div>

      <div className="h-[360px] space-y-2 overflow-y-auto rounded-3xl border border-[#d8dde5] bg-white p-3">
        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}`}
            className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm shadow-[inset_0_-2px_0_rgba(15,23,42,0.04)] ${
              msg.role === 'you'
                ? 'ml-auto border border-[#8fd0f8] bg-[#dff3ff] text-[#166b9a]'
                : 'border border-[#bce3a0] bg-[#eefadb] text-slate-800'
            }`}
          >
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{msg.role === 'you' ? 'You' : 'Questy'}</p>
            <p className="font-semibold leading-snug">{msg.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.keys(starterReplies).map((label) => (
          <button
            key={label}
            onClick={() => onSend(label, starterReplies[label])}
            className="rounded-2xl border border-[#d4d9df] bg-white px-3 py-2.5 text-left text-xs font-extrabold text-slate-700 shadow-[inset_0_-2px_0_rgba(148,163,184,0.2)] hover:bg-[#f8fbff]"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask Questy anything"
          className="w-full rounded-full border border-[#d4d9df] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 focus:border-[#25a8ef] focus:outline-none focus:ring-2 focus:ring-[#25a8ef]/20"
        />
        <button onClick={submit} className="duo-btn-blue rounded-full px-6 py-2 text-sm font-extrabold shadow-[0_4px_0_rgba(12,129,191,0.45)]">Send</button>
      </div>
    </aside>
  );
}
