// The harness's topics: the creator's two and two plain source topics.
import { contracts, topic } from '@isoloop/bus';
import { z } from 'zod';
import { creatorTopics } from '../../src/topics';
import { OTHER, SOURCE } from './catalog';

const reading = z.strictObject({ ts: z.number(), temp: z.number() });
const keep = { retention: { kind: 'time' as const, ms: SOURCE.history } };

export default contracts(
  ...creatorTopics(),
  topic(SOURCE.name, { schema: reading, ...keep }),
  topic(OTHER.name, { schema: reading, ...keep }),
);
