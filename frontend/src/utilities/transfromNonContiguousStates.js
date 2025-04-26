const TRANSFORMS = {
  Alaska: {
    scale: [0.25, 0.35],  // [longitude scale, latitude scale]
    offset: [-135, 27.5],  // [longitude offset, latitude offset]
    anchor: [-180, 55]     // [lon anchor point, lat anchor point]
  },
  Hawaii: {
    scale: [0.8, 0.8],
    offset: [-120, 25],
    anchor: [-160, 19]
  },
  'Puerto Rico': {
    scale: [0.8, 0.8],
    offset: [-115, 25],
    anchor: [-70, 18]
  }
};

// Box coordinates for visual grouping
export const STATE_BOXES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Alaska Box' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-125, 30], [-105, 30],
          [-105, 50], [-125, 50],
          [-125, 30]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Hawaii/Puerto Rico Box' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-125, 20], [-105, 20],
          [-105, 30], [-125, 30],
          [-125, 20]
        ]]
      }
    }
  ]
};

const transformCoordinates = (coordinates, transform) => {
  return coordinates.map(polygon =>
    polygon.map(ring =>
      ring.map(([lon, lat]) => [
        (lon - transform.anchor[0]) * transform.scale[0] + transform.offset[0],
        (lat - transform.anchor[1]) * transform.scale[1] + transform.offset[1]
      ])
    )
  );
};

export const transformNonContiguousStates = (features) => {
  return features.map(feature => {
    const stateName = feature.properties.NAME;
    const transform = TRANSFORMS[stateName];

    if (!transform) return feature;

    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: transformCoordinates(feature.geometry.coordinates, transform)
      }
    };
  });
};
