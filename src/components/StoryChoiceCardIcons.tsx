import React from 'react';

/**
 * Renders crisp 50-yen, 10-yen, 5-yen, and 1-yen Japanese-style picture-book coins!
 * Uses 5-yen brass coins (with center hole!) so 6..9 ones never wrap onto 2 lines or stretch button heights.
 */
export const CoinStackVisual: React.FC<{
  amount: number;
  compact?: boolean;
}> = ({ amount, compact = false }) => {
  const safe = Math.max(0, Math.min(199, Math.floor(amount)));
  const fifties = safe >= 50 ? Math.floor(safe / 50) : 0;
  const rem50 = safe - fifties * 50;
  const tens = Math.floor(rem50 / 10);
  const rem10 = rem50 - tens * 10;
  const fives = Math.floor(rem10 / 5);
  const ones = rem10 % 5;

  if (safe === 0) {
    return (
      <span className="inline-flex h-5 items-center justify-center rounded-full border border-[#D4C8B4] bg-[#F5EFE4] px-2 text-[10px] font-bold text-[#7A6B58] tabular-nums">
        0えん
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-wrap items-center justify-end gap-1 ${
        compact ? 'max-w-[148px]' : 'max-w-[180px]'
      }`}
    >
      {Array.from({ length: Math.min(fifties, 3) }).map((_, i) => (
        <span
          key={`c50-${i}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#6B5344] bg-[#E5E8EC] text-[9px] font-extrabold text-[#3A3128] shadow-2xs tabular-nums"
        >
          50
        </span>
      ))}
      {Array.from({ length: Math.min(tens, 5) }).map((_, i) => (
        <span
          key={`c10-${i}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#6B5344] bg-[#DE8D58] text-[9px] font-extrabold text-white shadow-2xs tabular-nums"
        >
          10
        </span>
      ))}
      {Array.from({ length: fives }).map((_, i) => (
        <span
          key={`c5-${i}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#6B5344] bg-[#F5CB69] text-[9px] font-extrabold text-[#4B3618] shadow-2xs tabular-nums"
        >
          5
        </span>
      ))}
      {Array.from({ length: ones }).map((_, i) => (
        <span
          key={`c1-${i}`}
          className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border-[1.5px] border-[#6B5344] bg-[#F0F4F7] text-[9px] font-extrabold text-[#463325] shadow-2xs tabular-nums"
        >
          1
        </span>
      ))}
    </span>
  );
};

/**
 * Hand-crafted Japanese picture-book ("ひだまりとわかば") mini-illustrations for story,
 * interlude, trouble, trial impression, and recipient cards so 1st-graders never face plain text buttons.
 */
export const StoryChoiceIcon: React.FC<{
  label: string;
  indexHint?: number;
  size?: number;
}> = ({ label, indexHint = 0, size = 42 }) => {
  const kind = resolveChoiceVisualKind(label, indexHint);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="12"
        fill={kind.bg}
        stroke="#DFD2BC"
        strokeWidth="1.5"
      />

      {kind.icon === 'teacher_talk' && (
        <>
          <rect x="8" y="10" width="18" height="14" rx="2.5" fill="#4E8C6F" stroke="#6B5344" strokeWidth="1.8" />
          <line x1="11" y1="15" x2="22" y2="15" stroke="#FFFDF8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="11" y1="19" x2="18" y2="19" stroke="#FFFDF8" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="30" cy="24" r="5.5" fill="#FCE0C6" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M23 35C24 30 36 30 37 35" fill="#EE9860" stroke="#6B5344" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'chalkboard_write' && (
        <>
          <rect x="9" y="10" width="20" height="24" rx="3" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <line x1="13" y1="16" x2="24" y2="16" stroke="#A69888" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="13" y1="21" x2="22" y2="21" stroke="#A69888" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M24 27L33 15L36.5 18L27.5 30L23 31.5L24 27Z"
            fill="#68BE8D"
            stroke="#6B5344"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </>
      )}

      {kind.icon === 'book_read' && (
        <>
          <path
            d="M9 13C14 11 19 12 22 14.5C25 12 30 11 35 13V31C30 29.5 25 30 22 32.5C19 30 14 29.5 9 31V13Z"
            fill="#FFFDF8"
            stroke="#6B5344"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <line x1="22" y1="14.5" x2="22" y2="32" stroke="#6B5344" strokeWidth="1.7" />
          <circle cx="15.5" cy="21" r="2.8" fill="#F6B257" />
          <line x1="26" y1="19" x2="31.5" y2="19" stroke="#74BE8C" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="26" y1="23.5" x2="31.5" y2="23.5" stroke="#74BE8C" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'word_problem' && (
        <>
          <rect x="9" y="9" width="26" height="26" rx="5" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <circle cx="16.5" cy="18" r="4" fill="#EB6A5B" stroke="#6B5344" strokeWidth="1.5" />
          <path d="M24 18H30M27 15V21" stroke="#2F7A54" strokeWidth="2" strokeLinecap="round" />
          <line x1="13" y1="28" x2="31" y2="28" stroke="#D99B26" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'picture_diagram' && (
        <>
          <rect x="8" y="10" width="28" height="24" rx="4" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <circle cx="16" cy="17" r="3" fill="#F6BE68" />
          <path d="M10 30L18 22L24 27L29 21L34 30H10Z" fill="#74BE8C" stroke="#6B5344" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )}

      {kind.icon === 'favorite_star' && (
        <path
          d="M22 9L25.6 16.5L33.8 17.6L27.8 23.3L29.3 31.5L22 27.6L14.7 31.5L16.2 23.3L10.2 17.6L18.4 16.5L22 9Z"
          fill="#FCC668"
          stroke="#6B5344"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      )}

      {kind.icon === 'friends' && (
        <>
          <circle cx="16" cy="19" r="5.5" fill="#FCE0C6" stroke="#6B5344" strokeWidth="1.8" />
          <circle cx="28.5" cy="19" r="5.5" fill="#FFF2DC" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M9.5 33C10.5 27.5 21.5 27.5 22.5 33" fill="#74BE8C" stroke="#6B5344" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M22 33C23 27.5 34 27.5 35 33" fill="#F6A64C" stroke="#6B5344" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'slow_pace' && (
        <>
          <path d="M10 29H34" stroke="#6B5344" strokeWidth="2" strokeLinecap="round" />
          <circle cx="21" cy="22" r="7.5" fill="#A5DDD0" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M21 19A3 3 0 1 1 18.5 23.5" stroke="#6B5344" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="31" cy="24" r="3.5" fill="#FCE0C6" stroke="#6B5344" strokeWidth="1.7" />
        </>
      )}

      {kind.icon === 'draw_art' && (
        <>
          <ellipse cx="22" cy="23" rx="12" ry="10" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <circle cx="16.5" cy="20" r="2.4" fill="#EB6A5B" />
          <circle cx="22.5" cy="17.5" r="2.4" fill="#F6BE68" />
          <circle cx="27.5" cy="21" r="2.4" fill="#529E73" />
          <circle cx="24.5" cy="27" r="2" fill="#6B5344" />
        </>
      )}

      {kind.icon === 'play_outside' && (
        <>
          <circle cx="29" cy="14" r="5" fill="#F6BE68" />
          <path d="M8 31C14 25 30 25 36 31" fill="#8BC79E" stroke="#6B5344" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="23" r="5.5" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M14 20L19 26M20 20L14 26" stroke="#EB6A5B" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'video_game' && (
        <>
          <rect x="8" y="15" width="28" height="16" rx="7" fill="#8CD4C5" stroke="#6B5344" strokeWidth="1.9" />
          <path d="M14 23H19M16.5 20.5V25.5" stroke="#6B5344" strokeWidth="2" strokeLinecap="round" />
          <circle cx="27" cy="21.5" r="1.8" fill="#EB6A5B" />
          <circle cx="30.5" cy="24.5" r="1.8" fill="#F6BE68" />
        </>
      )}

      {kind.icon === 'sunny_good' && (
        <>
          <circle cx="22" cy="22" r="9.5" fill="#FDECC9" stroke="#E9A84A" strokeWidth="1.8" />
          <circle cx="19" cy="21" r="1.3" fill="#463325" />
          <circle cx="25" cy="21" r="1.3" fill="#463325" />
          <path d="M19 24.8Q22 27.5 25 24.8" stroke="#463325" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'clover_sprout' && (
        <>
          <path d="M22 32V21" stroke="#2F7A54" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="16.5" cy="19" rx="5.5" ry="3.8" transform="rotate(-20 16.5 19)" fill="#74BE8C" stroke="#6B5344" strokeWidth="1.7" />
          <ellipse cx="27.5" cy="19" rx="5.5" ry="3.8" transform="rotate(20 27.5 19)" fill="#4CA36E" stroke="#6B5344" strokeWidth="1.7" />
        </>
      )}

      {kind.icon === 'music_bell' && (
        <>
          <path
            d="M15 27H29L27 18C27 14 17 14 17 18L15 27Z"
            fill="#FCC668"
            stroke="#6B5344"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="22" cy="30" r="2.5" fill="#EB945E" stroke="#6B5344" strokeWidth="1.5" />
        </>
      )}

      {kind.icon === 'calm_cloud' && (
        <>
          <path
            d="M11 26.5C11 23 14 20.5 17.5 21C19.5 17 25.5 17 28 20.5C31.5 20.5 34 23 34 26C34 28.5 31.8 30 29 30H15C12.5 30 11 28.5 11 26.5Z"
            fill="#FFFDF8"
            stroke="#6B5344"
            strokeWidth="1.8"
          />
          <path d="M19.5 25.5Q22 27.2 24.5 25.5" stroke="#6B5344" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'tired_leaf' && (
        <>
          <path
            d="M13 28C13 18 25 12 32 14C31 23 24 31 13 28Z"
            fill="#BCE0C8"
            stroke="#6B5344"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M13 28L26 19" stroke="#2F7A54" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="30" cy="28" r="2.5" fill="#A5DDD0" />
        </>
      )}

      {kind.icon === 'question_mark' && (
        <>
          <circle cx="22" cy="22" r="11" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <path
            d="M19.2 18.5C19.6 16.5 24.5 16.3 24.5 19.2C24.5 21.2 22 21.6 22 23.6"
            stroke="#6B5344"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="22" cy="27.5" r="1.3" fill="#6B5344" />
        </>
      )}

      {kind.icon === 'pass_shield' && (
        <>
          <circle cx="22" cy="22" r="10.5" fill="#F5EFE4" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M17.5 22H26.5" stroke="#6B5344" strokeWidth="2.1" strokeLinecap="round" />
        </>
      )}

      {kind.icon === 'both_house_school' && (
        <>
          <polygon points="8,22 15,15 22,22" fill="#EB945E" stroke="#6B5344" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="10" y="22" width="10" height="9" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.6" />
          <polygon points="22,22 29,15 36,22" fill="#529E73" stroke="#6B5344" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="24" y="22" width="10" height="9" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.6" />
        </>
      )}

      {kind.icon === 'school_only' && (
        <>
          <polygon points="10,21 22,12 34,21" fill="#529E73" stroke="#6B5344" strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="13" y="21" width="18" height="12" rx="1.5" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <circle cx="22" cy="18" r="2.2" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.3" />
          <rect x="20" y="26" width="4" height="7" fill="#BCE0C8" stroke="#6B5344" strokeWidth="1.4" />
        </>
      )}

      {kind.icon === 'home_only' && (
        <>
          <polygon points="10,22 22,12 34,22" fill="#EB945E" stroke="#6B5344" strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="13" y="22" width="18" height="11" rx="1.5" fill="#FFFDF8" stroke="#6B5344" strokeWidth="1.8" />
          <rect x="20" y="26" width="4.5" height="7" fill="#EBB47B" stroke="#6B5344" strokeWidth="1.4" />
        </>
      )}

      {kind.icon === 'keep_private' && (
        <>
          <rect x="14" y="20" width="16" height="12" rx="3" fill="#F6D8AE" stroke="#6B5344" strokeWidth="1.8" />
          <path d="M17.5 20V16.5C17.5 13.5 26.5 13.5 26.5 16.5V20" stroke="#6B5344" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="22" cy="26" r="1.6" fill="#6B5344" />
        </>
      )}
    </svg>
  );
};

type IconVariant =
  | 'teacher_talk'
  | 'chalkboard_write'
  | 'book_read'
  | 'word_problem'
  | 'picture_diagram'
  | 'favorite_star'
  | 'friends'
  | 'slow_pace'
  | 'draw_art'
  | 'play_outside'
  | 'video_game'
  | 'sunny_good'
  | 'clover_sprout'
  | 'music_bell'
  | 'calm_cloud'
  | 'tired_leaf'
  | 'question_mark'
  | 'pass_shield'
  | 'both_house_school'
  | 'school_only'
  | 'home_only'
  | 'keep_private';

function resolveChoiceVisualKind(
  rawLabel: string,
  indexHint = 0
): { icon: IconVariant; bg: string } {
  const s = rawLabel;
  if (s.includes('せんせいと') && s.includes('おうち')) {
    return { icon: 'both_house_school', bg: '#EDF7F0' };
  }
  if (s.includes('せんせいだけ')) {
    return { icon: 'school_only', bg: '#EDF7F0' };
  }
  if (
    s.includes('おうちの ひとだけ') ||
    s.includes('おうちの こと') ||
    s.includes('いえで こまって')
  ) {
    return { icon: 'home_only', bg: '#FFF5E8' };
  }
  if (s.includes('だれにも いわない')) {
    return { icon: 'keep_private', bg: '#F6F1E7' };
  }
  if (s.includes('わからない') && !s.includes('べんきょう')) {
    return { icon: 'question_mark', bg: '#F7F3EB' };
  }
  if (s.includes('こたえたくない') || s.includes('こたえなくて')) {
    return { icon: 'pass_shield', bg: '#F5EFE4' };
  }
  if (s.includes('とくに ない')) {
    return { icon: 'calm_cloud', bg: '#EFF8F2' };
  }
  if (s.includes('せんせいの おはなし') || s.includes('こえ') || s.includes('きく')) {
    return { icon: 'teacher_talk', bg: '#EDF7F0' };
  }
  if (s.includes('かく') || s.includes('こくばん') || s.includes('べんきょう') || s.includes('ノート')) {
    return { icon: 'chalkboard_write', bg: '#FFF7EA' };
  }
  if (s.includes('よむ') || s.includes('きょうかしょ') || s.includes('もじ') || s.includes('ながい')) {
    return { icon: 'book_read', bg: '#EEF7F4' };
  }
  if (s.includes('ぶんしょう') || s.includes('むずかし') || s.includes('かず') || s.includes('けいさん')) {
    return { icon: 'word_problem', bg: '#FFF3EC' };
  }
  if (s.includes('え や ず') || s.includes('えが ある') || s.includes('みせて')) {
    return { icon: 'picture_diagram', bg: '#EDF7F0' };
  }
  if (s.includes('えを かく') || s.includes('つくる') || s.includes('こうさく')) {
    return { icon: 'draw_art', bg: '#FFF6EB' };
  }
  if (s.includes('そと') || s.includes('うんどう') || s.includes('はしる')) {
    return { icon: 'play_outside', bg: '#ECF8EF' };
  }
  if (s.includes('ゲーム') || s.includes('タブレット') || s.includes('どうが')) {
    return { icon: 'video_game', bg: '#ECF7F6' };
  }
  if (s.includes('ともだち') || s.includes('みんな') || s.includes('いっしょ')) {
    return { icon: 'friends', bg: '#FFF6EA' };
  }
  if (s.includes('ゆっくり') || s.includes('じかん') || s.includes('やすむ')) {
    return { icon: 'slow_pace', bg: '#EEF8F5' };
  }
  if (s.includes('つかれる') || s.includes('いやだった') || s.includes('うるさい')) {
    return { icon: 'tired_leaf', bg: '#F5F7F0' };
  }
  if (s.includes('おんがく') || s.includes('うた')) {
    return { icon: 'music_bell', bg: '#FFF8E6' };
  }
  if (s.includes('よかった') || s.includes('たのしい') || s.includes('すき')) {
    return { icon: 'favorite_star', bg: '#FFF8E6' };
  }

  // Distinct fallbacks for dynamic Gemini followup choices so 4 options never share the exact same icon!
  const fallbacks: Array<{ icon: IconVariant; bg: string }> = [
    { icon: 'clover_sprout', bg: '#EDF7F0' },
    { icon: 'sunny_good', bg: '#FFF8EC' },
    { icon: 'music_bell', bg: '#FFF5E8' },
    { icon: 'favorite_star', bg: '#FFF9E6' },
  ];
  return fallbacks[Math.abs(indexHint) % fallbacks.length];
}
