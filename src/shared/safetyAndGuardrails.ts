/**
 * Shared deterministic safety detectors and Gemini A / Gemini B output validators.
 * Pure TypeScript (erasable types only) so both server.ts (Node 22 / tsx) and Vite client can import it.
 */

export interface GeminiAResponse {
  line: string;
  choices: string[];
  allow_free_text: boolean;
  end_topic: boolean;
  safety_review: boolean;
}

export interface GeminiBObservationProposal {
  temp_id: string;
  side: 'school' | 'home';
  category: 'strength' | 'worked_well' | 'hard' | 'child_said' | 'other';
  fact: string;
  suggest_share: boolean;
  candidate_student?: string | null;
}

export interface GeminiBUnassignedItem {
  text: string;
  reason: string;
}

export interface GeminiBHypothesisProposal {
  temp_id: string;
  text: string;
  evidence_existing_ids: string[];
  evidence_new_temp_ids: string[];
  evidence_sides: Array<'game' | 'child' | 'school' | 'home'>;
  why: string;
}

export interface GeminiBDifferenceProposal {
  items: Array<{
    side: 'game' | 'child' | 'school' | 'home';
    fact: string;
  }>;
  evidence_existing_ids: string[];
  evidence_new_temp_ids: string[];
  note: string;
}

export interface GeminiBTrialProposal {
  where: 'school' | 'home';
  text: string;
  based_on_existing_ids: string[];
  based_on_new_temp_ids: string[];
  why: string;
  adjusts_trial_id?: string | null;
}

export interface GeminiBConcernItem {
  fact: string;
  evidence_existing_ids: string[];
  evidence_new_temp_ids: string[];
}

export interface GeminiBResponse {
  message: string;
  new_observations: GeminiBObservationProposal[];
  unassigned: GeminiBUnassignedItem[];
  class_level: string[];
  new_hypotheses: GeminiBHypothesisProposal[];
  differences: GeminiBDifferenceProposal[];
  suggested_trials: GeminiBTrialProposal[];
  concerns: GeminiBConcernItem[];
  memo?: string | null;
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s　、。！？!?「」『』（）()・…ー\-]/g, '');
}

/**
 * Chapter 5 & 12B: Fixed child safety keyword list (normalized without spaces/punctuation).
 */
export const CHILD_SAFETY_PATTERNS_RAW: string[] = [
  'しにたい',
  '死にたい',
  'きえたい',
  '消えたい',
  'いなくなりたい',
  '居なくなりたい',
  'たたかれる',
  '叩かれる',
  'けられる',
  '蹴られる',
  'なぐられる',
  '殴られる',
  'こわい人がいる',
  'こわいひとがいる',
  '怖い人がいる',
  'おうちにかえりたくない',
  '家に帰りたくない',
  'いえにかえりたくない',
  'ごはんをもらえない',
  'ご飯をもらえない',
  'だれにもいわないで',
  '誰にも言わないで',
  'ひみつにして',
  '秘密にして',
  'じぶんをきずつける',
  '自分を傷つけ',
  'ぎゃくたい',
  '虐待',
  'ぼうりょく',
  '暴力',
  'いたくされる',
  '痛くされる',
];

export function containsChildSafetyKeyword(text: string): boolean {
  if (!text || !text.trim()) return false;
  const norm = normalizeForMatch(text);
  return CHILD_SAFETY_PATTERNS_RAW.some((kw) => norm.includes(normalizeForMatch(kw)));
}

/**
 * Chapter 12A: Fixed adult safety keyword list triggering immediate emergency guidance screen.
 */
export const ADULT_SAFETY_PATTERNS_RAW: string[] = [
  '死にたい',
  'しにたい',
  '消えたい',
  'きえたい',
  'いなくなりたい',
  '自殺',
  '自傷',
  '自分を傷つけ',
  'リストカット',
  '命が危ない',
  '虐待',
  'たたいてしま',
  '叩いてしま',
  '殴ってしま',
  'なぐってしま',
  '手をあげてしま',
  '暴力をふる',
  '家に帰りたくないと言',
  'おうちに帰りたくないと言',
];

export function containsAdultSafetyKeyword(text: string): boolean {
  if (!text || !text.trim()) return false;
  const norm = normalizeForMatch(text);
  return ADULT_SAFETY_PATTERNS_RAW.some((kw) => norm.includes(normalizeForMatch(kw)));
}

/**
 * Chapter 10: Banned evaluation / clinical words in child-facing Gemini A output.
 */
const CHILD_OUTPUT_BANNED_TERMS: string[] = [
  'にがてな子',
  'たいへんな子',
  '病院',
  'びょういん',
  'しんさつ',
  '診察',
  'けんさ',
  '検査',
  '受診',
  'じゅしん',
  'ADHD',
  'ASD',
  'LD',
  '発達障害',
  '傾向',
  '点数',
  '正解',
  '不正解',
  '遅れて',
  'おくれて',
  '問題児',
];

export function validateGeminiAResponse(raw: unknown): {
  valid: boolean;
  reason?: string;
  cleaned?: GeminiAResponse;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'JSONオブジェクトではありません' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.line !== 'string' || !obj.line.trim()) {
    return { valid: false, reason: 'line が文字列ではありません' };
  }
  if (!Array.isArray(obj.choices) || !obj.choices.every((c) => typeof c === 'string')) {
    return { valid: false, reason: 'choices が文字列配列ではありません' };
  }
  if (typeof obj.allow_free_text !== 'boolean' || typeof obj.end_topic !== 'boolean' || typeof obj.safety_review !== 'boolean') {
    return { valid: false, reason: '真偽値フィールドが不足しています' };
  }

  const combinedText = [obj.line, ...obj.choices].join(' ');
  for (const term of CHILD_OUTPUT_BANNED_TERMS) {
    if (combinedText.toLowerCase().includes(term.toLowerCase())) {
      return { valid: false, reason: `子ども向け禁止語が含まれています: ${term}` };
    }
  }

  if (obj.safety_review) {
    return {
      valid: true,
      cleaned: {
        line: 'おしえてくれて ありがとう。たよれる おとなに つたえて、たすけて もらおうね',
        choices: [],
        allow_free_text: false,
        end_topic: true,
        safety_review: true,
      },
    };
  }

  // Ensure choices end with わからない and こたえたくない when choices are present
  const baseChoices = (obj.choices as string[]).filter(
    (c) => c !== 'わからない' && c !== 'こたえたくない'
  );
  const finalChoices = obj.end_topic ? [] : [...baseChoices.slice(0, 4), 'わからない', 'こたえたくない'];

  return {
    valid: true,
    cleaned: {
      line: obj.line.trim(),
      choices: finalChoices,
      allow_free_text: Boolean(obj.allow_free_text),
      end_topic: Boolean(obj.end_topic),
      safety_review: false,
    },
  };
}

/**
 * Chapter 1 & 11: Banned clinical / evaluative / comparative words in Gemini B output.
 */
export const GEMINI_B_BANNED_TERMS: string[] = [
  'ADHD',
  'ASD',
  'LD',
  '自閉',
  '発達障害',
  '障害の疑い',
  '受診',
  '病院',
  '診察',
  'IQ',
  '知能指数',
  '能力が低い',
  '処理が遅い',
  '注意力が低い',
  '遅れている',
  '発達の遅れ',
  '問題児',
  '落ち着きのない子',
  '平均より',
  'クラスで一番',
  '傾向があり',
  '傾向がある',
  'の傾向',
  '可能性が高い順',
  '問題ありません',
  '心配ありません',
  '医療機関',
  'クリニック',
  '児童精神科',
  '小児科へ行',
  '小児科に行',
];

function containsBannedTermForGeminiB(
  text: string,
  mode: string,
  rawParentConsultText: string
): string | null {
  if (!text) return null;
  let target = text;
  // Chapter 11 exception: In medical_memo, '受診' and '病院' are allowed ONLY inside the verbatim parent consultation sentence.
  if (mode === 'medical_memo' && rawParentConsultText && rawParentConsultText.trim()) {
    target = target.split(rawParentConsultText.trim()).join('');
  }
  const lower = target.toLowerCase();
  for (const term of GEMINI_B_BANNED_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

export function validateGeminiBResponse(
  raw: unknown,
  mode: string,
  allowedExistingIds: string[],
  rawParentConsultText = ''
): { valid: boolean; reason?: string; data?: GeminiBResponse } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: '応答がオブジェクトではありません' };
  }
  const obj = raw as Record<string, unknown>;

  const requiredArrays = [
    'new_observations',
    'unassigned',
    'class_level',
    'new_hypotheses',
    'differences',
    'suggested_trials',
    'concerns',
  ] as const;

  if (typeof obj.message !== 'string') {
    return { valid: false, reason: 'message が文字列ではありません' };
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      return { valid: false, reason: `${key} が配列ではありません` };
    }
  }
  if (obj.memo !== undefined && obj.memo !== null && typeof obj.memo !== 'string') {
    return { valid: false, reason: 'memo の型が不正です' };
  }

  const existingSet = new Set(allowedExistingIds);
  const newObs = obj.new_observations as GeminiBObservationProposal[];
  const tempIdSet = new Set<string>();

  for (const o of newObs) {
    if (!o || typeof o !== 'object') return { valid: false, reason: 'new_observations の要素が不正です' };
    if (typeof o.temp_id !== 'string' || !o.temp_id.trim()) {
      return { valid: false, reason: 'new_observations.temp_id が空です' };
    }
    if (o.side !== 'school' && o.side !== 'home') {
      return { valid: false, reason: 'new_observations.side が不正です' };
    }
    if (!['strength', 'worked_well', 'hard', 'child_said', 'other'].includes(o.category)) {
      return { valid: false, reason: 'new_observations.category が不正です' };
    }
    if (typeof o.fact !== 'string' || !o.fact.trim()) {
      return { valid: false, reason: 'new_observations.fact が空です' };
    }
    if (typeof o.suggest_share !== 'boolean') {
      return { valid: false, reason: 'new_observations.suggest_share が真偽値ではありません' };
    }
    tempIdSet.add(o.temp_id);
  }

  const newHyps = obj.new_hypotheses as GeminiBHypothesisProposal[];
  for (const h of newHyps) {
    if (!h || typeof h !== 'object') return { valid: false, reason: 'new_hypotheses の要素が不正です' };
    if (typeof h.temp_id !== 'string' || typeof h.text !== 'string' || typeof h.why !== 'string') {
      return { valid: false, reason: 'new_hypotheses の必須文字列が不足しています' };
    }
    if (!Array.isArray(h.evidence_existing_ids) || !Array.isArray(h.evidence_new_temp_ids) || !Array.isArray(h.evidence_sides)) {
      return { valid: false, reason: 'new_hypotheses の根拠配列が不正です' };
    }
    if (h.evidence_existing_ids.length + h.evidence_new_temp_ids.length === 0) {
      return { valid: false, reason: '根拠IDのない仮説が含まれています' };
    }
    for (const eid of h.evidence_existing_ids) {
      if (!existingSet.has(eid)) {
        return { valid: false, reason: `存在しない既存ID ${eid} が仮説の根拠に指定されています` };
      }
    }
    for (const tid of h.evidence_new_temp_ids) {
      if (!tempIdSet.has(tid)) {
        return { valid: false, reason: `今回の応答に存在しない仮ID ${tid} が仮説の根拠に指定されています` };
      }
    }
    for (const side of h.evidence_sides) {
      if (!['game', 'child', 'school', 'home'].includes(side)) {
        return { valid: false, reason: `不正な evidence_sides: ${side}` };
      }
    }
  }

  const trials = obj.suggested_trials as GeminiBTrialProposal[];
  for (const t of trials) {
    if (!t || typeof t !== 'object') return { valid: false, reason: 'suggested_trials の要素が不正です' };
    if ((t.where !== 'school' && t.where !== 'home') || typeof t.text !== 'string' || typeof t.why !== 'string') {
      return { valid: false, reason: 'suggested_trials の必須項目が不正です' };
    }
    if (!Array.isArray(t.based_on_existing_ids) || !Array.isArray(t.based_on_new_temp_ids)) {
      return { valid: false, reason: 'suggested_trials の根拠配列が不正です' };
    }
    for (const eid of t.based_on_existing_ids) {
      if (!existingSet.has(eid)) {
        return { valid: false, reason: `存在しない既存ID ${eid} が suggested_trials に含まれています` };
      }
    }
    for (const tid of t.based_on_new_temp_ids) {
      if (!tempIdSet.has(tid)) {
        return { valid: false, reason: `存在しない仮ID ${tid} が suggested_trials に含まれています` };
      }
    }
  }

  const diffs = obj.differences as GeminiBDifferenceProposal[];
  for (const d of diffs) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.items) || !Array.isArray(d.evidence_existing_ids) || !Array.isArray(d.evidence_new_temp_ids)) {
      return { valid: false, reason: 'differences の構造が不正です' };
    }
    for (const eid of d.evidence_existing_ids) {
      if (!existingSet.has(eid)) {
        return { valid: false, reason: `存在しない既存ID ${eid} が differences に含まれています` };
      }
    }
    for (const tid of d.evidence_new_temp_ids) {
      if (!tempIdSet.has(tid)) {
        return { valid: false, reason: `存在しない仮ID ${tid} が differences に含まれています` };
      }
    }
  }

  const concerns = obj.concerns as GeminiBConcernItem[];
  for (const c of concerns) {
    if (!c || typeof c !== 'object' || typeof c.fact !== 'string' || !Array.isArray(c.evidence_existing_ids) || !Array.isArray(c.evidence_new_temp_ids)) {
      return { valid: false, reason: 'concerns の構造が不正です' };
    }
    for (const eid of c.evidence_existing_ids) {
      if (!existingSet.has(eid)) {
        return { valid: false, reason: `存在しない既存ID ${eid} が concerns に含まれています` };
      }
    }
    for (const tid of c.evidence_new_temp_ids) {
      if (!tempIdSet.has(tid)) {
        return { valid: false, reason: `存在しない仮ID ${tid} が concerns に含まれています` };
      }
    }
  }

  // Scan all text fields for banned diagnostic/comparative/medical terms
  const textsToScan: string[] = [
    obj.message as string,
    ...newObs.map((o) => o.fact),
    ...(obj.unassigned as GeminiBUnassignedItem[]).flatMap((u) => [u.text, u.reason]),
    ...(obj.class_level as string[]),
    ...newHyps.flatMap((h) => [h.text, h.why]),
    ...diffs.flatMap((d) => [d.note, ...d.items.map((it) => it.fact)]),
    ...trials.flatMap((t) => [t.text, t.why]),
    ...concerns.map((c) => c.fact),
  ];
  if (typeof obj.memo === 'string') {
    textsToScan.push(obj.memo);
  }

  for (const txt of textsToScan) {
    const hit = containsBannedTermForGeminiB(txt, mode, rawParentConsultText);
    if (hit) {
      return { valid: false, reason: `禁止語「${hit}」が応答に含まれています` };
    }
  }

  return { valid: true, data: obj as unknown as GeminiBResponse };
}
