import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Divider, Dropdown, Input, Spacer, Switch, Tooltip, Chip, DropdownTrigger, DropdownMenu, DropdownItem,
} from "@nextui-org/react";

import { ChevronDown, InfoCircle } from "react-iconly";
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
    <div className="grid grid-cols-12 gap-1">
      <div className="col-span-8 sm:col-span-12">
        <Text b>Pagination type</Text>
        <Dropdown>
          <DropdownTrigger>
            <Input
              value={(template && templates.find((t) => t.value === template).text) || "Custom"}
              variant="bordered"
              fullWidth
              disableAnimation
              endContent={<ChevronDown />}
            />
          </DropdownTrigger>
          <DropdownMenu
            variant="bordered"
            onAction={(key) => onPaginationChanged("template", key)}
            selectedKeys={[template]}
            selectionMode="single"
          >
            {templates.map((t) => (
              <DropdownItem key={t.value} value={t.value}>
                {t.text}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>
      <div className="col-span-4 sm:col-span-12 flex items-center">
        <Text b>Enable pagination on this request</Text>
        <Switch
          isSelected={pagination}
          onChange={() => onPaginationChanged("pagination", !pagination)}
        />
      </div>

      <div className="col-span-12">
        <Spacer y={2} />
        <Divider />
        <Spacer y={1} />
      </div>

      {/* CUSTOM */}
      {template === "custom" && (
        <div className="col-span-6 sm:col-span-12">
          <Tooltip
            content={"The query parameter name that limits the number of item per request."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text b>
                {"Items per page"}
              </Text>
              <Spacer x={0.5} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Items per page"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "custom" && (
        <div className="col-span-6 sm:col-span-12">
          <Tooltip
            content={"The query parameter name used for the starting point of the first request."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text b>{"Offset"}</Text>
              <Spacer x={0.5} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Offset"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "pages" && pagination && (
        <div className="col-span-6 sm:col-span-12">
          <Input
            label={"Enter the query parameter name for the page"}
            disabled={!pagination}
            placeholder="page"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}

      {/* URL */}
      {template === "url" && pagination && (
        <>
          <div className="col-span-12">
            <Text b>{"Click here to select a field that contains the pagination URL"}</Text>
            <div style={styles.rowDisplay}>
              <Dropdown>
                <DropdownTrigger>
                  <Input
                    value={paginationField || "Select a field"}
                    variant="bordered"
                    fullWidth
                    disableAnimation
                    endContent={<ChevronDown />}
                    disabled={!result}
                  />
                </DropdownTrigger>
                <DropdownMenu
                  variant="bordered"
                  onAction={_onChangePaginationField}
                  selectedKeys={[paginationField]}
                  selectionMode="single"
                >
                  {fieldOptions.map((o) => (
                    <DropdownItem key={o.key} value={o.key}>
                      {o.text}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
              {!result && (
                <Text small>{" You will have to run a request before you can use this feature"}</Text>
              )}
            </div>
          </div>
          <div className="col-span-12">
            <Text b>Or enter the object path manually here</Text>
            <Input
              placeholder="pagination.next"
              value={paginationField || ""}
              onChange={(e) => _onChangePaginationField(e.target.value)}
              variant="bordered"
              fullWidth
            />
          </div>
        </>
      )}

      {/* STRIPE */}
      {template === "stripe" && pagination && (
        <div className="col-span-12">
          <Text>Your request will now be paginated automatically</Text>
        </div>
      )}

      {/* CURSOR-BASED */}
      {template === "cursor" && (
        <div className="col-span-6 sm:col-span-12">
          <Tooltip
            content={"Enter the name of the query parameter that acts like a cursor for the pagination. Usually, this field is named 'start'."}
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text b>{"Cursor query parameter"}</Text>
              <Spacer x={0.5} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Cursor query parameter name"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}
      {template === "cursor" && (
        <div className="col-span-6 sm:col-span-12">
          <Tooltip
            content={"This should be the name of the field in the response that points to the next cursor position. This will help Chartbrew automatically set the cursor start position. "}
            className="max-w-[400px]"
            placement="top-start"
          >
            <div style={styles.rowDisplay}>
              <Text b>{"Next cursor field name"}</Text>
              <Spacer x={0.5} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Next cursor field name"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="bordered"
            fullWidth
          />
        </div>
      )}

      <div className="col-span-6 sm:col-span-12">
        <Tooltip
          content={"The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited"}
          placement="top-start"
        >
          <div style={styles.rowDisplay}>
            <Text b>{"Maximum number of items (0 = unlimited)"}</Text>
            <Spacer x={0.5} />
            <InfoCircle size="small" />
          </div>
        </Tooltip>
        <Input
          disabled={!pagination}
          placeholder="Limit"
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
          <Text>{"You should include these query parameters: "}</Text>
          <Spacer y={1} />
          <div style={styles.rowDisplay}>
            <Chip>
              <Text>{`${items}=<xxx>&${offset}=<xxx> `}</Text>
            </Chip>
            <Spacer x={1} />
            {(apiRoute.indexOf(`?${items}=`) > -1 || apiRoute.indexOf(`&${items}=`) > -1) && (
              <>
                <Chip color="success">
                  <Text>{`${items} was found`}</Text>
                </Chip>
                <Spacer x={0.5} />
              </>
            )}
            {(apiRoute.indexOf(`?${items}=`) === -1 && apiRoute.indexOf(`&${items}=`) === -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="danger">
                  <Text>{`${items} not found in route`}</Text>
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) > -1 || apiRoute.indexOf(`&${offset}=`) > -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="success">
                  <Text>{`${offset} was found`}</Text>
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) === -1 && apiRoute.indexOf(`&${offset}=`) === -1) && (
              <>
                <Spacer x={0.5} />
                <Chip color="error">
                  <Text>{`${offset} not found in route`}</Text>
                </Chip>
              </>
            )}
          </div>
          <Spacer y={1} />
          <div style={styles.rowDisplay}>
            <Text>
              {"The maximum amount of item that you're going to get is: "}
            </Text>
            <Chip>
              <Text>{itemsLimit === "0" || !itemsLimit ? "no max" : itemsLimit}</Text>
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
