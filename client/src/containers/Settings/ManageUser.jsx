import React, { useState, useEffect } from "react";
import {
  Button, Divider, Input, CircularProgress, Modal, Spacer, ModalHeader, ModalBody, ModalFooter, ModalContent, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Alert,
} from "@heroui/react";
import toast, { Toaster } from "react-hot-toast";
import { LuClipboardCheck, LuClipboardCopy, LuShieldCheck, LuTrash } from "react-icons/lu";

import {
  updateUser, deleteUser, requestEmailUpdate, updateEmail, selectUser, get2faAppCode, verify2faApp, get2faMethods, remove2faMethod
} from "../../slices/user";
import { useTheme } from "../../modules/ThemeContext";
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";

/*
  User Profile Settings main screen
*/
function ManageUser() {
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
  const [confirmationText, setConfirmationText] = useState("");

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
      <div>
        <CircularProgress aria-label="Loading" size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-content1 p-4 rounded-lg border border-divider">
      <div className="flex flex-col gap-1">
        <div className="text-lg font-semibold font-tw">
          Profile settings
        </div>
        <div className="text-sm text-gray-500">
          Manage your profile settings
        </div>
      </div>
      <Spacer y={4} />
      <Input
        label="Name"
        name="name"
        value={user.name || ""}
        type="text"
        placeholder="Enter your name"
        onChange={(e) => setUser({ ...user, name: e.target.value })}
        variant="bordered"
        fullWidth
        className="max-w-md"
      />
      <Spacer y={2} />
      {submitError && (
        <>
          <Alert
            color="danger"
            title="There was an error updating your account"
            description="Please try saving again."
          />
          <Spacer y={2} />
        </>
      )}
      <div>
        <Button
          disabled={!user.name}
          color={success ? "success" : "primary"}
          onPress={_onUpdateUser}
          variant={success ? "flat" : "solid"}
          isLoading={loading}
          size="sm"
        >
          {success ? "Saved" : "Save" }
        </Button>
      </div>

      <Spacer y={4} />


      <Input
        label="Your email"
        name="email"
        value={userEmail || ""}
        onChange={(e) => setUserEmail(e.target.value)}
        type="text"
        placeholder="Enter your email"
        variant="bordered"
        fullWidth
        className="max-w-md"
      />
      {userEmail !== userProp.email && (
        <>
          <Spacer y={2} />
          <div>{"We will send you an email to confirm your new email address."}</div>
        </>
      )}
      <Spacer y={2} />
      <div>
        <Button
          isDisabled={!userEmail || userEmail === userProp.email}
          color={successEmail ? "success" : "primary"}
          onPress={_onUpdateEmail}
          variant={successEmail ? "flat" : "solid"}
          isLoading={loading}
          size="sm"
        >
          {successEmail ? "We sent you an email" : "Update email" }
        </Button>
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="text-lg font-semibold font-tw">Two-factor authentication</div>
      <Spacer y={1} />

      {!qrCode && authMethods?.length === 0 && (
        <div>
          <Button
            color="primary"
            onPress={() => _onSetup2FA()}
            endContent={<LuShieldCheck />}
          >
            {"Enable 2FA"}
          </Button>
        </div>
      )}

      {qrCode && (
        <div className="flex flex-col gap-2">
          <div>{"1. Have an authenticator app for mobile or browser ready"}</div>
          <div>{"2. Scan the QR code with the authenticator app"}</div>
          <img src={qrCode} alt="QR code" width={200} />
          <div>{"3. Enter the code from the authenticator app below"}</div>
          <Input
            label="Code"
            placeholder="Enter the code here"
            variant="bordered"
            fullWidth
            onChange={(e) => setAppToken(e.target.value)}
            className="max-w-md"
          />
          <div>{"4. Enter your account password to confirm"}</div>
          <Input
            label="Password"
            placeholder="Enter your password"
            variant="bordered"
            fullWidth
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            className="max-w-md"
          />

          <div>
            <Button
              color="primary"
              onPress={() => _onVerify2FA()}
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
          <div>{"Save these backup codes in a safe place as we only show them once. You can use them to access your account if you lose access to your authenticator app."}</div>
          <Spacer y={1} />
          <div className="flex flex-row flex-wrap gap-1">
            {backupCodes?.map((code) => (
              <Chip key={code} variant="flat" radius="sm">
                {code}
              </Chip>
            ))}
          </div>
          <Spacer y={1} />
          <div>
            <Button
              variant="bordered"
              endContent={codesCopied ? <LuClipboardCheck /> : <LuClipboardCopy />}
              onPress={_onCopyCodes}
            >
              {codesCopied ? "Copied" : "Copy codes"}
            </Button>
          </div>
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

      <div className="text-lg font-semibold font-tw">Danger zone</div>
      <Spacer y={1} />

      <div>
        <Button
          iconRight={<LuTrash />}
          color="danger"
          onPress={() => setOpenDeleteModal(true)}
        >
          Delete account
        </Button>
      </div>

      <Spacer y={4} />

      <Modal backdrop="blur" isOpen={openDeleteModal} size="xl" onClose={() => setOpenDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="text-lg font-semibold font-tw">Delete Account</div>
          </ModalHeader>
          <ModalBody>
            <div>{"This action will delete your account permanently, including your team and everything associated with it (projects, connections, and charts)."}</div>
            <div>{"We cannot reverse this action as all the content is deleted immediately."}</div>
            <div>{"We recommend you to transfer the ownership of your team to another user before deleting your account."}</div>
            <div className="flex flex-col gap-1">
              <Input
                label="Confirm your email"
                placeholder={`Enter ${userProp.email} to confirm`}
                variant="bordered"
                onChange={(e) => setConfirmationText(e.target.value)}
                fullWidth
                description={confirmationText ? userProp.email : ""}
              />
            </div>
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
              isDisabled={confirmationText !== userProp.email}
            >
              {"Delete forever"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!updateEmailToken}>
        <ModalContent>
          <ModalHeader>
            <div className="text-lg font-semibold font-tw">Update email</div>
          </ModalHeader>
          <ModalBody>
            <div>Are you sure you want to update your email?</div>
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
        <div>
          <Alert
            title="Something went wrong while deleting your account"
            description={"Please try refreshing the page."}
            color="danger"
          />
        </div>
      )}

      <Modal isOpen={!!removeMethod} onClose={() => setRemoveMethod(null)}>
        <ModalContent>
          <ModalHeader>
            <div className="text-lg font-semibold font-tw">Remove 2FA method</div>
          </ModalHeader>
          <ModalBody>
            <div>Are you sure you want to remove your 2FA method? You can add a new one afterwards.</div>
            <div>To proceed with the deletion, please confirm your Chartbrew password.</div>
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
              onPress={() => setRemoveMethod(null)}
              size="sm"
            >
              Close
            </Button>
            <Button
              color="danger"
              isDisabled={!removePassword}
              onPress={_onRemove2fa}
              isLoading={removeLoading}
              size="sm"
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

export default ManageUser;
