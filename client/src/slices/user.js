import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import cookie from "react-cookies";
import moment from "moment";

import { API_HOST } from "../config/settings";
import { getAuthToken, tokenKey } from "../modules/auth";

const expires = moment().add(1, "month").toDate();

export const createUser = createAsyncThunk(
  "user/createUser",
  async (data) => {
    const url = `${API_HOST}/user`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    const response = await fetch(url, { body, headers, method });
    if (!response.ok) {
      throw new Error("Error creating user");
    }

    const userData = await response.json();
    if (getAuthToken()) {
      cookie.remove(tokenKey, { path: "/" });
    }
    cookie.save(tokenKey, userData.token, { expires, path: "/" });

    return userData;
  }
);

export const updateUser = createAsyncThunk(
  "user/updateUser",
  async ({ user_id, data }) => {
    const url = `${API_HOST}/user/${user_id}`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });
    const method = "PUT";

    const response = await fetch(url, { body, headers, method });
    if (!response.ok) {
      throw new Error("Error updating user");
    }

    const userData = await response.json();
    return userData;
  }
);

export const deleteUser = createAsyncThunk(
  "user/deleteUser",
  async (user_id) => {
    const url = `${API_HOST}/user/${user_id}`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });
    const method = "DELETE";

    const response = await fetch(url, { headers, method });
    if (!response.ok) {
      throw new Error("Error deleting user");
    }

    cookie.remove(tokenKey, { path: "/" });

    const userData = await response.json();
    return userData;
  }
);

export const createInvitedUser = createAsyncThunk(
  "user/createInvitedUser",
  async (data) => {
    const url = `${API_HOST}/user/invited`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    const response = await fetch(url, { body, headers, method });
    if (!response.ok) {
      throw new Error("Error creating invited user");
    }

    const userData = await response.json();
    if (getAuthToken()) {
      cookie.remove(tokenKey, { path: "/" });
    }
    cookie.save(tokenKey, userData.token, { expires, path: "/" });

    return userData;
  }
);

export const login = createAsyncThunk(
  "user/login",
  async (data) => {
    const url = `${API_HOST}/user/login`;
    const body = JSON.stringify(data);
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });
    const method = "POST";

    const response = await fetch(url, { body, headers, method });
    if (!response.ok) {
      let errorMessage = "Invalid credentials";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error;
      } catch (e) {
        errorMessage = response.statusText;
      }
      throw new Error(errorMessage);
    }

    const userData = await response.json();
    if (getAuthToken()) {
      cookie.remove(tokenKey, { path: "/" });
    }
    cookie.save(tokenKey, userData.token, { expires, path: "/" });

    return userData;
  }
);

export const relog = createAsyncThunk(
  "user/relog",
  async () => {
    const url = `${API_HOST}/user/relog`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { headers, method: "POST" });
    if (!response.ok) {
      throw new Error("Error relogging in");
    }

    const userData = await response.json();
    if (getAuthToken()) {
      cookie.remove(tokenKey, { path: "/" });
    }

    cookie.save(tokenKey, userData.token, { expires, path: "/" });

    return userData;
  }
);

export const sendFeedback = createAsyncThunk(
  "user/sendFeedback",
  async ({ name, feedback, email }) => {
    const url = `${API_HOST}/user/feedback`;
    const body = JSON.stringify({
      "from": name,
      "email": email,
      "data": feedback,
    });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { body, headers, method: "POST" });
    if (!response.ok) {
      throw new Error("Error sending feedback");
    }

    const data = await response.json();
    return data;
  }
);

export const requestPasswordReset = createAsyncThunk(
  "user/requestPasswordReset",
  async (email) => {
    const url = `${API_HOST}/user/password/reset`;
    const body = JSON.stringify({ email });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { body, headers, method: "POST" });
    if (!response.ok) {
      throw new Error("Error requesting password reset");
    }

    const data = await response.json();
    return data;
  }
);

export const changePasswordWithToken = createAsyncThunk(
  "user/changePasswordWithToken",
  async ({ hash, token, password }) => {
    const url = `${API_HOST}/user/password/change`;
    const body = JSON.stringify({ password, token, hash });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { body, headers, method: "PUT" });
    if (!response.ok) {
      throw new Error("Error changing password");
    }

    const data = await response.json();
    return data;
  }
);

export const areThereAnyUsers = createAsyncThunk(
  "user/areThereAnyUsers",
  async () => {
    const url = `${API_HOST}/app/users`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error("Error checking if there are any users");
    }

    const data = await response.json();
    return data;
  }
);

export const requestEmailUpdate = createAsyncThunk(
  "user/requestEmailUpdate",
  async ({ user_id, email }) => {
    const url = `${API_HOST}/user/${user_id}/email/verify`;
    const body = JSON.stringify({ email });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { body, headers, method: "POST" });
    if (!response.ok) {
      throw new Error("Error requesting email update");
    }

    const data = await response.json();
    return data;
  }
);

export const updateEmail = createAsyncThunk(
  "user/updateEmail",
  async ({ user_id, token }) => {
    const url = `${API_HOST}/user/${user_id}/email/update`;
    const body = JSON.stringify({ token });
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { body, headers, method: "PUT" });
    if (!response.ok) {
      throw new Error("Error updating email");
    }

    const data = await response.json();
    return data;
  }
);

export const completeTutorial = createAsyncThunk(
  "user/completeTutorial",
  async ({ user_id, tutorial }, thunkApi) => {
    const currentTutorials = thunkApi.getState().user.data?.tutorials || {};
    const newTutorials = { ...currentTutorials, ...tutorial };

    const url = `${API_HOST}/user/${user_id}`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });
    const body = JSON.stringify({ tutorials: newTutorials });

    const response = await fetch(url, { headers, method: "PUT", body });
    if (!response.ok) {
      throw new Error("Error completing tutorial");
    }

    const data = await response.json();
    return data;
  }
);

export const get2faAppCode = createAsyncThunk(
  "user/get2faCode",
  async (user_id) => {
    const url = `${API_HOST}/user/${user_id}/2fa/app`;
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { headers, method });
    if (!response.ok) {
      throw new Error("Error getting 2fa code");
    }

    const data = await response.json();
    return data;
  }
);

export const verify2faApp = createAsyncThunk(
  "user/verify2faApp",
  async ({ user_id, token, password }) => {
    const url = `${API_HOST}/user/${user_id}/2fa/app/verify`;
    const body = JSON.stringify({ token, password });
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { headers, method, body });
    if (!response.ok) {
      throw new Error("Error verifying 2fa app");
    }

    const data = await response.json();
    return data;
  }
);

export const get2faMethods = createAsyncThunk(
  "user/get2faMethods",
  async (user_id) => {
    const url = `${API_HOST}/user/${user_id}/2fa`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error("Error getting 2fa methods");
    }

    const data = await response.json();
    return data;
  }
);

export const remove2faMethod = createAsyncThunk(
  "user/remove2faMethod",
  async ({ user_id, method_id, password }) => {
    const url = `${API_HOST}/user/${user_id}/2fa/${method_id}`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });
    const body = JSON.stringify({ password });
    const method = "DELETE";

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error("Could not delete 2fa method");
    }

    const data = await response.json();
    return data;
  }
);

export const validate2faLogin = createAsyncThunk(
  "user/validate2faLogin",
  async({ user_id, method_id, token }) => {
    const url = `${API_HOST}/user/${user_id}/2fa/${method_id}/login`;
    const body = JSON.stringify({ token, method_id });
    const method = "POST";
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
    });

    const response = await fetch(url, { headers, method, body });
    if (!response.ok) {
      throw new Error("Error verifying 2fa app");
    }

    const userData = await response.json();
    if (getAuthToken()) {
      cookie.remove(tokenKey, { path: "/" });
    }
    cookie.save(tokenKey, userData.token, { expires, path: "/" });

    return userData;
  }
)

const initialState = {
  loading: false,
  error: false,
  data: {},
  auths: [],
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      cookie.remove(tokenKey, { path: "/" });
      state.data = {};
      window.location.href = "/";
    },
    clearUser: (state) => {
      state.data = {};
    },
  },
  extraReducers: (builder) => {
    // createUser
    builder.addCase(createUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(createUser.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(createUser.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // updateUser
    builder.addCase(updateUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(updateUser.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(updateUser.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // deleteUser
    builder.addCase(deleteUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(deleteUser.fulfilled, (state) => {
      state.loading = false;
      state.data = {};
    });
    builder.addCase(deleteUser.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // createInvitedUser
    builder.addCase(createInvitedUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(createInvitedUser.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(createInvitedUser.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // login
    builder.addCase(login.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      if (!action.payload?.method_id) {
        state.data = action.payload;
      }
    });
    builder.addCase(login.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // relog
    builder.addCase(relog.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(relog.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(relog.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // completeTutorial
    builder.addCase(completeTutorial.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(completeTutorial.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(completeTutorial.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // get2faMethods
    builder.addCase(get2faMethods.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(get2faMethods.fulfilled, (state, action) => {
      state.loading = false;
      state.auths = action.payload;
    });
    builder.addCase(get2faMethods.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })

    // remove2faMethod
    builder.addCase(remove2faMethod.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(remove2faMethod.fulfilled, (state, action) => {
      state.loading = false;
      state.auths = state.auths.filter((a) => a.id !== action.meta.arg.method_id);
    });
    builder.addCase(remove2faMethod.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });

    // validate2faLogin
    // login
    builder.addCase(validate2faLogin.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(validate2faLogin.fulfilled, (state, action) => {
      state.loading = false;
      state.data = action.payload;
    });
    builder.addCase(validate2faLogin.rejected, (state) => {
      state.loading = false;
      state.error = true;
    })
  },
});

export const { logout, clearUser } = userSlice.actions;

export const selectUser = (state) => state.user.data;

export default userSlice.reducer;
