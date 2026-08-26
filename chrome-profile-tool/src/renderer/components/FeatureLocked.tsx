import React from 'react';

interface FeatureLockedProps {
  onBackToDashboard: () => void;
}

export const FeatureLocked: React.FC<FeatureLockedProps> = ({ onBackToDashboard }) => {
  return (
    <div className="feature-locked-container">
      <div className="feature-locked-content">
        <div className="lock-icon-wrapper">
          <svg className="lock-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1 className="locked-title">Feature Temporarily Locked</h1>
        
        <p className="locked-message">
          This feature is temporarily locked for system updates.
          <br />
          Please check back later.
        </p>
        
        <button 
          className="back-to-dashboard-btn"
          onClick={onBackToDashboard}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
      </div>

      <style>{`
        .feature-locked-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f8f9fa;
          padding: 20px;
          position: relative;
        }

        .feature-locked-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(255, 138, 0, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255, 107, 0, 0.06) 0%, transparent 50%);
          pointer-events: none;
        }

        .feature-locked-content {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 138, 0, 0.1);
          border-radius: 20px;
          padding: 64px 48px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 2px 8px rgba(255, 138, 0, 0.04);
          position: relative;
          z-index: 1;
        }

        .lock-icon-wrapper {
          margin: 0 auto 32px;
          width: 96px;
          height: 96px;
          background: linear-gradient(135deg, rgba(255, 138, 0, 0.1) 0%, rgba(255, 107, 0, 0.05) 100%);
          border: 2px solid rgba(255, 138, 0, 0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .lock-icon-wrapper::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255, 138, 0, 0.05) 0%, transparent 100%);
          z-index: -1;
        }

        .lock-icon {
          color: #ff8a00;
          filter: drop-shadow(0 2px 4px rgba(255, 138, 0, 0.2));
        }

        .locked-title {
          font-size: 26px;
          font-weight: 700;
          color: #2c3e50;
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }

        .locked-message {
          font-size: 15px;
          color: #64748b;
          line-height: 1.7;
          margin: 0 0 40px 0;
          font-weight: 400;
        }

        .back-to-dashboard-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #ff8a00 0%, #ff6b00 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 4px 12px rgba(255, 138, 0, 0.25),
            0 2px 4px rgba(255, 138, 0, 0.15);
          position: relative;
          overflow: hidden;
        }

        .back-to-dashboard-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .back-to-dashboard-btn:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 8px 20px rgba(255, 138, 0, 0.35),
            0 4px 8px rgba(255, 138, 0, 0.2);
        }

        .back-to-dashboard-btn:hover::before {
          opacity: 1;
        }

        .back-to-dashboard-btn:active {
          transform: translateY(0);
          box-shadow: 
            0 2px 8px rgba(255, 138, 0, 0.3),
            0 1px 4px rgba(255, 138, 0, 0.2);
        }

        .back-to-dashboard-btn svg {
          transition: transform 0.3s ease;
        }

        .back-to-dashboard-btn:hover svg {
          transform: translateX(-3px);
        }
      `}</style>
    </div>
  );
};
