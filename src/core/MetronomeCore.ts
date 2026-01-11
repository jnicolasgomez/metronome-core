import type {
  MetronomeConfig,
  MetronomeState,
  StateChangeCallback,
  TickCallback,
} from './types'

/**
 * Core metronome logic using Web Audio API for precise timing.
 * Framework-agnostic - no Vue or React dependencies.
 *
 * Uses a lookahead scheduler pattern for rock-solid timing:
 * - setTimeout handles the scheduling loop (can drift, that's OK)
 * - Web Audio API handles actual playback (microsecond precision)
 *
 * @example
 * ```ts
 * const metronome = new MetronomeCore({ bpm: 120, meter: 4 })
 * metronome.onTick((pulse, isAccented) => console.log(`Beat ${pulse}`))
 * metronome.start()
 * ```
 */
export class MetronomeCore {
  // Audio context and nodes
  private audioContext: AudioContext | null = null
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null

  // Timing state
  private nextTickTime = 0.0
  private lastTickTime = 0.0
  private timeOffset = 0.0
  private scheduleIntervalId: ReturnType<typeof setTimeout> | null = null

  // Configuration
  private readonly lookahead: number
  private readonly scheduleAheadTime: number
  private readonly minBpm: number
  private readonly maxBpm: number
  private readonly accentFrequency: number
  private readonly normalFrequency: number

  // Current state
  private _isPlaying = false
  private _pulse = 0
  private _meter: number
  private _bpm: number
  private _accents: boolean[]

  // Callbacks
  private stateChangeCallbacks: StateChangeCallback[] = []
  private tickCallbacks: TickCallback[] = []

  constructor(config: MetronomeConfig = {}) {
    this._bpm = config.bpm ?? 90
    this._meter = config.meter ?? 4
    this._accents = config.accents ?? this.createDefaultAccents(this._meter)
    this.lookahead = config.lookahead ?? 25
    this.scheduleAheadTime = config.scheduleAheadTime ?? 0.1
    this.minBpm = config.minBpm ?? 30
    this.maxBpm = config.maxBpm ?? 300
    this.accentFrequency = config.accentFrequency ?? 1200
    this.normalFrequency = config.normalFrequency ?? 800
  }

  // ─────────────────────────────────────────────────────────────
  // Public API - State Getters
  // ─────────────────────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get pulse(): number {
    return this._pulse
  }

  get meter(): number {
    return this._meter
  }

  get bpm(): number {
    return this._bpm
  }

  get accents(): boolean[] {
    return [...this._accents]
  }

  get state(): MetronomeState {
    return {
      isPlaying: this._isPlaying,
      pulse: this._pulse,
      meter: this._meter,
      bpm: this._bpm,
      accents: [...this._accents],
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Public API - State Setters
  // ─────────────────────────────────────────────────────────────

  set bpm(value: number) {
    this._bpm = Math.max(this.minBpm, Math.min(this.maxBpm, value))
    this.notifyStateChange()
  }

  set meter(value: number) {
    if (value < 1) return
    this._meter = value
    // Reset accents to match new meter
    this._accents = this.createDefaultAccents(value)
    this.notifyStateChange()
  }

  set accents(value: boolean[]) {
    this._accents = [...value]
    this.notifyStateChange()
  }

  /**
   * Increase BPM by a given amount
   */
  increaseBpm(amount = 1): void {
    this.bpm = this._bpm + amount
  }

  /**
   * Decrease BPM by a given amount
   */
  decreaseBpm(amount = 1): void {
    this.bpm = this._bpm - amount
  }

  /**
   * Set the meter and optionally provide custom accents
   */
  setMeter(meter: number, accents?: boolean[]): void {
    if (meter < 1) return
    this._meter = meter
    this._accents = accents ?? this.createDefaultAccents(meter)
    this.notifyStateChange()
  }

  /**
   * Toggle accent on a specific beat (0-indexed)
   */
  toggleAccent(beatIndex: number): void {
    if (beatIndex >= 0 && beatIndex < this._accents.length) {
      this._accents[beatIndex] = !this._accents[beatIndex]
      this.notifyStateChange()
    }
  }

  /**
   * Set accent on a specific beat (0-indexed)
   */
  setAccent(beatIndex: number, value: boolean): void {
    if (beatIndex >= 0 && beatIndex < this._accents.length) {
      this._accents[beatIndex] = value
      this.notifyStateChange()
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Public API - Playback Control
  // ─────────────────────────────────────────────────────────────

  /**
   * Start the metronome
   */
  async start(): Promise<void> {
    if (this._isPlaying) return

    await this.initAudioContext()

    this._isPlaying = true
    this._pulse = 0
    this.nextTickTime = this.audioContext!.currentTime + this.timeOffset

    this.scheduleLoop()
    this.notifyStateChange()
  }

  /**
   * Stop the metronome
   */
  stop(): void {
    if (!this._isPlaying) return

    this._isPlaying = false
    this._pulse = 0

    // Save offset for resume
    if (this.audioContext) {
      this.timeOffset = this.nextTickTime - this.audioContext.currentTime
    }

    // Clear scheduler
    if (this.scheduleIntervalId !== null) {
      clearTimeout(this.scheduleIntervalId)
      this.scheduleIntervalId = null
    }

    // Reset audio nodes
    this.cleanupAudioNodes()
    this.notifyStateChange()
  }

  /**
   * Toggle play/pause
   */
  async toggle(): Promise<void> {
    if (this._isPlaying) {
      this.stop()
    } else {
      await this.start()
    }
  }

  /**
   * Convenience method that handles audio context resume and toggle
   */
  async handle(newBpm?: number): Promise<void> {
    if (newBpm !== undefined) {
      this._bpm = Math.max(this.minBpm, Math.min(this.maxBpm, newBpm))
    }
    await this.toggle()
  }

  // ─────────────────────────────────────────────────────────────
  // Public API - Event Callbacks
  // ─────────────────────────────────────────────────────────────

  /**
   * Register a callback for state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback)
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback)
      if (index > -1) this.stateChangeCallbacks.splice(index, 1)
    }
  }

  /**
   * Register a callback for tick events
   */
  onTick(callback: TickCallback): () => void {
    this.tickCallbacks.push(callback)
    return () => {
      const index = this.tickCallbacks.indexOf(callback)
      if (index > -1) this.tickCallbacks.splice(index, 1)
    }
  }

  /**
   * Dispose of the metronome and clean up resources
   */
  dispose(): void {
    this.stop()
    this.stateChangeCallbacks = []
    this.tickCallbacks = []
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods - Audio
  // ─────────────────────────────────────────────────────────────

  private async initAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  private createOscillator(): void {
    if (!this.audioContext || this.oscillator) return

    this.oscillator = this.audioContext.createOscillator()
    this.gainNode = this.audioContext.createGain()

    this.oscillator.type = 'sine'
    this.oscillator.connect(this.gainNode)
    this.gainNode.connect(this.audioContext.destination)
    this.gainNode.gain.value = 0
    this.oscillator.start()
  }

  private cleanupAudioNodes(): void {
    if (this.oscillator) {
      this.oscillator.stop()
      this.oscillator.disconnect()
      this.oscillator = null
    }
    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }
  }

  private playTick(time: number): void {
    if (!this.audioContext) return

    // Create oscillator on first tick
    if (!this.oscillator) {
      this.createOscillator()
    }

    if (!this.oscillator || !this.gainNode) return

    // Determine frequency based on accent
    const isAccented = this._accents[this._pulse - 1] ?? false
    const frequency = isAccented ? this.accentFrequency : this.normalFrequency

    // Schedule frequency change precisely
    this.oscillator.frequency.setValueAtTime(frequency, time)

    // Envelope: Attack-Decay for clean click sound
    const attackTime = 0.001  // 1ms attack
    const decayTime = 0.05    // 50ms decay

    this.gainNode.gain.cancelScheduledValues(time)
    this.gainNode.gain.setValueAtTime(0, time)
    this.gainNode.gain.linearRampToValueAtTime(1.5, time + attackTime)
    this.gainNode.gain.exponentialRampToValueAtTime(0.01, time + attackTime + decayTime)
    this.gainNode.gain.setValueAtTime(0, time + attackTime + decayTime + 0.01)
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods - Scheduling
  // ─────────────────────────────────────────────────────────────

  private scheduleLoop(): void {
    if (!this._isPlaying || !this.audioContext) return

    const currentTime = this.audioContext.currentTime

    // Schedule all ticks within the lookahead window
    while (this.nextTickTime < currentTime + this.scheduleAheadTime) {
      const tickTime = this.nextTickTime
      this.tick(tickTime)

      // Calculate next tick time
      const interval = this.calculateInterval()
      this.nextTickTime += interval
      this.lastTickTime = tickTime
    }

    // Schedule next check
    const nextCheckTime = Math.max(0, this.lookahead - (currentTime - this.lastTickTime) * 1000)
    this.scheduleIntervalId = setTimeout(() => this.scheduleLoop(), nextCheckTime)
  }

  private tick(time: number): void {
    // Advance pulse (1-based, wraps at meter)
    if (this._pulse >= this._meter) {
      this._pulse = 1
    } else {
      this._pulse += 1
    }

    // Play audio
    this.playTick(time)

    // Notify tick callbacks
    const isAccented = this._accents[this._pulse - 1] ?? false
    for (const callback of this.tickCallbacks) {
      callback(this._pulse, isAccented, time)
    }

    // Notify state change (for reactive frameworks)
    this.notifyStateChange()
  }

  private calculateInterval(): number {
    return 60 / this._bpm
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods - Utilities
  // ─────────────────────────────────────────────────────────────

  private createDefaultAccents(meter: number): boolean[] {
    const accents = new Array(meter).fill(false)
    if (meter > 0) accents[0] = true // First beat accented by default
    return accents
  }

  private notifyStateChange(): void {
    const state = this.state
    for (const callback of this.stateChangeCallbacks) {
      callback(state)
    }
  }
}
