import React from "react"
import PropTypes from "prop-types";
import { Button, Modal } from "@heroui/react"

function QuickStartVideo({ isOpen, onClose }) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-4xl">
          <Modal.Header>
            <Modal.Heading>Chartbrew quick start guide</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="relative mt-4 h-0 pb-[56.25%]">
              <iframe
                src="https://www.youtube.com/embed/15nAw318Vo4?si=DpQFhQ2CyYl2nEU5"
                title="Chartbrew quick start video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full rounded-lg"
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              onPress={onClose}
              variant="secondary"
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

QuickStartVideo.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default QuickStartVideo;
