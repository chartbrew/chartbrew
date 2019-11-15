import React, { Component } from "react";
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
import cbLogoSmall from "../assets/cb_logo_4_small_inverted.png";

/*
  Login container with an embedded login form
*/
class Login extends Component {
  componentDidMount() {
    const { cleanErrors } = this.props;
    cleanErrors();
  }

  render() {
    const { errors } = this.props;
    const loginError = _.find(errors, { pathname: window.location.pathname });

    return (
      <div style={styles.container}>
        <Container text textAlign="center">
          <Link to="/">
            <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
          <Header inverted as="h2" style={{ marginTop: 0 }}>Login to your account</Header>
          <Segment raised>
            <LoginForm />
            {loginError && (
              <Message negative>
                <Message.Header>{loginError.message}</Message.Header>
                <p>Please try it again.</p>
              </Message>
            )}
          </Segment>
          <Message>
            {" You don't have an account yet? "}
            <Link to={"/signup"}>Sign Up</Link>
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
