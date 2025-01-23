import React from "react"
import PropTypes from "prop-types";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react"

function QuickStartVideo({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          <span className="font-bold">Chartbrew quick start guide</span>
        </ModalHeader>
        <ModalBody>
          <div className="relative pb-[56.25%] h-0 mt-4">
            <iframe
              src="https://www.youtube.com/embed/15nAw318Vo4?si=DpQFhQ2CyYl2nEU5"
              title="Chartbrew quick start video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              className="absolute inset-0 w-full h-full rounded-lg"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="bordered"
            onClick={onClose}
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

QuickStartVideo.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default QuickStartVideo;
