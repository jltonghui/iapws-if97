export type ReportRow = {
  caseId: string;
  property: string;
  expected: number;
  actual: number;
};

function relativeError(actual: number, expected: number): number {
  if (expected === 0) {
    return Math.abs(actual);
  }
  return Math.abs((actual - expected) / expected);
}

export function printGroupedReport(title: string, rows: ReportRow[]): number {
  const byCase = new Map<string, ReportRow[]>();

  for (const row of rows) {
    const group = byCase.get(row.caseId);
    if (group) {
      group.push(row);
    } else {
      byCase.set(row.caseId, [row]);
    }
  }

  const summary = [...byCase.entries()].map(([caseId, caseRows]) => {
    const maxRelativeError = Math.max(...caseRows.map((row) => relativeError(row.actual, row.expected)));
    return {
      case: caseId,
      points: caseRows.length,
      maxRelErrorPct: Number((maxRelativeError * 100).toExponential(3)),
    };
  });

  console.log(`\n${title}`);
  console.log('Summary');
  console.table(summary);

  for (const [caseId, caseRows] of byCase) {
    console.log(caseId);
    console.table(caseRows.map((row) => ({
      property: row.property,
      expected: Number(row.expected.toFixed(6)),
      actual: Number(row.actual.toFixed(6)),
      absError: Number(Math.abs(row.actual - row.expected).toExponential(3)),
      relErrorPct: Number((relativeError(row.actual, row.expected) * 100).toExponential(3)),
    })));
  }

  return Math.max(...rows.map((row) => relativeError(row.actual, row.expected)));
}
