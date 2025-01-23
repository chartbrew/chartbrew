import React, { useEffect } from "react";
import { connect, useDispatch } from "react-redux";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import {
  Card, CardBody, CardFooter, CardHeader, Spacer,
} from "@heroui/react";
import _ from "lodash";

import LoginForm from "../components/LoginForm";
import { cleanErrors as cleanErrorsAction } from "../actions/error";
import cbLogoSmall from "../assets/logo_inverted.png";
import Row from "../components/Row";
import Text from "../components/Text";
import { relog } from "../slices/user";

/*
  Login container with an embedded login form
*/
function Login(props) {
  const { errors, cleanErrors } = props;
  const loginError = _.find(errors, { pathname: window.location.pathname });

  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    cleanErrors();

    dispatch(relog())
      .then((data) => {
        if (data?.payload?.id) {
          navigate("/");
        }
      });
  }, []);

  return (
    <div style={styles.container} className="pt-20">
      <Row justify="center" align="center">
        <Link to="/">
          <img size="tiny" src={cbLogoSmall} style={{ width: 70 }} alt="Chartbrew logo" />
        </Link>
      </Row>
      <Spacer y={4} />
      <div className="sm:flex m-4 justify-center">
        <Card>
          <CardHeader className={"flex justify-center"}>
            <h1 className={"mt-4 text-xl font-bold"}>{"Welcome back to Chartbrew"}</h1>
          </CardHeader>
          <CardBody>
            <LoginForm />
          </CardBody>
          {loginError && (
            <CardFooter>
              <Row justify="center">
                <Text size="h4" color="danger">{loginError.message}</Text>
              </Row>
              <Row justify="center">
                <Text color="danger">{"Please try again."}</Text>
              </Row>
            </CardFooter>
          )}
        </Card>
      </div>
      <Spacer y={8} />
      <Row justify="center" align="center">
        <div>
          <p style={styles.signupText}>
            {" You don't have an account yet? "}
            <Link to={"/signup"} className="underline decoration-2">Sign up here</Link>
          </p>
        </div>
      </Row>
    </div>
  );
}
const styles = {
  container: {
    overflow: "hidden",
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
