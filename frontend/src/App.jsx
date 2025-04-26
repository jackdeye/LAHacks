import React from "react";
import StateMap from "./components/StateMap.jsx";

function App() {
  return (
    <div>
      <h1>US States Map</h1>
      <div style={{ width: '100vw', height: '100vh' }}>
        <StateMap />
      </div>
    </div>
  );
}

export default App;
