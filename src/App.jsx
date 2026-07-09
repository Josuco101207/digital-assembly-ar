import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './features/home/Home';
import { ViewerPage } from './features/viewer3d/ViewerPage';
import { RegisterGame } from './features/registration/RegisterGame';
import { useViewerStore } from './store/useViewerStore';

function App() {
  const { isGloveMode, toggleGloveMode } = useViewerStore();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer/:juegoId" element={<ViewerPage />} />
        <Route path="/registro" element={<RegisterGame />} />
      </Routes>
      
      <button
        onClick={toggleGloveMode}
        className={`fixed bottom-6 left-6 z-50 px-8 py-4 text-2xl font-bold rounded-full shadow-2xl text-white transition-colors duration-300 ${
          isGloveMode ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'
        }`}
      >
        🧤 MODO GUANTES {isGloveMode ? 'ON' : 'OFF'}
      </button>
    </Router>
  );
}

export default App;
