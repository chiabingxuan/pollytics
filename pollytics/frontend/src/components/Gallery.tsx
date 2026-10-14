import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

import type {
    FormattedHistoricalData,
    FormattedHistoricalRecord,
    Pane
} from "../utils/types";

import "./Gallery.css";

interface GalleryProps {
    selectedDivisionPane: Pane | null;
    selectedRegionPane: Pane | null;
    selectedDivisionHistoricalData: FormattedHistoricalData | null;
    selectedRegionHistoricalData: FormattedHistoricalData | null;
}

function getLineGraph(
    pane: Pane | null,
    historicalData: FormattedHistoricalData | null
) {
    if (!pane) {
        return;
    }

    if (!historicalData) {
        throw new Error(
            "The target pane is not null, but its corresponding historical data is null"
        );
    }

    return (
        <section className="historical-display">
            <h2>Historical Voting Trends in {pane.name}</h2>

            <div className="historical-graph">
                <ResponsiveContainer width="100%">
                    <LineChart data={historicalData.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="year"
                            height={45}
                            label={{
                                value: "Year",
                                position: "insideBottom",
                            }}
                        />
                        <YAxis
                            label={{
                                value: "Vote share / %",
                                angle: -90,
                                position: "insideLeft",
                            }}
                        />
                        <Tooltip
                            formatter={(value) => `${Number(value).toFixed(3)}%`} // Round percentages to 3 dp
                            itemSorter={(item) => -Number(item.value)} // Sort by descending percentage
                        />
                        <Legend />

                        {historicalData.distinctPartiesInvolved.map(({ name, color }) => (
                            <Line
                                key={name}
                                name={name}
                                stroke={color}
                                strokeWidth={2}
                                dot={{ fill: color, stroke: color }}
                                activeDot={{ fill: color, stroke: color }}
                                dataKey={(record: FormattedHistoricalRecord) => {
                                    if (!(name in record.partyNamesToProportions)) {
                                        return null;
                                    }

                                    // Convert to percentage
                                    return record.partyNamesToProportions[name] * 100;
                                }}
                                connectNulls={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

function Gallery({ 
    selectedDivisionPane,
    selectedRegionPane,
    selectedDivisionHistoricalData,
    selectedRegionHistoricalData
}: GalleryProps) {
    if (!selectedDivisionPane) {
        // If there is no selected division, then there should not be a selected region
        if (selectedRegionPane) {
            throw new Error("There is a selected region but no selected division.");
        }

        return;
    }

    return (
        <section className="gallery">
            {selectedDivisionPane && getLineGraph(selectedDivisionPane, selectedDivisionHistoricalData)}
            {selectedRegionPane && getLineGraph(selectedRegionPane, selectedRegionHistoricalData)}
        </section>
    );
}

export default Gallery;