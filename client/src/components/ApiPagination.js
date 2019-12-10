import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Container, Form, Input, Checkbox, Icon, Popup, Divider,
} from "semantic-ui-react";

/*
  Component used for creating an automated pagination for APIs
*/
class ApiPagination extends Component {
  render() {
    const {
      items, itemsLimit, offset, pagination,
      onPaginationChanged,
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
            <Form.Field width={4}>
              <Popup
                content={"The amount of items to get per request"}
                trigger={(
                  <label>
                    {"Items "}
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
            <Form.Field width={4}>
              <Popup
                content={"The total amount of items to get. Put 0 for getting everything."}
                trigger={(
                  <label>
                    {"Limit "}
                    <Icon name="info circle" />
                  </label>
                )}
              />
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Limit"
                value={itemsLimit}
                onChange={(e, data) => onPaginationChanged("itemsLimit", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Group widths={2}>
            <Form.Field width={4}>
              <Popup
                content={"Set this to whatever value you want to start from"}
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

          <Form.Field>
            <Checkbox
              label="Activate pagination"
              toggle
              checked={pagination}
              onChange={() => onPaginationChanged("pagination", !pagination)}
            />
          </Form.Field>
        </Form>
      </Container>
    );
  }
}

ApiPagination.propTypes = {
  items: PropTypes.string.isRequired,
  itemsLimit: PropTypes.string.isRequired,
  offset: PropTypes.string.isRequired,
  pagination: PropTypes.bool.isRequired,
  onPaginationChanged: PropTypes.func.isRequired,
};

export default ApiPagination;
