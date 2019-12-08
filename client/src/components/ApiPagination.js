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
      items, limit, offset, pagination, onItemsChanged,
      onLimitChanged, onOffsetChanged, onPaginationChanged,
    } = this.props;

    return (
      <Container>
        <p>
          {
          `ChartBrew can paginate the request. 
          It can get all the data you need based 
          on the configuration below. If your API support pagination, 
          modify the keys and values accordingly.`
          }
        </p>
        <p>{"Instead of making one big request, ChartBrew can paginate the requests automatically."}</p>
        <Divider />
        <Form>
          <Form.Group widths={3}>
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
                value={items.key}
                onChange={(e, data) => onItemsChanged("key", data.value)}
              />
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Value"
                value={items.value}
                onChange={(e, data) => onItemsChanged("value", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Group widths={3}>
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
                value={limit.key}
                onChange={(e, data) => onLimitChanged("key", data.value)}
              />
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Value"
                value={limit.value}
                onChange={(e, data) => onLimitChanged("value", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Group widths={3}>
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
                value={offset.key}
                onChange={(e, data) => onOffsetChanged("key", data.value)}
              />
            </Form.Field>
            <Form.Field width={6}>
              <Input
                placeholder="Value"
                value={offset.value}
                onChange={(e, data) => onOffsetChanged("value", data.value)}
              />
            </Form.Field>
          </Form.Group>

          <Form.Field>
            <Checkbox
              label="Activate pagination"
              toggle
              checked={pagination}
              onChange={() => onPaginationChanged(!pagination)}
            />
          </Form.Field>
        </Form>
      </Container>
    );
  }
}

ApiPagination.propTypes = {
  items: PropTypes.object.isRequired,
  limit: PropTypes.object.isRequired,
  offset: PropTypes.object.isRequired,
  pagination: PropTypes.bool.isRequired,
  onItemsChanged: PropTypes.func.isRequired,
  onLimitChanged: PropTypes.func.isRequired,
  onOffsetChanged: PropTypes.func.isRequired,
  onPaginationChanged: PropTypes.func.isRequired,
};

export default ApiPagination;
