
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './src/context/AuthContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { useWorkspace } from './src/hooks/useWorkspace';
import { DatasetProvider } from './src/context/DatasetContext';
import { VersionProvider } from './src/context/VersionContext';
import { ActivityProvider } from './src/context/ActivityContext';
import { ProtectedRoute } from './src/routes/ProtectedRoute';
import { PublicRoute } from './src/routes/PublicRoute';
import { SourceType } from './types';

// Auth Pages
import { LoginPage } from './src/components/LoginPage';
import { SignupPage } from './src/components/SignupPage';
import { ProfilePage } from './src/components/ProfilePage';

// App Pages
import MainLayout from './src/components/Layout/MainLayout';
import { UrlSync } from './src/components/UrlSync';
import { WorkspacesView } from './src/components/WorkspacesView';
import { DatasetLibrary } from './src/components/DatasetLibrary';
import { UploadViewPhase3 } from './src/components/UploadViewPhase3';
import SourceHubView from './src/components/SourceHubView';
import ConnectorSetupView from './src/components/ConnectorSetupView';
import ConnectorExplorerView from './src/components/ConnectorExplorerView';
import { QueryHistory } from './src/components/QueryHistory';
import { DashboardLibrary } from './src/components/DashboardLibrary';
import ReportLibrary from './src/components/ReportLibrary';
import ReportViewIntegrated from './src/components/ReportViewIntegrated';
import TheWarRoom from './src/components/TheWarRoom';
const DashboardViewIntegrated = React.lazy(() => import('./src/components/DashboardViewIntegrated'));
const SpreadsheetViewIntegrated = React.lazy(() => import('./components/SpreadsheetViewIntegrated'));
const UniverCleanView = React.lazy(() => import('./src/components/Univer/UniverCleanView'));
import BillingViewIntegrated from './src/components/BillingViewIntegrated';
import PlaygroundViewIntegrated from './src/components/PlaygroundViewIntegrated';
import DatasetCreatorView from './components/DatasetCreatorView';
import DataPreview from './src/components/DataPreview';
import ValidationRulesManager from './src/components/ValidationRulesManager';
import QuarantineVault from './src/components/QuarantineVault';
import UsageMetrics from './src/components/UsageMetrics';
import DataflowBuilder from './src/components/DataflowBuilder/DataflowBuilder';
import MetricsLibrary from './src/components/MetricsLibrary';
import AlertsManager from './src/components/Alerts/AlertsManager';

// Unified Work OS Modules
const HomeView = React.lazy(() => import('./src/components/Home/HomeView'));
const ChatView = React.lazy(() => import('./src/components/Chat/ChatView'));
const TasksView = React.lazy(() => import('./src/components/Tasks/TasksView'));
const DocsView = React.lazy(() => import('./src/components/Docs/DocsView'));
const FormsView = React.lazy(() => import('./src/components/Forms/FormsView'));
const FilesView = React.lazy(() => import('./src/components/Files/FilesView'));

// Legal & Public Pages
import PublicLayout from './src/components/Layout/PublicLayout';
import LandingPage from './src/components/LandingPage';
import ContactUs from './src/components/Legal/ContactUs';
import TermsConditions from './src/components/Legal/TermsConditions';
import PrivacyPolicy from './src/components/Legal/PrivacyPolicy';
import RefundPolicy from './src/components/Legal/RefundPolicy';
import PublicShareView from './src/components/PublicShareView';
import FAQ from './src/components/FAQ';
import { OnboardingWizard } from './src/components/Onboarding/OnboardingWizard';

const AppLayout: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  return (
    <MainLayout>
      <OnboardingWizard />
      <UrlSync />
      <React.Suspense fallback={<div className="flex items-center justify-center h-full w-full"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          {/* =========================================================
              CORE WORKSPACE
             ========================================================= */}
          <Route path="/" element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomeView />} />
          <Route path="workspaces" element={<WorkspacesView />} />
          <Route path="datasets" element={<DatasetLibrary />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* Connect & Upload */}
          <Route path="create" element={<DatasetCreatorView onDataLoaded={() => { }} />} />
          <Route path="upload" element={<SourceHubView />} />
          <Route path="upload-file" element={<UploadViewPhase3 />} />
          <Route path="connect/:providerId" element={<ConnectorSetupView />} />
          <Route path="explore-connection/:integrationId" element={<ConnectorExplorerView />} />

          {/* Collaboration */}
          <Route path="chat" element={<ChatView />} />
          <Route path="chat/:channelId" element={<ChatView />} />
          <Route path="docs" element={<DocsView />} />
          <Route path="docs/:id" element={<DocsView />} />

          {/* =========================================================
              DATASET TOOLS (Tabbed Tool Views)
             ========================================================= */}
          {/* The "Sheet" View — Excel-like Editing */}
          <Route path="sheets" element={<SpreadsheetViewIntegrated />} />

          {/* The "Clean" View — AI Data Quality */}
          <Route path="clean" element={<UniverCleanView />} />

          {/* The "Dashboard" View — Visualization */}
          <Route path="dashboard" element={<DashboardViewIntegrated />} />

          {/* The "Report" View — Doc-style Reporting */}
          <Route path="report" element={<ReportViewIntegrated />} />

          {/* The "Playground" View — Code/SQL */}
          <Route path="playground" element={<PlaygroundViewIntegrated />} />


          {/* =========================================================
              LEGACY / FEATURE ROUTES (Kept for compatibility)
             ========================================================= */}
          <Route path="tasks" element={<TasksView />} />
          <Route path="forms" element={<FormsView />} />
          <Route path="forms/:id" element={<FormsView />} />
          <Route path="files" element={<FilesView />} />
          <Route path="war-room" element={<TheWarRoom />} />
          <Route path="dashboards" element={<DashboardLibrary />} />
          <Route path="reports" element={<ReportLibrary />} />
          <Route path="queries" element={<QueryHistory />} />
          <Route path="preview" element={<DataPreview />} />
          <Route path="rules" element={<ValidationRulesManager />} />
          <Route path="quarantine" element={<QuarantineVault />} />
          <Route path="metrics" element={<UsageMetrics />} />
          <Route path="metrics-library" element={<MetricsLibrary />} />
          <Route path="dataflows" element={<DataflowBuilder workspaceId={String(activeWorkspace?.id || '')} />} />
          <Route path="alerts" element={<AlertsManager workspaceId={String(activeWorkspace?.id || '')} />} />
          <Route path="billing" element={<BillingViewIntegrated />} />
        </Routes>
      </React.Suspense>
    </MainLayout>
  );
};

import { WorkflowProvider } from './src/context/WorkflowContext';
import { SocketProvider } from './src/context/SocketContext';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <WorkspaceProvider>
          <DatasetProvider>
            <VersionProvider>
              <ActivityProvider>
                <Router>
                  <WorkflowProvider>
                    <Routes>
                      {/* Public Routes */}
                      <Route
                        path="/"
                        element={
                          <PublicLayout>
                            <LandingPage />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/contact"
                        element={
                          <PublicLayout>
                            <ContactUs />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/terms"
                        element={
                          <PublicLayout>
                            <TermsConditions />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/privacy"
                        element={
                          <PublicLayout>
                            <PrivacyPolicy />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/refunds"
                        element={
                          <PublicLayout>
                            <RefundPolicy />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/faq"
                        element={
                          <PublicLayout>
                            <FAQ />
                          </PublicLayout>
                        }
                      />
                      <Route
                        path="/help"
                        element={
                          <PublicLayout>
                            <FAQ />
                          </PublicLayout>
                        }
                      />

                      {/* Public Share Route (NO AUTH) */}
                      <Route path="/public/share/:token" element={<PublicShareView />} />

                      <Route
                        path="/login"
                        element={
                          <PublicRoute>
                            <LoginPage />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/signup"
                        element={
                          <PublicRoute>
                            <SignupPage />
                          </PublicRoute>
                        }
                      />

                      {/* Protected Routes */}
                      <Route
                        path="/app/*"
                        element={
                          <ProtectedRoute>
                            <AppLayout />
                          </ProtectedRoute>
                        }
                      />

                      {/* Default redirect for /app */}
                      <Route path="/admin" element={<Navigate to="/app/workspaces" replace />} />
                    </Routes>
                  </WorkflowProvider>
                </Router>
              </ActivityProvider>
            </VersionProvider>
          </DatasetProvider>
        </WorkspaceProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
