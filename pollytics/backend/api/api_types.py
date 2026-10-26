from pydantic import BaseModel, ConfigDict, Field 
from typing import Literal, TypeAlias


ElectionType: TypeAlias = Literal["PRESIDENT", "SENATE", "HOUSE", "GOVERNOR"]

# Data models
class Election(BaseModel):
    id: int = Field(description="The unique ID of the election", ge=1)
    name: str = Field(description="The name of the election")
    year: int = Field(description="The year in which the election occurred", gt=0)
    country: str = Field(description="The country in which the election took place")
    type: ElectionType = Field(description="The type of election")


class Division(BaseModel):
    # To make Division hashable
    model_config = ConfigDict(frozen=True)

    id: int = Field(description="The unique ID of the division", ge=1)
    name: str = Field(description="The name of the division")
    type: Literal["COUNTRY", "STATE", "CONGRESSIONAL DISTRICT", "FEDERAL DISTRICT", "CONSTITUENCY"] = Field(description="The administrative type of the division")


class Region(BaseModel):
    # To make Region hashable
    model_config = ConfigDict(frozen=True)

    id: int = Field(description="The unique ID of the region", ge=1)
    name: str = Field(description="The name of the region")
    type: Literal["COUNTY OR EQUIVALENT", "PARISH", "FEDERAL DISTRICT", "STATE HOUSE DISTRICT"] = Field(description="The administrative type of the region")


class Result(BaseModel):
    name: str = Field(description="The name of the category that the votes belong to")
    color: str | None = Field(description="The colour associated with this category, used to display the category on the dashboard map", default=None)
    votes: int = Field(description="The number of votes received by this category", ge=0)


class ParticipationResult(Result):
    party: str | None = Field(description="The political party associated with this participation", default=None)


class OtherResult(Result):
    name: Literal["OTHER", "SPOILED", "UNDERVOTES", "OVERVOTES"] = Field(description="The category of exceptional or non-standard votes")


# Models to return to the frontend
class ElectionsResponse(BaseModel):
    elections: list[Election] = Field(description="The list of elections in the current batch")
    has_more: bool = Field(description="Whether or not more elections are available beyond the current batch")


class CollatedLocationResult(BaseModel):
    participations: list[ParticipationResult] = Field(description="The election results associated with participations")
    other: list[OtherResult] = Field(description="Exceptional or non-standard vote results, such as minor candidates, undervotes and overvotes")


class DivisionResult(BaseModel):
    division: Division = Field(description="The division to which these election results belong")
    results: CollatedLocationResult = Field(description="The election results recorded for this division")


class RegionResult(BaseModel):
    region: Region = Field(description="The region to which these election results belong")
    results: CollatedLocationResult = Field(description="The election results recorded for this region")


class YearResult(BaseModel):
    year: int = Field(description="The year of this specific election cycle", gt=0)
    results: CollatedLocationResult = Field(description="The election results recorded for this year's cycle")
