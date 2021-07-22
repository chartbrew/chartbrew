import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Card, Grid, Header, Icon, Placeholder,
} from "semantic-ui-react";
import moment from "moment";

import CreateTemplateForm from "../../../components/CreateTemplateForm";
import connectionImages from "../../../config/connectionImages";
import CustomTemplateForm from "./CustomTemplateForm";

function CustomTemplates(props) {
  const {
    loading, templates, teamId, projectId, connections, onComplete,
  } = props;

  const [createTemplate, setCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "hours") < 24) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
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
        <p>You can create custom templates from any project.</p>
        <Button
          primary
          content="Create a new template from this project"
          onClick={() => setCreateTemplate(true)}
        />

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
  projectId: PropTypes.string.isRequired,
  connections: PropTypes.array.isRequired,
  onComplete: PropTypes.func.isRequired,
};

CustomTemplates.defaultProps = {
  loading: false,
};

export default CustomTemplates;
