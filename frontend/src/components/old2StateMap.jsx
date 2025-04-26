import React, { useState, useEffect, useRef, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import statesData from "../assets/gz_2010_us_040_00_5m.json";
import { scaleLinear } from "d3-scale";
import { rgb } from "d3-color";
import { transformNonContiguousStates, STATE_BOXES } from "../utilities/transfromNonContiguousStates.js";
import Slider from "./Slider.jsx"
import { format } from 'date-fns';

function DateSlider({ dates, selectedDate, onDateChange, onPlayToggle, playing }) {
	const handleSliderChange = useCallback(
		(value) => {
			onDateChange(dates[value[0]]);
		},
		[dates, onDateChange]
	);

	return (
		<div style={{
			position: 'absolute',
			bottom: '80px',
			left: '50%',
			transform: 'translateX(-50%)',
			backgroundColor: 'white',
			padding: '10px',
			borderRadius: '4px',
			boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
			zIndex: 2,
			width: '80%',
			maxWidth: '800px',
		}}>
			<div style={{ marginBottom: '8px', fontWeight: 'bold', textAlign: 'center' }}>
				State Values Over Time: {selectedDate ? format(new Date(selectedDate), 'PPP') : 'Select Date'}
			</div>
			<Slider
				min={0}
				max={dates.length - 1}
				step={1}
				value={[dates.indexOf(selectedDate)]}
				onValueChange={handleSliderChange}
				className="w-full"
			/>
			<div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
				<button
					onClick={onPlayToggle}
					style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '4px' }}
				>
					{playing ? 'Pause' : 'Play'}
				</button>
			</div>
		</div>
	);
}

function StateMap() {
	const [stateData, setStateData] = useState(null);
	const [latestStateMetrics, setLatestStateMetrics] = useState(null);
	const [allStateMetrics, setAllStateMetrics] = useState(null);
	const [hoveredState, setHoveredState] = useState(null);
	const [layer, setLayer] = useState(null);
	const [dateValues, setDateValues] = useState([]);
	const [selectedDate, setSelectedDate] = useState(null);
	const [playing, setPlaying] = useState(false);
	const intervalRef = useRef(null);

	const colorScale = scaleLinear()
		.domain([0, 5])
		.range(["#4daf4a", "#e41a1c"]);

	// Fetch initial data (latest metrics only)
	useEffect(() => {
		const loadLatestData = async () => {
			try {
				// Load and transform data
				const states = statesData.features.filter(feature => feature.properties.NAME);
				const transformedStates = transformNonContiguousStates(states);
				setStateData(transformedStates);

				// Fetch latest metrics (no history)
				const response = await fetch("http://localhost:8000/api/state/all");
				const metrics = await response.json();
				setLatestStateMetrics(metrics);
				console.log("Fetching the Most recent metrics")
			} catch (error) {
				console.error("Error loading initial data:", error);
			}
		};
		loadLatestData();
	}, []);

	// Fetch historical data (runs after initial render)
	useEffect(() => {
		const loadHistoricalData = async () => {
			try {
				const response = await fetch("http://localhost:8000/api/state/all?history=true");
				const metrics = await response.json();
				setAllStateMetrics(metrics);
				console.log("Fetching all the metrics")
			} catch (error) {
				console.error("Error loading historical data:", error);
			}
		};

		loadHistoricalData();
	}, []);

	// Process data for the slider and set initial date to max
	useEffect(() => {
		if (allStateMetrics) {
			const allDates = new Set();
			for (const state in allStateMetrics) {
				allStateMetrics[state].forEach(item => {
					allDates.add(item.ending_date);
				});
			}
			const sortedDates = Array.from(allDates).sort();
			setDateValues(sortedDates);
			setSelectedDate(sortedDates[sortedDates.length - 1]); // Initialize to last date
		}
	}, [allStateMetrics]);

	// Create the layer when data is available
	useEffect(() => {
		if (!stateData || !latestStateMetrics || !selectedDate) return;

		const newLayer = new GeoJsonLayer({
			id: "geojson-layer",
			data: stateData,
			pickable: true,
			stroked: true,
			filled: true,
			extruded: false,
			wireframe: false,
			getFillColor: (feature) => {
				const baseColor = getStateColor(feature.properties.NAME);
				const isHovered = hoveredState &&
					hoveredState.properties.NAME === feature.properties.NAME;

				return isHovered
					? baseColor.map((c, i) => i < 3 ? Math.min(c + 50, 255) : 220)
					: baseColor;
			},
			getLineColor: [0, 0, 0],
			getLineWidth: 2,
			lineWidthMinPixels: 1,
			onHover: ({ object }) => setHoveredState(object),
			autoHighlight: true,
			highlightColor: [255, 255, 255, 100]
		});

		setLayer(newLayer);
	}, [stateData, latestStateMetrics, hoveredState, selectedDate]);

	const boxLayer = new GeoJsonLayer({
		id: 'state-boxes',
		data: STATE_BOXES,
		pickable: false,
		stroked: true,
		filled: false,
		getLineColor: [0, 0, 0],
		getLineWidth: 1,
	});

	const getStateColor = (stateName) => {
		if (!latestStateMetrics) return [200, 200, 200, 150];

		const metric = latestStateMetrics[stateName];
		if (!metric || metric.state_territory_wval === null) {
			return [200, 200, 200, 150];
		}
		const color = rgb(colorScale(metric.state_territory_wval));
		return [color.r, color.g, color.b, 200];
	};


	// Find min/max for legend (use latestStateMetrics initially, then allStateMetrics)
	const wvals = latestStateMetrics ? Object.values(latestStateMetrics).map(m => m.state_territory_wval).filter(Number.isFinite) : [];
	const minVal = wvals?.length ? Math.min(...wvals) : 0;
	const maxVal = wvals?.length ? Math.max(...wvals) : 5;

	const handleDateChange = useCallback((newDate) => {
		setSelectedDate(newDate);
	}, []);

	useEffect(() => {
		if (playing) {
			intervalRef.current = setInterval(() => {
				setDateValues((prevDates) => {
					if (!prevDates || prevDates.length === 0) return [];
					const currentIndex = prevDates.indexOf(selectedDate);
					const nextIndex = (currentIndex + 1) % prevDates.length;
					setSelectedDate(prevDates[nextIndex]);
					return prevDates;
				});
			}, 1000); // Adjust for speed
		} else {
			clearInterval(intervalRef.current);
		}
		return () => clearInterval(intervalRef.current);
	}, [playing, selectedDate, setDateValues]);

	const togglePlay = () => {
		setPlaying((prev) => !prev);
	};

	if (!stateData || !latestStateMetrics) {
		return <div>Loading...</div>;
	}

	return (
		<div style={{ position: 'relative', height: '100vh' }}>
			<DeckGL
				initialViewState={{
					longitude: -98.5795,
					latitude: 39.8283,
					zoom: 3,
				}}
				controller={true}
				layers={[boxLayer, ...(layer ? [layer] : [])]}
				parameters={{
					clearColor: [255, 255, 255, 1],
				}}
				getTooltip={({ object }) => {
					if (!object || !allStateMetrics) return null;

					const stateDataForDate = allStateMetrics[object.properties.NAME]?.find(
						(item) => item.ending_date === selectedDate
					);

					if (!stateDataForDate) return null;

					return {
						html: `
            <div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1)">
              <div><b>${object.properties.NAME}</b></div>
              <div>Value: ${stateDataForDate.state_territory_wval?.toFixed(2) || 'N/A'}</div>
              <div>Category: ${stateDataForDate.wval_category || 'N/A'}</div>
              <div>Date: ${format(new Date(stateDataForDate.ending_date), 'PPP')}</div>
            </div>
          `,
						style: {
							backgroundColor: 'transparent',
							border: 'none',
						},
					};
				}}
			/>

			{allStateMetrics && (
				<DateSlider
					dates={dateValues}
					selectedDate={selectedDate}
					onDateChange={handleDateChange}
					onPlayToggle={togglePlay}
					playing={playing}
				/>
			)}

			{latestStateMetrics && (
				<div style={{
					position: 'absolute',
					bottom: '20px',
					right: '20px',
					backgroundColor: 'white',
					padding: '10px',
					borderRadius: '4px',
					boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
					zIndex: 1
				}}>
					<div style={{ marginBottom: '8px', fontWeight: 'bold' }}>State Values</div>
					<div style={{ display: 'flex', marginBottom: '8px' }}>
						{[0, 1, 2, 3, 4, 5].map((val) => (
							<div key={val} style={{
								width: '30px',
								height: '20px',
								backgroundColor: colorScale(val),
								display: 'inline-block'
							}} />
						))}
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span>{minVal.toFixed(1)}</span>
						<span>{maxVal.toFixed(1)}</span>
					</div>
				</div>
			)}
		</div>
	);
}

export default StateMap;
