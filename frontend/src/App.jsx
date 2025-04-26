import React from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer } from "@deck.gl/layers";

function App() {
  const layer = new PolygonLayer({
    id: "PolygonLayer",
    data: "https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf-zipcodes.json",

    getPolygon: (d) => d.contour,
    getElevation: (d) => d.population / d.area / 10,
    getFillColor: (d) => [d.population / d.area / 60, 140, 0],
    getLineColor: [255, 255, 255],
    getLineWidth: 20,
    lineWidthMinPixels: 1,
    pickable: true,
  });

  return (
    <DeckGL
      initialViewState={{
        longitude: -122.4,
        latitude: 37.74,
        zoom: 11,
      }}
      controller
      getTooltip={({ object }) =>
        object && `${object.zipcode}\nPopulation: ${object.population}`
      }
      layers={[layer]}
    />
  );
}

export default App;
