import React, { useEffect } from "react";
import PropTypes from "prop-types";
import {
  Container, Form, Input, Checkbox, Icon, Popup, Divider, Label, Dropdown,
} from "semantic-ui-react";

const templates = [{
  key: "custom",
  value: "custom",
  text: "Custom template",
}, {
  key: "stripe",
  value: "stripe",
  text: "Stripe",
}];

/*
  Component used for creating an automated pagination for APIs
*/
function ApiPagination(props) {
  const {
    items, itemsLimit, offset, pagination,
    onPaginationChanged, apiRoute, template,
  } = props;

  useEffect(() => {
    if (!template) {
      onPaginationChanged("template", "custom");
    }
  }, []);

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
            />
            <Input
              disabled={!pagination}
              placeholder="Offset"
              value={offset}
              onChange={(e, data) => onPaginationChanged("offset", data.value)}
            />
          </Form.Field>
        )}
        {template === "stripe" && pagination && (
          <p>Your request will now be paginated automatically</p>
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
};

ApiPagination.propTypes = {
  items: PropTypes.string.isRequired,
  itemsLimit: PropTypes.number.isRequired,
  offset: PropTypes.string.isRequired,
  pagination: PropTypes.bool.isRequired,
  onPaginationChanged: PropTypes.func.isRequired,
  apiRoute: PropTypes.string,
  template: PropTypes.string,
};

export default ApiPagination;
