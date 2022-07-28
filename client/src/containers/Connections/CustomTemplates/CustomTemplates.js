import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Avatar,
  Button,
  Card,
  Grid,
  Loading, Row, Spacer, Text,
} from "@nextui-org/react";
import moment from "moment";
import { Chart } from "react-iconly";

import CreateTemplateForm from "../../../components/CreateTemplateForm";
import connectionImages from "../../../config/connectionImages";
import CustomTemplateForm from "./CustomTemplateForm";
import { deleteTemplate as deleteTemplateAction } from "../../../actions/template";

function CustomTemplates(props) {
  const {
    loading, templates, teamId, projectId, connections, onComplete, isAdmin, deleteTemplate,
    onCreateProject,
  } = props;

  const [createTemplate, setCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "hours") < 24) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onDelete = (templateId) => {
    return deleteTemplate(teamId, templateId)
      .then(() => setSelectedTemplate(null));
  };

  if (loading) {
    return (
      <Loading type="spinner">
        Loading templates...
      </Loading>
    );
  }

  if (templates.length === 0) {
    return (
      <div>
        <Text h4>No custom templates yet</Text>
        <Text>{"You can create custom templates from any project with data source connections and charts."}</Text>
        {projectId && connections.length > 0 && (
          <Button
            primary
            content="Create a new template from this project"
            onClick={() => setCreateTemplate(true)}
            size="small"
          >
            Create a new template from this project
          </Button>
        )}

        <CreateTemplateForm
          teamId={teamId}
          projectId={projectId}
          visible={createTemplate}
          onClose={() => setCreateTemplate(false)}
        />
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <CustomTemplateForm
        template={selectedTemplate}
        connections={connections}
        onBack={() => setSelectedTemplate(null)}
        projectId={projectId}
        onComplete={onComplete}
        isAdmin={isAdmin}
        onDelete={(id) => _onDelete(id)}
        onCreateProject={onCreateProject}
      />
    );
  }

  return (
    <Grid.Container gap={2}>
      {templates && templates.map((template) => (
        <Grid key={template.id} xs={12} sm={6} md={4}>
          <Card onClick={() => setSelectedTemplate(template)} isHoverable isPressable variant="bordered">
            <Card.Header>{template.name}</Card.Header>
            <Card.Body>
              {template.model.Connections && (
                <Row css={{ pr: 8, pl: 8 }} justify="center">
                  <Avatar.Group animated={template.model.Connections.length > 1}>
                    {template.model.Connections.map((c) => (
                      <Avatar
                        key={c.id}
                        src={connectionImages[c.type]}
                        pointer
                        bordered
                        stacked
                        title={`${c.type} connection`}
                      />
                    ))}
                  </Avatar.Group>
                </Row>
              )}
              <Spacer y={0.5} />
              <Row align="center" justify="center">
                <Chart />
                <Spacer x={0.2} />
                <Text>{`${template.model.Charts.length} charts`}</Text>
              </Row>
              <Spacer y={0.5} />
            </Card.Body>
            <Card.Footer>
              <Text small>{`Updated ${_getUpdatedTime(template.updatedAt)}`}</Text>
            </Card.Footer>
          </Card>
        </Grid>
      ))}
    </Grid.Container>
  );
}

CustomTemplates.propTypes = {
  templates: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  teamId: PropTypes.string.isRequired,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  connections: PropTypes.array.isRequired,
  onComplete: PropTypes.func.isRequired,
  deleteTemplate: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
  onCreateProject: PropTypes.func,
};

CustomTemplates.defaultProps = {
  loading: false,
  isAdmin: false,
  projectId: "",
  onCreateProject: () => {},
};

const mapStateToProps = () => ({});
const mapDispatchToProps = (dispatch) => {
  return {
    deleteTemplate: (teamId, templateId) => dispatch(deleteTemplateAction(teamId, templateId)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(CustomTemplates);
