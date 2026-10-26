from datetime import date
from pydantic import BaseModel, Field, HttpUrl
from typing import Any


### SEARCH AGENT TYPES ###
class WebSource(BaseModel):
    title: str = Field(description="Title of the webpage")
    website: str = Field(description="Website or publisher name")
    date_published: date = Field(description="The approximate date of publication of the webpage")
    url: HttpUrl = Field(description="Direct URL of the webpage")
    quotes: list[str] = Field(
        min_length=1,
        description="Exact quotations copied from the webpage"
    )

class SearchAgentResponse(BaseModel):
    sources: list[WebSource] = Field(description="Web sources relevant to the supervisor agent's request")


### DATABASE AGENT TYPES ###
class DatabaseSource(BaseModel):
    sql_query: str = Field(description="Read-only SQL query used to retrieve supporting data")

class DatabaseFinding(BaseModel):
    question: str = Field(description="Specific research question addressed by this finding")
    answer: str = Field(description="Answer derived exclusively from the supporting database rows")
    sources: list[DatabaseSource] = Field(description="Database queries supporting this finding")

class DatabaseAgentResponse(BaseModel):
    findings: list[DatabaseFinding] = Field(description="Database findings relevant to the Supervisor Agent's request")
    

### SUPERVISOR AGENT TYPES ###
class AssistantResponse(BaseModel):
    answer: str = Field(description="A clear answer to the user's query, to be displayed to the user")
    web_sources: list[WebSource] = Field(description="Web sources used to support the answer")
    database_sources: list[DatabaseSource] = Field(description="Database queries used to support the answer")