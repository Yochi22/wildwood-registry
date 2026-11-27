import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { can } from './lib/constants.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import NotFound from './pages/NotFound.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Records = lazy(() => import('./pages/Records.jsx'));
const DogDetail = lazy(() => import('./pages/DogDetail.jsx'));
const DogForm = lazy(() => import('./pages/DogForm.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Activity = lazy(() => import('./pages/Activity.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));

function Private({ role = 'viewer', children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (user.mfaSetupRequired && loc.pathname !== '/cuenta') return <Navigate to="/cuenta" replace />;
  if (!can(user, role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/v/:code" element={<PublicProfile />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Private>
              <Layout />
            </Private>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="registros" element={<Records />} />
          <Route path="registros/nuevo" element={<Private role="editor"><DogForm /></Private>} />
          <Route path="registros/:id" element={<DogDetail />} />
          <Route path="registros/:id/editar" element={<Private role="editor"><DogForm /></Private>} />
          <Route path="usuarios" element={<Private role="admin"><Users /></Private>} />
          <Route path="actividad" element={<Private role="admin"><Activity /></Private>} />
          <Route path="cuenta" element={<Account />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
