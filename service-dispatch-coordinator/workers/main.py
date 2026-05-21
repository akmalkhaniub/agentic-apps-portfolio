import sys
import json
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

def negotiate_job(job_description, technician_name, technician_skills):
    # Define Agents
    dispatcher = Agent(
        role='Service Dispatcher',
        goal=f'Convince {technician_name} to accept the emergency job.',
        backstory='You are a master negotiator. You highlight the urgency and the potential bonus for this emergency work.',
        verbose=True,
        allow_delegation=False
    )

    technician = Agent(
        role='Field Technician',
        goal='Decide whether to accept the job based on skills and urgency.',
        backstory=f'You are {technician_name}, skilled in {technician_skills}. You are currently tired but willing to work for the right incentive.',
        verbose=True,
        allow_delegation=False
    )

    # Define Tasks
    negotiation_task = Task(
        description=f"""
        1. Dispatcher: Present the job ({job_description}) to {technician_name}.
        2. Technician: Evaluate the job against your skills ({technician_skills}).
        3. Negotiation: The dispatcher and technician discuss. 
        4. Final Decision: {technician_name} must output exactly 'ACCEPTED' or 'REJECTED'.
        """,
        agent=dispatcher,
        expected_output="'ACCEPTED' or 'REJECTED'"
    )

    crew = Crew(
        agents=[dispatcher, technician],
        tasks=[negotiation_task],
        process=Process.sequential
    )

    result = crew.kickoff()
    return result

if __name__ == "__main__":
    if len(sys.argv) > 3:
        desc = sys.argv[1]
        name = sys.argv[2]
        skills = sys.argv[3]
        print(negotiate_job(desc, name, skills))
    else:
        # Default test
        print(negotiate_job("Emergency pipe burst", "John Doe", "Plumbing"))
