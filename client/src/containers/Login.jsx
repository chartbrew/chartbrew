import React, { useEffect } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Text, Container, Card, Row, Spacer,
} from "@nextui-org/react";
import _ from "lodash";

import LoginForm from "../components/LoginForm";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import { negative } from "../config/colors";
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
      <Container md>
        <Row justify="center" align="center">
          <Link to="/">
            <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
        </Row>
        <Spacer y={1} />
        <Row justify="center" align="center">
          <Container sm>
            <Row justify="center" align="center">
              <Card style={styles.verticalPadding}>
                <Card.Header css={{ textAlign: "center", ai: "center" }}>
                  <Container justify="center">
                    <Text h3 css={{ marginTop: 0 }}>{"Welcome back to Chartbrew"}</Text>
                  </Container>
                </Card.Header>
                <Card.Body>
                  <LoginForm />
                </Card.Body>
                {loginError && (
                  <Card.Footer>
                    <Container justify="center">
                      <Row justify="center">
                        <Text h4 color={negative}>{loginError.message}</Text>
                      </Row>
                      <Row justify="center">
                        <Text color={negative}>{"Please try again."}</Text>
                      </Row>
                    </Container>
                  </Card.Footer>
                )}
              </Card>
            </Row>
          </Container>
        </Row>
        <Spacer y={1} />
        <Row justify="center" align="center">
          <div>
            <p style={styles.signupText}>
              {" You don't have an account yet? "}
              <Link to={"/signup"}>Sign up here</Link>
            </p>
          </div>
        </Row>
      </Container>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
    paddingBottom: 50,
    paddingTop: 50,
    overflow: "hidden",
  },
  verticalPadding: {
    maxWidth: 600,
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
