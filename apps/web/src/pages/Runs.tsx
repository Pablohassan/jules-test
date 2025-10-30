import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getRuns } from '../api';

function Runs() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: getRuns,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching runs</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Runs</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {runs?.map((run) => (
            <li key={run.id}>
              <Link to={`/runs/${run.id}`} className="block hover:bg-gray-50">
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-indigo-600 truncate">{run.keywords.join(', ')}</p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {run.status}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <p>Progress: {run.progress}%</p>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Runs;
