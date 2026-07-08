import { useState, useEffect, startTransition } from 'react';
import { TeamMember } from './types.js';
import LoginScreen from './components/LoginScreen.js';
import TaskBoard from './components/TaskBoard.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    // Check if there is an active logged-in session saved
    const savedSession = localStorage.getItem('printstop_sourcing_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setCurrentUser(parsed);
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('printstop_sourcing_session');
      }
    }
    setAuthChecking(false);
  }, []);

  const handleLoginSuccess = (member: TeamMember) => {
    localStorage.setItem('printstop_sourcing_session', JSON.stringify(member));
    startTransition(() => {
      setCurrentUser(member);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('printstop_sourcing_session');
    startTransition(() => {
      setCurrentUser(null);
    });
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="h-6 w-6 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-slate-400 mt-2">Checking session status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {currentUser ? (
        <TaskBoard currentMember={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
