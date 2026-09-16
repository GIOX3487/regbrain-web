import * as pdfjsLib from "pdfjs-dist";
// Il worker viene preso dalla stessa versione di pdfjs-dist installata: niente CDN esterne
// (bloccate dalla Content Security Policy) e niente disallineamento di versione.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };
