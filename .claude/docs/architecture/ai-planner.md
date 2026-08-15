# CampusVibe AI Planner implementation guide

> ⚠ **Unverified against the code.** This is an implementation *guide*, written before the feature; it says what should be built.
> It does not follow [`implementation-docs`](../../skills/implementation-docs/SKILL.md).

**Code as of:** never — not reconciled with the code.

## Purpose

The AI Planner is a login-aware CampusVibe feature that helps users ask natural-language questions and receive personalized event and club recommendations, especially for planning things like weekends, evenings, or activities based on preferences.

The feature should feel like a dedicated planning assistant, not a generic search box. It should support conversational prompts, contextual recommendations, and structured plan output.

## Core UI Principle

Use a prominent AI planner card on the homepage with the heading:

**Plan with CampusVibe**

This card is the primary entry point for the AI planner experience.

## Homepage UI Requirements

The homepage should include:

* A prominent AI planner card.
* A clear input field for natural-language prompts
* Suggestion chips to help users start quickly
* A short explanatory line that communicates what the planner does
* A polished, modern layout that makes the feature feel premium and useful

### Suggested structure

* Heading: **Plan with CampusVibe**
* Supporting line: “Ask for events, clubs, or a personalized plan.”
* Prompt input: “What would you like to plan?”
* Suggestion chips:

  * Plan my weekend
  * Find free events
  * Beginner-friendly clubs
  * Meet people with similar interests

The suggestion chips should be clickable and should populate or replace the input prompt with a helpful starting query.

## Prompt Handling

The planner must accept natural language prompts such as:

* “Suggest some plans this weekend based on my preferences”
* “Find something fun after class on Friday”
* “Show me beginner-friendly clubs with social events”
* “Plan a low-budget Saturday for me”

Prompts should be treated as planning requests, not just keyword search queries.

## Authentication Behavior

Only logged-in users can receive AI planner answers.

If a guest user types into the planner:

1. Preserve the typed prompt.
2. Prompt them to sign in.
3. After authentication, restore the prompt automatically.
4. Submit the prompt and show the generated result.

Do not make the user retype the prompt after sign-in.

The sign-in prompt should clearly explain that login is needed for personalized suggestions.

## Intermediate Loading State

After the user submits a prompt, show a dedicated loading state before the result appears.

This loading state should communicate that the planner is working and personalizing the response.

### Loading state content

Show a message such as:

* “Planning your weekend…”
* “Finding events that match your interests…”
* “Checking your saved clubs and available events…”

Optionally include a short checklist-style list:

* Your interests
* Your saved events
* Your followed clubs
* Available time windows
* Budget or preference filters

The loading state should feel helpful, not technical.

## Results Page

For now, planner results should open in a **new dedicated results page**.

This page should be the main surface for viewing, refining, and saving the AI-generated plan.

### Recommended route behavior

Examples:

* `/planner`
* `/planner/new`
* `/planner/results/{id}`

### Results page responsibilities

The results page should support:

* The original prompt displayed at the top
* A rich AI-generated response
* Structured event and club cards
* Time-based plan sections
* Follow-up prompt input
* Save/bookmark actions
* Add to calendar actions
* Replace this event actions
* Share plan actions

The results page should not be a plain text response page. It should present a usable plan.

## Suggested Results Layout

The result should be structured into once section, with suggested events and/or clubs in the text output and possibly event/club cards.


### Example structure

* Title: “Your CampusVibe Plan”
* Summary: “Here’s a social Saturday under $30 based on your interests.”
* Event cards:

  * event name
  * time
  * location
  * cost
  * tags
  * save/view actions
* Club cards where relevant
* Optional timeline view for the day or weekend

## RAG Workflow

The AI planner should use a Retrieval-Augmented Generation workflow.

This means the planner should not rely only on the LLM’s general knowledge. It should first retrieve relevant internal data, then generate the response using that context.

### Suggested flow

1. User enters a natural-language prompt.
2. User authentication is confirmed.
3. Retrieve the user profile and preferences.
4. Retrieve saved events, followed clubs, and relevant history.
5. Run semantic retrieval over available events and clubs.
6. Select the most relevant matches.
7. Send only the useful retrieved context to the LLM.
8. Generate a personalized, structured plan.
9. Render the response on the results page.

### Data sources the planner may use

* User interests
* Saved/bookmarked events
* Followed clubs
* Previous planning interactions
* Event metadata
* Club metadata
* Event timing and availability
* Budget-related or preference-related inputs when present

## Retrieval Expectations

The retrieval layer should prioritize:

* Relevance to the user prompt
* Event timing
* Event category match
* Club affinity
* Availability of actionable details
* Diversity of recommendations

Do not flood the model with too many results. Retrieve a curated subset of relevant items so the LLM can produce a higher-quality answer.

## Output Expectations

The planner should generate responses that are:

* Personalized
* Structured
* Actionable
* Easy to scan
* Helpful for decision-making

The response should avoid generic filler and should instead produce useful planning output.

### Good response qualities

* Explains why each recommendation fits
* Groups results by time or theme when useful
* Includes next steps
* Encourages refinement through follow-up prompts

## Follow-Up Interaction

The results page should allow the user to refine the plan after the initial answer.

Examples of follow-up prompts:

* “Only show free events”
* “Make this more social”
* “Suggest something after 6 PM”
* “Replace the second event”
* “Find something closer to campus”

The planner should treat follow-up prompts as part of the same planning session when possible.

## Context Awareness

The planner should adapt recommendations based on the page context where possible.

Examples:

* From an event page: suggest similar events or build a day around that event
* From a club page: suggest related clubs or upcoming events from that club’s category
* From the homepage: offer broad planning help

Context should improve recommendations, not confuse the user.

## UI Tone and Style

The planner should feel:

* Modern
* Friendly
* Helpful
* Clean
* Campus-oriented

Avoid making it feel like a customer-support chatbot or a generic AI assistant.

## Design Constraints

* Keep the homepage planner card visible and meaningful
* Use suggestion chips to reduce friction
* Use a dedicated results page for the planner output
* Preserve the user prompt through login if required
* Keep the loading state polished and informative
* Use semantic retrieval plus LLM generation
* Ensure recommendations are structured and actionable

## Do

* Do make the planner feel distinct from search
* Do use a dedicated results page for the plan
* Do preserve guest prompts through sign-in
* Do use RAG to ground responses in real data
* Do show an intermediate loading state
* Do present recommendations in cards and sections
* Do support follow-up refinement

## Don’t

* Don’t return plain unstructured text only
* Don’t force users to retype prompts after login
* Don’t skip retrieval and ask the LLM to invent recommendations
* Don’t make the planner feel like generic support chat
* Don’t overload the homepage with too many controls
* Don’t bury the planner behind too many clicks

## Implementation Notes

The planner should be implemented so that the prompt submission creates a planner session or result object. That result should then be rendered on a dedicated results route.

The response page should be able to handle:

* streaming response states
* partial loading
* saved session restoration
* prompt retries
* follow-up queries

## Feature Goal

The goal of the AI Planner is to help CampusVibe users turn vague intentions into concrete plans.

The feature should help users move from:

“Maybe I should do something this weekend”

to

“Here is a plan that fits my interests, timing, and campus life.”

## Acceptance Criteria

The AI Planner is successful when:

* Users can easily find the planner on the homepage
* Users can start with a suggestion chip or free-text prompt
* Guests are asked to sign in before receiving personalized answers
* Login preserves the original prompt
* A loading state appears after prompt submission
* Results open on a dedicated page
* The response is structured, useful, and personalized
* Users can refine the plan with follow-up prompts
* The planner uses semantic retrieval plus LLM generation

## Future Enhancements

Possible later improvements include:

* Calendar-aware planning
* Budget filters
* Friend-group planning
* “Surprise me” mode
* Saved planning sessions
* Recurring preference memory
* Multi-step itinerary building
* Side-by-side comparison of plan options

## Final Direction

Build the AI Planner as a dedicated planning experience, not as a search extension. It should live prominently on the homepage, accept natural-language requests, authenticate when needed, retrieve relevant campus data, and produce a polished results page that users can act on immediately.