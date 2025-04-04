# @jerni/store-mongodb

MongoDB store implementation for [Jerni](https://github.com/tungv/jerni).

## Installation

```bash
npm install @jerni/store-mongodb
# or
yarn add @jerni/store-mongodb
# or
bun add @jerni/store-mongodb
```

## Usage

```typescript
import { makeMongoDBStore, MongoDBModel } from "@jerni/store-mongodb";

// Create a model
const userModel = new MongoDBModel({
  name: "users",
  version: "1",
  transform: (event) => {
    if (event.type === "USER_CREATED") {
      return [
        {
          insertOne: {
            _id: event.payload.id,
            name: event.payload.name,
            email: event.payload.email,
            __v: event.id,
          },
        },
      ];
    }
    return [];
  },
});

// Create a store
const store = await makeMongoDBStore({
  name: "my-store",
  url: "mongodb://localhost:27017",
  dbName: "my-database",
  models: [userModel],
});

// Use with jerni
const journey = makeJourney({
  stores: [store],
});
```

## Features

- Optimistic updates support
- Automatic versioning with `__v` field
- Built-in TypeScript support
- Efficient bulk operations
- Automatic collection naming based on model name and version

## API Reference

### `makeMongoDBStore(config)`

Creates a new MongoDB store instance.

#### Config Options

- `name`: Store name
- `url`: MongoDB connection URL
- `dbName`: Database name
- `models`: Array of MongoDBModel instances
- `logger`: Optional custom logger

### `MongoDBModel`

Creates a new model definition.

#### Constructor Options

- `name`: Model name
- `version`: Model version
- `transform`: Event transform function
- `meta`: Optional metadata

## License

MIT
