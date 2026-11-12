import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  DELIVERY_NODES,
  type DeliveryAnimalKey,
  type ShoppingItemIconKey,
  type ShoppingQuestion,
} from '../data/gameBank';
import { soundEngine } from '../lib/soundEngine';

// ============================================================================
// Shared HiDPI Responsive Canvas Hook
// ============================================================================
function useCanvasLoop(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, timeSec: number) => void,
  deps: React.DependencyList
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 680, h: 228 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(100, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h };
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const startMs = performance.now();

    const renderFrame = (nowMs: number) => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { w, h } = sizeRef.current;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const t = reducedMotion ? 0 : (nowMs - startMs) / 1000;
        draw(ctx, w, h, t);
        ctx.restore();
      }
      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, canvasRef };
}

// ============================================================================
// Hand-Crafted High-Detail 2D Picture-Book Drawing Engine ("ひだまりとわかば")
// Every character uses strict bottom/surface anchoring so ZERO clipping ever occurs!
// ============================================================================
const INK = '#654D3E';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawSoftCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.arc(-18, 4, 11, 0, Math.PI * 2);
  ctx.arc(-2, -2, 15, 0, Math.PI * 2);
  ctx.arc(15, 2, 12, 0, Math.PI * 2);
  ctx.arc(26, 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSparkleStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = '#FCC668'
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const ang = (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Extracts item icons mentioned in a ShoppingQuestion so EVERY screen (including 'text' mode!)
 * displays cute plated food/stationery items on the counter, while 'illust' mode adds price tags!
 */
function extractMentionedItemIcons(q?: ShoppingQuestion): ShoppingItemIconKey[] {
  if (!q) return ['apple', 'bread'];
  if (q.visualItems && q.visualItems.length > 0) {
    return q.visualItems.map((v) => v.icon);
  }
  const keywordMap: Array<{ word: string; icon: ShoppingItemIconKey }> = [
    { word: 'りんご', icon: 'apple' },
    { word: 'みかん', icon: 'orange' },
    { word: 'バナナ', icon: 'banana' },
    { word: 'パン', icon: 'bread' },
    { word: 'あめ', icon: 'candy' },
    { word: 'ガム', icon: 'gum' },
    { word: 'クッキー', icon: 'cookie' },
    { word: 'えんぴつ', icon: 'pencil' },
    { word: 'ノート', icon: 'notebook' },
    { word: 'けしゴム', icon: 'eraser' },
  ];
  const found: Array<{ pos: number; icon: ShoppingItemIconKey }> = [];
  for (const entry of keywordMap) {
    const idx = q.prompt.indexOf(entry.word);
    if (idx >= 0) {
      found.push({ pos: idx, icon: entry.icon });
    }
  }
  found.sort((a, b) => a.pos - b.pos);
  return found.length > 0 ? found.map((f) => f.icon) : ['bread', 'cookie'];
}

/**
 * Full-Body Picture-Book "Momo" anchored at (footX, footY)!
 * Total bounding box in local space: y in [-72, +2], x in [-28, +28].
 * Because footY is placed on the ground, Momo NEVER clips behind counters or canvas edges!
 */
function drawMomoFull(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  scale: number,
  time: number,
  opts?: {
    walking?: boolean;
    talking?: boolean;
    postman?: boolean;
    basket?: boolean;
    jumpHeight?: number;
  }
) {
  const walking = opts?.walking ?? false;
  const talking = opts?.talking ?? false;
  const jumpH = opts?.jumpHeight ?? 0;
  const stride = walking ? Math.sin(time * 10) : 0;
  const walkBob = walking ? Math.abs(stride) * 4.5 : Math.sin(time * 2.6) * 1.4;
  const squash = jumpH > 2 ? 0.05 : walking ? Math.abs(stride) * 0.03 : 0;

  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(scale, scale);

  // Soft Ground Contact Shadow (stays on the ground even when jumping!)
  const shadowScale = Math.max(0.55, 1 - jumpH / 45);
  ctx.fillStyle = 'rgba(78, 108, 86, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 19 * shadowScale, 4.8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -walkBob - jumpH);
  ctx.scale(1 + squash, 1 - squash * 0.8);

  // Little Socks & Cozy Brown Shoes (y: -8 .. 0)
  const leftFootY = walking ? stride * 2.6 : 0;
  const rightFootY = walking ? -stride * 2.6 : 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;

  for (const [fx, fy] of [
    [-7.5, leftFootY],
    [7.5, rightFootY],
  ]) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(fx - 3, -9 + fy, 6, 5);
    ctx.fillStyle = '#B87449';
    ctx.beginPath();
    ctx.ellipse(fx, -3 + fy, 5.8, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Left Arm (holding basket if basket=true) & Right Waving Arm
  const waveAngle = Math.sin(time * 4.8) * 0.26;
  ctx.save();
  ctx.translate(-15, -24);
  ctx.fillStyle = '#FFF8F0';
  ctx.beginPath();
  ctx.ellipse(-4, 3, 5.8, 3.8, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(15, -25);
  ctx.rotate(waveAngle - (jumpH > 2 ? 0.45 : 0));
  ctx.fillStyle = '#FFF8F0';
  ctx.beginPath();
  ctx.ellipse(5.5, -2, 6.2, 3.9, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Peach-Apricot A-Line Smock Dress (y: -31 .. -8)
  const dressGrad = ctx.createLinearGradient(0, -32, 0, -7);
  dressGrad.addColorStop(0, '#FCE0C6');
  dressGrad.addColorStop(1, '#F5C7A3');
  ctx.fillStyle = dressGrad;
  ctx.beginPath();
  ctx.moveTo(-13.5, -31);
  ctx.lineTo(13.5, -31);
  ctx.lineTo(18.5, -9);
  ctx.quadraticCurveTo(0, -5, -18.5, -9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cute Stitched Pocket on Dress
  ctx.fillStyle = '#FFF7EE';
  drawRoundedRect(ctx, -6, -19, 12, 7.5, 3);
  ctx.fill();
  ctx.stroke();

  // Crisp White Peter-Pan Collar
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-12, -30);
  ctx.quadraticCurveTo(-5, -21, 0, -26);
  ctx.quadraticCurveTo(5, -21, 12, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Optional Postman Leather Mailbag
  if (opts?.postman) {
    ctx.strokeStyle = '#7D4E28';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-11, -29);
    ctx.lineTo(12, -12);
    ctx.stroke();

    ctx.fillStyle = '#D98245';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    drawRoundedRect(ctx, 4, -20, 15, 11.5, 3.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    ctx.fillRect(6.5, -22, 9.5, 4);
  }

  // Optional Woven Picnic/Shopping Basket held neatly at side
  if (opts?.basket) {
    ctx.save();
    ctx.translate(-22, -18);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(0, -2, 7, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#E3AF70';
    drawRoundedRect(ctx, -9, -2, 18, 12, 3.5);
    ctx.fill();
    ctx.stroke();
    // Woven cross-hatch line
    ctx.strokeStyle = '#B88042';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.lineTo(7, 4);
    ctx.stroke();
    ctx.restore();
  }

  // Twin Wakaba Sprout on Top of Head (y: -70 .. -58)
  const sproutSway = Math.sin(time * 3.2) * 0.08;
  ctx.save();
  ctx.translate(0, -61);
  ctx.rotate(sproutSway);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, -4);
  ctx.stroke();

  ctx.fillStyle = '#79C491';
  ctx.beginPath();
  ctx.ellipse(-9, -5, 8.8, 4.6, -0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3E8E63';
  ctx.beginPath();
  ctx.ellipse(9, -5, 8.8, 4.6, 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Soft Omochi Horizontal-Oval Head (center y = -43, rx = 21, ry = 17.5 -> [-60.5, -25.5])
  ctx.fillStyle = '#FFF8F0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.ellipse(0, -43, 21, 17.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Optional Wakaba Postman Cap
  if (opts?.postman) {
    ctx.fillStyle = '#2F7A54';
    ctx.beginPath();
    ctx.ellipse(0, -58, 15.5, 5.5, -0.05, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FCC668';
    ctx.beginPath();
    ctx.arc(0, -59.5, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rosy Coral-Peach Cheeks
  ctx.fillStyle = '#F6B7A5';
  ctx.beginPath();
  ctx.ellipse(-13.5, -38.5, 4.5, 2.9, 0, 0, Math.PI * 2);
  ctx.ellipse(13.5, -38.5, 4.5, 2.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Calm Japanese Ehon Oval Eyes
  const blink = Math.sin(time * 1.75) > 0.965;
  ctx.fillStyle = '#463325';
  ctx.strokeStyle = '#463325';
  ctx.lineWidth = 2;
  if (blink || jumpH > 3) {
    ctx.beginPath();
    ctx.arc(-8, -41, 3.1, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -41, 3.1, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(-8, -41.5, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(8, -41.5, 2.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.arc(-8.8, -42.7, 0.95, 0, Math.PI * 2);
    ctx.arc(7.2, -42.7, 0.95, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  if (talking && Math.sin(time * 13) > 0.1) {
    ctx.fillStyle = '#E59583';
    ctx.beginPath();
    ctx.ellipse(0, -37.5, 2.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#463325';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-3.4, -38.5);
    ctx.quadraticCurveTo(0, -35.2, 3.4, -38.5);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Bear Baker Shopkeeper anchored cleanly at (centerX, counterTopY)!
 * Entire torso, green apron, red neckerchief, head, ears, and white baker's hat sit ABOVE counterTopY
 * (y in [-76, +4]), so Bear NEVER gets buried or clipped behind the counter!
 */
function drawBearShopkeeperAboveCounter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  counterTopY: number,
  scale: number,
  time: number,
  excited = false
) {
  const bob = excited ? Math.abs(Math.sin(time * 14)) * 7 : Math.sin(time * 2.3) * 1.5;

  ctx.save();
  ctx.translate(centerX, counterTopY - bob);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.1;

  // Upper Torso & Wakaba Baker's Apron (y: -28 .. +2)
  ctx.fillStyle = '#BD7F56';
  ctx.beginPath();
  ctx.moveTo(-22, 2);
  ctx.quadraticCurveTo(-23, -24, -14, -28);
  ctx.lineTo(14, -28);
  ctx.quadraticCurveTo(23, -24, 22, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4A9B70';
  drawRoundedRect(ctx, -16, -26, 32, 28, 6);
  ctx.fill();
  ctx.stroke();

  // Warm Coral Neckerchief
  ctx.fillStyle = '#EE7F5B';
  ctx.beginPath();
  ctx.moveTo(-12, -27);
  ctx.lineTo(12, -27);
  ctx.lineTo(0, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Apron Pocket
  ctx.fillStyle = '#FFFDF8';
  drawRoundedRect(ctx, -8.5, -13, 17, 9, 3);
  ctx.fill();
  ctx.stroke();

  // Waving Right Paw
  ctx.save();
  ctx.translate(20, -16);
  ctx.rotate(excited ? -0.65 + Math.sin(time * 16) * 0.35 : -0.25 + Math.sin(time * 3.6) * 0.2);
  ctx.fillStyle = '#BD7F56';
  ctx.beginPath();
  ctx.ellipse(8, -5, 8, 5.2, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Round Bear Ears
  ctx.fillStyle = '#BD7F56';
  ctx.beginPath();
  ctx.arc(-16.5, -55, 7.5, 0, Math.PI * 2);
  ctx.arc(16.5, -55, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#F0C8A8';
  ctx.beginPath();
  ctx.arc(-16.5, -55, 3.8, 0, Math.PI * 2);
  ctx.arc(16.5, -55, 3.8, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy White Baker's Hat (Toque) on Top!
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-6, -65, 8, 0, Math.PI * 2);
  ctx.arc(6, -65, 8, 0, Math.PI * 2);
  ctx.arc(0, -68, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawRoundedRect(ctx, -11, -61, 22, 6, 2);
  ctx.fill();
  ctx.stroke();

  // Bear Head (center y = -42)
  ctx.fillStyle = '#C98B61';
  ctx.beginPath();
  ctx.ellipse(0, -42, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cream Muzzle
  ctx.fillStyle = '#FFF4E4';
  ctx.beginPath();
  ctx.ellipse(0, -37.5, 9.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rosy Cheeks
  ctx.fillStyle = '#F2A794';
  ctx.beginPath();
  ctx.ellipse(-13.5, -38, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(13.5, -38, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes & Smile
  const blink = Math.sin(time * 1.5 + 1.2) > 0.965;
  ctx.fillStyle = '#463325';
  ctx.strokeStyle = '#463325';
  ctx.lineWidth = 2;
  if (blink || excited) {
    ctx.beginPath();
    ctx.arc(-8.5, -43, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8.5, -43, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-8.5, -43.5, 2.5, 0, Math.PI * 2);
    ctx.arc(8.5, -43.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-9.2, -44.4, 0.85, 0, Math.PI * 2);
    ctx.arc(7.8, -44.4, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#5A3E2E';
  ctx.beginPath();
  ctx.ellipse(0, -40, 3.4, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.quadraticCurveTo(-3.5, -34.5, -5.5, -36.5);
  ctx.moveTo(0, -38);
  ctx.quadraticCurveTo(3.5, -34.5, 5.5, -36.5);
  ctx.stroke();

  // Cute Left Paw resting ON TOP of the counter edge
  ctx.fillStyle = '#BD7F56';
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-15, 1.5, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawShoppingItemDetailed(
  ctx: CanvasRenderingContext2D,
  icon: ShoppingItemIconKey,
  x: number,
  y: number,
  scale = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;

  switch (icon) {
    case 'apple':
      ctx.fillStyle = '#EB6252';
      ctx.beginPath();
      ctx.arc(0, 2, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Gloss highlight
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-4.5, -2.5, 3.2, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, -15.5);
      ctx.stroke();
      ctx.fillStyle = '#68B85D';
      ctx.beginPath();
      ctx.ellipse(5.5, -12.5, 5, 2.6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'orange':
      ctx.fillStyle = '#F79E3E';
      ctx.beginPath();
      ctx.arc(0, 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#68B85D';
      ctx.beginPath();
      ctx.ellipse(0, -10.5, 4.8, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'banana':
      ctx.fillStyle = '#FAD355';
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.quadraticCurveTo(3, 15, 13, -9);
      ctx.quadraticCurveTo(4, 3, -10, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'bread':
      ctx.fillStyle = '#E6A865';
      drawRoundedRect(ctx, -14, -9, 28, 21, 8.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF6E6';
      drawRoundedRect(ctx, -10, -2, 20, 10.5, 3.5);
      ctx.fill();
      break;
    case 'candy':
      ctx.fillStyle = '#F07C9C';
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-8.5, 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -6);
      ctx.lineTo(8.5, 0);
      ctx.lineTo(16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FCA3BC';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, -0.5, 2.1);
      ctx.stroke();
      break;
    case 'gum':
      ctx.fillStyle = '#7ED1C1';
      drawRoundedRect(ctx, -13, -7.5, 26, 15, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF8';
      ctx.fillRect(-4.5, -6.5, 9, 13);
      break;
    case 'cookie':
      ctx.fillStyle = '#E2A864';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      for (const [cx, cy] of [
        [-4.5, -3.5],
        [4.5, -2],
        [-1, 5],
        [3.5, 4.5],
      ]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'pencil':
      ctx.save();
      ctx.rotate(-0.45);
      ctx.fillStyle = '#62BA87';
      drawRoundedRect(ctx, -13, -4.5, 21, 9, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDE0A1';
      ctx.beginPath();
      ctx.moveTo(8, -4.5);
      ctx.lineTo(15.5, 0);
      ctx.lineTo(8, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    case 'notebook':
      ctx.fillStyle = '#9CD8CA';
      drawRoundedRect(ctx, -10.5, -13, 21, 26, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2F7A54';
      ctx.fillRect(-10.5, -13, 4.5, 26);
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, -3, -7, 10, 6, 1.5);
      ctx.fill();
      break;
    case 'eraser':
      ctx.fillStyle = '#EE935A';
      drawRoundedRect(ctx, -13, -7.5, 16, 15, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF9';
      drawRoundedRect(ctx, 2, -7.5, 10.5, 15, 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/**
 * Cute Full-Body / Torso Village Animal Buddy anchored at footY!
 */
function drawVillageAnimalBuddy(
  ctx: CanvasRenderingContext2D,
  key: DeliveryAnimalKey,
  footX: number,
  footY: number,
  scale: number,
  time: number,
  excited = false
) {
  const hop = excited ? Math.abs(Math.sin(time * 12)) * 7 : Math.abs(Math.sin(time * 2.8 + footX)) * 1.8;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = 'rgba(70, 98, 78, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -hop);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.85;

  // Little body
  const bodyColors: Record<DeliveryAnimalKey, string> = {
    rabbit: '#FAD2CC',
    bear: '#7BB6D6',
    fox: '#F7CE86',
    frog: '#85CF9C',
    bird: '#CBB5EE',
  };
  ctx.fillStyle = bodyColors[key];
  drawRoundedRect(ctx, -7.5, -12, 15, 11, 5);
  ctx.fill();
  ctx.stroke();

  if (key === 'rabbit') {
    ctx.fillStyle = '#FFF6F4';
    ctx.beginPath();
    ctx.ellipse(-4.5, -29, 2.8, 7, -0.1, 0, Math.PI * 2);
    ctx.ellipse(4.5, -29, 2.8, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (key === 'bear') {
    ctx.fillStyle = '#D7A176';
    ctx.beginPath();
    ctx.arc(-6.8, -25, 3.6, 0, Math.PI * 2);
    ctx.arc(6.8, -25, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -18, 9.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (key === 'fox') {
    ctx.fillStyle = '#F4B15D';
    ctx.beginPath();
    ctx.moveTo(-8.5, -27);
    ctx.lineTo(-3, -21);
    ctx.lineTo(3, -21);
    ctx.lineTo(8.5, -27);
    ctx.lineTo(9.5, -15);
    ctx.lineTo(0, -9);
    ctx.lineTo(-9.5, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (key === 'frog') {
    ctx.fillStyle = '#8AD49E';
    ctx.beginPath();
    ctx.arc(-5, -24, 3.3, 0, Math.PI * 2);
    ctx.arc(5, -24, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -17.5, 9.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = '#D7C4F2';
    ctx.beginPath();
    ctx.arc(0, -18, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F6B257';
    ctx.beginPath();
    ctx.moveTo(4.5, -19);
    ctx.lineTo(11, -17);
    ctx.lineTo(4.5, -15);
    ctx.closePath();
    ctx.fill();
  }

  // Cheeks & Eyes
  ctx.fillStyle = '#F4A898';
  ctx.beginPath();
  ctx.arc(-5.2, -16.5, 1.8, 0, Math.PI * 2);
  ctx.arc(5.2, -16.5, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#463325';
  ctx.beginPath();
  ctx.arc(-3.2, -18.5, 1.25, 0, Math.PI * 2);
  ctx.arc(3.2, -18.5, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// 1. Living 2D Town Panorama Progress Map (Zero Clipping, Momo Walks Stop-to-Stop!)
// ============================================================================
export const TownPanorama2DMap: React.FC<{
  activeStopIndex: number;
  stops: Array<{ id: string; label: string }>;
  zukanLabel: string;
  onOpenZukan: () => void;
}> = ({ activeStopIndex, stops, zukanLabel, onOpenZukan }) => {
  const momoXProgressRef = useRef<number>(activeStopIndex);
  const targetIdxRef = useRef<number>(activeStopIndex);
  targetIdxRef.current = activeStopIndex;

  const { containerRef, canvasRef } = useCanvasLoop((ctx, w, h, t) => {
    const diff = targetIdxRef.current - momoXProgressRef.current;
    const isMoving = Math.abs(diff) > 0.015;
    momoXProgressRef.current += diff * 0.075;

    // Warm Picture-Book Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#D8EFF9');
    sky.addColorStop(0.58, '#FFF9EB');
    sky.addColorStop(1, '#C5E5CD');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Morning Sun with Gentle Rays
    ctx.save();
    ctx.translate(w - 44, 24);
    ctx.fillStyle = 'rgba(253, 232, 184, 0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, 21 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F7BE63';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Parallax Clouds
    drawSoftCloud(ctx, ((t * 11) % (w + 130)) - 65, 22, 0.72);
    drawSoftCloud(ctx, ((t * 7 + w * 0.48) % (w + 130)) - 65, 29, 0.56);

    // Layered Botanical Hills
    ctx.fillStyle = '#DCEFE0';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.quadraticCurveTo(w * 0.28, h * 0.38, w * 0.56, h * 0.56);
    ctx.quadraticCurveTo(w * 0.82, h * 0.68, w, h * 0.48);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#BEE1C7';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.quadraticCurveTo(w * 0.38, h * 0.58, w * 0.72, h * 0.69);
    ctx.quadraticCurveTo(w * 0.9, h * 0.74, w, h * 0.66);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    const padX = Math.max(46, w * 0.1);
    const usableW = w - padX * 2;
    const buildingGroundY = h - 26;
    const roadY = h - 12;

    // 5 Town Landmarks (Positioned cleanly ABOVE the road so Momo walks in front!)
    for (let i = 0; i < 5; i++) {
      const sx = padX + (usableW * i) / 4;
      const reached = i <= activeStopIndex;
      ctx.save();
      ctx.translate(sx, buildingGroundY);
      ctx.globalAlpha = reached ? 1 : 0.76;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;

      if (i === 0) {
        // 1. Fountain Plaza
        ctx.fillStyle = '#FFFDF8';
        drawRoundedRect(ctx, -16, -11, 32, 11, 4);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#56B8DB';
        ctx.lineWidth = 2;
        const drop = Math.sin(t * 6) * 2;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(-9, -26 + drop, -12, -12);
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(9, -26 - drop, 12, -12);
        ctx.stroke();
      } else if (i === 1) {
        // 2. Bear's Market
        ctx.fillStyle = '#FFFDF8';
        drawRoundedRect(ctx, -16, -20, 32, 20, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E57A54';
        drawRoundedRect(ctx, -19, -27, 38, 9, 3.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FAD384';
        ctx.fillRect(-6, -12, 12, 12);
      } else if (i === 2) {
        // 3. Sunlit Oak & Bench
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(-3, -18, 6, 18);
        ctx.fillStyle = '#5EB27E';
        ctx.beginPath();
        ctx.arc(0, -25, 13.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#E3AE6E';
        drawRoundedRect(ctx, -15, -7, 15, 6, 2);
        ctx.fill();
        ctx.stroke();
      } else if (i === 3) {
        // 4. Animal Post Office
        ctx.fillStyle = '#FFFDF8';
        drawRoundedRect(ctx, -15, -19, 30, 19, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#D65A47';
        ctx.beginPath();
        ctx.moveTo(-18, -19);
        ctx.lineTo(0, -32);
        ctx.lineTo(18, -19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // 5. Festival & 3D Gacha Tent
        ctx.fillStyle = '#FFF8E6';
        drawRoundedRect(ctx, -16, -19, 32, 19, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F6B257';
        ctx.beginPath();
        ctx.moveTo(-20, -19);
        ctx.lineTo(0, -33);
        ctx.lineTo(20, -19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Cream Cobblestone Town Road in Foreground
    ctx.strokeStyle = '#FFFDF7';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(padX - 18, roadY);
    ctx.lineTo(w - padX + 18, roadY);
    ctx.stroke();

    // Wakaba Progress Trail
    ctx.strokeStyle = '#5BB884';
    ctx.lineWidth = 4.5;
    const completedX = padX + (usableW * Math.max(0, momoXProgressRef.current)) / 4;
    ctx.beginPath();
    ctx.moveTo(padX - 8, roadY);
    ctx.lineTo(completedX, roadY);
    ctx.stroke();

    // Full-Body Momo Walking on the Foreground Road (Offset +18px so she stands beside the building!)
    const momoX = padX + (usableW * momoXProgressRef.current) / 4 + 16;
    if (isMoving) {
      for (let p = 0; p < 2; p++) {
        const puffX = momoX - 14 - p * 9;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(puffX, roadY - 2 - p * 2, 3.5 - p, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawMomoFull(ctx, momoX, roadY + 2, 0.62, t, { walking: isMoving });
  }, [activeStopIndex]);

  return (
    <section
      aria-label="たんけんマップ"
      className="overflow-hidden rounded-3xl border-2 border-[#DFD3BC] bg-[#FFFDF8] shadow-[0_4px_14px_rgba(107,83,68,0.06)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE2D3] bg-[#FFF9EE] px-4 py-1.5">
        <span className="text-xs font-bold text-[#5C5144]">
          ひだまりタウン ぼうけんマップ
        </span>
        <button
          type="button"
          onClick={onOpenZukan}
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border border-[#BFE0C9] bg-[#EDF7F0] px-3 py-0.5 text-xs font-bold text-[#215C3E] transition-colors hover:bg-[#DFF0E5] whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#2F7A54]" />
          <span>{zukanLabel}</span>
        </button>
      </div>

      <div ref={containerRef} className="relative h-[106px] sm:h-[114px] w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      <div className="grid grid-cols-5 gap-1 border-t border-[#EAE2D3] bg-[#FFFDF8] px-2 py-1.5 sm:gap-2 sm:px-3.5">
        {stops.map((stop, idx) => {
          const isCurrent = idx === activeStopIndex;
          const isDone = idx < activeStopIndex;
          return (
            <div
              key={stop.id}
              className={`rounded-xl px-1.5 py-1 text-center transition-colors ${
                isCurrent
                  ? 'bg-[#2F7A54] text-white font-bold shadow-2xs'
                  : isDone
                    ? 'bg-[#EDF7F0] text-[#215C3E] font-bold'
                    : 'bg-[#FAF5EC] text-[#8C7F70]'
              }`}
            >
              <div className="truncate text-[10px] sm:text-xs">{stop.label}</div>
              <div className="text-[9px] sm:text-[10px] opacity-90">
                {isCurrent ? 'いま ここ！' : isDone ? 'クリア！' : 'これから'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ============================================================================
// 2. Story, Interlude & Cozy Rest 2D Animated Stage (100% Zero Clipping!)
// ============================================================================
export const StoryScene2DStage: React.FC<{
  variant: 'plaza' | 'park_bench' | 'cozy_meadow';
  talking?: boolean;
  celebrateCount?: number;
  badgeText?: string;
  compact?: boolean;
}> = ({ variant, talking = false, celebrateCount = 0, badgeText, compact = false }) => {
  const burstTimeRef = useRef<number>(-10);
  const lastCelebrateRef = useRef<number>(celebrateCount);

  if (celebrateCount !== lastCelebrateRef.current) {
    lastCelebrateRef.current = celebrateCount;
    burstTimeRef.current = performance.now() / 1000;
  }

  const { containerRef, canvasRef } = useCanvasLoop((ctx, w, h, t) => {
    const nowSec = performance.now() / 1000;
    const sinceBurst = nowSec - burstTimeRef.current;
    const isBursting = sinceBurst >= 0 && sinceBurst < 1.05;

    // Sunlit Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, variant === 'plaza' ? '#D6EFFA' : '#E2F4E7');
    sky.addColorStop(0.65, '#FFF9EB');
    sky.addColorStop(1, '#BEE1C7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Warm Diagonal Sunbeams
    ctx.save();
    ctx.fillStyle = 'rgba(255, 248, 220, 0.35)';
    ctx.beginPath();
    ctx.moveTo(w * 0.65, 0);
    ctx.lineTo(w * 0.85, 0);
    ctx.lineTo(w * 0.62, h);
    ctx.lineTo(w * 0.42, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawSoftCloud(ctx, ((t * 13) % (w + 140)) - 70, 28, 0.82);
    drawSoftCloud(ctx, ((t * 8 + w * 0.52) % (w + 140)) - 70, 38, 0.65);

    // Rolling Meadow Hills
    ctx.fillStyle = '#D5EEDD';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.quadraticCurveTo(w * 0.35, h * 0.44, w, h * 0.6);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#B7DEC2';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.5, h * 0.62, w, h * 0.74);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    const groundY = h - 18;

    if (variant === 'plaza') {
      // Brick-trimmed Fountain Plaza Patio
      ctx.fillStyle = '#F7EFE0';
      ctx.strokeStyle = '#D9C8AE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w * 0.56, groundY - 4, Math.min(210, w * 0.38), 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Two-Tiered Stone Fountain
      const fx = w * 0.63;
      const fy = groundY - 12;
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, fx - 48, fy - 12, 96, 20, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#92DCF2';
      ctx.beginPath();
      ctx.ellipse(fx, fy - 10, 40, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F5EFE4';
      drawRoundedRect(ctx, fx - 11, fy - 38, 22, 27, 4);
      ctx.fill();
      ctx.stroke();
      drawRoundedRect(ctx, fx - 24, fy - 43, 48, 8, 4);
      ctx.fill();
      ctx.stroke();

      // Animated Sparkling Water Arcs & Splash Rings!
      ctx.strokeStyle = '#53B9E0';
      ctx.lineWidth = 2.4;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(fx, fy - 44);
        ctx.quadraticCurveTo(fx + dir * 24, fy - 68, fx + dir * 34, fy - 12);
        ctx.stroke();

        for (let d = 0; d < 3; d++) {
          const prog = (t * 1.45 + d * 0.33) % 1;
          const dx = fx + dir * 34 * prog;
          const dy = fy - 44 - Math.sin(prog * Math.PI) * 24 + prog * 32;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(dx, dy, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Blooming Tulips & Animal Friends
      drawVillageAnimalBuddy(ctx, 'bird', fx - 64, groundY - 2, 0.95, t, isBursting);
      drawVillageAnimalBuddy(ctx, 'rabbit', Math.min(w - 36, fx + 68), groundY, 1.0, t, isBursting);

      // Full-Body Momo Welcoming on the Left!
      drawMomoFull(ctx, Math.max(68, w * 0.27), groundY, 0.98, t, {
        talking,
        jumpHeight: isBursting ? Math.sin(sinceBurst * Math.PI) * 14 : 0,
      });
    } else if (variant === 'park_bench') {
      // Lush Oak Tree (Strictly bounded inside [18px, groundY]!)
      const treeX = w * 0.74;
      const sway = Math.sin(t * 1.8) * 2.5;
      ctx.fillStyle = '#8B5A2B';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, treeX - 12, h * 0.42, 24, groundY - h * 0.42 - 4, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5AB07B';
      ctx.beginPath();
      ctx.arc(treeX - 24 + sway, h * 0.38, 26, 0, Math.PI * 2);
      ctx.arc(treeX + 22 + sway, h * 0.4, 24, 0, Math.PI * 2);
      ctx.arc(treeX + sway, Math.max(38, h * 0.28), 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cozy Wooden Park Bench
      const bx = w * 0.4;
      const by = groundY - 6;
      ctx.fillStyle = '#DF9E63';
      drawRoundedRect(ctx, bx - 66, by - 32, 132, 13, 4);
      ctx.fill();
      ctx.stroke();
      drawRoundedRect(ctx, bx - 70, by - 16, 140, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(bx - 52, by - 6, 8, 10);
      ctx.fillRect(bx + 44, by - 6, 8, 10);

      // Full-Body Momo & Fox Buddy by the Bench!
      drawMomoFull(ctx, bx - 22, groundY, 0.94, t, {
        talking,
        jumpHeight: isBursting ? Math.sin(sinceBurst * Math.PI) * 12 : 0,
      });
      drawVillageAnimalBuddy(ctx, 'fox', bx + 32, groundY - 2, 1.08, t, isBursting);

      // Fluttering Butterflies
      for (let b = 0; b < 3; b++) {
        const bfx = w * (0.16 + b * 0.32) + Math.sin(t * 1.6 + b * 2) * 24;
        const bfy = h * 0.34 + Math.cos(t * 2.2 + b) * 12;
        const wing = Math.abs(Math.sin(t * 12 + b)) * 5.5 + 2;
        ctx.fillStyle = b === 1 ? '#F7A8B8' : '#FCC668';
        ctx.beginPath();
        ctx.ellipse(bfx - 3, bfy, wing, 3.8, -0.3, 0, Math.PI * 2);
        ctx.ellipse(bfx + 3, bfy, wing, 3.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Cozy Meadow Rest Scene (Used in Pause, Loading, Talk & Safety screens!)
      drawMomoFull(ctx, w * 0.42, groundY, 0.94, t, { talking });
      drawVillageAnimalBuddy(ctx, 'rabbit', w * 0.62, groundY - 2, 1.0, t, false);
      for (let f = 0; f < 5; f++) {
        const fx = w * (0.12 + f * 0.19);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(fx, groundY - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FCC668';
        ctx.beginPath();
        ctx.arc(fx, groundY - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Celebration Sparkle Stars on Card Select!
    if (isBursting) {
      for (let p = 0; p < 8; p++) {
        const angle = (p / 8) * Math.PI * 2;
        const dist = 20 + sinceBurst * 56;
        const px = w * 0.34 + Math.cos(angle) * dist;
        const py = h * 0.46 + Math.sin(angle) * dist - sinceBurst * 20;
        ctx.globalAlpha = Math.max(0, 1 - sinceBurst);
        drawSparkleStar(ctx, px, py, 6.5, p % 2 === 0 ? '#FCC668' : '#58BA83');
      }
      ctx.globalAlpha = 1;
    }
  }, [variant, talking, celebrateCount]);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#DFD4C0] bg-[#FFF9EE]">
      <div
        ref={containerRef}
        className={`${compact ? 'h-[132px] sm:h-[146px]' : 'h-[172px] sm:h-[192px]'} w-full`}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      {badgeText && (
        <div className="absolute top-2.5 left-3 rounded-xl border border-[#DFD2BC] bg-[#FFFDF8]/95 px-3 py-1 text-xs font-bold text-[#463325] shadow-2xs">
          {badgeText}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. Shopping 2D Animated Store Stage ("くまさんの ひだまりマルシェ")
// Full-body Momo on left shop floor + Full-torso Bear Baker above counter +
// Plated items ALWAYS visible on EVERY question + Flying-Coin Checkout Cutscene!
// ============================================================================
export const Shopping2DStage: React.FC<{
  question?: ShoppingQuestion;
  checkoutState: { active: boolean; chosenLabel: string } | null;
  isIntroPreview?: boolean;
}> = ({ question, checkoutState, isIntroPreview = false }) => {
  const checkoutStartRef = useRef<number>(0);
  const wasActiveRef = useRef<boolean>(false);
  const questionEnterRef = useRef<number>(performance.now() / 1000);
  const prevQIdRef = useRef<string | undefined>(question?.id);

  if (question?.id !== prevQIdRef.current) {
    prevQIdRef.current = question?.id;
    questionEnterRef.current = performance.now() / 1000;
  }

  if (checkoutState?.active && !wasActiveRef.current) {
    wasActiveRef.current = true;
    checkoutStartRef.current = performance.now() / 1000;
  } else if (!checkoutState?.active) {
    wasActiveRef.current = false;
  }

  const { containerRef, canvasRef } = useCanvasLoop((ctx, w, h, t) => {
    const nowSec = performance.now() / 1000;
    const animProg = checkoutState?.active
      ? Math.min(1, Math.max(0, (nowSec - checkoutStartRef.current) / 0.74))
      : 0;
    const enterProg = Math.min(1, Math.max(0, (nowSec - questionEnterRef.current) / 0.42));

    // 1. Warm Cream Plaster Shop Wall + Lower Honey Wood Floor
    const floorTopY = h - 54;
    const counterTopY = h - 66;

    const wallGrad = ctx.createLinearGradient(0, 0, 0, floorTopY);
    wallGrad.addColorStop(0, '#FFF8EC');
    wallGrad.addColorStop(1, '#F8EDD9');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, floorTopY);

    // Honey-Oak Shop Floorboards (Left customer area + bottom)
    ctx.fillStyle = '#ECC99B';
    ctx.fillRect(0, floorTopY, w, h - floorTopY);
    ctx.strokeStyle = '#D9B17E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, floorTopY);
    ctx.lineTo(w, floorTopY);
    ctx.stroke();

    // Arched Sunlit Bakery Window on Upper-Left Wall
    const winX = Math.max(48, w * 0.13);
    ctx.save();
    ctx.translate(winX, 68);
    ctx.fillStyle = '#D7F0FA';
    ctx.strokeStyle = '#C69563';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, -28, -32, 56, 54, 18);
    ctx.fill();
    ctx.stroke();
    // Mini cloud drifting past the window
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, -26, -30, 52, 50, 16);
    ctx.clip();
    drawSoftCloud(ctx, ((t * 9) % 74) - 37, -10, 0.45);
    ctx.restore();
    ctx.strokeStyle = '#C69563';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(0, 22);
    ctx.moveTo(-28, -4);
    ctx.lineTo(28, -4);
    ctx.stroke();
    ctx.restore();

    // Background Wooden Bakery Shelf & Hanging Sign
    if (w > 430) {
      const shelfX = w * 0.56;
      ctx.fillStyle = '#E0B280';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      drawRoundedRect(ctx, shelfX - 110, 56, 220, 7, 3);
      ctx.fill();
      ctx.stroke();
      drawShoppingItemDetailed(ctx, 'bread', shelfX - 78, 45, 0.68);
      drawShoppingItemDetailed(ctx, 'cookie', shelfX + 68, 46, 0.66);
      drawShoppingItemDetailed(ctx, 'apple', shelfX + 92, 45, 0.64);
    }

    // 2. Bear Baker Shopkeeper Standing Tall BEHIND the Counter (x = 45% of w)
    const counterLeftX = w * 0.31;
    const bearX = counterLeftX + (w - counterLeftX) * 0.21;
    drawBearShopkeeperAboveCounter(
      ctx,
      bearX,
      counterTopY,
      0.92,
      t,
      Boolean(checkoutState?.active)
    );

    // 3. Shop Counter Cabinet (Starts at x = 31% so Momo on the left is NEVER covered!)
    ctx.fillStyle = '#D59F68';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    drawRoundedRect(ctx, counterLeftX, counterTopY + 12, w - counterLeftX - 10, h - counterTopY - 18, 6);
    ctx.fill();
    ctx.stroke();

    // Counter Vertical Wood Panels
    ctx.strokeStyle = '#BA844E';
    ctx.lineWidth = 1.5;
    for (let px = counterLeftX + 46; px < w - 24; px += 52) {
      ctx.beginPath();
      ctx.moveTo(px, counterTopY + 15);
      ctx.lineTo(px, h - 8);
      ctx.stroke();
    }

    // Counter TopThick Plank
    ctx.fillStyle = '#F0C999';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    drawRoundedRect(ctx, counterLeftX - 6, counterTopY, w - counterLeftX, 15, 5);
    ctx.fill();
    ctx.stroke();

    // 4. Customer Welcome Rug & FULL-BODY MOMO on Left Shop Floor (Zero Clipping!)
    const rugX = w * 0.16;
    const momoFootY = h - 14;
    ctx.fillStyle = '#8CC89E';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.ellipse(rugX, momoFootY + 1, Math.min(44, w * 0.11), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const momoWalkX = rugX - (1 - enterProg) * 26;
    drawMomoFull(ctx, momoWalkX, momoFootY, 0.92, t, {
      walking: enterProg < 0.98,
      basket: true,
      jumpHeight: checkoutState?.active ? Math.sin(animProg * Math.PI) * 13 : 0,
    });

    // 5. Center Counter Gingham Display Mat + Plated Items (ALWAYS Illustrated!)
    const matCenterX = counterLeftX + (w - counterLeftX) * 0.54;
    ctx.fillStyle = '#FFFDF9';
    ctx.strokeStyle = '#E57A54';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, matCenterX - 78, counterTopY + 2, 156, 11, 4);
    ctx.fill();
    ctx.stroke();

    if (isIntroPreview) {
      const sampleIcons: ShoppingItemIconKey[] = ['apple', 'bread', 'candy'];
      sampleIcons.forEach((ic, idx) => {
        const ix = matCenterX + (idx - 1) * 46;
        const iy = counterTopY - 9 + Math.sin(t * 3.4 + idx) * 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(ix, counterTopY + 2, 19, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawShoppingItemDetailed(ctx, ic, ix, iy, 0.96);
      });
    } else if (question) {
      const iconsToShow = extractMentionedItemIcons(question);
      const isIllustMode =
        question.condition === 'illust' &&
        question.visualItems &&
        question.visualItems.length > 0;

      const count = isIllustMode ? question.visualItems!.length : iconsToShow.length;
      const spacing = count <= 1 ? 0 : Math.min(92, (w - counterLeftX) * 0.28);

      for (let idx = 0; idx < count; idx++) {
        const ix = matCenterX + (idx - (count - 1) / 2) * spacing;
        const bob = Math.sin(t * 3.2 + idx) * 1.8;

        // White Porcelain Plate on the Counter
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(ix, counterTopY + 3, 24, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const iconKey = isIllustMode ? question.visualItems![idx].icon : iconsToShow[idx];
        drawShoppingItemDetailed(ctx, iconKey, ix, counterTopY - 10 + bob, 1.04);

        if (isIllustMode) {
          // ILLUSTRATED CONDITION: Show Crisp Wooden Price Plaque + Operation Cue!
          const vi = question.visualItems![idx];
          ctx.save();
          ctx.translate(ix, counterTopY - 44);
          ctx.fillStyle = '#FFFDF8';
          ctx.strokeStyle = '#C86428';
          ctx.lineWidth = 2;
          drawRoundedRect(ctx, -34, -15, 68, 28, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#C86428';
          ctx.font = 'bold 13px "Zen Maru Gothic", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${vi.price}えん`, 0, 4);
          ctx.restore();
        }
      }

      // Operation Sign Badge between plates in Illust mode, or friendly "? えん" bubble in Text mode
      if (isIllustMode && count === 2) {
        ctx.save();
        ctx.translate(matCenterX, counterTopY - 42);
        ctx.fillStyle = question.operation === 'add' ? '#2F7A54' : '#C86428';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px "Zen Maru Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(question.operation === 'add' ? '＋' : '－', 0, 5);
        ctx.restore();
      } else if (!isIllustMode) {
        // TEXT CONDITION: Items are still illustrated on plates! Bear shows a cute "いくら かな？" bubble (no numeric hint!)
        ctx.save();
        ctx.translate(matCenterX, counterTopY - 44 + Math.sin(t * 2.8) * 2);
        ctx.fillStyle = '#FFFDF8';
        ctx.strokeStyle = '#2F7A54';
        ctx.lineWidth = 1.8;
        drawRoundedRect(ctx, -46, -13, 92, 24, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#215C3E';
        ctx.font = 'bold 11px "Zen Maru Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('いくらに なるかな？', 0, 3);
        ctx.restore();
      }
    }

    // 6. Detailed Brass & Cherrywood Cash Register on Right
    const regX = w - Math.max(52, w * 0.1);
    const regBounce =
      checkoutState?.active && animProg > 0.32
        ? Math.sin((animProg - 0.32) * Math.PI * 1.5) * 6
        : 0;

    ctx.save();
    ctx.translate(regX, counterTopY + 2 - regBounce);

    // Pop-up Price Window Flag
    ctx.fillStyle = checkoutState?.active ? '#FCC668' : '#FFFDF8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    drawRoundedRect(ctx, -29, -58, 58, 20, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3A3128';
    ctx.font = 'bold 11px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(checkoutState?.active ? checkoutState.chosenLabel : 'おかいけい', 0, -44);

    // Register Body
    ctx.fillStyle = '#E07D46';
    drawRoundedRect(ctx, -32, -37, 64, 37, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF8EC';
    drawRoundedRect(ctx, -23, -29, 46, 13, 3.5);
    ctx.fill();

    // Shiny Brass Key Dots
    ctx.fillStyle = '#FCC668';
    for (let kx = -16; kx <= 16; kx += 10.5) {
      ctx.beginPath();
      ctx.arc(kx, -9, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 7. Scalloped Red-and-Cream Market Awning Across Very Top (With Soft Drop Shadow!)
    const stripeW = 28;
    const sway = Math.sin(t * 2.1) * 1.4;
    ctx.fillStyle = 'rgba(101, 77, 62, 0.1)';
    ctx.fillRect(0, 0, w, 29 + sway);
    for (let sx = -stripeW; sx < w + stripeW; sx += stripeW) {
      const idx = Math.floor(sx / stripeW);
      ctx.fillStyle = idx % 2 === 0 ? '#E5754E' : '#FFFDF8';
      ctx.beginPath();
      ctx.rect(sx, 0, stripeW, 17 + sway);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + stripeW / 2, 17 + sway, stripeW / 2, 0, Math.PI);
      ctx.fill();
    }

    // 8. Interactive Checkout Cutscene: Shimmering Gold Coins -> Gift Bag -> Sparkle Burst!
    if (checkoutState?.active) {
      const coinPhase = Math.min(1, animProg / 0.54);
      if (coinPhase < 1) {
        for (let c = 0; c < 4; c++) {
          const cp = Math.max(0, Math.min(1, coinPhase * 1.3 - c * 0.1));
          const cx = momoWalkX + (regX - momoWalkX) * cp;
          const cy = counterTopY - 18 - Math.sin(cp * Math.PI) * 66;
          ctx.fillStyle = '#FCC668';
          ctx.strokeStyle = '#9A5B13';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      if (animProg > 0.28) {
        const bagProg = Math.min(1, (animProg - 0.28) / 0.72);
        const bagX = matCenterX - bagProg * (matCenterX - momoWalkX - 28);
        const bagY = counterTopY - 12 - Math.sin(bagProg * Math.PI) * 20;

        ctx.fillStyle = '#FFFDF8';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, bagX - 15, bagY - 17, 30, 28, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#58BA83';
        ctx.beginPath();
        ctx.arc(bagX, bagY - 2, 5.5, 0, Math.PI * 2);
        ctx.fill();

        drawSparkleStar(ctx, regX - 24, counterTopY - 68 - bagProg * 14, 7, '#FCC668');
        drawSparkleStar(ctx, regX + 22, counterTopY - 62 - bagProg * 18, 6, '#58BA83');

        ctx.save();
        ctx.translate(w * 0.55, 52 - bagProg * 10);
        ctx.fillStyle = '#FFF8E6';
        ctx.strokeStyle = '#D99B26';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, -64, -14, 128, 28, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9A4816';
        ctx.font = 'bold 13px "Zen Maru Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('まいどあり！ +5コイン', 0, 4);
        ctx.restore();
      }
    }
  }, [question, checkoutState, isIntroPreview]);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#DECBAE] bg-[#FFF8EC] shadow-inner">
      <div ref={containerRef} className="h-[204px] sm:h-[224px] w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </div>
  );
};

// ============================================================================
// 4. Animal Delivery Interactive 2D Village Map Stage ("どうぶつむらの おとどけマップ")
// Safe margins on all 4 sides, garden props, flying wax-sealed letters & zero clipping!
// ============================================================================
const VILLAGE_HOUSE_COORDS: Record<DeliveryAnimalKey, { nx: number; ny: number }> = {
  rabbit: { nx: 0.18, ny: 0.31 },
  bird: { nx: 0.5, ny: 0.25 },
  fox: { nx: 0.82, ny: 0.31 },
  bear: { nx: 0.22, ny: 0.63 },
  frog: { nx: 0.78, ny: 0.63 },
};

const POSTBOX_COORD = { nx: 0.5, ny: 0.84 };

export const DeliveryVillage2DStage: React.FC<{
  mode: 'intro' | 'memorize' | 'recall' | 'delivering';
  targetSequence: DeliveryAnimalKey[];
  chosenSequence: DeliveryAnimalKey[];
  maxPickLength?: number;
  onTapHouse?: (key: DeliveryAnimalKey, houseIndex: number) => void;
}> = ({
  mode,
  targetSequence,
  chosenSequence,
  maxPickLength = 5,
  onTapHouse,
}) => {
  const [replayNonce, setReplayNonce] = useState(0);
  const animStartMsRef = useRef<number>(performance.now());
  const lastSoundStepRef = useRef<number>(-1);

  useEffect(() => {
    animStartMsRef.current = performance.now();
    lastSoundStepRef.current = -1;
  }, [mode, targetSequence, replayNonce]);

  const activeAnimSeq =
    mode === 'memorize' ? targetSequence : mode === 'delivering' ? chosenSequence : [];
  const secPerLeg = mode === 'delivering' ? 0.28 : 0.92;

  const { containerRef, canvasRef } = useCanvasLoop((ctx, w, h, t) => {
    const elapsedAnimSec = (performance.now() - animStartMsRef.current) / 1000;

    // Lush Sunlit Meadow Backdrop
    const grass = ctx.createLinearGradient(0, 0, 0, h);
    grass.addColorStop(0, '#DFF3E5');
    grass.addColorStop(0.5, '#C8E8D1');
    grass.addColorStop(1, '#B2DBC0');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, w, h);

    // Decorative Meadow Flower Patches
    for (let i = 0; i < 8; i++) {
      const fx = w * (0.08 + ((i * 37) % 84) / 100);
      const fy = h * (0.14 + ((i * 53) % 74) / 100);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FCC668';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparkling Village Creek + Arched Wooden Bridge
    ctx.strokeStyle = '#92D9F0';
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    ctx.bezierCurveTo(w * 0.32, h * 0.41, w * 0.68, h * 0.55, w, h * 0.45);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.48);
    ctx.bezierCurveTo(w * 0.32, h * 0.41, w * 0.68, h * 0.55, w, h * 0.45);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#DFAA6B';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, w * 0.45, h * 0.42, w * 0.1, 24, 5);
    ctx.fill();
    ctx.stroke();

    const postX = w * POSTBOX_COORD.nx;
    const postY = h * POSTBOX_COORD.ny;

    // Cream Cobblestone Roads Connecting Postbox to All 5 Animal Cottages
    ctx.strokeStyle = '#FFF9EC';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    DELIVERY_NODES.forEach((node) => {
      const hc = VILLAGE_HOUSE_COORDS[node.key];
      ctx.beginPath();
      ctx.moveTo(postX, postY);
      ctx.quadraticCurveTo(w * 0.5, h * 0.52, w * hc.nx, h * hc.ny + 18);
      ctx.stroke();
    });

    // Animated Dashed Route Trail
    const routeList = mode === 'memorize' ? targetSequence : chosenSequence;
    if (routeList.length > 0) {
      ctx.save();
      ctx.strokeStyle = mode === 'memorize' ? '#E58A54' : '#2F7A54';
      ctx.lineWidth = 4;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -t * 24;
      ctx.beginPath();
      ctx.moveTo(postX, postY - 4);
      const visibleCount =
        mode === 'memorize'
          ? Math.min(routeList.length, Math.floor(elapsedAnimSec / secPerLeg) + 1)
          : routeList.length;
      for (let i = 0; i < visibleCount; i++) {
        const hc = VILLAGE_HOUSE_COORDS[routeList[i]];
        ctx.lineTo(w * hc.nx, h * hc.ny + 14);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw All 5 Distinct Animal Cottages + Resident Animal Buddies!
    DELIVERY_NODES.forEach((node, nodeIdx) => {
      const hc = VILLAGE_HOUSE_COORDS[node.key];
      const hx = w * hc.nx;
      const hy = h * hc.ny;

      const memIndex = targetSequence.indexOf(node.key);
      const chosenIndices: number[] = [];
      chosenSequence.forEach((k, idx) => {
        if (k === node.key) chosenIndices.push(idx + 1);
      });

      const currentLeg = Math.floor(elapsedAnimSec / secPerLeg);
      const isSpotlightedInMem =
        mode === 'memorize' &&
        targetSequence[currentLeg] === node.key &&
        elapsedAnimSec < targetSequence.length * secPerLeg + 0.4;
      const alreadyVisitedInMem =
        mode === 'memorize' &&
        memIndex >= 0 &&
        targetSequence.slice(0, currentLeg + 1).includes(node.key);

      ctx.save();
      ctx.translate(hx, hy);

      if (isSpotlightedInMem || chosenIndices.length > 0) {
        ctx.fillStyle = isSpotlightedInMem
          ? 'rgba(252, 198, 104, 0.58)'
          : 'rgba(47, 122, 84, 0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, 43 + (isSpotlightedInMem ? Math.sin(t * 10) * 4 : 0), 0, Math.PI * 2);
        ctx.fill();
      }

      // Cozy Cottage Wall
      ctx.fillStyle = '#FFFDF9';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.1;
      drawRoundedRect(ctx, -23, -4, 46, 29, 6);
      ctx.fill();
      ctx.stroke();

      // Warm Lit Window
      ctx.fillStyle = '#FFF2C6';
      drawRoundedRect(ctx, -16, 4, 10, 10, 2);
      ctx.fill();
      ctx.stroke();

      // Distinct Roof Shape + Color (Chapter 4 accessibility!)
      ctx.fillStyle = node.colorHex;
      ctx.beginPath();
      if (node.shapeLabel === 'circle') {
        ctx.arc(0, -4, 24, Math.PI, 0);
        ctx.closePath();
      } else if (node.shapeLabel === 'square') {
        drawRoundedRect(ctx, -25, -22, 50, 18, 4);
      } else if (node.shapeLabel === 'triangle') {
        ctx.moveTo(0, -28);
        ctx.lineTo(28, -4);
        ctx.lineTo(-28, -4);
        ctx.closePath();
      } else if (node.shapeLabel === 'pentagon') {
        ctx.moveTo(0, -28);
        ctx.lineTo(26, -15);
        ctx.lineTo(21, -4);
        ctx.lineTo(-21, -4);
        ctx.lineTo(-26, -15);
        ctx.closePath();
      } else {
        ctx.moveTo(-26, -4);
        ctx.lineTo(-15, -23);
        ctx.lineTo(15, -23);
        ctx.lineTo(26, -4);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      // Resident Animal Standing Beside Cottage Doorway (Full Body!)
      drawVillageAnimalBuddy(
        ctx,
        node.key,
        8,
        24,
        0.82,
        t + nodeIdx,
        isSpotlightedInMem || chosenIndices.length > 0 || mode === 'delivering'
      );

      // Nameplate Pill
      ctx.fillStyle = '#FFFDF8';
      ctx.strokeStyle = node.colorHex;
      ctx.lineWidth = 1.7;
      drawRoundedRect(ctx, -28, 27, 56, 17, 8.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3A3128';
      ctx.font = 'bold 11px "Zen Maru Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.animalLabel, 0, 39.5);

      // Order Flag Badge
      const badgeNumbers: number[] = [];
      if (mode === 'memorize' && alreadyVisitedInMem) {
        targetSequence.forEach((k, idx) => {
          if (k === node.key && idx <= currentLeg) badgeNumbers.push(idx + 1);
        });
      } else if (chosenIndices.length > 0) {
        badgeNumbers.push(...chosenIndices);
      }

      if (badgeNumbers.length > 0) {
        ctx.fillStyle = mode === 'memorize' ? '#C86428' : '#2F7A54';
        ctx.strokeStyle = '#FFFDF8';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, 14, -31, 26, 22, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px "Zen Maru Gothic", sans-serif';
        ctx.fillText(badgeNumbers.join('·'), 27, -16);
      }

      ctx.restore();
    });

    // Central Red Postbox at Bottom
    ctx.save();
    ctx.translate(postX, postY);
    ctx.fillStyle = '#D65A47';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -13, -18, 26, 25, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(-8, -11, 16, 4);
    ctx.restore();

    // Full-Body Postman Momo Walking / Delivering Letters!
    let momoFootX = postX - 36;
    let momoFootY = postY + 8;
    let isWalking = false;

    if ((mode === 'memorize' || mode === 'delivering') && activeAnimSeq.length > 0) {
      const totalLegs = activeAnimSeq.length;
      const rawStep = elapsedAnimSec / secPerLeg;
      const legIdx = Math.floor(rawStep);
      const legFrac = rawStep - legIdx;

      if (legIdx < totalLegs) {
        isWalking = legFrac < 0.72;
        const fromCoord =
          legIdx === 0 ? POSTBOX_COORD : VILLAGE_HOUSE_COORDS[activeAnimSeq[legIdx - 1]];
        const toCoord = VILLAGE_HOUSE_COORDS[activeAnimSeq[legIdx]];
        const moveT = Math.min(1, legFrac / 0.72);
        const smoothT = moveT * moveT * (3 - 2 * moveT);
        momoFootX = w * (fromCoord.nx + (toCoord.nx - fromCoord.nx) * smoothT) - 22;
        momoFootY = h * (fromCoord.ny + (toCoord.ny - fromCoord.ny) * smoothT) + 26;

        // Flying Wax-Sealed Letter Envelope on Arrival in Delivering Mode!
        if (mode === 'delivering' && legFrac > 0.5) {
          const envT = (legFrac - 0.5) / 0.5;
          const targetX = w * toCoord.nx;
          const targetY = h * toCoord.ny + 6;
          const ex = momoFootX + (targetX - momoFootX) * envT;
          const ey = momoFootY - 28 + (targetY - (momoFootY - 28)) * envT - Math.sin(envT * Math.PI) * 20;
          ctx.fillStyle = '#FFFDF8';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          drawRoundedRect(ctx, ex - 8, ey - 5, 16, 11, 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#D65A47';
          ctx.beginPath();
          ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (legFrac >= 0.68 && lastSoundStepRef.current < legIdx) {
          lastSoundStepRef.current = legIdx;
          const houseNodeIdx = DELIVERY_NODES.findIndex((n) => n.key === activeAnimSeq[legIdx]);
          if (mode === 'delivering') {
            soundEngine.playLetterDeliver(legIdx);
          } else {
            soundEngine.playHouseNote(houseNodeIdx >= 0 ? houseNodeIdx : legIdx);
          }
        }
      } else {
        const lastCoord = VILLAGE_HOUSE_COORDS[activeAnimSeq[totalLegs - 1]];
        momoFootX = w * lastCoord.nx - 28;
        momoFootY = h * lastCoord.ny + 26;
      }
    }

    drawMomoFull(ctx, momoFootX, momoFootY, 0.72, t, {
      postman: true,
      walking: isWalking,
      jumpHeight: mode === 'delivering' && !isWalking ? 8 : 0,
    });
  }, [mode, targetSequence, chosenSequence, replayNonce]);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#BFE0C9] bg-[#DFF3E5] shadow-inner select-none">
      <div ref={containerRef} className="relative h-[288px] sm:h-[324px] w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />

        {(mode === 'recall' || mode === 'intro') &&
          DELIVERY_NODES.map((node, idx) => {
            const hc = VILLAGE_HOUSE_COORDS[node.key];
            const disabled = mode === 'recall' && chosenSequence.length >= maxPickLength;
            return (
              <button
                key={node.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (mode === 'intro') {
                    soundEngine.playHouseNote(idx);
                  } else {
                    onTapHouse?.(node.key, idx);
                  }
                }}
                aria-label={`${node.animalLabel}（${node.houseLabel}）`}
                style={{
                  left: `${hc.nx * 100}%`,
                  top: `${hc.ny * 100}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 h-[82px] w-[88px] sm:h-[92px] sm:w-[102px] rounded-2xl border-2 border-transparent hover:border-[#2F7A54]/60 focus:border-[#2F7A54] focus:outline-none active:scale-95 transition-transform disabled:cursor-not-allowed"
              />
            );
          })}

        {mode === 'memorize' && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playTap();
              setReplayNonce((n) => n + 1);
            }}
            className="absolute bottom-2.5 right-2.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DFD2BC] bg-[#FFFDF8]/95 px-3 py-1.5 text-xs font-bold text-[#3A3128] shadow-xs hover:bg-[#FAF5EC]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#C86428]" />
            <span>うごきを もういちど みる</span>
          </button>
        )}

        {mode === 'recall' && (
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-xl border border-[#BFE0C9] bg-[#FFFDF8]/95 px-3 py-1 text-xs font-bold text-[#215C3E]">
            マップの おうちを じゅんばんに タップしよう！
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. Festival Plaza 2D Stage + Playable Bonus "くだもの＆コイン キャッチ" Mini-Game!
// ============================================================================
interface FallingTreat {
  id: number;
  xNorm: number;
  yNorm: number;
  speed: number;
  kind: 'apple' | 'orange' | 'cookie' | 'gold_coin';
}

interface CatchPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  bornSec: number;
}

export const FestivalPlaza2DStage: React.FC<{
  onEarnBonusCoins: (earned: number) => void;
}> = ({ onEarnBonusCoins }) => {
  const [miniGameState, setMiniGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [scoreCoins, setScoreCoins] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(20);

  const playerXNormRef = useRef<number>(0.5);
  const moveDirRef = useRef<-1 | 0 | 1>(0);
  const treatsRef = useRef<FallingTreat[]>([]);
  const popupsRef = useRef<CatchPopup[]>([]);
  const nextTreatIdRef = useRef<number>(1);
  const scoreRef = useRef<number>(0);

  useEffect(() => {
    if (miniGameState !== 'playing') return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setMiniGameState('finished');
          const earned = Math.max(5, Math.min(35, scoreRef.current));
          onEarnBonusCoins(earned);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [miniGameState, onEarnBonusCoins]);

  useEffect(() => {
    if (miniGameState !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveDirRef.current = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') moveDirRef.current = 1;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        (e.key === 'ArrowLeft' && moveDirRef.current === -1) ||
        (e.key === 'ArrowRight' && moveDirRef.current === 1)
      ) {
        moveDirRef.current = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [miniGameState]);

  const startCatchGame = () => {
    soundEngine.playCoinChime();
    treatsRef.current = [];
    popupsRef.current = [];
    scoreRef.current = 0;
    playerXNormRef.current = 0.5;
    setScoreCoins(0);
    setSecondsLeft(20);
    setMiniGameState('playing');
  };

  const lastFrameRef = useRef<number>(performance.now());

  const { containerRef, canvasRef } = useCanvasLoop((ctx, w, h, t) => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
    lastFrameRef.current = now;

    // Warm Golden Festival Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#FFEBC6');
    sky.addColorStop(0.62, '#FFF9EB');
    sky.addColorStop(1, '#BEE1C7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Gentle Pastel Festival Starbursts in Upper Sky
    for (let fw = 0; fw < 2; fw++) {
      const fProg = (t * 0.55 + fw * 0.5) % 1;
      const fx = w * (fw === 0 ? 0.24 : 0.78);
      const fy = 62;
      ctx.save();
      ctx.globalAlpha = Math.sin(fProg * Math.PI) * 0.55;
      for (let ray = 0; ray < 8; ray++) {
        const ang = (ray / 8) * Math.PI * 2;
        const rad = 10 + fProg * 32;
        drawSparkleStar(
          ctx,
          fx + Math.cos(ang) * rad,
          fy + Math.sin(ang) * rad,
          4.5,
          fw === 0 ? '#F086A1' : '#58BA83'
        );
      }
      ctx.restore();
    }

    // Glowing Festival Paper Lanterns ("ちょうちん")
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.quadraticCurveTo(w * 0.5, 42, w, 16);
    ctx.stroke();

    const lanternCount = 7;
    for (let i = 0; i < lanternCount; i++) {
      const lx = (w * (i + 0.5)) / lanternCount;
      const ly = 22 + Math.sin((i / (lanternCount - 1)) * Math.PI) * 12 + Math.sin(t * 3 + i) * 2;
      ctx.fillStyle = 'rgba(252, 198, 104, 0.28)';
      ctx.beginPath();
      ctx.arc(lx, ly + 8, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = i % 2 === 0 ? '#EE7A5A' : '#FCC668';
      ctx.beginPath();
      ctx.ellipse(lx, ly + 8, 9, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Meadow Ground
    const groundY = h - 16;
    ctx.fillStyle = '#B8DFC3';
    ctx.fillRect(0, h - 38, w, 38);

    if (miniGameState === 'playing') {
      if (moveDirRef.current !== 0) {
        playerXNormRef.current = Math.max(
          0.09,
          Math.min(0.91, playerXNormRef.current + moveDirRef.current * dt * 0.72)
        );
      }

      if (Math.random() < dt * 2.4 && treatsRef.current.length < 7) {
        const roll = Math.random();
        const kind: FallingTreat['kind'] =
          roll < 0.28 ? 'gold_coin' : roll < 0.52 ? 'apple' : roll < 0.76 ? 'orange' : 'cookie';
        treatsRef.current.push({
          id: nextTreatIdRef.current++,
          xNorm: 0.1 + Math.random() * 0.8,
          yNorm: 0.14,
          speed: 0.28 + Math.random() * 0.14,
          kind,
        });
      }

      const momoPx = w * playerXNormRef.current;

      const kept: FallingTreat[] = [];
      for (const tr of treatsRef.current) {
        tr.yNorm += tr.speed * dt;
        const tx = w * tr.xNorm;
        const ty = h * tr.yNorm;

        if (Math.abs(tx - momoPx) < 44 && Math.abs(ty - (groundY - 34)) < 34) {
          const pts = tr.kind === 'gold_coin' ? 3 : 1;
          scoreRef.current += pts;
          setScoreCoins(scoreRef.current);
          soundEngine.playFruitCatch(tr.kind === 'gold_coin');
          popupsRef.current.push({
            id: nextTreatIdRef.current++,
            x: tx,
            y: ty - 10,
            text: `+${pts} コイン!`,
            bornSec: t,
          });
          continue;
        }

        if (tr.yNorm < 0.94) {
          kept.push(tr);
          if (tr.kind === 'gold_coin') {
            ctx.fillStyle = '#FCC668';
            ctx.strokeStyle = '#9A5B13';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(tx, ty, 11.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#9A4816';
            ctx.font = 'bold 11px "Zen Maru Gothic", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('3', tx, ty + 4);
          } else {
            drawShoppingItemDetailed(ctx, tr.kind, tx, ty, 0.96);
          }
        }
      }
      treatsRef.current = kept;

      // Full-Body Momo Catching Treats!
      drawMomoFull(ctx, momoPx, groundY, 0.96, t, {
        walking: moveDirRef.current !== 0,
        basket: true,
      });

      // Floating "+1 / +3 コイン!" Popups
      popupsRef.current = popupsRef.current.filter((p) => t - p.bornSec < 0.65);
      for (const p of popupsRef.current) {
        const age = (t - p.bornSec) / 0.65;
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = '#9A4816';
        ctx.font = 'bold 13px "Zen Maru Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y - age * 24);
        ctx.restore();
      }
    } else {
      // Grand Festival Celebration Parade: Full-Body Momo + All 5 Animal Friends Dancing!
      const spacing = Math.min(82, w / 7);
      const centerX = w * 0.5;
      DELIVERY_NODES.forEach((node, idx) => {
        const offset = (idx - 2) * spacing;
        const ax = centerX + offset + (idx >= 2 ? spacing * 0.52 : -spacing * 0.52);
        drawVillageAnimalBuddy(ctx, node.key, ax, groundY - 2, 1.08, t + idx, true);
      });
      drawMomoFull(ctx, centerX, groundY, 1.02, t, {
        jumpHeight: Math.abs(Math.sin(t * 4.4)) * 9,
      });

      // Drifting Festival Confetti Petals
      for (let c = 0; c < 14; c++) {
        const cx = (c * 73 + t * 24) % w;
        const cy = (c * 41 + t * 30) % (h - 28);
        ctx.fillStyle = c % 3 === 0 ? '#FCC668' : c % 3 === 1 ? '#F086A1' : '#58BA83';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [miniGameState]);

  const handlePointerMoveOnCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (miniGameState !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const norm = (e.clientX - rect.left) / Math.max(1, rect.width);
    playerXNormRef.current = Math.max(0.09, Math.min(0.91, norm));
  };

  return (
    <div className="rounded-3xl border-2 border-[#E6C785] bg-[#FFFDF8] p-4 sm:p-5 shadow-2xs space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-[#C86428]">
            おまつり 広場 ＆ ボーナスミニゲーム（なんかいでも コインが あつめられるよ！）
          </div>
          <h3 className="font-heading text-lg sm:text-xl font-bold text-[#3A3128]">
            まちの おまつり とうちゃく！・くだものキャッチ
          </h3>
        </div>

        {miniGameState === 'playing' ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#E6C785] bg-[#FFF8E6] px-4 py-1.5 text-sm font-bold text-[#9A4816] tabular-nums">
            <span>キャッチ: +{scoreCoins}コイン</span>
            <span>·</span>
            <span>のこり {secondsLeft}びょう</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startCatchGame}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-[#2F7A54] border-b-4 border-[#1F563B] px-5 py-2 font-heading text-sm sm:text-base font-bold text-white transition-transform active:translate-y-0.5 hover:bg-[#256344]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>
              {miniGameState === 'finished'
                ? 'もういちど キャッチで あそぶ！'
                : 'くだものキャッチで あそぶ！'}
            </span>
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerMoveOnCanvas}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            handlePointerMoveOnCanvas(e);
          }
        }}
        className="relative h-[216px] sm:h-[240px] w-full overflow-hidden rounded-2xl border-2 border-[#DFD2BC] bg-[#FFF9EB] touch-none cursor-pointer"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {miniGameState === 'playing' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onPointerDown={() => {
              moveDirRef.current = -1;
            }}
            onPointerUp={() => {
              moveDirRef.current = 0;
            }}
            onPointerLeave={() => {
              moveDirRef.current = 0;
            }}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-[#DFD4C0] border-b-4 bg-[#FAF5EC] font-heading text-base font-bold text-[#3A3128] active:translate-y-0.5 select-none"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>ひだりへ うごく</span>
          </button>
          <button
            type="button"
            onPointerDown={() => {
              moveDirRef.current = 1;
            }}
            onPointerUp={() => {
              moveDirRef.current = 0;
            }}
            onPointerLeave={() => {
              moveDirRef.current = 0;
            }}
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border-2 border-[#DFD4C0] border-b-4 bg-[#FAF5EC] font-heading text-base font-bold text-[#3A3128] active:translate-y-0.5 select-none"
          >
            <span>みぎへ うごく</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
