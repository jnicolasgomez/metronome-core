import { ref, readonly, shallowRef, watch, onUnmounted, type Ref, type DeepReadonly } from 'vue'
import { MetronomeCore } from '../core/MetronomeCore'
import type { MetronomeConfig, MetronomeState, TickCallback } from '../core/types'

/**
 * Vue composable return type
 */
export interface UseMetronomeReturn {
  /** Reactive playing state */
  isPlaying: DeepReadonly<Ref<boolean>>
  /** Reactive pulse/beat (1-based, 0 when stopped) */
  pulse: DeepReadonly<Ref<number>>
  /** Reactive meter (beats per measure) */
  meter: DeepReadonly<Ref<number>>
  /** Reactive BPM - use setBpm() to modify */
  bpm: Ref<number>
  /** Reactive accents array */
  accents: Ref<boolean[]>
  /** Full reactive state snapshot */
  state: DeepReadonly<Ref<MetronomeState>>

  // Methods
  /** Start the metronome */
  start: () => Promise<void>
  /** Stop the metronome */
  stop: () => void
  /** Toggle play/pause */
  toggle: () => Promise<void>
  /** Handle with optional BPM update (matches original API) */
  handle: (newBpm?: number) => Promise<void>
  /** Increase BPM */
  increaseBpm: (amount?: number) => void
  /** Decrease BPM */
  decreaseBpm: (amount?: number) => void
  /** Set meter with optional custom accents */
  setMeter: (meter: number, accents?: boolean[]) => void
  /** Toggle accent on specific beat (0-indexed) */
  toggleAccent: (beatIndex: number) => void
  /** Set accent on specific beat (0-indexed) */
  setAccent: (beatIndex: number, value: boolean) => void
  /** Register tick callback, returns unsubscribe function */
  onTick: (callback: TickCallback) => () => void
  /** Get the underlying core instance */
  getCore: () => MetronomeCore
  /** Dispose and cleanup */
  dispose: () => void
}

/**
 * Vue 3 composable wrapper for MetronomeCore.
 *
 * Provides reactive refs that automatically sync with the core metronome state.
 * All state changes from the core are reflected in the Vue refs.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useMetronome } from '@nicolasgomez/metronome-core/vue'
 *
 * const { isPlaying, pulse, bpm, toggle, increaseBpm, decreaseBpm } = useMetronome({
 *   bpm: 120,
 *   meter: 4,
 * })
 *
 * // Watch for beat changes
 * watch(pulse, (newPulse) => {
 *   console.log(`Beat ${newPulse}`)
 * })
 * </script>
 *
 * <template>
 *   <button @click="toggle">{{ isPlaying ? 'Stop' : 'Start' }}</button>
 *   <p>BPM: {{ bpm }}</p>
 *   <p>Beat: {{ pulse }}</p>
 * </template>
 * ```
 */
export function useMetronome(config: MetronomeConfig = {}): UseMetronomeReturn {
  // Create the core instance
  const core = new MetronomeCore(config)

  // Reactive state refs
  const isPlaying = ref(false)
  const pulse = ref(0)
  const meter = ref(core.meter)
  const bpm = ref(core.bpm)
  const accents = ref<boolean[]>([...core.accents])
  const state = shallowRef<MetronomeState>(core.state)

  // Two-way binding for bpm ref - flags to prevent circular updates
  let bpmSyncPending = false
  let isUpdatingFromCore = false

  // Sync core state changes to Vue refs
  const unsubscribeStateChange = core.onStateChange((newState) => {
    isPlaying.value = newState.isPlaying
    pulse.value = newState.pulse
    meter.value = newState.meter
    accents.value = [...newState.accents]
    state.value = newState

    // Two-way sync for bpm (don't update if it came from the ref)
    if (bpm.value !== newState.bpm && !bpmSyncPending) {
      isUpdatingFromCore = true
      bpm.value = newState.bpm
      isUpdatingFromCore = false
    }
  })

  // Create a custom ref wrapper for bpm that syncs back to core
  const syncBpmToCore = () => {
    if (!bpmSyncPending && !isUpdatingFromCore && bpm.value !== core.bpm) {
      bpmSyncPending = true
      core.bpm = bpm.value
      bpmSyncPending = false
    }
  }

  // Watch for changes to bpm ref and sync to core
  watch(bpm, () => {
    syncBpmToCore()
  })

  // Wrapped methods that sync bpm before action
  const start = async (): Promise<void> => {
    syncBpmToCore()
    await core.start()
  }

  const stop = (): void => {
    core.stop()
  }

  const toggle = async (): Promise<void> => {
    syncBpmToCore()
    await core.toggle()
  }

  const handle = async (newBpm?: number): Promise<void> => {
    if (newBpm !== undefined) {
      bpm.value = newBpm
    }
    syncBpmToCore()
    await core.handle()
  }

  const increaseBpm = (amount = 1): void => {
    core.increaseBpm(amount)
    bpm.value = core.bpm
  }

  const decreaseBpm = (amount = 1): void => {
    core.decreaseBpm(amount)
    bpm.value = core.bpm
  }

  const setMeter = (newMeter: number, newAccents?: boolean[]): void => {
    core.setMeter(newMeter, newAccents)
    meter.value = core.meter
    accents.value = [...core.accents]
  }

  const toggleAccent = (beatIndex: number): void => {
    core.toggleAccent(beatIndex)
    accents.value = [...core.accents]
  }

  const setAccent = (beatIndex: number, value: boolean): void => {
    core.setAccent(beatIndex, value)
    accents.value = [...core.accents]
  }

  const onTick = (callback: TickCallback): (() => void) => {
    return core.onTick(callback)
  }

  const getCore = (): MetronomeCore => core

  const dispose = (): void => {
    unsubscribeStateChange()
    core.dispose()
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    dispose()
  })

  return {
    // Reactive state (readonly where appropriate)
    isPlaying: readonly(isPlaying),
    pulse: readonly(pulse),
    meter: readonly(meter),
    bpm, // Writable for v-model support
    accents, // Writable for direct manipulation
    state: readonly(state),

    // Methods
    start,
    stop,
    toggle,
    handle,
    increaseBpm,
    decreaseBpm,
    setMeter,
    toggleAccent,
    setAccent,
    onTick,
    getCore,
    dispose,
  }
}
