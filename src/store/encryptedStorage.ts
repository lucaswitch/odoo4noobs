import { encrypt, decrypt } from './crypto'

// Custom storage engine for redux-persist that encrypts all data
const encryptedStorage = {
  getItem(key: string): Promise<string | null> {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return Promise.resolve(null)
      const decrypted = decrypt(raw)
      return Promise.resolve(decrypted || null)
    } catch {
      // If decryption fails, clear corrupted data
      localStorage.removeItem(key)
      return Promise.resolve(null)
    }
  },

  setItem(key: string, value: string): Promise<void> {
    const encrypted = encrypt(value)
    localStorage.setItem(key, encrypted)
    return Promise.resolve()
  },

  removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
    return Promise.resolve()
  },
}

export default encryptedStorage
