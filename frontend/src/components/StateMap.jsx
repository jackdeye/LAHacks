import React, { useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer, GeoJsonLayer } from "@deck.gl/layers";
// import ReactMapGL from "react-map-gl";
import statesData from "../assets/gz_2010_us_040_00_5m.json";

function StateMap() {
	const [stateData, setStateData] = useState(null);
	useEffect(() => {
		const loadLocalData = async () => {
			try {
				const states = statesData.features.filter(feature => feature.properties.NAME);
				console.log("Loaded states data:", states); // Log the filtered features
				setStateData(states);
			} catch (error) {
				console.error("Error loading local state data:", error);
			}
		};
		loadLocalData();
	}, []);
	const layer = stateData && new GeoJsonLayer({
		id: "geojson-layer",
		data: stateData,
		// getPolygon: (feature) => feature.geometry.coordinates,
		getFillColor: [200, 200, 200, 150], // Example fill color
		getLineColor: [0, 0, 0],
		getLineWidth: 2,
		pickable: true,
		stroked: true, // Add outlines
		lineWidthMinPixels: 1,
		getTooltip: ({ object }) => object && `State: ${object.properties.name}`,
	});

	return (
		<DeckGL
			initialViewState={{
				longitude: -98.5795, // Approximate center of the US
				latitude: 39.8283,
				zoom: 3,
			}}
			controller={true}
			layers={layer ? [layer] : []}
		>
			{/* <ReactMapGL // Or other map component
        mapStyle="mapbox://styles/mapbox/streets-v12" // Example map style
        mapboxAccessToken={process.env.MAPBOX_TOKEN} // Your Mapbox token
      /> */}
	  </DeckGL>
	);
}

export default StateMap;
