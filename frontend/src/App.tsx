import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { UploadPage } from "@/pages/UploadPage";
import { JobStatusPage } from "@/pages/JobStatusPage";
import { DocumentPreviewPage } from "@/pages/DocumentPreviewPage";
import { DocumentViewPage } from "@/pages/DocumentViewPage";
import { ReferencePage } from "@/pages/ReferencePage";
import { useAuth } from "@/hooks/useAuth";
import { TopBar } from "@/components/TopBar";

const qc = new QueryClient();

function Protected({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<Protected><UploadPage /></Protected>} />
          <Route path="/documents/:documentId" element={<Protected><DocumentPreviewPage /></Protected>} />
          <Route path="/jobs/:jobId" element={<Protected><JobStatusPage /></Protected>} />
          <Route path="/jobs/:jobId/results" element={<Protected><DocumentViewPage /></Protected>} />
          <Route path="/reference/:jobId" element={<Protected><ReferencePage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}