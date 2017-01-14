'use strict'

const fs = require('fs')

exports.loadInstrumentationFixtures = () => {
  const base = `${__dirname}/fixture/instrument`
  const files = fs.readdirSync(base)
  const output = []

  files.forEach(name => {
    const match = (/^(.+)\.before\.txt$/).exec(name)
    if (!match || !files.includes(`${match[1]}.after.txt`)) {
      return
    }

    const tcase = match[1]
    output.push({
      name,
      before: fs.readFileSync(`${base}/${tcase}.before.txt`, 'utf8').trim(),
      after: fs.readFileSync(`${base}/${tcase}.after.txt`, 'utf8').trim()
    })
  })

  return output
}
