package main

import "fmt"

const base62Alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func encodeBase62(n int64) string {
	if n == 0 {
		return "0"
	}

	var result []byte

	for n > 0 {
		remainder := n % 62
		result = append(result, base62Alphabet[remainder])
		n = n / 62
	}

	// reverse result
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return string(result)
}

func decodeBase62(s string) (int64, error) {
	var n int64

	for _, c := range s {
		var value int64

		switch {
		case c >= '0' && c <= '9':
			value = int64(c - '0')
		case c >= 'a' && c <= 'z':
			value = int64(c-'a') + 10
		case c >= 'A' && c <= 'Z':
			value = int64(c-'A') + 36
		default:
			return 0, fmt.Errorf("invalid base62 character: %c", c)
		}

		n = n*62 + value
	}

	return n, nil
}
