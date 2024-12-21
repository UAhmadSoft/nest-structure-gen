// src/App.jsx
import { Suspense, lazy } from 'react';
import { LoadingSpinner } from './components/custom/LoadingStates';
import ErrorBoundary from './components/custom/ErrorBoundary';
import { ERDBuilder } from './pages/ERDBuilder';
import './index.css'

function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        }
      >
        <ERDBuilder />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;