
import type { ElectionsResponse } from "../types";
const API_URL = "http://127.0.0.1:8000";
const MAX_ELECTIONS_PER_PAGE = 5;

export async function fetchElectionsFromApi(after: number | null): Promise<ElectionsResponse> {
    const params = new URLSearchParams({
        limit: MAX_ELECTIONS_PER_PAGE.toString()
    });

    if (after !== null) {
        params.set("after", after.toString());
    }

    const response = await fetch(`${API_URL}/api/elections/?${params}`);

    if (!response.ok) {
        throw new Error("Failed to fetch elections");
    }

    const data = await response.json();

    return {
        elections: data.elections,
        hasMoreElections: data.has_more
    };
}