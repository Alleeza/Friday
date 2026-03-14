import { MessageCircle, Minimize2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import questyImage from '../imgages/profile.png';

const quickReplies = [
  'Give me a hint',
  'Help me debug',
  'Explain this step',
  'What should I try next?',
];

function TutorAvatar() {
  return (
    <div className="relative h-14 w-14 overflow-hidden rounded-2xl border-b-4 border-[#49a300] bg-[#58cc02] shadow-[0_4px_0_rgba(73,163,0,0.45)]">
      <img
        src={questyImage}
        alt="Questy"
        className="h-full w-full object-cover object-top"
      />
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

function renderInlineMarkdown(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const [token] = match;
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-strong-${matchIndex}`} className="font-extrabold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`${keyPrefix}-em-${matchIndex}`} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-code-${matchIndex}`}
          className="rounded-md bg-slate-900/8 px-1.5 py-0.5 font-mono text-[0.92em] font-bold text-slate-700"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(token);
    }

    lastIndex = start + token.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderFormattedMessage(text) {
  const lines = text.split('\n');

  return lines.map((line, index) => {
    const trimmed = line.trim();
    const bulletMatch = /^[-*]\s+(.+)$/.exec(trimmed);

    if (!trimmed) {
      return <div key={`spacer-${index}`} className="h-2" />;
    }

    if (bulletMatch) {
      return (
        <div key={`bullet-${index}`} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
          <span>{renderInlineMarkdown(bulletMatch[1], `bullet-${index}`)}</span>
        </div>
      );
    }

    return (
      <p key={`line-${index}`}>
        {renderInlineMarkdown(line, `line-${index}`)}
      </p>
    );
  });
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
}) {
  const SCROLL_BOTTOM_THRESHOLD = 8;
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [lastViewedMessageKey, setLastViewedMessageKey] = useState('');
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);

  const conversationMessages = messages.filter((msg) => msg.role === 'you' || msg.role === 'ai');
  const latestMessage = conversationMessages[conversationMessages.length - 1];
  const latestMessageKey = latestMessage
    ? `${conversationMessages.length}:${latestMessage.role}:${latestMessage.text}`
    : '';
  const hasConversation = conversationMessages.length > 0;
  const hasUnreadMessages = Boolean(latestMessageKey) && latestMessageKey !== lastViewedMessageKey;

  const openChat = () => {
    setIsOpen(true);
    setHasOpenedOnce(true);
    setLastViewedMessageKey(latestMessageKey);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const updateScrollLock = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  };

  // Keep following the latest message only when the user is already at the bottom.
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!shouldStickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      scrollToBottom();
      updateScrollLock();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, latestMessageKey]);

  // Opening the panel should reveal the latest message immediately.
  useEffect(() => {
    if (!isOpen) return;
    shouldStickToBottomRef.current = true;
    const frame = requestAnimationFrame(() => {
      scrollToBottom();
      updateScrollLock();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLastViewedMessageKey(latestMessageKey);
  }, [isOpen, latestMessageKey]);

  useEffect(() => {
    if (!isStreaming) return undefined;
    openChat();
    return undefined;
  }, [isStreaming]);

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

  const showWelcomeHint = !hasConversation && !hasOpenedOnce;

  return (
    <>
      <aside
        className={`fixed bottom-24 right-4 z-50 flex h-[min(680px,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-[30px] border border-[#d9dde3] bg-[#f8fafc] shadow-[0_22px_60px_rgba(15,23,42,0.22)] transition-[opacity,transform] duration-300 ease-out sm:bottom-28 sm:right-6 sm:w-[25.5rem] ${
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-[0.97] opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
          <div className="bg-[linear-gradient(135deg,#58cc02_0%,#7adf2d_100%)] px-4 pb-4 pt-4 text-white">
            <div className="flex items-start gap-3">
              <TutorAvatar />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">AI Tutor</p>
                <h3 className="font-display text-3xl leading-none text-white">Questy Chat</h3>
                <p className="mt-1 text-sm font-semibold text-white/85">Ask questions as you build.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeChat}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/18 text-white transition hover:bg-white/28"
                  aria-label="Minimize chat"
                >
                  <Minimize2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/18 text-white transition hover:bg-white/28 sm:hidden"
                  aria-label="Close chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={updateScrollLock}
            className="flex-1 space-y-2 overflow-y-auto bg-[#f3f7fb] px-4 py-4"
          >
            {showWelcomeHint ? (
              <div className="flex h-full min-h-40 items-center justify-center px-6 text-center">
                <div>
                  <p className="text-sm font-bold text-slate-600">Ask for a hint, debugging help, or what to build next.</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Questy is ready when you are</p>
                </div>
              </div>
            ) : null}
            {conversationMessages.map((msg, i) => {
              const isLast = i === conversationMessages.length - 1;
              const showStreamingIndicator = isStreaming && isLast && msg.role === 'ai';

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
                  <div className="space-y-2 font-semibold leading-snug">
                    {msg.text ? renderFormattedMessage(msg.text) : (showStreamingIndicator ? <TypingDots /> : null)}
                    {showStreamingIndicator && msg.text && (
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[#58cc02] align-middle" />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#d9dde3] bg-white p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
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

            <div className="flex gap-2">
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
          </div>
      </aside>

      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closeChat();
            return;
          }
          openChat();
        }}
        className={`fixed bottom-5 right-5 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1cb0f6_0%,#0f9fe2_100%)] text-white shadow-[0_16px_35px_rgba(28,176,246,0.4)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 sm:bottom-6 sm:right-6 ${
          isOpen ? 'scale-95 shadow-[0_12px_28px_rgba(28,176,246,0.32)]' : 'scale-100'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <span className="absolute inset-0 rounded-full border-4 border-white/30" />
        <MessageCircle size={28} className="relative" />
        {!isOpen && (isStreaming || hasUnreadMessages) ? (
          <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-2 border-white bg-[#ff4b4b]">
            {isStreaming ? <span className="absolute inset-0 animate-ping rounded-full bg-[#ff4b4b]" /> : null}
          </span>
        ) : null}
      </button>

      {!isOpen && hasUnreadMessages && latestMessage?.text ? (
        <button
          type="button"
          onClick={openChat}
          className="fixed bottom-24 right-6 z-50 hidden w-72 rounded-[22px] border border-[#d8dde5] bg-white px-4 py-3 text-left shadow-[0_14px_40px_rgba(15,23,42,0.16)] transition-[opacity,transform] duration-300 ease-out hover:-translate-y-0.5 sm:block"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {latestMessage.role === 'you' ? 'You' : 'Questy'}
          </p>
          <p className="mt-1 max-h-10 overflow-hidden text-sm font-semibold leading-5 text-slate-600">{latestMessage.text}</p>
        </button>
      ) : null}
    </>
  );
}
