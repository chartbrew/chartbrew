import React, { useState } from "react"

import { Button, Input, Modal, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react"
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
      <div className="h-4" />

      <div className="text-sm text-gray-500">
        Variables are used to create dashboard filters that interact with your charts. First, make sure your chart filters have variables defined, then you can variable filters from your dashboard.
      </div>

      <div className="h-4" />
      <Table className="border-1 border-divider rounded-lg shadow-none">
        <Table.ScrollContainer>
          <Table.Content aria-label="Variables" className="min-w-full">
            <TableHeader>
              <TableColumn key="name" isRowHeader textValue="Name">
                Name
              </TableColumn>
              <TableColumn key="createdAt" textValue="Created At">
                Created At
              </TableColumn>
              <TableColumn key="actions" className="w-12 text-end" textValue="Actions" />
            </TableHeader>
            <TableBody renderEmptyState={() => "No variables yet"}>
              {project?.Variables?.map((variable) => (
                <TableRow key={variable.id}>
              <TableCell key="name">
                <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-base text-default-700">{variable.name}</code>
              </TableCell>
              <TableCell key="createdAt">{new Date(variable.createdAt).toLocaleDateString()}</TableCell>
              <TableCell key="actions" className="flex justify-end text-end">
                <Button isIconOnly variant="light" color="danger" onClick={() => setDeleteModal(variable.id)}>
                  <LuTrash />
                </Button>
              </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Modal>
        <Modal.Backdrop isOpen={createModal} onOpenChange={setCreateModal}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="text-lg font-bold">
                  Create Variable
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Input
                  variant="secondary"
                  label="Variable name"
                  placeholder="Enter a variable name"
                  description="Cannot contain spaces or start with numbers"
                  errorMessage={saveError}
                  onChange={(e) => setVariableName(e.target.value)}
                  value={variableName}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  slot="close"
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  isPending={saveLoading}
                  onPress={_onSubmitVariable}
                >
                  Create
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={deleteModal} onOpenChange={setDeleteModal}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="text-lg font-bold">
                  Delete Variable
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div>{"Are you sure you want to delete this variable? This variable will stop working if you use it in your project."}</div>
                {deleteError && <div className="text-red-500">{"An error occurred while deleting the variable."}</div>}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  slot="close"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={deleteLoading}
                  onPress={() => _onDeleteVariableConfirm(deleteModal)}
                >
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Segment>
  )
}

export default Variables
