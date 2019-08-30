import React, { Component } from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
  Message, Container, Segment, Header
} from "semantic-ui-react";

import LoginForm from "../components/LoginForm";
import { blue } from "../config/colors";
import cbLogoSmall from "../assets/cb_logo_4_small_inverted.png";

/*
  Login container with an embedded login form
*/
class Login extends Component {
  render() {
    return (
      <div style={styles.container}>
        <Container text textAlign="center">
          <Link to="/">
            <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
          <Header inverted as="h2" style={{ marginTop: 0 }}>Login to your account</Header>
          <Segment raised>
            <LoginForm />
          </Segment>
          <Message>
            {" You don't have an account yet?"}
            <Link to={"/signup"}>Sign Up</Link>
            {" "}
          </Message>
        </Container>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    backgroundColor: blue,
    minHeight: window.innerHeight,
    paddingBottom: 50,
    paddingTop: 50,
  },
};

Login.propTypes = {
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Login);
