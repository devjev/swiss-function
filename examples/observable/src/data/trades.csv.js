// Data loader (experiment 6, issue #52): emits a deterministic ~120k-row
// trades table as CSV on stdout. Seeded PRNG, no Math.random, so builds are
// reproducible. The demo (#56) upgrades this to Parquet.
const INSTRUMENTS = ["ALPHA 2027", "BETA 2031", "GAMMA 2029", "DELTA 2033", "EPSILON 2026"];
const CCY = {"ALPHA 2027": "CHF", "BETA 2031": "EUR", "GAMMA 2029": "USD", "DELTA 2033": "CHF", "EPSILON 2026": "EUR"};
const ROWS = 120_000;

let state = 42;
function rand() {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 2 ** 32;
}

const out = ["trade_id,ts,instrument,currency,side,quantity,price"];
const start = Date.UTC(2025, 0, 1);
for (let i = 0; i < ROWS; i++) {
  const instrument = INSTRUMENTS[Math.floor(rand() * INSTRUMENTS.length)];
  const ts = new Date(start + Math.floor(rand() * 365 * 24 * 3600 * 1000)).toISOString();
  const side = rand() < 0.5 ? "BUY" : "SELL";
  const quantity = Math.round(rand() * 50_000) + 100;
  const price = (95 + rand() * 12).toFixed(3);
  out.push(`T${String(i).padStart(6, "0")},${ts},${instrument},${CCY[instrument]},${side},${quantity},${price}`);
}
process.stdout.write(out.join("\n"));
