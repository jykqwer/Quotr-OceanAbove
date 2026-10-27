## Requirement
Please build a web app for flight company **Ocean Above** that can book flight tickets for a user, with the following requirement
1. the app can take natural language as input.
2. **locations.db is the single source of truth.** It defines which cities exist, where they are, and which flights operate. 
3. locations.db has two tables:
    - `locations`: one row per city, with
        - `city_name`, e.g. `"Shanghai"`
        - `coordinate`, a point on a 2D map in km, e.g. `"23,11"`
        - `is_hub`, `1` if the city is a hub airport, otherwise `0`
        - `connected_hubs`, for a non-hub city, the hubs it has direct flights to, separated by `;`, e.g. `"London;Dubai"`. Empty for hubs.
    - `hub_links`: one row (`hub_a`, `hub_b`) per pair of hubs that have direct flights between them.
4. Direct flights exist **only** between two hubs listed together in `hub_links`, and between a non-hub city and each hub in its `connected_hubs`. Every flight operates in both directions. Passengers can change planes **only at hubs**. A non-hub city with an empty `connected_hubs` currently has no service.
5. When there is no direct flight between the two cities, the app finds the **cheapest** route. A route with transfers is booked as one ticket that contains all its legs.
6. The distance of a leg is the distance between the coordinates of its two cities in km. The flight distance of a ticket is the sum of its legs, and the flight price is `flight_distance * 0.13` in US dollars.
7. the app must confirm with the user the full route (every leg and transfer city), the flight distance and the flight price before booking the flight.
8. If the user asks for a city that has no service, the app tells the user and suggests the nearest city that has service.
9. The app knows all the tickets the user bought from the company, and the user can check the flight tickets they booked in natural language.
10. The user should be able to check all conversations they had in the app.

## None-requirement
1. the web app can be **hosted online** or can be totally **offline**, running in localhost 3000 is acceptable.
2. there does **not** need to be a solid user system, you can have a very basic one. The security of the user system is not required by the project. However, if you use a 3rd party user system, make sure you know how it works.

## Deliverable

Deliverable is flexible, and it can be
1. something hosted online: in this case, you should send us the link to your app and the codes of it (hosted online or in a file).
2. something that runs locally: in this case, you should send us the codes of the app and in the readme you should specify how to run the app.

In both cases, please also include:

1. **A design doc** that explains your design choices, covering at least:
    - the architecture and data flow of the app
    - the tools your agent has, and why you designed them that way
    - how routes, distances and prices are computed, and how you make sure the numbers shown to the user are correct
    - how you make sure nothing is booked without the user's confirmation
    - known limitations and failure modes, and what you would do next
2. **Prompt history.** We expect you to use coding agents. Put the **full, raw sessions** of every coding agent you used (e.g. the session files exported from Claude Code or Codex) in a folder named "**prompt history**". Do not edit or summarize them, and include the failed attempts and dead ends: we want to see how you worked with the agent, and mistakes you caught are a good thing. Remove any API keys or other secrets before sending.
3. **Optional:** if this were the real Ocean Above booking bot, what else would it need? You can implement them and explain your choice in design doc.
