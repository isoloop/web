/// <reference types="vite/client" />
/// <reference types="@isoloop/vite/client" />

interface ImportMetaEnv {
  /** Which of the six builds this is (vite.config.ts). */
  readonly MARKETS_BUILD:
    | 'isoloop'
    | 'native'
    | 'native-workers'
    | 'isoloop-preact'
    | 'native-preact'
    | 'mixed';
}
