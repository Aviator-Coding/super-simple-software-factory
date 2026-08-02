# Super Simple Software Factory — Productionizing ADWs as a Deployable Skill

## Date
2026-07-28 (Q3 2026)

## Top 3 Priorities
1. **Ship the week's three deliverables**: the "What Is Agentic Engineering" blog, Uhcut, and the weekly video on the Super Simple Software Factory (video launches next month, so its revenue counts toward August).
2. **Build the Super Simple Software Factory in a two-day turnaround** with scope locked to exactly three properties: model configuration, context pass-off, and observability — "reusable combination of code plus agents."
3. **Package the factory as a deployable skill** (codebase + skill + templates/examples form factor) so ADWs can be created and deployed at scale — this directly feeds IAL, since the IAL agent will operate in the sandbox and needs this system.

## Key Ideas
- Three-prong play: build what IAL needs, produce channel content, and learn by building — accepting lower views and a more engineering-focused audience up front ("this one is for us").
- Name-dropping Tactical Agentic Coding (TAC) in the video is fine.
- The system is a reusable software factory applicable to any codebase that combines code plus agents; reusability compounds because an agent can learn the structure and rebuild/deploy it for you.
- Three scoped properties: **model configuration**, **context pass-off/handoff**, **observability**. If those three land, the system is good enough.
- Agent-to-agent handoff should end in a concrete structured response — JSON mode is the starting point — with references to output locations.
- Session directories must be loaded into agents; every agent gets a purpose, system prompt, user prompt, a unique name, and a session ID; every agent always generates some type of output.
- Observability: JSONL logs streamed into a database; the SQLite trace database stored on-device becomes a standard, shippable package.
- This is effectively recreating the ADW system from TAC in a single day — much easier now because agents do the building.
- Rejected the "wacky idea" of putting all ADW operations in a single script; instead use a `modules/` directory (reusable pieces like the PyCoding agent interface, agent selection) plus the actual ADW scripts, with env variables in the root.
- Build a skill around the tool to deploy it into different projects: make config file, make ADW — then stack up ADWs and deploy compute against them.
- Open architectural question: leave it as a skill an agent operates, with a top-level agent rapidly using the whole system to put out agents-plus-code systems.
- Orchestrator principle: the orchestrator runs the system but does no work itself — it runs, observes, and helps you interact. An agentic layer on top of a static layer.
- V1 is a one-shot system with no human-in-the-loop; human-in-the-loop is a planned later feature.
- Need to crack streaming; a web server ships inside the skill to live-stream all events and ideally agent traces, rendered as a swim-lane flow-through UI.
- Configuration should ship with great defaults.
- This productionizes the idea originally built in September 2025, now redeployable across codebases at agentic speed.
- End state one-liner: a skill used to create and deploy AI Developer Workflows at scale — scripts plus code.
- Kickstart observability by having agents generate UI patterns and units for what it should look like.

## Extensions
- **The trace DB may be IAL's missing atomic unit.** The sole open gate on IAL is defining the atomic unit of one loop — a single ADW run record (session ID, config, prompts, handoff envelopes, traces, outputs) in the standard SQLite package is a strong candidate for exactly that unit, and doubles as the sellable training-data trace format. Building the factory this week may close the IAL gate for free.
- **Versioned handoff envelope schema.** Formalize the JSON pass-off as a tiny versioned envelope — `{session_id, agent_name, purpose, status, artifacts[], next}` — validated (Pydantic/JSON Schema) at every hop. Validation failures become first-class events in the swim-lane UI, which makes handoff bugs visible instead of silent.
- **Model config as a tier map, not a model list.** Map ADW step *types* to model tiers (mechanical steps → cheap/fast models, judge/verify steps → top models) with great defaults. This is also a strong on-camera cost story: "the factory spends compute where it matters."
- **Self-replication as the video's climax.** The proof of reusability is an agent applying the skill to a fresh throwaway repo and running one ADW end-to-end on camera. The demo *is* the thesis: the factory rebuilds itself anywhere.
- **Journal-based resume for one-shot runs.** Since V1 is one-shot with no human-in-the-loop, journal each completed step to the trace DB so a failed run can resume from the last completed step instead of restarting — cheap to add now, painful to retrofit.
- **Reuse the animaid stack for the swim-lane UI.** Vue+Vite+TS front end with Bun+SQLite and shared types is already proven from animaid; the live event stream maps cleanly onto it, and agents can generate the swim-lane components as the observability kickstart.
- **Gate the streamed UI with Playwright.** The live-stream web server + swim-lane UI should pass the standing browser-validation rule (rendered DOM, zero console errors, sane polling) before being called done — a black screen on a "working" observability dashboard would be a painful irony.
- **Two-content harvest.** The two-day build naturally yields a Mids cut (4–10 min) for the main channel alongside the full weekly video — the swim-lane UI running a live ADW is inherently visual material.

## Leading Questions
- **Question 1**: What exactly does the agent-to-agent pass-off look like?
  - Potential answer: End every agent in JSON mode with a small standard envelope containing references to artifacts in the session directory, rather than passing full content between agents.
  - Next steps: Define the envelope schema first — before writing any agents — then make every module read/write it. YAML can be revisited later; JSON wins for V1.

- **Question 2**: What is the form factor that makes this genuinely reusable?
  - Potential answer: Skill contains templates, examples, and generators (make config file, make ADW); applying the skill scaffolds the target codebase with `modules/`, ADW scripts, and root env variables; scripts then run inside the codebase.
  - Next steps: Build the factory once by hand in one repo, then extract the skill from what was built and test it by deploying into a second, clean repo.

- **Question 3**: How much observability is in scope for two days?
  - Potential answer: JSONL logs → SQLite trace DB → web server live-streaming events, with named agents in a swim-lane UI. Observe both code and agents, keep the event schema minimal.
  - Next steps: Have agents generate UI patterns/units first, lock a minimal event schema, then wire streaming — and Playwright-validate the rendered UI before calling it done.

- **Question 4**: Does the factory stay a skill an agent operates, with a top-level agent on top?
  - Potential answer: Yes, but layered: static layer (scripts + modules) works standalone first; the orchestrator agent on top only runs, observes, and helps you interact — it does no work itself.
  - Next steps: Build and verify the static layer in isolation, then add the orchestrator agent as a thin wrapper; defer human-in-the-loop to a later feature.

- **Question 5**: How does this week's build connect to IAL?
  - Potential answer: The IAL agent operates in a sandbox and needs exactly this deployable factory; the standard trace DB is both the observability layer and a candidate definition of IAL's atomic unit of one loop.
  - Next steps: While building, write down what one complete ADW run record contains — evaluate it against the atomic-unit gate before the Aug–Sep all-in IAL push.

## Transcript
- Okay.
- It is Tuesday, July 28th, Q3 2026.
- This week we're shipping the agentic engineer-- What Is Agentic Engineering blog.
- We are shipping Uhcut, and we are shipping this weekly video.
- Um, and the weekly video here is gonna be on the super simple software factory.
- And so we're gonna try to thread the needle here, once again, putting together work we need for infinite agentic loops and putting together, um, interesting content for the channel and learning what we need to do to build this.
- So we're going for a three-prong here.
- Uh, we definitely can name-drop, um, Tactical Agentic Coding.
- I think that's totally fine here.
- Um, this video will launch, uh, starting next month, so the revenue will be counted toward that.
- Um, so what... Yeah, what are we trying to do?
- I took a bunch of notes here, kind of thought through this.
- And let me take a swig of coffee, get us a little activated.
- [sighs] Okay.
- And [sighs] what do we need to nail here?
- So again, this is for-- this is gonna be for us, so we're just making that sacrifice up front.
- We know that the views might be lower here.
- We know that we might attract a more engineering-focused audience.
- But the idea here is that we just wanna walk through how we're thinking about building a reusable software factory system that can be applied to any code base that combines code plus agents.
- And of course, the beautiful part about this is that the reusability is very much there because we can swap in, because we can have an agent learn how we build this, learn the structure of what we're building, and then they can build it for us.
- So that's kind of what we're going after here.
- Um, we do have to be very careful.
- This is a two-day turnaround, so we need to keep the scope of this thing simple.
- So I think I've identified three areas I wanna hit.
- I wanna make this, um, you know, three kind of key features, three properties we need.
- We need model configuration.
- Uh, we need... What did I have here?
- Model configuration, context pass-off, and observability.
- So if we do those three things, I think the system will be, you know, good enough.
- And so the trick is, of course, handing the information, uh, through to each agent.
- So the question is, do we always end in some type of JSON response?
- Do we always end in some type of YAML response?
- Like, how do we get that concrete, um, final pass-off between agents?
- And certainly, I think, uh, JSON mode is probably going to be a good place to start because we'll have the agents do work, and then we'll have references to those locations.
- So we do need the session directories loaded in to our agents.
- And then we're gonna need, um, you know, just, like, the purpose of every agent.
- All right.
- System prompts, user prompts, and, uh, then we just pass off context.
- And then I think the last piece is observability.
- We have the JSONL logs, and I think... Yeah, we have the JSONL logs, and we can also stream those into a database.
- And remember, we have agents, right?
- It's gonna be much easier to do this this time.
- Basically, we're recreating [chuckles] the ADW system from TAC in, like, a single day.
- So we need to really think through, um, how this can be done, and we wanna keep it simple.
- We wanna keep it visual, right?
- So it's model configuration, context handoff, and observability.
- It must be observable, it must be understandable, and we wanna observe both the code and the agents.
- So those are the three things I think we go after.
- We keep the scope tight and focused on that.
- And so what does this give?
- It gives reusable combination of code plus agents.
- I think that's, like, the, the, the key one-liner of what the system gives.
- There's a wacky idea to put all-- to put the, you know, entire operations of the ADW inside of a single script.
- I think that's wrong.
- I think what we wanna do is have a modules directory, and then we have the actual ADW, right?
- Because we're gonna need reusable things like the PyCoding agent interface.
- We're going to need reusable things like selecting the agent, blah, blah, blah.
- So I think that's the idea.
- Env variables in the root.
- And then the final question is: how do we pass this off?
- How do we build this?
- I think then we just build a skill around this tool that, um... I think that we build a skill around this tool that allows us to, uh, deploy this into, um, you know, different projects.
- And so then we just start stacking up the ADWs we run, and we're deploying compute against this stuff, have a simple configuration file, make configuration file.
- And then in the skill, you can imagine, we'll have make config file.
- We'll have make ADW.
- And then we can put together different combinations of software factory.
- So I think this idea is called the super simple software factory.
- I think we need to crack streaming.
- I think we need to crack, um, you know, this kind of, like, the core of it.
- And then inside of the skill, we can take it and then apply it wherever we need it.
- And there is, like, a secondary question here where we have to ask ourselves, um, do we leave this as a skill for an agent to operate.
- And then do we use it to build?
- And that's a pretty interesting question.
- Do we leave this as a skill for an agent to operate?
- Because now we can put out some pretty advanced... This enables us to put out pretty advanced workflows.
- Pretty advanced what?
- This allows us to put out pretty, uh, yeah, it allows us to rapidly put out different types of agents and systems, agents plus code.
- And then the, the question is, the trick is, can you, um, can you rapidly use the system with another kind of top-level agent on top of all of it?
- So that's where my head's at.
- That's what I'm thinking about here for this.
- This is a super simple software factory.
- So we want to be careful not to over bloat this.
- We want to make sure that we have a couple key reusable modules that make this work.
- We might want to put observability in there as well, but yeah, the trick is like, what's a form factor?
- Code base, skill, apply the skill, and then you run those scripts inside the code base, templates, examples inside the skill, and then you can rapidly build on top.
- I think that's right.
- I think that's the right mindset because then we can take this and add more on top of it for I- or for that, and have a database of all the traces, everything that's happened stored on the device.
- And then we can just ship that off, use that as a standard package, right?
- The SQL database that has the traces is just standard.
- And so I think that's right.
- Yeah.
- Fascinating.
- And so now we are adding another layer.
- Yeah, another layer on top.
- Okay, this is cool.
- We're actually like productionizing this idea, right?
- We're taking the idea we, you know, built out way back, uh, in September last year, and we're actually giving it a usable layer we can deploy across code ba-bases at the agentic speed.
- That's what we're really doing here, right?
- Agents plus code.
- We build out the primitives we're gonna reuse, and then we have a system where we can redeploy it over and over and over.
- And this is key for IAL because our agent's gonna be operating in the sandbox.
- So it's like we almost need this.
- Yeah, we need to save this as a skill.
- We save this as a skill that can be deployed over and over.
- Requirements.
- Okay.
- Makes sense.
- Makes sense.
- Yeah, agents plus code.
- We gotta crack observability.
- So maybe we start by having agents generate, um, some UI patterns and some, uh, units for what that looks like.
- And then we need to crack the handoff session directory and, yep, unique name, session ID.
- Uh-huh.
- Always generate some type of output.
- Yeah.
- Orchestrator runs the system, but it doesn't do anything.
- It runs the system, observes the system, and helps you interact with the system.
- That's it.
- That's, that's the key crack here, right?
- You put an agentic layer on top of the static layer, and it just helps you interact.
- It helps you see it.
- And then ideally, you also have that key observability system, and then you can go from there.
- So yeah, it's a one-shot, right?
- So the system is designed to be a one-shot system.
- You're not designed-- Um, we can add human-in-the-loop here.
- That is gonna be a feature we're gonna wanna add.
- But, uh, you know, run one, no human-in-the-loop.
- We're just building this out.
- Yeah.
- Yeah, digital infrastructure.
- Nice and simple.
- Yeah, okay.
- So that's the target.
- So, so, so that is really important, right?
- The, the end state here is a skill that we can use to create and deploy AI developer workflows at scale, which are scripts plus code.
- And it all starts in the skill, then you use the skill, build out these ADWs that lets you get a super simple software factory.
- Yeah.
- Okay.
- Um, I think that's great.
- I think that's great.
- I think, uh, figuring out the configuration is gonna be good.
- Of course, we can have great defaults.
- Then context pass-off is gonna be really important, and then data pass-off, and then how do we observe this thing, agents and the code?
- And so I guess, yeah, we're gonna have a web server inside that skill as well that will live stream, um, all the events happening, and ideally the agent traces as well.
- And yeah, we wanna give e-every agent a name just so we can see that.
- And then we have, you know, some type of swim lane flow through UI of this system.
- So great breakdown here.
- I think that's all the components we want.
- So, uh, let's build this out.
- Let's put all the pieces together and progress from there.

*Note: the raw transcription rendered "Uhcut" as "Alcot"; it has been corrected here. "Inv variables" was corrected to "env variables."*
