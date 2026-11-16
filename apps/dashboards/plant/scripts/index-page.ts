// dist/index.html: the deployed root, which sends a visitor to the Isoloop
// build (each page's build switch links the others); dist/interactive/index.html
// does the same for the interactive page (M3e).
import { writeFileSync } from 'node:fs';

writeFileSync(
  'dist/index.html',
  '<!doctype html><meta charset="utf-8"><title>Plant 1</title>' +
    '<meta http-equiv="refresh" content="0; url=./isoloop/">' +
    '<a href="./isoloop/">Plant 1 on Isoloop</a> · <a href="./native/">native</a> · ' +
    '<a href="./native-workers/">native + workers</a>\n',
);

writeFileSync(
  'dist/interactive/index.html',
  '<!doctype html><meta charset="utf-8"><title>Plant 1 · Interactive mode</title>' +
    '<meta http-equiv="refresh" content="0; url=./isoloop/">' +
    '<a href="./isoloop/">Interactive mode on Isoloop</a> · <a href="./native/">native</a>\n',
);
