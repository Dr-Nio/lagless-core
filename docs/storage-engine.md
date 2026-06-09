# Storage Engine

The Storage Engine is the persistence layer of Lagless Core.

It provides a unified interface for storing, retrieving, updating, and deleting data regardless of the underlying storage implementation.

The Storage Engine allows Lagless to remain storage-agnostic while supporting multiple persistence providers such as memory, localStorage, IndexedDB, and custom adapters.

---

# Overview

The Storage Engine abstracts persistence behind a consistent API.

```text
Application
      │
      ▼
Storage Engine
      │
 ┌────┼────┬────────────┐
 │    │    │            │
 ▼    ▼    ▼            ▼
Memory localStorage IndexedDB Custom
```

This separation allows the rest of the system to operate independently of the storage backend.

---

# Responsibilities

The Storage Engine manages:

* Data persistence
* Serialization
* Deserialization
* Version management
* Data migrations
* Encryption integration
* Compression integration
* Batch operations
* Storage adapter coordination

---

# Design Goals

The Storage Engine is designed to provide:

* Storage independence
* Consistent behavior
* Predictable performance
* Data durability
* Extensibility

Applications should be able to switch storage providers without changing business logic.

---

# Storage Providers

Lagless supports multiple storage providers.

---

## Memory Storage

Memory storage stores data in runtime memory.

```text
Application
      │
      ▼
Memory Map
```

Characteristics:

* Fastest access
* No persistence
* Lost on refresh or restart
* Useful for testing

Example:

```typescript
const client = createLagless({
  storage: {
    adapter: 'memory'
  }
});
```

---

## localStorage

Uses the browser localStorage API.

```text
Application
      │
      ▼
localStorage
```

Characteristics:

* Persistent
* Widely supported
* Synchronous API
* Limited storage capacity

Example:

```typescript
const client = createLagless({
  storage: {
    adapter: 'localStorage'
  }
});
```

---

## IndexedDB

Uses IndexedDB for large-scale persistence.

```text
Application
      │
      ▼
IndexedDB
```

Characteristics:

* Persistent
* Large storage capacity
* Asynchronous API
* Suitable for offline applications

Example:

```typescript
const client = createLagless({
  storage: {
    adapter: 'indexedDB'
  }
});
```

---

## Custom Adapters

Developers may implement custom storage providers.

Examples:

* Redis-backed storage
* SQLite storage
* Filesystem storage
* Cloud storage
* Encrypted storage systems

---

# Storage Interface

All providers implement the same interface.

```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;

  set<T>(
    key: string,
    value: T
  ): Promise<void>;

  delete(
    key: string
  ): Promise<void>;

  clear(): Promise<void>;

  keys(): Promise<string[]>;

  has(
    key: string
  ): Promise<boolean>;
}
```

This guarantees compatibility across adapters.

---

# Basic Operations

---

## Set

Store a value.

```typescript
await client.storage.set(
  'user:1',
  {
    id: 1,
    name: 'John'
  }
);
```

---

## Get

Retrieve a value.

```typescript
const user =
  await client.storage.get(
    'user:1'
  );
```

---

## Delete

Remove a value.

```typescript
await client.storage.delete(
  'user:1'
);
```

---

## Exists

Check whether a key exists.

```typescript
const exists =
  await client.storage.has(
    'user:1'
  );
```

---

## Clear

Remove all entries.

```typescript
await client.storage.clear();
```

---

# Batch Operations

Batch operations reduce storage overhead.

---

## setMany

Store multiple entries.

```typescript
await client.storage.setMany({
  'user:1': user1,
  'user:2': user2,
  'user:3': user3
});
```

---

## getMany

Retrieve multiple entries.

```typescript
const users =
  await client.storage.getMany([
    'user:1',
    'user:2',
    'user:3'
  ]);
```

---

## deleteMany

Delete multiple entries.

```typescript
await client.storage.deleteMany([
  'user:1',
  'user:2'
]);
```

---

# Namespacing

Storage keys may be namespaced.

Example:

```typescript
storage: {
  prefix: 'myapp'
}
```

Generated keys:

```text
myapp:user:1
myapp:settings
myapp:posts
```

Namespacing prevents collisions with unrelated data.

---

# Serialization

Storage providers operate on serialized data.

Example:

```typescript
{
  id: 1,
  name: 'John'
}
```

may be serialized into:

```json
{
  "id": 1,
  "name": "John"
}
```

before persistence.

Serialization behavior is managed by the Storage Engine.

---

# Deserialization

Stored values are automatically restored.

```text
Serialized
     │
     ▼
Stored
     │
     ▼
Loaded
     │
     ▼
Deserialized
```

Applications interact with native objects rather than serialized representations.

---

# Versioning

Storage schemas may evolve over time.

Example:

```typescript
storage: {
  version: 2
}
```

The Storage Engine tracks storage versions to support migrations.

---

# Migrations

Migrations transform persisted data between versions.

Example:

```typescript
const migrations = {
  2: async storage => {
    const user =
      await storage.get('user');

    if (user) {
      user.fullName =
        user.name;

      delete user.name;

      await storage.set(
        'user',
        user
      );
    }
  }
};
```

Flow:

```text
Old Version
      │
      ▼
Migration
      │
      ▼
New Version
```

---

# Encryption

Storage data may be encrypted before persistence.

Example:

```typescript
storage: {
  encryption: {
    encrypt: async value =>
      encrypt(value),

    decrypt: async value =>
      decrypt(value)
  }
}
```

Flow:

```text
Data
 │
 ▼
Encrypt
 │
 ▼
Store
 │
 ▼
Load
 │
 ▼
Decrypt
```

---

# Compression

Data may also be compressed.

Example:

```typescript
storage: {
  compression: {
    compress: async value =>
      compress(value),

    decompress: async value =>
      decompress(value)
  }
}
```

Flow:

```text
Data
 │
 ▼
Compress
 │
 ▼
Store
 │
 ▼
Load
 │
 ▼
Decompress
```

---

# Encryption + Compression

Both mechanisms may be combined.

Typical flow:

```text
Data
 │
 ▼
Compress
 │
 ▼
Encrypt
 │
 ▼
Store
 │
 ▼
Load
 │
 ▼
Decrypt
 │
 ▼
Decompress
 │
 ▼
Data
```

---

# Storage Lifecycle

```text
Set
 │
 ▼
Serialize
 │
 ▼
Compress
 │
 ▼
Encrypt
 │
 ▼
Persist
```

Retrieval:

```text
Load
 │
 ▼
Decrypt
 │
 ▼
Decompress
 │
 ▼
Deserialize
 │
 ▼
Return
```

---

# Cache Integration

The Cache Engine relies on the Storage Engine for persistence.

```text
Cache Engine
      │
      ▼
Storage Engine
      │
      ▼
Storage Provider
```

This separation allows cache behavior and storage behavior to evolve independently.

---

# Queue Integration

Offline queue persistence is handled through the Storage Engine.

Example:

```text
Offline Queue
      │
      ▼
Storage Engine
      │
      ▼
IndexedDB
```

This ensures queued operations survive application restarts.

---

# Synchronization Integration

Synchronization state may also be persisted.

Examples:

* Last sync timestamp
* Sync checkpoints
* Conflict records

These values are managed through the Storage Engine.

---

# Event Integration

The Storage Engine emits events.

Examples:

```text
storage:set
storage:get
storage:delete
storage:clear
storage:migration
```

Example:

```typescript
client.events.on(
  'storage:set',
  payload => {
    console.log(payload.key);
  }
);
```

---

# Metrics Integration

The Storage Engine records metrics such as:

* Reads
* Writes
* Deletes
* Migration count
* Storage latency

Example:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Error Handling

Possible storage-related errors include:

```typescript
StorageError
ValidationError
MigrationError
EncryptionError
CompressionError
```

Example:

```typescript
try {
  await client.storage.set(
    'user:1',
    user
  );
} catch (error) {
  if (
    error instanceof StorageError
  ) {
    console.error(error);
  }
}
```

---

# Best Practices

## Use IndexedDB for Large Data

Prefer IndexedDB when:

* Offline support is important
* Large datasets are stored
* Queue persistence is enabled

---

## Namespace Your Data

Use prefixes to avoid collisions.

```typescript
storage: {
  prefix: 'myapp'
}
```

---

## Version Persisted Data

Always increment versions when changing storage schemas.

```typescript
storage: {
  version: 2
}
```

---

## Test Migrations

Migration logic should be covered by tests.

Migration failures can corrupt persisted data.

---

## Encrypt Sensitive Data

Use encryption for:

* Authentication tokens
* Personal information
* Sensitive business data

---

# Summary

The Storage Engine is the persistence foundation of Lagless Core.

It provides:

* Storage abstraction
* Multiple storage providers
* Serialization
* Versioning
* Migrations
* Encryption
* Compression
* Batch operations

while maintaining a consistent API regardless of the underlying storage implementation.
