import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import employeeService, { type Employee } from '../services/employee.service';
import AppHeader from '../components/layout/AppHeader';
import configuratorDataService from '../services/configurator-data.service';
import { authService } from '../services/auth.service';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loadUser, logout, updateProfile } = useAuthStore();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Form state
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordFormData, setPasswordFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load user & full employee data
  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (user?.employee?.id) {
      setLoadingEmployee(true);
      employeeService.getById(user.employee.id)
        .then((emp) => setEmployee(emp))
        .catch(() => {/* fallback to auth user data */})
        .finally(() => setLoadingEmployee(false));
    }
  }, [user?.employee?.id]);

  useEffect(() => {
    if (user?.employee) {
      setEditFormData({
        firstName: user.employee.firstName || '',
        lastName: user.employee.lastName || '',
        phone: (user.employee as { phone?: string }).phone || '',
      });
    }
  }, [user]);

  // ─── Handlers ───
  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleEditProfile = () => {
    setErrors({}); setSuccessMessage(null);
    if (employee) {
      setEditFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        phone: employee.phone || '',
      });
    }
    setShowEditModal(true);
  };

  const handleChangePassword = () => {
    setErrors({}); setSuccessMessage(null);
    setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrors({}); setSuccessMessage(null);
    if (!editFormData.firstName.trim()) { setErrors({ firstName: 'First name is required' }); return; }
    if (!editFormData.lastName.trim()) { setErrors({ lastName: 'Last name is required' }); return; }
    try {
      await updateProfile({
        firstName: editFormData.firstName.trim(),
        lastName: editFormData.lastName.trim(),
        phone: editFormData.phone.trim() || undefined,
      });
      setSuccessMessage('Profile updated successfully!');
      setShowEditModal(false);
      // Refresh employee data
      if (user?.employee?.id) {
        const emp = await employeeService.getById(user.employee.id);
        setEmployee(emp);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.message || 'Failed to update profile' });
    }
  };

  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage(null);

    // Basic field validation
    if (!passwordFormData.currentPassword) { setErrors({ currentPassword: 'Current password is required' }); return; }
    if (!passwordFormData.newPassword) { setErrors({ newPassword: 'New password is required' }); return; }
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) { setErrors({ confirmPassword: 'Passwords do not match' }); return; }

    setPasswordSubmitting(true);
    try {
      const userEmail = user?.email;
      if (!userEmail) throw new Error('User email not found');

      // Step 1: Fetch current plain password from Configurator
      const configUser = await configuratorDataService.getConfiguratorUserByEmail(userEmail);
      if (!configUser) throw new Error('User not found in Configurator');

      // Step 2: Compare current password
      if (configUser.password !== passwordFormData.currentPassword) {
        setErrors({ currentPassword: 'Password wrong' });
        setPasswordSubmitting(false);
        return;
      }

      // Step 3: Call Configurator reset-password API
      const encryptedPassword = await configuratorDataService.resetConfiguratorUserPassword(
        configUser.user_id,
        passwordFormData.newPassword
      );

      // Step 4: Sync encrypted password to HRMS users.password_hash
      await authService.syncPasswordHash(encryptedPassword);

      setSuccessMessage('Password changed successfully!');
      setShowPasswordModal(false);
      setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to change password';
      setErrors({ submit: msg });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // ─── Derived data ───
  const firstName = employee?.firstName || user?.employee?.firstName || '';
  const lastName = employee?.lastName || user?.employee?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'User';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'U';
  const email = employee?.email || user?.email || '';
  const role = user?.role?.replace(/_/g, ' ') || 'User';
  const empCode = employee?.employeeCode || user?.employee?.employeeCode || 'N/A';
  const department = employee?.department?.name || user?.employee?.department?.name || 'N/A';
  const position = employee?.position?.title || user?.employee?.position?.title || 'N/A';
  const organization = employee?.organization?.name || user?.employee?.organization?.name || 'N/A';
  const phone = employee?.phone || 'N/A';
  const location = employee?.location?.name || employee?.workLocation || 'N/A';
  const joinDate = employee?.dateOfJoining ? formatDate(employee.dateOfJoining) : 'N/A';
  const profilePic = employee?.profilePictureUrl || user?.employee?.profilePictureUrl;
  const isVerified = user?.isEmailVerified;
  const empStatus = employee?.employeeStatus || 'ACTIVE';
  const manager = employee?.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : 'N/A';
  const lastLogin = employee?.user?.lastLoginAt ? formatDate(employee.user.lastLoginAt) : 'N/A';
  const entity = employee?.entity?.name || 'N/A';
  const shift = employee?.shift?.name || 'N/A';
  const empType = employee?.employmentType?.replace(/_/g, ' ') || 'N/A';

  // Status badge
  const statusConfig = getStatusConfig(empStatus);
  const roleColor = getRoleColor(user?.role || '');

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
      <AppHeader title="My Profile" onLogout={handleLogout} />

      <main className="flex-1 min-h-0 overflow-auto w-full p-4 sm:p-6 lg:p-8 animate-fade-in-up">
        <div className="max-w-7xl mx-auto space-y-8 pb-10">

          {/* ═══════════════ HEADER BANNER ═══════════════ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group">

            {/* Background Cover */}
            <div className="h-44 sm:h-48 animate-gradient-bg relative overflow-hidden transition-all duration-500 group-hover:shadow-[inset_0_0_100px_rgba(0,0,0,0.1)]">
              {/* Animated floating decorations */}
              <div className="absolute top-4 right-10 w-24 h-24 rounded-full bg-white/10 animate-float" />
              <div className="absolute top-8 right-32 w-16 h-16 rounded-full bg-white/5 animate-float-slow" />
              <div className="absolute bottom-6 left-16 w-20 h-20 rounded-full bg-white/5 animate-float-slow" style={{ animationDelay: '1s' }} />
              <div className="absolute top-2 left-1/3 w-12 h-12 rounded-full bg-white/10 animate-pulse-glow" />
              {/* Name & Badges placed perfectly inside the banner */}
              <div className="absolute bottom-0 w-full px-6 sm:px-8 pb-5 flex flex-col sm:flex-row sm:items-end gap-5 z-10">
                {/* Spacer padding to strictly align text past the avatar on Desktop (Avatar + Box Padding ~ 140px) */}
                <div className="w-24 h-0 sm:w-[140px] shrink-0 hidden sm:block"></div>

                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm">{fullName}</h1>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-sm">
                      {role}
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 bg-blue-500 border border-blue-400 text-white shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom White Section - Flex Flow avoids absolute overlapping issues */}
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col sm:flex-row gap-5 sm:gap-6">

              {/* Avatar correctly positioned using negative margin */}
              <div className="-mt-12 sm:-mt-16 z-20 shrink-0 self-start">
                <div className="p-1 sm:p-1.5 bg-white rounded-full inline-block shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_6px_-1px_rgba(0,0,0,0.1)]">
                  <div className="relative">
                    {profilePic ? (
                      <img src={profilePic} alt={fullName} className="h-24 w-24 sm:h-[120px] sm:w-[120px] rounded-full border border-gray-100 object-cover bg-gray-50" />
                    ) : (
                      <div className="h-24 w-24 sm:h-[120px] sm:w-[120px] rounded-full bg-slate-50 text-blue-600 border border-gray-100 flex items-center justify-center">
                        <span className="text-3xl sm:text-5xl font-bold">{initials}</span>
                      </div>
                    )}
                    {isVerified && (
                      <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-blue-500 text-white rounded-full p-1.5 border-2 border-white shadow-sm" title="Email Verified">
                        {verifiedIcon}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Flex container for the Text and Actions */}
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 sm:pt-4">

                {/* Position and Department Text */}
                <div className="text-sm font-medium text-gray-500 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-800 font-extrabold">{position === 'N/A' || !position ? 'N/A' : position}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{department === 'N/A' || !department ? 'N/A' : department}</span>
                </div>

                {/* Action Buttons perfectly aligned into the flow */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleEditProfile}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors duration-200"
                  >
                    {editIcon} <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={handleChangePassword}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm transition-colors duration-200"
                  >
                    {lockIcon} <span>Security</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* ═══════════════ DETAILED INFO GRID ═══════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

            {/* Left Column - Personal Info (Span 4) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6 sm:space-y-8">
              <DetailCard title="Personal Information" icon={userIcon} iconColor="bg-blue-100 text-blue-600">
                {loadingEmployee ? <LoadingSkeleton /> : (
                  <div className="space-y-6">
                    <DetailField icon={mailIcon} iconBg="bg-blue-50 text-blue-600" label="Email Address" value={email} />
                    <DetailField icon={phoneIcon} iconBg="bg-blue-50 text-blue-600" label="Phone Number" value={phone} />
                    <DetailField icon={locationIcon} iconBg="bg-amber-50 text-amber-600" label="Location" value={location} />
                    <DetailField icon={calendarIcon} iconBg="bg-blue-50 text-blue-600" label="Join Date" value={joinDate} />
                  </div>
                )}
              </DetailCard>

              {/* Quick Navigation Card */}
              <DetailCard title="Navigation" icon={dashboardIcon} iconColor="bg-blue-100 text-blue-600">
                <Link
                  to="/dashboard"
                  className="group block"
                >
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-white hover:border-blue-100 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      {dashboardIcon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Go to Dashboard</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Return to your home workspace</p>
                    </div>
                  </div>
                </Link>
              </DetailCard>
            </div>

            {/* Right Column - Work & Account Info (Span 8) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6 sm:space-y-8">
              <DetailCard title="Employment Details" icon={briefcaseIcon} iconColor="bg-blue-100 text-blue-600">
                {loadingEmployee ? <LoadingSkeleton /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                    <DetailField icon={idCardIcon} iconBg="bg-gray-100 text-gray-600" label="Employee ID" value={empCode} mono />
                    <DetailField icon={briefcaseIcon} iconBg="bg-blue-50 text-blue-600" label="Employment Type" value={empType} />
                    <DetailField icon={userIcon} iconBg="bg-blue-50 text-blue-600" label="Position" value={position} />
                    <DetailField icon={buildingIcon} iconBg="bg-blue-50 text-blue-600" label="Department" value={department} />
                    <DetailField icon={buildingIcon} iconBg="bg-blue-50 text-blue-600" label="Organization" value={organization} />
                    <DetailField icon={buildingIcon} iconBg="bg-blue-50 text-blue-600" label="Entity" value={entity} />
                  </div>
                )}
              </DetailCard>

              <DetailCard title="Account & Access Tracking" icon={shieldIcon} iconColor="bg-rose-100 text-rose-600">
                {loadingEmployee ? <LoadingSkeleton /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                    <DetailField icon={userIcon} iconBg="bg-blue-50 text-blue-600" label="Reports To" value={manager} />
                    <DetailField icon={clockIcon} iconBg="bg-amber-50 text-amber-600" label="Shift Schedule" value={shift} />
                    <DetailField icon={clockIcon} iconBg="bg-slate-100 text-slate-600" label="Last Login Activity" value={lastLogin} />

                    {/* Role & Permissions Banner */}
                    <div className="flex items-start gap-4 p-4 rounded-xl border border-rose-50 bg-rose-50/30">
                      <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                        {shieldIcon}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">System Authorization</p>
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-3 py-1 rounded-md text-xs font-bold ${roleColor}`}>
                            {role}
                          </span>
                          {isVerified && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1">
                              {verifiedIcon} Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </DetailCard>
            </div>

          </div>
        </div>
      </main>

      {/* Success toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-5 py-3 rounded-xl shadow-lg shadow-blue-200 z-50 flex items-center gap-2 text-sm font-medium animate-slide-in">
          {verifiedIcon} {successMessage}
        </div>
      )}

      {/* ═══════════════ EDIT PROFILE MODAL ═══════════════ */}
      {showEditModal && (
        <ModalOverlay onClose={() => { setShowEditModal(false); setErrors({}); }}>
          <div className="animate-gradient-bg relative overflow-hidden px-6 py-5 rounded-t-2xl">
            <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/5 animate-float" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white animate-pulse-glow">{editIcon}</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                  <p className="text-blue-100 text-xs">Update your personal information</p>
                </div>
              </div>
              <button onClick={() => { setShowEditModal(false); setErrors({}); }} className="text-white/60 hover:text-white transition-colors">
                {closeIcon}
              </button>
            </div>
          </div>
          <form onSubmit={handleEditSubmit} className="p-6">
            <div className="space-y-4">
              <FormField label="First Name" required error={errors.firstName}>
                <input
                  type="text"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                  required
                />
              </FormField>
              <FormField label="Last Name" required error={errors.lastName}>
                <input
                  type="text"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                  required
                />
              </FormField>
              <FormField label="Phone" error={errors.phone}>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                />
              </FormField>
              {errors.submit && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowEditModal(false); setErrors({}); }} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                Save Changes
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ═══════════════ CHANGE PASSWORD MODAL ═══════════════ */}
      {showPasswordModal && (
        <ModalOverlay onClose={() => { setShowPasswordModal(false); setErrors({}); setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>
          <div className="animate-gradient-bg relative overflow-hidden px-6 py-5 rounded-t-2xl">
            <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/5 animate-float" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white animate-pulse-glow">{lockIcon}</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Change Password</h2>
                  <p className="text-blue-100 text-xs">Update your account password</p>
                </div>
              </div>
              <button onClick={() => { setShowPasswordModal(false); setErrors({}); }} className="text-white/60 hover:text-white transition-colors">
                {closeIcon}
              </button>
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="p-6">
            <div className="space-y-4">
              <FormField label="Current Password" required error={errors.currentPassword}>
                <input
                  type="password"
                  value={passwordFormData.currentPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                  required
                />
              </FormField>
              <FormField label="New Password" required error={errors.newPassword} hint="Must be at least 8 characters with uppercase, lowercase, number, and special character">
                <input
                  type="password"
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                  required
                />
              </FormField>
              <FormField label="Confirm New Password" required error={errors.confirmPassword}>
                <input
                  type="password"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                  className="w-full h-10 px-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all"
                  required
                />
              </FormField>
              {errors.submit && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errors.submit}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowPasswordModal(false); setErrors({}); }} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={passwordSubmitting} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {passwordSubmitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════


function DetailCard({ title, icon, iconColor, children }: { title: string; icon: JSX.Element; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-blue-100/50 group overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
        <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      <div className="p-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function DetailField({ icon, iconBg, label, value, mono }: { icon: JSX.Element; iconBg: string; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`text-sm font-medium text-gray-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function getStatusConfig(status: string): { label: string; badge: string; badgeSolid: string; dot: string } {
  switch (status) {
    case 'ACTIVE': return { label: 'Active', badge: 'bg-blue-500/20 text-blue-100', badgeSolid: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' };
    case 'ON_LEAVE': return { label: 'On Leave', badge: 'bg-amber-500/20 text-amber-100', badgeSolid: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' };
    case 'SUSPENDED': return { label: 'Suspended', badge: 'bg-red-500/20 text-red-100', badgeSolid: 'bg-red-100 text-red-700', dot: 'bg-red-400' };
    case 'TERMINATED': case 'RESIGNED': return { label: status === 'TERMINATED' ? 'Terminated' : 'Resigned', badge: 'bg-gray-500/20 text-gray-200', badgeSolid: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
    default: return { label: status, badge: 'bg-gray-500/20 text-gray-200', badgeSolid: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };
  }
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ORG_ADMIN': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'HR_MANAGER': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'MANAGER': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

// ═══════════════════════════════════════════
// SVG Icons (inline, matching reference design)
// ═══════════════════════════════════════════

const mailIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const idCardIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);
const userIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const buildingIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);
const phoneIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const locationIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
  </svg>
);
const calendarIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const briefcaseIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const shieldIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const clockIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const editIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);
const lockIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);
const closeIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const verifiedIcon = (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);
const dashboardIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

export default ProfilePage;
