import type { TrainingRule } from "@/features/training/types/training";

export const trainingRules: TrainingRule[] = [
  { id: "rule-1", condition: "SE gap è collegato a GDPR Art. 33", assignTo: ["DPO", "IT Lead", "Customer Care"], enabled: true },
  { id: "rule-2", condition: "SE gap è collegato a NIS2 Art. 21 o 23", assignTo: ["CISO", "IT Lead", "DPO"], enabled: true },
  { id: "rule-3", condition: "SE gap riguarda fornitori ICT critici", assignTo: ["Legal", "CISO", "IT Lead"], enabled: true },
  { id: "rule-4", condition: "SE gap riguarda AI Act Art. 4 o 11", assignTo: ["Legal", "IT Lead", "Sales"], enabled: true },
  { id: "rule-5", condition: "SE gap riguarda marketing o CRM", assignTo: ["Marketing", "Sales", "DPO"], enabled: false },
];
