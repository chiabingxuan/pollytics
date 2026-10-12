import { INDEPENDENT_COLOR } from "./colorUtils";

import type {
    CollatedResult,
    FormattedHistoricalData,
    FormattedResult,
    Location,
    YearResult,
} from "./types";

const INDEPENDENT_NAME = "INDEPENDENT";

export function formatAllResults(collatedRes: CollatedResult): FormattedResult[] {
    // Pool all the vote counts for this location and find total votes
    const allResults = [
        ...collatedRes.participations.map((result) => ({
            ...result,
            party: result.party ?? INDEPENDENT_NAME,  // if party is null, it means the candidate is an independent with no party affiliation
            color: result.color ?? INDEPENDENT_COLOR  // if color is null, it means the candidate is an independent with no party affiliation - give a special colour for independents
        })),
        // Other results do not have a party, so we add a null party here.
        // This gives participation results and other results the same structure,
        // allowing them to be handled uniformly when displayed in the sidebar.
        ...collatedRes.other.map((result) => ({
            ...result,
            party: null
        }))
    ]
    const totalVotes = allResults.reduce(
        (total, result) => total + result.votes,
        0
    );

    // Add vote proportions to the results of this location
    const formattedResults = allResults.map((result) => ({
        ...result,
        proportion: result.votes / totalVotes
    }));

    return formattedResults;
}

export function getBestResult(location: Location, formattedResults: FormattedResult[]): FormattedResult {
    // There should always be at least one result for the location in question.
    // The backend API has an assertion that will be flagged if the location queried
    // has no results. Thus the error below should never be thrown.
    const [firstResult, ...remainingResults] = formattedResults;

    if (!firstResult) {
        throw new Error(
            `No results found for ${location.type} ${location.name} (id: ${location.id}).`
        );
    }

    // Find the winner of the location
    const bestResult = remainingResults.reduce(
        (bestRes, res) => res.votes > bestRes.votes ? res : bestRes,
        firstResult
    );

    return bestResult;
}

export function getFormattedHistoricalData(
    historicalResults: YearResult[]
): FormattedHistoricalData {
    // Maps party name to colour
    const partyColors = new Map<string, string>();

    const data = historicalResults.map((yearRes) => {
        const year = yearRes.year;
        const formattedResultsForYear = formatAllResults(yearRes.results);

        // Maps party name to voting proportion.
        // For independents, we combine the voting proportions across all of them
        const partyNamesToProportions: Record<string, number> = {};

        for (const result of formattedResultsForYear) {
            // If results have no party, it belongs to an exceptional voting category.
            // We do not need to plot these in the line graph
            if (result.party === null) {
                continue;
            }

            // The result is not an exceptional voting category.
            // Since formatAllResults() has already been called,
            // the colour of a non-exceptional result should no longer be empty
            if (result.color === null) {
                throw new Error(`Missing color for ${result.party}.`);
            }

            partyColors.set(result.party, result.color);

            // Populate party -> proportion mapping for this year
            if (result.party in partyNamesToProportions) {
                // For a given year, we should not have multiple results for the same
                // party (exception: multiple independents are allowed)
                if (result.party !== INDEPENDENT_NAME) {
                    throw new Error(`Multiple results for ${result.party} detected in ${year}.`);
                }

                // Combine results across all independent candidates
                partyNamesToProportions[result.party] += result.proportion;
            }

            else {
                partyNamesToProportions[result.party] = result.proportion;
            }
        }

        return {
            year: year,
            partyNamesToProportions
        };
    });

    return {
        data: data.sort((a, b) => a.year - b.year),
        distinctPartiesInvolved: [...partyColors].map(([name, color]) => ({
            name,
            color
        }))
    };
}