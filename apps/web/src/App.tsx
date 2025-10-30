import { Outlet, Link } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-2xl font-bold text-gray-800">Veille AI</Link>
              </div>
            </div>
            <div className="flex items-center">
              <Link to="/new" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                New Run
              </Link>
              <a href="/api/auth/google" className="ml-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                Connect Google
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default App;
