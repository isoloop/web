// Alert rules, evaluated against prices and aggregates. A rule fires once per
// crossing: when its condition becomes true, and not again until it re-arms.
// A rule's first value counts as a crossing if the condition holds.
//
// `vwap` and `spread` are one figure per symbol, so those rules re-arm on the
// first value back. `price` is every exchange's last trade, in turn: exchanges
// sit a little apart and each bounces between its bid and its ask, so one
// price back says nothing about the symbol. A price rule watches them all, and
// re-arms once none has been past the threshold for `PRICE_REARM_MS`.
import type { Alert, AlertRule, Metric, Sym } from './schemas';

type Rule = Extract<AlertRule, { removed: false }>;

const PRICE_REARM_MS = 10_000;

const same = (a: Rule, b: Rule): boolean =>
  a.symbol === b.symbol && a.metric === b.metric && a.op === b.op && a.threshold === b.threshold;

export class AlertEngine {
  readonly #rules = new Map<string, Rule>();
  /** Rules that fired and haven't re-armed. */
  readonly #holding = new Set<string>();
  /**
   * When each holding price rule last saw a price past its threshold. After a
   * restart, the first price it saw: the others may still be past it.
   */
  readonly #pastAt = new Map<string, number>();

  /** Adds, replaces or removes a rule. A changed rule re-arms; the same rule again doesn't. */
  setRule(r: AlertRule): void {
    const was = this.#rules.get(r.id);
    if (!r.removed && was && same(was, r)) return;
    this.#rearm(r.id);
    if (r.removed) this.#rules.delete(r.id);
    else this.#rules.set(r.id, r);
  }

  /** After a restart: the rule already fired and hasn't been reset since. */
  markFired(ruleId: string): void {
    this.#holding.add(ruleId);
  }

  has(id: string): boolean {
    return this.#rules.has(id);
  }

  rules(): Rule[] {
    return [...this.#rules.values()];
  }

  /** Evaluates every rule on `symbol` and `metric`; returns the alerts that fire. */
  evaluate(symbol: Sym, metric: Metric, value: number, ts: number): Alert[] {
    const fired: Alert[] = [];
    for (const r of this.#rules.values()) {
      if (r.symbol !== symbol || r.metric !== metric) continue;
      const holds = r.op === 'above' ? value > r.threshold : value < r.threshold;
      if (!holds) {
        if (!this.#holding.has(r.id)) continue;
        if (metric === 'price') {
          const since = this.#pastAt.get(r.id) ?? ts;
          this.#pastAt.set(r.id, since);
          if (ts - since < PRICE_REARM_MS) continue;
        }
        this.#rearm(r.id);
        continue;
      }
      if (metric === 'price') this.#pastAt.set(r.id, ts);
      if (this.#holding.has(r.id)) continue;
      this.#holding.add(r.id);
      fired.push({ ruleId: r.id, symbol, metric, op: r.op, threshold: r.threshold, value, ts });
    }
    return fired;
  }

  #rearm(id: string): void {
    this.#holding.delete(id);
    this.#pastAt.delete(id);
  }
}
