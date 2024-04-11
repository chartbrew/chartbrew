import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Spacer, Switch, Textarea, Tooltip, RadioGroup, Radio,
} from "@nextui-org/react";
import { LuClipboard, LuClipboardCheck, LuInfo } from "react-icons/lu";

import { SITE_HOST } from "../../../config/settings";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function SharingSettings(props) {
  const {
    open, onClose, error, project, onSaveBrewName, brewLoading, onToggleBranding,
    onTogglePublic, onTogglePassword, onSavePassword,
  } = props;

  const [newBrewName, setNewBrewName] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [embedTheme, setEmbedTheme] = useState("");

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
    navigator.clipboard.writeText(`${SITE_HOST}/b/${newBrewName}`);
  };

  const _onCopyEmbed = () => {
    setEmbedCopied(true);
    navigator.clipboard.writeText(`<iframe src="${SITE_HOST}/b/${newBrewName}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`);
  };

  const _getEmbedString = () => {
    return `<iframe src="${SITE_HOST}/b/${newBrewName}${embedTheme ? `?theme=${embedTheme}` : ""}" allowTransparency="true" width="1200" height="600" frameborder="0" style="background-color: #ffffff"></iframe>`;
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl">
      <ModalContent>
        <ModalHeader>
          <Text size="h3">Sharing settings</Text>
        </ModalHeader>
        <ModalBody>
          <Row>
            <Text>Your dashboard URL</Text>
          </Row>
          <Row>
            <Input
              id="share-url-text"
              placeholder="Enter your custom dashboard URL"
              labelPlacement="outside"
              startContent={`${SITE_HOST}/b/`}
              value={newBrewName}
              onChange={(e) => _onChangeBrewName(e.target.value)}
              color={error ? "error" : "default"}
              description={error}
              variant="bordered"
              fullWidth
            />
          </Row>
          <Row>
            <Button
              color="secondary"
              onClick={() => onSaveBrewName(newBrewName)}
              isDisabled={!newBrewName}
              isLoading={brewLoading}
              size="sm"
            >
              Save URL and reload
            </Button>
            <Spacer x={1} />
            <Tooltip
              content="Copy the URL to the clipboard"
            >
              <Button
                isIconOnly
                color={urlCopied ? "success" : "secondary"}
                onClick={_onCopyUrl}
                size="sm"
                variant="bordered"
              >
                {urlCopied ? <LuClipboardCheck /> : <LuClipboard />}
              </Button>
            </Tooltip>
          </Row>
          <Spacer y={1} />
          <Row align="center">
            <Switch
              isSelected={project.public}
              onValueChange={onTogglePublic}
              size="sm"
            >
              Make the dashboard public
            </Switch>
            <Spacer x={1} />
            <Tooltip
              content={(
                <>
                  <p>{"A public report can be viewed by anyone with or without a Chartbrew account."}</p>
                  <p>{"A private report can only be seen by members of your team"}</p>
                </>
              )}
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Row align="center">
            <Switch
              isSelected={project.passwordProtected}
              onValueChange={onTogglePassword}
              isDisabled={!project.public}
              size="sm"
            >
              Require password to view
            </Switch>
            <Spacer x={1} />
            <Tooltip
              content="Public reports will require the viewers outside of your team to enter a password before viewing"
            >
              <div><LuInfo /></div>
            </Tooltip>
          </Row>
          <Row>
            <Input
              label="Report password"
              placeholder="Enter a password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              isDisabled={!project.public || !project.passwordProtected}
              variant="bordered"
              fullWidth
            />
          </Row>
          <Row>
            <Button
              color="secondary"
              onClick={() => onSavePassword(newPassword)}
              isDisabled={
                !project.public
                || !project.passwordProtected
                || !newPassword
                || project.password === newPassword
              }
              size="sm"
            >
              Save password
            </Button>
          </Row>

          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />

          <div>
            <RadioGroup
              label="Select a theme"
              orientation="horizontal"
              size="sm"
            >
              <Radio value="os" onClick={() => setEmbedTheme("")} checked={embedTheme === ""}>
                System default
              </Radio>
              <Radio value="dark" onClick={() => setEmbedTheme("dark")} checked={embedTheme === "dark"}>
                Dark
              </Radio>
              <Radio value="light" onClick={() => setEmbedTheme("light")} checked={embedTheme === "light"}>
                Light
              </Radio>
            </RadioGroup>
          </div>
          <Row>
            <Textarea
              label="Embed this report"
              id="iframe-text"
              value={_getEmbedString()}
              fullWidth
              variant="bordered"
              readOnly
            />
          </Row>
          {!project.public && (
            <>
              <Row align="center">
                <LuInfo className="text-secondary" />
                <Text size="sm" className={"italic"}>
                  {" The embedding only works when the report is public"}
                </Text>
              </Row>
            </>
          )}
          <Row>
            <Button
              startContent={embedCopied ? <LuClipboardCheck /> : <LuClipboard />}
              color={embedCopied ? "success" : "secondary"}
              variant={embedCopied ? "flat" : "bordered"}
              onClick={_onCopyEmbed}
              size="sm"
            >
              {embedCopied ? "Copied" : "Copy to clipboard"}
            </Button>
          </Row>

          <Spacer y={1} />
          <Divider />
          <Spacer y={1} />

          <Row>
            <Text>Show or hide the Chartbrew branding from charts and reports</Text>
          </Row>
          <Row align="center">
            <Switch
              isSelected={project.Team && project.Team.showBranding}
              onChange={onToggleBranding}
              size="sm"
            >
              Chartbrew branding
            </Switch>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={onClose}
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
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
