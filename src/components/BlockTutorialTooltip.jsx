import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const blockTutorials = {
  'move-forward': 'Makes your character take a step to the right. \n Tip: If you use a negative number, your character will walk the other way!',
  turn: 'Spins your character.',
  'change-x': 'Moves your character sideways. Positive numbers move Right, and negative numbers move Left.',
  'change-y': 'Moves your character up and down. Positive numbers move Up, and negative numbers move Down.',
  'go-to': 'Teleports your character to a specific spot on the screen.',
  'point-direction': 'Points your character like a compass (Up, Down, Left, or Right).',
  flip: 'Makes your character instantly face the other way, like looking in a mirror.',
  'set-rotation': 'Decides if your character can spin in circles or just flip left and right.',
  bumps: 'Checks if two characters just bumped into each other - Boing!',
  touching: 'Checks if your character is currently overlapping with something else.',
  'not-touching': 'Checks if your character is standing all by themselves.',
  'cond-flipped': 'Checks if your character is facing the "opposite" way.',
  'cond-eq': 'Checks if two things are exactly the same.',
  'cond-neq': 'Checks if two things are different.',
  'cond-lt': 'Checks if the first number is smaller than the second.',
  'cond-gt': 'Checks if the first number is bigger than the second.',
  'cond-lte': 'Checks if a number is smaller or the same.',
  'cond-gte': 'Checks if a number is bigger or the same.',
  'cond-and': 'Only works if BOTH things are true (like needing shoes AND socks to go outside).',
  'cond-or': 'Works if EITHER one is true (like being allowed to wear a hat OR sunglasses).',
  'cond-not': 'The "Opposite Day" block! It flips True to False and False to True.',
  'cond-matches': 'Checks if two things match.',
  'switch-costume': 'Changes the object look.',
  'play-sound': 'Makes your game noisy!',
  say: 'Makes your character talk!',
  hide: 'Makes your character invisible.',
  show: 'Makes your character reappear on the screen.',
  forever: 'This block never stops! It repeats the code inside over and over until the game ends.',
  repeat: 'Does the code inside a specific number of times (like doing 5 jumping jacks).',
  while: 'Keeps doing something as long as a rule is being followed.',
  wait: 'Tells your character to take a quick nap before doing the next thing.',
  'change-score': 'Adds points to your total. \n Tip: A negative number will take points away!',
  'set-score': 'Resets your score to a specific number (usually zero to start over).',
  'change-time': 'Adds or removes time from your clock.',
  'set-time': 'Sets the timer to a specific starting time.',
  'set-alive': 'Tells the game if your character is still playing or if it is "Game Over."',
};

function getBlockTutorial(block) {
  return blockTutorials[block?.id] || 'This block tells your game what to do.';
}

function getTooltipPosition(rect) {
  const tooltipWidth = 224;
  const gap = 12;
  const padding = 16;
  const top = Math.min(
    window.innerHeight - padding - 80,
    Math.max(padding, rect.top + rect.height / 2),
  );

  let left = rect.right + gap;
  if (left + tooltipWidth > window.innerWidth - padding) {
    left = Math.max(padding, rect.left - tooltipWidth - gap);
  }

  return { top, left };
}

export default function BlockTutorialTooltip({ block, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(getTooltipPosition(rect));
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setIsOpen(false);
      }}
    >
      <div aria-describedby={tooltipId}>
        {children}
      </div>
      {isOpen ? createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-56 -translate-y-1/2 rounded-2xl border border-[#d7e3f4] bg-white px-4 py-3 text-sm font-semibold leading-5 text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.14)]"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
          {getBlockTutorial(block)}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
