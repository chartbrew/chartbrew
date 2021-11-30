import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Container, Form, Input, Checkbox, Icon, Popup, Divider, Label, Dropdown,
} from "semantic-ui-react";

import fieldFinder from "../../../modules/fieldFinder";

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

  const _onChangePaginationField = (e, data) => {
    onPaginationChanged("paginationField", data.value);
  };

  return (
    <Container>
      <Form>
        <Form.Group widths="equal">
          <Form.Field>
            <label>Pagination template</label>
            <Dropdown
              placeholder="Select a template"
              selection
              defaultValue="custom"
              value={template || "custom"}
              onChange={(e, data) => onPaginationChanged("template", data.value)}
              options={templates}
              compact
            />
          </Form.Field>
          <Form.Field>
            <label>Enable pagination on this request</label>
            <Checkbox
              toggle
              checked={pagination}
              onChange={() => onPaginationChanged("pagination", !pagination)}
            />
          </Form.Field>
        </Form.Group>
      </Form>
      <Divider />
      <Form>
        {/* CUSTOM */}
        {template === "custom" && (
          <Form.Field width={6}>
            <Popup
              content={"The query parameter name that limits the number of item per request."}
              trigger={(
                <label>
                  {"Items per page "}
                  <Icon name="info circle" />
                </label>
              )}
              inverted
            />
            <Input
              disabled={!pagination}
              placeholder="Items per page"
              value={items}
              onChange={(e, data) => onPaginationChanged("items", data.value)}
            />
          </Form.Field>
        )}
        {template === "custom" && (
          <Form.Field width={6}>
            <Popup
              content={"The query parameter name used for the starting point of the first request. "}
              trigger={(
                <label>
                  {"Offset "}
                  <Icon name="info circle" />
                </label>
              )}
              inverted
            />
            <Input
              disabled={!pagination}
              placeholder="Offset"
              value={offset}
              onChange={(e, data) => onPaginationChanged("offset", data.value)}
            />
          </Form.Field>
        )}
        {template === "pages" && pagination && (
          <>
            <Form.Field>
              <label>Enter the query parameter name for the page</label>
              <Input
                disabled={!pagination}
                placeholder="page"
                value={offset}
                onChange={(e, data) => onPaginationChanged("offset", data.value)}
              />
            </Form.Field>
          </>
        )}

        {/* URL */}
        {template === "url" && pagination && (
          <>
            <Form.Field>
              <label>{"Click here to select a field that contains the pagination URL"}</label>
              <Dropdown
                icon={null}
                header="Type to search"
                button
                className="small button"
                options={fieldOptions}
                search
                text={paginationField || "Select a field"}
                value={paginationField}
                onChange={_onChangePaginationField}
                scrolling
                disabled={!result}
              />
              {!result && (
                <i>{" You will have to run a request before you can use this feature"}</i>
              )}
            </Form.Field>
            <Form.Field>
              <label>Or enter the object path manually here</label>
              <Input
                placeholder="pagination.next"
                value={paginationField || ""}
                onChange={_onChangePaginationField}
              />
              <Divider hidden />
            </Form.Field>
          </>
        )}

        {/* STRIPE */}
        {template === "stripe" && pagination && (
          <Form.Field>
            <p>Your request will now be paginated automatically</p>
          </Form.Field>
        )}

        {/* CURSOR-BASED */}
        {template === "cursor" && (
          <Form.Field width={6}>
            <Popup
              content={"Enter the name of the query parameter that acts like a cursor for the pagination. Usually, this field is named 'start'."}
              trigger={(
                <label>
                  {"Cursor query parameter "}
                  <Icon name="info circle" />
                </label>
              )}
              inverted
            />
            <Input
              disabled={!pagination}
              placeholder="Cursor query parameter name"
              value={offset}
              onChange={(e, data) => onPaginationChanged("offset", data.value)}
            />
          </Form.Field>
        )}
        {template === "cursor" && (
          <Form.Field width={6}>
            <Popup
              content={"This should be the name of the field in the response that points to the next cursor position. This will help Chartbrew automatically set the cursor start position. "}
              trigger={(
                <label>
                  {"Next cursor field name "}
                  <Icon name="info circle" />
                </label>
              )}
              inverted
            />
            <Input
              disabled={!pagination}
              placeholder="Next cursor field name"
              value={items}
              onChange={(e, data) => onPaginationChanged("items", data.value)}
            />
          </Form.Field>
        )}

        <Form.Field width={6}>
          <Popup
            content={"The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited"}
            trigger={(
              <label>
                {"Maximum number of items (0 = unlimited)"}
                <Icon name="info circle" />
              </label>
            )}
            inverted
          />
          <Input
            disabled={!pagination}
            placeholder="Limit"
            type="number"
            value={itemsLimit}
            onChange={(e, data) => onPaginationChanged("itemsLimit", data.value)}
          />
        </Form.Field>
      </Form>

      {pagination && template === "custom" && (
        <>
          <Divider />
          <span>
            {"You should include these query parameters: "}
            <Label>{`${items}=<xxx>&${offset}=<xxx> `}</Label>
            {(apiRoute.indexOf(`?${items}=`) > -1 || apiRoute.indexOf(`&${items}=`) > -1) && (
              <Label color="green">{`${items} was found`}</Label>
            )}
            {(apiRoute.indexOf(`?${items}=`) === -1 && apiRoute.indexOf(`&${items}=`) === -1) && (
              <Label color="red">{`${items} not found in route`}</Label>
            )}
            {(apiRoute.indexOf(`?${offset}=`) > -1 || apiRoute.indexOf(`&${offset}=`) > -1) && (
              <Label color="green">{`${offset} was found`}</Label>
            )}
            {(apiRoute.indexOf(`?${offset}=`) === -1 && apiRoute.indexOf(`&${offset}=`) === -1) && (
              <Label color="red">{`${offset} not found in route`}</Label>
            )}
          </span>
          <Divider hidden />
          <p>
            {"The maximum amount of item that you're going to get is: "}
            <Label>{itemsLimit === "0" || !itemsLimit ? "no max" : itemsLimit}</Label>
          </p>
        </>
      )}
    </Container>
  );
}

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
