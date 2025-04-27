import React from "react";
import StateMap from "./components/StateMap.jsx";
import Banner from "./components/Banner.jsx";
import "./App.css";

function App() {
  return (
    <div style={{ textAlign: 'center' }}>
      <Banner />
      <StateMap />
    </div>
  );
}

export default App;
