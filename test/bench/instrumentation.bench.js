const cases = require('../util').loadInstrumentationFixtures();
const fs = require('fs');

let incr = 0;
global.__coverage__ = [];
global.__coverage___prevState = 0;
global.foo = global.bin = global.baz = global.bar = () => {
  incr++;
  return true;
};
cases.forEach(tcase => {
  const before = new Function(tcase.before);
  const after = new Function(tcase.after);
  suite(tcase.name, () => {
set('mintime', 1000);
    bench('before', () => before());
    bench('after', () => after());
  })
});
