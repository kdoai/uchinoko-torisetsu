import type { GameItemRecord, GameSessionDoc } from '../types/models';
import { GAME_BANK_VERSION } from '../data/gameBank';

function placeLabel(place: 'school' | 'home'): string {
  return place === 'school' ? '学校' : '家庭';
}

function deviceLabel(deviceType: 'tablet' | 'smartphone' | 'pc'): string {
  if (deviceType === 'tablet') return 'タブレット';
  if (deviceType === 'smartphone') return 'スマートフォン';
  return 'PC';
}

export function formatJapaneseDateLabel(date = new Date()): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Chapter 6: Programmatically formats Shopping mini-game behavioral records into neutral fact sentences
 * and condition-difference summaries. Gemini never rewrites these numbers.
 */
export function buildShoppingFacts(params: {
  attemptNumber: number;
  form: 'A' | 'B';
  orderPattern: 'illust_first' | 'text_first';
  place: 'school' | 'home';
  deviceType: 'tablet' | 'smartphone' | 'pc';
  usedTts: boolean;
  paused: boolean;
  items: GameItemRecord[];
}): { factSentence: string; conditionSummary: string } {
  const illustItems = params.items.filter((i) => i.condition === 'illust');
  const textItems = params.items.filter((i) => i.condition === 'text');

  const illustCorrect = illustItems.filter((i) => i.correct).length;
  const textCorrect = textItems.filter((i) => i.correct).length;

  const illustAvgSec =
    illustItems.length > 0
      ? illustItems.reduce((acc, cur) => acc + cur.seconds, 0) / illustItems.length
      : 0;
  const textAvgSec =
    textItems.length > 0
      ? textItems.reduce((acc, cur) => acc + cur.seconds, 0) / textItems.length
      : 0;

  const opSwapCount = params.items.filter((i) => i.errorType === 'op_swap').length;
  const countSlipCount = params.items.filter((i) => i.errorType === 'count_slip').length;
  const digitErrorCount = params.items.filter((i) => i.errorType === 'digit_error').length;
  const hintCount = params.items.filter((i) => i.usedHint).length;

  const errorParts: string[] = [];
  if (opSwapCount > 0) errorParts.push(`たし算とひき算の取り違えが${opSwapCount}問`);
  if (countSlipCount > 0) errorParts.push(`数え間違いが${countSlipCount}問`);
  if (digitErrorCount > 0) errorParts.push(`桁の誤りが${digitErrorCount}問`);

  const orderLabel = params.orderPattern === 'illust_first' ? '順番A（絵つき先）' : '順番B（文字だけ先）';
  const ttsLabel = params.usedTts ? '読み上げあり' : '読み上げなし';
  const pauseLabel = params.paused ? '、途中休憩あり' : '';
  const hintLabel = hintCount > 0 ? `、ヒント使用${hintCount}問` : '';

  const errorClause = errorParts.length > 0 ? `${errorParts.join('、')}。` : '';

  const factSentence = `おかいもの（${params.attemptNumber}回目）：絵つきの問題 ${illustCorrect}/${illustItems.length}、文字だけの問題 ${textCorrect}/${textItems.length}。${errorClause}（${GAME_BANK_VERSION}、形${params.form}、${orderLabel}、${placeLabel(params.place)}、${deviceLabel(params.deviceType)}、${ttsLabel}${hintLabel}${pauseLabel}）独自の課題で、標準化された検査ではありません。`;

  let diffClause = '';
  if (illustCorrect > textCorrect) {
    const timeNote =
      illustAvgSec + 1 < textAvgSec ? '、かかった時間が短め' : '';
    diffClause = `今回の課題（${params.attemptNumber}回目）では、絵つきの問題のほうが、文字だけの問題より正答が多く${timeNote}でした。`;
  } else if (textCorrect > illustCorrect) {
    const timeNote =
      textAvgSec + 1 < illustAvgSec ? '、かかった時間が短め' : '';
    diffClause = `今回の課題（${params.attemptNumber}回目）では、文字だけの問題のほうが、絵つきの問題より正答が多く${timeNote}でした。`;
  } else {
    if (illustAvgSec + 1.5 < textAvgSec) {
      diffClause = `今回の課題（${params.attemptNumber}回目）では、正答数は同じで、絵つきの問題のほうがかかった時間が短めでした。`;
    } else if (textAvgSec + 1.5 < illustAvgSec) {
      diffClause = `今回の課題（${params.attemptNumber}回目）では、正答数は同じで、文字だけの問題のほうがかかった時間が短めでした。`;
    } else {
      diffClause = `今回の課題（${params.attemptNumber}回目）では、絵つきの問題と文字だけの問題で、正答数とかかった時間に大きな違いは見られませんでした。`;
    }
  }

  const errorNeutralNote =
    errorParts.length > 0 ? `${errorParts.join('、')}ありました。` : '';

  const attemptCaution =
    params.attemptNumber === 1
      ? '1回だけの結果なので、偶然の影響もあります。'
      : `これまでの実施回数は${params.attemptNumber}回です。その日の体調や偶然の影響もあります。`;

  const conditionSummary = `${diffClause}${errorNeutralNote}${attemptCaution}独自の課題で、標準化された検査ではありません。`;

  return { factSentence, conditionSummary };
}

/**
 * Chapter 6: Programmatically formats Animal Delivery mini-game behavioral records.
 */
export function buildDeliveryFacts(params: {
  attemptNumber: number;
  form: 'A' | 'B';
  place: 'school' | 'home';
  deviceType: 'tablet' | 'smartphone' | 'pc';
  usedTts: boolean;
  paused: boolean;
  items: GameItemRecord[];
}): { factSentence: string; conditionSummary: string } {
  const byLen = (len: 2 | 3 | 4 | 5) => {
    const subset = params.items.filter((i) => i.condition === `seq_${len}`);
    const ok = subset.filter((i) => i.correct).length;
    return { ok, total: subset.length };
  };

  const s2 = byLen(2);
  const s3 = byLen(3);
  const s4 = byLen(4);
  const s5 = byLen(5);

  const swapCount = params.items.filter((i) => i.errorType === 'order_swap').length;
  const omitCount = params.items.filter((i) => i.errorType === 'omission').length;
  const wrongCount = params.items.filter((i) => i.errorType === 'wrong_item').length;
  const hintCount = params.items.filter((i) => i.usedHint).length;

  const errParts: string[] = [];
  if (swapCount > 0) errParts.push(`順番の入れ替えが${swapCount}問`);
  if (omitCount > 0) errParts.push(`抜けが${omitCount}問`);
  if (wrongCount > 0) errParts.push(`別のものを選んだ問題が${wrongCount}問`);

  const ttsLabel = params.usedTts ? '読み上げあり' : '読み上げなし';
  const pauseLabel = params.paused ? '、途中休憩あり' : '';
  const hintLabel = hintCount > 0 ? `、ヒント使用${hintCount}問` : '';
  const errClause = errParts.length > 0 ? `${errParts.join('、')}。` : '';

  const factSentence = `どうぶつの はいたつ（${params.attemptNumber}回目）：2個 ${s2.ok}/${s2.total}、3個 ${s3.ok}/${s3.total}、4個 ${s4.ok}/${s4.total}、5個 ${s5.ok}/${s5.total}。${errClause}（${GAME_BANK_VERSION}、形${params.form}、${placeLabel(params.place)}、${deviceLabel(params.deviceType)}、${ttsLabel}${hintLabel}${pauseLabel}）独自の課題で、標準化された検査ではありません。`;

  const shortOk = s2.ok + s3.ok;
  const longOk = s4.ok + s5.ok;

  let diffClause = '';
  if (shortOk > longOk) {
    diffClause = `今回の課題（${params.attemptNumber}回目）では、覚える数が2〜3個のときのほうが、4〜5個のときより順番どおりに届けやすい様子でした（2〜3個 ${shortOk}/6、4〜5個 ${longOk}/6）。`;
  } else {
    diffClause = `今回の課題（${params.attemptNumber}回目）では、覚える数が2〜3個のとき ${shortOk}/6、4〜5個のとき ${longOk}/6 でした。`;
  }

  const errNeutral = errParts.length > 0 ? `${errParts.join('、')}ありました。` : '';
  const attemptCaution =
    params.attemptNumber === 1
      ? '1回だけの結果なので、偶然の影響もあります。'
      : `これまでの実施回数は${params.attemptNumber}回です。その日の体調や偶然の影響もあります。`;

  const conditionSummary = `${diffClause}${errNeutral}${attemptCaution}独自の課題で、標準化された検査ではありません。`;

  return { factSentence, conditionSummary };
}

/**
 * Chapter 5: Checks if multiple attempts of the same mini-game used different problem forms (形A / 形B)
 * so the UI displays the mandatory comparison note.
 */
export function hasDifferentFormsWarning(sessions: GameSessionDoc[], gameType: 'shopping' | 'delivery'): boolean {
  const forms = new Set(sessions.filter((s) => s.gameType === gameType).map((s) => s.form));
  return forms.size > 1;
}

/**
 * Chapter 6: Programmatically formats a child's fixed question answer into a neutral fact sentence.
 */
export function buildChildAnswerFact(params: {
  dateLabel: string;
  questionId: string;
  questionText: string;
  choices: string[];
  freeText: string;
}): string {
  const cleanChoices = params.choices.filter(
    (c) => c !== 'わからない' && c !== 'こたえたくない'
  );
  const topicMap: Record<string, string> = {
    base_q1_hard: '学校でたいへんなこと',
    base_q2_worked: 'うまくできたと思うとき',
    base_q3_home_like: '家で好きなこと',
    interlude_shopping_feel: '「おかいもの」をやってみた感想',
    interlude_trouble: 'いま困っていること',
    interlude_help_wanted: '手伝ってほしいこと',
    interlude_school_fun: '学校での過ごし方',
    talk_trouble_manual: '「こまってることを はなしたい」',
  };
  const topicLabel = topicMap[params.questionId] || params.questionText;

  const parts: string[] = [];
  if (cleanChoices.length > 0) {
    parts.push(
      `${params.dateLabel}のゲームで、${topicLabel}として「${cleanChoices.join('」「')}」を選んだ`
    );
  }
  if (params.freeText.trim()) {
    parts.push(
      `${params.dateLabel}のゲームで、自分の言葉として「${params.freeText.trim()}」と伝えた`
    );
  }
  if (parts.length === 0) {
    return `${params.dateLabel}のゲームで、${topicLabel}の問いに「${params.choices.join('・')}」を選んだ`;
  }
  return parts.join('。');
}
