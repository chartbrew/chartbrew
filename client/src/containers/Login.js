import React, { useEffect } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Message, Container, Segment, Header
} from "semantic-ui-react";
import _ from "lodash";

import LoginForm from "../components/LoginForm";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { blue } from "../config/colors";
import cbLogoSmall from "../assets/logo_inverted.png";

/*
  Login container with an embedded login form
*/
function Login(props) {
  const { errors, cleanErrors } = props;
  const loginError = _.find(errors, { pathname: window.location.pathname });

  useEffect(() => {
    cleanErrors();
  }, []);

  return (
    <div style={styles.container}>
      <Container text textAlign="center">
        <Link to="/">
          <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
        </Link>
        <Header inverted as="h2" style={{ marginTop: 0 }}>{"Log in to your account"}</Header>
        <Segment color="olive" raised style={styles.verticalPadding} padded>
          <Header textAlign="left" as="h5">{"Enter your login details"}</Header>
          <LoginForm />
          {loginError && (
            <Message negative>
              <Message.Header>{loginError.message}</Message.Header>
              <p>{"Please try it again."}</p>
            </Message>
          )}
        </Segment>
        <div>
          <p style={styles.signupText}>
            {" You don't have an account yet? "}
            <Link to={"/signup"}>Sign up here</Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
    backgroundColor: blue,
    minHeight: window.innerHeight,
    paddingBottom: 50,
    paddingTop: 50,
  },
  signupText: {
    color: "white",
  },
  verticalPadding: {
    paddingRight: 20,
    paddingLeft: 20
  },
};

Login.propTypes = {
  errors: PropTypes.array.isRequired,
  cleanErrors: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    errors: state.error,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    cleanErrors: () => dispatch(cleanErrorsAction()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Login);
