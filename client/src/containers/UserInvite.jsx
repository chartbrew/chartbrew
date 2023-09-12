import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { withRouter } from "react-router";
import {
  Button, Spacer,
} from "@nextui-org/react";
import cookie from "react-cookies";

import Container from "../components/Container";
import Text from "../components/Text";
import Row from "../components/Row";

/*
  Component for inviting user to the team
*/
function UserInvite(props) {
  const {
    user, history
  } = props;

  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (user.id && !fetched) {
      setFetched(true);
      redirectUser("login");
    }
  }, [user]);

  const redirectUser = (route) => {
    const params = new URLSearchParams(document.location.search);
    const token = params.get("token");

    if (cookie.load("brewToken")) cookie.remove("brewToken");
    if (route === "login") {
      history.push(`/login?inviteToken=${token}`);
    } else {
      history.push(`/signup?inviteToken=${token}`);
    }
  };

  return (
    <div style={styles.container}>
      <div className="grid grid-cols-12 justify-center align-middle items-center">
        <div className="col-span-12 md:col-span-6">
          <Container textAlign="center" className={"mt-unit-3"}>
            <Row justify="center" align="center" className={"text-center"}>
              <Text size="h2">
                Your Chartbrew team invitation
              </Text>
            </Row>
            <Row justify="center" align="center">
              <Text size="h4">Please select an option below</Text>
            </Row>
            <Spacer y={1} />
            <Row justify="center" align="center" wrap="wrap">
              <Button
                color="secondary"
                onClick={() => redirectUser("login")}
                auto
                className={"mb-10"}
              >
                Login with an existing account
              </Button>
              <Spacer x={0.5} />
              <Button
                onClick={() => redirectUser("signup")}
                auto
                className={"mb-10"}
              >
                Create a new account
              </Button>
            </Row>
          </Container>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};

UserInvite.propTypes = {
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    user: state.user.data,
    team: state.team,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UserInvite));
