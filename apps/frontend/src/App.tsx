import { Navigate, Route, Routes } from 'react-router-dom';
import { ChatPage } from './pages/chat/chat-page';
import { DashboardPage } from './pages/dashboard/dashboard-page';
import { DevAgentsPage } from './pages/dev-agents/dev-agents-page';
import { DispatcherPage } from './pages/dispatcher/dispatcher-page';
import { RagPage } from './pages/rag/rag-page';

export const App = () => (
  <Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/rag" element={<RagPage />} />
    <Route path="/dev-agents" element={<DevAgentsPage />} />
    <Route path="/dispatcher" element={<DispatcherPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
