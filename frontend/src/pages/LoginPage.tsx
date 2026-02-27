import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: authError, clearError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      clearError();
      await login(data);

      // Redirect to the page they were trying to access, or dashboard
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      // Error is handled by the store
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="w-full max-w-md">
        <div className="bg-white shadow-lg rounded-2xl px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your HRMS account</p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{authError}</p>
              {(authError.includes('Cannot connect') || authError.includes('timeout')) && (
                <p className="text-red-700 text-xs mt-2">
                  From project folder run: <code className="bg-red-100 px-1 rounded">cd backend && npm run dev</code>
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-6">
              <label
                htmlFor="email"
                className="block text-gray-800 text-sm font-medium mb-2"
              >
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className={`w-full px-4 py-3 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ${
                  errors.email ? 'border-red-500 focus:border-red-500' : 'border-gray-300'
                }`}
                placeholder="name@company.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-gray-800 text-sm font-medium mb-2"
              >
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                id="password"
                className={`w-full px-4 py-3 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition ${
                  errors.password ? 'border-red-500 focus:border-red-500' : 'border-gray-300'
                }`}
                placeholder="********"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                <span className="text-sm text-gray-800">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium"
                style={{ color: '#5E3BEE' }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full text-white font-semibold py-3 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = 'rgb(29, 78, 216)')}
              onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)')}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold" style={{ color: '#5E3BEE' }}>
                Sign Up
              </Link>
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              HRMS Portal 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
