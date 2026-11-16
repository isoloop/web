// The interactive page (M3e decisions 4 and 5): the header with the kernel
// switch, the size and the way back to the full dashboard, then the board.
// The same on both kernels; only the runtime differs.
import type { ReactElement } from 'react';
import { CreatorBoard, type BoardController, type BoardRuntime } from 'creator/board';
import { SIZES, SPECS, sizeHref } from '../sizes/sizes';
import { CATALOG } from './catalog';
import { STARTERS } from './starters';
import { KIND, SIZE } from './url';

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

function SizeSwitch(): ReactElement {
  return (
    <nav className="sizes seg" aria-label="Dashboard size">
      <span className="seg-label">Size</span>
      <span className="seg-items">
        {SIZES.map((size) =>
          size === SIZE ? (
            <span key={size} aria-current="page">
              {SPECS[size].label}
            </span>
          ) : (
            <a key={size} href={sizeHref(size, location.search)}>
              {SPECS[size].label}
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
        <h1>Markets · Interactive mode</h1>
        <KernelSwitch />
        <SizeSwitch />
        <a className="back" href={`../../${KIND}/?size=${SIZE}`}>
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
