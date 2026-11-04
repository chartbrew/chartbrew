import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button, Input, Label, TextField } from "@heroui/react";

function ChartPasswordForm({ onSubmit, loading }) {
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        onSubmit(password);
      }}
    >
      <h1 className="text-lg font-semibold">View chart</h1>
      <TextField type="password" isRequired value={password} onChange={setPassword}>
        <Label>Dashboard password</Label>
        <Input variant="secondary" autoComplete="current-password" />
      </TextField>
      {attempted && !loading && (
        <p className="text-sm text-danger" role="alert">Enter the correct password.</p>
      )}
      <Button type="submit" isPending={loading} isDisabled={!password}>
        View chart
      </Button>
    </form>
  );
}

ChartPasswordForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default ChartPasswordForm;
