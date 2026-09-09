import { useParams } from "react-router-dom";
import { TrainingLayout } from "../components/TrainingLayout";
import { trainingGaps } from "@/mocks/training/gaps";

export default function TrainingGapCourseFlow() {
  const { gapId } = useParams();
  const gap = trainingGaps.find((item) => item.id === gapId) ?? trainingGaps[0];

  return (
    <TrainingLayout>
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">Gap → Corso</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">{gap.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Schermata di dettaglio da costruire nel prossimo step dopo la review della Panoramica.</p>
      </section>
    </TrainingLayout>
  );
}
