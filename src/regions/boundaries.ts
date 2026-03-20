/**
 * IAPWS-IF97 Region Boundary Equations
 *
 * Boundary equations between regions, including:
 * - B23: Boundary between Region 2 and Region 3
 * - B3 subregion boundaries (ab, cd, ef, gh, ij, jk, mn, op, qu, rx, uv, wx)
 *
 * Reference: IAPWS-IF97 Section 4 & Supplementary Release on v(P,T) for Region 3
 */

// ─── B23 Boundary (Region 2 ↔ Region 3) ────────────────────────────────────

/**
 * B23 boundary: Temperature → Pressure
 * Equation 5 (pp. 5), IAPWS-IF97
 *
 * @param T - Temperature [K]
 * @returns Pressure [MPa] on the B23 boundary
 */
export function boundary23_T_to_P(T: number): number {
  return 348.05185628969 - 1.1671859879975 * T + 0.0010192970039326 * T * T;
}

/**
 * B23 boundary: Pressure → Temperature
 * Equation 6 (pp. 6), IAPWS-IF97
 *
 * @param p - Pressure [MPa]
 * @returns Temperature [K] on the B23 boundary
 */
export function boundary23_P_to_T(p: number): number {
  return 572.54459862746 + Math.sqrt((p - 13.91883977887) / 0.0010192970039326);
}

// ─── B3 Subregion Boundaries ────────────────────────────────────────────────
// Supplementary Release on Backward Equations for v(P,T) in Region 3

/** Helper: evaluate polynomial Σ N[i] * P^I[i] */
function polyEval(p: number, I: readonly number[], N: readonly number[]): number {
  let result = 0;
  for (let i = 0; i < I.length; i++) {
    result += N[i] * Math.pow(p, I[i]);
  }
  return result;
}

/** Helper: evaluate polynomial with ln(P) as argument */
function polyEvalLn(p: number, I: readonly number[], N: readonly number[]): number {
  const lnP = Math.log(p);
  let result = 0;
  for (let i = 0; i < I.length; i++) {
    result += N[i] * Math.pow(lnP, I[i]);
  }
  return result;
}

/** B3ab boundary: P → T */
export function b3ab(p: number): number {
  return polyEvalLn(p,
    [0, 1, 2, -1, -2],
    [1.54793642129415e3, -1.87661219490113e2, 2.13144632222113e1, -1.91887498864292e3, 9.18419702359447e2],
  );
}

/** B3cd boundary: P → T */
export function b3cd(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3],
    [5.85276966696349e2, 2.78233532206915, -1.27283549295878e-2, 1.59090746562729e-4],
  );
}

/** B3ef boundary: P → T */
export function b3ef(p: number): number {
  return 3.727888004 * (p - 22.064) + 647.096;
}

/** B3gh boundary: P → T */
export function b3gh(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3, 4],
    [-2.49284240900418e4, 4.28143584791546e3, -2.6902917314013e2, 7.51608051114157, -7.87105249910383e-2],
  );
}

/** B3ij boundary: P → T */
export function b3ij(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3, 4],
    [5.84814781649163e2, -6.16179320924617e-1, 2.60763050899562e-1, -5.87071076864459e-3, 5.15308185433082e-5],
  );
}

/** B3jk boundary: P → T */
export function b3jk(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3, 4],
    [6.17229772068439e2, -7.70600270141675, 6.97072596851896e-1, -1.57391839848015e-2, 1.37897492684194e-4],
  );
}

/** B3mn boundary: P → T */
export function b3mn(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3],
    [5.35339483742384e2, 7.61978122720128, -1.58365725441648e-1, 1.92871054508108e-3],
  );
}

/** B3op boundary: P → T */
export function b3op(p: number): number {
  return polyEvalLn(p,
    [0, 1, 2, -1, -2],
    [0.969461372400213e3, -0.332500170441278e3, 0.642859598466067e2, 0.773845935768222e3, -0.152313732937084e4],
  );
}

/** B3qu boundary: P → T */
export function b3qu(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3],
    [5.65603648239126e2, 5.29062258221222, -1.02020639611016e-1, 1.22240301070145e-3],
  );
}

/** B3rx boundary: P → T */
export function b3rx(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3],
    [5.84561202520006e2, -1.02961025163669, 2.43293362700452e-1, -2.94905044740799e-3],
  );
}

/** B3uv boundary: P → T */
export function b3uv(p: number): number {
  return polyEval(p,
    [0, 1, 2, 3],
    [5.28199646263062e2, 8.90579602135307, -0.222814134903755, 0.286791682263697e-2],
  );
}

/** B3wx boundary: P → T */
export function b3wx(p: number): number {
  return polyEvalLn(p,
    [0, 1, 2, -1, -2],
    [7.2805260914538, 9.73505869861952e1, 1.47370491183191e1, 0.329196213998375e3, 8.73371668682417e2],
  );
}
