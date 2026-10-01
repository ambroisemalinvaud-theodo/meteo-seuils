// Lancer avec : node tests/run-node.mjs   (ou npm test)
import { tests } from './thresholds.test.js';

let echecs = 0;
for (const [nom, fn] of tests) {
  try { fn(); console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; console.log(`  ✗ ${nom}\n      ${e.message}`); }
}
console.log(`\n${tests.length - echecs}/${tests.length} tests réussis`);
process.exit(echecs ? 1 : 0);
