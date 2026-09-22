import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SitePasswordProtection } from "@/components/SitePasswordProtection";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import Documents from "./pages/Documents";
import Audit from "./pages/Audit";
import DocumentLoader from "./pages/DocumentLoader";
import ManageRegulations from "./pages/ManageRegulations";
import BatchUpload from "./pages/BatchUpload";
import ComplianceHub from "./pages/ComplianceHub";
import NewAssessment from "./pages/NewAssessment";
import CodeCheck from "./pages/CodeCheck";
import AssessmentDetail from "./pages/AssessmentDetail";
import ComplianceAnalysis from "./pages/ComplianceAnalysis";
import PredictiveAnalytics from "./pages/PredictiveAnalytics";
import MarketIntelligence from "./pages/MarketIntelligence";
import SectorBenchmark from "./pages/SectorBenchmark";
import AICopilot from "./pages/AICopilot";
import ContinuousMonitoring from "./pages/ContinuousMonitoring";
import GeneratedDocuments from "./pages/GeneratedDocuments";
import LoadCRA from "./pages/LoadCRA";
import LoadGDPR from "./pages/LoadGDPR";
import LoadNIS2 from "./pages/LoadNIS2";
import LoadSMEBestPractices from "./pages/LoadSMEBestPractices";
import LoadDORA from "./pages/LoadDORA";
import LoadAIAct from "./pages/LoadAIAct";
import LoadCodiceCyber from "./pages/LoadCodiceCyber";
import AdminLoadCRA from "./pages/AdminLoadCRA";
import AdminLoadDocuments from "./pages/AdminLoadDocuments";
import LoadCodiceCybersicurezza from "./pages/LoadCodiceCybersicurezza";
import LoadDataAct from "./pages/LoadDataAct";
import LoadAgidDocuments from "./pages/LoadAgidDocuments";
import LoadISO27001Templates from "./pages/LoadISO27001Templates";
import LoadAlbanianDPL from "./pages/LoadAlbanianDPL";
import UploadISO27001Files from "./pages/UploadISO27001Files";
import VerifyKnowledgeBase from "./pages/VerifyKnowledgeBase";
import RagQuality from "./pages/RagQuality";
import AdminDashboard from "./pages/AdminDashboard";
import DocumentViewer from "./pages/DocumentViewer";
import Gamification from "./pages/Gamification";
import ManageRequirements from "./pages/ManageRequirements";

import InvestorPitch from "./pages/InvestorPitch";
import TermsConditions from "./pages/TermsConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "./pages/NotFound";
import TrainingOverview from "./features/training/pages/TrainingOverview";
import TrainingGapCourseFlow from "./features/training/pages/TrainingGapCourseFlow";
import TrainingPlaceholderPage from "./features/training/pages/TrainingPlaceholderPage";
import { TrainingDemoPlaceholder } from "./features/training/components/TrainingLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SitePasswordProtection>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/load-documents" element={<DocumentLoader />} />
            <Route path="/admin/manage-regulations" element={<ManageRegulations />} />
            <Route path="/admin/batch-upload" element={<BatchUpload />} />
            <Route path="/admin/load-cra" element={<LoadCRA />} />
            <Route path="/admin/load-gdpr" element={<LoadGDPR />} />
            <Route path="/admin/load-nis2" element={<LoadNIS2 />} />
            <Route path="/admin/load-sme-best-practices" element={<LoadSMEBestPractices />} />
            <Route path="/admin/load-dora" element={<LoadDORA />} />
            <Route path="/admin/load-ai-act" element={<LoadAIAct />} />
            <Route path="/admin/load-codice-cyber" element={<LoadCodiceCyber />} />
            <Route path="/admin/load-cra-full" element={<AdminLoadCRA />} />
            <Route path="/admin/load-new-documents" element={<AdminLoadDocuments />} />
            <Route path="/admin/load-codice-cybersicurezza" element={<LoadCodiceCybersicurezza />} />
            <Route path="/admin/load-data-act" element={<LoadDataAct />} />
            <Route path="/admin/load-agid-documents" element={<LoadAgidDocuments />} />
            <Route path="/admin/load-iso27001-templates" element={<LoadISO27001Templates />} />
            <Route path="/admin/upload-iso27001-files" element={<UploadISO27001Files />} />
            <Route path="/admin/load-albanian-dpl" element={<LoadAlbanianDPL />} />
            <Route path="/admin/verify-knowledge-base" element={<VerifyKnowledgeBase />} />
            <Route path="/admin/rag-quality" element={<RagQuality />} />
            <Route path="/admin/manage-requirements" element={<ManageRequirements />} />
            <Route path="/compliance" element={<ComplianceHub />} />
            <Route path="/compliance/analysis" element={<ComplianceAnalysis />} />
            <Route path="/compliance/new-assessment" element={<NewAssessment />} />
            <Route path="/compliance/code-check" element={<CodeCheck />} />
            <Route path="/compliance/assessment/:id" element={<AssessmentDetail />} />
            <Route path="/compliance/predictive-analytics" element={<PredictiveAnalytics />} />
            <Route path="/compliance/market-intelligence" element={<MarketIntelligence />} />
            <Route path="/compliance/benchmark" element={<SectorBenchmark />} />
            <Route path="/compliance/ai-copilot" element={<AICopilot />} />
            <Route path="/compliance/continuous-monitoring" element={<ContinuousMonitoring />} />
            <Route path="/compliance/documents" element={<GeneratedDocuments />} />
            <Route path="/document-viewer" element={<DocumentViewer />} />
            <Route path="/gamification" element={<Gamification />} />
            <Route path="/formazione" element={<TrainingOverview />} />
            <Route path="/formazione/gap/:gapId" element={<TrainingGapCourseFlow />} />
            <Route path="/formazione/corsi-assegnati" element={<TrainingPlaceholderPage title="Corsi assegnati" />} />
            <Route path="/formazione/catalogo" element={<TrainingPlaceholderPage title="Catalogo corsi" />} />
            <Route path="/formazione/certificati" element={<TrainingPlaceholderPage title="Certificati & Attestati" />} />
            <Route path="/formazione/team-ruoli" element={<TrainingPlaceholderPage title="Team & Ruoli" />} />
            <Route path="/formazione/audit-trail" element={<TrainingPlaceholderPage title="Audit Trail Formativo" />} />
            <Route path="/formazione/demo/:module" element={<TrainingDemoPlaceholder />} />
            
            <Route path="/investor-pitch" element={<InvestorPitch />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SitePasswordProtection>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
