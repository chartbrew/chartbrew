const simplecrypt = require("simplecrypt");

const { encrypt, decrypt } = require("../../modules/cbCrypto");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const DataRequest = sequelize.define("DataRequest", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dataset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Dataset",
        key: "id",
        onDelete: "cascade",
      },
      description: "The dataset ID that the data request is associated with"
    },
    connection_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      reference: {
        model: "Connection",
        key: "id",
        onDelete: "cascade",
      },
      description: "The connection ID that the data request is using"
    },
    method: {
      type: DataTypes.STRING,
      description: "The HTTP method to use for the data request"
    },
    route: {
      type: DataTypes.TEXT,
      description: "The route to use for the data request - API, RealtimeDB, Customer.io"
    },
    headers: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("headers", encrypt(JSON.stringify(val)));
      },
      get() {
        try {
          return JSON.parse(decrypt(this.getDataValue("headers")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("headers")));
          } catch (e) {
            return this.getDataValue("headers");
          }
        }
      },
      description: "The headers to use for the API data request"
    },
    body: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("body", encrypt(val));
      },
      get() {
        try {
          return decrypt(this.getDataValue("body"));
        } catch (e) {
          try {
            return sc.decrypt(this.getDataValue("body"));
          } catch (e) {
            return this.getDataValue("body");
          }
        }
      },
      description: "The body to use for the API data request"
    },
    useGlobalHeaders: {
      type: DataTypes.BOOLEAN,
      required: true,
      defaultValue: true,
      description: "Whether to use global headers for the API data request"
    },
    query: {
      type: DataTypes.TEXT,
      description: "The query to use for the data request"
    },
    pagination: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to use pagination for the API data request"
    },
    items: {
      type: DataTypes.STRING,
      defaultValue: "items",
      description: "[not used] The items to use for the API data request"
    },
    itemsLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      description: "The items limit to use for the API data request. Used for pagination"
    },
    offset: {
      type: DataTypes.STRING,
      defaultValue: "offset",
      description: "The offset to use for the API data request. Used for pagination"
    },
    paginationField: {
      type: DataTypes.STRING,
      description: "The pagination field to use for the API data request. Used for pagination"
    },
    template: {
      type: DataTypes.STRING,
      description: "The pagination template to use for API requests"
    },
    conditions: {
      type: DataTypes.TEXT("long"),
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      },
      description: "Conditions to apply to the data request - used for filtering Customer.io and Firestore"
    },
    /*
    ** Used for various bits for requests
    ** Possible values:
    ** - populateAttributes: true - populate attributes for Customer.io
    ** - mainCollectionSample: string - main collection sample for Firestore
    ** - subCollectionSample: string - sub collection sample for Firestore
    ** - selectedSubCollection: string - selected sub collection for Firestore
    ** - limit: number - limit for Firestore
    ** - orderBy: string - order by for Firestore
    ** - orderByDirection: string - order by direction for Firestore
    ** - accountId: string - account ID for Google Analytics
    ** - propertyId: string - property ID for Google Analytics
    ** - metrics: string - metrics for Google Analytics
    ** - dimensions: string - dimensions for Google Analytics
    ** - startDate: string - start date for Google Analytics
    ** - endDate: string - end date for Google Analytics
    ** - limitToLast: number - limit to last for RealtimeDB
    ** - limitToFirst: number - limit to first for RealtimeDB
    */
    configuration: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("configuration", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("configuration"));
        } catch (e) {
          return this.getDataValue("configuration");
        }
      },
      description: "Configuration to use for the data request"
    },
    variables: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("variables", encrypt(JSON.stringify(val)));
        } catch (e) {
          return this.setDataValue("variables", val);
        }
      },
      get() {
        try {
          return JSON.parse(decrypt(this.getDataValue("variables")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("variables")));
          } catch (e) {
            return this.getDataValue("variables");
          }
        }
      },
      description: "[Legacy]Variables to use for API data requests"
    },
    /*
    ** Used for various bits for requests
    ** Possible values:
    ** - enabled: boolean - whether to enable the transformation
    ** - type: string - the type of transformation to apply
    ** - configuration: object - the configuration for the transformation
    */
    /*
    ** Example:
    ** {
    **   "enabled": true,
    **   "type": "flattenNested",
    **   "configuration": {
    **     "baseArrayPath": "orders",
    **     "nestedArrayPath": "items",
    **     "outputFields": {
    **       "orderId": {
    **         "from": "base",
    **         "path": "id"
    **       },
    **       "product": {
    **         "from": "nested",
    **         "path": "product"
    **       },
    **       "price": {
    **         "from": "nested",
    **         "path": "price"
    **       }
    **     }
    **   }
    ** }
    */
    transform: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("transform", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("transform"));
        } catch (e) {
          return this.getDataValue("transform");
        }
      },
      description: "Transformation to apply to the data request"
    },
  }, {
    freezeTableName: true,
  });

  DataRequest.associate = (models) => {
    models.DataRequest.belongsTo(models.Dataset, { foreignKey: "dataset_id" });
    models.DataRequest.belongsTo(models.Connection, { foreignKey: "connection_id" });
    models.DataRequest.hasMany(models.VariableBinding, { foreignKey: "entity_id", constraints: false, scope: { entity_type: "DataRequest" } });
  };

  return DataRequest;
};
