import { useState, version } from 'react';

/** The same component on the main thread and in an isolate. */
export default function Hello() {
  const [n, setN] = useState(0);
  const where =
    typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope ? 'worker' : 'main thread';
  return (
    <div data-remote="vite">
      <p>
        Hello from the vite remote, React <span data-react>{version}</span>, on the{' '}
        <span data-where>{where}</span>.
      </p>
      <button onClick={() => setN(n + 1)}>
        Clicked <span data-count>{n}</span>
      </button>
    </div>
  );
}
