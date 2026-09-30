import { API_URL } from "./params";
import type { DivisionResult } from "../types";

export async function fetchDivisionResults(electionId: number): Promise<DivisionResult[]> {
    const response = await fetch(`${API_URL}/election_results/${electionId}`);

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

    const resultsJson = await response.json();

    return resultsJson;
}
