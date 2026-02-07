import React, { useState, useEffect } from 'react';
import { AlertCircle, Shield, Copy, CheckCircle, Download } from 'lucide-react';
import QRCode from 'qrcode';
import appIcon from '../assets/app-icon.png';

interface TwoFactorSetupProps {
  onSetupComplete: () => void;
  onCancel: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ 
  onSetupComplete,
  onCancel 
}) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step === 'qr') {
      generateTOTPSecret();
    }
  }, [step]);

  const generateTOTPSecret = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.auth.generate2FASecret();
      setQrCodeUrl(result.qrCodeUrl);
      setSecretKey(result.secretKey);
      
      // Generate QR code image from URI with logo overlay
      if (result.qrCodeUrl) {
        try {
          // Generate base QR code with higher resolution for crisp logo
          const qrDataUrl = await QRCode.toDataURL(result.qrCodeUrl, {
            width: 512, // Higher resolution for better quality
            margin: 2,
            errorCorrectionLevel: 'H', // High error correction to allow logo overlay
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          // Create canvas to overlay logo
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Disable image smoothing for crisp rendering
            ctx.imageSmoothingEnabled = false;
            
            // Load QR code image
            const qrImage = new Image();
            qrImage.onload = () => {
              canvas.width = qrImage.width;
              canvas.height = qrImage.height;
              
              // Draw QR code
              ctx.drawImage(qrImage, 0, 0);
              
              // Load and draw logo in center
              const logo = new Image();
              logo.onload = () => {
                const logoSize = qrImage.width * 0.2; // Logo is 20% of QR code size
                const logoX = (qrImage.width - logoSize) / 2;
                const logoY = (qrImage.height - logoSize) / 2;
                
                // Draw white background circle for logo
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(qrImage.width / 2, qrImage.height / 2, logoSize / 2 + 4, 0, 2 * Math.PI);
                ctx.fill();
                
                // Re-enable smoothing for logo only
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw logo with high quality
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                
                // Set final QR code with logo, scale down to display size
                const finalCanvas = document.createElement('canvas');
                const finalCtx = finalCanvas.getContext('2d');
                if (finalCtx) {
                  finalCanvas.width = 256;
                  finalCanvas.height = 256;
                  finalCtx.imageSmoothingEnabled = true;
                  finalCtx.imageSmoothingQuality = 'high';
                  finalCtx.drawImage(canvas, 0, 0, 256, 256);
                  setQrCodeDataUrl(finalCanvas.toDataURL('image/png', 1.0));
                } else {
                  setQrCodeDataUrl(canvas.toDataURL('image/png', 1.0));
                }
              };
              logo.src = appIcon;
            };
            qrImage.src = qrDataUrl;
          } else {
            // Fallback to QR code without logo
            setQrCodeDataUrl(qrDataUrl);
          }
        } catch (qrError) {
          console.error('Failed to generate QR code image:', qrError);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate 2FA secret');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: Call Firebase to verify and enable 2FA
      const result = await window.electronAPI.auth.enable2FA(verificationCode);
      setRecoveryCodes(result.recoveryCodes);
      setStep('verify');
    } catch (err: any) {
      let errorMsg = err.message || 'Invalid verification code';
      if (errorMsg.includes('Error:')) {
        errorMsg = errorMsg.split('Error:').pop()?.trim() || errorMsg;
      }
      setError(errorMsg);
      setVerificationCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRecoveryCodes = () => {
    const content = `JEG Profiles - Two-Factor Authentication Recovery Codes\n\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      `Keep these codes in a safe place. Each code can only be used once.\n\n` +
      recoveryCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeg-2fa-recovery-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-indigo-100 rounded-full p-2 mr-3">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Enable Two-Factor Authentication
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-gray-700">
              Two-factor authentication adds an extra layer of security to your account by requiring a verification code from your authenticator app when you sign in.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">You will need:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
                <li>Your phone or device with the app installed</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Important:</strong> Make sure to save your recovery codes in a safe place. You'll need them if you lose access to your authenticator app.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep('qr')}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'qr') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-indigo-100 rounded-full p-2 mr-3">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Scan QR Code
              </h3>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-700 mb-4">
                Scan this QR code with your authenticator app:
              </p>
              
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : qrCodeDataUrl ? (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                  <img 
                    src={qrCodeDataUrl} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 p-4 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-gray-500">QR Code will appear here</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Or enter this code manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 text-sm font-mono">
                  {secretKey || 'Loading...'}
                </code>
                <button
                  onClick={handleCopySecret}
                  disabled={!secretKey}
                  className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                  title="Copy to clipboard"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter verification code from your app:
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200 text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify & Enable</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Recovery codes step
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-2 mr-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              2FA Enabled Successfully!
            </h3>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-semibold mb-2">
              Save Your Recovery Codes
            </p>
            <p className="text-sm text-amber-700">
              Keep these codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="bg-white px-3 py-2 rounded border border-gray-300">
                  <code className="text-sm font-mono">{code}</code>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadRecoveryCodes}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Recovery Codes
          </button>
        </div>

        <button
          onClick={onSetupComplete}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
