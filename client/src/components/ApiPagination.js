import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Container, Form, Input, Checkbox, Icon, Popup, Divider, Label,
} from "semantic-ui-react";

/*
  Component used for creating an automated pagination for APIs
*/
class ApiPagination extends Component {
  render() {
    const {
      items, itemsLimit, offset, pagination,
      onPaginationChanged, apiRoute,
    } = this.props;

    return (
      <Container>
        <p>
          {
          `ChartBrew can paginate the request. 
          It can get all the data you need based 
          on the configuration below. If your API support pagination, 
          selector names below. The selectors are identified in the query 
          parameters or in the request body, so make sure you write those 
          in the query or body.`
          }
        </p>
        <p>{"Instead of making one big request, ChartBrew can paginate the requests automatically."}</p>
        <Divider />
        <Form>
          <Form.Group widths={2}>
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
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Items per page"
                value={items}
                onChange={(e, data) => onPaginationChanged("items", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Group widths={2}>
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
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Offset"
                value={offset}
                onChange={(e, data) => onPaginationChanged("offset", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Group widths={2}>
            <Form.Field width={6}>
              <Popup
                content={"The total amount of items to get (all the paged items put together) - Leave empty or 0 for unlimited"}
                trigger={(
                  <label>
                    {"Total maximum number "}
                    <Icon name="info circle" />
                  </label>
                )}
              />
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Limit"
                type="number"
                value={itemsLimit}
                onChange={(e, data) => onPaginationChanged("itemsLimit", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Field>
            <Checkbox
              label="Activate pagination"
              toggle
              checked={pagination}
              onChange={() => onPaginationChanged("pagination", !pagination)}
            />
          </Form.Field>
        </Form>

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
          <Label>{ itemsLimit === "0" || !itemsLimit ? "no max" : itemsLimit }</Label>
        </p>
      </Container>
    );
  }
}

ApiPagination.defaultProps = {
  apiRoute: "",
};

ApiPagination.propTypes = {
  items: PropTypes.string.isRequired,
  itemsLimit: PropTypes.number.isRequired,
  offset: PropTypes.string.isRequired,
  pagination: PropTypes.bool.isRequired,
  onPaginationChanged: PropTypes.func.isRequired,
  apiRoute: PropTypes.string,
};

export default ApiPagination;
