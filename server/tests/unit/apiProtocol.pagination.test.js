import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Module = require("module");

function loadApiProtocolWithSafeRequest(safeRequestMock) {
  const safeRequestPath = require.resolve("../../modules/safeRequest.js");
  const paginateRequestsPath = require.resolve("../../modules/paginateRequests.js");
  const apiProtocolPath = require.resolve("../../sources/shared/protocols/api.protocol.js");
  const previousSafeRequest = require.cache[safeRequestPath];

  delete require.cache[apiProtocolPath];
  delete require.cache[paginateRequestsPath];

  const mockedSafeRequestModule = new Module(safeRequestPath);
  mockedSafeRequestModule.filename = safeRequestPath;
  mockedSafeRequestModule.loaded = true;
  mockedSafeRequestModule.exports = safeRequestMock;
  require.cache[safeRequestPath] = mockedSafeRequestModule;

  const apiProtocol = require(apiProtocolPath);

  return {
    apiProtocol,
    restore() {
      delete require.cache[apiProtocolPath];
      delete require.cache[paginateRequestsPath];
      if (previousSafeRequest) {
        require.cache[safeRequestPath] = previousSafeRequest;
      } else {
        delete require.cache[safeRequestPath];
      }
    },
  };
}

describe("API protocol pagination", () => {
  beforeEach(() => {
    const execution = require("../../modules/sourceExecution");
    vi.spyOn(execution, "runSourceExecution").mockImplementation((_options, operation) => operation());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("wraps Stripe paginated responses in the standard data request response shape", async () => {
    vi.useFakeTimers();

    const safeRequestMock = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        object: "list",
        data: [{ id: "cus_1" }],
        has_more: false,
      }),
    });
    const { apiProtocol, restore } = loadApiProtocolWithSafeRequest(safeRequestMock);
    const drCacheController = require("../../controllers/DataRequestCacheController.js");
    const cacheSpy = vi.spyOn(drCacheController, "create").mockResolvedValue({});

    try {
      const dataRequest = {
        id: 7,
        route: "/customers",
        method: "GET",
        headers: {},
        useGlobalHeaders: false,
        pagination: true,
        items: "data",
        offset: "starting_after",
        itemsLimit: 1000,
        paginationField: null,
        template: "stripe",
      };
      const responsePromise = apiProtocol.runDataRequest({
        connection: {
          type: "api",
          getApiUrl: () => "https://api.stripe.com/v1",
        },
        dataRequest,
        getCache: false,
      });

      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        dataRequest,
        responseData: {
          data: {
            object: "list",
            data: [{ id: "cus_1" }],
            has_more: false,
          },
        },
      });
      expect(cacheSpy).toHaveBeenCalledWith(7, expect.objectContaining({
        dataRequest,
        responseData: expect.objectContaining({
          data: expect.objectContaining({
            data: [{ id: "cus_1" }],
          }),
        }),
      }));
    } finally {
      restore();
    }
  });
});
