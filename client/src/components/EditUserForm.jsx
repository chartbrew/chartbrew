import React, { useState, useEffect } from "react";
import {
  Button, Divider, Input, CircularProgress, Modal, Spacer, ModalHeader, ModalBody, ModalFooter, ModalContent, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import toast, { Toaster } from "react-hot-toast";
import { LuClipboardCheck, LuClipboardCopy, LuShieldCheck, LuTrash } from "react-icons/lu";

import {
  updateUser, deleteUser, requestEmailUpdate, updateEmail, selectUser, get2faAppCode, verify2faApp, get2faMethods, remove2faMethod
} from "../slices/user";
import Container from "./Container";
import Row from "./Row";
import Text from "./Text";
import Callout from "./Callout";
import { useTheme } from "../modules/ThemeContext";
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";

/*
  Component for editting/deleting user account
*/
function EditUserForm() {
  const [user, setUser] = useState({ name: "" });
  const [userEmail, setUserEmail] = useState("");
  const [submitError, setSubmitError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState(false);
  const [updateEmailToken, setUpdateEmailToken] = useState("");
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [appToken, setAppToken] = useState("");
  const [password, setPassword] = useState("");
  const [loading2fa, setLoading2fa] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);
  const [removeMethod, setRemoveMethod] = useState(null);
  const [removePassword, setRemovePassword] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);

  const userProp = useSelector(selectUser);
  const authMethods = useSelector((state) => state.user.auths);

  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const params = new URLSearchParams(document.location.search);
    if (params.get("email")) {
      setUpdateEmailToken(params.get("email"));
    }
  });

  useEffect(() => {
    if (userProp.name && !user.name) {
      loadData();
    }

    if (userProp.email) setUserEmail(userProp.email);

    if (userProp.id) dispatch(get2faMethods(userProp.id));
  }, [userProp, user]);

  const loadData = () => {
    if (!userProp && !userProp.name) return;

    setLoading(false);
    setUser({ name: userProp.name });
  };

  const _onUpdateUser = () => {
    setSubmitError(false);
    setLoading(true);
    setSuccess(false);
    dispatch(updateUser({ user_id: userProp.id, data: user }))
      .then(() => {
        setSuccess(true);
        setLoading(false);
        toast.success("Your account has been updated.");
      })
      .catch(() => {
        setSubmitError(true);
        setLoading(false);
      });
  };

  const _onUpdateEmail = () => {
    setLoading(true);
    setSuccessEmail(false);
    dispatch(requestEmailUpdate({ user_id: userProp.id, email: userEmail }))
      .then(() => {
        setSuccessEmail(true);
        setLoading(false);
        toast.success("You will receive a confirmation on your new email shortly.");
      })
      .catch(() => {
        toast.error("Error updating your email. Please try again or check if the email is correct.");
        setLoading(false);
      });
  };

  const _onUpdateEmailConfirm = () => {
    setLoading(true);
    setSuccessEmail(false);
    dispatch(updateEmail({ user_id: userProp.id, token: updateEmailToken }))
      .then((res) => {
        if (res?.error) {
          toast.error("Error updating your email. Please try again or check if the email is correct.");
          setUpdateEmailToken("");
          setLoading(false);
          return;
        }

        setSuccessEmail(true);
        setLoading(false);
        toast.success("Your email has been updated.");
        setUpdateEmailToken("");
        navigate("/user/profile");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      })
      .catch(() => {
        toast.error("Error updating your email. Please try again or check if the email is correct.");
        setUpdateEmailToken("");
        setLoading(false);
      });
  };

  const _onDeleteUser = () => {
    setLoading(true);
    dispatch(deleteUser(userProp.id))
      .then(() => {
        navigate("/feedback");
      })
      .catch(() => {
        setLoading(false);
        setDeleteUserError(true);
        setOpenDeleteModal(false);
      });
  };

  const _onSetup2FA = () => {
    dispatch(get2faAppCode(userProp.id))
      .then((res) => {
        if (res.payload.qrUrl) {
          setQrCode(res.payload.qrUrl);
        }
      });
  };

  const _onVerify2FA = () => {
    setLoading2fa(true);
    dispatch(verify2faApp({ user_id: userProp.id, token: appToken, password }))
      .then((res) => {
        if (res.error) {
          toast.error("Error enabling 2FA. Please try again.");
          setLoading2fa(false);
          return;
        }

        toast.success("2FA has been enabled.");
        setQrCode("");
        setAppToken("");
        setPassword("");
        if (res?.payload?.backupCodes) {
          setBackupCodes(res.payload.backupCodes);
        }
        setLoading2fa(false);

        dispatch(get2faMethods(userProp.id));
      })
      .catch(() => {
        toast.error("Error enabling 2FA. Please try again.");
      });
  };

  const _onRemove2fa = () => {
    setRemoveLoading(true);
    dispatch(remove2faMethod({
      user_id: userProp.id,
      method_id: removeMethod,
      password: removePassword,
    }))
      .then((res) => {
        if (res?.error) {
          setRemoveLoading(false);
          toast.error("Could not remove. Please check if your password is correct.")
          return;
        }

        setRemoveLoading(false);
        setRemoveMethod(null);
      });
  };

  const _onCopyCodes = () => {
    window.navigator.clipboard.writeText(backupCodes.join("\n"));
    setCodesCopied(true);
    setTimeout(() => {
      setCodesCopied(false);
    }, 2000);
  };

  if (!user.name) {
    return (
      <Container>
        <CircularProgress aria-label="Loading" size="lg" />
      </Container>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:px-10 flex flex-col gap-1">
      <Row>
        <Text size="h3">Profile settings</Text>
      </Row>
      <Spacer y={1} />
      <Row>
        <Input
          label="Name"
          name="name"
          value={user.name || ""}
          type="text"
          placeholder="Enter your name"
          onChange={(e) => setUser({ ...user, name: e.target.value })}
          variant="bordered"
          fullWidth
        />
      </Row>
      <Spacer y={0.5} />
      {submitError && (
        <>
          <Row>
            <Container css={{ backgroundColor: "$red300", p: 10 }}>
              <Row>
                <Text h5>{"There was an error updating your account"}</Text>
              </Row>
              <Row>
                <Text>Please try saving again.</Text>
              </Row>
            </Container>
          </Row>
          <Spacer y={0.5} />
        </>
      )}
      <Row>
        <Button
          disabled={!user.name}
          color={success ? "success" : "primary"}
          onClick={_onUpdateUser}
          variant={success ? "flat" : "solid"}
          isLoading={loading}
        >
          {success ? "Saved" : "Save" }
        </Button>
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Text size="h3">Email settings</Text>
      </Row>
      <Spacer y={1} />

      <Row>
        <Input
          label="Your email"
          name="email"
          value={userEmail || ""}
          onChange={(e) => setUserEmail(e.target.value)}
          type="text"
          placeholder="Enter your email"
          variant="bordered"
          fullWidth
        />
      </Row>
      {userEmail !== userProp.email && (
        <>
          <Spacer y={0.5} />
          <Row>
            <Text>{"We will send you an email to confirm your new email address."}</Text>
          </Row>
        </>
      )}
      <Spacer y={0.5} />
      <Row>
        <Button
          isDisabled={!userEmail || userEmail === userProp.email}
          color={successEmail ? "success" : "primary"}
          onClick={_onUpdateEmail}
          variant={successEmail ? "flat" : "solid"}
          isLoading={loading}
        >
          {successEmail ? "We sent you an email" : "Update email" }
        </Button>
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Text size="h3">Two-factor authentication</Text>
      </Row>
      <Spacer y={1} />

      {!qrCode && authMethods?.length === 0 && (
        <Row>
          <Button
            color="primary"
            variant="bordered"
            onClick={() => _onSetup2FA()}
            endContent={<LuShieldCheck />}
          >
            {"Enable 2FA"}
          </Button>
        </Row>
      )}

      {qrCode && (
        <div className="flex flex-col gap-2">
          <Text>{"1. Have an authenticator app for mobile or browser ready"}</Text>
          <Text>{"2. Scan the QR code with the authenticator app"}</Text>
          <img src={qrCode} alt="QR code" width={200} />
          <Text>{"3. Enter the code from the authenticator app below"}</Text>
          <Input
            label="Code"
            placeholder="Enter the code here"
            variant="bordered"
            fullWidth
            onChange={(e) => setAppToken(e.target.value)}
          />
          <Text>{"4. Enter your account password to confirm"}</Text>
          <Input
            label="Password"
            placeholder="Enter your password"
            variant="bordered"
            fullWidth
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <Spacer y={1} />
          <div>
            <Button
              color="primary"
              onClick={() => _onVerify2FA()}
              isDisabled={!appToken || !password}
              isLoading={loading2fa}
            >
              {"Confirm"}
            </Button>
          </div>
        </div>
      )}

      {backupCodes && (
        <>
          <Text>{"Save these backup codes in a safe place as we only show them once. You can use them to access your account if you lose access to your authenticator app."}</Text>
          <Spacer y={1} />
          <div className="flex flex-row flex-wrap gap-1">
            {backupCodes?.map((code) => (
              <Chip key={code} variant="flat" radius="sm">
                {code}
              </Chip>
            ))}
          </div>
          <Spacer y={1} />
          <Button
            variant="bordered"
            endContent={codesCopied ? <LuClipboardCheck /> : <LuClipboardCopy />}
            onClick={_onCopyCodes}
          >
            {codesCopied ? "Copied" : "Copy codes"}
          </Button>
          <Spacer y={1} />
        </>
      )}

      {authMethods?.length > 0 && (
        <Table aria-label="Two-factor authentication methods">
          <TableHeader>
            <TableColumn key="method" align="center">Method</TableColumn>
            <TableColumn key="isEnabled" align="center">Enabled</TableColumn>
            <TableColumn key="actions" align="end" hideHeader />
          </TableHeader>
          <TableBody>
            {authMethods.map((method) => (
              <TableRow key={method.id}>
                <TableCell key="method">{method.method}</TableCell>
                <TableCell key="isEnabled">
                  {method.isEnabled
                    ? <Chip color="success" size="sm" variant="flat">Yes</Chip>
                    : <Chip color="danger" size="sm" variant="flat">No</Chip>
                  }
                </TableCell>
                <TableCell key="actions" align="right" className="flex justify-end">
                  <Button
                    color="danger"
                    variant="light"
                    isIconOnly
                    onClick={() => setRemoveMethod(method.id)}
                  >
                    <LuTrash />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Text size="h3">Danger zone</Text>
      </Row>
      <Spacer y={1} />

      <Row>
        <Button
          iconRight={<LuTrash />}
          color="danger"
          onClick={() => setOpenDeleteModal(true)}
          bordered
          auto
        >
          Delete account
        </Button>
      </Row>

      <Modal backdrop="blur" isOpen={openDeleteModal} size="xl" onClose={() => setOpenDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Delete Account</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Text>{"This action will delete your account permanently, including your team and everything associated with it (projects, connections, and charts)."}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text>{"We cannot reverse this action as all the content is deleted immediately."}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Text b>Are you sure you want to delete your user and team?</Text>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => setOpenDeleteModal(false)}
              variant="bordered"
            >
              {"Go back"}
            </Button>
            <Button
              color="danger"
              onPress={_onDeleteUser}
              isLoading={loading}
              auto
            >
              {"Delete forever"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!updateEmailToken}>
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Update email</Text>
          </ModalHeader>
          <ModalBody>
            <Text>Are you sure you want to update your email?</Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setUpdateEmailToken("")}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={_onUpdateEmailConfirm}
            >
              Confirm
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {deleteUserError && (
        <Row>
          <Callout
            title="Something went wrong while deleting your account"
            text={"Please try refreshing the page."}
            color="danger"
          />
        </Row>
      )}

      <Modal isOpen={!!removeMethod} onClose={() => setRemoveMethod(null)}>
        <ModalContent>
          <ModalHeader>
            <Text h3>Remove 2FA method</Text>
          </ModalHeader>
          <ModalBody>
            <p>Are you sure you want to remove your 2FA method? You can add a new one afterwards.</p>
            <p>To proceed with the deletion, please confirm your Chartbrew password.</p>
            <Input
              label="Password"
              placeholder="Enter your password"
              variant="bordered"
              onChange={(e) => setRemovePassword(e.target.value)}
              fullWidth
              type="password"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onClick={() => setRemoveMethod(null)}
            >
              Close
            </Button>
            <Button
              color="danger"
              isDisabled={!removePassword}
              onClick={_onRemove2fa}
              isLoading={removeLoading}
            >
              Remove 2FA
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 2500,
          style: {
            borderRadius: "8px",
            background: isDark ? "#333" : "#fff",
            color: isDark ? "#fff" : "#000",
          },
        }}
      />
    </div>
  );
}

export default EditUserForm;
