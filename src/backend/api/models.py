from pydantic import BaseModel, ConfigDict, Field 
from typing import Literal

class Election(BaseModel):
    id: int = Field(description="The ID of the election", ge=1)
    name: str = Field(description="The name of the election")
    year: int = Field(description="The year in which the election occurred", gt=0)
    country: str = Field(description="The location in which the election took place")
    type: Literal["PRESIDENT", "SENATE", "HOUSE", "GOVERNOR"] = Field(description="The type of election")


class Division(BaseModel):
    # To make Division hashable
    model_config = ConfigDict(frozen=True)

    id: int = Field(description="The ID of the division", ge=1)
    name: str = Field(description="The name of the division")
    type: Literal["COUNTRY", "STATE", "CONGRESSIONAL DISTRICT", "FEDERAL DISTRICT", "CONSTITUENCY"] = Field(description="The type of division")


class Region(BaseModel):
    # To make Region hashable
    model_config = ConfigDict(frozen=True)

    id: int = Field(description="The ID of the region", ge=1)
    name: str = Field(description="The name of the region")
    type: Literal["COUNTY OR EQUIVALENT", "PARISH", "FEDERAL DISTRICT", "STATE HOUSE DISTRICT"] = Field(description="The type of region")


class Results(BaseModel):
    name: str = Field(description="The name of the category that the votes belong to")
    color: str | None = Field(description="The colour associated with this category, to be filled on the dashboard maps", default=None)
    votes: int = Field(description="The number of votes for this category", ge=0)


class ParticipationResults(Results):
    party: str | None = Field(description="The name of the party associated with this participation", default=None)


class OtherResults(Results):
    name: Literal["OTHER", "SPOILED", "UNDERVOTES", "OVERVOTES"]
