// let us bench against Istanbul's coverage, just for kicks.
const testIstanbul = process.argv.indexOf('--istanbul') > -1
let istInstrumenter
try { istInstrumenter = new (require('istanbul').Instrumenter)() } catch (e) {}

const cases = require('../util').loadInstrumentationFixtures()

let incr = 0
global.__coverage__ = []
global.__coverage___prevState = 0
global.foo = global.bin = global.baz = global.bar = () => {
  incr++
  return true
}

cases.forEach(tcase => {
  suite(tcase.name, () => {
    const before = new Function(tcase.before)
    const after = new Function(tcase.after)
    set('mintime', 1000)
    bench('before', () => before())
    bench('after', () => after())

    if (testIstanbul) {
      const afterInstanbul = new Function(istInstrumenter.instrumentSync(tcase.before))
      bench('after (istanbul)', () => afterInstanbul())
    }
  })
})
