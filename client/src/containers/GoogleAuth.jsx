import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
  Container, Row, Text, Spacer, Button, Loading,
} from "@nextui-org/react";
import cookie from "react-cookies";
import { ChevronRightCircle } from "react-iconly";

import { API_HOST } from "../config/settings";

/*
  Component for processing the authentication code from Google
*/
function GoogleAuth(props) {
  const { history } = props;

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    _processAuth();
  }, []);

  const _processAuth = () => {
    const params = new URLSearchParams(document.location.search);
    const state = params.get("state");
    const code = params.get("code");

    if (!state || !code) {
      setError(true);
      setLoading(false);
      return false;
    }
    const ids = state.split(",");

    const url = `${API_HOST}/project/${ids[0]}/connection/${ids[1]}/google/auth`;
    const method = "PUT";
    const body = JSON.stringify({ code });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cookie.load("brewToken")}`,
    });

    setLoading(false);
    return fetch(url, { method, body, headers })
      .then((response) => {
        if (!response.ok) return Promise.reject(new Error(response.status));

        return response.json();
      })
      .then((result) => {
        setLoading(false);
        setSuccess(true);

        let finalUrl = `/${result.team_id}/${result.connection.project_id}/connections?edit=${result.connection.id}`;
        if (ids[2]) finalUrl += `&type=${ids[2]}`;

        history.push(finalUrl);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  return (
    <Container
      sm
      css={{
        backgroundColor: "$backgroundContrast", br: 10, mt: 20, p: 20
      }}
    >
      {loading && (
        <Row>
          <Loading>Authenticating with Google...</Loading>
        </Row>
      )}

      {success && (
        <>
          <Row>
            <Text h2 color="success">
              Authentication successful!
            </Text>
          </Row>
          <Spacer y={1} />
          <Row>
            <Link to="/user">
              <Button
                color="success"
                iconRight={<ChevronRightCircle />}
                auto
              >
                Go to connections
              </Button>
            </Link>
          </Row>
        </>
      )}

      {error && (
        <>
          <Row>
            <Text h2 color="error">
              The authentication could not be completed
            </Text>
          </Row>
          <Row>
            <Text h4>
              Please try refreshing the page or get in touch for help.
            </Text>
          </Row>
          <Spacer y={1} />
          <Row>
            <Link to="/user">
              <Button
                color="secondary"
                iconRight={<ChevronRightCircle />}
                auto
              >
                Back to the dashboard
              </Button>
            </Link>
          </Row>
        </>
      )}
    </Container>
  );
}

GoogleAuth.propTypes = {
  history: PropTypes.object.isRequired,
};

export default connect()(GoogleAuth);
