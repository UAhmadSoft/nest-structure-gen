// src/components/custom/LoadingStates.jsx
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 'default' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  return (
    <Loader2
      className={`animate-spin ${sizeClasses[size]}`}
    />
  );
}

export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="large" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export function LoadingState({ children, loading, message }) {
  if (!loading) return children;

  return (
    <div className="relative">
      {children}
      <LoadingOverlay message={message} />
    </div>
  );
}