import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate   = useNavigate();

  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [password2, setPassword2]   = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (password !== password2) {
      setError('Hasła nie są zgodne.');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);

    if (error) {
      if (error.includes('already registered')) {
        setError('Ten e-mail jest już zarejestrowany. Zaloguj się.');
      } else {
        setError(error);
      }
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Konto zostało utworzone!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Sprawdź skrzynkę e-mail i kliknij link aktywacyjny, a następnie zaloguj się.
            </p>
            <button
              onClick={() => navigate('/logowanie')}
              className="w-full bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-800 transition-colors"
            >
              Przejdź do logowania
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-700 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">F</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fermly</h1>
          <p className="text-gray-500 text-sm mt-1">Utwórz bezpłatne konto</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imię (opcjonalnie)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Jan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="twoj@email.pl"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="min. 6 znaków"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Powtórz hasło</label>
              <input
                type="password"
                required
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-800 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Tworzenie konta…' : 'Utwórz konto'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-500">
            Masz już konto?{' '}
            <Link to="/logowanie" className="text-green-700 font-medium hover:underline">
              Zaloguj się
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Rejestrując się akceptujesz regulamin usługi fermly.pl
        </p>
      </div>
    </div>
  );
}
