# Glassmorphism Onboarding Screen - Copy & Paste Instructions (Standard JSX)

## 1. Copy the Component

Copy `/src/app/components/OnboardingScreen.tsx` into your project's component folder (e.g., `src/screens/` or `src/components/`)

## 2. Add Required Fonts

Add these font imports to your main CSS file (e.g., `index.css` or `App.css`):

```css
@import url('https://fonts.googleapis.com/css2?family=Lust:wght@400&display=swap');
@import url('https://fonts.cdnfonts.com/css/gilroy-bold');
```

## 3. Usage in Your App

```tsx
import OnboardingScreen from './components/OnboardingScreen';

function App() {
  const handleNext = () => {
    console.log('Next button clicked');
    // Your navigation logic here
  };

  return (
    <OnboardingScreen
      title="PRẞM"
      description="Clarify your understanding and stop the spread of misinformation"
      currentStep={1}
      totalSteps={2}
      onNext={handleNext}
      // Optional: Replace with your own images
      backgroundImage1="/path/to/crystal1.png"
      backgroundImage2="/path/to/crystal2.png"
      backgroundImage3="/path/to/crystal3.png"
    />
  );
}
```

## 4. Glassmorphism Settings (for other panels)

To apply the same glass effect to other elements, use these inline styles:

```jsx
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
```

## 5. Core Glass Effect Properties

**Key CSS Properties:**
- `backdropFilter: 'blur(8px)'` - Creates the blur effect
- `WebkitBackdropFilter: 'blur(8px)'` - Safari compatibility
- `background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%)'` - Semi-transparent gradient
- `border: '1px solid rgba(255, 255, 255, 0.2)'` - Subtle border
- `boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'` - Soft shadow
- `borderRadius: '30px'` - Rounded corners

## 6. Panel Position & Dimensions

- **Top:** 159px from top
- **Left:** 25px from left edge
- **Height:** 578px
- **Width:** Full width (minus left offset)
- **Border Radius:** 30px

## 7. Customization Options

The component accepts these props:
- `title` - Main heading text (default: "PRẞM")
- `description` - Description text
- `currentStep` - Active pagination dot (1 or 2)
- `totalSteps` - Total number of steps
- `onNext` - Callback function for Next button
- `backgroundImage1/2/3` - URLs for the three crystal images

## 8. No Dependencies Required

This component uses:
- ✅ Pure React (standard JSX)
- ✅ Inline styles only
- ✅ No Tailwind CSS
- ✅ No external UI libraries
- ✅ Works in any React project (Create React App, Vite, Next.js, etc.)
