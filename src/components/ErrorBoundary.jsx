import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-6">
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Error al cargar el modelo 3D
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              El dispositivo (tablet/móvil) probablemente se quedó sin memoria de video (GPU OOM) o el modelo es demasiado pesado para este navegador.
            </p>
            <div className="bg-black/50 p-4 rounded text-xs font-mono overflow-auto max-h-48 mb-4 break-all">
              {this.state.error && this.state.error.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
