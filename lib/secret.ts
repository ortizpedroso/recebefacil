import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./db";

const MIN_SECRET_LENGTH = 32;

function checked(value: string, origin: string) {
  if (value.length < MIN_SECRET_LENGTH) throw new Error(`${origin} precisa ter pelo menos ${MIN_SECRET_LENGTH} caracteres.`);
  return value;
}

// Em produção o segredo vem só do ambiente: um arquivo local sumiria a cada deploy e invalidaria todos os links já enviados.
export function masterSecret(env: Record<string, string | undefined> = process.env, dir: string = dataDir()): string {
  if (env.RECEBEFACIL_SECRET) return checked(env.RECEBEFACIL_SECRET, "RECEBEFACIL_SECRET");
  if (env.NODE_ENV === "production") throw new Error("Defina RECEBEFACIL_SECRET (mínimo de 32 caracteres) para assinar os links de pagamento.");
  const file = join(dir, ".secret");
  try {
    return checked(readFileSync(file, "utf8").trim(), file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(file, randomBytes(48).toString("hex"), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return checked(readFileSync(file, "utf8").trim(), file);
}

function mac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

export function signToken(payload: string, secret: string = masterSecret()): string {
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac(payload, secret).toString("base64url")}`;
}

export function verifyToken(token: string, secret: string = masterSecret()): string | null {
  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length > 0) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const given = Buffer.from(signature, "base64url");
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return payload;
}

// O agendador externo prova que conhece o segredo mestre sem nunca enviá-lo: manda só este resumo.
export function cronSecret(secret: string = masterSecret()): string {
  return createHmac("sha256", secret).update("cron:asaas").digest("hex");
}
