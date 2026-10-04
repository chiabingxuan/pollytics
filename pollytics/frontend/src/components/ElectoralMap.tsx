import { useEffect } from "react";
import L from "leaflet";
import type { LeafletMouseEvent, Path } from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import type { Pane } from "../types";
import { DEFAULT_COLOR } from "../utils/colors";

import "leaflet/dist/leaflet.css";

interface ElectoralMapProps {
    geoJson: FeatureCollection<Geometry, Pane>;
    geoJsonKey: string;
    updateHoveredLocationOnHoverPane: (pane: Pane) => void;
    updateHoveredLocationOnLeavePane: () => void;
    handleSelectedPane: (pane: Pane) => void;
}

function getColorFromWinningProportion(
    color: string | null,
    winningProportion: number
): string {
    // Give default colour if the category doesn't have an associated colour
    const baseColor = color ?? DEFAULT_COLOR;

    // Colour is in hexadecimal
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Either white or black.
    // If proportion is low, shift colour to white (255); otherwise, shift to black (0)
    let target: number;

    // The extent (0-1) to which we shift the colour to the target identified
    let shiftFactor: number;

    if (winningProportion < 0.50) {
        // <50%: very light
        target = 255;
        shiftFactor = 0.8;
    } else if (winningProportion < 0.60) {
        // 50–60%: light
        target = 255;
        shiftFactor = 0.4;
    } else if (winningProportion < 0.70) {
        // 60–70%: original colour
        target = 255;
        shiftFactor = 0;
    } else if (winningProportion < 0.80) {
        // 70–80%: dark
        target = 0;
        shiftFactor = 0.4;
    } else if (winningProportion < 0.90) {
        // 80–90%: very dark
        target = 0;
        shiftFactor = 0.7;
    } else {
        // 90–100%: darkest
        target = 0;
        shiftFactor = 0.9;
    }

    const newR = Math.round(r + (target - r) * shiftFactor);
    const newG = Math.round(g + (target - g) * shiftFactor);
    const newB = Math.round(b + (target - b) * shiftFactor);

    return `rgb(${newR}, ${newG}, ${newB})`;
}

function getPaneStyle(feature: Feature<Geometry, Pane> | undefined) {
    // Required by React Leaflet's StyleFunction type
    if (!feature) {
        return {};
    }

    return ({
        fillColor: getColorFromWinningProportion(
            feature.properties.winningColor,
            feature.properties.winningProportion
        ),
        weight: 1,
        opacity: 1,
        color: "black",
        fillOpacity: 0.8
    });
}

// Get bounds of the GeoJSON and use it shift the map view, enabling all the panes to be captured.
// This means we do not need to hard code the centre of the map
function FitMapToGeoJson({ geoJson }: { geoJson: FeatureCollection<Geometry, Pane> }) {
    const map = useMap();

    useEffect(() => {
        const layer = L.geoJSON(geoJson);
        if (layer.getBounds().isValid()) {
            map.fitBounds(layer.getBounds());
        }
    }, [geoJson, map]);

    return null;
}

function ElectoralMap({
    geoJson,
    geoJsonKey,
    updateHoveredLocationOnHoverPane,
    updateHoveredLocationOnLeavePane,
    handleSelectedPane 
}: ElectoralMapProps) {
    const MAP_ATTRIBUTION: string = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const MAP_URL ="https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    // When mouse hovers above a pane, we highlight the pane
    const onHoverPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        updateHoveredLocationOnHoverPane(layer.feature.properties);

        layer.setStyle({
            weight: 3,
            fillOpacity: 1
        });
    };

    // When mouse no longers hovers above pane, do not highlight it anymore
    const onLeavePane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };

        updateHoveredLocationOnLeavePane();

        layer.setStyle(getPaneStyle(layer.feature));
    };

    // If a pane is clicked
    // If the pane is a division, show the regional panes for that division
    // Otherwise, nothing happens
    const onClickPane = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };
        const pane = layer.feature.properties;

        handleSelectedPane(pane);
    };

    // Handles mouse actions on the panes
    const onEachPane = (_feature: Feature<Geometry, Pane>, layer: Path) => {
        layer.on({
            mouseover: onHoverPane,
            mouseout: onLeavePane,
            click: onClickPane
        });
    };

    const mapStyle = {
        height: "100%",
        width: "100%"
    };

    return <MapContainer 
        center={[0, 0]} // Placeholder coordinates
        zoom={5}
        scrollWheelZoom={true}
        style={mapStyle}
    >
        <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_URL} />
        <GeoJSON
            key={geoJsonKey}
            data={geoJson}
            style={getPaneStyle}
            onEachFeature={onEachPane}
        />
        <FitMapToGeoJson geoJson={geoJson} />
    </MapContainer>
}

export default ElectoralMap;