import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Divider, Input, Spacer, Switch, Tooltip, Chip, SelectItem, Select,
} from "@heroui/react";
import { LuInfo } from "react-icons/lu";

import fieldFinder from "../../../modules/fieldFinder";
import Text from "../../../components/Text";

const templates = [{
  key: "custom",
  value: "custom",
  text: "Custom template",
}, {
  key: "pages",
  value: "pages",
  text: "Pages",
}, {
  key: "url",
  value: "url",
  text: "Pagination URL",
}, {
  key: "stripe",
  value: "stripe",
  text: "Stripe",
}, {
  key: "cursor",
  value: "cursor",
  text: "Cursor-based",
}];

/*
  Component used for creating an automated pagination for APIs
*/
function ApiPagination(props) {
  const {
    items, itemsLimit, offset, paginationField, pagination,
    onPaginationChanged, apiRoute, template, result,
  } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  useEffect(() => {
    if (!template) {
      onPaginationChanged("template", "custom");
    }
  }, []);

  useEffect(() => {
    if (result) {
      const tempFieldOptions = [];
      fieldFinder(result, true).forEach((o) => {
        if (o.field && o.type === "string") {
          let text = o.field && o.field.replace("root[].", "").replace("root.", "");
          if (o.type === "array") text += "(get element count)";
          tempFieldOptions.push({
            key: o.field,
            text: o.field && text,
            value: o.field && text,
            type: o.type,
            label: {
              style: { width: 55, textAlign: "center" },
              content: o.type || "unknown",
              size: "mini",
              color: o.type === "date" ? "olive"
                : o.type === "number" ? "blue"
                  : o.type === "string" ? "teal"
                    : o.type === "boolean" ? "purple"
                      : "grey"
            },
          });
        }
      });

      setFieldOptions(tempFieldOptions);
    }
  }, [result]);

  const _onChangePaginationField = (value) => {
    onPaginationChanged("paginationField", value);
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <Switch
          isSelected={pagination}
          onChange={() => onPaginationChanged("pagination", !pagination)}
        >
          Enable pagination on this request
        </Switch>
      </div>
      <div className="col-span-12">
        <Select
          variant="bordered"
          onSelectionChange={(keys) => onPaginationChanged("template", keys.currentKey)}
          selectedKeys={[template]}
          selectionMode="single"
          label="Pagination type"
          isDisabled={!pagination}
          aria-label="Pagination type"
        >
          {templates.map((t) => (
            <SelectItem key={t.value} textValue={t.text}>
              {t.text}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="col-span-12">
        <Spacer y={2} />
        <Divider />
        <Spacer y={1} />
      </div>

      {/* CUSTOM */}
      {template === "custom" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip
            content={"The query parameter name that limits the number of item per request."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text>
                {"Items per page"}
              </Text>
              <Spacer x={0.5} />
              <LuInfo />
            </div>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Items per page"
            labelPlacement="outside"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "custom" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip
            content={"The query parameter name used for the starting point of the first request."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text>{"Offset"}</Text>
              <Spacer x={0.5} />
              <LuInfo />
            </div>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Offset"
            labelPlacement="outside"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "pages" && (
        <div className="col-span-12 md:col-span-6">
          <Input
            label={"Enter the query parameter name for the page"}
            isDisabled={!pagination}
            placeholder="page"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}

      {/* URL */}
      {template === "url" && (
        <>
          <div className="col-span-12">
            <div className="text-sm">{"Click here to select a field that contains the pagination URL"}</div>
            <Spacer y={1} />
            <div style={styles.rowDisplay}>
              <Select
                variant="bordered"
                onSelectionChange={(keys) => _onChangePaginationField(keys.currentKey)}
                selectedKeys={[paginationField]}
                selectionMode="single"
                label="Select a field"
                placeholder="Select a field"
                isDisabled={!result || !pagination}
                aria-label="Select a field"
              >
                {fieldOptions.map((o) => (
                  <SelectItem key={o.key} textValue={o.text}>
                    {o.text}
                  </SelectItem>
                ))}
              </Select>
              {!result && (
                <div className="text-sm">{" You will have to run a request before you can use this feature"}</div>
              )}
            </div>
          </div>
          <div className="col-span-12">
            <div className="text-sm">Or enter the object path manually here</div>
            <Spacer y={1} />
            <Input
              placeholder="pagination.next"
              labelPlacement="outside"
              value={paginationField || ""}
              onChange={(e) => _onChangePaginationField(e.target.value)}
              variant="bordered"
              fullWidth
              isDisabled={!pagination}
            />
          </div>
        </>
      )}

      {/* STRIPE */}
      {template === "stripe" && (
        <div className="col-span-12">
          <div className="text-sm">Your request will now be paginated automatically</div>
        </div>
      )}

      {/* CURSOR-BASED */}
      {template === "cursor" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip
            content={"Enter the name of the query parameter that acts like a cursor for the pagination. Usually, this field is named 'start'."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <div className="text-sm">{"Cursor query parameter"}</div>
              <Spacer x={0.5} />
              <LuInfo />
            </div>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Cursor query parameter name"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "cursor" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip
            content={"This should be the name of the field in the response that points to the next cursor position. This will help Chartbrew automatically set the cursor start position. "}
            className="max-w-[400px]"
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <div className="text-sm">{"Next cursor field name"}</div>
              <Spacer x={0.5} />
              <LuInfo />
            </div>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Next cursor field name"
            labelPlacement="outside"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}

      <div className="col-span-12">
        <Tooltip
          content={"The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited"}
          placement="top-start"
        >
          <div style={styles.rowDisplay}>
            <div className="text-sm">{"Maximum number of items (0 = unlimited)"}</div>
            <Spacer x={0.5} />
            <LuInfo />
          </div>
        </Tooltip>
        <Input
          isDisabled={!pagination}
          placeholder="Limit"
          labelPlacement="outside"
          type="number"
          value={itemsLimit}
          onChange={(e) => onPaginationChanged("itemsLimit", e.target.value)}
          variant="bordered"
          fullWidth
        />
      </div>

      <div className="col-span-12">
        <Spacer y={1} />
      </div>

      {pagination && template === "custom" && (
        <div className="col-span-12">
          <div className="text-sm">{"You should include these query parameters: "}</div>
          <Spacer y={1} />
          <div style={styles.rowDisplay}>
            <Chip size="sm" radius="sm" variant="flat">
              {`${items}=<xxx>&${offset}=<xxx> `}
            </Chip>
            <Spacer x={1} />
            {(apiRoute.indexOf(`?${items}=`) > -1 || apiRoute.indexOf(`&${items}=`) > -1) && (
              <>
                <Chip color="success" size="sm" radius="sm" variant="flat">
                  {`${items} was found`}
                </Chip>
                <Spacer x={0.5} />
              </>
            )}
            {(apiRoute.indexOf(`?${items}=`) === -1 && apiRoute.indexOf(`&${items}=`) === -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="warning" size="sm" radius="sm" variant="flat">
                  {`${items} not found in route`}
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) > -1 || apiRoute.indexOf(`&${offset}=`) > -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="success" size="sm" radius="sm" variant="flat">
                  {`${offset} was found`}
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) === -1 && apiRoute.indexOf(`&${offset}=`) === -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="warning" size="sm" radius="sm" variant="flat">
                  {`${offset} not found in route`}
                </Chip>
              </>
            )}
          </div>
          <Spacer y={1} />
          <div style={styles.rowDisplay}>
            <div className="text-sm">
              {"The maximum amount of item that you're going to get is: "}
            </div>
            <Spacer x={1} />
            <Chip size="sm" radius="sm" variant="flat">
              {itemsLimit === "0" || !itemsLimit ? "no max" : itemsLimit}
            </Chip>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  rowDisplay: {
    display: "flex",
    alignItems: "center",
  }
};

ApiPagination.defaultProps = {
  apiRoute: "",
  template: "custom",
  result: null,
  paginationField: "",
};

ApiPagination.propTypes = {
  items: PropTypes.string.isRequired,
  itemsLimit: PropTypes.number.isRequired,
  offset: PropTypes.string.isRequired,
  paginationField: PropTypes.string,
  pagination: PropTypes.bool.isRequired,
  onPaginationChanged: PropTypes.func.isRequired,
  apiRoute: PropTypes.string,
  template: PropTypes.string,
  result: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
};

export default ApiPagination;
