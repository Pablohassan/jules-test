import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewRunPage from './pages/NewRunPage';
import RunDetailsPage from './pages/RunDetailsPage';
import ClientsPage from './pages/ClientsPage';
import VeillesPage from './pages/VeillesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewRunPage />} />
        <Route path="runs/:id" element={<RunDetailsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="veilles" element={<VeillesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
