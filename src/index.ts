// Main entry point - exports core functionality
export { MetronomeCore } from './core/MetronomeCore'
export type {
  MetronomeConfig,
  MetronomeState,
  StateChangeCallback,
  TickCallback,
} from './core/types'

// Note: Vue composable is exported separately from './vue' subpath
// to avoid requiring Vue as a dependency for vanilla TS users
