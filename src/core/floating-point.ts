const bits = new DataView(new ArrayBuffer(8));

/** Adjacent IEEE-754 double; value must be positive and finite. */
export function nextPositiveFloat(value: number, direction: 1 | -1): number {
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + BigInt(direction));
  return bits.getFloat64(0);
}
