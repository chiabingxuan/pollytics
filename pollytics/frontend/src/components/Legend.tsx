import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Pane } from "../types";
import { assignDefaultColorIfNeeded, COLOR_INTERVALS, shiftColorToIntervalShade } from "../utils/colorUtils";
import type { ColorInterval } from "../utils/colorUtils";

import "./Legend.css";

interface LegendProps {
    geoJson: FeatureCollection<Geometry, Pane>;
}

// Get all colours that will show up in the panes
function getAllDistinctWinningColors(geoJson: FeatureCollection<Geometry, Pane>): string[] {
    const winningColors: string[] = geoJson.features.map(
        (feature: Feature<Geometry, Pane>) => feature.properties.winningColor
    )
        .map(assignDefaultColorIfNeeded);

    return [...new Set(winningColors)];
}

function getIntervalText(interval: ColorInterval) {
    // If it is the first interval, format with a "<" sign
    if (interval.index === 0) {
        return `<${interval.max * 100}%`;
    }

    return `${interval.min * 100}-${interval.max * 100}%`;
}

function Legend({ geoJson }: LegendProps) {
    const distinctWinningColors: string[] = getAllDistinctWinningColors(geoJson);

    return (
        <aside className="legend">
            <table>
                <tbody>
                    {COLOR_INTERVALS.map((interval: ColorInterval) => (
                        <tr key={getIntervalText(interval)}>
                            {/* Percentage label for this interval */}
                            <th>{getIntervalText(interval)}</th>

                            {/* Shades for this interval, for each base colour */}
                            {distinctWinningColors.map((baseColor) => (
                                <td key={baseColor}>
                                    <div
                                        className="legend-color"
                                        style={{
                                            backgroundColor: shiftColorToIntervalShade(baseColor, interval)
                                        }}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </aside>
    );
}

export default Legend;