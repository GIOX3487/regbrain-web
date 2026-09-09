export type TrainingRegulation = "GDPR" | "NIS2" | "DORA" | "AI Act" | "CRA";
export type TrainingSeverity = "Alta" | "Media" | "Bassa" | "Critica";
export type TrainingStatus = "Da iniziare" | "In corso" | "Completato" | "In ritardo";
export type TrainingRole = "DPO" | "CISO" | "IT Lead" | "HR" | "Marketing" | "Legal" | "Sales" | "Customer Care";

export interface TrainingGap {
  id: string;
  title: string;
  regulation: TrainingRegulation;
  article: string;
  severity: TrainingSeverity;
  source: string;
  detectedAt: string;
  runId: string;
  quote: string;
  processes: string[];
  status: "Aperto" | "In corso" | "Rimediato" | "In ritardo";
  progress: number;
  assigneeIds: string[];
  generatedCourseId: string;
}

export interface TrainingEmployee {
  id: string;
  name: string;
  email: string;
  role: TrainingRole;
  department: string;
  coverage: number;
  lastCourse: string;
  initials: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  source: "AI-generated" | "Catalogo" | "Masterclass" | "Certificazione";
  gapId?: string;
  duration: string;
  regulations: TrainingRegulation[];
  status: TrainingStatus;
  progress: number;
  dueDate: string;
  assigneeIds: string[];
  lessons: string[];
  instructor?: string;
  premium?: boolean;
}

export interface TrainingCertificate {
  id: string;
  employeeId: string;
  courseId: string;
  date: string;
  score: number;
  hash: string;
  verified: boolean;
}

export interface TrainingAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  related: string;
  hash: string;
  type: "assegnazione" | "completamento" | "attestato" | "audit" | "regola";
}

export interface TrainingRule {
  id: string;
  condition: string;
  assignTo: TrainingRole[];
  enabled: boolean;
}
