import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Badge,
  Button, Container, Divider, Input, Modal, Row, Spacer, Switch, Text, Textarea, Tooltip
} from "@nextui-org/react";
import { InfoCircle, TickSquare } from "react-iconly";
import { FaClipboard } from "react-icons/fa";

import { SITE_HOST } from "../../../config/settings";
import { secondary } from "../../../config/colors";

function SharingSettings(props) {
  const {
    open, onClose, error, project, onSaveBrewName, brewLoading, onToggleBranding,
    onTogglePublic, onTogglePassword, onSavePassword,
  } = props;

  const [newBrewName, setNewBrewName] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (project && project.id) {
      setNewBrewName(project.brewName);
      setNewPassword(project.password);
    }
  }, [project]);

  const _onChangeBrewName = (value) => {
    setNewBrewName(value);
  };

  const _onCopyUrl = () => {
    setUrlCopied(true);
    navigator.clipboard.writeText(`${SITE_HOST}/b/${newBrewName}`); // eslint-disable-line
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    navigator.clipboard.writeText(`<iframe src="${SITE_HOST}/b/${newBrewName}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`); // eslint-disable-line
  };

  const _getEmbedString = () => {
    return `<iframe src="${SITE_HOST}/b/${newBrewName}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  return (
    <Modal open={open} onClose={onClose} width={600}>
      <Modal.Header>
        <Text h3>Sharing settings</Text>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row>
            <Text>Your dashboard URL</Text>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Input
              id="share-url-text"
              placeholder="Enter your custom dashboard URL"
              contentLeft={(
                <Badge variant={"flat"} isSquared>{`${SITE_HOST}/b/`}</Badge>
              )}
              contentLeftStyling={false}
              value={newBrewName}
              onChange={(e) => _onChangeBrewName(e.target.value)}
              helperColor="error"
              helperText={error}
              bordered
              fullWidth
            />
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              color="secondary"
              onClick={() => onSaveBrewName(newBrewName)}
              disabled={brewLoading || !newBrewName}
              size="sm"
              auto
            >
              Save URL and reload
            </Button>
            <Spacer x={0.2} />
            <Tooltip
              content="Copy the URL to the clipboard"
              css={{ zIndex: 10000 }}
            >
              <Button
                icon={urlCopied ? <TickSquare /> : <FaClipboard />}
                color={urlCopied ? "success" : "secondary"}
                onClick={_onCopyUrl}
                size="sm"
                bordered
                css={{ minWidth: "fit-content" }}
              />
            </Tooltip>
          </Row>
          <Spacer y={1} />
          <Row align="center">
            <Switch
              checked={project.public}
              onChange={onTogglePublic}
            />
            <Spacer x={0.2} />
            <Text>Make dashboard public</Text>
            <Spacer x={0.2} />
            <Tooltip
              content={(
                <>
                  <p>{"A public report can be viewed by anyone with or without a Chartbrew account."}</p>
                  <p>{"A private report can only be seen by members of your team"}</p>
                </>
              )}
              css={{ zIndex: 10000 }}
            >
              <InfoCircle />
            </Tooltip>
          </Row>
          <Spacer y={0.5} />
          <Row align="center">
            <Switch
              checked={project.passwordProtected}
              onChange={onTogglePassword}
              disabled={!project.public}
            />
            <Spacer x={0.2} />
            <Text>Require password to view</Text>
            <Spacer x={0.2} />
            <Tooltip
              content="Public reports will require the viewers outside of your team to enter a password before viewing"
              css={{ zIndex: 10000 }}
            >
              <InfoCircle />
            </Tooltip>
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Input
              label="Report password"
              placeholder="Enter a password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!project.public || !project.passwordProtected}
              bordered
              fullWidth
            />
          </Row>
          <Spacer y={0.5} />
          <Row>
            <Button
              color="secondary"
              onClick={() => onSavePassword(newPassword)}
              disabled={
                !project.public
                || !project.passwordProtected
                || !newPassword
                || project.password === newPassword
              }
              size="sm"
              auto
            >
              Save password
            </Button>
          </Row>

          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />

          <Row>
            <Textarea
              label="Embed this report"
              id="iframe-text"
              value={_getEmbedString()}
              fullWidth
            />
          </Row>
          {!project.public && (
            <>
              <Spacer y={0.5} />
              <Row align="center">
                <InfoCircle primaryColor={secondary} />
                <Text small i>{" The embedding only works when the report is public"}</Text>
              </Row>
            </>
          )}
          <Spacer y={0.5} />
          <Row>
            <Button
              icon={embedCopied ? <TickSquare /> : <FaClipboard />}
              color={embedCopied ? "success" : "secondary"}
              onClick={_onCopyEmbed}
              size="sm"
              auto
            >
              {embedCopied ? "Copied" : "Copy to clipboard"}
            </Button>
          </Row>

          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />

          <Row>
            <Text size={16}>Show or hide the Chartbrew branding from charts and reports</Text>
          </Row>
          <Spacer y={0.2} />
          <Row align="center">
            <Switch
              checked={project.Team && project.Team.showBranding}
              onChange={onToggleBranding}
            />
            <Spacer x={0.2} />
            <Text>Charbrew branding</Text>
          </Row>
        </Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          flat
          color="warning"
          onClick={onClose}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

SharingSettings.propTypes = {
  open: PropTypes.bool,
  error: PropTypes.string,
  project: PropTypes.object.isRequired,
  brewLoading: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSaveBrewName: PropTypes.func.isRequired,
  onToggleBranding: PropTypes.func.isRequired,
  onTogglePublic: PropTypes.func.isRequired,
  onTogglePassword: PropTypes.func.isRequired,
  onSavePassword: PropTypes.func.isRequired,
};

SharingSettings.defaultProps = {
  open: false,
  error: "",
  brewLoading: false,
};

export default SharingSettings;
