const url = process.env.REFRESH_URL ?? 'http://127.0.0.1:8787/__refresh'

const response = await fetch(url)
const text = await response.text()
console.log(`GET ${url} -> ${response.status}`)
console.log(text)
