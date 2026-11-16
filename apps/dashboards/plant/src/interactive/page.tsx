// The interactive page (M3e decisions 4 and 5): the header with the kernel
// switch, the rate and the way back to the full dashboard, then the board.
// The same on both kernels; only the runtime differs.
import type { ReactElement } from 'react';
import { CreatorBoard, type BoardController, type BoardRuntime } from 'creator/board';
import { RATES, withParam } from '../url';
import { CATALOG } from './catalog';
import { STARTERS } from './starters';
import { KIND, SETTINGS } from './url';

declare global {
  interface Window {
    /** For the E2E suite and the comparison: the board's controller. */
    board?: BoardController;
  }
}

function KernelSwitch(): ReactElement {
  return (
    <nav className="kernel seg" aria-label="Kernel">
      <span className="seg-items">
        {(['native', 'isoloop'] as const).map((side) => {
          const text = side === 'native' ? 'Native' : 'Isoloop';
          return side === KIND ? (
            <span key={side} aria-current="page">
              {text}
            </span>
          ) : (
            <a key={side} aria-label={`Switch to ${side}`} href={`../${side}/${location.search}`}>
              {text}
            </a>
          );
        })}
      </span>
    </nav>
  );
}

function RateSwitch(): ReactElement {
  return (
    <nav className="rates seg" aria-label="Vibration rate">
      <span className="seg-label">Rate</span>
      <span className="seg-items">
        {RATES.map((r) =>
          r === SETTINGS.rate ? (
            <span key={r} aria-current="page">
              {r} kHz
            </span>
          ) : (
            <a key={r} href={withParam(location.search, 'rate', String(r))}>
              {r} kHz
            </a>
          ),
        )}
      </span>
    </nav>
  );
}

export function InteractivePage({ runtime }: { runtime: BoardRuntime }): ReactElement {
  return (
    <div className="page interactive" data-kind={KIND}>
      <header>
        <h1>Plant 1 · Interactive mode</h1>
        <KernelSwitch />
        <RateSwitch />
        <a className="back" href={`../../${KIND}/?rate=${SETTINGS.rate}`}>
          Back to the full dashboard
        </a>
      </header>
      <main className="interactive-board">
        <CreatorBoard
          runtime={runtime}
          catalog={CATALOG}
          starters={STARTERS}
          onController={(c) => {
            window.board = c;
          }}
        />
      </main>
    </div>
  );
}
