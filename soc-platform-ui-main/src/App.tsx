import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';
import { AccessibilityProvider } from './context/AccessibilityContext';

// Lazy Load Pages for Optimization
const IntelligenceWorkspace = lazy(() => import('./pages/IntelligenceWorkspace'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Sources        = lazy(() => import('./pages/Sources'));
const Threats        = lazy(() => import('./pages/Threats'));
const Archives       = lazy(() => import('./pages/Archives'));
const Enrichment     = lazy(() => import('./pages/Enrichment'));
const DetectionsHub  = lazy(() => import('./pages/DetectionsHub'));
const MitreHeatmap   = lazy(() => import('./pages/MitreHeatmap'));
const MitreNews      = lazy(() => import('./pages/MitreNews'));
const RuleLibrary    = lazy(() => import('./pages/RuleLibrary'));
const ReportsHub     = lazy(() => import('./pages/ReportsHub'));
const Settings       = lazy(() => import('./pages/Settings'));
const AIBrief        = lazy(() => import('./pages/AIBrief'));
const VulnerabilitiesView = lazy(() => import('./pages/VulnerabilitiesView'));
const CriticalThreatsView = lazy(() => import('./components/dashboard/CriticalThreatsView'));
const SeverityChart  = lazy(() => import('./components/dashboard/SeverityChart'));

const LoadingSpinner = () => (
  <div
    role="status"
    aria-label="Loading page content"
    className="flex items-center justify-center h-full text-[#0665F9] min-h-[300px]"
  >
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0665F9]"></div>
    <span className="sr-only">Loading page content...</span>
  </div>
);

function App() {
  return (
    <AccessibilityProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Primary Analyst Workspace */}
              <Route index element={<IntelligenceWorkspace />} />
              <Route path="intelligence" element={<IntelligenceWorkspace />} />
              <Route path="news"         element={<IntelligenceWorkspace />} />
              <Route path="global-news"  element={<IntelligenceWorkspace />} />
              <Route path="overview"     element={<Dashboard />} />

              {/* Vulnerabilities */}
              <Route path="vulnerabilities" element={<VulnerabilitiesView />} />

              {/* Investigation & Enrichment */}
              <Route path="investigate"  element={<Enrichment />} />
              <Route path="enrich"       element={<Enrichment />} />

              {/* Detections & Frameworks */}
              <Route path="detections"   element={<DetectionsHub />} />
              <Route path="mitre"        element={<MitreHeatmap />} />
              <Route path="mitre-news"   element={<MitreNews />} />
              <Route path="mitre/news"   element={<MitreNews />} />
              <Route path="rules"        element={<RuleLibrary />} />

              {/* Reports & Exports */}
              <Route path="reports"      element={<ReportsHub />} />

              {/* Source Health & Feeds */}
              <Route path="sources"      element={<Sources />} />

              {/* Intelligence Archives & Critical Radar */}
              <Route path="threats"      element={<Threats />} />
              <Route path="archives"     element={<Archives />} />
              <Route path="critical"     element={<CriticalThreatsView />} />
              <Route path="ai"           element={<AIBrief />} />
              <Route path="metrics"      element={<div className="p-6 h-full flex flex-col bg-white"><h2 className="text-2xl font-bold font-sans text-slate-900 mb-6">Severity Metrics</h2><div className="flex-1 min-h-0"><SeverityChart /></div></div>} />

              {/* Administration & Settings */}
              <Route path="settings"     element={<Settings />} />

              {/* Catch-all fallback to Intelligence Workspace */}
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AccessibilityProvider>
  );
}

export default App;
