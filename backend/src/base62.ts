const BASE62_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BASE = BigInt(62)

/**
 * Encodes a non-negative integer ID into a Base62 short code.
 */
export function encodeBase62(id: bigint | number): string {
  let n = typeof id === 'bigint' ? id : BigInt(id)
  if (n === 0n) {
    return '0'
  }

  let result = ''
  while (n > 0n) {
    const remainder = Number(n % BASE)
    result = BASE62_ALPHABET[remainder] + result
    n = n / BASE
  }

  return result
}

/**
 * Decodes a Base62 short code back into its numeric ID.
 * Throws if the string contains any non-Base62 character.
 */
export function decodeBase62(code: string): bigint {
  if (!code) {
    throw new Error('empty short code')
  }

  let n = 0n
  for (const char of code) {
    const index = BASE62_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`invalid base62 character: ${char}`)
    }
    n = n * BASE + BigInt(index)
  }

  return n
}
