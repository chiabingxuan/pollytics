import type { Feature, Geometry } from "geojson";
import type { Pane } from "../types";

export const DEFAULT_COLOR: string = "#6B7280";

function getColorFromWinningProportion(
    color: string | null,
    winningProportion: number
): string {
    // Give default colour if the category doesn't have an associated colouR
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

export function getPaneStyle(feature: Feature<Geometry, Pane> | undefined) {
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