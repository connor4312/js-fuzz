/**
 * Defined 'interesting' integeners. From go-fuzz.
 * @see https://github.com/dvyukov/go-fuzz/blob/5cc3605ccbb6e38722b388400463114cc3ef29f5/go-fuzz/mutator.go#L417-L430
 */

const interesting8BitNumbers = [-128, -1, 0, 1, 16, 32, 64, 100, 127];

export const interesting8Bits = interesting8BitNumbers.map(n => Buffer.from([n]));

const interesting16BitNumbers = [
  ...interesting8BitNumbers,
  -32768,
  -129,
  128,
  255,
  256,
  512,
  1000,
  1024,
  4096,
  32767,
];

export const interesting16Bits = interesting16BitNumbers
  .map(n => {
    const buf = Buffer.allocUnsafe(2);
    buf.writeInt16BE(n, 0);
    return buf;
  })
  .concat(
    interesting16BitNumbers.map(n => {
      const buf = Buffer.allocUnsafe(2);
      buf.writeInt16LE(n, 0);
      return buf;
    }),
  );

const interesting32BitNumbers = [
  ...interesting16BitNumbers,
  -2147483648,
  -100663046,
  -32769,
  32768,
  65535,
  65536,
  100663045,
  2147483647,
];

export const interesting32Bits = interesting32BitNumbers
  .map(n => {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(n, 0);
    return buf;
  })
  .concat(
    interesting16BitNumbers.map(n => {
      const buf = Buffer.allocUnsafe(4);
      buf.writeInt32BE(n, 0);
      return buf;
    }),
  );
