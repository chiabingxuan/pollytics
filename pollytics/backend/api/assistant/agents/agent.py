from abc import ABC
from langchain.agents import create_agent

class Agent(ABC):
    def __init__(self, model, tools, system_prompt, response_format=None, middleware=()):
        self.agent = create_agent(
            model=model,
            tools=tools,
            system_prompt=system_prompt,
            response_format=response_format,
            middleware=middleware
        )
        self.has_response_format = response_format is not None

    def invoke(self, request):
        response = self.agent.invoke({"messages": [("user", request)]})

        if self.has_response_format:
            return response["structured_response"]
        
        return response["messages"][-1].content