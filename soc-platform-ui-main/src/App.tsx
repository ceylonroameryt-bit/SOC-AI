import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';

// Lazy Load Pages for Optimization
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Sources        = lazy(() => import('./pages/Sources'));
const Threats        = lazy(() => import('./pages/Threats'));
const Archives       = lazy(() => import('./pages/Archives'));
const Enrichment     = lazy(() => import('./pages/Enrichment'));
const MitreHeatmap   = lazy(() => import('./pages/MitreHeatmap'));
const MitreNews      = lazy(() => import('./pages/MitreNews'));
const RuleLibrary    = lazy(() => import('./pages/RuleLibrary'));
const Settings       = lazy(() => import('./pages/Settings'));
const AIBrief        = lazy(() => import('./pages/AIBrief'));
const CriticalThreatsView = lazy(() => import('./components/dashboard/CriticalThreatsView'));
const SeverityChart  = lazy(() => import('./components/dashboard/SeverityChart'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full text-cyan-500">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="sources"    element={<Sources />} />
            <Route path="threats"    element={<Threats />} />
            <Route path="archives"   element={<Archives />} />
            <Route path="critical"   element={<CriticalThreatsView />} />
            <Route path="enrich"     element={<Enrichment />} />
            <Route path="mitre"      element={<MitreHeatmap />} />
            <Route path="mitre-news" element={<MitreNews />} />
            <Route path="mitre/news" element={<MitreNews />} />
            <Route path="rules"      element={<RuleLibrary />} />
            <Route path="settings"   element={<Settings />} />
            <Route path="ai"         element={<AIBrief />} />
            <Route path="metrics"    element={<div className="p-6 h-full flex flex-col"><h2 className="text-2xl font-bold text-white mb-6">Severity Metrics</h2><div className="flex-1 min-h-0"><SeverityChart /></div></div>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App
