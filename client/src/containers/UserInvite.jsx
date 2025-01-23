import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PropTypes } from "prop-types";
import {
  Button, Spacer,
} from "@heroui/react";
import { useNavigate } from "react-router";

import Text from "../components/Text";
import Row from "../components/Row";
import { clearUser, selectUser } from "../slices/user";
import { removeAuthToken } from "../modules/auth";

/*
  Component for inviting user to the team
*/
function UserInvite() {
  const navigate = useNavigate();
  const fetchRef = useRef(null);
  const dispatch = useDispatch();

  const user = useSelector(selectUser);

  useEffect(() => {
    if (user.id && !fetchRef.current) {
      fetchRef.current = true;
      redirectUser("login");
    }
  }, [user]);

  const redirectUser = async (route) => {
    const params = new URLSearchParams(document.location.search);
    const token = params.get("token");

    removeAuthToken();
    await dispatch(clearUser(true));

    setTimeout(() => {
      if (route === "login") {
        navigate(`/login?inviteToken=${token}`);
      } else {
        navigate(`/signup?inviteToken=${token}`);
      }
    }, 100);
  };

  return (
    <div style={styles.container}>
      <div className="container mx-auto pt-20 justify-center items-center">
        <Row justify="center" align="center" className={"text-center"}>
          <Text size="h2">
            {"You've been invited to join Chartbrew"}
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

export default UserInvite;
