from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic_geojson import FeatureModel, FeatureCollectionModel
from models import Division, DivisionResult, Election, ElectionsResponse, ElectionType, OtherResult, ParticipationResult, Region, RegionResult, YearResult
import os
from supabase import create_client, Client
from typing import Annotated, Any
from whitelist import ALLOWED_ORIGINS

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)


# Get a JSON representing the election details of the specified id
# If id does not exist, return None
def get_election_response(election_id):
    response = supabase.table("elections") \
        .select("id, name, year, countries!inner(name), type") \
        .eq("id", election_id) \
        .execute()

    if not response.data:
        return None

    assert len(response.data) == 1, (
        "Querying elections table with an id should return a single row, but it did not"
    )

    [election_json,] = response.data

    return election_json


def does_division_exist(division_id):
    response = supabase.table("divisions") \
        .select("*") \
        .eq("id", division_id) \
        .execute()
    
    return bool(response.data)


def does_region_exist(region_id):
    response = supabase.table("regions") \
        .select("*") \
        .eq("id", region_id) \
        .execute()
    
    return bool(response.data)


def does_race_exist(election_id, division_id):
    response = supabase.table("races") \
        .select("*") \
        .eq("election_id", election_id) \
        .eq("division_id", division_id) \
        .execute()
    
    return bool(response.data)


def do_elections_exist_for_election_country_and_type(election_country, election_type):
    response = supabase.table("elections") \
        .select("id", "countries!inner(name)") \
        .eq("countries.name", election_country) \
        .eq("type", election_type) \
        .execute()

    return bool(response.data)

    
@app.get("/api/elections/", response_model=ElectionsResponse)
async def get_elections(
    after: Annotated[int | None, Query(description="Only retrieve elections with an ID greater than this value", ge=1)] = None,
    limit: Annotated[int, Query(description="The maximum number of elections to return")] = 5,
) -> Any:    
    query = supabase.table("elections") \
        .select("id, name, year, countries(name), type") \
        .order("id", desc=False) \
        .limit(limit + 1)   # We retrieve one more election than the limit specified, to see if more results exist

    if after is not None:
        query = query.gt("id", after)

    # Get elections whose ids are greater than the id specified (if any), wrt the limit specified
    # We will retrieve the elections in ascending order of election id
    response = query.execute()

    elections = [
        Election(
            id=result["id"],
            name=result["name"],
            year=result["year"],
            country=result["countries"]["name"],
            type=result["type"]
        ) for result in response.data
    ]

    # Check if more results exist beyond the limit specified
    # Since we actually queried one more election, check if one more election was indeed obtained
    has_more = len(elections) > limit

    # Remove the extra trailing election queried, if any
    elections = elections[:limit]

    return {
        "elections": elections,
        "has_more": has_more
    }


@app.get("/api/elections/{election_id}")
async def get_election(
    election_id: Annotated[int, Path(description="The election ID to retrieve details from", ge=1)]
) -> Election:
    election_json_retrieved = get_election_response(election_id)
    if election_json_retrieved is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "This election does not exist."
            }
        )

    return Election(
        id=election_json_retrieved["id"],
        name=election_json_retrieved["name"],
        year=election_json_retrieved["year"],
        country=election_json_retrieved["countries"]["name"],
        type=election_json_retrieved["type"]
    )
    

@app.get("/api/election_results/{election_id}")
async def get_division_results_for_election(
    election_id: Annotated[int, Path(description="The election ID to retrieve division results from", ge=1)]
) -> list[DivisionResult]:
    election_json_retrieved = get_election_response(election_id)
    if election_json_retrieved is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "This election does not exist."
            }
        )
    
    # For each race in the election, get vote counts of each known participation
    participation_results_response = supabase.rpc(
        "get_division_participation_results",
        {"p_election_id": election_id}
    ).execute()

    # For each race in the election, get vote counts of other types
    other_results_response = supabase.rpc(
        "get_division_other_results",
        {"p_election_id": election_id}
    ).execute()

    # Maps each division to a dictionary of "participations" -> list of participation results
    # and "other" -> list of other results
    division_results = {}

    # Add in participation vote counts to mapping
    for result in participation_results_response.data:
        division = Division(
            id=result["division_id"],
            name=result["division_name"],
            type=result["division_type"]
        )

        formatted_result = ParticipationResult(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if division not in division_results:
            division_results[division] = {
                "participations": list(),
                "other": list()
            }

        division_results[division]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same division)
    for result in other_results_response.data:
        division = Division(
            id=result["division_id"],
            name=result["division_name"],
            type=result["division_type"]
        )

        formatted_result = OtherResult(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if division not in division_results:
            division_results[division] = {
                "participations": list(),
                "other": list()
            }

        division_results[division]["other"].append(formatted_result)

    division_results_list = [
        {
            "division": division,
            "results": results
        } for division, results in division_results.items()
    ]

    assert division_results_list, (
        "No results were found for this election. "
        + "This is a problem, as an election should have results."
    )

    return division_results_list


@app.get("/api/historical_results/div_results/{division_id}")
async def get_historical_results_for_division(
    division_id: Annotated[int, Path(description="The division ID to retrieve historical results from", ge=1)],
    country: Annotated[str, Query(description="The country in which the election cycle has been taking place")],
    type: Annotated[ElectionType, Query(description="The type of election")]
) -> list[YearResult]:
    if not does_division_exist(division_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DIVISION_NOT_FOUND",
                "message": "This division does not exist."
            }
        )

    if not do_elections_exist_for_election_country_and_type(country, type):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "There are no elections with the specified country and election type."
            }
        )

    # For each year the election took place, get vote counts of each known participation
    historical_participation_results_response = supabase.rpc(
        "get_historical_participation_results_for_division",
        {"p_division_id": division_id, "p_country_name": country, "p_election_type": type}
    ).execute()

    # For each year the election took place, get vote counts of other types
    historical_other_results_response = supabase.rpc(
        "get_historical_other_results_for_division",
        {"p_division_id": division_id, "p_country_name": country, "p_election_type": type}
    ).execute()

    # Maps each year to a dictionary of "participations" -> list of participation results
    # and "other" -> list of other results
    year_results = {}

    # Add in participation vote counts to mapping
    for result in historical_participation_results_response.data:
        year = result["year"]

        formatted_result = ParticipationResult(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if year not in year_results:
            year_results[year] = {
                "participations": list(),
                "other": list()
            }

        year_results[year]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same year)
    for result in historical_other_results_response.data:
        year = result["year"]

        formatted_result = OtherResult(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if year not in year_results:
            year_results[year] = {
                "participations": list(),
                "other": list()
            }

        year_results[year]["other"].append(formatted_result)

    year_results_list = [
        {
            "year": year,
            "results": results
        } for year, results in year_results.items()
    ]

    if not year_results_list:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DIVISION_HISTORICAL_DATA_NOT_FOUND",
                "message": "No historical data found for this division and the election cycle specified."
            }
        )

    return year_results_list


@app.get("/api/election_results/{election_id}/div_results/{division_id}")
async def get_region_results_for_election(
    election_id: Annotated[int, Path(description="The election ID to retrieve regional results from", ge=1)],
    division_id: Annotated[int, Path(description="The division ID to retrieve regional results from", ge=1)]
) -> list[RegionResult]:
    election_json_retrieved = get_election_response(election_id)
    if election_json_retrieved is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "This election does not exist."
            }
        )
    
    if not does_division_exist(division_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DIVISION_NOT_FOUND",
                "message": "This division does not exist."
            }
        )

    if not does_race_exist(election_id, division_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "RACE_NOT_FOUND",
                "message": "This division is not associated with this election."
            }
        )
    
    # For each region in the division, get vote counts of each known participation (for this election)
    participation_results_response = supabase.rpc(
        "get_region_participation_results",
        {"p_election_id": election_id, "p_division_id": division_id}
    ).execute()

    # For each region in the division, get vote counts of other types (for this election)
    other_results_response = supabase.rpc(
        "get_region_other_results",
        {"p_election_id": election_id, "p_division_id": division_id}
    ).execute()

    # Maps each region to a dictionary of "participations" -> list of participation results
    # and "other" -> list of other results
    region_results = dict()

    # Add in participation vote counts to mapping
    for result in participation_results_response.data:
        region = Region(
            id=result["region_id"],
            name=result["region_name"],
            type=result["region_type"]
        )

        formatted_result = ParticipationResult(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if region not in region_results:
            region_results[region] = {
                "participations": list(),
                "other": list()
            }

        region_results[region]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same region)
    for result in other_results_response.data:
        region = Region(
            id=result["region_id"],
            name=result["region_name"],
            type=result["region_type"]
        )

        formatted_result = OtherResult(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if region not in region_results:
            region_results[region] = {
                "participations": list(),
                "other": list()
            }

        region_results[region]["other"].append(formatted_result)

    region_results_list = [
        {
            "region": region,
            "results": results
        } for region, results in region_results.items()
    ]

    # No region results found for this division, 
    # even though this division is involved with this election
    if not region_results_list:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "REGION_DATA_NOT_FOUND",
                "message": "No regional results were found for this division, "
                    + "even though it is involved with this election."
            }
        )

    return region_results_list


@app.get("/api/historical_results/region_results/{region_id}")
async def get_historical_results_for_region(
    region_id: Annotated[int, Path(description="The region ID to retrieve historical results from")],
    country: Annotated[str, Query(description="The country in which the election cycle has been taking place")],
    type: Annotated[ElectionType, Query(description="The type of election")]
) -> list[YearResult]:
    if not does_region_exist(region_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "REGION_NOT_FOUND",
                "message": "This region does not exist."
            }
        )

    if not do_elections_exist_for_election_country_and_type(country, type):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "There are no elections with the specified country and election type."
            }
        )

    # For each year the election took place, get vote counts of each known participation
    historical_participation_results_response = supabase.rpc(
        "get_historical_participation_results_for_region",
        {"p_region_id": region_id, "p_country_name": country, "p_election_type": type}
    ).execute()

    # For each year the election took place, get vote counts of other types
    historical_other_results_response = supabase.rpc(
        "get_historical_other_results_for_region",
        {"p_region_id": region_id, "p_country_name": country, "p_election_type": type}
    ).execute()

    # Maps each year to a dictionary of "participations" -> list of participation results
    # and "other" -> list of other results
    year_results = {}

    # Add in participation vote counts to mapping
    for result in historical_participation_results_response.data:
        year = result["year"]

        formatted_result = ParticipationResult(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if year not in year_results:
            year_results[year] = {
                "participations": list(),
                "other": list()
            }

        year_results[year]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same year)
    for result in historical_other_results_response.data:
        year = result["year"]

        formatted_result = OtherResult(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if year not in year_results:
            year_results[year] = {
                "participations": list(),
                "other": list()
            }

        year_results[year]["other"].append(formatted_result)

    year_results_list = [
        {
            "year": year,
            "results": results
        } for year, results in year_results.items()
    ]

    if not year_results_list:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "REGION_HISTORICAL_DATA_NOT_FOUND",
                "message": "No historical data found for this region and the election cycle specified."
            }
        )

    return year_results_list


@app.get("/api/election_maps/{election_id}")
async def get_division_maps(
    election_id: Annotated[int, Path(description="The election ID to retrieve division maps from", ge=1)]
) -> FeatureCollectionModel:
    election_json_retrieved = get_election_response(election_id)
    if election_json_retrieved is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "This election does not exist."
            }
        )
    
    response = supabase.rpc(
        "get_division_geometry",
        {"p_election_id": election_id}
    ).execute()

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DIVISION_MAPS_NOT_FOUND",
                "message": "No division maps were found for this election."
            }
        )

    # Create GeoJSON Features
    features = [
        FeatureModel(
            type="Feature",
            geometry=row["geometry"],
            properties={"id": row["division_id"]}
        )
        for row in response.data
    ]

    return FeatureCollectionModel(type="FeatureCollection", features=features)


@app.get("/api/election_maps/{election_id}/div_maps/{division_id}")
async def get_region_maps(
    election_id: Annotated[int, Path(description="The election ID to retrieve regional maps from", ge=1)],
    division_id: Annotated[int, Path(description="The division ID to retrieve regional maps from", ge=1)]
) -> FeatureCollectionModel:
    # Check if election id exists in the database
    election_json_retrieved = get_election_response(election_id)
    if election_json_retrieved is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ELECTION_NOT_FOUND",
                "message": "This election does not exist."
            }
        )

    if not does_division_exist(division_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DIVISION_NOT_FOUND",
                "message": "This division does not exist."
            }
        )

    if not does_race_exist(election_id, division_id):
        raise HTTPException(
            status_code=404,
            detail={
                "code": "RACE_NOT_FOUND",
                "message": "This division is not associated with this election."
            }
        )
    
    response = supabase.rpc(
        "get_region_geometry",
        {"p_election_id": election_id, "p_division_id": division_id}
    ).execute()

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "REGION_DATA_NOT_FOUND",
                "message": "No regional maps were found for this division, "
                    + "even though it is involved with this election."
            }
        )

    # Create GeoJSON Features
    features = [
        FeatureModel(
            type="Feature",
            geometry=row["geometry"],
            properties={"id": row["region_id"]}
        )
        for row in response.data
    ]

    return FeatureCollectionModel(type="FeatureCollection", features=features)