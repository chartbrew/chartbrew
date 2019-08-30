import {
  SAVE_USER,
  LOGOUT_USER,
  INITIALISING_USER,
  INITIALISING_USER_FAIL,
  INITIALISING_USER_SUCCESS,
  SAVE_PENDING_INVITES,
  REMOVE_PENDING_INVITE,
} from "../actions/user";

export default function user(state = {
  loading: false,
  error: false,
  data: {},
  pendingInvites: [],
}, action) {
  switch (action.type) {
    case SAVE_USER:
      return { ...state, data: action.user };
    case LOGOUT_USER:
      return { ...state, data: {} };
    case INITIALISING_USER:
      return { ...state, loading: true };
    case INITIALISING_USER_SUCCESS:
      return { ...state, loading: false };
    case INITIALISING_USER_FAIL:
      return { ...state, loading: false, error: true };
    case SAVE_PENDING_INVITES:
      return { ...state, pendingInvites: action.invites };
    case REMOVE_PENDING_INVITE:
      const newPendingInvites = [...state.pendingInvites];
      if (newPendingInvites && newPendingInvites[0]) {
        for (let i = 0; i < state.pendingInvites[0].length; i++) {
          if (state.pendingInvites[0][i].token === action.removeInvite) {
            newPendingInvites[0].pop(i);
            break;
          }
        }
      }
      return { ...state, pendingInvites: newPendingInvites };
    default:
      return state;
  }
}
