/** @jsxImportSource preact */
import { expect, it } from 'vitest';
import { render } from '../render.ts';
import { ExperimentalMark } from './ExperimentalMark.tsx';

it('renders the round mark, hidden from assistive tech, with a hidden label and a tooltip', () => {
  const html = render(<ExperimentalMark />);
  expect(html).toContain('<span class="ui-experimental-mark" title="Experimental">');
  expect(html).toContain('<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">');
  expect(html).toContain('<circle cx="8" cy="8" r="6.9"');
  expect(html).toContain('<path d="M8 4.3v4.5"');
  expect(html).toContain('<circle cx="8" cy="11.4" r="1.05"');
  expect(html).toContain('<span class="ui-sr-only">Experimental</span>');
});

it('takes another label', () => {
  const html = render(<ExperimentalMark label="Eksperimentell" />);
  expect(html).toContain('title="Eksperimentell"');
  expect(html).toContain('<span class="ui-sr-only">Eksperimentell</span>');
});

it('has no inline style (CSP: default-src self)', () => {
  expect(render(<ExperimentalMark />)).not.toContain('style=');
});
