
1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

    State your assumptions explicitly. If uncertain, ask.
    If multiple interpretations exist, present them - don't pick silently.
    If a simpler approach exists, say so. Push back when warranted.
    If something is unclear, stop. Name what's confusing. Ask.

When implementing:

    Follow these design principles as much as you can in order to generate easily readable code.
    Principles in question are SOLID KISS and DRY. Also follow TDD principles where applicable, generate concise and easy to understand unit-tests for behavior that is being developed.
    ensure the unit-tests evolve when developing the features further. Start with minimal features that have simple unit-tests
    When the behavior is one a unit-test cannot reach — measured layout, the CSS acting on it, something two clients must agree on, or a mode that changes what a click means — write a Playwright spec in e2e/ alongside the unit-tests, not instead of them. Use judgement: the behaviors above, and regressions in them, not every button. See "Writing them" under Testing in README.md.

2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

    No features beyond what was asked.
    No abstractions for single-use code.
    No "flexibility" or "configurability" that wasn't requested.
    No error handling for impossible scenarios.
    If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

    Don't "improve" adjacent code, comments, or formatting.
    Don't refactor things that aren't broken.
    Match existing style, even if you'd do it differently.
    If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

    Remove imports/variables/functions that YOUR changes made unused.
    Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

    "Add validation" → "Write tests for invalid inputs, then make them pass"
    "Fix the bug" → "Write a test that reproduces it, then make it pass"
    "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

5. Documenting the software

    When developing software, try to keep README.md files up-to-date. Be mindful of keeping the documentation relevant in order to not convolute the documentation.
    The documentation should be concise that tells a new developer all the necessary stuff but nothing that is not relevant for understanding the codebase and how the software works.
