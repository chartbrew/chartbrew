import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Icon, Divider, Header, Dropdown,
} from "semantic-ui-react";

import mongoImg from "../../../assets/mongodb-logo-1.png";
import mysqlImg from "../../../assets/mysql.svg";
import apiImg from "../../../assets/api.png";
import postgresImg from "../../../assets/postgres.png";

function Dataset(props) {
  const { active, onCloseDataset, connections } = props;
  const [dropdownConfig, setDropdownConfig] = useState([]);
  const [dataset, setDataset] = useState({});

  useEffect(() => {
    const config = [];
    connections.map((connection) => {
      const image = connection.type === "mongo"
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
    if (!dataset.id && connections[0]) setDataset(connections[0]);
  }, [connections]);

  const _onChangeConnection = (e, data) => {
    connections.map((connection) => {
      if (data.value === connection.id) {
        setDataset(connection);
      }

      return connection;
    });
  };

  if (!active) return (<span />);

  return (
    <Container text style={styles.container}>
      <Header as="h2">
        <Icon name="close" onClick={() => onCloseDataset()} />
        <Header.Content>Dataset #1</Header.Content>
      </Header>
      <Divider hidden />

      <Dropdown
        placeholder="Select an available connection from the list"
        selection
        value={dataset.id}
        options={dropdownConfig}
        disabled={connections.length < 1}
        onChange={_onChangeConnection}
      />
    </Container>
  );
}

Dataset.defaultProps = {
  active: false,
  onCloseDataset: () => {},
};

Dataset.propTypes = {
  active: PropTypes.bool,
  onCloseDataset: PropTypes.func,
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
