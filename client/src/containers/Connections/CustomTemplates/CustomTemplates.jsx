import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Avatar, Button, Card, Spacer, CircularProgress, CardHeader, CardBody, AvatarGroup, CardFooter,
} from "@nextui-org/react";
import moment from "moment";
import { Chart } from "react-iconly";

import CreateTemplateForm from "../../../components/CreateTemplateForm";
import connectionImages from "../../../config/connectionImages";
import CustomTemplateForm from "./CustomTemplateForm";
import { deleteTemplate as deleteTemplateAction } from "../../../actions/template";
import Text from "../../../components/Text";
import Row from "../../../components/Row";
import useThemeDetector from "../../../modules/useThemeDetector";

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

  const isDark = useThemeDetector();

  if (loading) {
    return (
      <CircularProgress aria-label="Loading">
        Loading templates...
      </CircularProgress>
    );
  }

  if (templates.length === 0) {
    return (
      <div>
        <Text size="h4">No custom templates yet</Text>
        <Text>{"You can create custom templates from any project with data source connections and charts."}</Text>
        {projectId && connections.length > 0 && (
          <Button
            color="primary"
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
    <div className="grid grid-cols-12 gap-4">
      {templates && templates.map((template) => (
        <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-3" key={template.id}>
          <Card onClick={() => setSelectedTemplate(template)} isHoverable isPressable className="min-w-[300px]">
            <CardHeader>
              <Text b>{template.name}</Text>
            </CardHeader>
            <CardBody>
              {template.model.Connections && (
                <Row css={{ pr: 8, pl: 8 }} justify="center">
                  <AvatarGroup animated={template.model.Connections.length > 1}>
                    {template.model.Connections.map((c) => (
                      <Avatar
                        key={c.id}
                        src={connectionImages(isDark)[c.type]}
                        pointer
                        bordered
                        stacked
                        title={`${c.type} connection`}
                      />
                    ))}
                  </AvatarGroup>
                </Row>
              )}
              <Spacer y={1} />
              <Row align="center" justify="center">
                <Chart />
                <Spacer x={0.5} />
                <Text>{`${template.model.Charts.length} charts`}</Text>
              </Row>
              <Spacer y={1} />
            </CardBody>
            <CardFooter>
              <Text size="sm">{`Updated ${_getUpdatedTime(template.updatedAt)}`}</Text>
            </CardFooter>
          </Card>
        </div>
      ))}
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
