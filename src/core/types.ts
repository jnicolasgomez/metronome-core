/**
 * Metronome configuration options
 */
export interface MetronomeConfig {
  /** Initial BPM (default: 90) */
  bpm?: number
  /** Initial meter/time signature (default: 4) */
  meter?: number
  /** Initial accents array (default: first beat accented) */
  accents?: boolean[]
  /** Lookahead time in milliseconds (default: 25) */
  lookahead?: number
  /** Schedule ahead time in seconds (default: 0.1) */
  scheduleAheadTime?: number
  /** Minimum BPM allowed (default: 30) */
  minBpm?: number
  /** Maximum BPM allowed (default: 300) */
  maxBpm?: number
  /** Frequency for accented beats in Hz (default: 1200) */
  accentFrequency?: number
  /** Frequency for normal beats in Hz (default: 800) */
  normalFrequency?: number
}

/**
 * Metronome state
 */
export interface MetronomeState {
  /** Whether the metronome is currently playing */
  isPlaying: boolean
  /** Current pulse/beat (1-based, 0 when stopped) */
  pulse: number
  /** Current meter (beats per measure) */
  meter: number
  /** Current BPM */
  bpm: number
  /** Accents array for each beat */
  accents: boolean[]
}

/**
 * Callback for state changes
 */
export type StateChangeCallback = (state: MetronomeState) => void

/**
 * Callback for tick events (called on each beat)
 */
export type TickCallback = (pulse: number, isAccented: boolean, time: number) => void
