import React from 'react';

export interface GachaCollectibleItem {
  id: string;
  name: string;
  seriesLabel: string;
  rarity: 1 | 2 | 3;
  description: string;
  capsuleTopHex: string;
  capsuleBottomHex: string;
  bgTintHex: string;
}

export const GACHA_SPIN_COST = 30;

export const GACHA_CATALOG: GachaCollectibleItem[] = [
  {
    id: 'zukan_01_clover_badge',
    name: 'よつばの わかばバッジ',
    seriesLabel: 'ひだまりの たからもの',
    rarity: 1,
    description: 'たんけんの はじまりを おいわいする、やさしい みどりの バッジ。',
    capsuleTopHex: '#5FA87A',
    capsuleBottomHex: '#FFFDF8',
    bgTintHex: '#ECF6EF',
  },
  {
    id: 'zukan_02_acorn_whistle',
    name: 'どんぐりの きぶえ',
    seriesLabel: 'ひだまりの たからもの',
    rarity: 1,
    description: 'もりの どうぶつたちに あいずを おくれる ちいさな ふえ。',
    capsuleTopHex: '#D88B4B',
    capsuleBottomHex: '#FFFDF8',
    bgTintHex: '#FDF2E4',
  },
  {
    id: 'zukan_03_sun_compass',
    name: 'おひさま コンパス',
    seriesLabel: 'ひだまりの たからもの',
    rarity: 1,
    description: 'あたたかい ひだまりの ほうこうを おしえてくれる コンパス。',
    capsuleTopHex: '#E8A838',
    capsuleBottomHex: '#FFFDF8',
    bgTintHex: '#FEF6E2',
  },
  {
    id: 'zukan_04_cloud_eraser',
    name: 'ふわふわ くもけしゴム',
    seriesLabel: 'ひだまりの たからもの',
    rarity: 1,
    description: 'おそらの うえに うかぶ わたぐもみたいな けしゴム。',
    capsuleTopHex: '#76B5C5',
    capsuleBottomHex: '#FFFDF8',
    bgTintHex: '#EAF5F8',
  },
  {
    id: 'zukan_05_berry_tart',
    name: 'きいちごの ミニタルト',
    seriesLabel: 'まちの おみせ ずかん',
    rarity: 1,
    description: 'おかいものよこちょうの パンやさんで いちばん にんきの おやつ。',
    capsuleTopHex: '#E57A77',
    capsuleBottomHex: '#FFF8EC',
    bgTintHex: '#FDEEEE',
  },
  {
    id: 'zukan_06_melon_bun',
    name: 'やきたて メロンパン',
    seriesLabel: 'まちの おみせ ずかん',
    rarity: 1,
    description: 'さっくり あまい においが まちじゅうに ひろがる メロンパン。',
    capsuleTopHex: '#DFB44B',
    capsuleBottomHex: '#FFF8EC',
    bgTintHex: '#FDF7E4',
  },
  {
    id: 'zukan_07_colored_pencils',
    name: 'にじいろ えんぴつセット',
    seriesLabel: 'まちの おみせ ずかん',
    rarity: 2,
    description: 'ぶんぼうぐやさんの たなで きらりと ひかる 3ぼんセット。',
    capsuleTopHex: '#5FA87A',
    capsuleBottomHex: '#FDF2E4',
    bgTintHex: '#EEF7F0',
  },
  {
    id: 'zukan_08_honey_jar',
    name: 'れんげの はちみつビン',
    seriesLabel: 'まちの おみせ ずかん',
    rarity: 2,
    description: 'くまさんが たいせつに あつめた とろり あまい はちみつ。',
    capsuleTopHex: '#E8A838',
    capsuleBottomHex: '#FDF2E4',
    bgTintHex: '#FEF5DF',
  },
  {
    id: 'zukan_09_post_satchel',
    name: 'おてがみ ゆうびんかばん',
    seriesLabel: 'どうぶつ ゆうびん ずかん',
    rarity: 2,
    description: 'しょうたいじょうを ぴったり とどける かわの ちいさな かばん。',
    capsuleTopHex: '#C86428',
    capsuleBottomHex: '#FAF5EC',
    bgTintHex: '#FBEFE6',
  },
  {
    id: 'zukan_10_rabbit_stamp',
    name: 'うさぎさんの 記念きって',
    seriesLabel: 'どうぶつ ゆうびん ずかん',
    rarity: 2,
    description: 'あかい やねの おうちが えがかれた とくべつな きって。',
    capsuleTopHex: '#E57A77',
    capsuleBottomHex: '#FAF5EC',
    bgTintHex: '#FCEEEE',
  },
  {
    id: 'zukan_11_owl_lantern',
    name: 'ふくろうの ほしランプ',
    seriesLabel: 'どうぶつ ゆうびん ずかん',
    rarity: 2,
    description: 'ゆうぐれの かえりみちを やさしく てらす ガラスの ランプ。',
    capsuleTopHex: '#6F9CEB',
    capsuleBottomHex: '#FAF5EC',
    bgTintHex: '#ECF2FC',
  },
  {
    id: 'zukan_12_squirrel_bell',
    name: 'りすさんの りんりんベル',
    seriesLabel: 'どうぶつ ゆうびん ずかん',
    rarity: 2,
    description: 'おとどけものが きたことを きれいな おとで しらせる ベル。',
    capsuleTopHex: '#529E72',
    capsuleBottomHex: '#FAF5EC',
    bgTintHex: '#EAF6EE',
  },
  {
    id: 'zukan_13_wakaba_crown',
    name: 'わかばの おはなカンムリ',
    seriesLabel: 'おまつり スペシャル',
    rarity: 3,
    description: 'しろい こばなと わかばで あんだ、おまつりひろばの カンムリ。',
    capsuleTopHex: '#2F7A54',
    capsuleBottomHex: '#FFEAB6',
    bgTintHex: '#E8F5EC',
  },
  {
    id: 'zukan_14_music_box',
    name: 'ひだまりの オルゴール',
    seriesLabel: 'おまつり スペシャル',
    rarity: 3,
    description: 'ぜんまいを まわすと まちの メロディが ながれる きの オルゴール。',
    capsuleTopHex: '#C86428',
    capsuleBottomHex: '#FFEAB6',
    bgTintHex: '#FCF0E3',
  },
  {
    id: 'zukan_15_rainbow_balloon',
    name: 'そらとぶ 気球ミニチュア',
    seriesLabel: 'おまつり スペシャル',
    rarity: 3,
    description: 'がっこうたんけんの まちが ぜんぶ みわたせる しましま気球。',
    capsuleTopHex: '#E07A5F',
    capsuleBottomHex: '#FFEAB6',
    bgTintHex: '#FDF0EB',
  },
  {
    id: 'zukan_16_golden_sprout_medal',
    name: 'かがやく わかばメダル',
    seriesLabel: 'おまつり スペシャル',
    rarity: 3,
    description: 'じぶんの ペースで たんけんした みんなに おくられる メダル。',
    capsuleTopHex: '#D99B26',
    capsuleBottomHex: '#FFEAB6',
    bgTintHex: '#FEF7DF',
  },
];

/**
 * Selects a collectible from the catalog, strongly favoring uncollected items (80%)
 * so children reliably discover new Zukan stickers without frustrating duplicates.
 */
export function rollGachaCollectible(unlockedIds: string[]): {
  item: GachaCollectibleItem;
  isNew: boolean;
} {
  const unlockedSet = new Set(unlockedIds);
  const locked = GACHA_CATALOG.filter((it) => !unlockedSet.has(it.id));

  const pool = locked.length > 0 && Math.random() < 0.82 ? locked : GACHA_CATALOG;
  // Weighted slightly by rarity while keeping tier 3 genuinely attainable
  const weighted: GachaCollectibleItem[] = [];
  for (const it of pool) {
    const copies = it.rarity === 1 ? 4 : it.rarity === 2 ? 3 : 2;
    for (let i = 0; i < copies; i++) weighted.push(it);
  }
  const picked = weighted[Math.floor(Math.random() * weighted.length)] || GACHA_CATALOG[0];
  return {
    item: picked,
    isNew: !unlockedSet.has(picked.id),
  };
}

/**
 * Hand-crafted flat Japanese picture-book SVG illustration for each collectible item.
 */
export const GachaItemArtwork: React.FC<{ itemId: string; size?: number }> = ({
  itemId,
  size = 68,
}) => {
  const stroke = '#5A4635';
  switch (itemId) {
    case 'zukan_01_clover_badge':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#FFFDF8" stroke={stroke} strokeWidth="2.5" />
          <circle cx="32" cy="22" r="7" fill="#5FA87A" stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="40" r="7" fill="#5FA87A" stroke={stroke} strokeWidth="2.2" />
          <circle cx="23" cy="31" r="7" fill="#74BA8D" stroke={stroke} strokeWidth="2.2" />
          <circle cx="41" cy="31" r="7" fill="#74BA8D" stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="31" r="3.5" fill="#F2C14E" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'zukan_02_acorn_whistle':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M20 28C20 19 44 19 44 28H20Z" fill="#9C6334" stroke={stroke} strokeWidth="2.5" />
          <path
            d="M22 28H42V38C42 46 36 51 32 52C28 51 22 46 22 38V28Z"
            fill="#DC9856"
            stroke={stroke}
            strokeWidth="2.5"
          />
          <rect x="29" y="13" width="6" height="7" rx="3" fill="#9C6334" stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="37" r="3" fill={stroke} />
        </svg>
      );
    case 'zukan_03_sun_compass':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="34" r="21" fill="#F2C14E" stroke={stroke} strokeWidth="2.5" />
          <circle cx="32" cy="34" r="16" fill="#FFFDF8" stroke={stroke} strokeWidth="2.2" />
          <polygon points="32,21 36,34 32,31 28,34" fill="#E06D53" stroke={stroke} strokeWidth="1.8" />
          <polygon points="32,47 36,34 32,37 28,34" fill="#5FA87A" stroke={stroke} strokeWidth="1.8" />
          <circle cx="32" cy="10" r="4" fill="none" stroke={stroke} strokeWidth="2.4" />
        </svg>
      );
    case 'zukan_04_cloud_eraser':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="14" y="26" width="22" height="20" rx="5" fill="#76B5C5" stroke={stroke} strokeWidth="2.5" />
          <path
            d="M32 25C33 20 39 19 42 22C46 20 52 24 50 30C53 33 51 40 46 41H32V25Z"
            fill="#FFFDF8"
            stroke={stroke}
            strokeWidth="2.5"
          />
          <circle cx="40" cy="31" r="1.8" fill={stroke} />
          <circle cx="46" cy="31" r="1.8" fill={stroke} />
          <path d="M41 35Q43 37 45 35" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'zukan_05_berry_tart':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M14 36H50L45 49H19L14 36Z" fill="#E5AE6B" stroke={stroke} strokeWidth="2.5" />
          <path d="M16 36C16 29 48 29 48 36H16Z" fill="#FFF8E6" stroke={stroke} strokeWidth="2.2" />
          <circle cx="26" cy="27" r="6" fill="#E56B6F" stroke={stroke} strokeWidth="2.2" />
          <circle cx="38" cy="27" r="6" fill="#E56B6F" stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="21" r="6.5" fill="#EA5455" stroke={stroke} strokeWidth="2.2" />
          <path d="M29 14L32 17L35 14" stroke="#3F8E63" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'zukan_06_melon_bun':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path
            d="M13 40C13 24 22 17 32 17C42 17 51 24 51 40C51 45 46 48 32 48C18 48 13 45 13 40Z"
            fill="#F3CA63"
            stroke={stroke}
            strokeWidth="2.5"
          />
          <path d="M21 22L41 46M31 18L48 39M16 30L31 47" stroke="#BA8530" strokeWidth="2" />
          <path d="M43 22L23 46M33 18L16 39M48 30L33 47" stroke="#BA8530" strokeWidth="2" />
        </svg>
      );
    case 'zukan_07_colored_pencils':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          {[
            { x: 16, fill: '#E57A77' },
            { x: 28, fill: '#F2C14E' },
            { x: 40, fill: '#5FA87A' },
          ].map((p) => (
            <g key={p.x}>
              <rect x={p.x} y="24" width="8" height="27" rx="2" fill={p.fill} stroke={stroke} strokeWidth="2.2" />
              <polygon points={`${p.x},24 ${p.x + 4},13 ${p.x + 8},24`} fill="#FDE6C4" stroke={stroke} strokeWidth="2.2" />
              <polygon points={`${p.x + 2},18 ${p.x + 4},13 ${p.x + 6},18`} fill={p.fill} />
            </g>
          ))}
        </svg>
      );
    case 'zukan_08_honey_jar':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="19" y="23" width="26" height="28" rx="8" fill="#F4B942" stroke={stroke} strokeWidth="2.5" />
          <rect x="21" y="16" width="22" height="7" rx="3" fill="#74BA8D" stroke={stroke} strokeWidth="2.5" />
          <rect x="23" y="32" width="18" height="10" rx="3" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="37" r="2.5" fill="#E89923" />
        </svg>
      );
    case 'zukan_09_post_satchel':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M22 22C22 14 42 14 42 22" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
          <rect x="14" y="22" width="36" height="26" rx="6" fill="#D57A44" stroke={stroke} strokeWidth="2.5" />
          <path d="M14 25L32 36L50 25" fill="#E3925F" stroke={stroke} strokeWidth="2.3" />
          <rect x="29" y="33" width="6" height="7" rx="2" fill="#F5CC5C" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'zukan_10_rabbit_stamp':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect
            x="16"
            y="14"
            width="32"
            height="36"
            rx="3"
            fill="#FFFDF8"
            stroke={stroke}
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
          <rect x="21" y="19" width="22" height="26" rx="2" fill="#FCE4E4" />
          <ellipse cx="29" cy="27" rx="2.5" ry="6" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <ellipse cx="35" cy="27" rx="2.5" ry="6" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="36" r="7" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <circle cx="30" cy="35" r="1.3" fill={stroke} />
          <circle cx="34" cy="35" r="1.3" fill={stroke} />
        </svg>
      );
    case 'zukan_11_owl_lantern':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M25 16C25 11 39 11 39 16" stroke={stroke} strokeWidth="2.5" />
          <polygon points="21,22 43,22 47,45 17,45" fill="#FFF4C7" stroke={stroke} strokeWidth="2.5" />
          <rect x="19" y="18" width="26" height="5" rx="2" fill="#5D7FA3" stroke={stroke} strokeWidth="2.2" />
          <rect x="16" y="45" width="32" height="6" rx="2" fill="#5D7FA3" stroke={stroke} strokeWidth="2.2" />
          <path d="M32 28L34 33L39 33.5L35 37L36.5 42L32 39L27.5 42L29 37L25 33.5L30 33Z" fill="#F2B138" />
        </svg>
      );
    case 'zukan_12_squirrel_bell':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="29" y="12" width="6" height="10" rx="3" fill="#A66B3E" stroke={stroke} strokeWidth="2.2" />
          <path
            d="M18 44C18 29 23 22 32 22C41 22 46 29 46 44H18Z"
            fill="#F3C44E"
            stroke={stroke}
            strokeWidth="2.5"
          />
          <circle cx="32" cy="47" r="4.5" fill="#E08E36" stroke={stroke} strokeWidth="2.2" />
        </svg>
      );
    case 'zukan_13_wakaba_crown':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <ellipse cx="32" cy="34" rx="19" ry="13" stroke="#4D9B6B" strokeWidth="6" />
          <ellipse cx="32" cy="34" rx="19" ry="13" stroke={stroke} strokeWidth="2.2" />
          <circle cx="20" cy="27" r="4.5" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="21" r="5" fill="#FFE38E" stroke={stroke} strokeWidth="2" />
          <circle cx="44" cy="27" r="4.5" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
          <circle cx="25" cy="45" r="4" fill="#FFD1C9" stroke={stroke} strokeWidth="2" />
          <circle cx="39" cy="45" r="4" fill="#FFD1C9" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'zukan_14_music_box':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <rect x="14" y="28" width="32" height="22" rx="4" fill="#D58A52" stroke={stroke} strokeWidth="2.5" />
          <path d="M14 28L22 17H50L46 28H14Z" fill="#F6DFB7" stroke={stroke} strokeWidth="2.4" />
          <path d="M46 39H53V33" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="53" cy="32" r="2.5" fill="#F2C14E" stroke={stroke} strokeWidth="2" />
          <circle cx="27" cy="39" r="4" fill="#FFFDF8" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'zukan_15_rainbow_balloon':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="26" r="15" fill="#F2C14E" stroke={stroke} strokeWidth="2.5" />
          <path d="M32 11C26 16 26 36 32 41C38 36 38 16 32 11Z" fill="#E57A77" stroke={stroke} strokeWidth="2" />
          <path d="M26 41L28 47M38 41L36 47" stroke={stroke} strokeWidth="2" />
          <rect x="26" y="47" width="12" height="8" rx="2" fill="#B57B4C" stroke={stroke} strokeWidth="2.2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <polygon points="24,12 32,26 40,12" fill="#5FA87A" stroke={stroke} strokeWidth="2.3" />
          <circle cx="32" cy="37" r="15" fill="#F5C445" stroke={stroke} strokeWidth="2.5" />
          <path d="M32 29C27 29 25 34 32 39C39 34 37 29 32 29Z" fill="#469668" stroke={stroke} strokeWidth="2" />
        </svg>
      );
  }
};
