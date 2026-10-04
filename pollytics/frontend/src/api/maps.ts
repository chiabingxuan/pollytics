import type { FeatureCollection } from "geojson";

import { API_URL } from "./params";
import { APIError } from "../utils/APIError";

export async function fetchDivisionMaps(electionId: number): Promise<FeatureCollection> {
    const response = await fetch(`${API_URL}/election_maps/${electionId}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "The election ID provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch division maps.");
        }
    }

    const mapsJson = await response.json();

    return mapsJson;
}

export async function fetchRegionMaps(electionId: number, divisionId: number): Promise<FeatureCollection> {
    const response = await fetch(`${API_URL}/election_maps/${electionId}/div_maps/${divisionId}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "Either the election ID or the division ID provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch region maps.");
        }
    }

    const mapsJson = await response.json();

    return mapsJson;
}
