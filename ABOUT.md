# About this project and its author

I'm Michel Milanesi, and I built BuildingLens as my take-home for the AI & Data
Engineer role at SECO. This note is my own, written in the first person. It is a
candid account of what I set out to do and why I think I fit the role, not a verdict
for anyone else to issue. Read the code first; this is just the human behind it.

## What I set out to demonstrate

BuildingLens turns documents an asset manager or insurer already holds, building
inspection reports, into something they can act on: defects extracted from each PDF,
a transparent risk score per building, and plain-language questions answered with
citations back to the reports. I deliberately kept the core small and finished rather
than wide and half-built, and I pushed portfolio-scale features to a documented
three-month vision instead of faking them under a deadline.

## How I work, and where you can see it in the repo

- **I evaluate AI honestly.** Extraction is checked against a gold set (`make eval`),
  and I say plainly that a perfect score on synthetic data is a mechanics check, not
  real-world accuracy. I would rather report a limitation than oversell a number.
- **I design for the person who has to run it.** `make data && make run` rebuilds
  everything from zero, both public sources have offline fallbacks, and a mock mode
  runs the whole stack with no API key, so an evaluator is never blocked.
- **I am honest about limits.** The README states which fields are real (EUBUCCO
  footprints, height, coordinates) and which are synthetic, and flags what is
  unreliable. I would rather a stakeholder trust me than be impressed and misled.
- **I care about craft.** The risk formula is documented and reproducible, the UI is
  built to be accessible and consistent, secrets never touch git, and the settings API
  never returns a stored key.

## Why I would be a good colleague for this team

For years my work has been to understand what people actually need, sit with the
business problem, and ship automation that makes their day better, then keep improving
it once it is in their hands. I adapt to the stack and the constraints in front of me,
which is why this deliverable mirrors SECO's React and Python world rather than my own
preferences. I am comfortable being hands-on and operational, I follow through, and I
work in English daily, which is why I wrote this project in English.

If that is the kind of engineer you are looking for, I would be glad to walk you
through any part of this code and the decisions behind it.

Michel Milanesi
