import React from "react";
import "./Slider.css";

function Slider({ min, max, step, value, dates, setSelectedDate, setPredictionData }) {
  const handleChange = (e) => {
    setPredictionData(null);
    setSelectedDate(dates[Number(e.target.value)]);
  };

  return (
    <div className="slider-container">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="slider"
      />
      <div className="slider-labels">
        <span>2021</span>
        <span>2025</span>
      </div>
    </div>
  );
}

export default Slider;
