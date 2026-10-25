import type { Eval } from './types';

/**
 * Stockfish 18 (lite, single-threaded WASM) running in a Web Worker.
 * Searches are serialized: each evaluate() waits for the previous one.
 */
export class Engine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown>;

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.js`);
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      this.listeners.forEach((l) => l(line));
    };
    this.queue = this.init();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(match: (line: string) => boolean, onLine?: (line: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        onLine?.(line);
        if (match(line)) {
          this.listeners.delete(l);
          resolve(line);
        }
      };
      this.listeners.add(l);
    });
  }

  private async init() {
    const uciok = this.waitFor((l) => l === 'uciok');
    this.send('uci');
    await uciok;
    this.send('setoption name Hash value 64');
    const ready = this.waitFor((l) => l === 'readyok');
    this.send('isready');
    await ready;
  }

  evaluate(fen: string, depth: number): Promise<Eval> {
    const run = async (): Promise<Eval> => {
      const whiteToMove = fen.split(' ')[1] === 'w';
      let last: Eval = { pv: [], depth: 0 };
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          if (!l.startsWith('info') || !l.includes(' score ') || l.includes(' multipv 2')) return;
          const d = /\bdepth (\d+)/.exec(l);
          const cp = /\bscore cp (-?\d+)/.exec(l);
          const mate = /\bscore mate (-?\d+)/.exec(l);
          const pv = /\bpv (.+)$/.exec(l);
          if (l.includes(' lowerbound') || l.includes(' upperbound')) return;
          const sign = whiteToMove ? 1 : -1;
          last = {
            depth: d ? Number(d[1]) : 0,
            cp: cp ? sign * Number(cp[1]) : undefined,
            mate: mate ? sign * Number(mate[1]) : undefined,
            pv: pv ? pv[1].trim().split(/\s+/) : [],
          };
        },
      );
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
      const bm = await done;
      const best = bm.split(' ')[1];
      return { ...last, best: best && best !== '(none)' ? best : last.pv[0] };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  terminate() {
    this.worker.terminate();
  }
}

let shared: Engine | null = null;
export function getEngine(): Engine {
  if (!shared) shared = new Engine();
  return shared;
}
