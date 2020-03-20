import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Segment, Form, Button, Icon, Header, Label, Divider, Message, Checkbox, Popup,
} from "semantic-ui-react";
import uuid from "uuid/v4";

/*
  Description
*/
class ConnectionForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showTutorial: true,
      showIp: true,
      loading: false,
      connection: { type: "mongodb", optionsArray: [], srv: false },
      errors: {},
    };
  }

  componentDidMount() {
    this._init();
  }

  _init = () => {
    const { editConnection } = this.props;
    if (editConnection) {
      const newConnection = editConnection;
      // format the options
      if (newConnection.options && newConnection.options.length > 0) {
        const newOptions = [];
        const formattedOptions = newConnection.options.split("&");
        for (let i = 0; i < formattedOptions.length; i++) {
          let optionKey = formattedOptions[i].substring(0, formattedOptions[i].indexOf("="));
          optionKey = optionKey.replace("?", "");

          const optionValue = formattedOptions[i].substring(formattedOptions[i].indexOf("=") + 1);
          newOptions.push({
            id: uuid(),
            key: optionKey,
            value: optionValue,
          });
        }

        if (newOptions) {
          newConnection.optionsArray = newOptions;
        } else {
          newConnection.optionsArray = [];
        }
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
      if (!connection.dbName) {
        this.setState({ errors: { ...errors, dbName: "Please enter your database name" } });
        return;
      }

      // prepare the options
      const tempOptions = connection.optionsArray;
      const newOptions = [];
      if (connection.optionsArray.length > 0) {
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
      }, () => {
        onComplete(connection);
      });
    });
  }

  _onChangeSrv = () => {
    const { connection } = this.state;

    if (!connection.srv) {
      this.setState({ connection: { ...connection, srv: true } });
    } else {
      this.setState({ connection: { ...connection, srv: false } });
    }
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
        ...connection, optionsArray: [...connection.optionsArray, option]
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
    const { editConnection } = this.props;
    const {
      showTutorial, showIp, errors, connection, error, loading, addError,
    } = this.state;

    return (
      <div style={styles.container}>
        <Header attached="top" as="h2">Connect to a MongoDB database</Header>
        <Segment raised attached>
          {showTutorial && (
            <Message onDismiss={() => this.setState({ showTutorial: false })}>
              <Message.Header>How to complete the fields?</Message.Header>
              <p>{"Whenever you connect to a MongoDB database you usually use a connection string. The string is automatically built from the information you provide below."}</p>
              <p>
                <a href="https://docs.mongodb.com/manual/reference/connection-string/" target="_blank" rel="noopener noreferrer">
                  {"Refer to this link for more information or get in touch with us if you need help."}
                </a>
              </p>
              <p>
                <a href="https://www.youtube.com/watch?v=Ej05tq1220A" target="_blank" rel="noopener noreferrer">
                  {"Here's a tutorial on how you can find the connection string if you're using MongoDB Atlas."}
                </a>
              </p>
            </Message>
          )}

          {showIp && (
            <Message onDismiss={() => this.setState({ showIp: false })}>
              <Message.Header>{"Whitelist the IP of the server the app is running from"}</Message.Header>
              <p>{"This is sometimes required when the database and the Chartbrew app are running on separate servers."}</p>
            </Message>
          )}
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
              <label>Hostname or IP address</label>
              <Form.Input
                placeholder="'yourmongodomain.com' or '0.0.0.0' "
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

            <Form.Field error={!!errors.dbName} required>
              <label>Database name</label>
              <Form.Input
                placeholder="Enter your database name"
                value={connection.dbName || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, dbName: data.value } });
                }}
              />
              {errors.dbName && (
                <Label basic color="red" pointing>
                  {errors.dbName}
                </Label>
              )}
            </Form.Field>

            <Form.Field error={!!errors.port}>
              <label>Port</label>
              <Form.Input
                placeholder="Leave empty if using the default"
                value={connection.port || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, port: data.value } });
                }}
              />
              {errors.port && (
                <Label basic color="red" pointing>
                  {errors.port}
                </Label>
              )}
            </Form.Field>

            <Form.Field error={!!errors.username}>
              <label>Database username</label>
              <Form.Input
                placeholder="Username"
                value={connection.username || ""}
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, username: data.value } });
                }}
              />
              {errors.username && (
                <Label basic color="red" pointing>
                  {error.username}
                </Label>
              )}
            </Form.Field>

            <Form.Field error={!!errors.password}>
              {!editConnection && <label>Database password</label>}
              {editConnection && <label>New database password</label>}
              <Form.Input
                placeholder="Database user password"
                type="password"
                onChange={(e, data) => {
                  this.setState({ connection: { ...connection, password: data.value } });
                }}
              />
              {error && (
                <Label basic color="red" pointing>
                  {error}
                </Label>
              )}
            </Form.Field>

            <Form.Field>
              <Checkbox
                label="Use MongoDB 3.6 SRV URI connection string "
                defaultChecked={connection.srv}
                onChange={this._onChangeSrv}
              />
              <Popup
                trigger={<Icon name="question circle outline" />}
                content="Tick this if your connection URI contains 'mongodb+srv://'"
              />
            </Form.Field>

            <Message info>
              <Message.Header>Avoid using users that can write data</Message.Header>
              <p>{"Out of abundance of caution, we recommend all our users to connect only with read permissions. Don't use mongo users with readWrite permissions."}</p>
              <a href="https://docs.mongodb.com/manual/reference/method/db.createUser/" target="_blank" rel="noopener noreferrer">
                Check this link on how to do it
              </a>
            </Message>

            <Divider />
            {connection.optionsArray.length > 0
              && <Header as="h5">Connection options</Header>}
            {connection.optionsArray.map((option) => {
              return (
                <Form.Group widths="equal" key={option.id}>
                  <Form.Input
                    placeholder="Key"
                    onChange={(e, data) => this._onChangeOption(option.id, data.value, "key")}
                  />
                  <Form.Input
                    onChange={(e, data) => this._onChangeOption(option.id, data.value, "value")}
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
                loading={loading}
                onClick={this._addOption}
              >
                <Icon name="plus" />
                Add options
              </Button>
            </Form.Field>
          </Form>

          {addError && (
            <Message negative>
              <Message.Header>{"Server error while trying to save your connection"}</Message.Header>
              <p>Please try adding your connection again.</p>
            </Message>
          )}
        </Segment>
        {!editConnection
          && (
          <Button
            primary
            attached="bottom"
            loading={loading}
            onClick={this._onCreateConnection}
          >
            Connect
          </Button>
          )}
        {editConnection
          && (
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

ConnectionForm.defaultProps = {
  onComplete: () => {},
  editConnection: null,
};

ConnectionForm.propTypes = {
  onComplete: PropTypes.func,
  projectId: PropTypes.string.isRequired,
  editConnection: PropTypes.object,
};

export default ConnectionForm;
