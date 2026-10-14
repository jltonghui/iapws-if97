export type DoubleDouble = readonly [number, number];

function twoSum(a: number, b: number): DoubleDouble {
  const sum = a + b;
  const recoveredB = sum - a;
  return [sum, (a - (sum - recoveredB)) + (b - recoveredB)];
}

function twoProduct(a: number, b: number): DoubleDouble {
  const product = a * b;
  // Dekker's split for binary64: 2^27 + 1.
  const splitA = 134217729 * a;
  const highA = splitA - (splitA - a);
  const lowA = a - highA;
  const splitB = 134217729 * b;
  const highB = splitB - (splitB - b);
  const lowB = b - highB;
  return [product, ((highA * highB - product) + highA * lowB + lowA * highB) + lowA * lowB];
}

export function addExtended(a: DoubleDouble, b: DoubleDouble): DoubleDouble {
  const [sum, error] = twoSum(a[0], b[0]);
  return twoSum(sum, error + a[1] + b[1]);
}

export function multiplyExtended(a: DoubleDouble, b: DoubleDouble): DoubleDouble {
  const [product, error] = twoProduct(a[0], b[0]);
  return twoSum(product, error + a[0] * b[1] + a[1] * b[0]);
}

export function divideExtended(a: DoubleDouble, b: DoubleDouble): DoubleDouble {
  const quotient = a[0] / b[0];
  const product = multiplyExtended([quotient, 0], b);
  const residual = addExtended(a, [-product[0], -product[1]]);
  return addExtended([quotient, 0], [residual[0] / b[0], 0]);
}

export function subtractExtended(a: DoubleDouble, b: DoubleDouble): DoubleDouble {
  return addExtended(a, [-b[0], -b[1]]);
}

export function sqrtExtended(value: DoubleDouble): DoubleDouble {
  const initial = Math.sqrt(value[0]);
  const residual = subtractExtended(value, multiplyExtended([initial, 0], [initial, 0]));
  return addExtended([initial, 0], divideExtended(residual, [2 * initial, 0]));
}
