import React, { useEffect } from "react";
import { connect, useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import {
  Card, CardBody, CardFooter, CardHeader, Spacer,
} from "@nextui-org/react";
import _ from "lodash";

import LoginForm from "../components/LoginForm";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import cbLogoSmall from "../assets/logo_inverted.png";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";
import { selectUser } from "../slices/user";

/*
  Login container with an embedded login form
*/
function Login(props) {
  const { errors, cleanErrors } = props;
  const loginError = _.find(errors, { pathname: window.location.pathname });
  const user = useSelector(selectUser);

  const navigate = useNavigate();

  useEffect(() => {
    cleanErrors();
  }, []);

  useEffect(() => {
    if (user?.id) {
      navigate("/");
    }
  }, [user]);

  return (
    <div style={styles.container}>
      <Container size="md">
        <Row justify="center" align="center">
          <Link to="/">
            <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
          </Link>
        </Row>
        <Spacer y={8} />
        <Row justify="center" align="center">
          <Container size="sm">
            <Row justify="center" align="center">
              <Card style={styles.verticalPadding}>
                <CardHeader className={"text-center items-center"}>
                  <Container justify="center">
                    <Text size="h3" className={"mt-4"}>{"Welcome back to Chartbrew"}</Text>
                  </Container>
                </CardHeader>
                <CardBody>
                  <LoginForm />
                </CardBody>
                {loginError && (
                  <CardFooter>
                    <Container justify="center">
                      <Row justify="center">
                        <Text size="h4" color="danger">{loginError.message}</Text>
                      </Row>
                      <Row justify="center">
                        <Text color="danger">{"Please try again."}</Text>
                      </Row>
                    </Container>
                  </CardFooter>
                )}
              </Card>
            </Row>
          </Container>
        </Row>
        <Spacer y={8} />
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
