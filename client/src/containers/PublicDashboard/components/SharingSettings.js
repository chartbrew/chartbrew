import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Form, Icon, Input, Label, Modal, Popup,
  TextArea, TransitionablePortal,
} from "semantic-ui-react";
import { SITE_HOST } from "../../../config/settings";
import { blackTransparent } from "../../../config/colors";

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

  const _onChangeBrewName = (e, data) => {
    setNewBrewName(data.value);
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
    <TransitionablePortal open={open}>
      <Modal open={open} onClose={onClose}>
        <Modal.Header>Sharing settings</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field>
              <label>Your dashboard URL</label>
              <Input
                id="share-url-text"
                placeholder="Enter your custom dashboard URL"
                label={(
                  <Label basic style={{ color: blackTransparent(0.5), fontWeight: 400 }}>{`${SITE_HOST}/b/`}</Label>
                )}
                value={newBrewName}
                onChange={_onChangeBrewName}
              />
              {error && (<Label pointing color="red">{error}</Label>)}
            </Form.Field>
            <Form.Field>
              <Button
                primary
                content="Save URL and reload"
                basic
                onClick={() => onSaveBrewName(newBrewName)}
                disabled={!newBrewName}
                loading={brewLoading}
                size="small"
              />
              <Popup
                trigger={(
                  <Button
                    basic
                    icon={urlCopied ? "checkmark" : "clipboard"}
                    color={urlCopied ? "green" : null}
                    onClick={_onCopyUrl}
                    size="small"
                  />
                )}
                inverted
                content="Copy the URL to the clipboard"
              />
            </Form.Field>
            <Form.Field>
              <Popup
                trigger={(
                  <Checkbox
                    toggle
                    label="Make public"
                    checked={project.public}
                    onChange={onTogglePublic}
                  />
                )}
                inverted
                content={(
                  <>
                    <p>{"A public report can be viewed by anyone with or without a Chartbrew account"}</p>
                    <p>{"A private report can only be seen by members of your team"}</p>
                  </>
                )}
              />
            </Form.Field>
            <Form.Field>
              <Popup
                trigger={(
                  <Checkbox
                    toggle
                    label="Password protection"
                    checked={project.passwordProtected}
                    onChange={onTogglePassword}
                    disabled={!project.public}
                  />
                )}
                inverted
                content="Public reports will require the viewers outside of your team to enter a password before viewing"
              />
            </Form.Field>
            <Form.Field>
              <label>Report password</label>
              <Input
                placeholder="Enter a password"
                value={newPassword}
                onChange={(e, data) => setNewPassword(data.value)}
                disabled={!project.public || !project.passwordProtected}
              />
            </Form.Field>
            <Form.Field>
              <Button
                primary
                basic
                content="Save password"
                onClick={() => onSavePassword(newPassword)}
                disabled={
                  !project.public
                  || !project.passwordProtected
                  || !newPassword
                  || project.password === newPassword
                }
                size="small"
              />
            </Form.Field>
            <Form.Field>
              <Divider section />
              <label>Embed this dashboard</label>
              <TextArea
                id="iframe-text"
                value={_getEmbedString()}
              />
              {!project.public && (
                <>
                  <Icon name="exclamation circle" color="orange" />
                  <i>{" The embedding only works when the report is public"}</i>
                </>
              )}
            </Form.Field>
            <Form.Field>
              <Button
                basic
                icon={embedCopied ? "checkmark" : "clipboard"}
                content={embedCopied ? "Copied" : "Copy to clipboard"}
                color={embedCopied ? "green" : null}
                onClick={_onCopyEmbed}
                size="small"
              />
            </Form.Field>
            <Form.Field>
              <Divider section />
              <label>Show or hide the Chartbrew branding from charts and reports</label>
              <Checkbox
                label="Charbrew branding"
                toggle
                checked={project.Team && project.Team.showBranding}
                onChange={onToggleBranding}
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button
            content="Close"
            onClick={onClose}
          />
        </Modal.Actions>
      </Modal>
    </TransitionablePortal>
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
