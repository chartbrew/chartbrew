import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { applyTransformation } = require("../../modules/dataTransformations.js");

describe("dataTransformations", () => {
  it("flattens nested arrays using transform.config", () => {
    const data = {
      orders: [
        {
          id: 1,
          customer: {
            name: "Acme",
          },
          line_items: [
            { sku: "sku_1", qty: 2 },
            { sku: "sku_2", qty: 1 },
          ],
        },
        {
          id: 2,
          customer: {
            name: "Globex",
          },
          line_items: [],
        },
      ],
    };

    const transform = {
      enabled: true,
      type: "flattenNested",
      config: {
        baseArrayPath: "orders",
        nestedArrayPath: "line_items",
        outputFields: {
          orderId: {
            from: "base",
            path: "id",
          },
          customerName: {
            from: "base",
            path: "customer.name",
          },
          sku: {
            from: "nested",
            path: "sku",
          },
          quantity: {
            from: "nested",
            path: "qty",
          },
        },
      },
    };

    expect(applyTransformation(data, transform)).toEqual([
      {
        orderId: 1,
        customerName: "Acme",
        sku: "sku_1",
        quantity: 2,
      },
      {
        orderId: 1,
        customerName: "Acme",
        sku: "sku_2",
        quantity: 1,
      },
    ]);
  });
});
