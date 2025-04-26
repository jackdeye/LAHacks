import React, { useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import statesData from "../assets/gz_2010_us_040_00_5m.json";
import { scaleLinear } from "d3-scale";
import { rgb } from "d3-color";

function StateMap() {
	const [stateData, setStateData] = useState(null);
	const [stateMetrics, setStateMetrics] = useState(null);
	const [hoveredState, setHoveredState] = useState(null);

	// Color scale from green (low) to red (high)
	const colorScale = scaleLinear()
		.domain([0, 5]) // Adjust based on your data range
		.range(["#4daf4a", "#e41a1c"]); // Green to red

	useEffect(() => {
		const loadData = async () => {
			try {
				// Load GeoJSON data
				const states = statesData.features.filter(feature => feature.properties.NAME);
				setStateData(states);

				// Fetch state metrics from API
				const response = await fetch("http://localhost:8000/api/state/all");
				const metrics = await response.json();
				setStateMetrics(metrics);
			} catch (error) {
				console.error("Error loading data:", error);
			}
		};
		loadData();
	}, []);

	const getStateColor = (stateName) => {
		if (!stateMetrics) return [200, 200, 200, 150]; // Default gray

		const metric = stateMetrics.find(m => m.state_territory === stateName);
		if (!metric || metric.state_territory_wval === null) {
			return [200, 200, 200, 150]; // Gray for missing data
		}

		// Convert hex color to RGB array
		const color = rgb(colorScale(metric.state_territory_wval));
		return [color.r, color.g, color.b, 200];
	};

	const layer = stateData && new GeoJsonLayer({
		id: "geojson-layer",
		data: stateData,
		pickable: true,
		stroked: true,
		filled: true,
		extruded: false,
		wireframe: false,
		getFillColor: (feature) => {
			// Highlight the hovered state with brighter color
			if (hoveredState && feature.properties.NAME === hoveredState.properties.NAME) {
				const baseColor = getStateColor(feature.properties.NAME);
				return baseColor.map((c, i) => i < 3 ? Math.min(c + 50, 255) : 220);
			}
			return getStateColor(feature.properties.NAME);
		},
		getLineColor: [0, 0, 0],
		getLineWidth: 2,
		lineWidthMinPixels: 1,
		onHover: ({ object }) => setHoveredState(object),
	});

	// Find min/max for legend
	const wvals = stateMetrics?.map(m => m.state_territory_wval).filter(Number.isFinite);
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
				layers={layer ? [layer] : []}
				getTooltip={({ object }) => {
					if (!object || !stateMetrics) return null;

					const metric = stateMetrics.find(m => m.state_territory === object.properties.NAME);
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

			{/* Legend */}
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
