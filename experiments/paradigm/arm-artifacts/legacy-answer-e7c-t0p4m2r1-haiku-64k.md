# Legacy Project Optimization: First-Step Strategy

## The Scenario

You're assigned to optimize a chaotic older project:
- Code is scattered, poorly organized
- Documentation is outdated or missing
- Tests are sparse or nonexistent
- Business pressure to restore iteration velocity quickly

## My First Step: Not Code Cleanup

**I would start with a structured audit, not refactoring.**

### Why This First

Before touching code, I need answers to these questions:

1. **What actually runs?** Which systems are alive, which are dead weight?
2. **What breaks most often?** Not what looks messiest — what costs us repeatedly?
3. **What blocks velocity right now?** The bottleneck might not be code quality; it might be build time, testing, or unclear requirements.
4. **What's the critical path?** Which 20% of the system generates 80% of the business value?

**Reasoning:** Optimizing the wrong thing is worse than not optimizing. I've seen teams spend weeks refactoring beautiful-looking code that nobody uses, while the actual money-maker stays brittle.

### How I'd Run This Audit

**Phase 1: Understand the landscape (2-3 hours)**
- Clone the repo, run the build
- What breaks? Document each failure with the exact error
- List all test commands that exist (even if they fail)
- Count lines per module/file
- Check git history: when was each file last touched? (Dormant code vs. active code)

**Phase 2: Find the pain points (1-2 hours)**
- Talk to the team: "What slows you down most?"
- Ask not "what's wrong" but "what do you avoid touching?"
- Look for comments like "don't refactor this" or "hack: XYZ"
- Check issue tracker for recurring patterns

**Phase 3: Map critical paths (1 hour)**
- Trace one user journey from entry point through the system
- Mark every place where the flow touches unfamiliar code
- Identify data transformations that feel fragile

**Output: A single-page "friction map"**
```
HIGHEST IMPACT FIXES (do these first):
- Build takes 45 mins because of X → fix = 5 mins
- Tests have 67% flakiness due to Y → fix = affects all future work
- Core data model in module Z is undocumented → 3 bug reports/month

TECHNICAL DEBT (important but not urgent):
- Unused dependencies (safe to remove)
- Code duplication in modules A, B, C (can be rolled into library)

MINOR CLEANUP (nice-to-have):
- Naming inconsistencies
- Style violations
```

### Why Not "Clean It Up" First

❌ **"Let me refactor the whole codebase"** 
- You don't know what's actually used yet
- You might break things nobody told you about
- Weeks pass, velocity stays zero

❌ **"Let's add comprehensive tests"**
- Without knowing what matters, you waste cycles testing irrelevant paths
- Better to test the friction points first

❌ **"Rewrite this module in modern patterns"**
- Unless it's on the critical path, this delays velocity recovery

### The Decision Tree After Audit

Once you have the friction map:

```
IF pain is "builds take forever"
  → Optimize build pipeline (parallelization, caching, etc.)
  → Usually gives 10x velocity gain per fix

IF pain is "tests are flaky"
  → Fix flakiness source (timing, state, mocking)
  → Gives confidence to make changes faster

IF pain is "we don't understand the data model"
  → Document it, add type safety, add contract tests
  → Prevents cascading bugs

IF pain is "module X is tangled"
  → Isolate it first (extract testable boundary)
  → Then refactor inside the boundary
  → Risk stays contained
```

## What This Approach Prevents

| Mistake | Cost | This Strategy Prevents It |
|---------|------|--------------------------|
| Spend 2 weeks refactoring dead code | Wasted time | Identify what's actually used first |
| Fix wrong bottleneck | Velocity doesn't improve | Data-driven prioritization |
| Break production while cleaning | Emergency meetings | Audit tells you what's fragile |
| Introduce new bugs during refactor | Regression spiral | Fix friction points incrementally, with tests |

## Real Example

Project had 2,000 lines of "messy" config parsing code. Team wanted to rewrite it.

My first question: "How often does it break?"

Answer: "Never. We haven't touched it in 3 years."

Real problem was elsewhere — build script took 20 minutes because config parsing was run 50 times sequentially. Fixed by caching, not rewriting.

---

## Summary: First Step

**Audit** → **Prioritize by impact** → **Fix the top 3 pain points** → **Then refactor**

This turns the project from "chaotic" to "functional-but-messy" in days, not weeks.

Business gets velocity back immediately. Technical debt gets addressed systematically afterward, with data to guide decisions.
