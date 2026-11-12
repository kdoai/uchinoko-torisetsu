import type { GradeBand } from '../types/models';

export const GAME_BANK_VERSION = '低学年版v1';

export type ShoppingErrorKind = '' | 'op_swap' | 'count_slip' | 'digit_error';
export type ShoppingItemIconKey =
  | 'apple'
  | 'orange'
  | 'bread'
  | 'candy'
  | 'gum'
  | 'pencil'
  | 'notebook'
  | 'eraser'
  | 'banana'
  | 'cookie';

export interface ShoppingChoice {
  label: string;
  value: number;
  errorType: ShoppingErrorKind;
}

export interface ShoppingQuestion {
  id: string;
  pairIndex: number;
  condition: 'illust' | 'text';
  prompt: string;
  hint: string;
  visualItems?: Array<{
    icon: ShoppingItemIconKey;
    name: string;
    price: number;
  }>;
  operation: 'add' | 'sub';
  choices: ShoppingChoice[];
  isPractice?: boolean;
}

export type DeliveryAnimalKey = 'rabbit' | 'bear' | 'fox' | 'frog' | 'bird';

export interface DeliveryNodeSpec {
  key: DeliveryAnimalKey;
  animalLabel: string;
  houseLabel: string;
  shapeLabel: 'circle' | 'square' | 'triangle' | 'pentagon' | 'arch';
  colorHex: string;
  bgHex: string;
}

export const DELIVERY_NODES: DeliveryNodeSpec[] = [
  {
    key: 'rabbit',
    animalLabel: 'うさぎ',
    houseLabel: 'まるやねの あかい いえ',
    shapeLabel: 'circle',
    colorHex: '#D65A47',
    bgHex: '#FFF0ED',
  },
  {
    key: 'bear',
    animalLabel: 'くま',
    houseLabel: 'しかくやねの あおい いえ',
    shapeLabel: 'square',
    colorHex: '#3B7EA1',
    bgHex: '#ECF6FA',
  },
  {
    key: 'fox',
    animalLabel: 'きつね',
    houseLabel: 'さんかくやねの きいろい いえ',
    shapeLabel: 'triangle',
    colorHex: '#D48A27',
    bgHex: '#FFF8E6',
  },
  {
    key: 'frog',
    animalLabel: 'かえる',
    houseLabel: 'ごかくやねの みどりの いえ',
    shapeLabel: 'pentagon',
    colorHex: '#2F7A54',
    bgHex: '#EDF7F0',
  },
  {
    key: 'bird',
    animalLabel: 'ことり',
    houseLabel: 'あーちやねの むらさきの いえ',
    shapeLabel: 'arch',
    colorHex: '#845EC2',
    bgHex: '#F6F0FC',
  },
];

export interface DeliveryQuestion {
  id: string;
  length: 2 | 3 | 4 | 5;
  sequence: DeliveryAnimalKey[];
  hint: string;
  isPractice?: boolean;
}

function makeChoices(
  answer: number,
  opSwapVal: number,
  countSlipVal: number,
  digitErrVal: number
): ShoppingChoice[] {
  const raw: ShoppingChoice[] = [
    { label: `${answer}えん`, value: answer, errorType: '' },
    { label: `${opSwapVal}えん`, value: opSwapVal, errorType: 'op_swap' },
    { label: `${countSlipVal}えん`, value: countSlipVal, errorType: 'count_slip' },
    { label: `${digitErrVal}えん`, value: digitErrVal, errorType: 'digit_error' },
  ];
  // Deterministic ordering sorted by numeric value so there is no positional clue
  return [...raw].sort((a, b) => a.value - b.value);
}

// ============================================================================
// Practice Questions (2 per mini-game — NEVER recorded)
// ============================================================================
export const SHOPPING_PRACTICE_G1: ShoppingQuestion[] = [
  {
    id: 'prac_shop_g1_1',
    pairIndex: 0,
    condition: 'illust',
    prompt: 'れんしゅう 1：あわせて いくら？',
    hint: '3 と 2 を あわせるよ。',
    visualItems: [
      { icon: 'candy', name: 'あめ', price: 3 },
      { icon: 'gum', name: 'ガム', price: 2 },
    ],
    operation: 'add',
    choices: makeChoices(5, 1, 6, 15),
    isPractice: true,
  },
  {
    id: 'prac_shop_g1_2',
    pairIndex: 0,
    condition: 'text',
    prompt: 'れんしゅう 2：4えんの あめと、3えんの ガムを かいます。あわせて いくら ですか。',
    hint: '4 に 3 を たしてみよう。',
    operation: 'add',
    choices: makeChoices(7, 1, 8, 17),
    isPractice: true,
  },
];

export const SHOPPING_PRACTICE_G2: ShoppingQuestion[] = [
  {
    id: 'prac_shop_g2_1',
    pairIndex: 0,
    condition: 'illust',
    prompt: 'れんしゅう 1：あわせて いくら？',
    hint: '10えんと 20えんを あわせるよ。',
    visualItems: [
      { icon: 'candy', name: 'あめ', price: 10 },
      { icon: 'orange', name: 'みかん', price: 20 },
    ],
    operation: 'add',
    choices: makeChoices(30, 10, 31, 3),
    isPractice: true,
  },
  {
    id: 'prac_shop_g2_2',
    pairIndex: 0,
    condition: 'text',
    prompt: 'れんしゅう 2：20えんの ガムと、20えんの あめを かいます。あわせて いくら ですか。',
    hint: '20 に 20 を たしてみよう。',
    operation: 'add',
    choices: makeChoices(40, 0, 41, 4),
    isPractice: true,
  },
];

// ============================================================================
// Grade 1 Shopping Bank (Up to 20 addition & subtraction, Form A & Form B)
// Each Form has 6 matched pairs (12 questions): matched operation, magnitude, length
// ============================================================================
const SHOPPING_G1_FORM_A_PAIRS: Array<{ illust: ShoppingQuestion; text: ShoppingQuestion }> = [
  {
    illust: {
      id: 'g1_A_p1_i',
      pairIndex: 1,
      condition: 'illust',
      prompt: '8えんの あめと、5えんの ガム。あわせて いくら ですか。',
      hint: 'あわせて だから、8 と 5 を たすよ。',
      visualItems: [
        { icon: 'candy', name: 'あめ', price: 8 },
        { icon: 'gum', name: 'ガム', price: 5 },
      ],
      operation: 'add',
      choices: makeChoices(13, 3, 12, 31),
    },
    text: {
      id: 'g1_A_p1_t',
      pairIndex: 1,
      condition: 'text',
      prompt: '7えんの パンと、6えんの クッキーを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、7 と 6 を たすよ。',
      operation: 'add',
      choices: makeChoices(13, 1, 14, 31),
    },
  },
  {
    illust: {
      id: 'g1_A_p2_i',
      pairIndex: 2,
      condition: 'illust',
      prompt: '9えんの えんぴつと、4えんの けしゴム。あわせて いくら ですか。',
      hint: '9 に 4 を たしてみよう。',
      visualItems: [
        { icon: 'pencil', name: 'えんぴつ', price: 9 },
        { icon: 'eraser', name: 'けしゴム', price: 4 },
      ],
      operation: 'add',
      choices: makeChoices(13, 5, 14, 3),
    },
    text: {
      id: 'g1_A_p2_t',
      pairIndex: 2,
      condition: 'text',
      prompt: '8えんの みかんと、6えんの バナナを かいます。あわせて いくら ですか。',
      hint: '8 に 6 を たしてみよう。',
      operation: 'add',
      choices: makeChoices(14, 2, 15, 4),
    },
  },
  {
    illust: {
      id: 'g1_A_p3_i',
      pairIndex: 3,
      condition: 'illust',
      prompt: '12えん もって います。5えんの ガムを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、12 から 5 を ひくよ。',
      visualItems: [{ icon: 'gum', name: 'ガム', price: 5 }],
      operation: 'sub',
      choices: makeChoices(7, 17, 8, 12),
    },
    text: {
      id: 'g1_A_p3_t',
      pairIndex: 3,
      condition: 'text',
      prompt: '13えん もって います。6えんの あめを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、13 から 6 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(7, 19, 8, 13),
    },
  },
  {
    illust: {
      id: 'g1_A_p4_i',
      pairIndex: 4,
      condition: 'illust',
      prompt: '11えんの ノートと、7えんの えんぴつ。あわせて いくら ですか。',
      hint: '11 と 7 を あわせるよ。',
      visualItems: [
        { icon: 'notebook', name: 'ノート', price: 11 },
        { icon: 'pencil', name: 'えんぴつ', price: 7 },
      ],
      operation: 'add',
      choices: makeChoices(18, 4, 17, 8),
    },
    text: {
      id: 'g1_A_p4_t',
      pairIndex: 4,
      condition: 'text',
      prompt: '12えんの りんごと、5えんの みかんを かいます。あわせて いくら ですか。',
      hint: '12 と 5 を あわせるよ。',
      operation: 'add',
      choices: makeChoices(17, 7, 16, 27),
    },
  },
  {
    illust: {
      id: 'g1_A_p5_i',
      pairIndex: 5,
      condition: 'illust',
      prompt: '15えん もって います。8えんの パンを かうと、のこりは いくら ですか。',
      hint: '15 から 8 を ひいてみよう。',
      visualItems: [{ icon: 'bread', name: 'パン', price: 8 }],
      operation: 'sub',
      choices: makeChoices(7, 23, 6, 17),
    },
    text: {
      id: 'g1_A_p5_t',
      pairIndex: 5,
      condition: 'text',
      prompt: '16えん もって います。9えんの クッキーを かうと、のこりは いくら ですか。',
      hint: '16 から 9 を ひいてみよう。',
      operation: 'sub',
      choices: makeChoices(7, 25, 8, 17),
    },
  },
  {
    illust: {
      id: 'g1_A_p6_i',
      pairIndex: 6,
      condition: 'illust',
      prompt: '14えんの りんごと、6えんの バナナ。ちがいは いくら ですか。',
      hint: 'ちがい だから、おおきい かずから ちいさい かずを ひくよ。',
      visualItems: [
        { icon: 'apple', name: 'りんご', price: 14 },
        { icon: 'banana', name: 'バナナ', price: 6 },
      ],
      operation: 'sub',
      choices: makeChoices(8, 20, 9, 18),
    },
    text: {
      id: 'g1_A_p6_t',
      pairIndex: 6,
      condition: 'text',
      prompt: '15えんの ノートと、7えんの けしゴムが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、15 から 7 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(8, 22, 9, 18),
    },
  },
];

const SHOPPING_G1_FORM_B_PAIRS: Array<{ illust: ShoppingQuestion; text: ShoppingQuestion }> = [
  {
    illust: {
      id: 'g1_B_p1_i',
      pairIndex: 1,
      condition: 'illust',
      prompt: '6えんの あめと、8えんの クッキー。あわせて いくら ですか。',
      hint: 'あわせて だから、6 と 8 を たすよ。',
      visualItems: [
        { icon: 'candy', name: 'あめ', price: 6 },
        { icon: 'cookie', name: 'クッキー', price: 8 },
      ],
      operation: 'add',
      choices: makeChoices(14, 2, 13, 4),
    },
    text: {
      id: 'g1_B_p1_t',
      pairIndex: 1,
      condition: 'text',
      prompt: '9えんの ガムと、5えんの あめを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、9 と 5 を たすよ。',
      operation: 'add',
      choices: makeChoices(14, 4, 15, 24),
    },
  },
  {
    illust: {
      id: 'g1_B_p2_i',
      pairIndex: 2,
      condition: 'illust',
      prompt: '7えんの えんぴつと、5えんの けしゴム。あわせて いくら ですか。',
      hint: '7 に 5 を たしてみよう。',
      visualItems: [
        { icon: 'pencil', name: 'えんぴつ', price: 7 },
        { icon: 'eraser', name: 'けしゴム', price: 5 },
      ],
      operation: 'add',
      choices: makeChoices(12, 2, 13, 21),
    },
    text: {
      id: 'g1_B_p2_t',
      pairIndex: 2,
      condition: 'text',
      prompt: '8えんの バナナと、4えんの みかんを かいます。あわせて いくら ですか。',
      hint: '8 に 4 を たしてみよう。',
      operation: 'add',
      choices: makeChoices(12, 4, 11, 22),
    },
  },
  {
    illust: {
      id: 'g1_B_p3_i',
      pairIndex: 3,
      condition: 'illust',
      prompt: '14えん もって います。6えんの パンを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、14 から 6 を ひくよ。',
      visualItems: [{ icon: 'bread', name: 'パン', price: 6 }],
      operation: 'sub',
      choices: makeChoices(8, 20, 7, 18),
    },
    text: {
      id: 'g1_B_p3_t',
      pairIndex: 3,
      condition: 'text',
      prompt: '12えん もって います。4えんの ガムを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、12 から 4 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(8, 16, 9, 18),
    },
  },
  {
    illust: {
      id: 'g1_B_p4_i',
      pairIndex: 4,
      condition: 'illust',
      prompt: '13えんの ノートと、6えんの えんぴつ。あわせて いくら ですか。',
      hint: '13 と 6 を あわせるよ。',
      visualItems: [
        { icon: 'notebook', name: 'ノート', price: 13 },
        { icon: 'pencil', name: 'えんぴつ', price: 6 },
      ],
      operation: 'add',
      choices: makeChoices(19, 7, 18, 9),
    },
    text: {
      id: 'g1_B_p4_t',
      pairIndex: 4,
      condition: 'text',
      prompt: '11えんの りんごと、8えんの バナナを かいます。あわせて いくら ですか。',
      hint: '11 と 8 を あわせるよ。',
      operation: 'add',
      choices: makeChoices(19, 3, 18, 29),
    },
  },
  {
    illust: {
      id: 'g1_B_p5_i',
      pairIndex: 5,
      condition: 'illust',
      prompt: '17えん もって います。9えんの りんごを かうと、のこりは いくら ですか。',
      hint: '17 から 9 を ひいてみよう。',
      visualItems: [{ icon: 'apple', name: 'りんご', price: 9 }],
      operation: 'sub',
      choices: makeChoices(8, 26, 9, 18),
    },
    text: {
      id: 'g1_B_p5_t',
      pairIndex: 5,
      condition: 'text',
      prompt: '15えん もって います。7えんの みかんを かうと、のこりは いくら ですか。',
      hint: '15 から 7 を ひいてみよう。',
      operation: 'sub',
      choices: makeChoices(8, 22, 7, 18),
    },
  },
  {
    illust: {
      id: 'g1_B_p6_i',
      pairIndex: 6,
      condition: 'illust',
      prompt: '16えんの ノートと、9えんの けしゴム。ちがいは いくら ですか。',
      hint: 'ちがい だから、16 から 9 を ひくよ。',
      visualItems: [
        { icon: 'notebook', name: 'ノート', price: 16 },
        { icon: 'eraser', name: 'けしゴム', price: 9 },
      ],
      operation: 'sub',
      choices: makeChoices(7, 25, 8, 17),
    },
    text: {
      id: 'g1_B_p6_t',
      pairIndex: 6,
      condition: 'text',
      prompt: '13えんの パンと、6えんの あめが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、13 から 6 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(7, 19, 6, 17),
    },
  },
];

// ============================================================================
// Grade 2 Shopping Bank (Up to 100 addition & subtraction, Form A & Form B)
// ============================================================================
const SHOPPING_G2_FORM_A_PAIRS: Array<{ illust: ShoppingQuestion; text: ShoppingQuestion }> = [
  {
    illust: {
      id: 'g2_A_p1_i',
      pairIndex: 1,
      condition: 'illust',
      prompt: '30えんの りんごと、20えんの みかんを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、30 と 20 を たすよ。',
      visualItems: [
        { icon: 'apple', name: 'りんご', price: 30 },
        { icon: 'orange', name: 'みかん', price: 20 },
      ],
      operation: 'add',
      choices: makeChoices(50, 10, 60, 5),
    },
    text: {
      id: 'g2_A_p1_t',
      pairIndex: 1,
      condition: 'text',
      prompt: '40えんの パンと、10えんの あめを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、40 と 10 を たすよ。',
      operation: 'add',
      choices: makeChoices(50, 30, 60, 5),
    },
  },
  {
    illust: {
      id: 'g2_A_p2_i',
      pairIndex: 2,
      condition: 'illust',
      prompt: '35えんの ノートと、24えんの えんぴつを かいます。あわせて いくら ですか。',
      hint: '10の くらい と、1の くらい を それぞれ たしてみよう。',
      visualItems: [
        { icon: 'notebook', name: 'ノート', price: 35 },
        { icon: 'pencil', name: 'えんぴつ', price: 24 },
      ],
      operation: 'add',
      choices: makeChoices(59, 11, 58, 69),
    },
    text: {
      id: 'g2_A_p2_t',
      pairIndex: 2,
      condition: 'text',
      prompt: '32えんの クッキーと、27えんの ガムを かいます。あわせて いくら ですか。',
      hint: '32 に 27 を たしてみよう。',
      operation: 'add',
      choices: makeChoices(59, 5, 58, 69),
    },
  },
  {
    illust: {
      id: 'g2_A_p3_i',
      pairIndex: 3,
      condition: 'illust',
      prompt: '70えん もって います。30えんの バナナを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、70 から 30 を ひくよ。',
      visualItems: [{ icon: 'banana', name: 'バナナ', price: 30 }],
      operation: 'sub',
      choices: makeChoices(40, 100, 50, 4),
    },
    text: {
      id: 'g2_A_p3_t',
      pairIndex: 3,
      condition: 'text',
      prompt: '80えん もって います。40えんの パンを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、80 から 40 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(40, 120, 30, 4),
    },
  },
  {
    illust: {
      id: 'g2_A_p4_i',
      pairIndex: 4,
      condition: 'illust',
      prompt: '48えんの りんごと、25えんの みかんを かいます。あわせて いくら ですか。',
      hint: '8 と 5 で 13 に なるね。くりあがりに きを つけよう。',
      visualItems: [
        { icon: 'apple', name: 'りんご', price: 48 },
        { icon: 'orange', name: 'みかん', price: 25 },
      ],
      operation: 'add',
      choices: makeChoices(73, 23, 72, 63),
    },
    text: {
      id: 'g2_A_p4_t',
      pairIndex: 4,
      condition: 'text',
      prompt: '46えんの ノートと、27えんの けしゴムを かいます。あわせて いくら ですか。',
      hint: '6 と 7 で 13 に なるね。くりあがりに きを つけよう。',
      operation: 'add',
      choices: makeChoices(73, 19, 74, 63),
    },
  },
  {
    illust: {
      id: 'g2_A_p5_i',
      pairIndex: 5,
      condition: 'illust',
      prompt: '65えん もって います。28えんの クッキーを かうと、のこりは いくら ですか。',
      hint: '65 から 28 を ひくよ。',
      visualItems: [{ icon: 'cookie', name: 'クッキー', price: 28 }],
      operation: 'sub',
      choices: makeChoices(37, 93, 38, 47),
    },
    text: {
      id: 'g2_A_p5_t',
      pairIndex: 5,
      condition: 'text',
      prompt: '64えん もって います。27えんの えんぴつを かうと、のこりは いくら ですか。',
      hint: '64 から 27 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(37, 91, 36, 47),
    },
  },
  {
    illust: {
      id: 'g2_A_p6_i',
      pairIndex: 6,
      condition: 'illust',
      prompt: '54えんの パンと、30えんの ガムが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、54 から 30 を ひくよ。',
      visualItems: [
        { icon: 'bread', name: 'パン', price: 54 },
        { icon: 'gum', name: 'ガム', price: 30 },
      ],
      operation: 'sub',
      choices: makeChoices(24, 84, 25, 51),
    },
    text: {
      id: 'g2_A_p6_t',
      pairIndex: 6,
      condition: 'text',
      prompt: '56えんの バナナと、30えんの あめが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、56 から 30 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(26, 86, 25, 53),
    },
  },
];

const SHOPPING_G2_FORM_B_PAIRS: Array<{ illust: ShoppingQuestion; text: ShoppingQuestion }> = [
  {
    illust: {
      id: 'g2_B_p1_i',
      pairIndex: 1,
      condition: 'illust',
      prompt: '40えんの バナナと、20えんの あめを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、40 と 20 を たすよ。',
      visualItems: [
        { icon: 'banana', name: 'バナナ', price: 40 },
        { icon: 'candy', name: 'あめ', price: 20 },
      ],
      operation: 'add',
      choices: makeChoices(60, 20, 70, 6),
    },
    text: {
      id: 'g2_B_p1_t',
      pairIndex: 1,
      condition: 'text',
      prompt: '30えんの ノートと、30えんの えんぴつを かいます。あわせて いくら ですか。',
      hint: 'あわせて だから、30 と 30 を たすよ。',
      operation: 'add',
      choices: makeChoices(60, 0, 50, 6),
    },
  },
  {
    illust: {
      id: 'g2_B_p2_i',
      pairIndex: 2,
      condition: 'illust',
      prompt: '43えんの パンと、25えんの ガムを かいます。あわせて いくら ですか。',
      hint: '43 に 25 を たしてみよう。',
      visualItems: [
        { icon: 'bread', name: 'パン', price: 43 },
        { icon: 'gum', name: 'ガム', price: 25 },
      ],
      operation: 'add',
      choices: makeChoices(68, 18, 67, 58),
    },
    text: {
      id: 'g2_B_p2_t',
      pairIndex: 2,
      condition: 'text',
      prompt: '42えんの りんごと、26えんの みかんを かいます。あわせて いくら ですか。',
      hint: '42 に 26 を たしてみよう。',
      operation: 'add',
      choices: makeChoices(68, 16, 69, 58),
    },
  },
  {
    illust: {
      id: 'g2_B_p3_i',
      pairIndex: 3,
      condition: 'illust',
      prompt: '90えん もって います。40えんの ノートを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、90 から 40 を ひくよ。',
      visualItems: [{ icon: 'notebook', name: 'ノート', price: 40 }],
      operation: 'sub',
      choices: makeChoices(50, 130, 40, 5),
    },
    text: {
      id: 'g2_B_p3_t',
      pairIndex: 3,
      condition: 'text',
      prompt: '70えん もって います。20えんの けしゴムを かうと、のこりは いくら ですか。',
      hint: 'のこり だから、70 から 20 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(50, 90, 60, 5),
    },
  },
  {
    illust: {
      id: 'g2_B_p4_i',
      pairIndex: 4,
      condition: 'illust',
      prompt: '37えんの クッキーと、26えんの あめを かいます。あわせて いくら ですか。',
      hint: '7 と 6 で 13 に なるね。',
      visualItems: [
        { icon: 'cookie', name: 'クッキー', price: 37 },
        { icon: 'candy', name: 'あめ', price: 26 },
      ],
      operation: 'add',
      choices: makeChoices(63, 11, 64, 53),
    },
    text: {
      id: 'g2_B_p4_t',
      pairIndex: 4,
      condition: 'text',
      prompt: '38えんの えんぴつと、25えんの けしゴムを かいます。あわせて いくら ですか。',
      hint: '8 と 5 で 13 に なるね。',
      operation: 'add',
      choices: makeChoices(63, 13, 62, 53),
    },
  },
  {
    illust: {
      id: 'g2_B_p5_i',
      pairIndex: 5,
      condition: 'illust',
      prompt: '72えん もって います。35えんの りんごを かうと、のこりは いくら ですか。',
      hint: '72 から 35 を ひくよ。',
      visualItems: [{ icon: 'apple', name: 'りんご', price: 35 }],
      operation: 'sub',
      choices: makeChoices(37, 107, 36, 47),
    },
    text: {
      id: 'g2_B_p5_t',
      pairIndex: 5,
      condition: 'text',
      prompt: '73えん もって います。36えんの バナナを かうと、のこりは いくら ですか。',
      hint: '73 から 36 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(37, 109, 38, 47),
    },
  },
  {
    illust: {
      id: 'g2_B_p6_i',
      pairIndex: 6,
      condition: 'illust',
      prompt: '68えんの ノートと、40えんの えんぴつが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、68 から 40 を ひくよ。',
      visualItems: [
        { icon: 'notebook', name: 'ノート', price: 68 },
        { icon: 'pencil', name: 'えんぴつ', price: 40 },
      ],
      operation: 'sub',
      choices: makeChoices(28, 108, 27, 64),
    },
    text: {
      id: 'g2_B_p6_t',
      pairIndex: 6,
      condition: 'text',
      prompt: '65えんの パンと、40えんの ガムが あります。ちがいは いくら ですか。',
      hint: 'ちがい だから、65 から 40 を ひくよ。',
      operation: 'sub',
      choices: makeChoices(25, 105, 26, 61),
    },
  },
];

/**
 * Deterministic parity hash from studentId so half of students start with illust_first (順番A)
 * and half start with text_first (順番B), then alternate on every subsequent play!
 */
export function computeShoppingPlan(
  studentId: string,
  previousShoppingAttempts: number,
  grade: number
): {
  attemptNumber: number;
  form: 'A' | 'B';
  orderPattern: 'illust_first' | 'text_first';
  practiceQuestions: ShoppingQuestion[];
  mainQuestions: ShoppingQuestion[];
} {
  const attemptNumber = previousShoppingAttempts + 1;
  const form: 'A' | 'B' = attemptNumber % 2 === 1 ? 'A' : 'B';

  let hash = 0;
  for (let i = 0; i < studentId.length; i++) {
    hash = (hash * 31 + studentId.charCodeAt(i)) >>> 0;
  }
  const initialIsIllustFirst = hash % 2 === 0;
  const isOddAttempt = attemptNumber % 2 === 1;
  const orderPattern: 'illust_first' | 'text_first' =
    isOddAttempt === initialIsIllustFirst ? 'illust_first' : 'text_first';

  const isGrade1 = grade === 1;
  const practiceQuestions = isGrade1 ? SHOPPING_PRACTICE_G1 : SHOPPING_PRACTICE_G2;
  const pairs = isGrade1
    ? form === 'A'
      ? SHOPPING_G1_FORM_A_PAIRS
      : SHOPPING_G1_FORM_B_PAIRS
    : form === 'A'
      ? SHOPPING_G2_FORM_A_PAIRS
      : SHOPPING_G2_FORM_B_PAIRS;

  const mainQuestions: ShoppingQuestion[] = [];
  for (let idx = 0; idx < pairs.length; idx++) {
    const p = pairs[idx];
    // Alternate pair lead starting from orderPattern so presentation order is balanced across all 12 items
    const illustLeadsThisPair =
      orderPattern === 'illust_first' ? idx % 2 === 0 : idx % 2 === 1;
    if (illustLeadsThisPair) {
      mainQuestions.push(p.illust, p.text);
    } else {
      mainQuestions.push(p.text, p.illust);
    }
  }

  return {
    attemptNumber,
    form,
    orderPattern,
    practiceQuestions,
    mainQuestions,
  };
}

// ============================================================================
// Mini-Game 2: どうぶつの はいたつ (Lengths 2..5 x 3 = 12 questions, Form A & Form B)
// ============================================================================
export const DELIVERY_PRACTICE: DeliveryQuestion[] = [
  {
    id: 'prac_del_1',
    length: 2,
    sequence: ['rabbit', 'bear'],
    hint: 'さいしょは うさぎ（あかい いえ）だよ。',
    isPractice: true,
  },
  {
    id: 'prac_del_2',
    length: 2,
    sequence: ['fox', 'frog'],
    hint: 'さいしょは きつね（きいろい いえ）だよ。',
    isPractice: true,
  },
];

const DELIVERY_FORM_A: DeliveryQuestion[] = [
  // Length 2 (3 items)
  { id: 'del_A_2_1', length: 2, sequence: ['rabbit', 'fox'], hint: 'さいしょは うさぎ だよ。' },
  { id: 'del_A_2_2', length: 2, sequence: ['bear', 'frog'], hint: 'さいしょは くま だよ。' },
  { id: 'del_A_2_3', length: 2, sequence: ['bird', 'rabbit'], hint: 'さいしょは ことり だよ。' },
  // Length 3 (3 items)
  { id: 'del_A_3_1', length: 3, sequence: ['rabbit', 'bear', 'fox'], hint: 'さいしょは うさぎ だよ。' },
  { id: 'del_A_3_2', length: 3, sequence: ['frog', 'bird', 'bear'], hint: 'さいしょは かえる だよ。' },
  { id: 'del_A_3_3', length: 3, sequence: ['fox', 'rabbit', 'frog'], hint: 'さいしょは きつね だよ。' },
  // Length 4 (3 items)
  { id: 'del_A_4_1', length: 4, sequence: ['bear', 'fox', 'frog', 'rabbit'], hint: 'さいしょは くま だよ。' },
  { id: 'del_A_4_2', length: 4, sequence: ['bird', 'rabbit', 'bear', 'fox'], hint: 'さいしょは ことり だよ。' },
  { id: 'del_A_4_3', length: 4, sequence: ['frog', 'bear', 'bird', 'rabbit'], hint: 'さいしょは かえる だよ。' },
  // Length 5 (3 items)
  { id: 'del_A_5_1', length: 5, sequence: ['rabbit', 'bear', 'fox', 'frog', 'bird'], hint: 'さいしょは うさぎ だよ。' },
  { id: 'del_A_5_2', length: 5, sequence: ['fox', 'bird', 'rabbit', 'bear', 'frog'], hint: 'さいしょは きつね だよ。' },
  { id: 'del_A_5_3', length: 5, sequence: ['bear', 'frog', 'bird', 'fox', 'rabbit'], hint: 'さいしょは くま だよ。' },
];

const DELIVERY_FORM_B: DeliveryQuestion[] = [
  // Length 2 (3 items)
  { id: 'del_B_2_1', length: 2, sequence: ['fox', 'bear'], hint: 'さいしょは きつね だよ。' },
  { id: 'del_B_2_2', length: 2, sequence: ['frog', 'rabbit'], hint: 'さいしょは かえる だよ。' },
  { id: 'del_B_2_3', length: 2, sequence: ['bear', 'bird'], hint: 'さいしょは くま だよ。' },
  // Length 3 (3 items)
  { id: 'del_B_3_1', length: 3, sequence: ['bear', 'rabbit', 'frog'], hint: 'さいしょは くま だよ。' },
  { id: 'del_B_3_2', length: 3, sequence: ['bird', 'fox', 'rabbit'], hint: 'さいしょは ことり だよ。' },
  { id: 'del_B_3_3', length: 3, sequence: ['frog', 'bear', 'fox'], hint: 'さいしょは かえる だよ。' },
  // Length 4 (3 items)
  { id: 'del_B_4_1', length: 4, sequence: ['fox', 'rabbit', 'frog', 'bear'], hint: 'さいしょは きつね だよ。' },
  { id: 'del_B_4_2', length: 4, sequence: ['rabbit', 'bird', 'fox', 'frog'], hint: 'さいしょは うさぎ だよ。' },
  { id: 'del_B_4_3', length: 4, sequence: ['bear', 'bird', 'rabbit', 'fox'], hint: 'さいしょは くま だよ。' },
  // Length 5 (3 items)
  { id: 'del_B_5_1', length: 5, sequence: ['frog', 'fox', 'bear', 'rabbit', 'bird'], hint: 'さいしょは かえる だよ。' },
  { id: 'del_B_5_2', length: 5, sequence: ['bird', 'bear', 'frog', 'fox', 'rabbit'], hint: 'さいしょは ことり だよ。' },
  { id: 'del_B_5_3', length: 5, sequence: ['rabbit', 'frog', 'fox', 'bird', 'bear'], hint: 'さいしょは うさぎ だよ。' },
];

export function computeDeliveryPlan(previousDeliveryAttempts: number): {
  attemptNumber: number;
  form: 'A' | 'B';
  practiceQuestions: DeliveryQuestion[];
  mainQuestions: DeliveryQuestion[];
} {
  const attemptNumber = previousDeliveryAttempts + 1;
  const form: 'A' | 'B' = attemptNumber % 2 === 1 ? 'A' : 'B';
  return {
    attemptNumber,
    form,
    practiceQuestions: DELIVERY_PRACTICE,
    mainQuestions: form === 'A' ? DELIVERY_FORM_A : DELIVERY_FORM_B,
  };
}

/**
 * Classifies delivery sequence errors deterministically:
 * - '' (exact match)
 * - 'omission' (抜け: shorter length than expected)
 * - 'wrong_item' (別のものを選んだ: contains animal not in target sequence)
 * - 'order_swap' (順番の入れ替え: same elements as target sequence, different order)
 */
export function classifyDeliveryAttempt(
  target: DeliveryAnimalKey[],
  chosen: DeliveryAnimalKey[]
): { correct: boolean; errorType: '' | 'order_swap' | 'omission' | 'wrong_item' } {
  if (
    chosen.length === target.length &&
    chosen.every((val, idx) => val === target[idx])
  ) {
    return { correct: true, errorType: '' };
  }
  if (chosen.length < target.length) {
    return { correct: false, errorType: 'omission' };
  }
  const targetSet = new Set(target);
  const hasForeign = chosen.some((c) => !targetSet.has(c));
  if (hasForeign) {
    return { correct: false, errorType: 'wrong_item' };
  }
  const sortedTarget = [...target].sort().join(',');
  const sortedChosen = [...chosen].sort().join(',');
  if (sortedTarget === sortedChosen) {
    return { correct: false, errorType: 'order_swap' };
  }
  return { correct: false, errorType: 'wrong_item' };
}

// ============================================================================
// Fixed Base Story Questions (Chapter 5)
// ============================================================================
export interface FixedStoryQuestion {
  id: string;
  promptByBand: Record<GradeBand, string>;
  choices: string[];
  multiSelect: boolean;
  requiresRecipientChoice: boolean;
  isDistressTopic: boolean;
}

export const BASE_STORY_QUESTIONS: FixedStoryQuestion[] = [
  {
    id: 'base_q1_hard',
    promptByBand: {
      low: 'がっこうで、ちょっと たいへんだなって おもうことは ある？',
      middle: '{学校|がっこう}で、ちょっと たいへんだなと {思|おも}うことは ある？',
      high: '{学校|がっこう}で、{少|すこ}し{大変|たいへん}だと{感|かん}じることはありますか？',
    },
    choices: [
      'せんせいの おはなし',
      'こくばんの もじを かくこと',
      'きょうかしょを よむこと',
      'ぶんしょうの もんだい',
      'とくに ないよ',
    ],
    multiSelect: true,
    requiresRecipientChoice: true,
    isDistressTopic: true,
  },
  {
    id: 'base_q2_worked',
    promptByBand: {
      low: 'どんな ときに、うまく できたなって おもう？',
      middle: 'どんな ときに、うまく できたなと {思|おも}う？',
      high: 'どんなときなら、うまく{取|と}り{組|く}めたと{思|おも}いますか？',
    },
    choices: [
      'え や ずが あるとき',
      'すきな ことの とき',
      'ともだちと いっしょの とき',
      'ゆっくり できるとき',
    ],
    multiSelect: true,
    requiresRecipientChoice: true,
    isDistressTopic: false,
  },
  {
    id: 'base_q3_home_like',
    promptByBand: {
      low: 'いえで、すきな ことは なに？',
      middle: '{家|いえ}で、すきな ことは なに？',
      high: '{家|いえ}で{好|す}きなことや、よくすることは{何|なに}ですか？',
    },
    choices: ['ほんを よむ', 'えを かく', 'そとで あそぶ', 'ゲーム'],
    multiSelect: true,
    requiresRecipientChoice: true,
    isDistressTopic: false,
  },
];

// ============================================================================
// Interlude Question Selector (あいまの おはなし — Shown to EVERY child!)
// ============================================================================
export interface InterludeQuestionSpec {
  id: string;
  prompt: string;
  choices: string[];
  requiresRecipientChoice: boolean;
  isDistressTopic: boolean;
}

export function selectInterludeQuestion(
  previousHardChoices: string[],
  playCountSeed: number
): InterludeQuestionSpec {
  const candidates: InterludeQuestionSpec[] = [
    {
      id: 'interlude_shopping_feel',
      prompt: 'さっきの「おかいもの」は、とくい？ にがて？',
      choices: [
        'えが あると わかりやすかった',
        'もじだけでも できたよ',
        'ちょっと むずかしかった',
        'どっちも ふつう',
      ],
      // Chapter 5: ゲームの課題についての問い（「おかいものは とくい？ にがて？」など）は、最初に伝えたとおり、先生と保護者が見られる
      requiresRecipientChoice: false,
      isDistressTopic: false,
    },
    {
      id: 'interlude_trouble',
      prompt: 'いま、こまってる ことは ある？',
      choices: [
        'べんきょうで こまってることが ある',
        'ともだちの ことで こまってる',
        'おうちの ことで こまってる',
        'とくに ないよ',
      ],
      requiresRecipientChoice: true,
      isDistressTopic: true,
    },
    {
      id: 'interlude_help_wanted',
      prompt: 'だれかに てつだって ほしい ことは ある？',
      choices: [
        'ゆっくり せつめいして ほしい',
        'え や ずで みせて ほしい',
        'こえを かけて ほしい',
        'とくに ないよ',
      ],
      requiresRecipientChoice: true,
      isDistressTopic: true,
    },
    {
      id: 'interlude_school_fun',
      prompt: 'がっこうは たのしい？',
      choices: ['たのしいよ', 'まあまあ だよ', 'ちょっと つかれるよ'],
      requiresRecipientChoice: true,
      isDistressTopic: false,
    },
  ];

  // Deterministic code rule based on previous hardships and session seed
  if (
    previousHardChoices.includes('ぶんしょうの もんだい') ||
    previousHardChoices.includes('きょうかしょを よむこと')
  ) {
    return candidates[playCountSeed % 2 === 0 ? 0 : 2];
  }
  if (previousHardChoices.length > 0 && !previousHardChoices.includes('とくに ないよ')) {
    return candidates[2];
  }
  return candidates[playCountSeed % candidates.length];
}

// ============================================================================
// Chapter 16: Upcoming Mini-Games (Shown as「準備中」)
// ============================================================================
export const UPCOMING_MINIGAMES_CHAPTER_16: string[] = [
  'ことばの もり',
  'かたちの こうぼう',
  'ふしぎな いせき',
  'ほしさがし',
  'もじの ぼうけん',
  'モンスターを つかまえろ',
  'ほしの みはりばん',
  'おえかき こうぼう',
];
