from datetime import date
from pydantic import BaseModel, Field, HttpUrl


class WebSource(BaseModel):
    title: str = Field(description="Title of the webpage")
    website: str = Field(description="Website or publisher name")
    date_published: date = Field(description="The approximate date of publication of the webpage")
    url: HttpUrl = Field(description="Direct URL of the webpage")
    quotes: list[str] = Field(
        min_length=1,
        description="Exact quotations copied from the webpage"
    )

class DatabaseSource(BaseModel):
    sql_query: str = Field(description="Read-only SQL query used to retrieve supporting data")

class AssistantResponse(BaseModel):
    answer: str = Field(description="A clear answer to the user's query, to be displayed to the user")
    web_sources: list[WebSource] = Field(description="Web sources used to support the answer")
    database_sources: list[DatabaseSource] = Field(description="Database queries used to support the answer")