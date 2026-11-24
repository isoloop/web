/// <reference types="vite/client" />
/// <reference types="@isoloop/vite/client" />

interface ImportMetaEnv {
  /** Which of the three builds this is (vite.config.ts). */
  readonly PLANT_BUILD: 'isoloop' | 'native' | 'native-workers';
  /** A `PLANT_AGENT_COST=1` build, with the agent-call cost's ping (M4a task 13). */
  readonly PLANT_AGENT_COST: boolean;
}
