export { createReaderStateStore, DEFAULT_HIGHLIGHT_PATH } from './store'
export type { Highlight, ReaderState, ReaderStateActions, ReaderStateStore, TrajectoryMark } from './store'
export { startKvSync } from './sync'
export type { SyncStatus } from './sync'
export {
  ReaderStateProvider,
  useReaderState,
  useReaderActions,
  useReaderStateStore,
  useSaveStatus,
} from './components/ReaderStateProvider'
export type { SaveStatus } from './components/ReaderStateProvider'
