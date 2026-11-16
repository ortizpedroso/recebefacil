import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function encryptionSecret() {
  const secret = process.env.RECEBEFACIL_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("Defina RECEBEFACIL_SECRET no ambiente. Nenhuma chave fica no código.");
  }
  return secret;
}

function keyFrom(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function seal(plain: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function openSeal(box: string, secret: string) {
  const [version, iv, tag, body] = box.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Cofre inválido.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function sameToken(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
