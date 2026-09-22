// Markers are freeform strings (§8.1) and stay that way — but one of them is understood by both
// ends: the client draws a red ring around anything carrying it, and PASS_TURN sweeps it up when
// the turn it belonged to ends. Naming it here keeps those two from drifting apart.

export const ATTACKING_MARKER = 'attacking';
