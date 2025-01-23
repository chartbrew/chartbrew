import React, { useState, useEffect, useRef } from "react";
import { connect } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  Spacer, Button, CircularProgress,
} from "@heroui/react";
import cookie from "react-cookies";
import { LuArrowRight } from "react-icons/lu";

import { API_HOST } from "../config/settings";
import Container from "../components/Container";
import Row from "../components/Row";
import Text from "../components/Text";

/*
  Component for processing the authentication code from Google
*/
function GoogleAuth() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const navigate = useNavigate();
  const initRef = useRef(null);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      _processAuth();
    }
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

    const url = `${API_HOST}/team/${ids[0]}/connections/${ids[1]}/google/auth`;
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

        let finalUrl = `/${result.team_id}/connection/${result.connection.id}`;
        if (ids[2]) finalUrl += `?type=${ids[2]}`;

        navigate(finalUrl);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  return (
    <Container
      size="sm"
      className="rounded-md mt-20 p-20"
    >
      {loading && (
        <Row>
          <CircularProgress aria-label="Authenticating with Google">Authenticating with Google...</CircularProgress>
        </Row>
      )}

      {success && (
        <>
          <Row>
            <Text size="h2" color="success">
              Authentication successful!
            </Text>
          </Row>
          <Spacer y={1} />
          <Row>
            <Link to="/connections">
              <Button
                color="success"
                endContent={<LuArrowRight />}
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
            <Text size="h2" color="danger">
              The authentication could not be completed
            </Text>
          </Row>
          <Row>
            <Text size="h4">
              Please try refreshing the page or get in touch for help.
            </Text>
          </Row>
          <Spacer y={1} />
          <Row>
            <Link to="/connections">
              <Button
                color="secondary"
                endContent={<LuArrowRight />}
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

export default connect()(GoogleAuth);
