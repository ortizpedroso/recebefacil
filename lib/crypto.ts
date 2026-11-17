import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { masterSecret } from "./secret";

const VERSION = "v1";
const INFO = "recebefacil/segredo-em-repouso/v1";

export class SecretUnreadableError extends Error {
  constructor() {
    super("Não foi possível ler o segredo guardado. Informe-o de novo.");
  }
}

// Cada valor ganha o próprio sal, então a mesma chave nunca produz o mesmo texto cifrado.
function keyFor(master: string, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", master, salt, INFO, 32));
}

export function encryptSecret(plain: string, master: string = masterSecret()): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(master, salt), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, salt, iv, cipher.getAuthTag(), body].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(":");
}

export function decryptSecret(token: string, master: string = masterSecret()): string {
  const [version, salt, iv, tag, body, ...extra] = token.split(":");
  if (version !== VERSION || !salt || !iv || !tag || body === undefined || extra.length > 0) throw new SecretUnreadableError();
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(master, Buffer.from(salt, "base64url")), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretUnreadableError();
  }
}

// Compara resumos do mesmo tamanho, então nem o tamanho do segredo vaza pelo tempo da resposta.
export function safeEqual(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(given), digest(expected));
}
