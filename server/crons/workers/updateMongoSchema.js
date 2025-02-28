const mongoose = require("mongoose");

const db = require("../../models/models");
const assembleMongoUrl = require("../../modules/assembleMongoUrl");

/**
 * Determine the type of a value
 * @param {*} value - The value to check
 * @returns {string} - The type of the value
 */
function determineType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (mongoose.Types.ObjectId.isValid(value) && value.toString().length === 24) return "objectId";
  if (typeof value === "object") return "object";
  return typeof value;
}

/**
 * Infer schema from a collection by sampling documents
 * @param {Object} db - MongoDB database connection
 * @param {string} collectionName - Name of the collection
 * @returns {Object} - Inferred schema
 */
async function inferCollectionSchema(db, collectionName) {
  try {
    const collection = db.collection(collectionName);

    // Get total count of documents
    const count = await collection.countDocuments();

    // Sample documents (up to 10)
    const sampleSize = Math.min(10, count);
    const documents = await collection.find().limit(sampleSize).toArray();

    if (documents.length === 0) {
      return { fields: {}, count };
    }

    // Combine all document keys to get a complete schema
    const schema = { fields: {}, count };

    documents.forEach((doc) => {
      // Process first level keys
      Object.keys(doc).forEach((key) => {
        const value = doc[key];
        const type = determineType(value);

        if (!schema.fields[key]) {
          schema.fields[key] = { type };

          // For arrays, try to determine the type of items
          if (type === "array" && value.length > 0) {
            const itemType = determineType(value[0]);
            schema.fields[key].items = { type: itemType };

            // For arrays of objects, recursively process their structure
            if (itemType === "object" && value[0]) {
              schema.fields[key].items.fields = {};
              Object.keys(value[0]).forEach((subKey) => {
                schema.fields[key].items.fields[subKey] = {
                  type: determineType(value[0][subKey])
                };
              });
            }
          }

          // For objects, recursively process their structure
          if (type === "object") {
            schema.fields[key].fields = {};
            Object.keys(value || {}).forEach((subKey) => {
              schema.fields[key].fields[subKey] = {
                type: determineType(value[subKey])
              };
            });
          }
        }
      });
    });

    return schema;
  } catch (error) {
    return { fields: {}, count: 0, error: error.message };
  }
}

/**
 * Update the MongoDB schema for a connection
 * @param {Object} connection - The connection object
 * @returns {Promise<Object>} - The updated connection
 */
async function updateMongoSchema(connection) {
  let mongoConnection;

  try {
    // Get MongoDB connection URL
    let mongoUrl;
    if (connection.connectionString) {
      mongoUrl = connection.connectionString;
    } else {
      mongoUrl = assembleMongoUrl(connection);
    }

    // Connect to MongoDB
    mongoConnection = mongoose.createConnection(mongoUrl, {
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    await mongoConnection.asPromise();
    const mongoDb = mongoConnection.db;

    // Get all collections
    const collections = await mongoDb.listCollections().toArray();

    // Infer schema for each collection
    const schema = {
      collections: {},
      updatedAt: new Date().toISOString(),
    };

    const collectionPromises = collections.map(async (collection) => {
      const collectionName = collection.name;
      return {
        collectionName,
        collectionSchema: await inferCollectionSchema(mongoDb, collectionName),
      };
    });

    const collectionSchemas = await Promise.all(collectionPromises);
    collectionSchemas.forEach(({ collectionName, collectionSchema }) => {
      schema.collections[collectionName] = collectionSchema;
    });

    // Update the connection with the inferred schema
    await db.Connection.update({ schema }, { where: { id: connection.id } });

    // Close the MongoDB connection
    if (mongoConnection) {
      mongoConnection.close();
    }

    return { success: true, message: "Schema updated successfully" };
  } catch (error) {
    // Close the MongoDB connection if it exists
    if (mongoConnection) {
      mongoConnection.close();
    }

    return { success: false, error: error.message };
  }
}

module.exports = async (job) => {
  try {
    const connectionId = job.data.connection_id;

    // Get the connection
    const connection = await db.Connection.findOne({ where: { id: connectionId } });

    if (!connection) {
      throw new Error(`Connection with ID ${connectionId} not found`);
    }

    if (connection.type !== "mongodb") {
      throw new Error(`Connection with ID ${connectionId} is not a MongoDB connection`);
    }

    // Update the MongoDB schema
    const result = await updateMongoSchema(connection);

    return result;
  } catch (error) {
    throw new Error(error.message || error);
  }
};
