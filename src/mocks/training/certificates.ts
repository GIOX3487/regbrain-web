import type { TrainingCertificate } from "@/features/training/types/training";

export const trainingCertificates: TrainingCertificate[] = Array.from({ length: 25 }, (_, index) => ({
  id: `RB-2026-${String(410 + index).padStart(4, "0")}`,
  employeeId: `emp-${(index % 18) + 1}`,
  courseId: `course-${(index % 12) + 1}`,
  date: `${String(3 + (index % 20)).padStart(2, "0")}/04/2026`,
  score: [80, 86, 92, 95, 100][index % 5],
  hash: `0x${(index + 421).toString(16)}a9f${(index * 17 + 99).toString(16)}c2e${(index * 29 + 51).toString(16)}`,
  verified: index % 7 !== 0,
}));
