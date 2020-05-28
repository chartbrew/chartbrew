import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Header, Container, Icon, Input, Button, Segment, Grid
} from "semantic-ui-react";

function ChartDescription(props) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    name, onChange, history, onCreate,
  } = props;

  const _onNameChange = (e, data) => {
    onChange(data.value);
  };

  const _onCreatePressed = () => {
    if (!name) {
      setError(true);
      return;
    }
    setLoading(true);
    onCreate();
  };

  return (
    <Grid centered columns={1} style={styles.container}>
      <Segment color="olive" compact padded textAlign="center">
        <Container text>
          <Header as="h2" icon>
            <Icon name="flask" color="blue" />
            {"What are you brewing today?"}
            <Header.Subheader>
              {"Write a short summary of your visualization"}
            </Header.Subheader>
          </Header>
        </Container>

        <Container text style={styles.topBuffer}>
          <Input
            type="text"
            placeholder="Short summary"
            error={error}
            value={name}
            onChange={_onNameChange}
            size="big"
            fluid
          />
        </Container>

        <div style={styles.topBuffer}>
          <Button
            basic
            icon
            labelPosition="left"
            onClick={() => history.goBack()}
            size="big"
          >
            <Icon name="angle left" />
            Go back
          </Button>
          <Button
            loading={loading}
            type="submit"
            primary
            icon
            labelPosition="right"
            onClick={_onCreatePressed}
            size="big"
          >
            <Icon name="angle right" />
            Create
          </Button>
        </div>
      </Segment>
    </Grid>
  );
}

const styles = {
  container: {
    textAlign: "center",
    marginTop: 50,
  },
  topBuffer: {
    marginTop: 50,
  },
};

ChartDescription.defaultProps = {
  name: "",
};

ChartDescription.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  history: PropTypes.object.isRequired,
  onCreate: PropTypes.func.isRequired,
};

export default ChartDescription;
