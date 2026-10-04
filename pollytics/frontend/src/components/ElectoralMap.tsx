import { useEffect } from "react";
import L from "leaflet";
import type { LeafletMouseEvent, Path } from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import Legend from "./Legend";
import type { Pane } from "../types";
import { assignDefaultColorIfNeeded, getColorFromWinningProportion } from "../utils/colorUtils";

import "./ElectoralMap.css";

interface ElectoralMapProps {
    geoJson: FeatureCollection<Geometry, Pane>;
    geoJsonKey: string;
    updateHoveredLocationOnHoverPane: (pane: Pane) => void;
    updateHoveredLocationOnLeavePane: () => void;
    handleSelectedPane: (pane: Pane) => void;
}

export function getPaneStyle(feature: Feature<Geometry, Pane> | undefined) {
    // Required by React Leaflet's StyleFunction type
    if (!feature) {
        return {};
    }

    // Give default colour if the category doesn't have an associated colour
    const baseColor: string = assignDefaultColorIfNeeded(feature.properties.winningColor);

    return ({
        fillColor: getColorFromWinningProportion(
            baseColor,
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
            map.fitBounds(layer.getBounds(), { maxZoom: 6 });
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

    return <div className="electoral-map">
        <MapContainer 
            center={[0, 0]} // Placeholder coordinates
            zoom={6}
            scrollWheelZoom={true}
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
        <Legend geoJson={geoJson} />
    </div>

}

export default ElectoralMap;