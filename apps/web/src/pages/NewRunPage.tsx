import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRun, getFeatures, getClients, getVeilles } from '../api';
import { motion } from 'framer-motion';
import Spinner from '../components/Spinner';
import { Users } from 'lucide-react';

const newRunSchema = z.object({
  keywords: z.string().optional(),
  daysBack: z.number().min(7).max(30),
  maxResults: z.number().min(10).max(30),
});

function NewRun() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: features } = useQuery({ queryKey: ['features'], queryFn: getFeatures });
  const [formError, setFormError] = useState<string | null>(null);

  // Client/Veille Selection State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedVeilleId, setSelectedVeilleId] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');

  // Gamma Options State
  const [gammaOptions, setGammaOptions] = useState<any>({});

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: getClients });
  const { data: veilles } = useQuery({
    queryKey: ['veilles', selectedClientId],
    queryFn: () => getVeilles(selectedClientId),
    enabled: !!selectedClientId
  });

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      navigate(`/runs/${data.runId}`);
    },
  });

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClientId(e.target.value);
    setSelectedVeilleId(''); // Reset veille when client changes
    setGammaOptions({}); // Reset gamma options
  };

  const handleVeilleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const veilleId = e.target.value;
    setSelectedVeilleId(veilleId);
    if (veilleId) {
      const veille = veilles.find((v: any) => v.id === veilleId);
      if (veille && veille.gammaOptions) {
        // Pre-fill Gamma options from Veille
        setGammaOptions(veille.gammaOptions);
      } else {
        setGammaOptions({});
      }
    } else {
      setGammaOptions({});
    }
  };

  const handleGammaOptionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log('[handleGammaOptionChange]', { name, value, type: e.target.type });
    // Convert numCards to number
    const finalValue = name === 'numCards' ? (value ? parseInt(value, 10) : undefined) : value;
    setGammaOptions((prev: any) => {
      console.log('[setGammaOptions] prev:', prev, 'new:', { ...prev, [name]: finalValue });
      return { ...prev, [name]: finalValue };
    });
  };

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

      // Custom validation: Keywords required if no Veille selected
      if (!selectedVeilleId && !validatedData.keywords) {
        setFormError('Keywords are required unless a Watch is selected.');
        return;
      }

      // Build Gamma options from state (controlled inputs)
      const finalGammaOptions: any = {
        ...gammaOptions,
        // Handle nested textOptions and imageOptions
        textOptions: gammaOptions.language ? { language: gammaOptions.language } : undefined,
        imageOptions: gammaOptions.imageModel ? { model: gammaOptions.imageModel } : undefined,
      };

      // Clean up temporary fields used for UI
      delete finalGammaOptions.language;
      delete finalGammaOptions.imageModel;

      // Remove undefined/empty values
      Object.keys(finalGammaOptions).forEach(key => {
        if (finalGammaOptions[key] === undefined || finalGammaOptions[key] === '' || finalGammaOptions[key] === null) {
          delete finalGammaOptions[key];
        }
      });

      const payload = {
        ...validatedData,
        keywords: validatedData.keywords ? validatedData.keywords.split(',').map(k => k.trim()) : [],
        gammaOptions: finalGammaOptions,
        veilleId: selectedVeilleId || undefined,
      };

      console.log('[NewRunPage] Submitting run with payload:', JSON.stringify(payload, null, 2));

      mutation.mutate(payload);
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
  const selectedVeille = veilles?.find((v: any) => v.id === selectedVeilleId);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-3xl font-bold mb-6">New Run</h1>
      {!canLaunch && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
          Creating runs requires TAVILY_API_KEY and OPENAI_API_KEY. Please configure them.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Context Selection Section */}
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h2 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Context (Optional)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-indigo-800 mb-1">Client</label>
              <select
                value={selectedClientId}
                onChange={handleClientChange}
                className="block w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">-- Select Client --</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-800 mb-1">Watch (Veille)</label>
              <select
                value={selectedVeilleId}
                onChange={handleVeilleChange}
                disabled={!selectedClientId}
                className="block w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">-- Select Watch --</option>
                {veilles?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-indigo-600 mt-2">
            Selecting a watch will load its Gamma configuration and use the client's profile for context.
          </p>
        </div>

        {selectedVeilleId ? (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Using Watch Configuration</h3>
            <p className="text-sm text-gray-600">
              <strong>Keywords:</strong> {selectedVeille?.keywords?.join(', ') || 'None'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              These keywords are defined in the Watch settings and will be combined with the client context.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">Keywords (comma-separated) <span className="text-red-600">*</span></label>
            <input
              required
              aria-invalid={!!formError}
              type="text"
              id="keywords"
              name="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className={`mt-1 block w-full rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${formError ? 'border-red-500' : 'border border-gray-300'}`}
            />
            {formError && (
              <p className="mt-1 text-sm text-red-600">{formError}</p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="daysBack" className="block text-sm font-medium text-gray-700">Days Back ({'7'} - {'30'})</label>
          <input type="range" id="daysBack" name="daysBack" min="7" max="30" defaultValue="30" className="mt-1 block w-full" />
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
              <select id="format" name="format" value={gammaOptions.format || 'presentation'} onChange={handleGammaOptionChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="presentation">Presentation</option>
                <option value="webpage">Webpage</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div>
              <label htmlFor="textMode" className="block text-sm font-medium text-gray-700">Text Mode</label>
              <select id="textMode" name="textMode" value={gammaOptions.textMode || 'preserve'} onChange={handleGammaOptionChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="preserve">Preserve</option>
                <option value="generate">Generate</option>
                <option value="condense">Condense</option>
              </select>
            </div>
            <div>
              <label htmlFor="exportAs" className="block text-sm font-medium text-gray-700">Export As</label>
              <select id="exportAs" name="exportAs" value={gammaOptions.exportAs || ''} onChange={handleGammaOptionChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="">Default</option>
                <option value="pdf">PDF</option>
                <option value="pptx">PPTX</option>
              </select>
            </div>
            <div>
              <label htmlFor="cardSplit" className="block text-sm font-medium text-gray-700">Card Split</label>
              <select id="cardSplit" name="cardSplit" value={gammaOptions.cardSplit || 'auto'} onChange={handleGammaOptionChange} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3">
                <option value="auto">Auto</option>
                <option value="inputTextBreaks">Input Text Breaks</option>
              </select>
            </div>
            <div>
              <label htmlFor="numCards" className="block text-sm font-medium text-gray-700">Number of Cards</label>
              <input type="number" id="numCards" name="numCards" value={gammaOptions.numCards || ''} onChange={handleGammaOptionChange} min={1} max={75} placeholder="e.g., 10" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="themeId" className="block text-sm font-medium text-gray-700">Theme ID</label>
              <input type="text" id="themeId" name="themeId" value={gammaOptions.themeId || ''} onChange={handleGammaOptionChange} placeholder="optional" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="folderIds" className="block text-sm font-medium text-gray-700">Folder IDs (comma‑separated)</label>
              <input type="text" id="folderIds" name="folderIds" value={gammaOptions.folderIds ? (Array.isArray(gammaOptions.folderIds) ? gammaOptions.folderIds.join(', ') : gammaOptions.folderIds) : ''} onChange={handleGammaOptionChange} placeholder="abc123, def456" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">Additional Instructions</label>
              <textarea id="additionalInstructions" name="additionalInstructions" value={gammaOptions.additionalInstructions || ''} onChange={handleGammaOptionChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" placeholder="e.g., Make titles catchy"></textarea>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700">Text Language</label>
              <input type="text" id="language" name="language" value={gammaOptions.textOptions?.language || gammaOptions.language || ''} onChange={(e) => setGammaOptions((prev: any) => ({ ...prev, language: e.target.value }))} placeholder="e.g., en, fr" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
            <div>
              <label htmlFor="imageModel" className="block text-sm font-medium text-gray-700">Image Model</label>
              <input type="text" id="imageModel" name="imageModel" value={gammaOptions.imageOptions?.model || gammaOptions.imageModel || ''} onChange={(e) => setGammaOptions((prev: any) => ({ ...prev, imageModel: e.target.value }))} placeholder="e.g., dalle-beta" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
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
