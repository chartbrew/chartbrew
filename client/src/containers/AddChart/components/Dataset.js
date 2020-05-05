import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Icon, Divider, Header, Dropdown, Button, Grid,
} from "semantic-ui-react";

import mongoImg from "../../../assets/mongodb-logo-1.png";
import mysqlImg from "../../../assets/mysql.svg";
import apiImg from "../../../assets/api.png";
import postgresImg from "../../../assets/postgres.png";
import DatarequestModal from "./DatarequestModal";

function Dataset(props) {
  const { dataset, connections } = props;
  const [dropdownConfig, setDropdownConfig] = useState([]);
  const [connection, setConnection] = useState({});
  const [dataRequest] = useState({});
  const [configOpened, setConfigOpened] = useState(false);

  useEffect(() => {
    const config = [];
    connections.map((connection) => {
      const image = connection.type === "mongodb"
        ? mongoImg : connection.type === "api"
          ? apiImg : connection.type === "mysql"
            ? mysqlImg : postgresImg;

      config.push({
        key: connection.id,
        value: connection.id,
        text: connection.name,
        image: {
          src: image,
        }
      });

      return connection;
    });

    setDropdownConfig(config);
    // if (!dataset.id && connections[0]) setDataset(connections[0]);
  }, [connections]);

  const _onChangeConnection = (e, data) => {
    connections.map((connection) => {
      if (data.value === connection.id) {
        setConnection(connection);
      }

      return connection;
    });
  };

  const _openConfigModal = () => {
    setConfigOpened(true);
  };

  const _onCloseConfig = () => {
    setConfigOpened(false);
  };

  if (!dataset || !dataset.id) return (<span />);

  return (
    <Container text style={styles.container}>
      <Header as="h2">
        <Header.Content>{dataset.legend}</Header.Content>
      </Header>
      <Divider hidden />

      <Grid stackable>
        <Grid.Row columns={2}>
          <Grid.Column>
            <Dropdown
              placeholder="Select an available connection from the list"
              selection
              value={connection.id}
              options={dropdownConfig}
              disabled={connections.length < 1}
              onChange={_onChangeConnection}
              fluid
            />
          </Grid.Column>
          <Grid.Column textAlign="left">
            <Button
              primary
              icon
              labelPosition="right"
              disabled={!connection.id}
              onClick={_openConfigModal}
            >
              <Icon name="cog" />
              Configure
            </Button>
          </Grid.Column>
        </Grid.Row>
      </Grid>

      {connection && (
        <DatarequestModal
          dataset={dataset}
          connection={connection}
          dataRequest={dataRequest}
          open={configOpened}
          onClose={_onCloseConfig}
        />
      )}
    </Container>
  );
}

Dataset.propTypes = {
  dataset: PropTypes.object.isRequired,
  connections: PropTypes.array.isRequired,
};

const styles = {
  container: {
    flex: 1,
  },
  closeBtn: {
    float: "left",
  },
};

const mapStateToProps = (state) => {
  return {
    connections: state.connection.data,
  };
};

export default connect(mapStateToProps)(Dataset);
