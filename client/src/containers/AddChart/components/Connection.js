import React, { Component } from "react";
import PropTypes from "prop-types";

import {
  Container, Icon, Divider, Input, Header,
} from "semantic-ui-react";

class Connection extends Component {
  render() {
    const { active, onCloseConnection } = this.props;

    if (!active) return (<span />);

    return (
      <Container text style={styles.container}>
        <Header as="h2">
          <Icon name="close" onClick={() => onCloseConnection()} />
          <Header.Content>ConnectionAPI</Header.Content>
        </Header>
        <Divider hidden />

        <Input placeholder="Selector" />
      </Container>
    );
  }
}

Connection.defaultProps = {
  active: false,
  onCloseConnection: () => {},
};

Connection.propTypes = {
  active: PropTypes.bool,
  onCloseConnection: PropTypes.func,
};

const styles = {
  container: {
    position: "absolute",
    top: 50,
    left: 5,
    backgroundColor: "white",
    boxShadow: "0 0px 0px 0px #a0a0a0, 0 0px 5px 0px #a0a0a0",
    padding: 10,
    borderRadius: 10,
  },
  closeBtn: {
    float: "left",
  },
};

export default Connection;
