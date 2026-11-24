// dist/index.html: links to the three builds, for a look at them by hand.
import { writeFileSync } from 'node:fs';

writeFileSync(
  'dist/index.html',
  '<!doctype html><meta charset="utf-8"><title>plant-bench</title>' +
    '<a href="./isoloop/">Isoloop</a> · <a href="./native/">native</a> · ' +
    '<a href="./native-workers/">native + workers</a>\n',
);
