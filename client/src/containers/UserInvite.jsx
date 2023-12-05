import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { PropTypes } from "prop-types";
import {
  Button, Spacer,
} from "@nextui-org/react";
import cookie from "react-cookies";
import { useNavigate } from "react-router";

import Text from "../components/Text";
import Row from "../components/Row";

/*
  Component for inviting user to the team
*/
function UserInvite(props) {
  const { user } = props;

  const [fetched, setFetched] = useState(false);

  const navigate = useNavigate();

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
      navigate(`/login?inviteToken=${token}`);
    } else {
      navigate(`/signup?inviteToken=${token}`);
    }
  };

  return (
    <div style={styles.container}>
      <div className="container mx-auto pt-20 justify-center items-center">
        <Row justify="center" align="center" className={"text-center"}>
          <Text size="h2">
            {"You've been invite to join Chartbrew"}
          </Text>
        </Row>
        <Row justify="center" align="center">
          <Text className={"font-semibold text-default"}>Please select an option below</Text>
        </Row>
        <Spacer y={4} />
        <Row justify="center" align="center" wrap="wrap">
          <Button
            color="secondary"
            onClick={() => redirectUser("login")}
            auto
          >
            Login with an existing account
          </Button>
          <Spacer x={2} />
          <Button
            onClick={() => redirectUser("signup")}
            color="primary"
          >
            Create a new account
          </Button>
        </Row>
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

export default connect(mapStateToProps, mapDispatchToProps)(UserInvite);
