from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
import json
from pydantic_geojson import FeatureModel, FeatureCollectionModel
from models import Division, Election, OtherResults, ParticipationResults, Region, Results
import os
from supabase import create_client, Client
from typing import Annotated, Literal

load_dotenv()

app = FastAPI()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)


@app.get("/elections/")
async def get_elections(
    election_id_lower_bound: Annotated[int, Query(description="The smallest election ID to retrieve", alias="low", ge=1)],
    election_id_upper_bound: Annotated[int, Query(description="The largest election ID to retrieve", alias="high")],
) -> list[Election]:
    # Check if id bounds are valid
    if election_id_lower_bound > election_id_upper_bound:
        raise HTTPException(
            status_code=400,
            detail="Lower bound of election ID should not be greater than upper bound of election ID"
        )

    # Get elections whose ids fall within the specified range
    response = supabase.table("elections") \
        .select("id, name, year, countries(name), type") \
        .gte("id", election_id_lower_bound) \
        .lte("id", election_id_upper_bound) \
        .order("id", desc=False) \
        .execute()

    return [
        Election(
            id=result["id"],
            name=result["name"],
            year=result["year"],
            country=result["countries"]["name"],
            type=result["type"]
        ) for result in response.data
    ]


@app.get("/elections/{election_id}")
async def get_division_results(
    election_id: Annotated[int, Path(description="The election ID to retrieve division results from", ge=1)]
) -> list[dict[Literal["division", "results"], Division | dict[Literal["participations", "other"], list[Results]]]]:
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
    division_results = dict()

    # Add in participation vote counts to mapping
    for result in participation_results_response.data:
        division = Division(
            id=result["division_id"],
            name=result["division_name"],
            type=result["division_type"]
        )

        formatted_result = ParticipationResults(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if division not in division_results:
            division_results[division] = dict()

        if "participations" not in division_results[division]:
            division_results[division]["participations"] = list()

        division_results[division]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same division)
    for result in other_results_response.data:
        division = Division(
            id=result["division_id"],
            name=result["division_name"],
            type=result["division_type"]
        )

        formatted_result = OtherResults(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if division not in division_results:
            division_results[division] = dict()

        if "other" not in division_results[division]:
            division_results[division]["other"] = list()

        division_results[division]["other"].append(formatted_result)

    return [
        {
            "division": division,
            "results": results
        } for division, results in division_results.items()
    ]


@app.get("/elections/{election_id}/divisions/{division_id}")
async def get_region_results(
    election_id: Annotated[int, Path(description="The election ID to retrieve regional results from", ge=1)],
    division_id: Annotated[int, Path(description="The division ID to retrieve regional results from", ge=1)]
) -> list[dict[Literal["region", "results"], Region | dict[Literal["participations", "other"], list[Results]]]]:
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

        formatted_result = ParticipationResults(
            name=result["candidate_name"],
            party=result["party_name"],
            color=result["party_color"],
            votes=result["votes"]
        )

        if region not in region_results:
            region_results[region] = dict()

        if "participations" not in region_results[region]:
            region_results[region]["participations"] = list()

        region_results[region]["participations"].append(formatted_result)

    # Combine with other vote counts (wrt the same region)
    for result in other_results_response.data:
        region = Region(
            id=result["region_id"],
            name=result["region_name"],
            type=result["region_type"]
        )

        formatted_result = OtherResults(
            name=result["vote_type"],
            votes=result["votes"]
        )

        if region not in region_results:
            region_results[region] = dict()

        if "other" not in region_results[region]:
            region_results[region]["other"] = list()

        region_results[region]["other"].append(formatted_result)

    return [
        {
            "region": region,
            "results": results
        } for region, results in region_results.items()
    ]


@app.get("/election_maps/{election_id}")
async def get_division_maps(
    election_id: Annotated[int, Path(description="The election ID to retrieve division maps from", ge=1)]
) -> FeatureCollectionModel:
    response = supabase.rpc(
        "get_division_geometry",
        {"p_election_id": election_id}
    ).execute()

    # Create GeoJSON Features
    features = [
        FeatureModel(
            type="Feature",
            geometry=row["geometry"],
            properties={"id": row["division_id"], "name": row["division_name"]}
        )
        for row in response.data
    ]

    return FeatureCollectionModel(type="FeatureCollection", features=features)


@app.get("/election_maps/{election_id}/div_maps/{division_id}")
async def get_region_maps(
    election_id: Annotated[int, Path(description="The election ID to retrieve regional maps from", ge=1)],
    division_id: Annotated[int, Path(description="The division ID to retrieve regional maps from", ge=1)]
) -> FeatureCollectionModel:
    response = supabase.rpc(
        "get_region_geometry",
        {"p_election_id": election_id, "p_division_id": division_id}
    ).execute()

    # Create GeoJSON Features
    features = [
        FeatureModel(
            type="Feature",
            geometry=row["geometry"],
            properties={"id": row["region_id"], "name": row["region_name"]}
        )
        for row in response.data
    ]

    return FeatureCollectionModel(type="FeatureCollection", features=features)