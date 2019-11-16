export const ADD_ERROR = "ADD_ERROR";
export const REMOVE_ERROR = "REMOVE_ERROR";
export const CLEAN_ERRORS = "CLEAN_ERRORS";

export function addError(code, message = "Server Error") {
  return (dispatch) => {
    dispatch({
      type: ADD_ERROR,
      error: {
        pathname: window.location.pathname,
        code,
        message,
      },
    });
  };
}

export function removeError(index) {
  return (dispatch) => {
    dispatch({
      type: REMOVE_ERROR,
      index,
    });
  };
}

export function cleanErrors() {
  return (dispatch) => {
    dispatch({
      type: CLEAN_ERRORS,
    });
  };
}
