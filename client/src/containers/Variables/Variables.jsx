import React, { useState } from "react"

import { Button, Code, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spacer, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
import { useDispatch, useSelector } from "react-redux"

import { createVariable, deleteVariable, selectProject } from "../../slices/project"
import Segment from "../../components/Segment"
import { LuPlus, LuTrash } from "react-icons/lu"

function Variables() {
  const [createModal, setCreateModal] = useState(false);
  const [variableName, setVariableName] = useState("");
  
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(false);
  
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const project = useSelector(selectProject);
  const dispatch = useDispatch();

  const _onCreateVariable = () => {
    setCreateModal(true);
  };

  const _onSubmitVariable = async () => {
    // make sure the variable name contains a valid variable
    // check with regex
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/;
    if (!regex.test(variableName)) {
      setSaveError("Variable name is invalid");
      return;
    }

    setSaveError(false);
    setSaveLoading(true);

    await dispatch(createVariable({ project_id: project.id, data: { name: variableName } }))
      .then((res) => {
        if (res.error) {
          return;
        }

        setCreateModal(false);
        setSaveLoading(false);
      });

    setVariableName("");
  };

  const _onDeleteVariableConfirm = async (vId) => {
    setDeleteLoading(true);
    setDeleteError(false);

    await dispatch(deleteVariable({ project_id: project.id, variable_id: vId }))
      .then((res) => {
        if (res.error) {
          setDeleteError(true);
          return;
        }

        setDeleteModal(false);
        setDeleteLoading(false);
      });
  };

  return (
    <Segment className="container mx-auto bg-content1 mt-4 max-w-xl">
      <div className="flex flex-row justify-between">
        <div className="text-lg font-bold">Variables</div>
        <Button
          color="primary"
          endContent={<LuPlus />}
          onClick={_onCreateVariable}
        >
          Create variable
        </Button>
      </div>
      <Spacer y={4} />

      <div className="text-sm text-gray-500">
        Variables are used to create dashboard filters that interact with your charts. First, make sure your chart filters have variables defined, then you can variable filters from your dashboard.
      </div>

      <Spacer y={4} />
      <Table shadow="none" className="border-1 border-divider rounded-lg" aria-label="Variables">
        <TableHeader>
          <TableColumn key="name">Name</TableColumn>
          <TableColumn key="createdAt">Created At</TableColumn>
          <TableColumn key="actions" hideHeader align="end" />
        </TableHeader>
        <TableBody emptyContent="No variables yet">
          {project?.Variables?.map((variable) => (
            <TableRow key={variable.id}>
              <TableCell key="name">
                <Code>{variable.name}</Code>
              </TableCell>
              <TableCell key="createdAt">{new Date(variable.createdAt).toLocaleDateString()}</TableCell>
              <TableCell key="actions" align="end" className="flex justify-end">
                <Button isIconOnly variant="light" color="danger" onClick={() => setDeleteModal(variable.id)}>
                  <LuTrash />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={createModal} onClose={() => setCreateModal(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="text-lg font-bold">Create Variable</div>
          </ModalHeader>
          <ModalBody>
            <Input
              variant="bordered"
              label="Variable name"
              placeholder="Enter a variable name"
              description="Cannot contain spaces or start with numbers"
              errorMessage={saveError}
              onChange={(e) => setVariableName(e.target.value)}
              value={variableName}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setCreateModal(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              isLoading={saveLoading}
              onClick={_onSubmitVariable}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="text-lg font-bold">Delete Variable</div>
          </ModalHeader>
          <ModalBody>
            <div>{"Are you sure you want to delete this variable? This variable will stop working if you use it in your project."}</div>
            {deleteError && <div className="text-red-500">{"An error occurred while deleting the variable."}</div>}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deleteLoading}
              onClick={() => _onDeleteVariableConfirm(deleteModal)}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Segment>
  )
}

export default Variables
