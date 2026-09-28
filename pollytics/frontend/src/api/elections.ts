import type { Election, ElectionsResponse } from "../types";
const API_URL = "http://127.0.0.1:8000/api";
const MAX_ELECTIONS_PER_PAGE = 5;

export async function fetchElection(electionId: string): Promise<Election> {
    const response = await fetch(`${API_URL}/elections/${electionId}`);

    if (!response.ok) {
        switch (response.status) {
            case 404:
                throw new Error("This election does not exist.");

            case 422:
                throw new Error("The election ID provided is invalid.");

            default:
                throw new Error("Failed to fetch election data.");
        }
    }

    const election = await response.json();

    return election;
}

export async function fetchElections(after: number | null): Promise<ElectionsResponse> {
    const params = new URLSearchParams({
        limit: MAX_ELECTIONS_PER_PAGE.toString()
    });

    if (after !== null) {
        params.set("after", after.toString());
    }

    const response = await fetch(`${API_URL}/elections/?${params}`);

    if (!response.ok) {
        throw new Error("Failed to fetch elections");
    }

    const data = await response.json();

    return {
        elections: data.elections,
        hasMoreElections: data.has_more
    };
}