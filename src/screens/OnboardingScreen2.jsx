import React from 'react';

export default function OnboardingScreen2({
  title = "How It Works",
  description = "As you browse Instagram, Prism automatically analyzes posts and alerts you to potential misinformation",
  currentStep = 2,
  totalSteps = 2,
  onGetStarted,
  backgroundImage1 = "/ac391d9b1ef22ff52f4210ca930f096c198715e5.png",
  backgroundImage2 = "/88e80d6d912c76f0da97dbeac4cbf888327d68c8.png",
  backgroundImage3 = "/241cdd1311bc02555f2722b8df1747416a8995e8.png",
}) {
  const handleGetStarted = () => {
    // Open Instagram in a new tab
    chrome.tabs.create({ url: 'https://www.instagram.com' });
    // Call the onGetStarted callback to complete onboarding
    if (onGetStarted) onGetStarted();
  };

  return (
    <div style={{
      backgroundColor: 'white',
      position: 'relative',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      maxWidth: '414px',
      maxHeight: '600px',
      margin: '0 auto'
    }}>
      {/* Background Images - Crystal/Prism shapes - X pattern */}
      {/* Top Left */}
      <div style={{
        position: 'absolute',
        left: '-130px',
        width: '280px',
        height: '280px',
        top: '20px'
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
      {/* Top Right */}
      <div style={{
        position: 'absolute',
        aspectRatio: '2048/2048',
        right: '-180px',
        top: '80px',
        width: '320px',
        height: '320px'
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
      {/* Bottom Center - forming upside-down triangle */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '280px',
        height: '280px',
        bottom: '-100px'
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
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        height: '390px',
        left: '25px',
        borderRadius: '30px',
        top: '105px',
        width: 'calc(100% - 50px)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%)'
      }} />

      {/* Pagination Dots */}
      <div style={{
        position: 'absolute',
        height: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '455px',
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
        fontFamily: '"Playfair Display", serif',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '40px',
        color: '#4B4B59',
        fontSize: '32px',
        textAlign: 'center',
        top: '200px',
        textShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
      }}>
        {title}
      </p>

      {/* Description */}
      <p style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '20px',
        color: '#3f3f49',
        fontSize: '14px',
        textAlign: 'center',
        top: '260px',
        width: '280px',
        whiteSpace: 'pre-wrap'
      }}>
        {description}
      </p>

      {/* Get Started Button */}
      <button
        onClick={handleGetStarted}
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
          top: '350px',
          width: '140px',
          backgroundImage: 'linear-gradient(155.556deg, rgba(202, 201, 201, 0.7) 66.181%, rgba(100, 99, 99, 0.4) 152.8%)',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontStyle: 'normal',
          lineHeight: '48px',
          color: '#3f3f49',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Get Started
        </span>
      </button>
    </div>
  );
}
