// Notebook Jupyter: le celle di codice entrano nella revisione, testo e output no.
import { test } from "node:test";
import assert from "node:assert/strict";
import { notebookToCode, isCodeFile } from "../src/lib/code-check/local-scan.ts";

const nb = JSON.stringify({
  metadata: { kernelspec: { language: "python" } },
  cells: [
    { cell_type: "markdown", source: ["# Agente\n", "Note"] },
    { cell_type: "code", source: ["import openai\n", "client = openai.OpenAI(api_key=\"sk-live-abcdefghijklmnopqrstuvwxyz0123456789\")\n"], outputs: [{ text: "ok" }] },
    { cell_type: "code", source: "" },
    { cell_type: "code", source: ["print(user.email)\n"] },
  ],
});

test("un notebook è riconosciuto come codice e le sole celle di codice diventano un file Python", () => {
  assert.ok(isCodeFile("agente.ipynb"));
  const f = notebookToCode("agente.ipynb", nb);
  assert.ok(f);
  assert.equal(f.name, "agente.ipynb.py");
  assert.ok(f.content.includes("# [cella 2]") && f.content.includes("# [cella 4]"));
  assert.ok(!f.content.includes("# Agente") && !f.content.includes("Note"));
  assert.ok(!f.content.includes("[cella 3]"));
});

test("un notebook senza celle di codice o non leggibile non entra", () => {
  assert.equal(notebookToCode("x.ipynb", JSON.stringify({ cells: [{ cell_type: "markdown", source: "ciao" }] })), null);
  assert.equal(notebookToCode("x.ipynb", "non json"), null);
});
