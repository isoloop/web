import { expect, it } from 'vitest';
import { oneOf } from './read.ts';

it('reads a CLI list against the values allowed', () => {
  expect(oneOf('a,b', ['a', 'b', 'c'] as const, 'tier')).toEqual(['a', 'b']);
  expect(() => oneOf('a,x', ['a', 'b'] as const, 'tier')).toThrow('unknown tier: x (one of a, b)');
});
