export function validateBrandName(value: string) {
  return value.trim().length > 0 && value.trim().length <= 40
}

export function validateTagline(value: string) {
  return value.trim().length > 0 && value.trim().length <= 80
}

export function validateHttpsUrl(value: string) {
  return value.startsWith('https://')
}

export function validateEmail(value: string) {
  return value.includes('@') && value.includes('.')
}
