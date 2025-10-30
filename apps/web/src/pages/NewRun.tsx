import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { createRun } from '../api';

const newRunSchema = z.object({
  keywords: z.string().min(1, 'Keywords are required'),
  daysBack: z.number().min(7).max(14),
  maxResults: z.number().min(10).max(30),
});

function NewRun() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      navigate('/runs');
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = {
      keywords: formData.get('keywords') as string,
      daysBack: parseInt(formData.get('daysBack') as string, 10),
      maxResults: parseInt(formData.get('maxResults') as string, 10),
    };

    try {
      const validatedData = newRunSchema.parse(data);
      mutation.mutate({
          ...validatedData,
          keywords: validatedData.keywords.split(',').map(k => k.trim()),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        console.error(error.errors);
      }
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">New Run</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">Keywords (comma-separated)</label>
          <input type="text" id="keywords" name="keywords" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="daysBack" className="block text-sm font-medium text-gray-700">Days Back ({'7'} - {'14'})</label>
          <input type="range" id="daysBack" name="daysBack" min="7" max="14" defaultValue="7" className="mt-1 block w-full" />
        </div>
        <div>
          <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700">Max Results ({'10'} - {'30'})</label>
          <input type="range" id="maxResults" name="maxResults" min="10" max="30" defaultValue="10" className="mt-1 block w-full" />
        </div>
        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
          {mutation.isPending ? 'Launching...' : 'Launch'}
        </button>
      </form>
    </div>
  );
}

export default NewRun;
