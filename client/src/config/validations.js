export const required = value => (value ? "" : "This field is required");

export const email = value => (!value || (value && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(value)) ? "Invalid email address" : "");

export const password = value => (!value || (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/i.test(value)) ? "Minimum 8 characters, at least 1 letter and 1 number" : "");
