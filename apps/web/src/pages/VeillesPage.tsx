import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MoreVertical, Play, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function VeillesPage() {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVeille, setEditingVeille] = useState<any>(null);

    const { data: veilles, isLoading } = useQuery({
        queryKey: ['veilles'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/veilles`);
            if (!res.ok) throw new Error('Failed to fetch veilles');
            return res.json();
        }
    });

    const { data: clients } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/clients`);
            if (!res.ok) throw new Error('Failed to fetch clients');
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_URL}/veilles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create veille');
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['veilles'] });
            setIsModalOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_URL}/veilles/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update veille');
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['veilles'] });
            setIsModalOpen(false);
            setEditingVeille(null);
        }
    });

    const runMutation = useMutation({
        mutationFn: async (veilleId: string) => {
            const veille = veilles.find((v: any) => v.id === veilleId);
            if (!veille) throw new Error('Veille not found');

            const res = await fetch(`${API_URL}/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keywords: veille.keywords,
                    daysBack: 30,
                    maxResults: 10,
                    veilleId: veille.id,
                    gammaOptions: veille.gammaOptions || {
                        format: 'webpage',
                        exportAs: 'pdf'
                    }
                })
            });
            if (!res.ok) throw new Error('Failed to start run');
            return res.json();
        },
        onSuccess: () => {
            alert('Run started successfully!');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data: any = Object.fromEntries(formData);

        // Parse keywords
        if (typeof data.keywords === 'string') {
            data.keywords = data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
        }
        data.enabled = data.enabled === 'on';

        // Construct Gamma Options
        const gammaOptions: any = {
            format: data.format || undefined,
            textMode: data.textMode || undefined,
            exportAs: data.exportAs || undefined,
            cardSplit: data.cardSplit || undefined,
            numCards: data.numCards ? parseInt(data.numCards, 10) : undefined,
            themeId: data.themeId || undefined,
            folderIds: data.folderIds ? data.folderIds.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
            additionalInstructions: data.additionalInstructions || undefined,
            textOptions: data.language ? { language: data.language } : undefined,
            imageOptions: data.imageModel ? { model: data.imageModel } : undefined,
        };
        data.gammaOptions = gammaOptions;

        // Cleanup flat fields that are now in gammaOptions
        delete data.format;
        delete data.textMode;
        delete data.exportAs;
        delete data.cardSplit;
        delete data.numCards;
        delete data.themeId;
        delete data.folderIds;
        delete data.additionalInstructions;
        delete data.language;
        delete data.imageModel;

        if (editingVeille) {
            updateMutation.mutate({ ...data, id: editingVeille.id });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Veilles</h1>
                    <p className="text-gray-500 mt-1">Configure and schedule automated watches.</p>
                </div>
                <button
                    onClick={() => { setEditingVeille(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Watch
                </button>
            </div>

            {/* Veille List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search watches..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading watches...</div>
                ) : veilles?.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No watches configured</h3>
                        <p className="mt-1">Create a watch to start monitoring topics.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Client</th>
                                <th className="px-6 py-3">Keywords</th>
                                <th className="px-6 py-3">Format</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {veilles?.map((veille: any) => (
                                <tr key={veille.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-gray-900">{veille.name}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {veille.client?.name || 'Unknown Client'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                                        {veille.keywords.join(', ')}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {veille.gammaOptions?.format || 'Default'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {veille.enabled ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                                <CheckCircle className="w-3 h-3" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                <XCircle className="w-3 h-3" /> Paused
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => runMutation.mutate(veille.id)}
                                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                                            title="Run Now"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingVeille(veille); setIsModalOpen(true); }}
                                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8"
                    >
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingVeille ? 'Edit Watch' : 'New Watch'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                                    <select
                                        name="clientId"
                                        defaultValue={editingVeille?.clientId}
                                        required
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="">Select a client...</option>
                                        {clients?.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Watch Name</label>
                                    <input
                                        name="name"
                                        defaultValue={editingVeille?.name}
                                        required
                                        placeholder="e.g. Tech Trends 2024"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (optional)</label>
                                    <textarea
                                        name="keywords"
                                        defaultValue={editingVeille?.keywords?.join(', ')}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                                        placeholder="Leave empty to use Client Context (Sector, Description)"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        If empty, the search will be based on the Client's sector and description.
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Gamma Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
                                        <select name="format" defaultValue={editingVeille?.gammaOptions?.format || 'webpage'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                                            <option value="presentation">Presentation</option>
                                            <option value="document">Document</option>
                                            <option value="webpage">Webpage</option>
                                            <option value="social">Social</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Text Mode</label>
                                        <select name="textMode" defaultValue={editingVeille?.gammaOptions?.textMode || 'generate'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                                            <option value="preserve">Preserve</option>
                                            <option value="generate">Generate</option>
                                            <option value="condense">Condense</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Export As</label>
                                        <select name="exportAs" defaultValue={editingVeille?.gammaOptions?.exportAs || 'pdf'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                                            <option value="">Default</option>
                                            <option value="pdf">PDF</option>
                                            <option value="pptx">PPTX</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Card Split</label>
                                        <select name="cardSplit" defaultValue={editingVeille?.gammaOptions?.cardSplit || 'auto'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                                            <option value="auto">Auto</option>
                                            <option value="inputTextBreaks">Input Text Breaks</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Num Cards</label>
                                        <input type="number" name="numCards" defaultValue={editingVeille?.gammaOptions?.numCards} min={1} max={75} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Theme ID</label>
                                        <input type="text" name="themeId" defaultValue={editingVeille?.gammaOptions?.themeId} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                                        <input type="text" name="language" defaultValue={editingVeille?.gammaOptions?.textOptions?.language} placeholder="e.g. fr" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Image Model</label>
                                        <input type="text" name="imageModel" defaultValue={editingVeille?.gammaOptions?.imageOptions?.model} placeholder="e.g. dalle-beta" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Additional Instructions</label>
                                        <textarea name="additionalInstructions" defaultValue={editingVeille?.gammaOptions?.additionalInstructions} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    name="enabled"
                                    id="enabled"
                                    defaultChecked={editingVeille?.enabled ?? true}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">Enable automated scheduling</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {editingVeille ? 'Save Changes' : 'Create Watch'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
