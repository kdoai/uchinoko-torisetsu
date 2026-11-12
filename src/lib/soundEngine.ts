/**
 * Pure Web Audio API Procedural Sound Engine for "がっこう たんけん"
 * Zero external audio files (.mp3/.wav) — 100% compatible with strict school network filters.
 */

class TownSoundEngine {
  private ctx: AudioContext | null = null;
  private bgmEnabled = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isBgmActive(): boolean {
    return this.bgmEnabled;
  }

  public toggleBgm(): boolean {
    if (this.bgmEnabled) {
      this.stopBgm();
      return false;
    }
    this.startBgm();
    return true;
  }

  public startBgm(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.bgmEnabled && this.bgmTimer !== null) return;
    this.bgmEnabled = true;

    // Gentle sunlit C-major pentatonic music-box / marimba town stroll
    const melodyHz = [
      523.25, // C5
      659.25, // E5
      783.99, // G5
      659.25, // E5
      880.0, // A5
      783.99, // G5
      659.25, // E5
      587.33, // D5
      523.25, // C5
      587.33, // D5
      659.25, // E5
      783.99, // G5
      659.25, // E5
      587.33, // D5
      523.25, // C5
      0, // rest
    ];
    const bassHz = [
      261.63, // C4
      0,
      392.0, // G4
      0,
      349.23, // F4
      0,
      392.0, // G4
      0,
      261.63, // C4
      0,
      329.63, // E4
      0,
      293.66, // D4
      0,
      392.0, // G4
      0,
    ];

    const playTick = () => {
      if (!this.bgmEnabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const idx = this.bgmStep % melodyHz.length;
      this.bgmStep += 1;

      const mFreq = melodyHz[idx];
      if (mFreq > 0) {
        this.playWarmNote(mFreq, now, 0.34, 0.032, 'triangle');
      }
      const bFreq = bassHz[idx];
      if (bFreq > 0) {
        this.playWarmNote(bFreq, now, 0.45, 0.018, 'sine');
      }
    };

    playTick();
    this.bgmTimer = window.setInterval(playTick, 460);
  }

  public stopBgm(): void {
    this.bgmEnabled = false;
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private playWarmNote(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = 'triangle'
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /** Soft wooden button tap */
  public playTap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playWarmNote(587.33, now, 0.09, 0.055, 'sine');
  }

  /** Cheerful coin chime (+5 coins on every answered item, non-judgmental!) */
  public playCoinChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playWarmNote(783.99, now, 0.14, 0.065, 'triangle'); // G5
    this.playWarmNote(1046.5, now + 0.075, 0.24, 0.075, 'triangle'); // C6
  }

  /** Musical pentatonic chime for each animal house in Delivery game */
  public playHouseNote(houseIndex: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = scale[Math.abs(houseIndex) % scale.length];
    const now = ctx.currentTime;
    this.playWarmNote(freq, now, 0.22, 0.07, 'triangle');
  }

  /** Celebratory stage clear fanfare (+25 bonus coins!) */
  public playStageClear(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.playWarmNote(f, now + i * 0.09, 0.32, 0.075, 'triangle');
    });
  }

  /** Mechanical ratchet clicks when turning the 3D Gachapon brass handle */
  public playGachaCrank(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.11;
      this.playWarmNote(280 + i * 28, t, 0.055, 0.06, 'square');
    }
  }

  /** Capsule tumbling out of the chute onto the wooden tray */
  public playCapsuleDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playWarmNote(420, now, 0.09, 0.065, 'sine');
    this.playWarmNote(520, now + 0.12, 0.08, 0.05, 'sine');
  }

  /** Sparkling pop & fanfare when the 3D capsule opens to reveal a Zukan item */
  public playCapsuleReveal(rarity: 1 | 2 | 3): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord =
      rarity === 3
        ? [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5]
        : rarity === 2
          ? [523.25, 659.25, 783.99, 1046.5, 1174.66]
          : [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, idx) => {
      this.playWarmNote(f, now + idx * 0.07, 0.38, 0.075, 'triangle');
    });
  }

  /** Cozy cash register key press + brass bell chime on shopping checkout */
  public playRegisterCheckout(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playWarmNote(330, now, 0.06, 0.055, 'square');
    this.playWarmNote(987.77, now + 0.07, 0.16, 0.075, 'triangle'); // B5
    this.playWarmNote(1318.51, now + 0.14, 0.32, 0.085, 'sine'); // E6 bell
  }

  /** Light rhythmic footstep sound when Momo trots between houses */
  public playFootstep(stepIndex = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = stepIndex % 2 === 0 ? 240 : 285;
    this.playWarmNote(freq, now, 0.055, 0.038, 'sine');
  }

  /** Crisp letter pop + warm chime when delivering an invitation */
  public playLetterDeliver(orderIndex = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = baseScale[Math.abs(orderIndex) % baseScale.length];
    this.playWarmNote(f, now, 0.14, 0.065, 'triangle');
    this.playWarmNote(f * 1.25, now + 0.06, 0.2, 0.06, 'sine');
  }

  /** Warm marimba pop for illustrated story card selection */
  public playCardSelect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playWarmNote(523.25, now, 0.08, 0.05, 'triangle');
    this.playWarmNote(659.25, now + 0.05, 0.12, 0.055, 'triangle');
  }

  /** Juicy marimba pop when catching a fruit or coin in the festival bonus mini-game */
  public playFruitCatch(isGoldCoin = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (isGoldCoin) {
      this.playWarmNote(880, now, 0.1, 0.07, 'triangle');
      this.playWarmNote(1174.66, now + 0.06, 0.22, 0.08, 'triangle');
    } else {
      this.playWarmNote(659.25, now, 0.09, 0.06, 'sine');
      this.playWarmNote(880, now + 0.05, 0.14, 0.065, 'triangle');
    }
  }
}

export const soundEngine = new TownSoundEngine();

