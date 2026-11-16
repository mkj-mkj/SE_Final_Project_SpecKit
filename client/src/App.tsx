// 路由（TECH_SPEC §10.1）
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Join from './pages/Join';
import Play from './pages/Play';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherLogin from './pages/TeacherLogin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/teacher/login" element={<TeacherLogin />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/join" element={<Join />} />
      <Route path="/play" element={<Play />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
