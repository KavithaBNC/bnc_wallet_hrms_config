import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyCompany, error: authError, clearError } = useAuthStore();

  // Step state: 1 = company verification, 2 = credentials
  const [step, setStep] = useState<1 | 2>(1);
  const [companyInput, setCompanyInput] = useState('');
  const [verifiedCompany, setVerifiedCompany] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [loginError, setLoginError] = useState('');

  const usernameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  // Focus first input on step change
  useEffect(() => {
    if (step === 1) {
      companyRef.current?.focus();
    } else {
      usernameRef.current?.focus();
    }
  }, [step]);

  // Step 1: Verify company via API
  const handleVerifyCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError('');
    clearError();

    const trimmed = companyInput.trim();
    if (!trimmed) {
      setCompanyError('Please enter your company name or code.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await verifyCompany(trimmed);
      if (result.success !== true) {
        setCompanyError(result.message || 'Company not found. Please check the name or code.');
        return;
      }
      setVerifiedCompany(result.company?.name || trimmed);
      setStep(2);
    } catch (error: any) {
      const data = error.response?.data;
      let msg = 'Company not found. Please check the name or code.';
      if (!error.response) {
        msg = 'Cannot connect to server. Please check your connection.';
      } else if (data) {
        if (typeof data.message === 'string') msg = data.message;
        else if (data.error?.message) msg = data.error.message;
        else if (typeof data.detail === 'string') msg = data.detail;
      }
      setCompanyError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Login with credentials
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    clearError();

    if (!username.trim()) {
      setLoginError('Please enter your username or email.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    try {
      setIsLoading(true);
      await login({
        company_name_or_code: verifiedCompany,
        username: username.trim(),
        password,
      });

      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error: any) {
      const data = error.response?.data;
      let msg = 'Login failed. Please check your credentials and try again.';
      if (!error.response) {
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
          msg = 'Cannot connect to server. Please check your connection.';
        }
      } else if (data) {
        if (typeof data.message === 'string') msg = data.message;
        else if (data.error?.message) msg = data.error.message;
        else if (typeof data.detail === 'string') msg = data.detail;
      }
      clearError();
      setLoginError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setLoginError('');
    setUsername('');
    setPassword('');
    clearError();
  };

  const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  return (
    <div className="login-root">
      <div className="floating-bg">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
      </div>

      <div className={`login-card ${step === 2 ? 'step-2' : ''}`}>
        {/* Welcome branding section */}
        <div className="welcome-section hidden md:flex">
          <div className="welcome-content">
            {step === 1 ? (
              <div className="animate-fadeInScale flex flex-col items-center">
                <h2 className="text-5xl font-black mb-2 tracking-tighter">HRMS 2026</h2>
                <div className="h-1.5 w-16 bg-white/20 mb-8 rounded-full"></div>
                <p className="text-lg opacity-80 leading-relaxed max-w-[280px]">
                  Connecting teams and empowering performance thru modern HR management.
                </p>
                <div className="mt-12 w-full max-w-[240px]">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Security</p>
                      <p className="text-xs font-bold">End-to-End Encrypted</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-fadeInScale flex flex-col items-center">
                <div className="px-4 py-1.5 bg-white/10 rounded-full mb-6">
                  <span className="text-[10px] font-black tracking-widest uppercase opacity-60">Verified Identity</span>
                </div>
                <h2 className="text-6xl font-black mb-2 tracking-tighter leading-none text-white">WELCOME</h2>
                <h3 className="text-3xl font-bold opacity-60 italic mb-10 truncate max-w-full">{verifiedCompany}</h3>
                <div className="h-1.5 w-20 bg-white/40 mb-10 rounded-full"></div>
                <p className="text-sm opacity-80 leading-relaxed max-w-[300px]">
                  Verification complete. Provide your workspace credentials to enter your portal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Form section */}
        <div className="form-section">
          <div className="form-content-wrapper">
            {/* Header with Back Button */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-1">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm bg-white"
                    title="Back to company"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    {step === 1 ? 'Welcome Back' : 'Log In'}
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    {step === 1
                      ? 'Verify your company identity'
                      : 'Access your employee dashboard'}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              {/* Global auth error from store */}
              {authError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-shake">
                  <p className="text-red-800 text-sm font-bold">{authError}</p>
                </div>
              )}

              {/* Step 1: Company Verification */}
              {step === 1 ? (
                <div className="animate-fadeInScale">
                  <form onSubmit={handleVerifyCompany}>
                    {companyError && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl animate-shake">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-red-800 text-sm">{companyError}</p>
                        </div>
                      </div>
                    )}

                    <div className="mb-6">
                      <label htmlFor="company" className="block text-gray-700 text-sm font-semibold mb-2 ml-1">
                        Company Name / Code
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <input
                          ref={companyRef}
                          type="text"
                          id="company"
                          value={companyInput}
                          onChange={(e) => {
                            setCompanyInput(e.target.value);
                            setCompanyError('');
                          }}
                          className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 text-gray-900 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all custom-input ${companyError ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                            }`}
                          placeholder="e.g. BNC Motors"
                          disabled={isLoading}
                          autoComplete="organization"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full text-white font-bold py-4 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                      style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                    >
                      {isLoading ? (
                        <><LoadingSpinner />Verifying...</>
                      ) : (
                        <>Continue<svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Step 2: Credentials */
                <div className="animate-fadeInScale">
                  <form onSubmit={handleLogin}>
                    {loginError && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-red-800 text-sm">{loginError}</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label htmlFor="username" className="block text-gray-700 text-sm font-semibold mb-2 ml-1">
                        Username / Email
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          ref={usernameRef}
                          type="text"
                          id="username"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setLoginError('');
                          }}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all custom-input"
                          placeholder="name@company.com"
                          disabled={isLoading}
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    <div className="mb-6">
                      <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2 ml-1">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setLoginError('');
                          }}
                          className="w-full pl-12 pr-12 py-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all custom-input"
                          placeholder="••••••••"
                          disabled={isLoading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6 px-1">
                      <label className="flex items-center cursor-pointer group">
                        <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition" />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition font-medium">Remember me</span>
                      </label>
                      <Link to="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                        Forgot password?
                      </Link>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full text-white font-bold py-4 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                      style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                    >
                      {isLoading ? <><LoadingSpinner />Signing In...</> : 'Log In'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="mt-auto pt-8 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">HRMS Portal 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
