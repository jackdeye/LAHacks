import React from "react";
import "./Slider.css";

function Slider({ min, max, step, value, dates, setSelectedDate }) {
	const handleChange = (e) => {
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
				<span>{min}</span>
				<span>{max}</span>
			</div>
		</div>
	);
}

export default Slider;
