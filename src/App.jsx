import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './features/home/Home';
import { ViewerPage } from './features/viewer3d/ViewerPage';
import { RegisterGame } from './features/registration/RegisterGame';
import { RenderPage } from './features/viewer3d/RenderPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer/:juegoId" element={<ViewerPage />} />
        <Route path="/render/:juegoId" element={<RenderPage />} />
        <Route path="/registro" element={<RegisterGame />} />
      </Routes>
    </Router>
  );
}

export default App;
