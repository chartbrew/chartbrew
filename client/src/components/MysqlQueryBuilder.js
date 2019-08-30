import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Header, Form, Button, Container, Icon, Message, Segment,
  Modal, Input,
} from "semantic-ui-react";
import brace from "brace"; // eslint-disable-line
import AceEditor from "react-ace";

import "brace/mode/pgsql";
import "brace/theme/tomorrow";

import { createSavedQuery, updateSavedQuery } from "../actions/savedQuery";
import SavedQueries from "./SavedQueries";

/*
  Description
*/
class MysqlQueryBuilder extends Component {
  constructor(props) {
    super(props);

    this.state = {
      savedQuery: null,
    };
  }

  _onSaveQueryConfirmation = () => {
    this.setState({ saveQueryModal: true });
  }

  _onSaveQuery = () => {
    const {
      createSavedQuery, match, currentQuery,
    } = this.props;
    const { savedQuerySummary } = this.state;
    this.setState({ savingQuery: true });
    createSavedQuery(match.params.projectId, {
      query: currentQuery,
      summary: savedQuerySummary,
      type: "mysql",
    })
      .then((savedQuery) => {
        this.setState({ savingQuery: false, savedQuery: savedQuery.id, saveQueryModal: false });
      })
      .catch(() => {
        this.setState({ savingQuery: false, savingQueryError: true, saveQueryModal: false });
      });
  }

  _onUpdateSavedQuery = () => {
    const { updateSavedQuery, match, currentQuery } = this.props;
    const { savedQuery } = this.state;
    this.setState({ updatingSavedQuery: true });
    updateSavedQuery(
      match.params.projectId,
      savedQuery,
      { query: currentQuery }
    )
      .then(() => {
        this.setState({ updatingSavedQuery: false, queryUpdated: true });
      })
      .catch(() => {
        this.setState({ updatingSavedQuery: false, queryUpdateError: true });
      });
  }

  _onChangeQuery(value) {
    const { onChangeQuery } = this.props;
    onChangeQuery(value);
  }

  render() {
    const {
      savedQuery, savingQuery, updatingSavedQuery, savingQueryError, testFailed,
      queryUpdateError, queryUpdated, savedQuerySummary, saveQueryModal,
    } = this.state;
    const {
      currentQuery, testSuccess, testError, testingQuery, testQuery,
    } = this.props;

    return (
      <div style={styles.container}>
        <Grid columns={2} stackable centered divided>
          <Grid.Column width={8}>
            <Form>
              <Form.Field>
                <Header size="small">{"Enter your MySQL query here"}</Header>
                <AceEditor
                  mode="pgsql"
                  theme="tomorrow"
                  height="400px"
                  width="none"
                  value={currentQuery || ""}
                  onChange={(value) => {
                    this._onChangeQuery(value);
                  }}
                  name="queryEditor"
                  editorProps={{ $blockScrolling: true }}
                />
              </Form.Field>
              <Form.Field>
                <Container textAlign="center" fluid>
                  <Button
                    color={testSuccess ? "green" : testError ? "red" : null}
                    primary={!testSuccess && !testError}
                    icon
                    labelPosition="right"
                    onClick={testQuery}
                    loading={testingQuery}
                  >
                    {testSuccess && <Icon name="checkmark" />}
                    {testError && <Icon name="x" />}
                    {!testSuccess && !testError && <Icon name="flask" />}
                    {!testSuccess && !testError && "Test the query"}
                    {(testSuccess || testError) && "Test again"}
                  </Button>

                  <Button
                    secondary
                    icon
                    labelPosition="right"
                    loading={savingQuery}
                    onClick={this._onSaveQueryConfirmation}
                  >
                    <Icon name="plus" />
                    {!savedQuery && "Save the query"}
                    {savedQuery && "Save as new"}
                  </Button>

                  {savedQuery
                    && (
                    <Button
                      primary
                      basic
                      icon
                      labelPosition="right"
                      onClick={this._onUpdateSavedQuery}
                      loading={updatingSavedQuery}
                    >
                      <Icon name="angle double up" />
                      Update the query
                    </Button>
                    )}
                </Container>

                {testFailed
                  && (
                  <Message>
                    <Message.Header>The query failed</Message.Header>
                    <p>
                      {"Please make sure that the query doesn't have any syntax errors and that the connection you are using works."}
                      {" Refer to the "}
                      <a href="https://dev.mysql.com/doc/refman/8.0/en/select.html" target="_blank" rel="noopener noreferrer">
                        MySQL documentation for help.
                      </a>
                    </p>
                  </Message>
                  )}
                {(savingQueryError || queryUpdateError)
                  && (
                  <Message negative>
                    <Message.Header>
                      {"Oh snap! There was an issue with your request"}
                    </Message.Header>
                    <p>{"Please try again or refresh the page and if it still doesn't work, get in touch with us."}</p>
                  </Message>
                  )}
                {queryUpdated
                  && (
                  <Message
                    positive
                    onDismiss={() => this.setState({ queryUpdated: false })}
                  >
                    <Message.Header>
                      {"The query was updated successfully"}
                    </Message.Header>
                  </Message>
                  )}
              </Form.Field>
            </Form>
          </Grid.Column>
          <Grid.Column width={8}>
            <Header>Saved queries</Header>
            <Segment>
              <SavedQueries
                selectedQuery={savedQuery}
                onSelectQuery={(savedQuery) => {
                  this.setState({
                    savedQuery: savedQuery.id,
                  });
                  this._onChangeQuery(savedQuery.query);
                }}
                type="mysql"
              />
            </Segment>
          </Grid.Column>
        </Grid>

        {/* Save query modal */}
        <Modal open={saveQueryModal} size="small" onClose={() => this.setState({ saveQueryModal: false })}>
          <Header
            content="Save your query and use it later in this project"
            inverted
          />
          <Modal.Content>
            <Header size="small">Write a short description for your query</Header>
            <Input
              placeholder="Type a summary here"
              fluid
              onChange={(e, data) => this.setState({ savedQuerySummary: data.value })}
            />
          </Modal.Content>
          <Modal.Actions>
            <Button
              onClick={() => this.setState({ saveQueryModal: false })}
            >
              Close
            </Button>
            <Button
              primary
              disabled={!savedQuerySummary}
              icon
              labelPosition="right"
              onClick={this._onSaveQuery}
            >
              <Icon name="checkmark" />
              Save the query
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};


MysqlQueryBuilder.defaultProps = {
  onChangeQuery: () => {},
  testSuccess: false,
  testError: false,
  testingQuery: false,
};

MysqlQueryBuilder.propTypes = {
  createSavedQuery: PropTypes.func.isRequired,
  updateSavedQuery: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  currentQuery: PropTypes.string.isRequired,
  onChangeQuery: PropTypes.func,
  testQuery: PropTypes.func.isRequired,
  testSuccess: PropTypes.bool,
  testError: PropTypes.bool,
  testingQuery: PropTypes.bool,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createSavedQuery: (projectId, data) => dispatch(createSavedQuery(projectId, data)),
    updateSavedQuery: (projectId, savedQueryId, data) => (
      dispatch(updateSavedQuery(projectId, savedQueryId, data))
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(MysqlQueryBuilder));
