import type { TrainingAuditEntry } from "@/features/training/types/training";

const actions = [
  "Corso assegnato",
  "Quiz completato",
  "Attestato emesso e firmato",
  "Gap marcato come rimediato via formazione",
  "Regola di auto-assegnazione applicata",
];

export const trainingAuditLog: TrainingAuditEntry[] = Array.from({ length: 84 }, (_, index) => ({
  id: `log-${index + 1}`,
  timestamp: `2026-04-${String(14 - Math.floor(index / 12)).padStart(2, "0")} ${String(9 + (index % 10)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}`,
  user: ["Maria Bianchi", "Marco Rossi", "RegBrain Engine", "Luca Ferri", "Giulia Romano"][index % 5],
  action: actions[index % actions.length],
  related: [`course-${(index % 12) + 1}`, `gap-${(index % 15) + 1}`][index % 2],
  hash: `sha256:${(index * 991 + 1024).toString(16)}${(index * 31 + 77).toString(16)}`,
  type: ["assegnazione", "completamento", "attestato", "audit", "regola"][index % 5] as TrainingAuditEntry["type"],
}));
