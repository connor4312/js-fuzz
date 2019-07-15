const HashStore = require('../../lib/src/HashStore').HashStore
const store = new HashStore()
const crypto = require('crypto')
const buf = crypto.randomBytes(1024 * 64)

let a = true
bench('exists', () => a = a && store.exists(store.getHashFor(buf), buf))

