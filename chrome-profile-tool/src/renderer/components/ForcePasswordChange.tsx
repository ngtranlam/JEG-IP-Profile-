import React, { useState } from 'react';
import { AlertCircle, KeyRound, CheckCircle } from 'lucide-react';
import iegLogo from '../assets/Layer2.png';
import backgroundImage from '../assets/jeg-scaled.jpg';

interface ForcePasswordChangeProps {
  userName: string;
  onPasswordChanged: () => void;
  onCancel: () => void;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ 
  userName, 
  onPasswordChanged,
  onCancel 
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    hasLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  }>({
    hasLength: false,
    hasLower: false,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
  });

  const validatePasswordStrength = (password: string) => {
    setPasswordStrength({
      hasLength: password.length >= 8,
      hasLower: /[a-z]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    });
  };

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setNewPassword(password);
    validatePasswordStrength(password);
  };

  const isPasswordValid = () => {
    return Object.values(passwordStrength).every(v => v === true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid()) {
      setError('Password does not meet all requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.auth.forceChangePassword(userName, newPassword);
      if (result.success) {
        onPasswordChanged();
      } else {
        setError('Failed to change password');
      }
    } catch (err: any) {
      // Extract clean error message (remove Electron IPC prefix)
      let errorMsg = err.message || 'Failed to change password';
      const match = errorMsg.match(/Error: (.+)$/);
      if (match) {
        errorMsg = match[1];
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${met ? 'text-green-600' : 'text-gray-500'}`}>
      <CheckCircle className={`w-4 h-4 ${met ? 'fill-green-600' : 'fill-gray-300'}`} />
      <span>{text}</span>
    </div>
  );

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      
      <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-6">
          <img 
            src={iegLogo} 
            alt="IEG Logo" 
            className="h-16 mx-auto mb-4"
          />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <h2 className="text-lg font-semibold text-amber-900 mb-1">
                  Password Change Required
                </h2>
                <p className="text-sm text-amber-800">
                  This is your first login. Please change your default password to continue.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-800 mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={handleNewPasswordChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 bg-white/80 backdrop-blur-sm"
              placeholder="Enter your new password"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-800 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 bg-white/80 backdrop-blur-sm"
              placeholder="Confirm your new password"
              required
            />
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700 mb-2">Password Requirements:</p>
            <PasswordRequirement met={passwordStrength.hasLength} text="At least 8 characters" />
            <PasswordRequirement met={passwordStrength.hasLower} text="One lowercase letter" />
            <PasswordRequirement met={passwordStrength.hasUpper} text="One uppercase letter" />
            <PasswordRequirement met={passwordStrength.hasNumber} text="One number" />
            <PasswordRequirement met={passwordStrength.hasSpecial} text="One special character" />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isPasswordValid()}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Changing...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
