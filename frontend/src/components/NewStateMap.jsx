import React, { useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import statesData from "../assets/gz_2010_us_040_00_5m.json";
import { scaleLinear } from "d3-scale";
import { rgb } from "d3-color";
import { transformNonContiguousStates, STATE_BOXES } from "../utilities/transfromNonContiguousStates.js";

function StateMap() {
	const [stateData, setStateData] = useState(null);
	const [stateMetrics, setStateMetrics] = useState(null);
	const [hoveredState, setHoveredState] = useState(null);
	const [layer, setLayer] = useState(null);

	const colorScale = scaleLinear()
		.domain([0, 5])
		.range(["#4daf4a", "#e41a1c"]);

	useEffect(() => {
		const loadData = async () => {
			try {
				// Load and transform data
				const states = statesData.features.filter(feature => feature.properties.NAME);
				const transformedStates = transformNonContiguousStates(states);
				setStateData(transformedStates);

				// Fetch metrics
				const response = await fetch("http://localhost:8000/api/state/all");
				const metrics = await response.json();
				setStateMetrics(metrics);
			} catch (error) {
				console.error("Error loading data:", error);
			}
		};
		loadData();
	}, []);

	// Create the layer when data is available
	useEffect(() => {
		if (!stateData || !stateMetrics) return;

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
	}, [stateData, stateMetrics, hoveredState]); // Recreate layer when these change

	// Your boxLayer definition remains the same
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
		if (!stateMetrics || !stateMetrics[stateName]) return [200, 200, 200, 150];

		const metric = stateMetrics[stateName];
		if (metric.state_territory_wval === null) {
			return [200, 200, 200, 150];
		}

		const color = rgb(colorScale(metric.state_territory_wval));
		return [color.r, color.g, color.b, 200];
	};


	// Find min/max for legend
	const wvals = stateMetrics ? Object.values(stateMetrics).map(m => m.state_territory_wval).filter(Number.isFinite) : [];
	const minVal = wvals?.length ? Math.min(...wvals) : 0;
	const maxVal = wvals?.length ? Math.max(...wvals) : 5;

	return (
		<div style={{ position: 'relative', height: '100vh' }}>
			<DeckGL
				initialViewState={{
					longitude: -98.5795,
					latitude: 39.8283,
					zoom: 3,
				}}
				controller={true}
				layers={[boxLayer, ...(layer ? [layer] : [])]} // Box layer first, then states
				parameters={{
					clearColor: [255, 255, 255, 1], // Ensure proper transparency
				}}
				getTooltip={({ object }) => {
					if (!object || !stateMetrics) return null;

					const metric = stateMetrics[object.properties.NAME];
					if (!metric) return null;

					return {
						html: `
        <div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1)">
          <div><b>${object.properties.NAME}</b></div>
          <div>Value: ${metric.state_territory_wval?.toFixed(2) || 'N/A'}</div>
          <div>Category: ${metric.wval_category || 'N/A'}</div>
        </div>
      `,
						style: {
							backgroundColor: 'transparent',
							border: 'none',
						}
					};
				}}
			/>

			{stateMetrics && (
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
