import React from 'react';

interface OnboardingScreenProps {
  title?: string;
  description?: string;
  currentStep?: number;
  totalSteps?: number;
  onNext?: () => void;
  // Replace these with your actual image URLs or imports
  backgroundImage1?: string;
  backgroundImage2?: string;
  backgroundImage3?: string;
}

export default function OnboardingScreen({
  title = "PRẞM",
  description = "Clarify your understanding and stop the spread of misinformation",
  currentStep = 1,
  totalSteps = 2,
  onNext,
  backgroundImage1 = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=452&h=452&fit=crop",
  backgroundImage2 = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&h=600&fit=crop",
  backgroundImage3 = "https://images.unsplash.com/photo-1620421680010-0766ff230392?w=362&h=362&fit=crop",
}: OnboardingScreenProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      maxWidth: '414px',
      maxHeight: '896px',
      margin: '0 auto'
    }}>
      {/* Background Images - Crystal/Prism shapes */}
      <div style={{
        position: 'absolute',
        left: '-203px',
        width: '452px',
        height: '452px',
        top: '555px'
      }}>
        <img 
          alt="" 
          style={{
            position: 'absolute',
            inset: 0,
            maxWidth: 'none',
            objectFit: 'cover',
            pointerEvents: 'none',
            width: '100%',
            height: '100%'
          }}
          src={backgroundImage1} 
        />
      </div>
      <div style={{
        position: 'absolute',
        aspectRatio: '2048/2048',
        left: '50%',
        right: 'calc(-43.68% - 3.75px)',
        top: '439px'
      }}>
        <img 
          alt="" 
          style={{
            position: 'absolute',
            inset: 0,
            maxWidth: 'none',
            objectFit: 'cover',
            pointerEvents: 'none',
            width: '100%',
            height: '100%'
          }}
          src={backgroundImage2} 
        />
      </div>
      <div style={{
        position: 'absolute',
        left: '121px',
        width: '362px',
        height: '362px',
        top: '600px'
      }}>
        <img 
          alt="" 
          style={{
            position: 'absolute',
            inset: 0,
            maxWidth: 'none',
            objectFit: 'cover',
            pointerEvents: 'none',
            width: '100%',
            height: '100%'
          }}
          src={backgroundImage3} 
        />
      </div>

      {/* Glassmorphism Panel */}
      <div style={{
        position: 'absolute',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)', // Safari support
        height: '578px',
        left: '25px',
        borderRadius: '30px',
        top: '159px',
        width: '100%',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%)'
      }} />

      {/* Pagination Dots */}
      <div style={{
        position: 'absolute',
        height: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '678px',
        width: '76px'
      }}>
        <svg 
          style={{
            position: 'absolute',
            display: 'block',
            width: '100%',
            height: '100%'
          }}
          fill="none" 
          preserveAspectRatio="none" 
          viewBox="0 0 76 24"
        >
          <g>
            <circle 
              cx="24" 
              cy="12" 
              fill={currentStep === 1 ? "black" : "#D9D9D9"} 
              r="5" 
            />
            <circle 
              cx="52" 
              cy="12" 
              fill={currentStep === 2 ? "black" : "#D9D9D9"} 
              r="5" 
            />
          </g>
        </svg>
      </div>

      {/* Title */}
      <p style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'Lust, serif',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '48px',
        color: '#4B4B59',
        fontSize: '60px',
        textAlign: 'center',
        top: '361px',
        textShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
      }}>
        {title}
      </p>

      {/* Description */}
      <p style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'Gilroy, sans-serif',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '20px',
        color: '#3f3f49',
        fontSize: '14px',
        textAlign: 'center',
        top: '437px',
        width: '230px',
        whiteSpace: 'pre-wrap'
      }}>
        {description}
      </p>

      {/* Next Button */}
      <button
        onClick={onNext}
        style={{
          position: 'absolute',
          display: 'flex',
          height: '32px',
          alignItems: 'center',
          justifyContent: 'center',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: '30px',
          boxShadow: '0px 4px 4px 0px rgba(0, 0, 0, 0.25)',
          top: '506px',
          width: '115px',
          backgroundImage: 'linear-gradient(155.556deg, rgba(202, 201, 201, 0.7) 66.181%, rgba(100, 99, 99, 0.4) 152.8%)',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <span style={{
          fontFamily: 'Gilroy, sans-serif',
          fontWeight: 500,
          fontStyle: 'normal',
          lineHeight: '48px',
          color: '#3f3f49',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Next
        </span>
      </button>
    </div>
  );
}