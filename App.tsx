
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './src/context/AuthContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { useWorkspace } from './src/hooks/useWorkspace';
import { DatasetProvider } from './src/context/DatasetContext';
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
import ReportViewIntegrated from './src/components/ReportViewIntegrated';
import TheWarRoom from './src/components/TheWarRoom';
const CleanViewIntegrated = React.lazy(() => import('./src/components/CleanViewIntegrated'));
const UniverCleanView = React.lazy(() => import('./src/components/Univer/UniverCleanView'));
import DashboardViewIntegrated from './src/components/DashboardViewIntegrated';
import ReportView from './components/ReportView';
import BillingViewIntegrated from './src/components/BillingViewIntegrated';
import PlaygroundViewIntegrated from './src/components/PlaygroundViewIntegrated';
import DatasetCreatorView from './components/DatasetCreatorView';
import DataPreview from './src/components/DataPreview';
import ValidationRulesManager from './src/components/ValidationRulesManager';
import QuarantineVault from './src/components/QuarantineVault';
import UsageMetrics from './src/components/UsageMetrics';
import DataflowBuilder from './src/components/DataflowBuilder/DataflowBuilder';

// Legal & Public Pages
import PublicLayout from './src/components/Layout/PublicLayout';
import LandingPage from './src/components/LandingPage';
import ContactUs from './src/components/Legal/ContactUs';
import TermsConditions from './src/components/Legal/TermsConditions';
import PrivacyPolicy from './src/components/Legal/PrivacyPolicy';
import RefundPolicy from './src/components/Legal/RefundPolicy';
import PublicShareView from './src/components/PublicShareView';
import FAQ from './src/components/FAQ';

const AppLayout: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  return (
    <MainLayout>
      <UrlSync />
      <React.Suspense fallback={<div className="flex items-center justify-center h-full w-full"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          {/* Workspace & Dataset Management */}
          <Route path="workspaces" element={<WorkspacesView />} />
          <Route path="datasets" element={<DatasetLibrary />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* Data Operations */}
          <Route path="upload" element={<SourceHubView />} />
          <Route path="upload-file" element={<UploadViewPhase3 />} />
          <Route path="connect/:providerId" element={<ConnectorSetupView />} />
          <Route path="explore-connection/:integrationId" element={<ConnectorExplorerView />} />
          <Route path="create" element={<DatasetCreatorView onDataLoaded={() => { }} />} />
          <Route path="clean" element={<UniverCleanView />} />
          <Route path="clean-legacy" element={<CleanViewIntegrated />} />
          <Route path="playground" element={<PlaygroundViewIntegrated />} />
          <Route path="dashboard" element={<DashboardViewIntegrated />} />
          <Route path="dashboards" element={<DashboardLibrary />} />
          <Route path="report" element={<ReportViewIntegrated />} />
          <Route path="war-room" element={<TheWarRoom />} />
          <Route path="queries" element={<QueryHistory />} />
          <Route path="preview" element={<DataPreview />} />
          <Route path="rules" element={<ValidationRulesManager />} />
          <Route path="quarantine" element={<QuarantineVault />} />
          <Route path="metrics" element={<UsageMetrics />} />
          <Route path="dataflows" element={<DataflowBuilder workspaceId={String(activeWorkspace?.id || '')} />} />
          <Route path="billing" element={<BillingViewIntegrated />} />

          {/* Default route */}
          <Route path="/" element={<Navigate to="workspaces" replace />} />
        </Routes>
      </React.Suspense>
    </MainLayout>
  );
};

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <DatasetProvider>
          <Router>
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
          </Router>
        </DatasetProvider>
      </WorkspaceProvider>
    </AuthProvider >
  );
}

export default App;
