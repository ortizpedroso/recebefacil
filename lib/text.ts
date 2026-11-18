// Busca sem acento e sem maiúscula: "joao" acha "João".
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
