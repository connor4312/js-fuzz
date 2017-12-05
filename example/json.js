const JSON5 = require('json5')

exports.fuzz = input => {
  input = input.toString('utf8') // we give you buffers by default

  let isPlainJSON = true
  let isJSON5 = true
  try { JSON.parse(input) } catch (e) { isPlainJSON = false }
  try { JSON5.parse(input) } catch (e) { isJSON5 = false }

  // We catch and thrown errors and mark them as failures
  if (isPlainJSON && !isJSON5) {
    throw new Error('Found a string that was JSON but not JSON5');
  }

  return isPlainJSON ? 1 : 0
}
