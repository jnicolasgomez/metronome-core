# @jnicolasgomez/metronome-core

Precise Web Audio API metronome with lookahead scheduling. Framework-agnostic core with Vue 3 composable wrapper.

## Features

- **Rock-solid timing** using Web Audio API lookahead scheduler
- **Framework-agnostic core** - use with any framework or vanilla JS/TS
- **Vue 3 composable** - reactive wrapper with full TypeScript support
- **Configurable accents** - accent any beat in any time signature
- **BPM range** - 30 to 300 BPM
- **Pause/resume** - seamless timing preservation

## Demo

Try the metronome live: [randomchords.vercel.app](https://randomchords.vercel.app/#/)

## Installation

```bash
npm install @jnicolasgomez/metronome-core
```

## Usage

### Vanilla TypeScript / JavaScript

```typescript
import { MetronomeCore } from '@nicogomez/metronome-core'

const metronome = new MetronomeCore({
  bpm: 120,
  meter: 4,
  accents: [true, false, false, false], // Accent first beat
})

// Listen for beats
metronome.onTick((pulse, isAccented, time) => {
  console.log(`Beat ${pulse} (${isAccented ? 'accented' : 'normal'})`)
})

// Listen for state changes
metronome.onStateChange((state) => {
  console.log('State:', state)
})

// Control playback
await metronome.start()
metronome.stop()
await metronome.toggle()

// Adjust tempo
metronome.bpm = 140
metronome.increaseBpm(5)
metronome.decreaseBpm(5)

// Change meter
metronome.setMeter(3) // 3/4 time
metronome.setMeter(6, [true, false, false, true, false, false]) // 6/8 with custom accents

// Toggle individual accents
metronome.toggleAccent(2) // Toggle third beat accent (0-indexed)

// Cleanup
metronome.dispose()
```

### Vue 3 Composable

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useMetronome } from '@nicogomez/metronome-core/vue'

const {
  isPlaying,
  pulse,
  bpm,
  meter,
  accents,
  toggle,
  increaseBpm,
  decreaseBpm,
  setMeter,
  toggleAccent,
} = useMetronome({
  bpm: 120,
  meter: 4,
})

// Watch for beat changes
watch(pulse, (newPulse) => {
  if (newPulse === 1) {
    console.log('New measure!')
  }
})
</script>

<template>
  <div>
    <button @click="toggle">
      {{ isPlaying ? 'Stop' : 'Start' }}
    </button>

    <div>
      <button @click="decreaseBpm(5)">-5</button>
      <span>{{ bpm }} BPM</span>
      <button @click="increaseBpm(5)">+5</button>
    </div>

    <div>
      <span>Beat: {{ pulse }} / {{ meter }}</span>
    </div>

    <div>
      <button
        v-for="(accent, i) in accents"
        :key="i"
        @click="toggleAccent(i)"
        :class="{ accented: accent, current: pulse === i + 1 }"
      >
        {{ i + 1 }}
      </button>
    </div>
  </div>
</template>
```

## API

### MetronomeCore

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bpm` | `number` | `90` | Initial beats per minute |
| `meter` | `number` | `4` | Beats per measure |
| `accents` | `boolean[]` | `[true, ...]` | Accent pattern (first beat accented by default) |
| `lookahead` | `number` | `25` | Lookahead time in ms |
| `scheduleAheadTime` | `number` | `0.1` | Schedule ahead time in seconds |
| `minBpm` | `number` | `30` | Minimum BPM allowed |
| `maxBpm` | `number` | `300` | Maximum BPM allowed |
| `accentFrequency` | `number` | `1200` | Frequency (Hz) for accented beats |
| `normalFrequency` | `number` | `800` | Frequency (Hz) for normal beats |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isPlaying` | `boolean` | Whether metronome is playing |
| `pulse` | `number` | Current beat (1-based, 0 when stopped) |
| `meter` | `number` | Current meter |
| `bpm` | `number` | Current BPM (settable) |
| `accents` | `boolean[]` | Current accent pattern |
| `state` | `MetronomeState` | Full state snapshot |

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the metronome |
| `stop()` | Stop the metronome |
| `toggle()` | Toggle play/pause |
| `handle(bpm?)` | Toggle with optional BPM update |
| `increaseBpm(amount?)` | Increase BPM (default: 1) |
| `decreaseBpm(amount?)` | Decrease BPM (default: 1) |
| `setMeter(meter, accents?)` | Set meter with optional accents |
| `toggleAccent(index)` | Toggle accent at beat index (0-based) |
| `setAccent(index, value)` | Set accent value at beat index |
| `onStateChange(callback)` | Register state change listener |
| `onTick(callback)` | Register tick listener |
| `dispose()` | Clean up resources |

### useMetronome (Vue Composable)

Returns reactive refs that auto-sync with the core:

- `isPlaying` - readonly ref
- `pulse` - readonly ref
- `meter` - readonly ref
- `bpm` - writable ref (supports v-model)
- `accents` - writable ref
- `state` - readonly ref (full state snapshot)

Plus all methods from MetronomeCore.

## How It Works

This metronome uses the **lookahead scheduler pattern** for precise timing:

1. **setTimeout** runs a scheduling loop every ~25ms
2. **Web Audio API** schedules actual audio events ~100ms ahead
3. The oscillator frequency and gain envelope are scheduled at exact audio context times

This separation ensures JavaScript timing jitter doesn't affect audio playback.

## License

MIT
