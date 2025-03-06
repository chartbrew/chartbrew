const createClickHouseClient = require("./clickhouseClient");

class ClickHouseConnector {
  constructor(connection) {
    this.connection = connection;
    this.client = null;
  }

  async connect() {
    if (!this.client) {
      this.client = await createClickHouseClient(this.connection);
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async query(queryString, params = {}) {
    try {
      await this.connect();

      // Execute the query
      const result = await this.client.query({
        query: queryString,
        format: "JSONEachRow",
        query_params: params
      });

      // Convert the result to JSON
      const jsonResult = await result.json();
      return jsonResult;
    } catch (error) {
      throw new Error(`ClickHouse query error: ${error.message}`);
    }
  }

  async getTables() {
    try {
      await this.connect();
      const result = await this.client.query({
        query: "SELECT name FROM system.tables WHERE database = {database:String}",
        format: "JSONEachRow",
        query_params: {
          database: this.connection.dbName
        }
      });

      const tables = await result.json();
      return tables.map((table) => table.name);
    } catch (error) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }
  }

  async getColumns(tableName) {
    try {
      await this.connect();
      const result = await this.client.query({
        query: `
          SELECT 
            name,
            type,
            comment
          FROM system.columns 
          WHERE database = {database:String} 
          AND table = {table:String}
        `,
        format: "JSONEachRow",
        query_params: {
          database: this.connection.dbName,
          table: tableName
        }
      });

      return await result.json();
    } catch (error) {
      throw new Error(`Failed to fetch columns: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    try {
      await this.connect();
      const result = await this.client.query({
        query: `
          SELECT 
            name,
            type,
            comment,
            is_in_primary_key,
            is_in_sorting_key,
            is_in_partition_key
          FROM system.columns 
          WHERE database = {database:String} 
          AND table = {table:String}
        `,
        format: "JSONEachRow",
        query_params: {
          database: this.connection.dbName,
          table: tableName
        }
      });

      return await result.json();
    } catch (error) {
      throw new Error(`Failed to fetch table schema: ${error.message}`);
    }
  }

  async getDatabaseSchema() {
    try {
      await this.connect();

      // First get all tables in the database
      const tablesResult = await this.client.query({
        query: `
          SELECT name
          FROM system.tables
          WHERE database = {database:String}
        `,
        format: "JSONEachRow",
        query_params: {
          database: this.connection.dbName
        }
      });

      const tables = await tablesResult.json();

      // Get schema for each table in parallel
      const schemaPromises = tables.map((table) => {
        const tableName = table.name;
        return this.client.query({
          query: `
            SELECT 
              name,
              type,
              comment,
              is_in_primary_key,
              is_in_sorting_key,
              is_in_partition_key
            FROM system.columns 
            WHERE database = {database:String}
            AND table = {table:String}
          `,
          format: "JSONEachRow",
          query_params: {
            database: this.connection.dbName,
            table: tableName
          }
        }).then((result) => result.json())
          .then((columns) => ({ tableName, columns }));
      });

      const results = await Promise.all(schemaPromises);

      const schema = results.reduce((acc, { tableName, columns }) => {
        acc[tableName] = columns;
        return acc;
      }, {});

      return {
        success: true,
        schema
      };
    } catch (error) {
      throw new Error(`Failed to fetch database schema: ${error.message}`);
    }
  }
}

module.exports = ClickHouseConnector;
