import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebMercatorViewport } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import statesData from "../assets/gz_2010_us_040_00_5m.json";
import countyData from "../assets/gz_2010_us_050_00_5m.json";
import countyCentroidData from "../assets/counties-centroids.json";
import { Delaunay } from "d3-delaunay";
import { scaleLinear } from "d3-scale";
import { rgb } from "d3-color";
import {
  transformNonContiguousStates,
  STATE_BOXES,
} from "../utilities/transfromNonContiguousStates.js";
import Slider from "./Slider.jsx";
import { format } from "date-fns";

const INITIAL_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3,
  pitch: 0,
  bearing: 0,
};

function DateSlider({
  dates,
  selectedDate,
  onPlayToggle,
  playing,
  setSelectedDate,
}) {
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "10px",
        borderRadius: "4px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        zIndex: 2,
        width: "80%",
        maxWidth: "800px",
        margin: "20px auto",
      }}
    >
      <div
        style={{ marginBottom: "8px", fontWeight: "bold", textAlign: "center" }}
        className="dark-text"
      >
        State Values Over Time:{" "}
        {selectedDate ? format(new Date(selectedDate), "PPP") : "Select Date"}
      </div>
      <Slider
        min={0}
        max={dates.length - 1}
        step={1}
        value={[dates.indexOf(selectedDate)]}
        dates={dates}
        setSelectedDate={setSelectedDate}
        className="w-full"
      />
      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}
      >
        <button
          onClick={onPlayToggle}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            borderRadius: "4px",
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}

function StateMap() {
  const [stateData, setStateData] = useState(null);
  const [latestStateMetrics, setLatestStateMetrics] = useState(null);
  const [allStateMetrics, setAllStateMetrics] = useState(null);
  const [allCountyMetrics, setAllCountyMetrics] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [stateLayer, setStateLayer] = useState(null); // Renamed layer to stateLayer for clarity
  const [countyLayer, setCountyLayer] = useState(null);
  const [countyGeoJson, setCountyGeoJson] = useState(null); // New state for county data
  const [dateValues, setDateValues] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);
  const [selectedState, setSelectedState] = useState(null); // You might use this to track the active state for county view
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const colorScale = scaleLinear().domain([0, 5]).range(["#4daf4a", "#e41a1c"]);

  function generateVoronoiPolygons() {
    const locations = countyCentroidData.features
      .map((centroid) => {
        return centroid.geometry.coordinates;
      })
      .flat();

    const delaunay = new Delaunay(locations);
    const voronoi = delaunay.voronoi([-124.849, 18.931, -66.952, 49.384]);
    console.log("voronoi", voronoi.cellPolygons().next());
  }
  const voronoiPolygons = generateVoronoiPolygons(); // this is an iterable

  // Fetch initial data (latest metrics only)
  useEffect(() => {
    const loadLatestStateData = async () => {
      try {
        const states = statesData.features.filter(
          (feature) => feature.properties.NAME,
        );
        const transformedStates = transformNonContiguousStates(states);
        setStateData(transformedStates);

        const response = await fetch("http://localhost:8000/api/state/all");
        const metrics = await response.json();
        setLatestStateMetrics(metrics);
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    };
    loadLatestStateData();
  }, []);

  // Fetch historical data (runs after initial render)
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/api/state/all?history=true",
        );
        const metrics = await response.json();
        setAllStateMetrics(metrics);
      } catch (error) {
        console.error("Error loading historical data:", error);
      }
    };

    loadHistoricalData();
  }, []);

  useEffect(() => {
    if (allStateMetrics) {
      const allDates = new Set();
      for (const state in allStateMetrics) {
        allStateMetrics[state].forEach((item) => {
          allDates.add(item.ending_date);
        });
      }
      const sortedDates = Array.from(allDates).sort();
      setDateValues(sortedDates);
      setSelectedDate(sortedDates[sortedDates.length - 1]); // Initialize to last date
    }
  }, [allStateMetrics]);

  // Create the state layer when data is available
  useEffect(() => {
    if (!stateData || !latestStateMetrics || !selectedDate) return;

    const newStateLayer = new GeoJsonLayer({
      id: "state-layer", // Renamed ID
      data: stateData,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      wireframe: false,
      getFillColor: (feature) => {
        // Only color states if county data is not loaded
        if (countyGeoJson) {
          return [200, 200, 200, 50]; // Dim states when county data is visible
        }
        const baseColor = getStateColor(feature.properties.NAME);
        const isHovered =
          hoveredState &&
          hoveredState.properties.NAME === feature.properties.NAME;

        return isHovered
          ? baseColor.map((c, i) => (i < 3 ? Math.min(c + 50, 255) : 220))
          : baseColor;
      },
      getLineColor: [0, 0, 0],
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      onHover: ({ object }) => setHoveredState(object),
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      updateTriggers: {
        getFillColor: [selectedDate, allStateMetrics, countyGeoJson], // Added countyGeoJson as trigger
      },
    });

    setStateLayer(newStateLayer); // Set the state layer
  }, [
    stateData,
    latestStateMetrics,
    hoveredState,
    selectedDate,
    countyGeoJson,
  ]); // Added countyGeoJson

  const boxLayer = new GeoJsonLayer({
    id: "state-boxes",
    data: STATE_BOXES,
    pickable: false,
    stroked: true,
    filled: false,
    getLineColor: [0, 0, 0],
    getLineWidth: 1,
  });

  const getStateColor = (stateName) => {
    if (!allStateMetrics || !selectedDate) return [200, 200, 200, 150]; // Use allStateMetrics and selectedDate

    const stateDataForDate = allStateMetrics[stateName]?.find(
      (item) => item.ending_date === selectedDate,
    );
    if (!stateDataForDate || stateDataForDate.state_territory_wval === null) {
      return [200, 200, 200, 150];
    }
    const color = rgb(colorScale(stateDataForDate.state_territory_wval));
    return [color.r, color.g, color.b, 200];
  };

  const getCountyColor = (countyName) => {
    if (!allCountyMetrics) return [200, 200, 200, 150]; // Use allStateMetrics and selectedDate

    let entry = allCountyMetrics.find(
      (item) => item.counties_served == countyName,
    );

    if (!entry) {
      return [200, 200, 200, 150];
    }

    let wval_cat = 0;
    switch (entry.wval_category) {
      case "Very Low":
        wval_cat = 1;
        break;
      case "Low":
        wval_cat = 2;
        break;
      case "Medium":
        wval_cat = 3;
        break;
      case "High":
        wval_cat = 4;
        break;
      case "Very High":
        wval_cat = 5;
        break;
    }
    const color = rgb(colorScale(wval_cat));
    return [color.r, color.g, color.b, 200];
  };

  const wvals = latestStateMetrics
    ? Object.values(latestStateMetrics)
        .map((m) => m.state_territory_wval)
        .filter(Number.isFinite)
    : [];
  const minVal = wvals?.length ? Math.min(...wvals) : 0;
  const maxVal = wvals?.length ? Math.max(...wvals) : 5;

  // --- MODIFIED onClickGeoJson FUNCTION ---
  const onClickGeoJson = useCallback(
    (event) => {
      console.log("blah", countyCentroidData);
      let minLng = null;
      let maxLng = null;
      let minLat = null;
      let maxLat = null;

      const clickedFeature = event.object;
      const geometry = clickedFeature.geometry;

      if (!clickedFeature || !clickedFeature.properties) {
        return;
      }

      const stateFips = clickedFeature.properties.STATE;

      const loadAllCountyData = async () => {
        try {
          const response = await fetch(
            "http://localhost:8000/api/county?state=".concat(
              clickedFeature.properties.NAME,
            ),
          );
          const metrics = await response.json();
          console.log(metrics);
          setAllCountyMetrics(metrics);
        } catch (error) {
          console.error("Error loading all county data:", error);
        }
      };

      loadAllCountyData();

      setSelectedDate(dateValues[dateValues.length - 1]);

      const filteredCounties = countyData.features.filter(
        (county) => county.properties.STATE === stateFips,
      );

      if (!stateFips) {
        console.warn("Clicked state missing FIPS");
        return;
      }

      setSelectedState(clickedFeature.properties.NAME);

      if (filteredCounties.length === 0) {
        console.warn("No county data");
        return;
      }

      const stateCountyGeoJson = {
        type: "FeatureCollection",
        features: filteredCounties,
      };

      setCountyGeoJson(stateCountyGeoJson);

      // Helper function to update min/max bounds
      const updateBounds = (coord) => {
        if (minLng === null || coord[0] < minLng) minLng = coord[0];
        if (maxLng === null || coord[0] > maxLng) maxLng = coord[0];
        if (minLat === null || coord[1] < minLat) minLat = coord[1];
        if (maxLat === null || coord[1] > maxLat) maxLat = coord[1];
      };

      if (geometry.type === "Polygon") {
        // Iterate over rings (exterior and interior)
        geometry.coordinates.forEach((ring) => {
          // Iterate over coordinates in each ring
          ring.forEach((coord) => {
            updateBounds(coord);
          });
        });
      } else if (geometry.type === "MultiPolygon") {
        // Iterate over individual polygons within the MultiPolygon
        geometry.coordinates.forEach((polygon) => {
          // Iterate over rings within each polygon
          polygon.forEach((ring) => {
            // Iterate over coordinates in each ring
            ring.forEach((coord) => {
              updateBounds(coord);
            });
          });
        });
      } else {
        // Handle other geometry types if necessary (e.g., Point, LineString)
        console.warn("Unsupported geometry type:", geometry.type);
        return; // Exit if geometry type is not handled
      }

      // Check if any coordinates were processed (in case of empty geometry)
      if (minLng === null) {
        console.warn("No valid coordinates found in geometry.");
        return;
      }

      console.log(minLng, maxLng, minLat, maxLat);

      const viewport = new WebMercatorViewport();
      const { longitude, latitude, zoom } = viewport.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        // Optional: Add padding if needed
        // {
        //   padding: 20,
        // },
      );

      console.log(longitude, latitude, zoom);
      // Adjust zoom level as needed; your current adjustment seems arbitrary,
      // you might want to reconsider the zoom: 6 + zoom / 3 part
      setViewState({ longitude, latitude, zoom: 6 + zoom / 3 });
    },
    [setViewState, countyData, countyGeoJson, setSelectedState],
  ); // Added dependencies

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };
  const handleViewStateChange = useCallback(
    ({ viewState: newViewState, interactionState }) => {
      if (interactionState.isZooming) {
        console.log("Scrolling detected!");
        setViewState(INITIAL_VIEW_STATE); // Keep the reset logic
        setCountyGeoJson(null);
        setCountyLayer(null);
        setSelectedState(null);
        setAllCountyMetrics(null);
      } else {
        setViewState(newViewState);
      }
    },
    [],
  );
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
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, selectedDate, setDateValues]);

  const togglePlay = () => {
    setPlaying((prev) => !prev);
  };

  useEffect(() => {
    // New layer for counties
    const countyLayer =
      countyGeoJson &&
      new GeoJsonLayer({
        id: "county-layer",
        data: countyGeoJson,
        pickable: true, // Make counties pickable
        stroked: true,
        filled: true,
        extruded: false,
        wireframe: false,
        getFillColor: (feature) => {
          //console.log(feature);
          const baseColor = getCountyColor(feature.properties.NAME);
          const isHovered =
            hoveredState &&
            hoveredState.properties.NAME === feature.properties.NAME;

          return isHovered
            ? baseColor.map((c, i) => (i < 3 ? Math.min(c + 50, 255) : 220))
            : baseColor;
        },
        getLineColor: [50, 50, 50, 255], // Darker line color
        getLineWidth: 1,
        lineWidthMinPixels: 0.5,
        onHover: ({ object }) => setHoveredState(object),
        // Add getFillColor based on county metrics if you have them
        updateTriggers: {
          getFillColor: [allCountyMetrics, countyGeoJson], // Added countyGeoJson as trigger
        },
      });

    setCountyLayer(countyLayer);
  }, [allCountyMetrics, countyGeoJson, hoveredState]);

  if (!stateData || !latestStateMetrics) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div className="map-container" style={{ position: "relative" }}>
          <div style={{ position: "relative", height: "100%" }}>
            <DeckGL
              style={{ width: "100%", height: "100% " }}
              viewState={viewState}
              onViewStateChange={handleViewStateChange}
              controller={true}
              layers={[
                boxLayer,
                ...(stateLayer ? [stateLayer] : []), // State layer
                ...(countyLayer ? [countyLayer] : []), // County layer, renders on top when countyGeoJson is not null
              ]}
              parameters={{
                clearColor: [255, 255, 255, 1],
              }}
              onClick={onClickGeoJson} // This now handles both state and potentially county clicks
              getTooltip={({ object, layer }) => {
                // Modify tooltip to show state info OR county info based on the layer
                if (
                  layer &&
                  layer.id === "county-layer" &&
                  object &&
                  object.properties
                ) {
                  return {
                    html: `
                     <div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1)">
                       <div><b>${object.properties.NAME} County</b></div> {/* Assuming county NAME */}
                       <div>State FIPS: ${object.properties.STATEFP}</div> {/* Assuming county STATEFP */}
                       <div>County FIPS: ${object.properties.COUNTYFP}</div> {/* Assuming county COUNTYFP */}
                       ${/* Add county specific data if available */ ""}
                     </div>
                   `,
                    style: { backgroundColor: "transparent", border: "none" },
                  };
                }
                // Fallback to state tooltip if clicked object is from state layer and county data is not active OR if county data is active but clicked outside counties
                if (
                  layer &&
                  layer.id === "state-layer" &&
                  object &&
                  object.properties
                ) {
                  // Only show the detailed state tooltip when viewing states (countyGeoJson is null)
                  // When county data is loaded, the state layer is dimmed, the tooltip might be less relevant or show different info.
                  // For now, let's only show the detailed state tooltip when not in county view.
                  if (countyGeoJson) return null; // No detailed state tooltip when county data is active

                  if (!allStateMetrics) return null;
                  const stateDataForDate = allStateMetrics[
                    object.properties.NAME
                  ]?.find((item) => item.ending_date === selectedDate);

                  if (!stateDataForDate) return null;

                  return {
                    html: `
                     <div style="padding: 8px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1)">
                       <div><b>${object.properties.NAME}</b></div>
                       <div>Value: ${stateDataForDate.state_territory_wval?.toFixed(2) || "N/A"}</div>
                       <div>Category: ${stateDataForDate.wval_category || "N/A"}</div>
                       <div>Date: ${format(new Date(stateDataForDate.ending_date), "PPP")}</div>
                     </div>
                   `,
                    style: {
                      backgroundColor: "transparent",
                      border: "none",
                    },
                  };
                }

                // Optional: Tooltip for the "boxes" layer if needed, though typically not interactive
                // if (layer && layer.id === 'state-boxes' && object) {
                //      return { html: `<div>State Box</div>`, style: { backgroundColor: 'white' }};
                // }

                return null; // No tooltip for other cases
              }}
            />
          </div>
          {latestStateMetrics && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                backgroundColor: "white",
                padding: "10px",
                borderRadius: "4px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                zIndex: 10,
                // marginTop: '20px',
                // alignSelf: 'flex-end'
              }}
              className="dark-text"
            >
              <div
                style={{ marginBottom: "8px", fontWeight: "bold" }}
                className="dark-text"
              >
                State Values
              </div>
              <div
                style={{ display: "flex", marginBottom: "8px" }}
                className="dark-text"
              >
                {[0, 1, 2, 3, 4, 5].map((val) => (
                  <div
                    key={val}
                    style={{
                      width: "30px",
                      height: "20px",
                      backgroundColor: colorScale(val),
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
              <div
                style={{ display: "flex", justifyContent: "space-between" }}
                className="dark-text"
              >
                <span>{minVal.toFixed(1)}</span>
                <span>{maxVal.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Optional: Add a button to go back to the US view */}
        {countyGeoJson && (
          <button
            onClick={() => {
              setCountyGeoJson(null); // Clear county data
              setSelectedState(null); // Clear selected state
              // Reset view to the initial US view or a saved US view state
              setViewState({
                longitude: -98.5795,
                latitude: 39.8283,
                zoom: 3,
              });
            }}
            style={{
              marginTop: "20px",
              padding: "8px 16px",
              backgroundColor: "#007bff", // Example blue color
              color: "white",
              borderRadius: "4px",
              cursor: "pointer",
              border: "none",
            }}
          >
            Back to US Map
          </button>
        )}

        {allStateMetrics && (
          <DateSlider
            dates={dateValues}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onPlayToggle={togglePlay}
            playing={playing}
            setSelectedDate={setSelectedDate}
          />
        )}
      </div>
    </>
  );
}

export default StateMap;
