import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Separator, Input, Switch, Tooltip, Chip, Select, Label, ListBox,
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
          id="api-pagination-enable"
          isSelected={pagination}
          onChange={(selected) => onPaginationChanged("pagination", selected)}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <Label htmlFor="api-pagination-enable">Enable pagination on this request</Label>
          </Switch.Content>
        </Switch>
      </div>
      <div className="col-span-12">
        <Select
          variant="secondary"
          onChange={(value) => onPaginationChanged("template", value)}
          value={template || null}
          selectionMode="single"
          isDisabled={!pagination}
          aria-label="Pagination type"
        >
          <Label>Pagination type</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {templates.map((t) => (
                <ListBox.Item key={t.value} id={t.value} textValue={t.text}>
                  {t.text}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="col-span-12">
        <div className="h-4" />
        <Separator />
        <div className="h-2" />
      </div>

      {/* CUSTOM */}
      {template === "custom" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip>
            <Tooltip.Trigger>
              <div style={styles.rowDisplay}>
                <Text>
                  {"Items per page"}
                </Text>
                <div className="w-1" />
                <LuInfo />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top start">
              The query parameter name that limits the number of item per request.
            </Tooltip.Content>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Items per page"
            labelPlacement="outside"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="secondary"
            fullWidth
          />
        </div>
      )}
      {template === "custom" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip>
            <Tooltip.Trigger>
              <div style={styles.rowDisplay}>
                <Text>{"Offset"}</Text>
                <div className="w-1" />
                <LuInfo />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top start">
              The query parameter name used for the starting point of the first request.
            </Tooltip.Content>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Offset"
            labelPlacement="outside"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="secondary"
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
            variant="secondary"
            fullWidth
          />
        </div>
      )}

      {/* URL */}
      {template === "url" && (
        <>
          <div className="col-span-12">
            <div className="text-sm">{"Click here to select a field that contains the pagination URL"}</div>
            <div className="h-2" />
            <div style={styles.rowDisplay}>
              <Select
                variant="secondary"
                onChange={(value) => _onChangePaginationField(value)}
                value={paginationField || null}
                selectionMode="single"
                placeholder="Select a field"
                isDisabled={!result || !pagination}
                aria-label="Select a field"
              >
                <Label>Select a field</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {fieldOptions.map((o) => (
                      <ListBox.Item key={o.key} id={o.key} textValue={o.text}>
                        {o.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {!result && (
                <div className="text-sm">{" You will have to run a request before you can use this feature"}</div>
              )}
            </div>
          </div>
          <div className="col-span-12">
            <div className="text-sm">Or enter the object path manually here</div>
            <div className="h-2" />
            <Input
              placeholder="pagination.next"
              labelPlacement="outside"
              value={paginationField || ""}
              onChange={(e) => _onChangePaginationField(e.target.value)}
              variant="secondary"
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
          <Tooltip>
            <Tooltip.Trigger>
              <div style={styles.rowDisplay}>
                <div className="text-sm">{"Cursor query parameter"}</div>
                <div className="w-1" />
                <LuInfo />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top start">
              {"Enter the name of the query parameter that acts like a cursor for the pagination. Usually, this field is named 'start'."}
            </Tooltip.Content>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Cursor query parameter name"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            variant="secondary"
            fullWidth
          />
        </div>
      )}
      {template === "cursor" && (
        <div className="col-span-12 md:col-span-6">
          <Tooltip>
            <Tooltip.Trigger>
              <div style={styles.rowDisplay}>
                <div className="text-sm">{"Next cursor field name"}</div>
                <div className="w-1" />
                <LuInfo />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-[400px]" placement="top start">
              This should be the name of the field in the response that points to the next cursor position. This will help Chartbrew automatically set the cursor start position.
            </Tooltip.Content>
          </Tooltip>
          <Input
            isDisabled={!pagination}
            placeholder="Next cursor field name"
            labelPlacement="outside"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            variant="secondary"
            fullWidth
          />
        </div>
      )}

      <div className="col-span-12">
        <Tooltip>
          <Tooltip.Trigger>
            <div style={styles.rowDisplay}>
              <div className="text-sm">{"Maximum number of items (0 = unlimited)"}</div>
              <div className="w-1" />
              <LuInfo />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content placement="top start">
            The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited
          </Tooltip.Content>
        </Tooltip>
        <Input
          isDisabled={!pagination}
          placeholder="Limit"
          labelPlacement="outside"
          type="number"
          value={itemsLimit}
          onChange={(e) => onPaginationChanged("itemsLimit", e.target.value)}
          variant="secondary"
          fullWidth
        />
      </div>

      <div className="col-span-12">
        <div className="h-2" />
      </div>

      {pagination && template === "custom" && (
        <div className="col-span-12">
          <div className="text-sm">{"You should include these query parameters: "}</div>
          <div className="h-2" />
          <div style={styles.rowDisplay}>
            <Chip size="sm" variant="soft" className="rounded-sm">
              {`${items}=<xxx>&${offset}=<xxx> `}
            </Chip>
            <div className="w-2" />
            {(apiRoute.indexOf(`?${items}=`) > -1 || apiRoute.indexOf(`&${items}=`) > -1) && (
              <>
                <Chip color="success" size="sm" variant="soft" className="rounded-sm">
                  {`${items} was found`}
                </Chip>
                <div className="w-1" />
              </>
            )}
            {(apiRoute.indexOf(`?${items}=`) === -1 && apiRoute.indexOf(`&${items}=`) === -1) && (
              <>
                <div className="w-1" />
                <Chip color="warning" size="sm" variant="soft" className="rounded-sm">
                  {`${items} not found in route`}
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) > -1 || apiRoute.indexOf(`&${offset}=`) > -1) && (
              <>
                <div className="w-1" />
                <Chip color="success" size="sm" variant="soft" className="rounded-sm">
                  {`${offset} was found`}
                </Chip>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) === -1 && apiRoute.indexOf(`&${offset}=`) === -1) && (
              <>
                <div className="w-1" />
                <Chip color="warning" size="sm" variant="soft" className="rounded-sm">
                  {`${offset} not found in route`}
                </Chip>
              </>
            )}
          </div>
          <div className="h-2" />
          <div style={styles.rowDisplay}>
            <div className="text-sm">
              {"The maximum amount of item that you're going to get is: "}
            </div>
            <div className="w-2" />
            <Chip size="sm" variant="soft" className="rounded-sm">
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
