import { TrainingLayout } from "../components/TrainingLayout";

export default function TrainingPlaceholderPage({ title }: { title: string }) {
  return (
    <TrainingLayout>
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Schermata prevista negli step successivi del build incrementale.</p>
      </section>
    </TrainingLayout>
  );
}
