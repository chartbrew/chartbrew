import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Card, Grid, Header, Icon, Placeholder,
} from "semantic-ui-react";
import moment from "moment";

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
      <div>
        <Placeholder>
          <Placeholder.Header image>
            <Placeholder.Line />
            <Placeholder.Line />
          </Placeholder.Header>
          <Placeholder.Paragraph>
            <Placeholder.Header>
              <Placeholder.Line />
            </Placeholder.Header>
          </Placeholder.Paragraph>
        </Placeholder>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div>
        <Header>No custom templates yet</Header>
        <p>{"You can create custom templates from any project with data source connections and charts."}</p>
        {projectId && connections.length > 0 && (
          <Button
            primary
            content="Create a new template from this project"
            onClick={() => setCreateTemplate(true)}
          />
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
    <div>
      <Grid widths={4}>
        {templates && templates.map((template) => (
          <Grid.Column key={template.id} width="4">
            <Card className="project-segment" onClick={() => setSelectedTemplate(template)}>
              <Card.Content header={template.name} />
              <Card.Content>
                <Card.Group itemsPerRow={4}>
                  {template.model.Connections && template.model.Connections.map((c) => (
                    <Card key={c.id} image={connectionImages[c.type]} />
                  ))}
                </Card.Group>
                <Card.Description style={{ marginTop: 20 }}>
                  <Icon name="chart area" />
                  {` ${template.model.Charts.length} charts`}
                </Card.Description>
                <Card.Description>
                  <Icon name="plug" />
                  {` ${template.model.Connections.length} connections`}
                </Card.Description>
              </Card.Content>
              <Card.Content extra>{`Updated ${_getUpdatedTime(template.updatedAt)}`}</Card.Content>
            </Card>
          </Grid.Column>
        ))}
      </Grid>
    </div>
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
