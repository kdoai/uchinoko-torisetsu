import React from 'react';
import type { DeliveryNodeSpec, ShoppingItemIconKey } from '../data/gameBank';

/**
 * Hand-crafted Flat Japanese Picture-Book Vector Illustration ("ひだまりとわかば")
 * Clean uniform ink linework (#6B5344), flat matte paper colors, no AI raster/airbrush gloss.
 * Depicts Home (left), Momo on the connecting footpath (center), and School (right).
 */
export const SunriseSproutIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    className={`w-full max-w-[500px] overflow-hidden rounded-[26px] border border-[#E8DEC8] bg-[#FFF9EE] shadow-[0_6px_20px_rgba(107,83,68,0.06)] ${className}`}
  >
    <svg
      viewBox="0 0 480 236"
      fill="none"
      aria-label="おうちと学校をつなぐ小道と、案内キャラクターのモモのイラスト"
      className="block h-auto w-full"
    >
      {/* Warm Matte Paper Sky */}
      <rect width="480" height="236" fill="#FFF9EE" />

      {/* Flat Picture-Book Morning Sun */}
      <g transform="translate(396, 52)">
        <circle cx="0" cy="0" r="32" fill="#FDECC9" />
        <circle cx="0" cy="0" r="19" fill="#F6BE68" />
        <g stroke="#E9A84A" strokeWidth="2.4" strokeLinecap="round">
          <line x1="0" y1="-26" x2="0" y2="-31" />
          <line x1="0" y1="26" x2="0" y2="31" />
          <line x1="-26" y1="0" x2="-31" y2="0" />
          <line x1="26" y1="0" x2="31" y2="0" />
          <line x1="-18.5" y1="-18.5" x2="-22" y2="-22" />
          <line x1="18.5" y1="-18.5" x2="22" y2="-22" />
          <line x1="-18.5" y1="18.5" x2="-22" y2="22" />
          <line x1="18.5" y1="18.5" x2="22" y2="22" />
        </g>
      </g>

      {/* Simple Flat Clouds */}
      <path
        d="M70 58C70 50 77 44 85 45C89 37 101 36 108 42C116 41 123 47 123 54C123 60 118 64 112 64H78C73 64 70 61 70 58Z"
        fill="#FFFFFF"
      />
      <path
        d="M192 42C192 36 197 32 203 33C207 28 215 27 220 31C226 30 231 35 231 40C231 44 227 47 222 47H198C194 47 192 45 192 42Z"
        fill="#FFFFFF"
      />
      <path
        d="M294 64C294 59 299 55 304 56C307 51 314 51 319 54C324 54 328 57 328 62C328 66 325 68 320 68H300C296 68 294 66 294 64Z"
        fill="#FFFFFF"
      />

      {/* Gentle Layered Botanical Hills */}
      <path
        d="M0 158C88 128 182 132 268 156C346 177 414 152 480 138V236H0V158Z"
        fill="#E2F1E5"
      />
      <path
        d="M0 180C112 154 224 162 342 178C404 186 446 176 480 168V236H0V180Z"
        fill="#C9E5D0"
      />

      {/* Cream Footpath Connecting Home (Left) -> Momo (Center) -> School (Right) */}
      <path
        d="M95 162C118 184 134 202 188 208C242 214 282 212 332 200C368 191 378 176 392 162"
        stroke="#FFFDF7"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M95 162C118 184 134 202 188 208C242 214 282 212 332 200C368 191 378 176 392 162"
        stroke="#E9DEC9"
        strokeWidth="1.6"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />

      {/* Left Hill: Cozy Home ("家庭") */}
      <g transform="translate(52, 96)">
        {/* Soft Bush Behind */}
        <circle cx="8" cy="58" r="9" fill="#8BC79E" />
        <circle cx="72" cy="59" r="8" fill="#8BC79E" />
        {/* Chimney */}
        <rect x="17" y="8" width="9" height="16" rx="1.5" fill="#DF834E" stroke="#6B5344" strokeWidth="2" />
        {/* Terracotta Roof */}
        <path
          d="M6 34L40 9L74 34H6Z"
          fill="#EB945E"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* House Body */}
        <rect x="14" y="34" width="52" height="33" rx="3" fill="#FFFDF9" stroke="#6B5344" strokeWidth="2" />
        {/* Arched Wooden Door */}
        <path
          d="M43 67V49C43 44.5 55 44.5 55 49V67H43Z"
          fill="#EBB47B"
          stroke="#6B5344"
          strokeWidth="1.8"
        />
        <circle cx="51.8" cy="57.5" r="1.2" fill="#6B5344" />
        {/* Warm Window */}
        <rect x="21" y="43" width="14" height="13" rx="2" fill="#FFF2CE" stroke="#6B5344" strokeWidth="1.8" />
        <line x1="28" y1="43" x2="28" y2="56" stroke="#6B5344" strokeWidth="1.4" />
        <line x1="21" y1="49.5" x2="35" y2="49.5" stroke="#6B5344" strokeWidth="1.4" />
      </g>

      {/* Right Hill: Friendly Schoolhouse ("学校") */}
      <g transform="translate(348, 92)">
        {/* Soft Bush Behind */}
        <circle cx="8" cy="62" r="8" fill="#8BC79E" />
        <circle cx="76" cy="61" r="9" fill="#8BC79E" />
        {/* Small Roof Belfry */}
        <rect x="35" y="4" width="14" height="12" rx="1.5" fill="#FFFDF9" stroke="#6B5344" strokeWidth="1.8" />
        <path d="M32 6L42 -1L52 6H32Z" fill="#3D8B63" stroke="#6B5344" strokeWidth="1.8" strokeLinejoin="round" />
        {/* Sage Roof */}
        <path
          d="M6 36L42 12L78 36H6Z"
          fill="#529E73"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* School Body */}
        <rect x="13" y="36" width="58" height="35" rx="3" fill="#FFFDF9" stroke="#6B5344" strokeWidth="2" />
        {/* School Clock */}
        <circle cx="42" cy="28" r="6" fill="#FFFDF9" stroke="#6B5344" strokeWidth="1.7" />
        <path d="M42 24.8V28H44.6" stroke="#6B5344" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Entrance Doors */}
        <rect x="35" y="51" width="14" height="20" rx="1.5" fill="#BCE0C8" stroke="#6B5344" strokeWidth="1.8" />
        <line x1="42" y1="51" x2="42" y2="71" stroke="#6B5344" strokeWidth="1.5" />
        {/* Classroom Windows */}
        <rect x="19" y="46" width="10" height="11" rx="1.5" fill="#E8F4F2" stroke="#6B5344" strokeWidth="1.6" />
        <rect x="55" y="46" width="10" height="11" rx="1.5" fill="#E8F4F2" stroke="#6B5344" strokeWidth="1.6" />
      </g>

      {/* Center Character: Picture-Book "Momo" (Simple, matte, Japanese ehon golden-ratio face) */}
      <g transform="translate(190, 74)">
        {/* Subtle Ground Shadow */}
        <ellipse cx="50" cy="128" rx="27" ry="5" fill="#B2D6BC" />

        {/* Little Feet */}
        <ellipse cx="41" cy="124.5" rx="5.5" ry="3.8" fill="#FCE0C6" stroke="#6B5344" strokeWidth="2.1" />
        <ellipse cx="59" cy="124.5" rx="5.5" ry="3.8" fill="#FCE0C6" stroke="#6B5344" strokeWidth="2.1" />

        {/* Left Resting Arm & Right Friendly Waving Arm */}
        <path
          d="M30 89C21 91 18 98 22 102C25 104.5 29 103 31 99Z"
          fill="#FFF8F0"
          stroke="#6B5344"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M70 88C77 81 84 83 82 90C81 94.5 75 96.5 70 95Z"
          fill="#FFF8F0"
          stroke="#6B5344"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />

        {/* Cozy Peach-Apricot A-Line Smock (Top edge tucked cleanly behind head) */}
        <path
          d="M31 77C26 92 24 111 27 120C35 123 65 123 73 120C76 111 74 92 69 77H31Z"
          fill="#FAD8BC"
          stroke="#6B5344"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Crisp White Rounded Peter-Pan Collar (Top tucked cleanly behind chin) */}
        <path
          d="M33 80C33 92 46 93 50 86.5C54 93 67 92 67 80H33Z"
          fill="#FFFFFF"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Twin Wakaba Sprout on Top */}
        <path d="M50 36.5V26" stroke="#6B5344" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M50 28C44 18 30 18 27 26C25 33 39 36 50 30Z"
          fill="#74BE8C"
          stroke="#6B5344"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M50 28C56 18 70 18 73 26C75 33 61 36 50 30Z"
          fill="#3E8E63"
          stroke="#6B5344"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />

        {/* Soft Omochi Horizontal-Oval Head */}
        <ellipse
          cx="50"
          cy="61"
          rx="30"
          ry="25.5"
          fill="#FFF8F0"
          stroke="#6B5344"
          strokeWidth="2.2"
        />

        {/* Matte Soft Coral-Peach Cheeks (No anime slash lines) */}
        <ellipse cx="29.5" cy="68" rx="5.6" ry="3.6" fill="#F6B9A8" />
        <ellipse cx="70.5" cy="68" rx="5.6" ry="3.6" fill="#F6B9A8" />

        {/* Calm Japanese Picture-Book Oval Eyes (Low-set golden ratio) */}
        <ellipse cx="38.5" cy="63.5" rx="3.1" ry="3.8" fill="#463325" />
        <circle cx="37.6" cy="62.1" r="1" fill="#FFFDF9" />

        <ellipse cx="61.5" cy="63.5" rx="3.1" ry="3.8" fill="#463325" />
        <circle cx="60.6" cy="62.1" r="1" fill="#FFFDF9" />

        {/* Small Gentle Smile Nestled Near Eye Level */}
        <path
          d="M46.2 67.2Q50 70.8 53.8 67.2"
          stroke="#463325"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>

      {/* Simple Flat Sprouts & 4-Petaled Meadow Flowers */}
      <g transform="translate(148, 186)">
        <path d="M8 14V6" stroke="#3E8E63" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="4.5" cy="7" rx="3.8" ry="2.3" transform="rotate(-20 4.5 7)" fill="#74BE8C" />
        <ellipse cx="11.5" cy="7" rx="3.8" ry="2.3" transform="rotate(20 11.5 7)" fill="#3E8E63" />
      </g>
      <g transform="translate(316, 184)">
        <path d="M8 14V6" stroke="#3E8E63" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="4.5" cy="7" rx="3.8" ry="2.3" transform="rotate(-20 4.5 7)" fill="#74BE8C" />
        <ellipse cx="11.5" cy="7" rx="3.8" ry="2.3" transform="rotate(20 11.5 7)" fill="#3E8E63" />
      </g>

      {/* Tiny Simple Meadow Blossoms */}
      <g transform="translate(72, 198)">
        <circle cx="0" cy="-4" r="3" fill="#FFFFFF" />
        <circle cx="4" cy="0" r="3" fill="#FFFFFF" />
        <circle cx="0" cy="4" r="3" fill="#FFFFFF" />
        <circle cx="-4" cy="0" r="3" fill="#FFFFFF" />
        <circle cx="0" cy="0" r="2.4" fill="#F6BE68" />
      </g>
      <g transform="translate(412, 196)">
        <circle cx="0" cy="-4" r="3" fill="#FFFFFF" />
        <circle cx="4" cy="0" r="3" fill="#FFFFFF" />
        <circle cx="0" cy="4" r="3" fill="#FFFFFF" />
        <circle cx="-4" cy="0" r="3" fill="#FFFFFF" />
        <circle cx="0" cy="0" r="2.4" fill="#F6BE68" />
      </g>
      <circle cx="104" cy="212" r="3" fill="#F8CE78" />
      <circle cx="380" cy="210" r="3" fill="#F8CE78" />
    </svg>
  </div>
);

/**
 * Hand-crafted Flat Picture-Book "Momo" Avatar
 * Matches the clean, non-AI Japanese picture-book proportions of SunriseSproutIllustration:
 * flat matte tones, uniform #6B5344 ink stroke, soft horizontal omochi face, Peter-Pan collar smock,
 * calm low-set oval eyes, and understated smile.
 */
export const MomoAvatar: React.FC<{
  mood?: 'cheerful' | 'listening' | 'gentle';
  size?: number;
}> = ({ mood = 'cheerful', size = 68 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      fill="none"
      aria-label="案内キャラクター モモ"
      className="shrink-0"
    >
      {/* Subtle Warm Circular Backdrop */}
      <circle cx="44" cy="46" r="38" fill="#FFF6E8" stroke="#EFE2CC" strokeWidth="1.5" />

      {/* Mitten Arms */}
      <path
        d="M28 60C20 62 18 68 22 71C25 73 27 71 28 68Z"
        fill="#FFF8F0"
        stroke="#6B5344"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {mood === 'cheerful' ? (
        <path
          d="M60 59C66 52 72 54 70 60C69 64 64 66 60 65Z"
          fill="#FFF8F0"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M60 60C68 62 70 68 66 71C63 73 61 71 60 68Z"
          fill="#FFF8F0"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Cozy Peach-Apricot Smock (Tucked behind head) */}
      <path
        d="M29 53C25 63 24 73 26 78C34 81 54 81 62 78C64 73 63 63 59 53H29Z"
        fill="#FAD8BC"
        stroke="#6B5344"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />

      {/* Rounded White Collar (Tucked behind chin) */}
      <path
        d="M31 55C31 65 41 66 44 61C47 66 57 65 57 55H31Z"
        fill="#FFFFFF"
        stroke="#6B5344"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />

      {/* Twin Wakaba Sprout on Top */}
      <g transform={mood === 'listening' ? 'rotate(-5 44 20)' : undefined}>
        <path d="M44 20.5V13.5" stroke="#6B5344" strokeWidth="2.1" strokeLinecap="round" />
        <path
          d="M44 15.5C39 7 27 7 25 14C23 19.5 35 22 44 17Z"
          fill="#74BE8C"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M44 15.5C49 7 61 7 63 14C65 19.5 53 22 44 17Z"
          fill="#3E8E63"
          stroke="#6B5344"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* Soft Omochi Horizontal-Oval Head */}
      <ellipse
        cx="44"
        cy="40.5"
        rx="24.5"
        ry="21"
        fill="#FFF8F0"
        stroke="#6B5344"
        strokeWidth="2.2"
      />

      {/* Matte Soft Coral-Peach Cheeks */}
      <ellipse cx="27" cy="46.5" rx="4.6" ry="3" fill="#F6B9A8" />
      <ellipse cx="61" cy="46.5" rx="4.6" ry="3" fill="#F6B9A8" />

      {/* Eyes */}
      {mood === 'gentle' ? (
        <>
          <path
            d="M31.2 43.2C32.8 40.5 36.4 40.5 38 43.2"
            stroke="#463325"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M50 43.2C51.6 40.5 55.2 40.5 56.8 43.2"
            stroke="#463325"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse cx="34.5" cy="42.8" rx="2.6" ry="3.2" fill="#463325" />
          <circle cx="33.7" cy="41.6" r="0.85" fill="#FFFDF9" />

          <ellipse cx="53.5" cy="42.8" rx="2.6" ry="3.2" fill="#463325" />
          <circle cx="52.7" cy="41.6" r="0.85" fill="#FFFDF9" />
        </>
      )}

      {/* Mouth */}
      {mood === 'listening' ? (
        <ellipse
          cx="44"
          cy="46.8"
          rx="2"
          ry="2.3"
          fill="#E59583"
          stroke="#463325"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M40.8 45.8Q44 48.8 47.2 45.8"
          stroke="#463325"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

export const ShoppingItemSvg: React.FC<{ icon: ShoppingItemIconKey }> = ({ icon }) => {
  switch (icon) {
    case 'apple':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="27" r="14" fill="#EB6A5B" stroke="#6B5344" strokeWidth="2" />
          <path d="M24 13V8" stroke="#6B5344" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M25 10C29 7 34 9 33 13C30 14 26 13 25 10Z" fill="#68B058" stroke="#6B5344" strokeWidth="1.4" />
        </svg>
      );
    case 'orange':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="27" r="13" fill="#F6A64C" stroke="#6B5344" strokeWidth="2" />
          <path d="M21 13C23 10 26 10 28 13C25 15 23 15 21 13Z" fill="#68B058" stroke="#6B5344" strokeWidth="1.4" />
        </svg>
      );
    case 'banana':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path
            d="M12 31C18 38 34 35 37 16C33 22 23 26 15 24L12 31Z"
            fill="#F9D464"
            stroke="#6B5344"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'bread':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path
            d="M12 24C12 15 36 15 36 24V35C36 36.5 34.8 37.5 33.5 37.5H14.5C13.2 37.5 12 36.5 12 35V24Z"
            fill="#E7B174"
            stroke="#6B5344"
            strokeWidth="2"
          />
          <rect x="15" y="23" width="18" height="11" rx="3" fill="#FFF7EB" />
        </svg>
      );
    case 'candy':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <polygon points="8,18 16,24 8,30" fill="#F086A1" stroke="#6B5344" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="40,18 32,24 40,30" fill="#F086A1" stroke="#6B5344" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="9.5" fill="#FAA8BD" stroke="#6B5344" strokeWidth="2" />
        </svg>
      );
    case 'gum':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="11" y="16" width="26" height="16" rx="4" fill="#8CD4C5" stroke="#6B5344" strokeWidth="2" />
          <line x1="19" y1="16" x2="19" y2="32" stroke="#6B5344" strokeWidth="2" />
        </svg>
      );
    case 'cookie':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="13" fill="#E3AE6E" stroke="#6B5344" strokeWidth="2" />
          <circle cx="20" cy="20" r="2.1" fill="#6B5344" />
          <circle cx="29" cy="22" r="2.1" fill="#6B5344" />
          <circle cx="23" cy="29" r="2.1" fill="#6B5344" />
        </svg>
      );
    case 'pencil':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect
            x="14"
            y="18"
            width="20"
            height="10"
            rx="1.5"
            transform="rotate(-25 14 18)"
            fill="#68BE8D"
            stroke="#6B5344"
            strokeWidth="2"
          />
          <polygon points="34,13 40,15 36,21" fill="#FDE0A1" stroke="#6B5344" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'notebook':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="13" y="10" width="22" height="28" rx="3" fill="#A5DDD0" stroke="#6B5344" strokeWidth="2" />
          <line x1="17.5" y1="10" x2="17.5" y2="38" stroke="#2B6E6B" strokeWidth="2" />
          <rect x="20.5" y="16" width="10.5" height="5.5" rx="1.5" fill="#FFFFFF" />
        </svg>
      );
    case 'eraser':
      return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="11" y="17" width="16" height="14" rx="2.5" fill="#EE9860" stroke="#6B5344" strokeWidth="2" />
          <rect x="27" y="17" width="10" height="14" rx="2" fill="#FFFDF9" stroke="#6B5344" strokeWidth="2" />
        </svg>
      );
  }
};

/**
 * Distinct Roof Shape + Color + Animal Icon so color alone is never the distinguishing cue (Chapter 4).
 */
export const AnimalHouseIllustration: React.FC<{
  node: DeliveryNodeSpec;
  size?: number;
}> = ({ node, size = 64 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      {node.shapeLabel === 'circle' && (
        <path
          d="M13 34C13 19 59 19 59 34H13Z"
          fill={node.colorHex}
          stroke="#6B5344"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}
      {node.shapeLabel === 'square' && (
        <rect
          x="14"
          y="16"
          width="44"
          height="18"
          rx="3"
          fill={node.colorHex}
          stroke="#6B5344"
          strokeWidth="2.2"
        />
      )}
      {node.shapeLabel === 'triangle' && (
        <polygon
          points="36,11 60,34 12,34"
          fill={node.colorHex}
          stroke="#6B5344"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}
      {node.shapeLabel === 'pentagon' && (
        <polygon
          points="36,11 58,23 53,34 19,34 14,23"
          fill={node.colorHex}
          stroke="#6B5344"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}
      {node.shapeLabel === 'arch' && (
        <path
          d="M12 34L22 15H50L60 34H12Z"
          fill={node.colorHex}
          stroke="#6B5344"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}

      {/* Cozy Storybook House Wall */}
      <rect
        x="17"
        y="34"
        width="38"
        height="29"
        rx="5"
        fill="#FFFDF9"
        stroke="#6B5344"
        strokeWidth="2.2"
      />

      {/* Simple Matte Animal Face Mark inside House */}
      {node.key === 'rabbit' && (
        <>
          <ellipse cx="31" cy="42.5" rx="2.7" ry="6" fill={node.colorHex} />
          <ellipse cx="41" cy="42.5" rx="2.7" ry="6" fill={node.colorHex} />
          <circle cx="36" cy="51.5" r="7" fill={node.bgHex} stroke={node.colorHex} strokeWidth="2" />
          <circle cx="33.5" cy="50.8" r="1.1" fill="#463325" />
          <circle cx="38.5" cy="50.8" r="1.1" fill="#463325" />
        </>
      )}
      {node.key === 'bear' && (
        <>
          <circle cx="29" cy="43" r="3.6" fill={node.colorHex} />
          <circle cx="43" cy="43" r="3.6" fill={node.colorHex} />
          <circle cx="36" cy="50.5" r="7.2" fill={node.bgHex} stroke={node.colorHex} strokeWidth="2" />
          <circle cx="33.5" cy="49.8" r="1.1" fill="#463325" />
          <circle cx="38.5" cy="49.8" r="1.1" fill="#463325" />
        </>
      )}
      {node.key === 'fox' && (
        <>
          <polygon
            points="27,42 32,47 40,47 45,42 36,57.5"
            fill={node.bgHex}
            stroke={node.colorHex}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="33.5" cy="49.5" r="1" fill="#463325" />
          <circle cx="38.5" cy="49.5" r="1" fill="#463325" />
        </>
      )}
      {node.key === 'frog' && (
        <>
          <circle cx="31" cy="44" r="3" fill={node.colorHex} />
          <circle cx="41" cy="44" r="3" fill={node.colorHex} />
          <ellipse cx="36" cy="51.5" rx="8" ry="5.5" fill={node.bgHex} stroke={node.colorHex} strokeWidth="2" />
          <circle cx="33" cy="50.2" r="1" fill="#463325" />
          <circle cx="39" cy="50.2" r="1" fill="#463325" />
        </>
      )}
      {node.key === 'bird' && (
        <>
          <circle cx="36" cy="49.5" r="6.8" fill={node.bgHex} stroke={node.colorHex} strokeWidth="2" />
          <circle cx="34" cy="48.8" r="1.1" fill="#463325" />
          <polygon points="37,49 44.5,47.5 39,53" fill={node.colorHex} />
        </>
      )}
    </svg>
  );
};

/**
 * Chapter 5: Identical Ending Illustration & Stamp for EVERY child regardless of score!
 */
export const UniversalAdventureStamp: React.FC = () => (
  <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border-2 border-[#F0D5B5] bg-[#FFF9EE] p-7 text-center shadow-[0_8px_24px_rgba(107,83,68,0.06)]">
    <svg width="156" height="124" viewBox="0 0 160 130" fill="none" aria-label="おまつりの えと たんけんスタンプ">
      {/* Festival Bunting */}
      <path d="M12 20Q80 44 148 20" stroke="#6B5344" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <polygon points="28,24 39,27 32,41" fill="#EE8572" />
      <polygon points="56,29 67,30 60,45" fill="#74BE8C" />
      <polygon points="84,30 95,29 88,45" fill="#F6B257" />
      <polygon points="112,27 123,24 116,41" fill="#78C2B4" />
      {/* Stamp Badge */}
      <circle cx="80" cy="80" r="37" fill="#FFFFFF" stroke="#D97B3E" strokeWidth="3" strokeDasharray="5 3.5" />
      <circle cx="80" cy="80" r="30" fill="#FFF5E6" stroke="#E89B5E" strokeWidth="1.8" />
      <path
        d="M80 60L85.4 71.2L97.5 72.8L88.6 81.2L90.8 93.2L80 87.3L69.2 93.2L71.4 81.2L62.5 72.8L74.6 71.2L80 60Z"
        fill="#FCC668"
        stroke="#6B5344"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
    <p className="mt-2 font-heading text-2xl font-bold text-[#9A4816]">
      まちの おまつり とうちゃく！
    </p>
    <p className="mt-1.5 text-base font-medium text-[#3A3128]">
      さいごまで たんけんに さんか してくれて ありがとう！
    </p>
  </div>
);
