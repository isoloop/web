// Baseline: the same component as an isolate built into the host, with no
// Module Federation, to measure what the MF runtime adds in a worker.
import { defineIsolate } from '@isoloop/react';
import { useState, version } from 'react';

function Hello() {
  const [n, setN] = useState(0);
  return (
    <div data-remote="plain">
      <p>
        Plain isolate, React <span data-react>{version}</span>, on the <span data-where>worker</span>.
      </p>
      <button onClick={() => setN(n + 1)}>
        Clicked <span data-count>{n}</span>
      </button>
    </div>
  );
}

export default defineIsolate(Hello);
