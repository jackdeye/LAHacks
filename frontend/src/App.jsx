import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Banner from "./components/Banner";
import StateMap from "./components/StateMap";
import Notify from "./components/Notify";
import Information from "./components/Information";
import "./App.css";

function App() {
  return (
    <Router>
      <Banner />
      <Routes>
        <Route path="/" element={<StateMap />} />
        <Route path="/signup" element={<Notify />} />
        <Route path="/info" element={<Information />} />
      </Routes>
    </Router>
  );
}

export default App;
