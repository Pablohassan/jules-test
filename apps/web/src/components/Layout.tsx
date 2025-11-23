import { Link, useLocation, Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeatures, disconnectGoogle } from '../api';
import { Home, Users, Eye, Plus, LogOut, Activity } from 'lucide-react';

export default function Layout() {
    const location = useLocation();
    const qc = useQueryClient();
    const { data: features } = useQuery({ queryKey: ['features'], queryFn: getFeatures });

    async function onDisconnect() {
        try {
            await disconnectGoogle();
            await qc.invalidateQueries({ queryKey: ['features'] });
        } catch (e) {
            // no-op
        }
    }

    const navItems = [
        { path: '/', label: 'Dashboard', icon: Home },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/veilles', label: 'Veilles', icon: Eye },
    ];

    return (
        <div className="flex h-screen bg-[#f3f4f6] text-gray-900 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Activity className="w-6 h-6" />
                        <span className="text-xl font-bold tracking-tight">Veille AI</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100 space-y-4">
                    <Link
                        to="/new"
                        className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${features?.searchAvailable && features?.summarizeAvailable
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow'
                            : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        New Run
                    </Link>

                    {features?.googleConnected ? (
                        <div className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                            <span className="text-xs font-medium text-green-700">Google Connected</span>
                            <button
                                onClick={onDisconnect}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Disconnect"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <a
                            href="/api/auth/google"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            Connect Google
                        </a>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto px-8 py-10">
                    {features && (!features.searchAvailable || !features.summarizeAvailable) && (
                        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                            <strong>Configuration Missing:</strong> {!features.searchAvailable && 'TAVILY_API_KEY '}{!features.summarizeAvailable && 'OPENAI_API_KEY'}.
                        </div>
                    )}
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
