# Plugin Manager

The Plugin Manager is the extensibility layer of Lagless Core.

It enables developers to extend, modify, and enhance core behavior without altering the internal implementation of the system.

Plugins in Lagless are first-class citizens and can hook into virtually every subsystem, making the architecture modular, composable, and ecosystem-ready.

The Plugin Manager integrates with:

* Request Engine
* Cache Engine
* Storage Engine
* Queue Engine
* Sync Engine
* Retry Engine
* Metrics Engine
* Event Bus
* Subscription Engine

---

# Overview

The Plugin Manager acts as a middleware orchestration layer across the entire system.

```text id="p1k8v4"
Plugin Layer
     │
     ▼
Plugin Manager
     │
 ┌───┼───────────────┐
 ▼   ▼   ▼   ▼   ▼   ▼
Engines (Core System)
```

Plugins observe and modify system behavior through hooks.

---

# Why Plugins Exist

Without plugins:

```text id="x9m3k2"
Core System
   │
   ▼
Fixed Behavior
```

With plugins:

```text id="b4n8v1"
Core System
   │
   ▼
Plugin Layer
   │
   ▼
Extended Behavior
```

Plugins allow customization without forking the core.

---

# Responsibilities

The Plugin Manager handles:

* Plugin registration
* Plugin lifecycle management
* Hook execution
* Middleware chaining
* Plugin isolation
* Dependency resolution
* Plugin ordering
* Plugin teardown
* Runtime extension injection

---

# Core Concept

A plugin is a structured object with lifecycle hooks.

```text id="c8v1m4"
Plugin
 ├── Hooks
 ├── Setup
 ├── Teardown
 └── Metadata
```

---

# Plugin Lifecycle

```text id="l2k9v7"
Register
   │
   ▼
Initialize
   │
   ▼
Activate Hooks
   │
   ▼
Runtime Execution
   │
   ▼
Teardown
```

---

# Registering a Plugin

Example:

```typescript id="r7m3k9"
client.plugins.register({
  name: 'logger',
  version: '1.0.0',
  hooks: {
    beforeRequest: async (ctx) => {
      console.log(ctx.url);
      return ctx;
    }
  }
});
```

Flow:

```text id="f1v9k3"
Register → Plugin Manager → Active System
```

---

# Plugin Structure

A plugin typically includes:

```typescript id="s9k4v2"
interface Plugin {
  name: string;
  version: string;

  hooks?: Record<string, Function>;

  setup?: (manager) => void;

  teardown?: () => void;
}
```

---

# Hook System

Hooks allow plugins to intercept system behavior.

Examples:

```text id="h4v9k1"
beforeRequest
afterRequest
beforeCacheSet
afterCacheGet
onSyncStart
onSyncEnd
onRetry
```

---

# Request Hooks

Example:

```typescript id="rq8v3m"
beforeRequest
afterRequest
```

Usage:

```typescript id="rq2k9v"
hooks: {
  beforeRequest: async (ctx) => {
    ctx.headers['x-token'] = 'abc';
    return ctx;
  }
}
```

---

# Cache Hooks

```text id="ch7v2k"
beforeCacheSet
afterCacheSet
beforeCacheGet
afterCacheGet
```

Example:

```typescript id="ch3v8m"
hooks: {
  afterCacheGet: async (value) => {
    console.log(value);
    return value;
  }
}
```

---

# Sync Hooks

```text id="sy4k9v"
onSyncStart
onSyncEnd
onSyncConflict
```

Used for:

* Monitoring sync behavior
* Custom conflict strategies
* Logging synchronization state

---

# Retry Hooks

```text id="rt6v1k"
onRetry
onRetrySuccess
onRetryFailure
```

Example:

```typescript id="rt2m9v"
hooks: {
  onRetry: async (ctx) => {
    console.log('Retrying:', ctx);
  }
}
```

---

# Metrics Hooks

Plugins can record metrics automatically.

```text id="mt8v3k"
onMetricRecord
onMetricExport
```

Example:

```typescript id="mt4k9v"
hooks: {
  onMetricRecord: async (metric) => {
    sendToAnalytics(metric);
  }
}
```

---

# Event Integration

Plugins are deeply integrated with the Event Bus.

```text id="ev6k2v"
Plugin Hook → Event Emission → System Reaction
```

Example:

```typescript id="ev3v9k"
client.events.on(
  'plugin:registered',
  payload => {
    console.log(payload.name);
  }
);
```

---

# Setup Function

Plugins may define initialization logic.

```typescript id="st8v2k"
setup: (manager) => {
  console.log('Plugin initialized');
}
```

Flow:

```text id="st3k9v"
Register → Setup → Active
```

---

# Teardown Function

Plugins can clean up resources.

```typescript id="td9v2k"
teardown: () => {
  console.log('Plugin removed');
}
```

Used when:

* Disabling plugins
* Destroying clients
* Hot reloading

---

# Plugin Isolation

Plugin failures do not affect the core system.

```text id="is7v2k"
Plugin Error
     │
     ▼
Captured by Manager
     │
     ▼
System Continues
```

---

# Execution Order

Plugins are executed in registration order unless prioritized.

```text id="or4v9k"
Plugin A
Plugin B
Plugin C
```

Order matters for middleware chaining.

---

# Middleware Chaining

Multiple plugins may modify the same lifecycle event.

```text id="mw8k3v"
Request → Plugin A → Plugin B → Plugin C → Core
```

Each plugin can modify context.

---

# Plugin Priority

Plugins may define priority levels.

```typescript id="pr6v2k"
priority: 10
```

Higher priority runs first.

---

# Dependency Plugins

Plugins may depend on others.

```typescript id="dp9k2v"
dependsOn: ['auth-plugin']
```

Ensures correct initialization order.

---

# Plugin Registry

The manager maintains a registry:

```text id="rg4v8k"
Registered Plugins
Active Plugins
Disabled Plugins
```

---

# Plugin State

Plugins may be:

```text id="ps7v2k"
registered
active
disabled
failed
```

---

# Runtime Plugin Updates

Plugins may be added or removed at runtime.

```typescript id="up9v2k"
client.plugins.unregister('logger');
```

Flow:

```text id="up3k9v"
Active → Removed → Teardown
```

---

# Error Handling

Plugin-related errors include:

```typescript id="er6v2k"
PluginError
HookError
DependencyError
InitializationError
```

Example:

```typescript id="er3k9v"
try {
  client.plugins.register(plugin);
} catch (error) {
  console.error(error);
}
```

---

# Metrics Integration

The Plugin Manager tracks:

* Active plugins
* Hook execution time
* Plugin failures
* Registration count

---

# Event Emission

Plugin lifecycle emits events:

```text id="ev9k2v"
plugin:registered
plugin:initialized
plugin:removed
plugin:error
```

---

# Example Plugin: Logger

```typescript id="lg7v2k"
const loggerPlugin = {
  name: 'logger',
  version: '1.0.0',

  hooks: {
    beforeRequest: async (ctx) => {
      console.log('Request:', ctx.url);
      return ctx;
    },

    afterRequest: async (res) => {
      console.log('Response received');
      return res;
    }
  }
};

client.plugins.register(loggerPlugin);
```

---

# Example Plugin: Metrics Reporter

```typescript id="mr4k9v"
const metricsPlugin = {
  name: 'metrics-reporter',

  hooks: {
    onMetricRecord: async (metric) => {
      send(metric);
    }
  }
};
```

---

# Example Plugin: Auth Injector

```typescript id="au8v2k"
const authPlugin = {
  name: 'auth',

  hooks: {
    beforeRequest: async (ctx) => {
      ctx.headers['Authorization'] =
        'Bearer token';
      return ctx;
    }
  }
};
```

---

# Performance Considerations

Plugins must be efficient:

* Avoid blocking operations
* Minimize synchronous work
* Use async hooks where needed
* Avoid excessive logging in production

---

# Best Practices

## Keep Plugins Focused

One responsibility per plugin.

---

## Avoid Heavy Logic in Hooks

Offload heavy processing outside request cycles.

---

## Use Priority Carefully

Only adjust priority when necessary.

---

## Always Handle Errors

Plugins should not crash silently.

---

## Clean Up Resources

Always implement teardown when using external resources.

---

# Summary

The Plugin Manager is the extensibility backbone of Lagless Core.

It provides:

* Plugin registration
* Lifecycle management
* Hook system
* Middleware chaining
* Dependency handling
* Plugin isolation
* Runtime updates
* Event integration
* Metrics tracking

allowing Lagless Core to evolve into a fully extensible ecosystem without modifying its core architecture.
