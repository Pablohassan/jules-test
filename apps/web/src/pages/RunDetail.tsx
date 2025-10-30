import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getRun } from '../api';

function RunDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: run, isLoading, error } = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id!),
    enabled: !!id,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching run</div>;
  if (!run) return <div>Run not found</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Run Details</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {run.keywords.join(', ')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{run.status}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Progress</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{run.progress}%</dd>
            </div>
            {/* Add more details here as needed */}
          </dl>
        </div>
      </div>
    </div>
  );
}

export default RunDetail;
