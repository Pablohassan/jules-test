import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MoreVertical, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ClientsPage() {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);

    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/clients`);
            if (!res.ok) throw new Error('Failed to fetch clients');
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_URL}/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create client');
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            setIsModalOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_URL}/clients/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update client');
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            setIsModalOpen(false);
            setEditingClient(null);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData);

        if (editingClient) {
            updateMutation.mutate({ ...data, id: editingClient.id });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                    <p className="text-gray-500 mt-1">Manage your client portfolio and their specific needs.</p>
                </div>
                <button
                    onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Client
                </button>
            </div>

            {/* Client List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search clients..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading clients...</div>
                ) : clients?.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No clients yet</h3>
                        <p className="mt-1">Get started by adding your first client.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Sector</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3">Contact</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {clients?.map((client: any) => (
                                <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                            {client.sector || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{client.size || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3 h-3" />
                                            {client.email}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => { setEditingClient(client); setIsModalOpen(true); }}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingClient ? 'Edit Client' : 'New Client'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                <input
                                    name="name"
                                    defaultValue={editingClient?.name}
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                                    <input
                                        name="sector"
                                        defaultValue={editingClient?.sector}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                                    <select
                                        name="size"
                                        defaultValue={editingClient?.size || 'TPE'}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="TPE">TPE</option>
                                        <option value="PME">PME</option>
                                        <option value="ETI">ETI</option>
                                        <option value="GE">GE</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Contact</label>
                                <input
                                    name="email"
                                    type="email"
                                    defaultValue={editingClient?.email}
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Context</label>
                                <textarea
                                    name="description"
                                    defaultValue={editingClient?.description}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                                    placeholder="Brief description of the company's activity and focus..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
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
                                    {editingClient ? 'Save Changes' : 'Create Client'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function Users(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
