import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRun, getFeatures } from '../api';
import { motion } from 'framer-motion';
import Spinner from '../components/Spinner';

const newRunSchema = z.object({
  keywords: z.string().min(1, 'Keywords are required'),
  daysBack: z.number().min(7).max(14),
  maxResults: z.number().min(10).max(30),
});

function NewRun() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: features } = useQuery({ queryKey: ['features'], queryFn: getFeatures });
  const [formError, setFormError] = useState<string | null>(null);

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
    const rawKeywords = (formData.get('keywords') as string || '').trim();
    const data: any = {
      keywords: rawKeywords,
      daysBack: parseInt(formData.get('daysBack') as string, 10),
      maxResults: parseInt(formData.get('maxResults') as string, 10),
    };

    try {
      setFormError(null);
      const validatedData = newRunSchema.parse(data);
      const gammaOptions: any = {
        exportAs: (formData.get('exportAs') as string) || undefined,
        format: (formData.get('format') as string) || undefined,
        textMode: (formData.get('textMode') as string) || undefined,
        cardSplit: (formData.get('cardSplit') as string) || undefined,
        numCards: formData.get('numCards') ? parseInt(formData.get('numCards') as string, 10) : undefined,
        themeId: (formData.get('themeId') as string) || undefined,
        folderIds: (formData.get('folderIds') as string)
          ? (formData.get('folderIds') as string).split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        additionalInstructions: (formData.get('additionalInstructions') as string) || undefined,
        textOptions: (formData.get('language') as string)
          ? { language: formData.get('language') as string }
          : undefined,
        imageOptions: (formData.get('imageModel') as string)
          ? { model: formData.get('imageModel') as string }
          : undefined,
      };
      mutation.mutate({
        ...validatedData,
        keywords: validatedData.keywords.split(',').map(k => k.trim()),
        gammaOptions,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues?.[0];
        setFormError(issue?.message || 'Please fix the highlighted fields.');
        return;
      }
      setFormError((error as Error).message);
    }
  };

  const canLaunch = Boolean(features && features.searchAvailable && features.summarizeAvailable);

  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
      <h1 className="text-3xl font-bold mb-6">New Run</h1>
      {!canLaunch && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
          Creating runs requires TAVILY_API_KEY and OPENAI_API_KEY. Please configure them.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">Keywords (comma-separated) <span className="text-red-600">*</span></label>
          <input required aria-invalid={!!formError} type="text" id="keywords" name="keywords" className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${formError ? 'border-red-500' : 'border border-gray-300'}`} />
          {formError && (
            <p className="mt-1 text-sm text-red-600">{formError}</p>
          )}
        </div>
        <div>
          <label htmlFor="daysBack" className="block text-sm font-medium text-gray-700">Days Back ({'7'} - {'14'})</label>
          <input type="range" id="daysBack" name="daysBack" min="7" max="14" defaultValue="7" className="mt-1 block w-full" />
        </div>
        <div>
          <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700">Max Results ({'10'} - {'30'})</label>
          <input type="range" id="maxResults" name="maxResults" min="10" max="30" defaultValue="10" className="mt-1 block w-full" />
        </div>
        <div className="pt-4 border-t">
          <h2 className="text-xl font-semibold mb-2">Gamma Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700">Format</label>
              <select id="format" name="format" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="presentation">Presentation</option>
                <option value="document">Document</option>
                <option value="webpage">Webpage</option>
                <option value="social">Social</option>
              </select>
            </div>
            <div>
              <label htmlFor="textMode" className="block text-sm font-medium text-gray-700">Text Mode</label>
              <select id="textMode" name="textMode" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="preserve">Preserve</option>
                <option value="generate">Generate</option>
                <option value="condense">Condense</option>
              </select>
            </div>
            <div>
              <label htmlFor="exportAs" className="block text-sm font-medium text-gray-700">Export As</label>
              <select id="exportAs" name="exportAs" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="">Default</option>
                <option value="pdf">PDF</option>
                <option value="pptx">PPTX</option>
              </select>
            </div>
            <div>
              <label htmlFor="cardSplit" className="block text-sm font-medium text-gray-700">Card Split</label>
              <select id="cardSplit" name="cardSplit" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="auto">Auto</option>
                <option value="inputTextBreaks">Input Text Breaks</option>
              </select>
            </div>
            <div>
              <label htmlFor="numCards" className="block text-sm font-medium text-gray-700">Number of Cards</label>
              <input type="number" id="numCards" name="numCards" min={1} max={75} placeholder="e.g., 10" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="themeId" className="block text-sm font-medium text-gray-700">Theme ID</label>
              <input type="text" id="themeId" name="themeId" placeholder="optional" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="folderIds" className="block text-sm font-medium text-gray-700">Folder IDs (comma‑separated)</label>
              <input type="text" id="folderIds" name="folderIds" placeholder="abc123, def456" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">Additional Instructions</label>
              <textarea id="additionalInstructions" name="additionalInstructions" rows={3} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" placeholder="e.g., Make titles catchy"></textarea>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700">Text Language</label>
              <input type="text" id="language" name="language" placeholder="e.g., en, fr" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700">Image Model</label>
              <input type="text" id="imageModel" name="imageModel" placeholder="e.g., dalle-beta" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
          </div>
        </div>
        <button type="submit" disabled={mutation.isPending || !canLaunch} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 inline-flex items-center space-x-2">
          {mutation.isPending && <Spinner size={18} />}
          <span>{mutation.isPending ? 'Launching…' : 'Launch'}</span>
        </button>
      </form>
    </motion.div>
  );
}

export default NewRun;
