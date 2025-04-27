import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebMercatorViewport, FlyToInterpolator } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer, BitmapLayer } from "@deck.gl/layers";
import statesData from "../assets/gz_2010_us_040_00_5m.json";
import countyData from "../assets/gz_2010_us_050_00_5m.json";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { FaPlay, FaPause } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

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

const MIN_ZOOM = 1.5;
const MAX_ZOOM = 10;
const MIN_LATITUDE = -85.0511;
const MAX_LATITUDE = 85.0511;
const MIN_LONGITUDE = -10;
const MAX_LONGITUDE = 10;

const buttonStyle = {
  padding: "10px",
  backgroundColor: "#4a90e2",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "bold",
  outline: "none",
  transition: "opacity 0.3s ease",
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
        borderRadius: "20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        zIndex: 2,
        width: "400px",
        maxWidth: "800px",
        margin: "20px auto",
      }}
    >
      <div
        style={{ fontWeight: "bold", textAlign: "center" }}
        className="dark-text"
      >
        {selectedDate ? format(new Date(selectedDate), "PPP") : "Select Date"}
      </div>
      <div style={{ display: "flex", width: "100%" }}>
        {/* Play/Pause icon */}
        <button
          onClick={onPlayToggle}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            cursor: "pointer",
            padding: 0,
            marginLeft: "20px",
            marginTop: "15px",
            color: "black",
            fontSize: "25px", // Control size
            height: "32px",
          }}
        >
          {playing ? <FaPause /> : <FaPlay />}
        </button>
        <Slider
          min={0}
          max={dates.length - 1}
          step={1}
          value={[dates.indexOf(selectedDate)]}
          dates={dates}
          setSelectedDate={setSelectedDate}
          className="w-full"
        />
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
  const [showSidebar, setShowSidebar] = useState(false); // for state panel
  const [showSlider, setShowSlider] = useState(true); // for date slider

  const colorScale = scaleSequential(interpolateYlOrRd).domain([0.5, 10]); // 1 = Very Low, 5 = Very High

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
  const tileLayer = new TileLayer({
    id: "base-map-tile-layer",
    data: "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props) => {
      const {
        bbox: { west, south, east, north },
        data,
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: data,
        bounds: [west, south, east, north],
      });
    },
  });

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
      getLineColor: [220, 220, 220],
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
        wval_cat = 0.1;
        break;
      case "Low":
        wval_cat = 1.5;
        break;
      case "Moderate":
        wval_cat = 3;
        break;
      case "High":
        wval_cat = 4.5;
        break;
      case "Very High":
        wval_cat = 8;
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
  const maxVal = wvals?.length ? Math.max(...wvals) : 10;

  // --- MODIFIED onClickGeoJson FUNCTION ---
  const onClickGeoJson = useCallback(
    (event) => {
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
      setShowSidebar(true);
      setShowSlider(false);

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
      setViewState((prevViewState) => ({
        ...prevViewState,
        longitude,
        latitude,
        zoom: 6 + zoom / 3,
        transitionDuration: 300,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    },
    [setViewState, countyData, countyGeoJson, setSelectedState],
  ); // Added dependencies

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };
  const USA_BOUNDS = {
    west: -130, // More west, near Aleutians
    east: -60, // Far east coast + a bit ocean
    south: 20, // Hawaii latitude
    north: 55, // Northern border of US (Montana/Canada)
  };
  const handleViewStateChange = useCallback(
    ({ viewState: newViewState, interactionState }) => {
      let { longitude, latitude, zoom } = newViewState;

      if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
      if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;
      if (latitude < MIN_LATITUDE) latitude = MIN_LATITUDE;
      if (latitude > MAX_LATITUDE) latitude = MAX_LATITUDE;
      if (longitude < MIN_LONGITUDE) longitude = MIN_LONGITUDE;
      if (longitude > MAX_LONGITUDE) longitude = MAX_LONGITUDE;

      if (interactionState.isZooming) {
        console.log("Scrolling detected!");
        setViewState((prev) => ({
          ...prev,
          ...newViewState,
          transitionDuration: 0, // 🌟 Short smooth scroll zoom
          transitionInterpolator: new FlyToInterpolator(),
        }));
        setShowSidebar(false);
        setShowSlider(true);

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
      <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
        {showSidebar && selectedState && (
          <div
            style={{
              width: "33%", // 1/3 of page
              height: "100vh",
              backgroundColor: "white",
              color: "black",
              padding: "20px",
              boxShadow: "2px 0px 6px rgba(0,0,0,0.1)",
              flexDirection: "column",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              fontSize: "24px",
              fontWeight: "bold",
              // transition: "transform 10s ease", // 🌟 Smooth slide transition
              // transform: showSidebar ? "translateX(0)" : "translateX(-100%)", // 🌟 Slide in/out
              // position: "relative", // 🌟 stay inline with map
              // zIndex: 100, // 🌟 on top
            }}
          >
            <div>MEOW</div>
            <div>{selectedState}</div>
            <div>Graphs / Stats Here</div>
          </div>
        )}
        <div
          className="map-container"
          style={{
            position: "relative",
            flexGrow: 1,
            width: showSidebar ? "67%" : "100%", // Shrink map if sidebar open
          }}
        >
          {" "}
          <div style={{ position: "relative", height: "100%" }}>
            <DeckGL
              style={{ width: "100%", height: "100% " }}
              viewState={viewState}
              onViewStateChange={handleViewStateChange}
              controller={{
                scrollZoom: true,
                dragPan: true,
                dragRotate: false,
                doubleClickZoom: true,
                touchZoom: true,
                minZoom: 1.5, // 🌟 Match minZoom here
                maxZoom: 10,
              }}
              layers={[
                tileLayer,
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
          {showSlider && allStateMetrics && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                zIndex: 10,
              }}
            >
              <DateSlider
                dates={dateValues}
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                onPlayToggle={togglePlay}
                playing={playing}
                setSelectedDate={setSelectedDate}
              />
            </div>
          )}
          {latestStateMetrics && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
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
                Wastewater Risk Levels
              </div>
              <div
                style={{ display: "flex", marginBottom: "8px" }}
                className="dark-text"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
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
                <span>0.5</span>
                <span>10</span>
              </div>
            </div>
          )}
          {showSlider && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "20px", // 🌟 Opposite side of the legend
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                zIndex: 10,
                width: "250px",
              }}
              className="dark-text"
            >
              <div
                style={{
                  marginBottom: "10px",
                  fontWeight: "bold",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {/* AI Icon */}
                <HiSparkles /> Predict Next 4 Weeks?
              </div>

              {/* Four buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <button
                  style={buttonStyle}
                  onMouseEnter={(e) => (e.target.style.opacity = "0.8")} // 🌟 slight transparent
                  onMouseLeave={(e) => (e.target.style.opacity = "1")}
                >
                  Week 1
                </button>
                <button
                  style={buttonStyle}
                  onMouseEnter={(e) => (e.target.style.opacity = "0.8")} // 🌟 slight transparent
                  onMouseLeave={(e) => (e.target.style.opacity = "1")}
                >
                  Week 2
                </button>
                <button
                  style={buttonStyle}
                  onMouseEnter={(e) => (e.target.style.opacity = "0.8")} // 🌟 slight transparent
                  onMouseLeave={(e) => (e.target.style.opacity = "1")}
                >
                  Week 3
                </button>
                <button
                  style={buttonStyle}
                  onMouseEnter={(e) => (e.target.style.opacity = "0.8")} // 🌟 slight transparent
                  onMouseLeave={(e) => (e.target.style.opacity = "1")}
                >
                  Week 4
                </button>
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
              position: "absolute",
              marginTop: "20px",
              marginLeft: "20px",
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
      </div>
    </>
  );
}

export default StateMap;
