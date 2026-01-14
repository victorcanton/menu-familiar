export async function hashCode(code, salt) {
  const data = new TextEncoder().encode(code + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
export function generateSalt() {
  // Generar salt aleatorio de 16 bytes
  const saltArray = new Uint8Array(16);
  crypto.getRandomValues(saltArray);
  return Array.from(saltArray)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}