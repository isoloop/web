/// <reference types="vite/client" />
/// <reference types="@isoloop/vite/client" />

interface ImportMetaEnv {
  /** Which of the seven builds this is (vite.config.ts). */
  readonly MARKETS_BUILD:
    | 'isoloop'
    | 'native'
    | 'native-workers'
    | 'native-mixed'
    | 'isoloop-preact'
    | 'native-preact'
    | 'mixed';
}
