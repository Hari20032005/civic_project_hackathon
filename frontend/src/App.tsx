import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ReportForm from './components/ReportForm';
import MapView from './components/MapView';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">
              Civic Reporter
            </Link>
            <ul className="nav-links">
              <li><Link to="/" className="nav-link">Report Issue</Link></li>
              <li><Link to="/map" className="nav-link">View Reports</Link></li>
              <li><Link to="/admin" className="nav-link">Admin</Link></li>
            </ul>
          </div>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ReportForm />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
