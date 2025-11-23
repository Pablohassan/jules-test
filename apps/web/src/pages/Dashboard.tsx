import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getRuns } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from '../components/Spinner';
import { ProgressBar } from '../components/ProgressBar';
import { Activity, Calendar, Tag } from 'lucide-react';

function Dashboard() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
    refetchInterval: 5000, // Poll every 5s for updates
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-600">
      <Spinner />
      <span className="ml-2">Loading dashboard...</span>
    </div>
  );
  if (error) return <div className="text-red-600 p-4">Error fetching runs</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          <AnimatePresence>
            {runs?.map((run: any) => (
              <motion.li key={run.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <Link to={`/runs/${run.id}`} className="block hover:bg-gray-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full ${run.status === 'DONE' ? 'bg-green-100 text-green-600' :
                            run.status === 'FAILED' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-600'
                          }`}>
                          <Activity className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {run.veille?.name || 'Ad-hoc Search'}
                          </h3>
                          {run.veille?.client && (
                            <p className="text-xs text-gray-500">
                              Client: {run.veille.client.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${run.status === 'DONE' ? 'bg-green-50 text-green-700' :
                            run.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                              'bg-blue-50 text-blue-700'
                          }`}>
                          {run.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(run.createdAt).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{run.keywords.join(', ')}</span>
                        </div>
                      </div>
                      <div className="w-1/3 max-w-[200px]">
                        <ProgressBar value={run.progress} />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {runs?.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <p>No runs yet. Start a new watch or ad-hoc search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
