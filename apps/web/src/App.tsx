import { Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFeatures, disconnectGoogle } from './api';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

function App() {
  const qc = useQueryClient();
  const { data: features } = useQuery({ queryKey: ['features'], queryFn: getFeatures });

  async function onDisconnect() {
    try {
      await disconnectGoogle();
      await qc.invalidateQueries({ queryKey: ['features'] });
    } catch (e) {
      // no-op; keep UI simple
    }
  }
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white/80 backdrop-blur shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}>
                  <Link to="/" className="text-2xl font-bold text-gray-800">Veille AI</Link>
                </motion.div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <motion.div whileHover={{scale:1.03}} whileTap={{scale:0.98}}>
              <Link
                to="/new"
                className={`px-4 py-2 rounded-md ${features && features.searchAvailable && features.summarizeAvailable ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed pointer-events-none'}`}
                aria-disabled={!(features && features.searchAvailable && features.summarizeAvailable)}
              >
                New Run
              </Link>
              </motion.div>
              {features?.googleConnected ? (
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-3 py-2 rounded-md bg-green-100 text-green-800 border border-green-200">Google Connected</span>
                  <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.98}} onClick={onDisconnect} className="px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 border">Disconnect</motion.button>
                </div>
              ) : (
                <a href="/api/auth/google" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                  Connect Google
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>
      {features && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {!features.searchAvailable || !features.summarizeAvailable ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-3">
              Missing API keys: { !features.searchAvailable && 'TAVILY_API_KEY '}{ !features.summarizeAvailable && 'OPENAI_API_KEY'}.
              You can still view runs, but creating new runs may fail.
            </div>
          ) : null}
          {!features.googleOAuthConfigured && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
              Google OAuth not configured. Connect Google to enable Drive uploads and Gmail sending.
            </div>
          )}
        </div>
      )}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default App;
