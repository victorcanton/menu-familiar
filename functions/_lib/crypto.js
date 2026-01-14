export async function hashCode(code, salt) {
  const data = new TextEncoder().encode(code + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt() {
  // Generar salt aleatorio de 16 bytes
  try {
    const saltArray = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(saltArray);
    } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues(saltArray);
    } else {
      throw new Error("crypto.getRandomValues not available");
    }
    return Array.from(saltArray)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    console.error("Error in generateSalt:", e);
    // Fallback: usar Math.random() (no es criptográficamente seguro, pero es mejor que fallar)
    const saltArray = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      saltArray[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(saltArray)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
