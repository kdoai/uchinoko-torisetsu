/**
 * Chapter 9: Fixed Consultation Directory (固定の対応表)
 * Never modified or ranked by AI. Everyone selecting the same concern always sees the exact same row.
 */

export interface ConsultationRow {
  id: string;
  concern: string;
  firstTalkTo: string;
  medicalDepartments: string;
  searchableDepartments: string[];
}

export const EMERGENCY_TOP_BANNER_TEXT =
  '命が危ないと感じたら、すぐ 119 番へ。救急車を呼ぶか迷うときは #7119（ない地域もあります）。子どもの急な病気で迷うときは #8000。';

export const CONSULTATION_FIXED_ROWS: ConsultationRow[] = [
  {
    id: 'c_focus',
    concern: '授業や宿題に集中しにくい、忘れ物が多い、じっとしているのが大変',
    firstTalkTo: '担任の先生、スクールカウンセラー',
    medicalDepartments: '小児科（発達の相談）、児童精神科',
    searchableDepartments: ['小児科', '児童精神科'],
  },
  {
    id: 'c_rwa',
    concern: '読む・書く・計算のどれかが、特に大変そう',
    firstTalkTo: '担任の先生、特別支援教育コーディネーター',
    medicalDepartments: '小児科（発達の相談）、児童精神科、発達障害者支援センター',
    searchableDepartments: ['小児科', '児童精神科', '発達障害者支援センター'],
  },
  {
    id: 'c_vision',
    concern: '黒板の字が見えにくい、目が疲れやすい',
    firstTalkTo: '担任の先生、養護教諭',
    medicalDepartments: '眼科',
    searchableDepartments: ['眼科'],
  },
  {
    id: 'c_hearing',
    concern: '話が聞き取りにくい、聞き返しが多い',
    firstTalkTo: '担任の先生、養護教諭',
    medicalDepartments: '耳鼻咽喉科',
    searchableDepartments: ['耳鼻咽喉科'],
  },
  {
    id: 'c_motor',
    concern: '手先を使う作業や運動が、特に大変そう',
    firstTalkTo: '担任の先生',
    medicalDepartments: '小児科（発達の相談）',
    searchableDepartments: ['小児科'],
  },
  {
    id: 'c_speech',
    concern: 'ことばで説明する・話を理解するのが大変そう',
    firstTalkTo: '担任の先生、ことばの教室（通級）',
    medicalDepartments: '小児科（発達の相談）',
    searchableDepartments: ['小児科'],
  },
  {
    id: 'c_mood_friends',
    concern: '友だち関係で悩んでいる、気持ちが落ち込んでいる、学校に行きたくないと言う',
    firstTalkTo: '担任の先生、スクールカウンセラー、地域の子育て相談窓口（こども家庭センターなど）',
    medicalDepartments: '小児科、児童精神科',
    searchableDepartments: ['小児科', '児童精神科', 'こども家庭センター'],
  },
  {
    id: 'c_sleep',
    concern: '眠りにくい、朝起きられない',
    firstTalkTo: '養護教諭',
    medicalDepartments: '小児科',
    searchableDepartments: ['小児科'],
  },
];

export const CONSULTATION_BOTTOM_NOTES: string[] = [
  '子どもは、多くの場合まず小児科で相談できます。',
  'どの相談先でも、相談するのに診断名は必要ありません。',
  'この表は、気になることごとに、よく相談される相手と診療科を並べたものです。お子さんの状態を判断したものではありません。',
];

export const REFERRAL_LETTER_EXPLANATION =
  '紹介状がなくても受診はできます。ただし、国が決めた大きな病院（大学病院の多くと、ベッド数200以上の一部の病院）では、紹介状なしの初診に7,000円以上の追加料金がかかります。救急のときは、この追加料金はかかりません。専門の外来は、まず小児科に相談して紹介してもらう方法もあります。専門の外来は、地域によって初診まで数か月かかることがあります。';

export function buildGoogleMapsSearchUrl(department: string, areaText: string): string {
  const q = `${department} ${areaText.trim()}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
