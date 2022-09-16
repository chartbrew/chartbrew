import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Divider, Dropdown, Grid, Input, Spacer, Switch, Text, Tooltip,
} from "@nextui-org/react";

import { ChevronDown, InfoCircle } from "react-iconly";
import fieldFinder from "../../../modules/fieldFinder";
import Badge from "../../../components/Badge";

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
    <Grid.Container gap={1}>
      <Grid xs={12} sm={8} direction="column">
        <Text size={16}>Pagination type</Text>
        <Dropdown>
          <Dropdown.Trigger>
            <Input
              value={(template && templates.find((t) => t.value === template).text) || "Custom"}
              bordered
              fullWidth
              animated={false}
              contentRight={<ChevronDown />}
            />
          </Dropdown.Trigger>
          <Dropdown.Menu
            onAction={(key) => onPaginationChanged("template", key)}
            selectedKeys={[template]}
            selectionMode="single"
          >
            {templates.map((t) => (
              <Dropdown.Item key={t.value} value={t.value}>
                {t.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </Grid>
      <Grid xs={12} sm={4} alignItems="center" direction="column">
        <Text size={16}>Enable pagination on this request</Text>
        <Switch
          checked={pagination}
          onChange={() => onPaginationChanged("pagination", !pagination)}
        />
      </Grid>

      <Grid xs={12} direction="column">
        <Spacer y={1} />
        <Divider />
        <Spacer y={0.5} />
      </Grid>

      {/* CUSTOM */}
      {template === "custom" && (
        <Grid xs={12} sm={6} direction="column">
          <Tooltip
            content={"The query parameter name that limits the number of item per request."}
            css={{ zIndex: 10000 }}
            placement="topStart"
          >
            <div style={styles.rowDisplay}>
              <Text size={16}>
                {"Items per page"}
              </Text>
              <Spacer x={0.2} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Items per page"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
      )}
      {template === "custom" && (
        <Grid xs={12} sm={6} direction="column">
          <Tooltip
            content={"The query parameter name used for the starting point of the first request."}
            css={{ zIndex: 10000 }}
            placement="topStart"
          >
            <div style={styles.rowDisplay}>
              <Text size={16}>{"Offset"}</Text>
              <Spacer x={0.2} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Offset"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
      )}
      {template === "pages" && pagination && (
        <Grid xs={12} sm={6}>
          <Input
            label={"Enter the query parameter name for the page"}
            disabled={!pagination}
            placeholder="page"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
      )}

      {/* URL */}
      {template === "url" && pagination && (
        <>
          <Grid xs={12} direction="column">
            <Text size={16}>{"Click here to select a field that contains the pagination URL"}</Text>
            <div style={styles.rowDisplay}>
              <Dropdown>
                <Dropdown.Trigger>
                  <Input
                    value={paginationField || "Select a field"}
                    bordered
                    fullWidth
                    animated={false}
                    contentRight={<ChevronDown />}
                    disabled={!result}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={_onChangePaginationField}
                  selectedKeys={[paginationField]}
                  selectionMode="single"
                >
                  {fieldOptions.map((o) => (
                    <Dropdown.Item key={o.key} value={o.key}>
                      {o.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              {!result && (
                <Text small>{" You will have to run a request before you can use this feature"}</Text>
              )}
            </div>
          </Grid>
          <Grid xs={12} direction="column">
            <Text size={16}>Or enter the object path manually here</Text>
            <Input
              placeholder="pagination.next"
              value={paginationField || ""}
              onChange={(e) => _onChangePaginationField(e.target.value)}
              bordered
              fullWidth
            />
          </Grid>
        </>
      )}

      {/* STRIPE */}
      {template === "stripe" && pagination && (
        <Grid xs={12}>
          <Text>Your request will now be paginated automatically</Text>
        </Grid>
      )}

      {/* CURSOR-BASED */}
      {template === "cursor" && (
        <Grid xs={12} sm={6} direction="column">
          <Tooltip
            content={"Enter the name of the query parameter that acts like a cursor for the pagination. Usually, this field is named 'start'."}
            css={{ zIndex: 10000 }}
            placement="topStart"
          >
            <div style={styles.rowDisplay}>
              <Text size={16}>{"Cursor query parameter"}</Text>
              <Spacer x={0.2} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Cursor query parameter name"
            value={offset}
            onChange={(e) => onPaginationChanged("offset", e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
      )}
      {template === "cursor" && (
        <Grid xs={12} sm={6} direction="column">
          <Tooltip
            content={"This should be the name of the field in the response that points to the next cursor position. This will help Chartbrew automatically set the cursor start position. "}
            css={{ zIndex: 10000, maxWidth: 400 }}
            placement="topStart"
          >
            <div style={styles.rowDisplay}>
              <Text size={16}>{"Next cursor field name"}</Text>
              <Spacer x={0.2} />
              <InfoCircle size="small" />
            </div>
          </Tooltip>
          <Input
            disabled={!pagination}
            placeholder="Next cursor field name"
            value={items}
            onChange={(e) => onPaginationChanged("items", e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
      )}

      <Grid xs={12} sm={6} direction="column">
        <Tooltip
          content={"The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited"}
          css={{ zIndex: 10000 }}
          placement="topStart"
        >
          <div style={styles.rowDisplay}>
            <Text size={16}>{"Maximum number of items (0 = unlimited)"}</Text>
            <Spacer x={0.2} />
            <InfoCircle size="small" />
          </div>
        </Tooltip>
        <Input
          disabled={!pagination}
          placeholder="Limit"
          type="number"
          value={itemsLimit}
          onChange={(e) => onPaginationChanged("itemsLimit", e.target.value)}
          bordered
          fullWidth
        />
      </Grid>

      <Grid xs={12} direction="column">
        <Spacer y={0.5} />
      </Grid>

      {pagination && template === "custom" && (
        <Grid xs={12} direction="column">
          <Text>{"You should include these query parameters: "}</Text>
          <Spacer y={0.5} />
          <div style={styles.rowDisplay}>
            <Badge>
              <Text size={16}>{`${items}=<xxx>&${offset}=<xxx> `}</Text>
            </Badge>
            <Spacer x={0.5} />
            {(apiRoute.indexOf(`?${items}=`) > -1 || apiRoute.indexOf(`&${items}=`) > -1) && (
              <>
                <Badge type="success">
                  <Text size={16}>{`${items} was found`}</Text>
                </Badge>
                <Spacer x={0.2} />
              </>
            )}
            {(apiRoute.indexOf(`?${items}=`) === -1 && apiRoute.indexOf(`&${items}=`) === -1) && (
              <>
                <Spacer x={0.2} />
                <Badge type="error">
                  <Text size={16}>{`${items} not found in route`}</Text>
                </Badge>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) > -1 || apiRoute.indexOf(`&${offset}=`) > -1) && (
              <>
                <Spacer x={0.2} />
                <Badge type="success">
                  <Text size={16}>{`${offset} was found`}</Text>
                </Badge>
              </>
            )}
            {(apiRoute.indexOf(`?${offset}=`) === -1 && apiRoute.indexOf(`&${offset}=`) === -1) && (
              <>
                <Spacer x={0.2} />
                <Badge type="error">
                  <Text size={16}>{`${offset} not found in route`}</Text>
                </Badge>
              </>
            )}
          </div>
          <Spacer y={0.5} />
          <div style={styles.rowDisplay}>
            <Text>
              {"The maximum amount of item that you're going to get is: "}
            </Text>
            <Badge>
              <Text size={16}>{itemsLimit === "0" || !itemsLimit ? "no max" : itemsLimit}</Text>
            </Badge>
          </div>
        </Grid>
      )}
    </Grid.Container>
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
