import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/authStore';
import organizationService, { Organization } from '../services/organization.service';

// Organization mode: 'select' | 'default'
type OrganizationMode = 'select' | 'default';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  organizationId: z.string().uuid('Invalid organization ID').optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, error: authError, clearError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orgMode, setOrgMode] = useState<OrganizationMode>('default');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Fetch organizations when mode is 'select'
  // Note: This will fail for public registration (requires auth)
  // Falls back to manual organization ID entry
  useEffect(() => {
    if (orgMode === 'select') {
      fetchOrganizations();
    }
  }, [orgMode]);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      // Note: This requires authentication, so for public registration
      // we might need a public endpoint or handle this differently
      // For now, we'll show a message that organizations can be selected after login
      // Or we can create a public endpoint to list organizations
      const response = await organizationService.getAll(1, 100);
      setOrganizations(response.organizations);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      // If it fails (e.g., requires auth), we'll just show an empty list
      // and allow manual entry of organization ID
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleModeChange = (mode: OrganizationMode) => {
    setOrgMode(mode);
    // Clear organization-related fields when switching modes
    resetField('organizationId');
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      clearError();

      // Prepare registration data based on mode
      const registrationData: any = {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      };

      if (orgMode === 'select' && data.organizationId) {
        registrationData.organizationId = data.organizationId;
      }
      // If mode is 'default', send nothing (backend will use default org)

      await registerUser(registrationData);
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      // Error is handled by the store
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md">
          <div className="bg-white shadow-2xl rounded-2xl px-8 py-10 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
            <p className="text-gray-600 mb-6">
              Please check your email to verify your account.
            </p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white shadow-2xl rounded-2xl px-8 py-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Join HRMS Portal 2026</p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{authError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Organization Selection Mode */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-gray-700 text-sm font-semibold mb-3">
                Organization
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="orgMode"
                    value="default"
                    checked={orgMode === 'default'}
                    onChange={() => handleModeChange('default')}
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-700">Use default organization</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="orgMode"
                    value="select"
                    checked={orgMode === 'select'}
                    onChange={() => handleModeChange('select')}
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-700">Join existing organization</span>
                </label>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                To create a new organization, please contact HRMS Administrator.
              </p>
            </div>

            {/* Organization Selection */}
            {orgMode === 'select' && (
              <div className="mb-6">
                <label htmlFor="organizationId" className="block text-gray-700 text-sm font-semibold mb-2">
                  Select Organization
                </label>
                {loadingOrgs ? (
                  <div className="text-sm text-gray-500">Loading organizations...</div>
                ) : organizations.length > 0 ? (
                  <select
                    {...register('organizationId')}
                    id="organizationId"
                    className={`w-full h-10 px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      errors.organizationId ? 'border-red-500 focus:border-red-500' : 'border-black'
                    }`}
                    disabled={isLoading}
                  >
                    <option value="">Select an organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} {org.legalName && `(${org.legalName})`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      {...register('organizationId')}
                      type="text"
                      id="organizationId"
                      placeholder="Enter Organization ID (UUID)"
                      className={`w-full h-10 px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                        errors.organizationId ? 'border-red-500 focus:border-red-500' : 'border-black'
                      }`}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      Enter the organization ID provided by your administrator
                    </p>
                  </div>
                )}
                {errors.organizationId && (
                  <p className="mt-1 text-xs text-red-600">{errors.organizationId.message}</p>
                )}
              </div>
            )}


            {/* Personal Information */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="firstName" className="block text-gray-700 text-sm font-semibold mb-2">
                    First Name
                  </label>
                  <input
                    {...register('firstName')}
                    type="text"
                    id="firstName"
                    className={`w-full h-10 px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      errors.firstName ? 'border-red-500 focus:border-red-500' : 'border-black'
                    }`}
                    placeholder="John"
                    disabled={isLoading}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-gray-700 text-sm font-semibold mb-2">
                    Last Name
                  </label>
                  <input
                    {...register('lastName')}
                    type="text"
                    id="lastName"
                    className={`w-full h-10 px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      errors.lastName ? 'border-red-500 focus:border-red-500' : 'border-black'
                    }`}
                    placeholder="Doe"
                    disabled={isLoading}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  className={`w-full h-10 px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                    errors.email ? 'border-red-500 focus:border-red-500' : 'border-black'
                  }`}
                  placeholder="john.doe@example.com"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">
                  Password
                </label>
                <input
                  {...register('password')}
                  type="password"
                  id="password"
                  className={`w-full px-4 py-3 bg-white text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                    errors.password ? 'border-red-500' : 'border-black'
                  }`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Password must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign In
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Home
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-8">
          HRMS Portal 2026 - Dynamic Organization Management
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
