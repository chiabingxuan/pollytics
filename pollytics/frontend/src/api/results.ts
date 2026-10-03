import { API_URL } from "./params";
import type { Division, DivisionResult, DivisionResultResponse, Region, RegionResult, RegionResultResponse } from "../types";
import { APIError } from "../utils/APIError";

export async function fetchDivisionResults(electionId: number): Promise<DivisionResult[]> {
    const response = await fetch(`${API_URL}/election_results/${electionId}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "The election ID provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch division results.");
        }
    }

    const resultsJson: DivisionResultResponse[] = await response.json();
    
    return resultsJson.map((result) => {
        const location: Division = {
            ...result.division,
            level: "DIVISION" // add a label so that we can distinguish between divisions / regions later
        };

        return {
            // Change the key from division to location
            location: location,
            results: result.results
        };
    });
}

export async function fetchRegionResults(electionId: number, divisionId: number): Promise<RegionResult[]> {
    const response = await fetch(`${API_URL}/election_results/${electionId}/div_results/${divisionId}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "Either the election ID or division ID provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch region results.");
        }
    }

    const resultsJson: RegionResultResponse[] = await response.json();
    
    return resultsJson.map((result) => {
        const location: Region = {
            ...result.region,
            level: "REGION" // add a label so that we can distinguish between divisions / regions later
        };

        return {
            // Change the key from region to location
            location: location,
            results: result.results
        };
    });
}

