// Deliberately breaks the sim/ barrier with browser globals, the clock and randomness;
// boundary.test.ts checks that the sim typecheck and the linter reject them.
export const leaks = [window.innerWidth, localStorage, Date.now(), Math.random()];
