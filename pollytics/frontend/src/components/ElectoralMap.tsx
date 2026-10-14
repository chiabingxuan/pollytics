import L from "leaflet";
import { useEffect } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { LeafletMouseEvent, Path } from "leaflet";

import { DEFAULT_COLOR, getColorFromWinningProportion } from "../utils/colorUtils";
import type { Level, Pane } from "../utils/types";

import Legend from "./Legend";

import "./ElectoralMap.css";

interface ElectoralMapProps {
    geoJson: FeatureCollection<Geometry, Pane>;
    currentView: Level;
    setHoveredLocationPaneOnHover: (pane: Pane) => void;
    setHoveredLocationPaneOnLeave: () => void;
    handleSelectedFeature: (feature: Feature<Geometry, Pane>) => void;
}

interface FitMapToGeoJsonProps {
    geoJson: FeatureCollection<Geometry, Pane>;
    zoom: number;
}

export function getFeatureStyle(feature: Feature<Geometry, Pane> | undefined) {
    // Required by React Leaflet's StyleFunction type
    if (!feature) {
        return {};
    }

    // Give default colour if the category doesn't have an associated colour (ie. an exceptional voting category)
    const baseColor: string = feature.properties.winningColor ?? DEFAULT_COLOR;

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
function FitMapToGeoJson({ geoJson, zoom }: FitMapToGeoJsonProps) {
    const map = useMap();

    useEffect(() => {
        const layer = L.geoJSON(geoJson);
        if (layer.getBounds().isValid()) {
            map.fitBounds(layer.getBounds(), { maxZoom: zoom });
        }
    }, [geoJson, map]);

    return null;
}

function ElectoralMap({
    geoJson,
    currentView,
    setHoveredLocationPaneOnHover,
    setHoveredLocationPaneOnLeave,
    handleSelectedFeature
}: ElectoralMapProps) {
    const MAP_ATTRIBUTION: string = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const MAP_URL ="https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const ZOOM: number = 6;

    // When mouse hovers above a feature, we highlight the corresponding pane
    const onHoverFeature = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };
        const pane: Pane = layer.feature.properties;
        
        setHoveredLocationPaneOnHover(pane);

        layer.setStyle({
            weight: 3,
            fillOpacity: 1
        });
    };

    // When mouse no longers hovers above feature, do not highlight the corresponding pane anymore
    const onLeaveFeature = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };
        const feature: Feature<Geometry, Pane> = layer.feature;

        setHoveredLocationPaneOnLeave();

        layer.setStyle(getFeatureStyle(feature));
    };

    // If a feature is clicked
    // If the pane is a division, show the regional panes for that division
    // Otherwise, nothing happens
    const onClickFeature = (e: LeafletMouseEvent) => {
        const layer = e.target as Path & {
            feature: Feature<Geometry, Pane>;
        };
        const feature: Feature<Geometry, Pane> = layer.feature;

        handleSelectedFeature(feature);
    };

    // Handles mouse actions on the features
    const onEachFeature = (_feature: Feature<Geometry, Pane>, layer: Path) => {
        layer.on({
            mouseover: onHoverFeature,
            mouseout: onLeaveFeature,
            click: onClickFeature
        });
    };

    return (
        <div className="electoral-map">
            <MapContainer 
                center={[0, 0]} // Placeholder coordinates
                zoom={ZOOM}
                scrollWheelZoom={true}
            >
                <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_URL} />

                {/* Use a key to force GeoJSON layer to be recreated when switching between
                complete view, division view and regional view. This ensures Leaflet correctly renders all division panes when
                returning from a selected division */}
                <GeoJSON
                    key={currentView}
                    data={geoJson}
                    style={getFeatureStyle}
                    onEachFeature={onEachFeature}
                />

                <FitMapToGeoJson geoJson={geoJson} zoom={ZOOM}/>
            </MapContainer>
            <Legend geoJson={geoJson} />
        </div>
    );
}

export default ElectoralMap;