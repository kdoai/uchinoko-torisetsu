import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Coins,
  HelpCircle,
  Lock,
  LogOut,
  MessageCircle,
  Pause,
  Phone,
  RotateCcw,
  RotateCw,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BASE_STORY_QUESTIONS,
  classifyDeliveryAttempt,
  computeDeliveryPlan,
  computeShoppingPlan,
  DELIVERY_NODES,
  GAME_BANK_VERSION,
  selectInterludeQuestion,
  UPCOMING_MINIGAMES_CHAPTER_16,
  type DeliveryAnimalKey,
} from '../data/gameBank';
import { GACHA_CATALOG, GACHA_SPIN_COST } from '../data/gachaCatalog';
import {
  buildChildAnswerFact,
  buildDeliveryFacts,
  buildShoppingFacts,
  formatJapaneseDateLabel,
} from '../lib/factFormatter';
import {
  callGeminiChildFollowup,
  loadAuthorizedStudentBundle,
  loadStudentRewards,
  saveChildAnswerAndObservation,
  saveChildTrialFeedback,
  saveGameSessionAndObservation,
  saveStudentRewards,
  submitChildSafetyReport,
} from '../lib/firestoreService';
import { soundEngine } from '../lib/soundEngine';
import { containsChildSafetyKeyword } from '../shared/safetyAndGuardrails';
import type {
  ActiveChildModeLock,
  ChildVisibility,
  GameItemRecord,
  StudentDoc,
  StudentRecordIndexDoc,
  TrialDoc,
} from '../types/models';
import {
  DeliveryVillage2DStage,
  FestivalPlaza2DStage,
  Shopping2DStage,
  StoryScene2DStage,
  TownPanorama2DMap,
} from './Adventure2DStages';
import { AdultPinUnlockModal, RubyText, speakJapaneseText, TtsButton } from './CommonUI';
import { Gachapon3DModal } from './Gachapon3DModal';
import {
  AnimalHouseIllustration,
  MomoAvatar,
  ShoppingItemSvg,
  UniversalAdventureStamp,
} from './GameIllustrations';
import { CoinStackVisual, StoryChoiceIcon } from './StoryChoiceCardIcons';

type AdventurePhase =
  | 'loading'
  | 'disclosure'
  | 'trial_feedback'
  | 'base_questions'
  | 'shopping_intro'
  | 'shopping_play'
  | 'interlude'
  | 'delivery_intro'
  | 'delivery_play'
  | 'ending'
  | 'safety_comfort';

const TOWN_STOPS: Array<{
  id: string;
  label: string;
  matchPhases: AdventurePhase[];
}> = [
  {
    id: 'plaza',
    label: '1. ひろば',
    matchPhases: ['disclosure', 'trial_feedback', 'base_questions'],
  },
  {
    id: 'market',
    label: '2. おかいもの横丁',
    matchPhases: ['shopping_intro', 'shopping_play'],
  },
  {
    id: 'bench',
    label: '3. ひだまりベンチ',
    matchPhases: ['interlude'],
  },
  {
    id: 'post',
    label: '4. どうぶつ郵便',
    matchPhases: ['delivery_intro', 'delivery_play'],
  },
  {
    id: 'festival',
    label: '5. おまつり・ガチャ',
    matchPhases: ['ending'],
  },
];

/**
 * Highlights numbers, prices ("7えん"), and key math action words ("あわせて", "のこりは", "ちがいは")
 * so early-elementary children can scan shopping prompts effortlessly without altering question text.
 */
const HighlightedShopPrompt: React.FC<{ text: string }> = ({ text }) => {
  const tokenRegex = /(\d+えん|あわせて|のこりは|ちがいは|れんしゅう\s*\d+：)/g;
  const parts = text.split(tokenRegex);
  return (
    <span>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^\d+えん$/.test(part)) {
          return (
            <span
              key={i}
              className="mx-0.5 inline-block rounded-lg bg-[#FFF2D6] px-1.5 py-0.5 text-[#B45018] underline decoration-[#E5A952] decoration-2 underline-offset-4 tabular-nums"
            >
              {part}
            </span>
          );
        }
        if (part === 'あわせて' || part === 'のこりは' || part === 'ちがいは') {
          return (
            <span
              key={i}
              className="mx-0.5 inline-block rounded-lg bg-[#E6F4EC] px-1.5 py-0.5 text-[#1F6340]"
            >
              {part}
            </span>
          );
        }
        if (part.startsWith('れんしゅう')) {
          return (
            <span key={i} className="mr-1 inline-block text-sm font-bold text-[#2F7A54]">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export const ChildAdventureApp: React.FC<{
  lock: ActiveChildModeLock;
  adultViewerRole?: 'teacher' | 'parent';
  adultViewerUid?: string;
  onExitChildMode: () => void;
}> = ({ lock, adultViewerRole = 'teacher', adultViewerUid = '', onExitChildMode }) => {
  const [phase, setPhase] = useState<AdventurePhase>('loading');
  const [recordIndex, setRecordIndex] = useState<StudentRecordIndexDoc | null>(null);
  const [prevShoppingCount, setPrevShoppingCount] = useState(0);
  const [prevDeliveryCount, setPrevDeliveryCount] = useState(0);
  const [activeTrial, setActiveTrial] = useState<TrialDoc | null>(null);

  // Gamification & Audio state (Coins + Zukan + 3D Gacha + BGM + Auto Voice)
  const [coins, setCoins] = useState(20);
  const [totalSpins, setTotalSpins] = useState(0);
  const [unlockedItemIds, setUnlockedItemIds] = useState<string[]>([]);
  const [coinGainBanner, setCoinGainBanner] = useState<string | null>(null);
  const [gachaModalOpen, setGachaModalOpen] = useState(false);
  const [gachaInitialTab, setGachaInitialTab] = useState<'machine' | 'zukan'>('machine');
  const [bgmOn, setBgmOn] = useState(false);
  const [autoVoiceOn, setAutoVoiceOn] = useState(false);
  const [storyCelebrateCount, setStoryCelebrateCount] = useState(0);

  // Global overlays
  const [isPaused, setIsPaused] = useState(false);
  const [pausedDuringGame, setPausedDuringGame] = useState(false);
  const [usedTtsInGame, setUsedTtsInGame] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);

  // "だれかに はなしたい" modal state
  const [talkModalStep, setTalkModalStep] = useState<
    'closed' | 'menu' | 'trouble_input' | 'trouble_recipient' | 'scary_input'
  >('closed');
  const [manualTroubleChoices, setManualTroubleChoices] = useState<string[]>([]);
  const [manualTroubleText, setManualTroubleText] = useState('');
  const [scaryFreeText, setScaryFreeText] = useState('');
  const [submittingOverlay, setSubmittingOverlay] = useState(false);

  // Trial feedback state
  const [trialNote, setTrialNote] = useState('');

  // Base questions + Gemini A followups state
  const [baseIdx, setBaseIdx] = useState(0);
  const [baseChoices, setBaseChoices] = useState<string[]>([]);
  const [baseFreeText, setBaseFreeText] = useState('');
  const [followupTurn, setFollowupTurn] = useState(0);
  const [followupPrompt, setFollowupPrompt] = useState('');
  const [followupOptions, setFollowupOptions] = useState<string[]>([]);
  const [followupAllowFree, setFollowupAllowFree] = useState(false);
  const [followupPicked, setFollowupPicked] = useState<string[]>([]);
  const [followupFree, setFollowupFree] = useState('');
  const [followupTranscriptLog, setFollowupTranscriptLog] = useState<string[]>([]);
  const [awaitingRecipient, setAwaitingRecipient] = useState(false);
  const [firstHardChoicesRemembered, setFirstHardChoicesRemembered] = useState<string[]>([]);
  const [loadingMomo, setLoadingMomo] = useState(false);

  // Shopping game state + 2D Checkout Animation state
  const shoppingPlan = useMemo(
    () => computeShoppingPlan(lock.studentId, prevShoppingCount, lock.grade),
    [lock.studentId, prevShoppingCount, lock.grade]
  );
  const allShoppingQuestions = useMemo(
    () => [...shoppingPlan.practiceQuestions, ...shoppingPlan.mainQuestions],
    [shoppingPlan]
  );
  const [shopQIdx, setShopQIdx] = useState(0);
  const [shopShowHint, setShopShowHint] = useState(false);
  const [shopRetried, setShopRetried] = useState(false);
  const [shopItemsRecorded, setShopItemsRecorded] = useState<GameItemRecord[]>([]);
  const [shopCheckoutAnim, setShopCheckoutAnim] = useState<{
    active: boolean;
    chosenLabel: string;
  } | null>(null);
  const itemStartTimeRef = useRef<number>(Date.now());

  // Interlude state
  const interludeSpec = useMemo(
    () =>
      selectInterludeQuestion(
        firstHardChoicesRemembered,
        prevShoppingCount + prevDeliveryCount
      ),
    [firstHardChoicesRemembered, prevShoppingCount, prevDeliveryCount]
  );
  const [interludeChoices, setInterludeChoices] = useState<string[]>([]);
  const [interludeFreeText, setInterludeFreeText] = useState('');
  const [interludeNeedsRecipient, setInterludeNeedsRecipient] = useState(false);

  // Delivery game state + 2D Postman Momo Delivery Run Animation state
  const deliveryPlan = useMemo(
    () => computeDeliveryPlan(prevDeliveryCount),
    [prevDeliveryCount]
  );
  const allDeliveryQuestions = useMemo(
    () => [...deliveryPlan.practiceQuestions, ...deliveryPlan.mainQuestions],
    [deliveryPlan]
  );
  const [delQIdx, setDelQIdx] = useState(0);
  const [delSubPhase, setDelSubPhase] = useState<'memorize' | 'recall'>('memorize');
  const [delChosenSeq, setDelChosenSeq] = useState<DeliveryAnimalKey[]>([]);
  const [delShowHint, setDelShowHint] = useState(false);
  const [delRetried, setDelRetried] = useState(false);
  const [delItemsRecorded, setDelItemsRecorded] = useState<GameItemRecord[]>([]);
  const [delDeliveringAnim, setDelDeliveringAnim] = useState(false);

  const coinBannerTimerRef = useRef<number | null>(null);
  const animActionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      soundEngine.stopBgm();
      if (coinBannerTimerRef.current) {
        window.clearTimeout(coinBannerTimerRef.current);
      }
      if (animActionTimerRef.current) {
        window.clearTimeout(animActionTimerRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initChildBundle() {
      try {
        const rewardDoc = await loadStudentRewards({
          studentId: lock.studentId,
          participationOptOut: lock.participationOptOut,
        });
        if (!cancelled && rewardDoc) {
          setCoins(rewardDoc.coins);
          setTotalSpins(rewardDoc.totalSpins);
          setUnlockedItemIds(rewardDoc.unlockedItemIds || []);
        }

        if (lock.isSchoolDeviceSession || !adultViewerUid) {
          if (!cancelled) {
            const dayHash = Math.floor(Date.now() / 86400000) % 2;
            setPrevShoppingCount(dayHash);
            setPrevDeliveryCount(dayHash);
            const demoStage =
              typeof window !== 'undefined' && window.location.search.includes('demo=')
                ? new URLSearchParams(window.location.search).get('stage')
                : null;
            if (demoStage === 'shopping') {
              itemStartTimeRef.current = Date.now();
              setPhase('shopping_play');
            } else if (demoStage === 'delivery') {
              itemStartTimeRef.current = Date.now();
              setPhase('delivery_play');
            } else {
              setPhase('disclosure');
            }
          }
          return;
        }

        const studentStub: StudentDoc = {
          studentId: lock.studentId,
          schoolId: lock.schoolId,
          adminUid: '',
          classId: lock.classId,
          parentUid: adultViewerRole === 'parent' ? adultViewerUid : '',
          attendanceNumber: 1,
          nickname: lock.nickname,
          grade: lock.grade,
          gradeBand: lock.gradeBand,
          isHomeOnly: !lock.schoolId,
          participationOptOut: lock.participationOptOut,
        };
        const bundle = await loadAuthorizedStudentBundle({
          viewerRole: adultViewerRole,
          viewerUid: adultViewerUid,
          student: studentStub,
          logAccess: false,
        });
        if (cancelled) return;
        setRecordIndex(bundle.index);
        setPrevShoppingCount(
          bundle.gameSessions.filter((s) => s.gameType === 'shopping').length
        );
        setPrevDeliveryCount(
          bundle.gameSessions.filter((s) => s.gameType === 'delivery').length
        );
        if (!lock.participationOptOut) {
          const pendingTrial = bundle.trials.find(
            (t) =>
              t.continuedStatus !== 'stopped' &&
              t.childFeedback === 'unrecorded' &&
              (t.where === lock.place || t.shareStatus === 'shared')
          );
          setActiveTrial(pendingTrial || null);
        }
        setPhase('disclosure');
      } catch (err) {
        console.error('Failed to load child bundle:', err);
        if (!cancelled) setPhase('disclosure');
      }
    }
    void initChildBundle();
    return () => {
      cancelled = true;
    };
  }, [lock, adultViewerRole, adultViewerUid]);

  const currentBaseQ = BASE_STORY_QUESTIONS[baseIdx];
  const currentShopQ = allShoppingQuestions[shopQIdx];
  const currentDelQ = allDeliveryQuestions[delQIdx];

  // Auto-readout effect when child enables "じどうで こえを よむ"
  useEffect(() => {
    if (!autoVoiceOn || isPaused) return;
    if (phase === 'base_questions' && currentBaseQ && !awaitingRecipient) {
      const text =
        followupTurn === 0
          ? currentBaseQ.promptByBand[lock.gradeBand]
          : followupPrompt;
      if (text) speakJapaneseText(text);
    } else if (phase === 'shopping_play' && currentShopQ) {
      speakJapaneseText(currentShopQ.prompt, () => setUsedTtsInGame(true));
    } else if (phase === 'interlude' && !interludeNeedsRecipient) {
      speakJapaneseText(interludeSpec.prompt);
    } else if (phase === 'delivery_play' && currentDelQ && delSubPhase === 'memorize') {
      const routeText = `じゅんばんは、${currentDelQ.sequence
        .map((k) => DELIVERY_NODES.find((n) => n.key === k)?.animalLabel || '')
        .join('、つぎに ')} だよ。`;
      speakJapaneseText(routeText, () => setUsedTtsInGame(true));
    }
  }, [
    autoVoiceOn,
    isPaused,
    phase,
    baseIdx,
    followupTurn,
    followupPrompt,
    awaitingRecipient,
    shopQIdx,
    interludeNeedsRecipient,
    delQIdx,
    delSubPhase,
    currentBaseQ,
    currentShopQ,
    currentDelQ,
    interludeSpec.prompt,
    lock.gradeBand,
  ]);

  const awardTownCoins = (delta: number, label: string, isStageClear = false) => {
    setCoins((prevCoins) => {
      const nextCoins = Math.min(99999, prevCoins + delta);
      if (!lock.participationOptOut) {
        void saveStudentRewards({
          studentId: lock.studentId,
          schoolId: lock.schoolId,
          classId: lock.classId,
          coins: nextCoins,
          totalSpins,
          unlockedItemIds,
          playTicketId: lock.playTicketId,
          participationOptOut: lock.participationOptOut,
        }).catch((e) => console.warn('Reward save warning:', e));
      }
      return nextCoins;
    });

    if (isStageClear) {
      soundEngine.playStageClear();
    } else {
      soundEngine.playCoinChime();
    }
    setCoinGainBanner(`+${delta} コイン（${label}）`);
    if (coinBannerTimerRef.current) {
      window.clearTimeout(coinBannerTimerRef.current);
    }
    coinBannerTimerRef.current = window.setTimeout(() => {
      setCoinGainBanner(null);
    }, 2200);
  };

  const handleRequestExit = () => {
    soundEngine.playTap();
    if (lock.isSchoolDeviceSession || !lock.pinHash) {
      soundEngine.stopBgm();
      onExitChildMode();
    } else {
      setUnlockModalOpen(true);
    }
  };

  const triggerIsolatedSafetyFlow = async (
    source: 'talk_button_scary' | 'keyword_detected' | 'gemini_safety_review',
    words: string
  ) => {
    setSubmittingOverlay(true);
    try {
      await submitChildSafetyReport({
        schoolId: lock.schoolId,
        classId: lock.classId,
        studentId: lock.studentId,
        studentNickname: lock.nickname,
        place: lock.place,
        triggerSource: source,
        childWords: words,
        playTicketId: lock.playTicketId,
      });
    } catch (err) {
      console.error('Safety report submission error:', err);
    } finally {
      setSubmittingOverlay(false);
      setTalkModalStep('closed');
      setPhase('safety_comfort');
    }
  };

  const toggleMultiChoice = (
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    soundEngine.playCardSelect();
    setStoryCelebrateCount((c) => c + 1);
    if (autoVoiceOn) {
      speakJapaneseText(item);
    }
    if (item === 'わからない' || item === 'こたえたくない' || item === 'とくに ないよ') {
      setter([item]);
      return;
    }
    const cleaned = current.filter(
      (c) => c !== 'わからない' && c !== 'こたえたくない' && c !== 'とくに ないよ'
    );
    if (cleaned.includes(item)) {
      setter(cleaned.filter((c) => c !== item));
    } else {
      setter([...cleaned, item]);
    }
  };

  // --------------------------------------------------------------------------
  // Base Question + Gemini A Followup Handlers
  // --------------------------------------------------------------------------
  const handleSubmitBaseOrFollowup = async () => {
    const activeChoices = followupTurn === 0 ? baseChoices : followupPicked;
    const activeFree = followupTurn === 0 ? baseFreeText : followupFree;

    if (activeChoices.length === 0 && !activeFree.trim()) {
      return;
    }

    if (containsChildSafetyKeyword(`${activeChoices.join(' ')} ${activeFree}`)) {
      await triggerIsolatedSafetyFlow(
        'keyword_detected',
        `${activeChoices.join('・')} ${activeFree}`.trim()
      );
      return;
    }

    setStoryCelebrateCount((c) => c + 1);

    if (followupTurn === 0 && baseIdx === 0) {
      setFirstHardChoicesRemembered(activeChoices);
    }

    const skipFollowup =
      activeChoices.every(
        (c) => c === 'わからない' || c === 'こたえたくない' || c === 'とくに ないよ'
      ) && !activeFree.trim();

    if (skipFollowup || followupTurn >= 2) {
      if (followupTurn > 0) {
        setFollowupTranscriptLog((prev) => [
          ...prev,
          `モモ: ${followupPrompt} / こたえ: ${activeChoices.join('・')} ${activeFree}`.trim(),
        ]);
      }
      setAwaitingRecipient(true);
      return;
    }

    setLoadingMomo(true);
    try {
      const nextUsed = followupTurn;
      if (followupTurn > 0) {
        setFollowupTranscriptLog((prev) => [
          ...prev,
          `モモ: ${followupPrompt} / こたえ: ${activeChoices.join('・')} ${activeFree}`.trim(),
        ]);
      }

      const resp = await callGeminiChildFollowup({
        gradeBand: lock.gradeBand,
        questionText:
          followupTurn === 0
            ? currentBaseQ.promptByBand[lock.gradeBand]
            : followupPrompt,
        choices: activeChoices,
        freeText: activeFree,
        followupsUsed: nextUsed,
      });

      if (resp.safetyTriggered || resp.data?.safety_review) {
        await triggerIsolatedSafetyFlow(
          'gemini_safety_review',
          `${activeChoices.join('・')} ${activeFree}`.trim()
        );
        return;
      }

      if (!resp.ok || !resp.data || resp.data.end_topic || resp.data.choices.length === 0) {
        setAwaitingRecipient(true);
      } else {
        setFollowupTurn((t) => t + 1);
        setFollowupPrompt(resp.data.line);
        setFollowupOptions(resp.data.choices);
        setFollowupAllowFree(resp.data.allow_free_text);
        setFollowupPicked([]);
        setFollowupFree('');
      }
    } catch {
      setAwaitingRecipient(true);
    } finally {
      setLoadingMomo(false);
    }
  };

  const handleSaveBaseQuestionWithVisibility = async (visibility: ChildVisibility) => {
    setStoryCelebrateCount((c) => c + 1);
    if (!lock.participationOptOut && (recordIndex || lock.playTicketId)) {
      const dateLabel = formatJapaneseDateLabel();
      const factSentence = buildChildAnswerFact({
        dateLabel,
        questionId: currentBaseQ.id,
        questionText: currentBaseQ.promptByBand.low,
        choices: baseChoices,
        freeText: baseFreeText,
      });

      const res = await saveChildAnswerAndObservation({
        index: recordIndex,
        studentId: lock.studentId,
        schoolId: lock.schoolId,
        classId: lock.classId,
        questionType: 'base',
        questionId: currentBaseQ.id,
        questionText: currentBaseQ.promptByBand.low,
        choices: baseChoices,
        freeText: baseFreeText,
        followupTranscript: followupTranscriptLog.join('\n'),
        visibility,
        isDistressSignal:
          currentBaseQ.isDistressTopic &&
          !baseChoices.every(
            (c) => c === 'とくに ないよ' || c === 'わからない' || c === 'こたえたくない'
          ),
        factSentence,
        place: lock.place,
        playTicketId: lock.playTicketId,
        participationOptOut: lock.participationOptOut,
      });
      if (res.nextIndex) setRecordIndex(res.nextIndex);
    }

    awardTownCoins(10, 'おはなし ありがとう');

    setBaseChoices([]);
    setBaseFreeText('');
    setFollowupTurn(0);
    setFollowupPrompt('');
    setFollowupOptions([]);
    setFollowupPicked([]);
    setFollowupFree('');
    setFollowupTranscriptLog([]);
    setAwaitingRecipient(false);

    if (baseIdx + 1 < BASE_STORY_QUESTIONS.length) {
      setBaseIdx(baseIdx + 1);
    } else {
      setPhase('shopping_intro');
    }
  };

  // --------------------------------------------------------------------------
  // Shopping Mini-Game Handlers (With 2D Flying-Coin Checkout Cutscene!)
  // --------------------------------------------------------------------------
  const startShoppingPlay = () => {
    soundEngine.playTap();
    setShopQIdx(0);
    setShopShowHint(false);
    setShopRetried(false);
    setShopItemsRecorded([]);
    setShopCheckoutAnim(null);
    setUsedTtsInGame(false);
    setPausedDuringGame(false);
    itemStartTimeRef.current = Date.now();
    setPhase('shopping_play');
  };

  const handleSelectShoppingChoice = (choiceIdx: number) => {
    if (shopCheckoutAnim?.active || !currentShopQ) return;

    const choice = currentShopQ.choices[choiceIdx];
    // Capture exact response latency BEFORE playing the 740ms 2D checkout cutscene!
    const elapsedSec = Math.max(
      1,
      Math.round(((Date.now() - itemStartTimeRef.current) / 1000) * 10) / 10
    );

    let nextRecorded = shopItemsRecorded;
    if (!currentShopQ.isPractice) {
      const itemRec: GameItemRecord = {
        questionId: currentShopQ.id,
        condition: currentShopQ.condition,
        correct: choice.errorType === '',
        errorType: choice.errorType,
        seconds: elapsedSec,
        usedHint: shopShowHint,
        retried: shopRetried,
      };
      nextRecorded = [...shopItemsRecorded, itemRec];
      setShopItemsRecorded(nextRecorded);
    }

    // Play cash register chime + 2D flying-coin & bag-packing cutscene!
    soundEngine.playRegisterCheckout();
    setShopCheckoutAnim({ active: true, chosenLabel: choice.label });

    if (animActionTimerRef.current) {
      window.clearTimeout(animActionTimerRef.current);
    }
    animActionTimerRef.current = window.setTimeout(() => {
      void (async () => {
        setShopCheckoutAnim(null);
        if (shopQIdx + 1 < allShoppingQuestions.length) {
          awardTownCoins(5, 'おかいもの');
          setShopQIdx((prev) => prev + 1);
          setShopShowHint(false);
          setShopRetried(false);
          itemStartTimeRef.current = Date.now();
        } else {
          if (!lock.participationOptOut && (recordIndex || lock.playTicketId)) {
            const { factSentence, conditionSummary } = buildShoppingFacts({
              attemptNumber: shoppingPlan.attemptNumber,
              form: shoppingPlan.form,
              orderPattern: shoppingPlan.orderPattern,
              place: lock.place,
              deviceType: lock.deviceType,
              usedTts: usedTtsInGame,
              paused: pausedDuringGame,
              items: nextRecorded,
            });
            const res = await saveGameSessionAndObservation({
              index: recordIndex,
              studentId: lock.studentId,
              schoolId: lock.schoolId,
              classId: lock.classId,
              gameType: 'shopping',
              attemptNumber: shoppingPlan.attemptNumber,
              version: GAME_BANK_VERSION,
              form: shoppingPlan.form,
              orderPattern: shoppingPlan.orderPattern,
              grade: lock.grade,
              gradeBand: lock.gradeBand,
              place: lock.place,
              deviceType: lock.deviceType,
              usedTts: usedTtsInGame,
              paused: pausedDuringGame,
              items: nextRecorded,
              factSentence,
              conditionSummary,
              playTicketId: lock.playTicketId,
              participationOptOut: lock.participationOptOut,
            });
            if (res.nextIndex) setRecordIndex(res.nextIndex);
          }
          awardTownCoins(25, 'おかいもの クリア！', true);
          setPhase('interlude');
        }
      })();
    }, 760);
  };

  // --------------------------------------------------------------------------
  // Interlude Talk Handlers
  // --------------------------------------------------------------------------
  const handleInterludeSubmit = async () => {
    if (interludeChoices.length === 0 && !interludeFreeText.trim()) return;
    if (containsChildSafetyKeyword(`${interludeChoices.join(' ')} ${interludeFreeText}`)) {
      await triggerIsolatedSafetyFlow(
        'keyword_detected',
        `${interludeChoices.join('・')} ${interludeFreeText}`.trim()
      );
      return;
    }
    setStoryCelebrateCount((c) => c + 1);
    if (interludeSpec.requiresRecipientChoice) {
      setInterludeNeedsRecipient(true);
    } else {
      await finalizeInterludeSave('both');
    }
  };

  const finalizeInterludeSave = async (visibility: ChildVisibility) => {
    if (!lock.participationOptOut && (recordIndex || lock.playTicketId)) {
      const dateLabel = formatJapaneseDateLabel();
      const factSentence = buildChildAnswerFact({
        dateLabel,
        questionId: interludeSpec.id,
        questionText: interludeSpec.prompt,
        choices: interludeChoices,
        freeText: interludeFreeText,
      });
      const res = await saveChildAnswerAndObservation({
        index: recordIndex,
        studentId: lock.studentId,
        schoolId: lock.schoolId,
        classId: lock.classId,
        questionType: 'interlude',
        questionId: interludeSpec.id,
        questionText: interludeSpec.prompt,
        choices: interludeChoices,
        freeText: interludeFreeText,
        followupTranscript: '',
        visibility,
        isDistressSignal:
          interludeSpec.isDistressTopic &&
          !interludeChoices.every(
            (c) => c === 'とくに ないよ' || c === 'わからない' || c === 'こたえたくない'
          ),
        factSentence,
        place: lock.place,
        playTicketId: lock.playTicketId,
        participationOptOut: lock.participationOptOut,
      });
      if (res.nextIndex) setRecordIndex(res.nextIndex);
    }
    awardTownCoins(10, 'ひだまりトーク');
    setInterludeNeedsRecipient(false);
    setPhase('delivery_intro');
  };

  // --------------------------------------------------------------------------
  // Animal Delivery Mini-Game Handlers (With 2D Postman Momo Delivery Cutscene!)
  // --------------------------------------------------------------------------
  const startDeliveryPlay = () => {
    soundEngine.playTap();
    setDelQIdx(0);
    setDelSubPhase('memorize');
    setDelChosenSeq([]);
    setDelShowHint(false);
    setDelRetried(false);
    setDelDeliveringAnim(false);
    setDelItemsRecorded([]);
    setUsedTtsInGame(false);
    setPausedDuringGame(false);
    itemStartTimeRef.current = Date.now();
    setPhase('delivery_play');
  };

  const handleTapDeliveryHouse = (key: DeliveryAnimalKey, nodeIdx: number) => {
    if (delDeliveringAnim || !currentDelQ) return;
    if (delChosenSeq.length >= currentDelQ.length) return;
    soundEngine.playHouseNote(nodeIdx);
    setDelChosenSeq((prev) => [...prev, key]);
  };

  const handleConfirmDeliveryAttempt = () => {
    if (delDeliveringAnim || !currentDelQ || delChosenSeq.length === 0) return;

    // Capture exact recall latency BEFORE Postman Momo runs across the 2D village!
    const elapsedSec = Math.max(
      1,
      Math.round(((Date.now() - itemStartTimeRef.current) / 1000) * 10) / 10
    );
    const classified = classifyDeliveryAttempt(currentDelQ.sequence, delChosenSeq);

    let nextRecorded = delItemsRecorded;
    if (!currentDelQ.isPractice) {
      const rec: GameItemRecord = {
        questionId: currentDelQ.id,
        condition: `seq_${currentDelQ.length}` as GameItemRecord['condition'],
        correct: classified.correct,
        errorType: classified.errorType,
        seconds: elapsedSec,
        usedHint: delShowHint,
        retried: delRetried,
      };
      nextRecorded = [...delItemsRecorded, rec];
      setDelItemsRecorded(nextRecorded);
    }

    // Trigger Postman Momo 2D Delivery Run across the village!
    setDelDeliveringAnim(true);
    const runDurationMs = Math.max(820, delChosenSeq.length * 270 + 180);

    if (animActionTimerRef.current) {
      window.clearTimeout(animActionTimerRef.current);
    }
    animActionTimerRef.current = window.setTimeout(() => {
      void (async () => {
        setDelDeliveringAnim(false);
        if (delQIdx + 1 < allDeliveryQuestions.length) {
          awardTownCoins(5, 'おとどけ 完了');
          setDelQIdx((prev) => prev + 1);
          setDelSubPhase('memorize');
          setDelChosenSeq([]);
          setDelShowHint(false);
          setDelRetried(false);
          itemStartTimeRef.current = Date.now();
        } else {
          if (!lock.participationOptOut && (recordIndex || lock.playTicketId)) {
            const { factSentence, conditionSummary } = buildDeliveryFacts({
              attemptNumber: deliveryPlan.attemptNumber,
              form: deliveryPlan.form,
              place: lock.place,
              deviceType: lock.deviceType,
              usedTts: usedTtsInGame,
              paused: pausedDuringGame,
              items: nextRecorded,
            });
            const res = await saveGameSessionAndObservation({
              index: recordIndex,
              studentId: lock.studentId,
              schoolId: lock.schoolId,
              classId: lock.classId,
              gameType: 'delivery',
              attemptNumber: deliveryPlan.attemptNumber,
              version: GAME_BANK_VERSION,
              form: deliveryPlan.form,
              orderPattern: 'fixed',
              grade: lock.grade,
              gradeBand: lock.gradeBand,
              place: lock.place,
              deviceType: lock.deviceType,
              usedTts: usedTtsInGame,
              paused: pausedDuringGame,
              items: nextRecorded,
              factSentence,
              conditionSummary,
              playTicketId: lock.playTicketId,
              participationOptOut: lock.participationOptOut,
            });
            if (res.nextIndex) setRecordIndex(res.nextIndex);
          }
          awardTownCoins(30, 'はいたつ ぜんぶ クリア！', true);
          setPhase('ending');
        }
      })();
    }, runDurationMs);
  };

  // --------------------------------------------------------------------------
  // "だれかに はなしたい" -> "こまってる ことを はなしたい" Handler
  // --------------------------------------------------------------------------
  const handleManualTroubleSave = async (visibility: ChildVisibility) => {
    if (!lock.participationOptOut && (recordIndex || lock.playTicketId)) {
      const dateLabel = formatJapaneseDateLabel();
      const factSentence = buildChildAnswerFact({
        dateLabel,
        questionId: 'talk_trouble_manual',
        questionText: 'こまってる ことを はなしたい',
        choices: manualTroubleChoices,
        freeText: manualTroubleText,
      });
      const res = await saveChildAnswerAndObservation({
        index: recordIndex,
        studentId: lock.studentId,
        schoolId: lock.schoolId,
        classId: lock.classId,
        questionType: 'talk_trouble',
        questionId: 'talk_trouble_manual',
        questionText: 'こまってる ことを はなしたい',
        choices: manualTroubleChoices,
        freeText: manualTroubleText,
        followupTranscript: '',
        visibility,
        isDistressSignal: true,
        factSentence,
        place: lock.place,
        playTicketId: lock.playTicketId,
        participationOptOut: lock.participationOptOut,
      });
      if (res.nextIndex) setRecordIndex(res.nextIndex);
    }
    setManualTroubleChoices([]);
    setManualTroubleText('');
    setTalkModalStep('closed');
  };

  const activeStopIndex = useMemo(() => {
    const idx = TOWN_STOPS.findIndex((s) => s.matchPhases.includes(phase));
    return idx >= 0 ? idx : 0;
  }, [phase]);

  return (
    <div className="child-game-text min-h-screen bg-[#F6EFE2] text-[#3A3128]">
      {/* Top Persistent Single-Row Adventure Game HUD */}
      <header className="sticky top-0 z-30 border-b-2 border-[#E2D6BF] bg-[#FFFDF8]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 overflow-x-auto px-3 py-1.5 sm:px-5">
          <div className="flex items-center gap-2 shrink-0">
            <MomoAvatar size={36} />
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-heading text-base sm:text-lg font-bold text-[#3A3128]">
                がっこう たんけん
              </span>
              <span className="hidden md:inline text-xs font-bold text-[#6E6254] truncate max-w-[140px]">
                · {lock.nickname}さん
              </span>
            </div>
          </div>

          {/* Tactile Single-Line Game HUD Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Coin Pouch & 3D Gacha Quick Launch */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playTap();
                setGachaInitialTab('machine');
                setGachaModalOpen(true);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#E6C785] border-b-4 bg-[#FFF8E6] px-2.5 py-1 text-xs sm:text-sm font-bold text-[#8F5210] tabular-nums transition-transform active:translate-y-0.5 hover:bg-[#FCEFD0] whitespace-nowrap shrink-0"
            >
              <Coins className="h-4 w-4 text-[#D99B26]" />
              <span>{coins} コイン</span>
              <span className="text-[#C86428]">· ガチャ</span>
            </button>

            {/* Auto Voice Readout Toggle */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playTap();
                const next = !autoVoiceOn;
                setAutoVoiceOn(next);
                if (next) {
                  speakJapaneseText('じどうで こえを よむよ');
                }
              }}
              className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-b-4 px-2.5 py-1 text-xs font-bold transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 ${
                autoVoiceOn
                  ? 'border-[#C86428] bg-[#FFF3E6] text-[#9A4816]'
                  : 'border-[#DFD5C5] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
              }`}
            >
              <Volume2 className="h-4 w-4" />
              <span>{autoVoiceOn ? 'よみあげ ON' : 'よみあげ'}</span>
            </button>

            {/* Gentle BGM Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = soundEngine.toggleBgm();
                setBgmOn(next);
              }}
              className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-b-4 px-2.5 py-1 text-xs font-bold transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 ${
                bgmOn
                  ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                  : 'border-[#DFD5C5] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
              }`}
            >
              {bgmOn ? (
                <Volume2 className="h-4 w-4 text-[#2F7A54]" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>{bgmOn ? 'おんがく ON' : 'おんがく'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playTap();
                setIsPaused(true);
                if (phase === 'shopping_play' || phase === 'delivery_play') {
                  setPausedDuringGame(true);
                }
              }}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-[#BFE0C9] border-b-4 bg-[#EDF7F0] px-2.5 py-1 text-xs sm:text-sm font-bold text-[#215C3E] whitespace-nowrap shrink-0 transition-transform active:translate-y-0.5 hover:bg-[#DFF0E5]"
            >
              <Pause className="h-4 w-4 text-[#2F7A54]" />
              <span>やすむ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playTap();
                setTalkModalStep('menu');
              }}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border-2 border-[#F3CEAA] border-b-4 bg-[#FFF3E6] px-2.5 py-1 text-xs sm:text-sm font-bold text-[#9A4816] whitespace-nowrap shrink-0 transition-transform active:translate-y-0.5 hover:bg-[#FFE8CF]"
            >
              <MessageCircle className="h-4 w-4 text-[#C86428]" />
              <span>だれかに はなしたい</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Coin Reward Toast */}
      {coinGainBanner && (
        <div className="fixed top-16 right-4 z-40 rounded-2xl border-2 border-[#E6C785] bg-[#FFFDF8] px-4 py-2 shadow-md flex items-center gap-2 text-sm font-bold text-[#8F5210] tabular-nums">
          <Coins className="h-4 w-4 text-[#D99B26]" />
          <span>{coinGainBanner}</span>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-3.5 py-3.5 sm:px-4 sm:py-5 space-y-4">
        {/* Living 2D Town Panorama Adventure Map (Shown on all town stops/intros; focused games get full viewport!) */}
        {phase !== 'loading' &&
          phase !== 'safety_comfort' &&
          phase !== 'shopping_play' &&
          phase !== 'delivery_play' && (
            <TownPanorama2DMap
              activeStopIndex={activeStopIndex}
              stops={TOWN_STOPS}
              zukanLabel={`ずかん (${unlockedItemIds.length}/${GACHA_CATALOG.length})`}
              onOpenZukan={() => {
                soundEngine.playTap();
                setGachaInitialTab('zukan');
                setGachaModalOpen(true);
              }}
            />
          )}

        {phase === 'loading' && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-6 sm:p-8 text-center space-y-4">
            <StoryScene2DStage
              variant="cozy_meadow"
              talking
              compact
              badgeText="ひだまりタウンへ しゅっぱつ！"
            />
            <p className="font-heading text-xl font-bold text-[#3A3128]">
              たんけんの まちを ひらいて いるよ...
            </p>
          </div>
        )}

        {/* 1. Mandatory 4-Point Pre-Play Disclosure (With 2D Fountain Plaza Viewport & Picture Cards!) */}
        {phase === 'disclosure' && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            <StoryScene2DStage
              variant="plaza"
              talking
              celebrateCount={storyCelebrateCount}
              badgeText="ひだまりタウン・ふんすいひろば"
            />

            <div className="rounded-2xl bg-[#EEF7F0] border-2 border-[#CFE5D6] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-[#3A3128]">
                  ようこそ！ ひだまりタウンの がっこうたんけん
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-[#4D5E52]">
                  あんないやくの「モモ」と いっしょに、おかいものや どうぶつの おとどけゲームで コインを あつめて 3Dガチャを まわそう！
                </p>
              </div>
              <TtsButton
                text="わたしは モモ。コンピューターで うごく AIの なかまだよ。おはなしした ことと ゲームの きろくは、せんせいや おうちの ひとが みることが あるよ。テストでは ないから、まちがえても コインが もらえて だいじょうぶ だよ。いつでも やすむを おして いいよ。"
                onUsed={() => setUsedTtsInGame(true)}
              />
            </div>

            <div>
              <h2 className="font-heading text-base sm:text-lg font-bold text-[#3A3128]">
                はじめる まえの 4つの おやくそく
              </h2>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {[
                  {
                    icon: 'ゲーム',
                    text: '1. モモは、コンピューターで うごく なかま（AI）だよ。',
                  },
                  {
                    icon: 'せんせいと おうちの ひと',
                    text: '2. おはなしと ゲームの きろくは、せんせいや おうちの ひとが みることが あるよ。',
                  },
                  {
                    icon: 'よかった',
                    text: '3. テストじゃないよ！ まちがえても コインが もらえるよ。',
                  },
                  {
                    icon: 'ゆっくり できるとき',
                    text: '4. つかれたら、いつでも うえの「やすむ」を おしてね。',
                  },
                ].map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 rounded-2xl border-2 border-[#EAE2D3] bg-[#FAF5EC] px-3.5 py-3 text-sm sm:text-base font-bold text-[#3A3128]"
                  >
                    <StoryChoiceIcon label={item.icon} size={40} />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleRequestExit}
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl border-2 border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
              >
                {lock.isSchoolDeviceSession ? (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span>はじめの がめんへ もどる</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>おとなの がめんへ もどる</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playStageClear();
                  if (!soundEngine.isBgmActive()) {
                    soundEngine.startBgm();
                    setBgmOn(true);
                  }
                  setStoryCelebrateCount((c) => c + 1);
                  setPhase(activeTrial ? 'trial_feedback' : 'base_questions');
                }}
                className="inline-flex min-h-[58px] items-center gap-2 rounded-2xl bg-[#2F7A54] border-b-[5px] border-[#1D4E35] px-8 py-3 font-heading text-lg sm:text-xl font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344]"
              >
                <Sparkles className="h-5 w-5" />
                <span>わかった！ ぼうけん スタート</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Optional Active Trial Impression */}
        {phase === 'trial_feedback' && activeTrial && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-xs space-y-5">
            <StoryScene2DStage
              variant="plaza"
              talking
              celebrateCount={storyCelebrateCount}
              badgeText="くふうの かんそうカード"
            />

            <div className="rounded-2xl border-2 border-[#F3CEAA] bg-[#FFF8EE] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg sm:text-xl font-bold text-[#3A3128]">
                  さいきん ためして みた くふう、どうだった？
                </h2>
                <p className="mt-1.5 text-base font-bold text-[#9A4816]">
                  「{activeTrial.whatToChange}」
                </p>
              </div>
              <TtsButton
                text={`さいきん ためして みた くふう、${activeTrial.whatToChange} は、どうだった？`}
                onUsed={() => setUsedTtsInGame(true)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: 'good', label: 'よかった' },
                  { key: 'normal', label: 'ふつう' },
                  { key: 'disliked', label: 'いやだった' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={async () => {
                    if (containsChildSafetyKeyword(trialNote)) {
                      await triggerIsolatedSafetyFlow('keyword_detected', trialNote);
                      return;
                    }
                    await saveChildTrialFeedback({
                      trialId: activeTrial.trialId,
                      childFeedback: opt.key,
                      childFeedbackNote: trialNote,
                      participationOptOut: lock.participationOptOut,
                    });
                    awardTownCoins(10, 'かんそうを おしえてくれたよ');
                    setPhase('base_questions');
                  }}
                  className="flex min-h-[64px] items-center gap-3.5 rounded-2xl border-2 border-[#BFE0C9] border-b-4 bg-[#EDF7F0] px-4 py-3 text-left font-heading text-lg font-bold text-[#3A3128] transition-all active:translate-y-0.5 hover:border-[#2F7A54]"
                >
                  <StoryChoiceIcon label={opt.label} size={44} />
                  <span>{opt.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playTap();
                  setPhase('base_questions');
                }}
                className="flex min-h-[64px] items-center gap-3.5 rounded-2xl border-2 border-[#DFD5C5] border-b-4 bg-[#FAF5EC] px-4 py-3 text-left font-heading text-lg font-bold text-[#6E6254] transition-all active:translate-y-0.5 hover:bg-[#F2EAE0]"
              >
                <StoryChoiceIcon label="こたえなくて いい" size={44} />
                <span>こたえなくて いい</span>
              </button>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-[#6E6254]">
                ひとこと かきたい ことが あれば どうぞ（かかなくても いいよ）
              </label>
              <input
                type="text"
                maxLength={200}
                value={trialNote}
                onChange={(e) => setTrialNote(e.target.value)}
                placeholder="れい：やりやすかったよ"
                className="mt-1.5 min-h-[48px] w-full rounded-2xl border-2 border-[#DFD5C5] bg-white px-4 text-base text-[#3A3128]"
              />
            </div>
          </div>
        )}

        {/* 3. Fixed Base Story Questions + Illustrated Picture Cards + 2D Fountain Plaza Stage */}
        {phase === 'base_questions' && currentBaseQ && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            <StoryScene2DStage
              variant="plaza"
              talking={loadingMomo || followupTurn > 0}
              celebrateCount={storyCelebrateCount}
              badgeText={`ひろばの おはなし ${baseIdx + 1} / ${BASE_STORY_QUESTIONS.length}（+10コイン）`}
            />

            {!awaitingRecipient ? (
              <>
                <div className="rounded-2xl border-2 border-[#DFD4C0] bg-[#FAF5EC] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MomoAvatar size={54} mood={loadingMomo ? 'listening' : 'cheerful'} />
                    <h2 className="font-heading text-lg sm:text-xl font-bold leading-relaxed text-[#3A3128]">
                      <RubyText
                        text={
                          followupTurn === 0
                            ? currentBaseQ.promptByBand[lock.gradeBand]
                            : followupPrompt
                        }
                      />
                    </h2>
                  </div>

                  <TtsButton
                    text={
                      followupTurn === 0
                        ? currentBaseQ.promptByBand[lock.gradeBand]
                        : followupPrompt
                    }
                    onUsed={() => setUsedTtsInGame(true)}
                  />
                </div>

                {/* Illustrated Picture-Book Story Cards (Easy to understand visually!) */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(followupTurn === 0
                    ? [...currentBaseQ.choices, 'わからない', 'こたえたくない']
                    : followupOptions
                  ).map((choice, idx) => {
                    const selected =
                      followupTurn === 0
                        ? baseChoices.includes(choice)
                        : followupPicked.includes(choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() =>
                          followupTurn === 0
                            ? toggleMultiChoice(baseChoices, setBaseChoices, choice)
                            : toggleMultiChoice(followupPicked, setFollowupPicked, choice)
                        }
                        className={`flex min-h-[66px] items-center justify-between gap-3 rounded-2xl border-2 border-b-4 px-3.5 py-2.5 text-left text-base sm:text-lg font-bold transition-all active:translate-y-0.5 ${
                          selected
                            ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                            : 'border-[#DFD4C0] bg-white text-[#3A3128] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <StoryChoiceIcon label={choice} indexHint={idx} size={44} />
                          <RubyText text={choice} />
                        </span>
                        {selected && (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2F7A54] text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {(followupTurn === 0 || followupAllowFree) && (
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-[#6E6254]">
                      じぶんの ことばで かいても いいよ（かかなくても いいよ）
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={followupTurn === 0 ? baseFreeText : followupFree}
                      onChange={(e) =>
                        followupTurn === 0
                          ? setBaseFreeText(e.target.value)
                          : setFollowupFree(e.target.value)
                      }
                      placeholder="ここに かけます"
                      className="mt-1.5 min-h-[48px] w-full rounded-2xl border-2 border-[#DFD5C5] bg-white px-4 text-base text-[#3A3128]"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={
                      loadingMomo ||
                      ((followupTurn === 0 ? baseChoices.length === 0 : followupPicked.length === 0) &&
                        !(followupTurn === 0 ? baseFreeText.trim() : followupFree.trim()))
                    }
                    onClick={handleSubmitBaseOrFollowup}
                    className="min-h-[56px] rounded-2xl bg-[#2F7A54] border-b-[5px] border-[#1D4E35] px-8 py-3 font-heading text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344] disabled:opacity-45"
                  >
                    {loadingMomo ? 'モモが きいて いるよ...' : 'えらんだよ！（つぎへ）'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-[#F3CEAA] bg-[#FFF8EE] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MomoAvatar size={54} mood="gentle" />
                    <div>
                      <p className="text-xs font-bold text-[#9A4816]">おしえてくれて ありがとう！</p>
                      <h2 className="font-heading text-lg sm:text-xl font-bold text-[#3A3128]">
                        いまの おはなし、だれに しってほしい？
                      </h2>
                    </div>
                  </div>
                  <TtsButton text="いまの おはなし、だれに しってほしい？" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: 'both', label: 'せんせいと おうちの ひと' },
                      { key: 'teacher', label: 'せんせいだけ' },
                      { key: 'parent', label: 'おうちの ひとだけ' },
                      { key: 'none', label: 'いまは だれにも いわない' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSaveBaseQuestionWithVisibility(opt.key)}
                      className="flex min-h-[66px] items-center gap-3.5 rounded-2xl border-2 border-[#DFD4C0] border-b-4 bg-white px-4 py-3 text-left font-heading text-base sm:text-lg font-bold text-[#3A3128] transition-all active:translate-y-0.5 hover:border-[#2F7A54] hover:bg-[#EDF7F0]"
                    >
                      <StoryChoiceIcon label={opt.label} size={44} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4A. Shopping Intro (Live 2D Animated Bear's Market Stage!) */}
        {phase === 'shopping_intro' && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-[#C86428]">
                  ミニゲーム 1 · おかいものよこちょう（1もんごとに +5コイン / クリアで +25コイン）
                </span>
                <h2 className="mt-0.5 font-heading text-2xl font-bold text-[#3A3128]">
                  くまさんの ひだまりマルシェ！
                </h2>
              </div>
              <TtsButton
                text="くまさんの おみせへ ようこそ！ カウンターで ぴったりの ねだんを レジの ボタンから えらぼう。さいしょの 2もんは れんしゅう だよ。"
                onUsed={() => setUsedTtsInGame(true)}
              />
            </div>

            {/* 60fps Moving 2D Market Counter Preview */}
            <Shopping2DStage checkoutState={null} isIntroPreview />

            <p className="text-base font-medium text-[#4D4236]">
              くまさんの カウンターで、おかいものを しよう！ レジの ボタンを おすと チャリーン！と コインが とんで おかいものできるよ。さいしょの 2もんは れんしゅう だから あんしんしてね。
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { icon: 'apple', label: 'くだもの' },
                  { icon: 'bread', label: 'パン・おかし' },
                  { icon: 'pencil', label: 'ぶんぼうぐ' },
                ] as const
              ).map((shelf, idx) => (
                <button
                  key={shelf.label}
                  type="button"
                  onClick={() => soundEngine.playHouseNote(idx)}
                  className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-2xl border-2 border-[#EAE2D3] bg-[#FAF5EC] p-3 hover:border-[#C86428] transition-colors"
                >
                  <ShoppingItemSvg icon={shelf.icon} />
                  <span className="text-xs sm:text-sm font-bold text-[#3A3128]">{shelf.label}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={startShoppingPlay}
                className="min-h-[58px] rounded-2xl bg-[#C86428] border-b-[5px] border-[#8E4316] px-9 py-3 font-heading text-lg sm:text-xl font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#B0541E]"
              >
                おみせに はいって あそぶ！
              </button>
            </div>
          </div>
        )}

        {/* 4B. Shopping Play (Full 60fps 2D Store Scene + Plated Items on Every Question + Coin Register Keys!) */}
        {phase === 'shopping_play' && currentShopQ && (
          <div className="rounded-3xl border-2 border-[#DECBAE] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_8px_24px_rgba(107,83,68,0.07)] space-y-3">
            {/* Top Game Stage Progress & Helper Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E6254] tabular-nums">
                  <span className="text-[#9A4816]">
                    {currentShopQ.isPractice
                      ? `れんしゅう ${shopQIdx + 1} / ${shoppingPlan.practiceQuestions.length}`
                      : `おかいもの ${shopQIdx - shoppingPlan.practiceQuestions.length + 1} / ${shoppingPlan.mainQuestions.length}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#8F5210]">くまさんの マルシェ（+5コイン）</span>
                </div>
                {/* Visual Progress Bar Segments */}
                <div className="flex items-center gap-1">
                  {allShoppingQuestions.map((q, dotIdx) => (
                    <span
                      key={q.id}
                      className={`h-2 rounded-full transition-all ${
                        dotIdx < shopQIdx
                          ? 'w-3.5 bg-[#2F7A54]'
                          : dotIdx === shopQIdx
                            ? 'w-6 bg-[#C86428]'
                            : 'w-2 bg-[#E5DEC9]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TtsButton
                  text={currentShopQ.prompt}
                  label="もんだいを きく"
                  onUsed={() => {
                    setUsedTtsInGame(true);
                    setShopRetried(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setShopShowHint(true);
                    if (autoVoiceOn) speakJapaneseText(currentShopQ.hint);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[#F3CEAA] bg-[#FFF3E6] px-3.5 py-1.5 text-sm font-bold text-[#9A4816] whitespace-nowrap transition-colors hover:bg-[#FFE8CF]"
                >
                  <HelpCircle className="h-4 w-4 text-[#C86428]" />
                  <span>ヒント</span>
                </button>
              </div>
            </div>

            {/* 60fps Moving 2D Bear's Store Counter Viewport (Consistent Plated Item Illustrations on EVERY Question!) */}
            <Shopping2DStage question={currentShopQ} checkoutState={shopCheckoutAnim} />

            {/* Easy-to-Scan Order Speech Bubble */}
            <div className="rounded-2xl border-2 border-[#E5DEC9] bg-[#FAF5EC] px-4 py-3 flex items-center justify-between gap-3">
              <p className="font-heading text-lg sm:text-xl font-bold leading-relaxed text-[#3A3128]">
                <HighlightedShopPrompt text={currentShopQ.prompt} />
              </p>
            </div>

            {shopShowHint && (
              <div className="rounded-2xl border-2 border-[#F3CEAA] bg-[#FFF3E6] px-4 py-2.5 text-sm sm:text-base font-bold text-[#9A4816]">
                くまさんの ヒント：{currentShopQ.hint}
              </div>
            )}

            {/* Tactile Wooden Cash Register Keypad with Visual 50円/10円/5円/1円 Coins on Every Key! */}
            <div className="rounded-3xl border-2 border-[#D7C3A5] bg-[#EFE3CE] p-3 sm:p-3.5">
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-[#6E5B45]">
                <span>おみせの レジボタン（ぴったりの ねだんを おそう！）</span>
                <span>チャリーン！</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {currentShopQ.choices.map((ch, idx) => {
                  const isChosenAnim =
                    shopCheckoutAnim?.active && shopCheckoutAnim.chosenLabel === ch.label;
                  return (
                    <button
                      key={`${ch.label}-${idx}`}
                      type="button"
                      disabled={Boolean(shopCheckoutAnim?.active)}
                      onClick={() => handleSelectShoppingChoice(idx)}
                      className={`flex min-h-[66px] items-center justify-between gap-2 rounded-2xl border-2 border-b-[5px] px-4 py-2 transition-all active:translate-y-1 disabled:cursor-default ${
                        isChosenAnim
                          ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E] translate-y-0.5'
                          : 'border-[#CBB696] bg-[#FFFDF9] text-[#3A3128] hover:border-[#2F7A54] hover:bg-[#F5FBF7]'
                      }`}
                    >
                      <span className="font-heading text-xl sm:text-2xl font-bold tabular-nums whitespace-nowrap">
                        {ch.label}
                      </span>
                      <CoinStackVisual amount={ch.value} compact />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. Interlude Talk (With 2D Sunlit Park Bench Stage & Illustrated Cards!) */}
        {phase === 'interlude' && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            <StoryScene2DStage
              variant="park_bench"
              talking
              celebrateCount={storyCelebrateCount}
              badgeText="ひだまりベンチで ひとやすみ（+10コイン）"
            />

            {!interludeNeedsRecipient ? (
              <>
                <div className="rounded-2xl border-2 border-[#DFD4C0] bg-[#FAF5EC] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MomoAvatar size={52} />
                    <h2 className="font-heading text-lg sm:text-xl font-bold text-[#3A3128]">
                      {interludeSpec.prompt}
                    </h2>
                  </div>
                  <TtsButton
                    text={interludeSpec.prompt}
                    onUsed={() => setUsedTtsInGame(true)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[...interludeSpec.choices, 'わからない', 'こたえたくない'].map((ch, idx) => {
                    const selected = interludeChoices.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          toggleMultiChoice(interludeChoices, setInterludeChoices, ch)
                        }
                        className={`flex min-h-[66px] items-center justify-between gap-3 rounded-2xl border-2 border-b-4 px-3.5 py-2.5 text-left text-base sm:text-lg font-bold transition-all active:translate-y-0.5 ${
                          selected
                            ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                            : 'border-[#DFD4C0] bg-white text-[#3A3128] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <StoryChoiceIcon label={ch} indexHint={idx} size={44} />
                          <span>{ch}</span>
                        </span>
                        {selected && (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2F7A54] text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#6E6254]">
                    じぶんの ことばで かいても いいよ（かかなくても いいよ）
                  </label>
                  <input
                    type="text"
                    maxLength={250}
                    value={interludeFreeText}
                    onChange={(e) => setInterludeFreeText(e.target.value)}
                    placeholder="ここに かけます"
                    className="mt-1.5 min-h-[48px] w-full rounded-2xl border-2 border-[#DFD5C5] bg-white px-4 text-base text-[#3A3128]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={interludeChoices.length === 0 && !interludeFreeText.trim()}
                    onClick={handleInterludeSubmit}
                    className="min-h-[56px] rounded-2xl bg-[#2F7A54] border-b-[5px] border-[#1D4E35] px-8 py-3 font-heading text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344] disabled:opacity-45"
                  >
                    つぎの まちへ すすむ！
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-[#F3CEAA] bg-[#FFF8EE] p-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-heading text-lg sm:text-xl font-bold text-[#3A3128]">
                    いまの おはなし、だれに しってほしい？
                  </h2>
                  <TtsButton text="いまの おはなし、だれに しってほしい？" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: 'both', label: 'せんせいと おうちの ひと' },
                      { key: 'teacher', label: 'せんせいだけ' },
                      { key: 'parent', label: 'おうちの ひとだけ' },
                      { key: 'none', label: 'いまは だれにも いわない' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => finalizeInterludeSave(opt.key)}
                      className="flex min-h-[66px] items-center gap-3.5 rounded-2xl border-2 border-[#DFD4C0] border-b-4 bg-white px-4 py-3 text-left font-heading text-base sm:text-lg font-bold text-[#3A3128] transition-all active:translate-y-0.5 hover:border-[#2F7A54] hover:bg-[#EDF7F0]"
                    >
                      <StoryChoiceIcon label={opt.label} size={44} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6A. Animal Delivery Intro (Interactive 2D Village Meadow Map!) */}
        {phase === 'delivery_intro' && (
          <div className="rounded-3xl border-2 border-[#BFE0C9] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-[#215C3E]">
                  ミニゲーム 2 · どうぶつ郵便やさん（1もんごとに +5コイン / クリアで +30コイン）
                </span>
                <h2 className="mt-0.5 font-heading text-2xl font-bold text-[#3A3128]">
                  モモの おてがみ おとどけゲーム！
                </h2>
              </div>
              <TtsButton
                text="ゆうびんやさんの モモが あるいた じゅんばんを おぼえて、マップの おうちを タップして おてがみを とどけよう！"
                onUsed={() => setUsedTtsInGame(true)}
              />
            </div>

            {/* Interactive 2D Village Map Preview (Tap any house on the map to chime!) */}
            <DeliveryVillage2DStage
              mode="intro"
              targetSequence={[]}
              chosenSequence={[]}
            />

            <p className="text-base font-medium text-[#4D4236]">
              マップの おうちを さわると きれいな おとが なるよ！ モモが おうちを まわる うごきを みて、おなじ じゅんばんで おてがみを とどけよう。
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={startDeliveryPlay}
                className="min-h-[58px] rounded-2xl bg-[#2F7A54] border-b-[5px] border-[#1D4E35] px-9 py-3 font-heading text-lg sm:text-xl font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344]"
              >
                はいたつに しゅっぱつ！
              </button>
            </div>
          </div>
        )}

        {/* 6B. Animal Delivery Play (Moving 2D Postman Momo Cutscene + Interactive Village Map!) */}
        {phase === 'delivery_play' && currentDelQ && (
          <div className="rounded-3xl border-2 border-[#BFE0C9] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_8px_24px_rgba(107,83,68,0.07)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E6254] tabular-nums">
                  <span className="text-[#215C3E]">
                    {currentDelQ.isPractice
                      ? `れんしゅう ${delQIdx + 1} / ${deliveryPlan.practiceQuestions.length}`
                      : `はいたつ ${delQIdx - deliveryPlan.practiceQuestions.length + 1} / ${deliveryPlan.mainQuestions.length}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#2F7A54]">どうぶつ郵便（+5コイン）</span>
                </div>
                <div className="flex items-center gap-1">
                  {allDeliveryQuestions.map((q, dotIdx) => (
                    <span
                      key={q.id}
                      className={`h-2 rounded-full transition-all ${
                        dotIdx < delQIdx
                          ? 'w-3.5 bg-[#2F7A54]'
                          : dotIdx === delQIdx
                            ? 'w-6 bg-[#C86428]'
                            : 'w-2 bg-[#E5DEC9]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {delSubPhase === 'recall' && !delDeliveringAnim && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playTap();
                      setDelRetried(true);
                      setDelSubPhase('memorize');
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[#BFE0C9] bg-[#EDF7F0] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#215C3E] whitespace-nowrap transition-colors hover:bg-[#DFF0E5]"
                  >
                    <RotateCcw className="h-4 w-4 text-[#2F7A54]" />
                    <span>もういちど みる</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setDelShowHint(true);
                    if (autoVoiceOn) speakJapaneseText(currentDelQ.hint);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[#F3CEAA] bg-[#FFF3E6] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#9A4816] whitespace-nowrap transition-colors hover:bg-[#FFE8CF]"
                >
                  <HelpCircle className="h-4 w-4 text-[#C86428]" />
                  <span>ヒント</span>
                </button>
              </div>
            </div>

            {/* 60fps 2D Village Map Stage (Memorize Walk Cutscene -> Interactive Tap -> Delivery Run!) */}
            <DeliveryVillage2DStage
              mode={
                delDeliveringAnim
                  ? 'delivering'
                  : delSubPhase === 'memorize'
                    ? 'memorize'
                    : 'recall'
              }
              targetSequence={currentDelQ.sequence}
              chosenSequence={delChosenSeq}
              maxPickLength={currentDelQ.length}
              onTapHouse={handleTapDeliveryHouse}
            />

            {delSubPhase === 'memorize' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#CFE3D5] bg-[#EEF7F0] px-4 py-3">
                  <p className="font-heading text-base sm:text-lg font-bold text-[#215C3E]">
                    モモが あるく じゅんばんを みて おぼえよう！（{currentDelQ.sequence.length}けん）
                  </p>
                  <TtsButton
                    text={`じゅんばんは、${currentDelQ.sequence
                      .map((k) => DELIVERY_NODES.find((n) => n.key === k)?.animalLabel || '')
                      .join('、つぎに ')} だよ。`}
                    label="こえで きく"
                    onUsed={() => setUsedTtsInGame(true)}
                  />
                </div>

                {/* Clear Visual Sequence Strip alongside the Moving 2D Map */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  {currentDelQ.sequence.map((animalKey, idx) => {
                    const spec = DELIVERY_NODES.find((n) => n.key === animalKey)!;
                    return (
                      <button
                        key={`${animalKey}-${idx}`}
                        type="button"
                        onClick={() => {
                          const hIdx = DELIVERY_NODES.findIndex((n) => n.key === animalKey);
                          soundEngine.playHouseNote(hIdx >= 0 ? hIdx : idx);
                        }}
                        className="flex items-center gap-2.5 rounded-2xl border-2 border-[#DFD5C5] bg-[#FFFDF8] px-3.5 py-2 shadow-2xs hover:border-[#2F7A54]"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C86428] text-xs font-bold text-white tabular-nums">
                          {idx + 1}
                        </span>
                        <AnimalHouseIllustration node={spec} size={44} />
                        <div className="text-left">
                          <div className="font-heading text-sm font-bold text-[#3A3128]">
                            {spec.animalLabel}
                          </div>
                          <div className="text-[10px] text-[#6E6254]">{spec.houseLabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playTap();
                      itemStartTimeRef.current = Date.now();
                      setDelSubPhase('recall');
                    }}
                    className="min-h-[56px] rounded-2xl bg-[#2F7A54] border-b-[5px] border-[#1D4E35] px-8 py-3 font-heading text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344]"
                  >
                    おぼえた！ おうちを えらぶ
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {delShowHint && (
                  <div className="rounded-2xl border-2 border-[#F3CEAA] bg-[#FFF3E6] px-4 py-2.5 text-base font-bold text-[#9A4816]">
                    ヒント：{currentDelQ.hint}
                  </div>
                )}

                {/* Numbered Mailbag Route Slots */}
                <div className="rounded-2xl border-2 border-[#DFD4C0] bg-[#FAF5EC] p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#6E5B45] tabular-nums">
                    <span>ゆうびんかばんの じゅんばん（マップか したの おうちボタンを タップ！）</span>
                    <span>
                      {delChosenSeq.length} / {currentDelQ.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.from({ length: currentDelQ.length }).map((_, slotIdx) => {
                      const pickedKey = delChosenSeq[slotIdx];
                      const spec = pickedKey
                        ? DELIVERY_NODES.find((n) => n.key === pickedKey)
                        : null;
                      return (
                        <div
                          key={slotIdx}
                          className={`min-w-[108px] min-h-[52px] rounded-xl border-2 px-2.5 py-1.5 flex items-center gap-2 ${
                            spec
                              ? 'border-[#2F7A54] bg-[#FFFDF8] text-[#3A3128]'
                              : 'border-dashed border-[#CBBFA8] bg-[#F3ECE0]/60 text-[#8C7F70]'
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F7A54] text-[11px] font-bold text-white tabular-nums">
                            {slotIdx + 1}
                          </span>
                          {spec ? (
                            <>
                              <AnimalHouseIllustration node={spec} size={32} />
                              <span className="text-sm font-bold">{spec.animalLabel}</span>
                            </>
                          ) : (
                            <span className="text-xs font-bold">どこかな？</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick-Tap Tactile Animal House Buttons (Synced with the 2D Map!) */}
                <div className="grid grid-cols-5 gap-2">
                  {DELIVERY_NODES.map((node, nodeIdx) => {
                    const orderBadge = delChosenSeq.indexOf(node.key);
                    return (
                      <button
                        key={node.key}
                        type="button"
                        disabled={
                          delDeliveringAnim || delChosenSeq.length >= currentDelQ.length
                        }
                        onClick={() => handleTapDeliveryHouse(node.key, nodeIdx)}
                        className="relative flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 border-[#CFE3D5] border-b-4 bg-[#FFFDF8] p-2 transition-all active:translate-y-0.5 hover:border-[#2F7A54] disabled:opacity-50"
                      >
                        {orderBadge >= 0 && (
                          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2F7A54] text-[11px] font-bold text-white tabular-nums">
                            {orderBadge + 1}
                          </span>
                        )}
                        <AnimalHouseIllustration node={node} size={46} />
                        <span className="mt-1 font-heading text-xs sm:text-sm font-bold text-[#3A3128]">
                          {node.animalLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={delDeliveringAnim || delChosenSeq.length === 0}
                    onClick={() => {
                      soundEngine.playTap();
                      setDelChosenSeq((prev) => prev.slice(0, -1));
                    }}
                    className="inline-flex min-h-[50px] items-center gap-1.5 rounded-2xl border-2 border-[#DFD5C5] bg-white px-5 py-2 text-sm font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC] disabled:opacity-40"
                  >
                    <Undo2 className="h-4 w-4" />
                    <span>ひとつ もどす</span>
                  </button>

                  <button
                    type="button"
                    disabled={delDeliveringAnim || delChosenSeq.length === 0}
                    onClick={handleConfirmDeliveryAttempt}
                    className="min-h-[56px] rounded-2xl bg-[#C86428] border-b-[5px] border-[#8E4316] px-8 py-3 font-heading text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#B0541E] disabled:opacity-40"
                  >
                    {delDeliveringAnim
                      ? 'モモが おとどけちゅう！...'
                      : 'しゅっぱつ！ おてがみを とどける'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Festival Plaza Ending + Playable 2D Fruit-Catch Mini-Game + 3D Gachapon & Zukan */}
        {phase === 'ending' && (
          <div className="rounded-3xl border-2 border-[#E2D7C1] bg-[#FFFDF8] p-5 sm:p-7 shadow-[0_8px_24px_rgba(107,83,68,0.06)] space-y-5">
            {/* Playable 2D Festival Parade & Fruit/Coin Catch Bonus Mini-Game right up front! */}
            <FestivalPlaza2DStage
              onEarnBonusCoins={(earned) =>
                awardTownCoins(earned, 'おまつり キャッチボーナス！', true)
              }
            />

            <UniversalAdventureStamp />

            {/* 3D Gachapon Festival Showcase Card */}
            <div className="rounded-3xl border-2 border-[#E6C785] bg-[#FFF8E8] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="text-xs font-bold text-[#9A5B13] tabular-nums">
                  いま もっている コイン：{coins}まい · ずかん：{unlockedItemIds.length} /{' '}
                  {GACHA_CATALOG.length}
                </div>
                <h3 className="font-heading text-2xl font-bold text-[#3A3128]">
                  おまつりひろばの 3Dガチャを まわそう！
                </h3>
                <p className="text-sm sm:text-base text-[#5C5144]">
                  あつめた コイン（1かい {GACHA_SPIN_COST}コイン）で 3Dの ハンドルを くるっと まわすと、カプセルが とびだして たからものが もらえるよ！
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setGachaInitialTab('machine');
                    setGachaModalOpen(true);
                  }}
                  className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-[#C86428] border-b-[5px] border-[#8E4316] px-6 py-3 font-heading text-base sm:text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#B0541E]"
                >
                  <RotateCw className="h-5 w-5" />
                  <span>3Dガチャマシンで あそぶ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setGachaInitialTab('zukan');
                    setGachaModalOpen(true);
                  }}
                  className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-[#2F7A54] border-b-4 bg-white px-5 py-3 font-heading text-base font-bold text-[#2F7A54] whitespace-nowrap transition-all active:translate-y-0.5 hover:bg-[#EDF7F0]"
                >
                  <BookOpen className="h-5 w-5" />
                  <span>ずかんを みる</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-5">
              <h3 className="font-heading text-base font-bold text-[#3A3128]">
                これから ふえる あたらしい まち（準備中）
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {UPCOMING_MINIGAMES_CHAPTER_16.map((title) => (
                  <div
                    key={title}
                    className="rounded-xl border border-[#EAE2D3] bg-white px-3.5 py-2.5 text-xs font-medium text-[#6E6254]"
                  >
                    <div className="font-bold text-[#3A3128]">{title}</div>
                    <div className="mt-0.5 text-[11px] text-[#6E6254]">準備中</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleRequestExit}
                className="inline-flex min-h-[54px] items-center gap-2 rounded-2xl bg-[#2F7A54] border-b-4 border-[#1D4E35] px-8 py-3 font-heading text-lg font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344]"
              >
                {lock.isSchoolDeviceSession ? (
                  <>
                    <LogOut className="h-5 w-5" />
                    <span>たんけんを おわる（はじめの がめんへ）</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    <span>おとなの ひとに わたす（おわる）</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Chapter 12B: Safety Comfort Screen (Never promises secrecy, displays 24h SOS dial) */}
        {phase === 'safety_comfort' && (
          <div className="rounded-3xl border-2 border-[#F3CEAA] bg-[#FFFDF8] p-6 sm:p-8 shadow-xs space-y-5">
            <StoryScene2DStage
              variant="cozy_meadow"
              compact
              badgeText="あんしんの ひだまりひろば"
            />
            <div className="flex items-start gap-4">
              <MomoAvatar mood="gentle" size={68} />
              <div>
                <h2 className="font-heading text-2xl font-bold leading-snug text-[#3A3128]">
                  おしえてくれて ありがとう。たよれる おとなに つたえて、たすけて もらおうね
                </h2>
                <p className="mt-2 text-base text-[#6E6254]">
                  {lock.schoolId
                    ? 'がっこうの あんぜんたんとうの せんせいに れんらくを おくったよ。あなたは わるくないからね。'
                    : 'ちかくの たよれる おとなや、したの むりょう でんわに いつでも おはなし してね。あなたは わるくないからね。'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] p-5">
              <p className="text-sm font-bold text-[#3A3128]">
                いつでも でんわで おはなし できる ところ（よるでも おやすみの ひでも むりょう）
              </p>
              <a
                href="tel:0120078310"
                className="mt-3 inline-flex min-h-[54px] items-center gap-2.5 rounded-2xl bg-[#2F7A54] px-6 py-3 font-heading text-lg font-bold text-white tabular-nums transition-colors hover:bg-[#256344]"
              >
                <Phone className="h-5 w-5" />
                <span>24じかん 子供SOSダイヤル：0120-0-78310</span>
              </a>
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setPhase('ending')}
                className="min-h-[50px] rounded-2xl border border-[#DFD5C5] bg-white px-5 py-2.5 text-base font-bold text-[#3A3128] transition-colors hover:bg-[#FAF5EC]"
              >
                おまつりの ゴールへ いく
              </button>
              <button
                type="button"
                onClick={handleRequestExit}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl bg-[#2B6E6B] px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-[#225957]"
              >
                {lock.isSchoolDeviceSession ? (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span>たんけんを おわる</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>おとなの ひとに わたす</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Pause Overlay (やすむ) */}
      {isPaused && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3A3128]/40 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border border-[#EAE2D3] bg-[#FFFDF8] p-6 text-center shadow-xl space-y-4">
            <StoryScene2DStage
              variant="cozy_meadow"
              compact
              badgeText="ひだまりの おやすみタイム"
            />
            <div>
              <h3 className="font-heading text-2xl font-bold text-[#3A3128]">
                すこし やすもうね
              </h3>
              <p className="mt-2 text-base leading-relaxed text-[#6E6254]">
                しんこきゅう して いいよ。つづけたくなったら おしてね。きょうは ここで おわることも できるよ。
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playTap();
                  setIsPaused(false);
                }}
                className="min-h-[54px] rounded-2xl bg-[#2F7A54] px-6 py-3 font-heading text-lg font-bold text-white transition-colors hover:bg-[#256344]"
              >
                たんけんを つづける
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPaused(false);
                  handleRequestExit();
                }}
                className="min-h-[50px] rounded-2xl border border-[#DFD5C5] bg-white px-6 py-2.5 text-base font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
              >
                {lock.isSchoolDeviceSession
                  ? 'きょうは おわる（はじめの がめんへ）'
                  : 'きょうは おわる（おとなに わたす）'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Always-available "だれかに はなしたい" Two-Choice Modal */}
      {talkModalStep !== 'closed' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3A3128]/40 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#EAE2D3] bg-[#FFFDF8] p-6 shadow-xl sm:p-7">
            {talkModalStep === 'menu' && (
              <div className="space-y-4">
                <StoryScene2DStage
                  variant="cozy_meadow"
                  talking
                  compact
                  badgeText="モモと そっと おはなし"
                />
                <h3 className="font-heading text-2xl font-bold text-[#3A3128]">
                  どんな ことを はなしたい？
                </h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playTap();
                      setTalkModalStep('trouble_input');
                    }}
                    className="flex min-h-[66px] w-full items-center gap-3.5 rounded-2xl border-2 border-[#BFE0C9] border-b-4 bg-[#EDF7F0] p-4 text-left font-heading text-lg font-bold text-[#3A3128] transition-all active:translate-y-0.5 hover:border-[#2F7A54]"
                  >
                    <StoryChoiceIcon label="こまってる" size={44} />
                    <span>こまってる ことを はなしたい</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playTap();
                      setTalkModalStep('scary_input');
                    }}
                    className="flex min-h-[66px] w-full items-center gap-3.5 rounded-2xl border-2 border-[#B83227]/35 border-b-4 bg-[#FDF1F0] p-4 text-left font-heading text-lg font-bold text-[#B83227] transition-all active:translate-y-0.5 hover:bg-[#FCE4E2]"
                  >
                    <StoryChoiceIcon label="せんせいと おうちの ひと" size={44} />
                    <span>こわい ことや、いたい ことが ある</span>
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setTalkModalStep('closed')}
                    className="min-h-[48px] rounded-2xl border border-[#DFD5C5] bg-white px-5 py-2 text-base font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
                  >
                    もどる
                  </button>
                </div>
              </div>
            )}

            {talkModalStep === 'trouble_input' && (
              <>
                <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                  どんな ことで こまってる？
                </h3>
                <div className="mt-4 grid gap-2.5">
                  {[
                    'べんきょうで わからない ところが ある',
                    'ともだちとの ことで こまってる',
                    'がっこうに いくのが つかれる',
                    'いえで こまってることが ある',
                    'わからない',
                    'こたえたくない',
                  ].map((opt) => {
                    const sel = manualTroubleChoices.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          toggleMultiChoice(manualTroubleChoices, setManualTroubleChoices, opt)
                        }
                        className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-2 text-left text-base font-bold transition-colors ${
                          sel
                            ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#3A3128]'
                            : 'border-[#EAE2D3] bg-white text-[#3A3128] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <StoryChoiceIcon label={opt} size={38} />
                          <span>{opt}</span>
                        </span>
                        {sel && <Check className="h-5 w-5 shrink-0 text-[#2F7A54]" />}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  maxLength={300}
                  value={manualTroubleText}
                  onChange={(e) => setManualTroubleText(e.target.value)}
                  placeholder="じぶんの ことばで かいても いいよ"
                  className="mt-4 min-h-[50px] w-full rounded-2xl border border-[#DFD5C5] bg-white px-4 text-base text-[#3A3128]"
                />

                <div className="mt-5 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setTalkModalStep('menu')}
                    className="min-h-[48px] rounded-2xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
                  >
                    もどる
                  </button>
                  <button
                    type="button"
                    disabled={manualTroubleChoices.length === 0 && !manualTroubleText.trim()}
                    onClick={async () => {
                      if (
                        containsChildSafetyKeyword(
                          `${manualTroubleChoices.join(' ')} ${manualTroubleText}`
                        )
                      ) {
                        await triggerIsolatedSafetyFlow(
                          'keyword_detected',
                          `${manualTroubleChoices.join('・')} ${manualTroubleText}`.trim()
                        );
                        return;
                      }
                      setTalkModalStep('trouble_recipient');
                    }}
                    className="min-h-[50px] rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-[#256344] disabled:opacity-50"
                  >
                    つぎへ
                  </button>
                </div>
              </>
            )}

            {talkModalStep === 'trouble_recipient' && (
              <>
                <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                  だれに しってほしい？
                </h3>
                <div className="mt-4 grid gap-3">
                  {(
                    [
                      { key: 'both', label: 'せんせいと おうちの ひと' },
                      { key: 'teacher', label: 'せんせいだけ' },
                      { key: 'parent', label: 'おうちの ひとだけ' },
                      { key: 'none', label: 'いまは だれにも いわない' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleManualTroubleSave(opt.key)}
                      className="flex min-h-[60px] items-center gap-3.5 rounded-2xl border-2 border-[#EAE2D3] bg-white px-4 py-3 text-left font-heading text-base font-bold text-[#3A3128] transition-colors hover:border-[#2F7A54] hover:bg-[#EDF7F0]"
                    >
                      <StoryChoiceIcon label={opt.label} size={40} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {talkModalStep === 'scary_input' && (
              <>
                <h3 className="font-heading text-xl font-bold text-[#B83227]">
                  {lock.schoolId
                    ? 'がっこうの あんぜんたんとうの せんせいに つたえるよ'
                    : 'あんぜんの そうだんさきを あんないするよ'}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[#3A3128]">
                  なにか かいても いいし、なにも かかずに そのまま おくっても だいじょうぶ だよ。
                  おうちの ひとや いつもの れんらくちょうには のらないよ。
                </p>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={scaryFreeText}
                  onChange={(e) => setScaryFreeText(e.target.value)}
                  placeholder="つたえたい ことが あれば ここに かけます（かかなくても だいじょうぶ）"
                  className="mt-4 w-full rounded-2xl border border-[#DFD5C5] bg-white p-3.5 text-base text-[#3A3128]"
                />

                <div className="mt-4 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] p-3.5 text-sm font-bold text-[#215C3E] tabular-nums">
                  いますぐ でんわで はなしたい とき：24じかん 子供SOSダイヤル（0120-0-78310）
                </div>

                <div className="mt-5 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setTalkModalStep('menu')}
                    className="min-h-[48px] rounded-2xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
                  >
                    もどる
                  </button>
                  <button
                    type="button"
                    disabled={submittingOverlay}
                    onClick={() =>
                      triggerIsolatedSafetyFlow(
                        'talk_button_scary',
                        scaryFreeText.trim() || '「こわい ことや、いたい ことが ある」のボタンをおした'
                      )
                    }
                    className="min-h-[52px] rounded-2xl bg-[#B83227] px-6 py-2.5 font-heading text-base font-bold text-white transition-colors hover:bg-[#9C281E]"
                  >
                    {submittingOverlay ? 'おくって います...' : 'たよれる おとなに つたえる'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Three.js 3D Gachapon Machine & Collectible Zukan Modal */}
      <Gachapon3DModal
        isOpen={gachaModalOpen}
        initialTab={gachaInitialTab}
        coins={coins}
        unlockedItemIds={unlockedItemIds}
        onSpinComplete={({ nextCoins, nextUnlockedIds }) => {
          const nextSpins = totalSpins + 1;
          setCoins(nextCoins);
          setTotalSpins(nextSpins);
          setUnlockedItemIds(nextUnlockedIds);
          if (!lock.participationOptOut) {
            void saveStudentRewards({
              studentId: lock.studentId,
              schoolId: lock.schoolId,
              classId: lock.classId,
              coins: nextCoins,
              totalSpins: nextSpins,
              unlockedItemIds: nextUnlockedIds,
              playTicketId: lock.playTicketId,
              participationOptOut: lock.participationOptOut,
            }).catch((e) => console.warn('Reward spin save warning:', e));
          }
        }}
        onClose={() => setGachaModalOpen(false)}
      />

      {/* Adult PIN Unlock Modal (used only when launched from an adult's shared device) */}
      <AdultPinUnlockModal
        open={unlockModalOpen}
        expectedPinHash={lock.pinHash}
        onCancel={() => setUnlockModalOpen(false)}
        onUnlocked={() => {
          soundEngine.stopBgm();
          setUnlockModalOpen(false);
          onExitChildMode();
        }}
      />
    </div>
  );
};
