// src/App.jsx — Root Popup Component
// ---------------------------------------------------------------------------
// This is the main React component rendered inside the extension popup.
// It currently displays a simple landing view with the extension name and a
// brief description. As Prism evolves, this component will orchestrate
// sub-components for displaying analysis results, settings, etc.
// ---------------------------------------------------------------------------

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Prism</h1>
        <p className="tagline">Instagram misinformation detector</p>
      </header>

      <main className="app-body">
        <p>
          Prism is active. Navigate to an Instagram post and the content script
          will begin analysing it for potential misinformation.
        </p>
      </main>

      <footer className="app-footer">
        <small>v1.0.0</small>
      </footer>
    </div>
  );
}

export default App;
