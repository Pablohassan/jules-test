import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getRuns } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from '../components/Spinner';
import { ProgressBar } from '../components/ProgressBar';

function Runs() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
  });

  if (isLoading) return (
    <div className="flex items-center space-x-2 text-gray-600">
      <Spinner />
      <span>Chargement des runs…</span>
    </div>
  );
  if (error) return <div>Error fetching runs</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Runs</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          <AnimatePresence>
          {runs?.map((run) => (
            <motion.li key={run.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
              <Link to={`/runs/${run.id}`} className="block hover:bg-gray-50">
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-indigo-600 truncate">{run.keywords.join(', ')}</p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${run.status==='DONE'?'bg-green-100 text-green-800':run.status==='FAILED'?'bg-red-100 text-red-800':'bg-yellow-100 text-yellow-800'}`}>
                        {run.status}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between items-center">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 w-full sm:w-1/3">
                      <ProgressBar value={run.progress} />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.li>
          ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}

export default Runs;
