import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import { withRouter } from "react-router";
import {
  Grid, Container, Button, Row, Text, Spacer,
} from "@nextui-org/react";

import cookie from "react-cookies";

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
      <Grid.Container
        justify="center"
        alignContent="center"
        alignItems="center"
      >
        <Grid xs={12} sm={6}>
          <Container textAlign="center" style={{ marginTop: "3em" }}>
            <Row justify="center" align="center" css={{ ta: "center" }}>
              <Text h2>
                Your Chartbrew team invitation
              </Text>
            </Row>
            <Row justify="center" align="center">
              <Text h4>Please select an option below</Text>
            </Row>
            <Spacer y={1} />
            <Row justify="center" align="center" wrap="wrap">
              <Button
                color="secondary"
                onClick={() => redirectUser("login")}
                auto
                css={{ mb: 10 }}
              >
                Login with an existing account
              </Button>
              <Spacer x={0.5} />
              <Button
                onClick={() => redirectUser("signup")}
                auto
                css={{ mb: 10 }}
              >
                Create a new account
              </Button>
            </Row>
          </Container>
        </Grid>
      </Grid.Container>
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
