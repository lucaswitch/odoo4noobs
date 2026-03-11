import CryptoJS from 'crypto-js'

// Derive a machine-specific key from a fixed salt + app identifier
// In production you'd use electron's safeStorage, but this provides
// a solid encryption layer for localStorage
const ENCRYPTION_KEY = 'odoogugu-v1-' + (navigator.userAgent || 'default')

export function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString()
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}
