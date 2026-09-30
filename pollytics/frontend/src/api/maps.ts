import type { FeatureCollection } from "geojson";
import { API_URL } from "./params";

export async function fetchDivisionMaps(electionId: number): Promise<FeatureCollection> {
    const response = await fetch(`${API_URL}/election_maps/${electionId}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new Error(error.detail);

            case 422:
                throw new Error("The election ID provided is invalid.");

            default:
                throw new Error("Failed to fetch election data.");
        }
    }

    const mapsJson = await response.json();

    return mapsJson;
}
