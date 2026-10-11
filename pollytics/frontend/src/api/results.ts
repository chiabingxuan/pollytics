import { API_URL } from "./params";

import { Level, type Division, type DivisionResult, type DivisionResultResponse, type Region, type RegionResult, type RegionResultResponse, type YearResult } from "../types";
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
            level: Level.DIVISION // add a label so that we can distinguish between divisions / regions later
        };

        return {
            // Change the key from division to location
            location: location,
            results: result.results
        };
    });
}

export async function fetchHistoricalResultsForDivision(
    divisionId: number,
    electionCountry: string,
    electionType: string
): Promise<YearResult[]> {
    const params = new URLSearchParams({
        country: electionCountry,
        type: electionType
    });

    const response = await fetch(`${API_URL}/historical_results/div_results/${divisionId}?${params}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "Either the division ID, election country or election type provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch historical election results for this division.");
        }
    }

    return await response.json();
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
            level: Level.REGION // add a label so that we can distinguish between divisions / regions later
        };

        return {
            // Change the key from region to location
            location: location,
            results: result.results
        };
    });
}

export async function fetchHistoricalResultsForRegion(
    regionId: number,
    electionCountry: string,
    electionType: string
): Promise<YearResult[]> {
    const params = new URLSearchParams({
        country: electionCountry,
        type: electionType
    });

    const response = await fetch(`${API_URL}/historical_results/region_results/${regionId}?${params}`);

    if (!response.ok) {
        const error = await response.json();

        switch (response.status) {
            case 404:
                throw new APIError(error.detail.code, error.detail.message);

            case 422:
                throw new APIError("INVALID_INPUTS", "Either the region ID, election country or election type provided is invalid.");

            default:
                throw new APIError("DEFAULT_FETCH_ERROR", "Failed to fetch historical election results for this region.");
        }
    }

    return await response.json();
}