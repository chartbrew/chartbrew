import React from "react";
import PropTypes from "prop-types";
import { Accordion, Button, Modal } from "@heroui/react";

import {
  AI_DATA_DISCLOSURE,
  getAiEnablementCopy,
} from "../Ai/aiEnablementCopy";

function EnableAiPromptModal({ isOpen, isPending, onCancel, onConfirm, scope }) {
  const copy = getAiEnablementCopy(scope);

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isPending) onCancel();
        }}
        variant="blur"
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={isPending} />
            <Modal.Header>
              <Modal.Heading className="font-tw text-xl font-semibold">
                {copy.title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm leading-6 text-muted">{copy.message}</p>
              <Accordion variant="surface">
                <Accordion.Item id="ai-data-processing" textValue={AI_DATA_DISCLOSURE.title}>
                  <Accordion.Heading>
                    <Accordion.Trigger className="rounded-xl px-3 py-2.5">
                      <span className="flex-1 text-start text-sm font-medium text-foreground">
                        {AI_DATA_DISCLOSURE.title}
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3 px-3 pb-3 pt-1 text-sm leading-6 text-muted">
                      <p>{AI_DATA_DISCLOSURE.details}</p>
                      <p>{AI_DATA_DISCLOSURE.permissions}</p>
                      <p className="font-medium text-foreground">{AI_DATA_DISCLOSURE.guidance}</p>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={isPending} onPress={onCancel} variant="secondary">
                Cancel
              </Button>
              <Button isPending={isPending} onPress={onConfirm} variant="primary">
                Enable Chartbrew AI
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

EnableAiPromptModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  isPending: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  scope: PropTypes.oneOf(["platform", "team"]).isRequired,
};

EnableAiPromptModal.defaultProps = {
  isPending: false,
};

export default EnableAiPromptModal;
