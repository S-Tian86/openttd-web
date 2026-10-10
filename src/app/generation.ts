import type { GenerationProgress } from '../sim/world/generate';

/** Work per animation frame, so a 1024×1024 world never freezes the tab (ruling R8). */
export const GENERATION_SLICE_MS = 25;

/** Runs generator steps until `deadline`; always advances at least one step. */
export function runGenerationSlice<T>(
  gen: Generator<GenerationProgress, T, void>,
  deadline: number,
  now: () => number,
): { done: true; value: T } | { done: false; fraction: number } {
  for (;;) {
    const step = gen.next();
    if (step.done === true) return { done: true, value: step.value };
    if (now() >= deadline) return { done: false, fraction: step.value.fraction };
  }
}
