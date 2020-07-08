import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Message,
} from "semantic-ui-react";
import uuid from "uuid/v4";

/*
  The Form used to create API connections
*/
class ApiConnectionForm extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      connection: { type: "api", optionsArray: [] },
      errors: {},
    };
  }

  componentDidMount() {
    this._addOption();
    this._init();
  }

  _init = () => {
    const { editConnection } = this.props;

    if (editConnection) {
      const newConnection = editConnection;
      // format the options
      if (newConnection.options && newConnection.options.length > 0) {
        const formattedOptions = [];
        for (let i = 0; i < newConnection.options.length; i++) {
          if (newConnection.options[i]) {
            formattedOptions.push({
              id: uuid(),
              key: Object.keys(newConnection.options[i])[0],
              value: newConnection.options[i][Object.keys(newConnection.options[i])[0]],
            });
          }
        }

        newConnection.optionsArray = formattedOptions;
      } else {
        newConnection.optionsArray = [];
      }

      this.setState({ connection: newConnection });
    }
  }

  _onCreateConnection = () => {
    const {
      projectId, onComplete,
    } = this.props;
    const { connection, errors } = this.state;

    this.setState({ errors: {} }, () => {
      if (!connection.name || connection.name.length > 24) {
        this.setState({ errors: { ...errors, name: "Please enter a name which is less than 24 characters" } });
        return;
      }
      if (!connection.host) {
        this.setState({ errors: { ...errors, host: "Please enter a host name or IP address for your database" } });
        return;
      }

      // prepare the options
      const tempOptions = connection.optionsArray;
      const newOptions = [];
      if (tempOptions && tempOptions.length > 0) {
        for (let i = 0; i < tempOptions.length; i++) {
          if (tempOptions[i].key && tempOptions[i].value) {
            newOptions.push({ [tempOptions[i].key]: tempOptions[i].value });
          }
        }
      }

      // add the project ID
      this.setState({
        connection: {
          ...connection, project_id: projectId, options: newOptions,
        },
        loading: true,
      });

      const newConnection = connection;
      if (!connection.id) newConnection.project_id = projectId;
      newConnection.options = newOptions;
      onComplete(newConnection);
    });
  }

  _addOption = () => {
    const { connection } = this.state;
    const option = {
      id: uuid(),
      key: "",
      value: "",
    };

    this.setState({
      connection: {
        ...connection, optionsArray: [...connection.optionsArray, option],
      },
    });
  }

  _removeOption = (id) => {
    const { connection } = this.state;
    const tempOptions = connection.optionsArray;
    const newOptions = [];
    for (let i = 0; i < tempOptions.length; i++) {
      if (tempOptions[i].id !== id) {
        newOptions.push(tempOptions[i]);
      }
    }

    this.setState({
      connection: { ...connection, optionsArray: newOptions },
    });
  }

  _onChangeOption = (id, value, selector) => {
    const { connection } = this.state;
    const tempOptions = connection.optionsArray;
    for (let i = 0; i < tempOptions.length; i++) {
      if (tempOptions[i].id === id) {
        if (tempOptions[i][selector]) tempOptions[i][selector] = "";
        tempOptions[i][selector] = value;
      }
    }

    this.setState({
      connection: { ...connection, optionsArray: tempOptions },
    });
  }

  render() {
    const {
      connection, errors, loading,
    } = this.state;
    const { editConnection, addError } = this.props;

    return (
      <div style={styles.container}>
        <Header attached="top" as="h2">
          {!editConnection && "Add a new API host"}
          {editConnection && `Edit ${editConnection.name}`}
        </Header>
        <Segment raised attached>
          <Form>
            <Form.Field error={!!errors.name} required>
              <label>Name your connection</label>
              <Form.Input
                placeholder="Enter a name that you can recognise later"
                value={connection.name || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, name: data.value } });
                }}
              />
              {errors.name
                && (
                <Label basic color="red" pointing>
                  {errors.name}
                </Label>
                )}
            </Form.Field>

            <Form.Field error={!!errors.host} required>
              <label>The hostname of your API</label>
              <Form.Input
                placeholder="https://api.example.com"
                value={connection.host || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, host: data.value } });
                }}
              />
              {errors.host && (
                <Label basic color="red" pointing>
                  {errors.host}
                </Label>
              )}
            </Form.Field>

            {connection.optionsArray && connection.optionsArray.length > 0 && (
              <Header as="h5">
                Global headers to send with requests
                <Header.Subheader>
                  {"This is the place where you can put your API authentication headers"}
                </Header.Subheader>
              </Header>
            )}
            {connection.optionsArray && connection.optionsArray.map((option) => {
              return (
                <Form.Group widths="equal" key={option.id}>
                  <Form.Input
                    placeholder="Header name"
                    value={option.key}
                    onChange={(e, data) => this._onChangeOption(option.id, data.value, "key")}
                  />
                  <Form.Input
                    onChange={(e, data) => this._onChangeOption(option.id, data.value, "value")}
                    value={option.value}
                    placeholder="Value"
                  />
                  <Form.Button icon onClick={() => this._removeOption(option.id)}>
                    <Icon name="close" />
                  </Form.Button>
                </Form.Group>
              );
            })}
            <Form.Field>
              <Button
                size="small"
                icon
                labelPosition="right"
                onClick={this._addOption}
              >
                <Icon name="plus" />
                Add more headers
              </Button>
            </Form.Field>
          </Form>

          {addError
            && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
            )}
        </Segment>
        {!editConnection && (
          <Button
            primary
            attached="bottom"
            loading={loading}
            onClick={this._onCreateConnection}
          >
            Connect
          </Button>
        )}
        {editConnection && (
          <Button
            secondary
            attached="bottom"
            loading={loading}
            onClick={this._onCreateConnection}
          >
            Save changes
          </Button>
        )}
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

ApiConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
  addError: null,
};

ApiConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
  addError: PropTypes.object,
};

export default ApiConnectionForm;
