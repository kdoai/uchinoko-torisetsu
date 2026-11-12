import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import { WebSocketServer } from 'ws';
import {
  containsChildSafetyKeyword,
  validateGeminiAResponse,
  validateGeminiBResponse,
} from './src/shared/safetyAndGuardrails.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSanitizedApiKey(): string {
  const raw = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const unquoted = raw.replace(/^["']|["']$/g, '').trim();
  if (!unquoted || unquoted === 'MY_GEMINI_API_KEY') {
    return '';
  }
  return unquoted;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = getSanitizedApiKey();
  // Keys prefixed with "AQ." are Vertex AI Express Mode keys, which must use vertexai: true
  // rather than generativelanguage.googleapis.com (which rejects them with ACCESS_TOKEN_TYPE_UNSUPPORTED).
  if (apiKey.startsWith('AQ.')) {
    return new GoogleGenAI({
      apiKey,
      vertexai: true,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isGeminiAuthOrKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: number }).status;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    msg.includes('PERMISSION_DENIED')
  );
}

const INVALID_KEY_ADULT_MESSAGE =
  'Gemini APIキーが無効または未設定のためAI整理を実行できませんでした。AI Studioの「Settings（設定） > Secrets（シークレット）」パネルで有効な GEMINI_API_KEY を設定・選択してください（記録はそのまま手動で保存できます）。';

// ============================================================================
// Chapter 10: Gemini A System Instruction & Response Schema (Momo)
// ============================================================================
const GEMINI_A_SYSTEM_INSTRUCTION = `あなたは子ども向け冒険ゲーム「がっこう たんけん」のキャラクター「モモ」です。コンピューターで動くAIの仲間です。子どもと会話しながら冒険を進め、学校や家で「たいへんだな」と思うこと、「こうすると できる」と思うことを、子どもが自分で伝えられるようにします。検査や診断ではありません。

入力：grade_band（low / middle / high）、base_question（基本の問いと、子どもの答え choices と free_text）、followups_used（この話題で、すでに深掘りした数）

返すもの（JSON）：
{"line": "モモのセリフ（1〜2文）", "choices": ["選択肢を2〜4個", "わからない", "こたえたくない"], "allow_free_text": true または false, "end_topic": true または false, "safety_review": true または false}

決まり：
- 深掘りは1つの話題につき最大2問。followups_used が2なら end_topic を true にする
- 深掘りは、ほかの理由も確かめられる形にする（例：「こくばんの もじを かくこと」→「もじが みえにくい？」「かくのに じかんが かかる？」「せんせいの おはなしと いっしょだと たいへん？」）
- 選択肢の最後に、必ず「わからない」「こたえたくない」を入れる
- 正解があるように見せない。答えの内容をほめたり、特定の答えに誘ったりしない。答えたこと自体に「おしえてくれて ありがとう」と返す
- 子どもを評価・分類する言葉（にがてな子、たいへんな子、病院、しんさつ、けんさ など）を使わない。病名、性格の決めつけ、ほかの子との比較を言わない
- 叱る、責める、がんばれと迫る言い方をしない
- 子どもの答えに、こわいこと、痛いこと、家に帰りたくない、いなくなりたい、ひみつにしてほしい、のような内容が含まれていそうなら safety_review を true にし、line を「おしえてくれて ありがとう。たよれる おとなに つたえて、たすけて もらおうね」にして、choices は空にする。ひみつにすると約束しない。緊急かどうかは判断しない
- 文字：low はひらがなだけ、文節ごとに空白、1文20字まで。middle はひらがな中心で、3年生までに習う漢字だけを {漢字|かんじ} の形で書く。high は学年相応の漢字を {漢字|かんじ} の形で書き、子ども扱いしない話し方にする`;

const GEMINI_A_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    line: { type: Type.STRING },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
    allow_free_text: { type: Type.BOOLEAN },
    end_topic: { type: Type.BOOLEAN },
    safety_review: { type: Type.BOOLEAN },
  },
  required: ['line', 'choices', 'allow_free_text', 'end_topic', 'safety_review'],
};

// ============================================================================
// Chapter 11: Gemini B System Instruction & Response Schema
// ============================================================================
const GEMINI_B_SYSTEM_INSTRUCTION = `あなたは「うちの子トリセツ」です。子どもが伝えたこと、ゲームで測った事実、先生の記録、家庭の記録を並べ、その子に合う関わり方の仮説を提案します。

入力：
- mode：school_note（先生の一言記録）、class_note（先生の複数メモ）、home_note（保護者の記録）、bridge（4つの情報を並べた整理）、consult_teacher（保護者から先生への相談文の下書き）、meeting_memo（面談メモ）、parent_letter（保護者への連絡文の下書き）、term_facts（所見のための事実の整理）、class_tips（学級の工夫）、medical_memo（医師に渡すメモ）
- viewer_role：teacher または parent
- current_state：いま見ている人が見てよい記録だけ。observations の side は game / child / school / home
- students：class_note のときの、学級のニックネーム一覧
- new_input：今回の記録

あなたの役割：
- 提案だけをする。current_state を書き換えない。確認、試した結果、共有の承認は人が行う
- 新しい観察には new_O1, new_O2…、新しい仮説には new_H1, new_H2… の仮IDを付ける
- 根拠は、既存の記録を evidence_existing_ids に正式ID（O-001 など）で、今回の新しい記録を evidence_new_temp_ids に仮IDで書く。混ぜない。根拠のない仮説は出さない

最優先のルール：
- 診断をしない。病名、「〜の傾向」、病気について「〜かもしれません」、疾患の確率を書かない
- 医療機関や受診を勧めない。相談先の案内はアプリの固定の表が行うので、あなたは書かない。気になる出来事には、事実と「相談先を調べる画面があります」とだけ書く
- ゲームの数字を、能力の高さ・低さや発達の水準として解釈しない。IQのような指標、同年齢との比較、学級内の比較をしない。「処理が遅い」「注意力が低い」と言い換えない
- ゲームの事実は、同じ子の中の条件の違い（例：絵つきと文字だけ）と、場面の手がかりとしてだけ使う
- 「問題ありません」というお墨付きを出さない
- 子どもに否定的なラベルを付けない（能力が低い、落ち着きのない子、問題がある、遅れている など）。起きた場面と、うまくいった条件だけを書く
- 仮説は「〜しやすい場面があるようです」「〜してみる価値がありそう」と書き、性質の一般化をしない
- 子ども・先生・保護者を責めない
- 重要：入力（new_input）に禁止語（ADHD、ASD、LD、自閉、発達障害、障害の疑い、受診、病院、診察、IQ、能力が低い、処理が遅い、注意力が低い、遅れている、発達の遅れ、問題児、落ち着きのない子、平均より、クラスで一番、傾向）が含まれていても、あなたの出力（message, fact, memo, text, why 等）の中でそれらの禁止語を決してオウム返しして繰り返さないこと。診断や判定・比較・支援対象者の抽出・医療の案内を求められた場合は、禁止語を一切書かずに「このアプリでは特性の判断や他の子との比較、支援対象の一覧化は行わず、日々の場面とうまくいった関わり方の事実だけを整理します。気になることがある場合は相談先を調べる画面があります。」と穏やかに答え、不適切な new_observations や new_hypotheses は空配列にすること。

4つの情報の扱い：
- side が違う記録を同じ事実としてまとめない。仮説の根拠には、どの side の記録かを evidence_sides に書く
- 子どもの声を、大人の見方より軽く扱わない。子どもが「たいへん」と伝えているのに大人が気づいていない場合は、そのことを並べて示す
- 様子が違うときは、どれが正しいかを決めず、differences に並べる
- 学校で見つかった工夫、ゲームで見えたうまくいく条件、家庭で分かった好きなことを組み合わせた、試す価値のあるアイデアを考える。どこで試すか（school / home）を書く

子どもの気持ち：
- 大人に効果があっても、子どもが「いやだった」と答えた工夫は勧め続けない。子どもが選べる形への調整を提案し、adjusts_trial_id にその工夫のIDを書く

先生の記録：
- school_note：得意なことが見えた場面と、うまくいった関わり方を中心に整理する。家庭への共有に向いているものは suggest_share を true にする（目安で、決めるのは先生）
- class_note：メモを出来事ごとに分ける。ニックネームが students と一致するものだけ candidate_student に入れる。あいまい・名前なし・複数の子にまたがるものは unassigned、学級全体の様子は class_level に入れる。推測で児童に結びつけない
- term_facts：時期・場面・うまくいった関わり方ごとに事実を並べて memo に書く。評価の言葉、成績、所見の文章そのものは書かない
- parent_letter：共有済みの記録から、良い場面から書いた短い連絡文の下書きを memo に書く
- class_tips：学級全体の記録から、家庭でも試せるアイデアを一般的な形で memo に書く。特定の子の記録を含めない

保護者から先生への相談（consult_teacher）：
- 保護者が選んだ記録だけを使い、先生に相談したいことの短い下書きを memo に書く
- 子どもの声、家での様子、試したことを事実で書き、「学校での様子も教えていただけますか」のように、一緒に考える形で結ぶ
- 病名や受診の話を、下書きに入れない（保護者が自分で書き足すのは自由）

気になった出来事：
- 本人のつらさにつながりうる事実（子どもが「たいへん」「こまってる」と伝えている、登校しぶり、眠れない日が多い、友だちとのトラブル）を concerns に入れ、事実と根拠のIDだけを書く
- message には「先生に相談することや、相談先を調べることもできます。相談するのに診断名は必要ありません」と書く

医師に渡すメモ（medical_memo）：
- 保護者が「医師に渡すメモを作る」を押したときだけ作る
- 記録の内容を変えずに並べ替える。新しい解釈を足さない
- 構成：相談したいこと（保護者が入力した文をそのまま）／本人が伝えていること／困っている場面（家・学校）と日付／得意なこと、うまくいった関わり方／試した工夫と結果、本人の感想／ゲームで測った事実（課題名、条件、版、実施日、端末）／ほかに気になること
- ゲームの事実には「独自の課題で、標準化された検査ではありません」と必ず添える
- 最後に、医師が書くための空欄「医師の記入欄」を置き、何も書かない

面談メモ（meeting_memo）：
- shared の記録だけを使う。構成：好きなこと・得意なこと／本人が伝えていること／学校でうまくいった関わり方／家庭でうまくいった関わり方／ゲームで見えたうまくいく条件／違いがある場面／相談したいこと／一緒に試したい工夫
- 最後に「内容を確認・修正してからお使いください」と書く

話し方：
- やさしく、短い文で。専門用語は使わない。message は3文以内で、相手の行動を認める一言を入れる
- 子どもの名前、学校名、先生や友だちの名前が入力にあれば、「お子さん」「担任の先生」「友だち」に置き換える（ただし class_note の candidate_student には students リスト内のニックネームをそのまま入れる）`;

const GEMINI_B_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
    new_observations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          temp_id: { type: Type.STRING },
          side: { type: Type.STRING, enum: ['school', 'home'] },
          category: { type: Type.STRING, enum: ['strength', 'worked_well', 'hard', 'child_said', 'other'] },
          fact: { type: Type.STRING },
          suggest_share: { type: Type.BOOLEAN },
          candidate_student: { type: Type.STRING, nullable: true },
        },
        required: ['temp_id', 'side', 'category', 'fact', 'suggest_share'],
      },
    },
    unassigned: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['text', 'reason'],
      },
    },
    class_level: { type: Type.ARRAY, items: { type: Type.STRING } },
    new_hypotheses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          temp_id: { type: Type.STRING },
          text: { type: Type.STRING },
          evidence_existing_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidence_new_temp_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidence_sides: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ['game', 'child', 'school', 'home'] },
          },
          why: { type: Type.STRING },
        },
        required: [
          'temp_id',
          'text',
          'evidence_existing_ids',
          'evidence_new_temp_ids',
          'evidence_sides',
          'why',
        ],
      },
    },
    differences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                side: { type: Type.STRING, enum: ['game', 'child', 'school', 'home'] },
                fact: { type: Type.STRING },
              },
              required: ['side', 'fact'],
            },
          },
          evidence_existing_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidence_new_temp_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          note: { type: Type.STRING },
        },
        required: ['items', 'evidence_existing_ids', 'evidence_new_temp_ids', 'note'],
      },
    },
    suggested_trials: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          where: { type: Type.STRING, enum: ['school', 'home'] },
          text: { type: Type.STRING },
          based_on_existing_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          based_on_new_temp_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          why: { type: Type.STRING },
          adjusts_trial_id: { type: Type.STRING, nullable: true },
        },
        required: ['where', 'text', 'based_on_existing_ids', 'based_on_new_temp_ids', 'why'],
      },
    },
    concerns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fact: { type: Type.STRING },
          evidence_existing_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidence_new_temp_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['fact', 'evidence_existing_ids', 'evidence_new_temp_ids'],
      },
    },
    memo: { type: Type.STRING, nullable: true },
  },
  required: [
    'message',
    'new_observations',
    'unassigned',
    'class_level',
    'new_hypotheses',
    'differences',
    'suggested_trials',
    'concerns',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --------------------------------------------------------------------------
  // POST /api/gemini/child-followup (Chapter 10: Gemini A — Momo)
  // --------------------------------------------------------------------------
  app.post('/api/gemini/child-followup', async (req, res) => {
    try {
      const { grade_band = 'low', base_question, followups_used = 0 } = req.body ?? {};
      const choicesText = Array.isArray(base_question?.choices) ? base_question.choices.join(' ') : '';
      const freeText = typeof base_question?.free_text === 'string' ? base_question.free_text : '';

      // Pre-check safety keywords before sending to Gemini
      if (containsChildSafetyKeyword(`${choicesText} ${freeText}`)) {
        res.json({
          ok: true,
          safetyTriggered: true,
          data: {
            line: 'おしえてくれて ありがとう。たよれる おとなに つたえて、たすけて もらおうね',
            choices: [],
            allow_free_text: false,
            end_topic: true,
            safety_review: true,
          },
        });
        return;
      }

      if (Number(followups_used) >= 2) {
        res.json({
          ok: true,
          safetyTriggered: false,
          data: {
            line: 'おしえてくれて ありがとう！ つぎへ すすもうね。',
            choices: [],
            allow_free_text: false,
            end_topic: true,
            safety_review: false,
          },
        });
        return;
      }

      if (!getSanitizedApiKey()) {
        res.json({
          ok: true,
          safetyTriggered: false,
          data: {
            line: 'おしえてくれて ありがとう！ つぎへ すすもうね。',
            choices: [],
            allow_free_text: false,
            end_topic: true,
            safety_review: false,
          },
        });
        return;
      }

      const ai = getGenAIClient();
      const promptPayload = JSON.stringify({
        grade_band,
        base_question,
        followups_used: Number(followups_used),
      });

      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents:
            attempt === 0
              ? `次の入力に対して、モモの深掘りの応答JSONを返してください。\n${promptPayload}`
              : `前回の出力に決まり違反がありました。評価語や病院・検査の言葉を一切使わず、選択肢の最後に「わからない」「こたえたくない」を入れてJSONで返してください。\n${promptPayload}`,
          config: {
            systemInstruction: GEMINI_A_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_A_SCHEMA,
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          continue;
        }

        const checked = validateGeminiAResponse(parsed);
        if (!checked.valid || !checked.cleaned) {
          continue;
        }

        // Post-check safety keywords on generated text as well
        const outJoined = `${checked.cleaned.line} ${checked.cleaned.choices.join(' ')}`;
        if (checked.cleaned.safety_review || containsChildSafetyKeyword(outJoined)) {
          res.json({
            ok: true,
            safetyTriggered: true,
            data: {
              line: 'おしえてくれて ありがとう。たよれる おとなに つたえて、たすけて もらおうね',
              choices: [],
              allow_free_text: false,
              end_topic: true,
              safety_review: true,
            },
          });
          return;
        }

        res.json({
          ok: true,
          safetyTriggered: false,
          data: checked.cleaned,
        });
        return;
      }

      // If Gemini A fails twice, do not invent questions; end follow-up cleanly
      res.json({
        ok: true,
        safetyTriggered: false,
        data: {
          line: 'おしえてくれて ありがとう！',
          choices: [],
          allow_free_text: false,
          end_topic: true,
          safety_review: false,
        },
      });
    } catch (err) {
      if (isGeminiAuthOrKeyError(err)) {
        console.log('[Gemini A] Skipped follow-up due to invalid or unauthorized GEMINI_API_KEY.');
        res.status(200).json({
          ok: true,
          safetyTriggered: false,
          data: {
            line: 'おしえてくれて ありがとう！ つぎへ すすもうね。',
            choices: [],
            allow_free_text: false,
            end_topic: true,
            safety_review: false,
          },
        });
        return;
      }
      console.log(
        '[Gemini A] Follow-up unavailable:',
        err instanceof Error ? err.message : String(err)
      );
      res.status(200).json({
        ok: false,
        errorMessage: 'うまく整理できませんでした。記録はそのまま残っています',
      });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/gemini/organize (Chapter 11: Gemini B — Structured Analysis)
  // --------------------------------------------------------------------------
  app.post('/api/gemini/organize', async (req, res) => {
    try {
      const {
        mode,
        viewer_role,
        current_state,
        students = [],
        new_input = '',
        parent_raw_consult = '',
      } = req.body ?? {};

      if (!mode || (viewer_role !== 'teacher' && viewer_role !== 'parent')) {
        res.status(400).json({
          ok: false,
          errorMessage: 'うまく整理できませんでした。記録はそのまま残っています',
        });
        return;
      }

      // Filter current_state defensively so safety_reports can never enter Gemini B
      const safeObservations = Array.isArray(current_state?.observations)
        ? current_state.observations
            .filter(
              (o: Record<string, unknown>) =>
                o &&
                typeof o.formalId === 'string' &&
                ['game', 'child', 'school', 'home'].includes(String(o.side))
            )
            .map((o: Record<string, unknown>) => ({
              id: o.formalId,
              side: o.side,
              category: o.category,
              fact: o.fact,
              shareStatus: o.shareStatus,
              dateLabel: o.dateLabel,
            }))
        : [];

      const safeTrials = Array.isArray(current_state?.trials)
        ? current_state.trials.map((t: Record<string, unknown>) => ({
            id: t.formalId || t.trialId,
            where: t.where,
            whatToChange: t.whatToChange,
            adultResult: t.adultResult,
            childBurden: t.childBurden,
            continuedStatus: t.continuedStatus,
            childFeedback: t.childFeedback,
            childFeedbackNote: t.childFeedbackNote,
          }))
        : [];

      const allowedExistingIds: string[] = [
        ...safeObservations.map((o: { id: string }) => String(o.id)),
        ...safeTrials.map((t: { id: string }) => String(t.id)),
      ];

      if (!getSanitizedApiKey()) {
        res.status(200).json({
          ok: false,
          errorMessage: INVALID_KEY_ADULT_MESSAGE,
        });
        return;
      }

      const ai = getGenAIClient();
      let lastFailureReason = '';

      for (let attempt = 0; attempt < 2; attempt++) {
        const userPayload = {
          mode,
          viewer_role,
          current_state: {
            observations: safeObservations,
            trials: safeTrials,
            allowed_existing_ids: allowedExistingIds,
          },
          students: mode === 'class_note' ? students : [],
          new_input,
          parent_raw_consult: mode === 'medical_memo' ? parent_raw_consult : undefined,
        };

        const retryNotice =
          attempt === 1
            ? `\n\n【重要：前回の応答は次の検証エラーで却下されました：「${lastFailureReason}」。禁止語（ADHD、ASD、LD、発達障害、発達の遅れ、受診、病院、診察、IQ、能力が低い、処理が遅い、注意力が低い、遅れている、問題児、落ち着きのない子、平均より、クラスで一番、傾向、問題ありません、医療機関、クリニック等）を絶対に1文字も含めず、allowed_existing_ids に存在するIDと今回生成した temp_id のみを使って再出力してください。】`
            : '';

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `次の入力JSONを整理し、指定スキーマのJSONで出力してください。\n${JSON.stringify(userPayload)}${retryNotice}`,
          config: {
            systemInstruction: GEMINI_B_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_B_SCHEMA,
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          lastFailureReason = '空の応答';
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          lastFailureReason = 'JSONパース失敗';
          continue;
        }

        const check = validateGeminiBResponse(
          parsed,
          String(mode),
          allowedExistingIds,
          typeof parent_raw_consult === 'string' ? parent_raw_consult : ''
        );

        if (check.valid && check.data) {
          res.json({ ok: true, data: check.data });
          return;
        }
        lastFailureReason = check.reason || '検証エラー';
      }

      // Chapter 2 & 11: When failing Gemini call or failing validation twice in a row, return exact message without fake data
      res.status(200).json({
        ok: false,
        errorMessage: 'うまく整理できませんでした。記録はそのまま残っています',
      });
    } catch (err) {
      if (isGeminiAuthOrKeyError(err)) {
        console.log('[Gemini B] Organize skipped due to invalid or unauthorized GEMINI_API_KEY.');
        res.status(200).json({
          ok: false,
          errorMessage: INVALID_KEY_ADULT_MESSAGE,
        });
        return;
      }
      console.log(
        '[Gemini B] Organize unavailable:',
        err instanceof Error ? err.message : String(err)
      );
      res.status(200).json({
        ok: false,
        errorMessage: 'うまく整理できませんでした。記録はそのまま残っています',
      });
    }
  });

  const httpServer = createHttpServer(app);

  // --------------------------------------------------------------------------
  // WebSocket /api/live-home-note (Chapter 8: Gemini Live API — Voice Only, No Video)
  // --------------------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname === '/api/live-home-note') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Let other upgrade paths (if any) close cleanly or be ignored
  });

  wss.on('connection', async (clientWs) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    try {
      const ai = getGenAIClient();
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          systemInstruction:
            'あなたは「うちの子トリセツ」の家庭の聞き取りパートナーです。保護者が話すお子さんの家での様子（好きなこと、うまくいった関わり方、大変そうだった場面）を、短い相づちとやさしい質問で聞き取ってください。診断名や病院・受診の勧め、能力の評価は絶対に言わないでください。実名や住所を聞くことはしないでください。1回の返答は1〜2文で短く話してください。',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== clientWs.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  })
                );
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
          },
          onerror: (err: unknown) => {
            const isKeyErr = isGeminiAuthOrKeyError(err);
            console.log(
              '[Gemini Live] Session error:',
              isKeyErr
                ? 'Invalid or unauthorized GEMINI_API_KEY'
                : err instanceof Error
                  ? err.message
                  : String(err)
            );
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: isKeyErr
                    ? 'Gemini APIキーが無効または未設定のため音声会話を利用できません。「Settings > Secrets」パネルで GEMINI_API_KEY をご確認ください。下の文字入力はそのままご利用いただけます。'
                    : '音声会話の接続が中断されました。文字入力もご利用いただけます。',
                })
              );
            }
          },
        },
      });

      liveSession = await sessionPromise;
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ type: 'ready' }));
      }

      clientWs.on('message', (rawData) => {
        try {
          const parsed = JSON.parse(rawData.toString()) as { audio?: string; stop?: boolean };
          if (parsed.stop) {
            liveSession?.close();
            liveSession = null;
            return;
          }
          if (parsed.audio && liveSession) {
            liveSession.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } catch {
          // Ignore malformed frame
        }
      });

      clientWs.on('close', () => {
        try {
          liveSession?.close();
        } catch {
          // Ignore close error
        }
        liveSession = null;
      });
    } catch (err) {
      const isKeyErr = isGeminiAuthOrKeyError(err);
      console.log(
        '[Gemini Live] Connection failed:',
        isKeyErr
          ? 'Invalid or unauthorized GEMINI_API_KEY'
          : err instanceof Error
            ? err.message
            : String(err)
      );
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: isKeyErr
              ? 'Gemini APIキーが無効または未設定のため音声会話を開始できません。「Settings > Secrets」パネルで GEMINI_API_KEY をご確認ください。文字での入力はそのままご利用いただけます。'
              : '音声会話の開始に失敗しました。文字での入力をご利用ください。',
          })
        );
        clientWs.close();
      }
    }
  });

  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`うちの子トリセツ server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
