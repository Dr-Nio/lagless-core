# 🤝 Contributing to Lagless Core

Thank you for considering contributing to Lagless Core.

This project is a **distributed, offline-first data runtime**, so contributions must respect its architectural discipline and determinism principles.

---

# 🧠 1. Core Contribution Philosophy

Before contributing, understand this:

```text id="p1"
Lagless is not a feature library.
It is a coordinated execution system.
```

Every change must respect:

* determinism
* engine isolation
* event-driven flow
* offline-first guarantees
* backward compatibility

---

# 🏗 2. Project Structure

```text id="s1"
packages/
  core/
    request-engine/
    cache-engine/
    queue-engine/
    sync-engine/
    retry-engine/
    event-bus/
    plugin-manager/
    metrics-engine/
```

Each engine is:

* independent
* testable
* event-driven
* loosely coupled

---

# 🧪 3. Before You Start

Run setup:

```bash id="b1"
pnpm install
pnpm build
pnpm test
```

Ensure:

* all tests pass
* no lint errors
* no type errors

---

# 🌿 4. Branch Strategy

Use descriptive branch names:

```text id="br1"
feature/cache-eviction-policy
fix/retry-jitter-bug
refactor/sync-engine
```

Avoid vague names like:

* update
* fix
* changes

---

# 📦 5. Contribution Types

We accept:

## ✔️ Features

* new caching strategies
* sync improvements
* performance enhancements

---

## ✔️ Bug fixes

* request failures
* queue inconsistencies
* sync race conditions

---

## ✔️ Performance improvements

* reduced memory usage
* faster cache lookup
* optimized retry logic

---

## ✔️ Documentation

* API clarity
* examples
* architecture explanations

---

# ⚙️ 6. Coding Standards

## TypeScript strict mode required

```ts id="c1"
strict: true
```

---

## No hidden side effects

All engine behavior must be:

* predictable
* event-driven
* testable

---

## Avoid cross-engine coupling

❌ Bad:

```text id="bad1"
CacheEngine directly calling SyncEngine internals
```

✔️ Good:

```text id="good1"
CacheEngine emits event → SyncEngine listens
```

---

# 🧠 7. Architecture Rules

## 1. Event-driven communication only

```text id="a1"
Engine → EventBus → Engine
```

---

## 2. No direct shared state

Each engine manages its own state.

---

## 3. Fail-safe design

No engine should crash the system.

---

## 4. Offline-first safety

No feature may assume network availability.

---

# 🧪 8. Testing Requirements

All contributions must include tests.

### Required coverage:

* unit tests
* integration tests
* event tests

Run tests:

```bash id="t1"
pnpm test
```

---

## Example test requirement:

If modifying cache:

* test cache hit
* test cache miss
* test TTL expiry
* test invalidation

---

# 📡 9. Event Safety Rules

If your code emits events:

* events must be documented
* events must be typed
* events must not block execution

---

# 🔁 10. Sync & Retry Safety Rules

Any change affecting:

* sync engine
* retry engine

must ensure:

* idempotency
* retry safety
* no duplicate operations

---

# 📦 11. Commit Guidelines

Use conventional commits:

```text id="cmt1"
feat: add cache eviction strategy
fix: resolve retry duplication bug
refactor: simplify sync pipeline
docs: update API reference
test: add queue integration tests
```

---

# 🔍 12. Pull Request Guidelines

Each PR must include:

* clear description
* linked issue (if applicable)
* test coverage
* performance consideration notes

---

# ⚠️ 13. Common Mistakes to Avoid

## ❌ Breaking engine isolation

Do not directly modify another engine’s internal state.

---

## ❌ Adding synchronous blocking logic

Lagless is async-first.

---

## ❌ Ignoring offline mode

All features must support offline execution gracefully.

---

## ❌ Skipping tests

No test = no merge.

---

# 📊 14. Review Process

All PRs are reviewed for:

* architectural consistency
* performance impact
* test coverage
* API stability

---

# 🚀 15. Performance Awareness

Changes must not degrade:

* cache lookup speed
* request throughput
* queue processing time

---

# 🔌 16. Plugin Contributions

Plugins must:

* be isolated
* use hooks only
* not modify core state directly

---

## Example plugin structure:

```ts id="p1"
export const plugin = {
  name: "example",
  hooks: {
    beforeRequest: async (ctx) => ctx
  }
};
```

---

# 🧠 17. Mental Model Reminder

When contributing, think:

```text id="m1"
Does this change preserve system predictability?
```

If not, redesign it.

---

# 🤝 18. Final Note

Lagless Core succeeds only if:

* engines remain decoupled
* behavior stays deterministic
* offline support remains first-class
* system remains observable

---

# 🚀 Welcome aboard

You are now contributing to a **reactive offline-first distributed runtime system for JavaScript applications**.
