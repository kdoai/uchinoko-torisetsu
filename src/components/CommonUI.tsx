import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Download,
  Home,
  Lock,
  Phone,
  Printer,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import { jsPDF } from 'jspdf';
import type { ObservationCategory, ObservationSide } from '../types/models';

const RUBY_PATTERN = /\{([^|{}]+)\|([^{}]+)\}/g;

export function stripRubyForSpeech(input: string): string {
  return input.replace(RUBY_PATTERN, '$2');
}

export function stripRubyToKanji(input: string): string {
  return input.replace(RUBY_PATTERN, '$1');
}

export const RubyText: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(RUBY_PATTERN.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <ruby key={`${match.index}-${match[1]}`} className="mx-0.5">
        {match[1]}
        <rt>{match[2]}</rt>
      </ruby>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
};

export function speakJapaneseText(text: string, onSpoken?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stripRubyForSpeech(text));
    utterance.lang = 'ja-JP';
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
    onSpoken?.();
  } catch {
    // Ignore browser TTS unavailability
  }
}

export function hashAdultPin(pin: string): string {
  let h = 2166136261;
  const salted = `uchinoko_pin_v1_${pin.trim()}`;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `p_${(h >>> 0).toString(16)}`;
}

export const SIDE_LABELS: Record<ObservationSide, string> = {
  game: 'ゲームの記録',
  child: '子どもの声',
  school: '学校の記録',
  home: '家庭の記録',
};

export const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  strength: '好きなこと・得意なこと',
  worked_well: 'うまくいった関わり方',
  hard: '大変そうだった場面',
  child_said: '本人が伝えたこと',
  other: 'その他の事実',
};

export const SideDotLabel: React.FC<{ side: ObservationSide }> = ({ side }) => {
  const Icon =
    side === 'home'
      ? Home
      : side === 'child'
        ? Sun
        : side === 'game'
          ? Compass
          : BookOpen;

  const textColor =
    side === 'home'
      ? 'text-[#215C3E]'
      : side === 'child'
        ? 'text-[#9A4816]'
        : 'text-[#1F5654]';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${textColor}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{SIDE_LABELS[side]}</span>
    </span>
  );
};

// ============================================================================
// Chapter 12A: Adult Safety Emergency Modal (Shown immediately on keyword match)
// ============================================================================
export const AdultSafetyModal: React.FC<{
  open: boolean;
  onClose: () => void;
  supervisorName?: string;
  versionLabel?: string;
}> = ({
  open,
  onClose,
  supervisorName = '児童福祉・学校危機管理・教育相談専門職 監修',
  versionLabel = 'v1.0',
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A3128]/35 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#B83227]/30 bg-white p-6 shadow-[0_16px_48px_rgba(58,49,40,0.16)] sm:p-7">
        <div className="flex items-start justify-between gap-3 border-b border-[#EAE2D3] pb-4">
          <div className="flex items-center gap-2.5 text-[#B83227]">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h2 className="text-lg font-bold">安全と緊急の連絡先のご案内</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#3A3128]">
          入力された内容に、命の安全や緊急の支援に関わる可能性のある言葉が含まれていました。
          このアプリのAIは緊急の対応や判断を行うことができません。危険や切迫した心配があるときは、すぐに下記の専門窓口へご連絡ください。
        </p>

        <div className="mt-5 space-y-3">
          <a
            href="tel:119"
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] px-4 py-3 text-[#B83227] transition-colors hover:bg-[#FCE4E2]"
          >
            <div>
              <div className="text-sm font-bold">命が危ないとき・救急（119番）</div>
              <div className="text-xs text-[#8C261D]">直ちに救急・医療の助けが必要なとき</div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-base font-bold tabular-nums">
              <Phone className="h-4 w-4" />
              119
            </span>
          </a>

          <a
            href="tel:110"
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] px-4 py-3 text-[#3A3128] transition-colors hover:bg-[#F3ECE0]"
          >
            <div>
              <div className="text-sm font-bold">事件・身の危険があるとき・警察（110番）</div>
              <div className="text-xs text-[#6E6254]">緊急の保護が必要なとき</div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-base font-bold tabular-nums">
              <Phone className="h-4 w-4" />
              110
            </span>
          </a>

          <a
            href="tel:0120078310"
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] px-4 py-3 text-[#3A3128] transition-colors hover:bg-[#FFE9D2]"
          >
            <div>
              <div className="text-sm font-bold">24時間子供SOSダイヤル（文部科学省）</div>
              <div className="text-xs text-[#6E6254]">夜間・休日も無料につながる相談窓口</div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#9A4816] tabular-nums">
              <Phone className="h-4 w-4" />
              0120-0-78310
            </span>
          </a>

          <a
            href="tel:189"
            className="flex min-h-[54px] items-center justify-between rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-4 py-3 text-[#3A3128] transition-colors hover:bg-[#DFF0E5]"
          >
            <div>
              <div className="text-sm font-bold">児童相談所虐待対応ダイヤル（いちはやく）</div>
              <div className="text-xs text-[#6E6254]">
                虐待かもと思ったらすぐにお電話ください（通話料無料）
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-base font-bold text-[#215C3E] tabular-nums">
              <Phone className="h-4 w-4" />
              189
            </span>
          </a>
        </div>

        <div className="mt-5 border-t border-[#EAE2D3] pt-3 text-xs text-[#6E6254]">
          監修・確認：{supervisorName} ／ 版：{versionLabel}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#256344]"
          >
            確認しました
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Adult 4-Digit PIN Setup & Unlock Modals (Prevents Child Exiting to Adult Screen)
// ============================================================================
export const AdultPinLaunchModal: React.FC<{
  open: boolean;
  childNickname: string;
  placeLabel: string;
  onCancel: () => void;
  onConfirmLaunch: (pinHash: string, deviceType: 'tablet' | 'smartphone' | 'pc') => void;
}> = ({ open, childNickname, placeLabel, onCancel, onConfirmLaunch }) => {
  const [pin, setPin] = useState('');
  const [deviceType, setDeviceType] = useState<'tablet' | 'smartphone' | 'pc'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 'smartphone';
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'tablet';
    return 'pc';
  });
  const [error, setError] = useState('');

  if (!open) return null;

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('大人の暗証番号（数字4けた）を入力してください。');
      return;
    }
    setError('');
    onConfirmLaunch(hashAdultPin(pin), deviceType);
    setPin('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A3128]/35 p-4 backdrop-blur-xs"
    >
      <form
        onSubmit={handleStart}
        className="w-full max-w-md rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_16px_48px_rgba(58,49,40,0.14)] sm:p-7"
      >
        <div className="flex items-center gap-2.5 text-[#3A3128]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF3E6] text-[#C86428]">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-bold">子ども画面「がっこう たんけん」を開く</h3>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#6E6254]">
          {childNickname}さんの冒険画面に切り替えます（実施場所：{placeLabel}）。
          お子さんが大人の画面へ戻れないよう、終了時に使う4けたの暗証番号を決めてください。
        </p>

        <div className="mt-5">
          <label className="block text-xs font-bold text-[#3A3128]">使う端末の種類</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                { key: 'tablet', label: 'タブレット' },
                { key: 'smartphone', label: 'スマホ' },
                { key: 'pc', label: 'PC' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDeviceType(opt.key)}
                className={`min-h-[46px] rounded-xl border px-3 text-sm font-bold whitespace-nowrap transition-colors ${
                  deviceType === opt.key
                    ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                    : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-bold text-[#3A3128]">
            大人用の4けた暗証番号（終了するときに入力）
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="例：1234"
            className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-center text-xl tracking-[0.4em] text-[#3A3128] tabular-nums focus:border-[#2F7A54]"
          />
          {error && <p className="mt-2 text-xs font-bold text-[#B83227]">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[46px] rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="min-h-[46px] rounded-xl bg-[#C86428] px-5 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#B0541E]"
          >
            子どもに渡して始める
          </button>
        </div>
      </form>
    </div>
  );
};

export const AdultPinUnlockModal: React.FC<{
  open: boolean;
  expectedPinHash: string;
  onCancel: () => void;
  onUnlocked: () => void;
}> = ({ open, expectedPinHash, onCancel, onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (hashAdultPin(pin) !== expectedPinHash) {
      setError('ばんごうが ちがいます。おとなの ひとに きいてね。');
      return;
    }
    setPin('');
    setError('');
    onUnlocked();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A3128]/35 p-4 backdrop-blur-xs"
    >
      <form
        onSubmit={handleUnlock}
        className="w-full max-w-sm rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_16px_48px_rgba(58,49,40,0.14)]"
      >
        <div className="flex items-center gap-2.5 text-[#3A3128]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF7F0] text-[#2F7A54]">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-bold">おとなの ひとへ（終了の確認）</h3>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-[#6E6254]">
          開始時に決めた4けたの暗証番号を入力すると、大人の画面に戻ります。
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4けた"
          className="mt-4 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-center text-xl tracking-[0.4em] text-[#3A3128] tabular-nums focus:border-[#2F7A54]"
        />
        {error && <p className="mt-2 text-xs font-bold text-[#B83227]">{error}</p>}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[46px] rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
          >
            もどる
          </button>
          <button
            type="submit"
            className="min-h-[46px] rounded-xl bg-[#2F7A54] px-5 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344]"
          >
            大人の画面へ戻る
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// Printable & PDF Export Modal (Uses modern-screenshot + jsPDF, no window APIs)
// ============================================================================
export const PrintableExportModal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  filename: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, subtitle, filename, onClose, children }) => {
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (!open) return null;

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await domToPng(printAreaRef.current, {
        scale: 2,
        backgroundColor: '#FFFFFF',
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('画像変換に失敗しました'));
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const renderedHeight = (img.height * contentWidth) / img.width;

      if (renderedHeight <= pageHeight - margin * 2) {
        pdf.addImage(dataUrl, 'PNG', margin, margin, contentWidth, renderedHeight);
      } else {
        let remainingHeight = renderedHeight;
        let offsetY = 0;
        let first = true;
        const usableHeight = pageHeight - margin * 2;
        while (remainingHeight > 0) {
          if (!first) pdf.addPage();
          pdf.addImage(dataUrl, 'PNG', margin, margin - offsetY, contentWidth, renderedHeight);
          remainingHeight -= usableHeight;
          offsetY += usableHeight;
          first = false;
        }
      }

      pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A3128]/35 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#EAE2D3] bg-[#FFFDF8] shadow-[0_20px_60px_rgba(58,49,40,0.18)]">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D3] bg-white px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-[#3A3128]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-[#6E6254]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2F7A54] px-4 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'PDF作成中...' : 'PDFを保存'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
            >
              <Printer className="h-4 w-4" />
              印刷する
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-7">
          <div
            ref={printAreaRef}
            className="print-sheet mx-auto max-w-2xl rounded-2xl border border-[#EAE2D3] bg-white p-6 text-[#3A3128] sm:p-8"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TtsButton: React.FC<{
  text: string;
  onUsed?: () => void;
  label?: string;
}> = ({ text, onUsed, label = 'こえで きく' }) => (
  <button
    type="button"
    onClick={() => speakJapaneseText(text, onUsed)}
    className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#BFE0C9] bg-[#EDF7F0] px-4 py-2 text-sm font-bold text-[#215C3E] whitespace-nowrap transition-colors hover:bg-[#DFF0E5]"
  >
    <Volume2 className="h-4 w-4 shrink-0" />
    <span>{label}</span>
  </button>
);
