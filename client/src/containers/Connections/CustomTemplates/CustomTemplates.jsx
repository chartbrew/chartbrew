import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Card, ProgressCircle, Separator,
} from "@heroui/react";
import moment from "moment";
import { LuChartColumn } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import CreateTemplateForm from "../../../components/CreateTemplateForm";
import CustomTemplateForm from "./CustomTemplateForm";
import { deleteTemplate, selectTemplates } from "../../../slices/template";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function CustomTemplates(props) {
  const {
    teamId, projectId, onComplete, isAdmin,
    onCreateProject,
  } = props;

  const [createTemplate, setCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const dispatch = useDispatch();
  const templates = useSelector(selectTemplates);
  const loading = useSelector((state) => state.template.loading);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "hours") < 24) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  const _onDelete = (templateId) => {
    return dispatch(deleteTemplate({
      team_id: teamId,
      template_id: templateId
    }))
      .then(() => setSelectedTemplate(null));
  };

  if (loading) {
    return (
      <ProgressCircle aria-label="Loading">
        Loading templates...
      </ProgressCircle>
    );
  }

  if (templates.length === 0) {
    return (
      <div>
        <Row>
          <Text size="h4">No custom templates yet</Text>
        </Row>
        <Row>
          <Text>{"You can create custom templates from any project with data source connections and charts."}</Text>
        </Row>
        <div className="h-2" />
        {projectId && (
          <Row>
            <Button
              color="primary"
              onClick={() => setCreateTemplate(true)}
            >
              Create a new template from this project
            </Button>
          </Row>
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
        <div className="col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4" key={template.id}>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => setSelectedTemplate(template)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedTemplate(template);
              }
            }}
            className="h-full w-full cursor-pointer border border-divider shadow-none transition-colors hover:bg-content2/40"
          >
            <Card.Header>
              <Card.Title>{template.name}</Card.Title>
            </Card.Header>
            <Separator />
            <Card.Content className="flex flex-col align-middle justify-center">
              <div className="flex flex-row items-center gap-2">
                <LuChartColumn size={16} />
                <span className="text-sm">{`${template.model.Charts.length} charts`}</span>
              </div>
            </Card.Content>
            <Separator />
            <Card.Footer>
              <span className="text-sm">{`Updated ${_getUpdatedTime(template.updatedAt)}`}</span>
            </Card.Footer>
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
  onComplete: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
  onCreateProject: PropTypes.func,
};

CustomTemplates.defaultProps = {
  loading: false,
  isAdmin: false,
  projectId: "",
  onCreateProject: () => {},
};

export default CustomTemplates;
