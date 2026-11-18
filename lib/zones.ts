// Todo o Brasil cabe em quatro horários. Os nomes ajudam quem não sabe o que é UTC.
export const BRAZIL_ZONES = [
  { id: "America/Sao_Paulo", label: "Horário de Brasília (SP, RJ, MG, Sul, Nordeste, Pará, GO e DF)" },
  { id: "America/Manaus", label: "Amazonas" },
  { id: "America/Cuiaba", label: "Mato Grosso" },
  { id: "America/Campo_Grande", label: "Mato Grosso do Sul" },
  { id: "America/Porto_Velho", label: "Rondônia" },
  { id: "America/Boa_Vista", label: "Roraima" },
  { id: "America/Rio_Branco", label: "Acre" },
  { id: "America/Noronha", label: "Fernando de Noronha" },
] as const;

export const DEFAULT_ZONE = "America/Sao_Paulo";

export function isBrazilZone(id: string): boolean {
  return BRAZIL_ZONES.some((zone) => zone.id === id);
}
