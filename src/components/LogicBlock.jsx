function GripDots() {
  return (
    <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-white/25">
      <span className="grid grid-cols-2 gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-full bg-white/95" />
        ))}
      </span>
    </span>
  );
}

function normalizeOptions(options = []) {
  return options.map((option) => typeof option === 'string'
    ? { value: option, label: option }
    : { value: option.value, label: option.label ?? option.value });
}

function Token({ token, compact, editable, onChange, assetOptions = [] }) {
  if (typeof token === 'string') {
    return <span>{token}</span>;
  }

  if (token.type === 'dropdown' || token.type === 'asset') {
    const options = normalizeOptions(token.type === 'asset' ? assetOptions : token.options);
    const fallback = options[0]?.value ?? token.value ?? '';
    const value = options.some((option) => option.value === token.value) ? token.value : fallback;
    return (
      <select
        value={value}
        className="rounded-full border-2 border-white/70 bg-white px-3 py-1 text-sm font-extrabold text-slate-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (editable) {
    return (
      <input
        type="text"
        value={token.label}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange?.(e.target.value)}
        className="inline-flex min-w-12 max-w-20 rounded-full border-2 border-white/70 bg-white px-2 py-1 text-center text-sm font-extrabold text-slate-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] outline-none"
      />
    );
  }

  return (
    <span className="inline-flex min-w-14 items-center justify-center rounded-full border-2 border-white/70 bg-white px-3 py-1 text-sm font-extrabold text-slate-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
      {token.label}
    </span>
  );
}

export default function LogicBlock({
  parts = [],
  tone = 'movement',
  selected,
  onClick,
  editable = false,
  onPartChange,
  compact = false,
  assetOptions = [],
  draggable = false,
  onDragStart,
  onDragEnd,
  className = '',
}) {
  const tones = {
    game: 'border-[#9f2556] bg-[#c12f69]',
    device: 'border-[#0f7a9a] bg-[#12a3cf]',
    collision: 'border-[#9e5f11] bg-[#cd7d16]',
    condition: 'border-[#4f46a5] bg-[#6366f1]',
    movement: 'border-[#cb431c] bg-[#eb5425]',
    looks: 'border-[#4d9518] bg-[#67b51f]',
    events: 'border-[#9f2556] bg-[#c12f69]',
    control: 'border-[#d39704] bg-[#f2b705]',
    sound: 'border-[#4d9518] bg-[#67b51f]',
    variables: 'border-[#e07f00] bg-[#f59d1a]',
  };

  const leftPill = {
    game: 'bg-[#ff86b4]',
    device: 'bg-[#9be9ff]',
    collision: 'bg-[#ffd39a]',
    condition: 'bg-[#c7c9ff]',
    movement: 'bg-[#ff8f6b]',
    looks: 'bg-[#aeea74]',
    events: 'bg-[#ff86b4]',
    control: 'bg-[#ffe28a]',
    sound: 'bg-[#aeea74]',
    variables: 'bg-[#ffd39a]',
  }[tone];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-[20px] border-b-4 px-4 py-2.5 text-left font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.16)] transition hover:brightness-105 ${
        tones[tone]
      } ${selected ? 'ring-4 ring-sky-200' : ''} ${compact ? 'text-base' : 'text-xl'} ${className}`}
    >
      <span className={`h-6 w-1.5 shrink-0 rounded-full ${leftPill} opacity-90`} />
      <span className="flex flex-wrap items-center gap-2 leading-none">
        {parts.map((part, idx) => (
          <Token
            key={idx}
            token={part}
            compact={compact}
            editable={editable}
            assetOptions={assetOptions}
            onChange={(value) => onPartChange?.(idx, value)}
          />
        ))}
      </span>
      <GripDots />
    </div>
  );
}
